import { EnvelopeType } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { createEnvelope } from '@documenso/lib/server-only/envelope/create-envelope';
import { insertFormValuesInPdf } from '@documenso/lib/server-only/pdf/insert-form-values-in-pdf';
import { putNormalizedPdfFileServerSide } from '@documenso/lib/universal/upload/put-file.server';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';

import { authenticatedProcedure } from '../trpc';
import {
  ZCreateDocumentRequestSchema,
  ZCreateDocumentResponseSchema,
  createDocumentMeta,
} from './create-document.types';

export const createDocumentRoute = authenticatedProcedure
  .meta(createDocumentMeta)
  .input(ZCreateDocumentRequestSchema)
  .output(ZCreateDocumentResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { user, teamId } = ctx;

    const { payload, file } = input;

    const {
      title,
      externalId,
      visibility,
      globalAccessAuth,
      globalActionAuth,
      recipients,
      meta,
      folderId,
      formValues,
      attachments,
    } = payload;

    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    const isLargeFile = file.size > 100 * 1024 * 1024; // 100MB - log for monitoring large files

    if (isLargeFile) {
      ctx.logger.info({
        message: `Processing large file: ${file.name}`,
        fileSizeMB: parseFloat(fileSizeMB),
        fileSizeBytes: file.size,
      });
    }

    let pdf = Buffer.from(await file.arrayBuffer());

    if (formValues) {
      if (isLargeFile) {
        ctx.logger.info({
          message: `Inserting form values into large PDF: ${file.name}`,
          fileSizeMB: parseFloat(fileSizeMB),
        });
      }

      // eslint-disable-next-line require-atomic-updates
      pdf = await insertFormValuesInPdf({
        pdf,
        formValues,
      });
    }

    if (isLargeFile) {
      ctx.logger.info({
        message: `Uploading large file to storage: ${file.name}`,
        fileSizeMB: parseFloat(fileSizeMB),
        pdfSizeMB: (pdf.length / (1024 * 1024)).toFixed(2),
      });
    }

    const { id: documentDataId } = await putNormalizedPdfFileServerSide({
      name: file.name,
      type: 'application/pdf',
      arrayBuffer: async () => Promise.resolve(pdf),
    });

    if (isLargeFile) {
      ctx.logger.info({
        message: `Successfully processed large file: ${file.name}`,
        fileSizeMB: parseFloat(fileSizeMB),
        documentDataId,
      });
    }

    ctx.logger.info({
      input: {
        folderId,
      },
    });

    const document = await createEnvelope({
      userId: user.id,
      teamId,
      internalVersion: 1,
      data: {
        type: EnvelopeType.DOCUMENT,
        title,
        externalId,
        visibility,
        globalAccessAuth,
        globalActionAuth,
        recipients: (recipients || []).map((recipient) => ({
          ...recipient,
          fields: (recipient.fields || []).map((field) => ({
            ...field,
            page: field.pageNumber,
            positionX: field.pageX,
            positionY: field.pageY,
            documentDataId,
          })),
        })),
        folderId,
        envelopeItems: [
          {
            // If you ever allow more than 1 in this endpoint, make sure to use `maximumEnvelopeItemCount` to limit it.
            documentDataId,
          },
        ],
      },
      attachments,
      meta: {
        ...meta,
        emailSettings: meta?.emailSettings ?? undefined,
      },
      requestMetadata: ctx.metadata,
    });

    return {
      envelopeId: document.id,
      id: mapSecondaryIdToDocumentId(document.secondaryId),
    };
  });
