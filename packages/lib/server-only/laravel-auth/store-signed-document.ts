import { type Envelope, LogLevel, type Recipient } from '@documenso/prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { TSigningContext } from '../../types/document';
import { createLog } from '../../utils/createLog';
import { env } from '../../utils/env';
import { AzureService } from '../azure/azure-service';
import { generateLaravelToken } from './get-laravel-token';

export const storeSignedDocument = async (
  envelope: Envelope,
  base64Data: string,
  signingContext: TSigningContext | undefined,
  legacyDocumentId: number,
  recipient: Recipient,
  allSigned: boolean = false,
) => {
  const ownerId = String(envelope.ownerId ?? '');
  const documentKey = String(envelope.formKey ?? '');

  const basePath = env('FOLDER_FILE');
  const apiUrl = env('NEXT_PRIVATE_LARAVEL_API_URL');

  if (!apiUrl) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'NEXT_PRIVATE_LARAVEL_API_URL environment variable is not defined',
    });
  }

  try {
    const azureService = new AzureService();
    const folderPath = `${basePath}/documenso/${signingContext?.module}/${ownerId}`;
    const fileName = `${documentKey}.pdf`;

    const pdfUrl = await azureService.uploadBase64(base64Data, fileName, folderPath);

    const token = await generateLaravelToken();
    const url = `${apiUrl}/store-signed-document`;

    const formData = {
      clientName: String(signingContext?.companyName || ''),
      documensoId: String(legacyDocumentId),
      documentKey: documentKey,
      ownerId: ownerId,
      fileUrl: pdfUrl,
      recipient: allSigned ? 'AllRecipientsSigned' : recipient.email || '',
      recipientId: allSigned ? null : String(recipient.id),
      signingOrder: allSigned ? null : recipient.signingOrder,
      formType: String(signingContext?.formType || ''),
      module: String(signingContext?.module || ''),
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-TOKEN': token,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(formData),
      signal: AbortSignal.timeout(60000),
    });

    const data = await response.json();

    const EXPECTED_SUCCESS_MESSAGE = 'Signed document stored successfully';

    if (!response.ok || data?.message !== EXPECTED_SUCCESS_MESSAGE) {
      await createLog({
        level: LogLevel.ERROR,
        action: 'LARAVEL_STORE_REJECTED',
        message: 'Laravel rejected the signed document',
        data: {
          envelopeId: envelope.id,
          legacyDocumentId,
          status: response.status,
          responseData: data,
          formData,
        },
      });

      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: `Laravel API returned error: ${data?.message || response.statusText}`,
      });
    }

    await createLog({
      level: LogLevel.INFO,
      action: 'LARAVEL_STORE_SUCCESS',
      message: 'Signed document successfully stored in Laravel',
      data: {
        envelopeId: envelope.id,
        legacyDocumentId,
        recipientEmail: recipient.email,
        pdfUrl,
        allSigned,
      },
    });

    return {
      fileUrl: data.fileUrl || pdfUrl,
      success: true,
    };
  } catch (error) {
    if (!(error instanceof AppError)) {
      await createLog({
        level: LogLevel.ERROR,
        action: 'STORE_SIGNED_DOCUMENT_UNKNOWN_ERROR',
        message: 'Unexpected error storing signed document',
        data: {
          envelopeId: envelope.id,
          legacyDocumentId,
          recipientEmail: recipient.email,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
    }

    throw error;
  }
};
