import { DocumentDataType } from '@prisma/client';
import { base64 } from '@scure/base';
import { match } from 'ts-pattern';

import { getPresignGetUrl } from './server-actions';

export type GetFileOptions = {
  type: DocumentDataType;
  data: string;
};

export const getFileServerSide = async ({ type, data }: GetFileOptions) => {
  return await match(type)
    .with(DocumentDataType.BYTES, () => getFileFromBytes(data))
    .with(DocumentDataType.BYTES_64, () => getFileFromBytes64(data))
    .with(DocumentDataType.S3_PATH, async () => getFileFromS3(data))
    .exhaustive();
};

const getFileFromBytes = (data: string) => {
  const encoder = new TextEncoder();

  const binaryData = encoder.encode(data);

  return binaryData;
};

const getFileFromBytes64 = (data: string) => {
  const binaryData = base64.decode(data);

  return binaryData;
};

const getFileFromS3 = async (key: string) => {
  try {
    const { url } = await getPresignGetUrl(key);

    const response = await fetch(url, {
      method: 'GET',
      // Add timeout for large files (5 minutes)
      signal: AbortSignal.timeout(5 * 60 * 1000),
    });

    if (!response.ok) {
      const errorMessage = `Failed to get file "${key}", failed with status code ${response.status}`;
      console.error('[getFileFromS3]', errorMessage, {
        key,
        status: response.status,
        statusText: response.statusText,
      });
      throw new Error(errorMessage);
    }

    const contentLength = response.headers.get('content-length');
    const fileSizeBytes = contentLength ? parseInt(contentLength, 10) : null;
    const fileSizeMB = fileSizeBytes ? (fileSizeBytes / (1024 * 1024)).toFixed(2) : null;

    if (fileSizeMB && parseFloat(fileSizeMB) > 100) {
      console.log(`[getFileFromS3] Loading large file: ${fileSizeMB}MB from key: ${key}`);
    }

    const buffer = await response.arrayBuffer();

    if (fileSizeMB) {
      console.log(`[getFileFromS3] Successfully loaded file: ${fileSizeMB}MB from key: ${key}`);
    }

    const binaryData = new Uint8Array(buffer);

    return binaryData;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        const timeoutError = new Error(
          `Timeout while fetching file "${key}" from S3. The file may be too large or the connection is slow.`,
        );
        console.error('[getFileFromS3] Timeout error:', {
          key,
          error: error.message,
        });
        throw timeoutError;
      }

      if (error.message.includes('Failed to get file')) {
        throw error;
      }

      console.error('[getFileFromS3] Unexpected error:', {
        key,
        error: error.message,
        stack: error.stack,
      });
      throw new Error(`Failed to get file "${key}": ${error.message}`);
    }

    console.error('[getFileFromS3] Unknown error:', {
      key,
      error,
    });
    throw new Error(`Failed to get file "${key}": Unknown error`);
  }
};
