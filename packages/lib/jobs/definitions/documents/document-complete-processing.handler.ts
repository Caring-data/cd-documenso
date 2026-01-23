import { LogLevel } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { storeSignedDocument } from '../../../server-only/laravel-auth/store-signed-document';
import { generateSignedPdf } from '../../../server-only/pdf/generate-signed-pdf';
import { type TSigningContext, ZSigningContextSchema } from '../../../types/document';
import { createLog } from '../../../utils/createLog';
import type { JobRunIO } from '../../client/_internal/job';
import type { TDocumentCompleteProcessingJobDefinition } from './document-complete-processing';

export const run = async ({
  payload,
  io,
}: {
  payload: TDocumentCompleteProcessingJobDefinition;
  io: JobRunIO;
}) => {
  const { envelopeId, legacyDocumentId, recipientId, requestMetadata } = payload;

  await io.runTask('process-document-completion', async () => {
    try {
      await createLog({
        level: LogLevel.INFO,
        action: 'PROCESS_COMPLETION_START',
        message: 'Starting envelope completion processing',
        data: { envelopeId, legacyDocumentId, recipientId },
        metadata: requestMetadata,
      });

      const envelope = await prisma.envelope.findFirstOrThrow({
        where: { id: envelopeId },
        include: {
          documentMeta: true,
          recipients: true,
          envelopeItems: {
            include: {
              documentData: true,
            },
          },
          team: {
            select: {
              teamGlobalSettings: {
                select: {
                  includeSigningCertificate: true,
                },
              },
            },
          },
        },
      });

      const recipient = envelope.recipients.find((r) => r.id === recipientId);
      if (!recipient) {
        throw new Error(`Recipient ${recipientId} not found`);
      }

      const parsedSigningContext =
        envelope.signingContext === null
          ? null
          : ZSigningContextSchema.safeParse(envelope.signingContext);

      const documentDetails: TSigningContext = parsedSigningContext?.data || null;

      if (!documentDetails || typeof documentDetails !== 'object') {
        await createLog({
          level: LogLevel.ERROR,
          action: 'INVALID_SIGNING_CONTEXT',
          message: 'Invalid or missing signing context',
          data: { envelopeId, legacyDocumentId, signingContext: envelope.signingContext },
          metadata: requestMetadata,
        });

        throw new Error('Invalid or missing signingContext');
      }

      await createLog({
        level: LogLevel.INFO,
        action: 'GENERATING_SIGNED_PDF',
        message: 'Starting signed PDF generation',
        data: { envelopeId, legacyDocumentId },
        metadata: requestMetadata,
      });

      const envelopeFields = await prisma.field.findMany({
        where: {
          envelopeId: envelope.id,
        },
        include: {
          signature: true,
        },
      });

      const originalPdfData = envelope.envelopeItems[0]?.documentData?.data;
      if (!originalPdfData) {
        throw new Error('Original PDF data not found in envelope items');
      }

      const signedPdfBuffer = await generateSignedPdf({
        envelope: {
          ...envelope,
          internalVersion: envelope.internalVersion,
          useLegacyFieldInsertion: envelope.useLegacyFieldInsertion,
        },
        envelopeItem: envelope.envelopeItems[0],
        fields: envelopeFields,
        certificateData: null,
      });

      await createLog({
        level: LogLevel.INFO,
        action: 'PDF_GENERATED',
        message: 'Signed PDF successfully generated',
        data: {
          envelopeId,
          legacyDocumentId,
          pdfSize: signedPdfBuffer.length,
          fieldsCount: envelopeFields.length,
        },
        metadata: requestMetadata,
      });

      const base64SignedPdf = signedPdfBuffer.toString('base64');

      try {
        await storeSignedDocument(
          envelope,
          base64SignedPdf,
          documentDetails,
          legacyDocumentId,
          recipient,
          false,
        );

        await createLog({
          level: LogLevel.INFO,
          action: 'STORING_SIGNED_DOCUMENT_SUCCESS',
          message: 'Signed document successfully stored',
          data: { envelopeId, legacyDocumentId, recipientId },
          metadata: requestMetadata,
        });
      } catch (storeError) {
        await createLog({
          level: LogLevel.ERROR,
          action: 'STORING_SIGNED_DOCUMENT_FAILED',
          message: 'Error storing signed document',
          data: {
            error: storeError instanceof Error ? storeError.message : String(storeError),
            stack: storeError instanceof Error ? storeError.stack : undefined,
            envelopeId,
            legacyDocumentId,
            recipientId,
          },
          metadata: requestMetadata,
        });
        throw storeError;
      }

      await createLog({
        level: LogLevel.INFO,
        action: 'ENVELOPE_COMPLETION_PROCESSED',
        message: 'Envelope completion processed successfully',
        data: { envelopeId, legacyDocumentId, recipientId },
        metadata: requestMetadata,
      });
    } catch (error) {
      await createLog({
        level: LogLevel.ERROR,
        action: 'PROCESS_ENVELOPE_COMPLETION_ERROR',
        message: 'Error processing envelope completion',
        data: {
          error: error instanceof Error ? error.message : String(error),
          envelopeId,
          legacyDocumentId,
          recipientId,
        },
        metadata: requestMetadata,
      });

      throw error;
    }
  });
};
