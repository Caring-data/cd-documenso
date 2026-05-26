import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

const execFileAsync = promisify(execFile);

export async function repairPdfWithGhostscript(pdfBuffer: Buffer): Promise<Buffer> {
  const inputPath = join(tmpdir(), `${uuidv4()}.pdf`);
  const outputPath = join(tmpdir(), `${uuidv4()}-repaired.pdf`);

  try {
    await fs.writeFile(inputPath, new Uint8Array(pdfBuffer));

    await execFileAsync(
      'gs',
      [
        '-sDEVICE=pdfwrite',
        '-dCompatibilityLevel=1.4',
        '-dNOPAUSE',
        '-dQUIET',
        '-dBATCH',
        '-dSAFER',
        '-sOutputFile=' + outputPath,
        inputPath,
      ],
      { timeout: 60000 },
    );

    const repaired = await fs.readFile(outputPath);

    if (!repaired.length) {
      throw new Error('Ghostscript repaired PDF is empty');
    }

    return repaired;
  } finally {
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
  }
}
