import { PDFDocument } from '@cantoo/pdf-lib';

import { AppError } from '../../errors/app-error';
import { flattenAnnotations } from './flatten-annotations';
import { flattenForm } from './flatten-form';
import { repairPdfWithGhostscript } from './repair-pdf';

export const normalizePdf = async (pdf: Buffer, logContext?: any): Promise<Buffer> => {
  let pdfBuffer = pdf;
  let pdfDoc: PDFDocument;

  try {
    pdfDoc = await PDFDocument.load(pdfBuffer);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('encrypted')) {
      pdfBuffer = await repairPdfWithGhostscript(pdfBuffer);
      pdfDoc = await PDFDocument.load(pdfBuffer);
    } else {
      throw new AppError('INVALID_DOCUMENT_FILE', {
        message: 'The document is not a valid PDF',
      });
    }
  }

  if (pdfDoc.isEncrypted) {
    try {
      pdfBuffer = await repairPdfWithGhostscript(pdfBuffer);
      pdfDoc = await PDFDocument.load(pdfBuffer);
    } catch {
      throw new AppError('INVALID_DOCUMENT_FILE', {
        message: 'The document is encrypted',
      });
    }
  }

  await flattenForm(pdfDoc, logContext);

  flattenAnnotations(pdfDoc);

  return Buffer.from(await pdfDoc.save());
};
