import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { LogCategory, LogLevel } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

import { createLog } from '../../utils/createLog';
import { env } from '../../utils/env';

const MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
};

export class AzureService {
  private blobServiceClient: BlobServiceClient;
  private containerName: string;

  constructor() {
    const connectionString = env('AZURE_STORAGE_CONNECTION_STRING');
    const containerName = env('AZURE_STORAGE_CONTAINER_NAME');
    if (!containerName) {
      throw new Error('AZURE_STORAGE_CONTAINER_NAME environment variable is required');
    }
    this.containerName = containerName;

    if (connectionString) {
      this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    } else {
      const accountName = env('AZURE_STORAGE_ACCOUNT_NAME');
      const accountKey = env('AZURE_STORAGE_ACCOUNT_KEY');

      if (!accountName || !accountKey) {
        throw new Error(
          'Azure Storage credentials are not configured properly. Provide either AZURE_STORAGE_CONNECTION_STRING or both AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_ACCOUNT_KEY',
        );
      }

      const credential = new StorageSharedKeyCredential(accountName, accountKey);
      this.blobServiceClient = new BlobServiceClient(
        `https://${accountName}.blob.core.windows.net`,
        credential,
      );
    }
  }

  private extractMimeTypeFromBase64(base64String: string): string | undefined {
    const mimeMatch = base64String.match(/^data:([^;]+);base64,/);
    return mimeMatch ? mimeMatch[1] : undefined;
  }

  private getMimeType(extension: string): string {
    return MIME_TYPES[extension.toLowerCase()] || 'application/octet-stream';
  }

  private generateUniqueFileName(fileName: string): string {
    const fileExtension = fileName.split('.').pop() || '';
    return `${uuidv4()}.${fileExtension}`;
  }

  private buildBlobPath(fileName: string, folder?: string): string {
    const uniqueFileName = this.generateUniqueFileName(fileName);
    return folder ? `${folder}/${uniqueFileName}` : uniqueFileName;
  }

  async uploadFile(
    buffer: Buffer,
    fileName: string,
    folder?: string,
    mimeType?: string,
  ): Promise<string> {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);

      await containerClient.createIfNotExists();

      const blobPath = this.buildBlobPath(fileName, folder);
      const blockBlobClient = containerClient.getBlockBlobClient(blobPath);

      const fileExtension = fileName.split('.').pop() || '';
      const contentType = mimeType || this.getMimeType(fileExtension);

      await blockBlobClient.uploadData(buffer, {
        blobHTTPHeaders: {
          blobContentType: contentType,
        },
      });

      return blockBlobClient.url;
    } catch (error) {
      await createLog({
        level: LogLevel.ERROR,
        category: LogCategory.DOCUMENT,
        action: 'AZURE_UPLOAD_FAILED',
        message: 'Error uploading file to Azure Blob Storage',
        data: {
          fileName,
          folder,
          bufferSize: buffer.length,
          error: error instanceof Error ? error.message : String(error),
        },
      });

      throw error;
    }
  }

  async uploadBase64(base64String: string, fileName: string, folder?: string): Promise<string> {
    try {
      const buffer = this.base64ToBuffer(base64String);
      const mimeType = this.extractMimeTypeFromBase64(base64String);

      return await this.uploadFile(buffer, fileName, folder, mimeType);
    } catch (error) {
      await createLog({
        level: LogLevel.ERROR,
        category: LogCategory.DOCUMENT,
        action: 'AZURE_UPLOAD_BASE64_FAILED',
        message: 'Error uploading base64 file to Azure',
        data: {
          fileName,
          folder,
          error: error instanceof Error ? error.message : String(error),
        },
      });

      throw error;
    }
  }

  private base64ToBuffer(base64String: string): Buffer {
    try {
      const base64Data = base64String.replace(/^data:[^;]+;base64,/, '');
      return Buffer.from(base64Data, 'base64');
    } catch (error) {
      console.error('Error converting base64 to buffer:', error);
      throw new Error(`Error converting base64 to buffer: ${error}`);
    }
  }
}

export function bufferToBase64(buffer: Buffer, mimeType?: string): string {
  try {
    const base64 = buffer.toString('base64');
    return mimeType ? `data:${mimeType};base64,${base64}` : base64;
  } catch (error) {
    console.error('Error converting buffer to base64:', error);
    throw new Error(`Error converting buffer to base64: ${error}`);
  }
}
