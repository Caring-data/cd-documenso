import {
  PDFDocument,
  RotationTypes,
  popGraphicsState,
  pushGraphicsState,
  radiansToDegrees,
  rotateDegrees,
  translate,
} from '@cantoo/pdf-lib';
import type {
  DocumentData,
  DocumentMeta,
  Envelope,
  EnvelopeItem,
  Field,
  Recipient,
  Signature,
} from '@prisma/client';
import {
  DocumentDataType,
  DocumentStatus,
  EnvelopeType,
  LogLevel,
  RecipientRole,
  SigningStatus,
  WebhookTriggerEvents,
} from '@prisma/client';
import { nanoid } from 'nanoid';
import path from 'node:path';
import { groupBy } from 'remeda';
import { match } from 'ts-pattern';

import { prisma } from '@documenso/prisma';
import { signPdf } from '@documenso/signing';

import { NEXT_PRIVATE_USE_PLAYWRIGHT_CERTIFICATE } from '../../../constants/app';
import { AppError, AppErrorCode } from '../../../errors/app-error';
import { sendCompletedEmail } from '../../../server-only/document/send-completed-email';
import { getAuditLogsPdf } from '../../../server-only/htmltopdf/get-audit-logs-pdf';
import { getCertificatePdf } from '../../../server-only/htmltopdf/get-certificate-pdf';
import { storeSignedDocument } from '../../../server-only/laravel-auth/store-signed-document';
import { addRejectionStampToPdf } from '../../../server-only/pdf/add-rejection-stamp-to-pdf';
import { flattenAnnotations } from '../../../server-only/pdf/flatten-annotations';
import { flattenForm } from '../../../server-only/pdf/flatten-form';
import { generateCertificatePdf } from '../../../server-only/pdf/generate-certificate-pdf';
import { getPageSize } from '../../../server-only/pdf/get-page-size';
import { insertFieldInPDFV1 } from '../../../server-only/pdf/insert-field-in-pdf-v1';
import { insertFieldInPDFV2 } from '../../../server-only/pdf/insert-field-in-pdf-v2';
import { legacy_insertFieldInPDF } from '../../../server-only/pdf/legacy-insert-field-in-pdf';
import { normalizeSignatureAppearances } from '../../../server-only/pdf/normalize-signature-appearances';
import { getTeamSettings } from '../../../server-only/team/get-team-settings';
import { triggerWebhook } from '../../../server-only/webhooks/trigger/trigger-webhook';
import { type TSigningContext, ZSigningContextSchema } from '../../../types/document';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../../types/document-audit-logs';
import {
  ZWebhookDocumentSchema,
  mapEnvelopeToWebhookDocumentPayload,
} from '../../../types/webhook-payload';
import { prefixedId } from '../../../universal/id';
import { getFileServerSide } from '../../../universal/upload/get-file.server';
import { putPdfFileServerSide } from '../../../universal/upload/put-file.server';
import { fieldsContainUnsignedRequiredField } from '../../../utils/advanced-fields-helpers';
import { createLog } from '../../../utils/createLog';
import { isDocumentCompleted } from '../../../utils/document';
import { createDocumentAuditLogData } from '../../../utils/document-audit-logs';
import { mapDocumentIdToSecondaryId, mapSecondaryIdToDocumentId } from '../../../utils/envelope';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSealDocumentJobDefinition } from './seal-document';

export const run = async ({
  payload,
  io,
}: {
  payload: TSealDocumentJobDefinition;
  io: JobRunIO;
}) => {
  const { documentId, sendEmail = true, isResealing = false, requestMetadata } = payload;

  const { envelopeId, envelopeStatus, isRejected } = await io.runTask('seal-document', async () => {
    const envelope = await prisma.envelope.findFirstOrThrow({
      where: {
        type: EnvelopeType.DOCUMENT,
        secondaryId: mapDocumentIdToSecondaryId(documentId),
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        documentMeta: true,
        recipients: true,
        envelopeItems: {
          include: {
            documentData: true,
            field: {
              include: {
                signature: true,
              },
            },
          },
        },
      },
    });

    if (envelope.envelopeItems.length === 0) {
      throw new Error('At least one envelope item required');
    }

    const settings = await getTeamSettings({
      userId: envelope.userId,
      teamId: envelope.teamId,
    });

    // Ensure all CC recipients are marked as signed
    await prisma.recipient.updateMany({
      where: {
        envelopeId: envelope.id,
        role: RecipientRole.CC,
      },
      data: {
        signingStatus: SigningStatus.SIGNED,
      },
    });

    const isComplete =
      envelope.recipients.some((recipient) => recipient.signingStatus === SigningStatus.REJECTED) ||
      envelope.recipients.every(
        (recipient) =>
          recipient.signingStatus === SigningStatus.SIGNED || recipient.role === RecipientRole.CC,
      );

    if (!isComplete) {
      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Document is not complete',
      });
    }

    let envelopeItems = envelope.envelopeItems;

    if (envelopeItems.length < 1) {
      throw new Error(`Document ${envelope.id} has no envelope items`);
    }

    const recipients = await prisma.recipient.findMany({
      where: {
        envelopeId: envelope.id,
        role: {
          not: RecipientRole.CC,
        },
      },
    });

    // Determine if the document has been rejected by checking if any recipient has rejected it
    const rejectedRecipient = recipients.find(
      (recipient) => recipient.signingStatus === SigningStatus.REJECTED,
    );

    const isRejected = Boolean(rejectedRecipient);

    // Get the rejection reason from the rejected recipient
    const rejectionReason = rejectedRecipient?.rejectionReason ?? '';

    const fields = await prisma.field.findMany({
      where: {
        envelopeId: envelope.id,
      },
      include: {
        signature: true,
      },
    });

    // Skip the field check if the document is rejected
    if (!isRejected && fieldsContainUnsignedRequiredField(fields)) {
      throw new Error(`Document ${envelope.id} has unsigned required fields`);
    }

    if (isResealing) {
      // If we're resealing we want to use the initial data for the document
      // so we aren't placing fields on top of eachother.
      envelopeItems = envelopeItems.map((envelopeItem) => ({
        ...envelopeItem,
        documentData: {
          ...envelopeItem.documentData,
          data: envelopeItem.documentData.initialData,
        },
      }));
    }

    if (!envelope.qrToken) {
      await prisma.envelope.update({
        where: {
          id: envelope.id,
        },
        data: {
          qrToken: prefixedId('qr'),
        },
      });
    }

    const legacyDocumentId = mapSecondaryIdToDocumentId(envelope.secondaryId);
    const certificateStartedAt = Date.now();

    await createLog({
      level: LogLevel.INFO,
      action: 'CERTIFICATE_FETCH_START',
      message: 'Fetching certificate and audit log data',
      data: {
        envelopeId: envelope.id,
        legacyDocumentId,
        includeCertificate: settings.includeSigningCertificate,
        includeAuditLog: settings.includeAuditLog,
      },
      metadata: requestMetadata,
    });

    const { certificateData, auditLogData } = await getCertificateAndAuditLogData({
      legacyDocumentId,
      documentMeta: envelope.documentMeta,
      settings,
      envelopeId: envelope.id,
      authOptions: envelope.authOptions,
      envelopeOwner: {
        name: envelope.user.name ?? '',
        email: envelope.user.email,
      },
      recipients,
      fields,
    });

    await createLog({
      level: LogLevel.INFO,
      action: 'CERTIFICATE_FETCH_RESULT',
      message: 'Certificate and audit log fetch result',
      data: {
        envelopeId: envelope.id,
        legacyDocumentId,
        hasCertificate: Boolean(certificateData),
        certificateSize: certificateData?.length ?? 0,
        durationMs: Date.now() - certificateStartedAt,
      },
      metadata: requestMetadata,
    });

    const newDocumentData: Array<{ oldDocumentDataId: string; newDocumentDataId: string }> = [];

    for (const envelopeItem of envelopeItems) {
      const envelopeItemFields = envelope.envelopeItems.find(
        (item) => item.id === envelopeItem.id,
      )?.field;

      if (!envelopeItemFields) {
        throw new Error(`Envelope item fields not found for envelope item ${envelopeItem.id}`);
      }

      await createLog({
        level: LogLevel.INFO,
        action: 'PDF_DECORATION_START',
        message: 'Starting PDF decoration and signing',
        data: {
          envelopeId: envelope.id,
          hasCertificate: !!certificateData,
          hasAuditLog: !!auditLogData,
          isRejected,
        },
        metadata: requestMetadata,
      });

      const result = await decorateAndSignPdf({
        envelope,
        envelopeItem,
        envelopeItemFields,
        isRejected,
        rejectionReason,
        certificateData,
        auditLogData,
      });

      newDocumentData.push(result);
    }

    await prisma.$transaction(async (tx) => {
      for (const { oldDocumentDataId, newDocumentDataId } of newDocumentData) {
        const newData = await tx.documentData.findFirstOrThrow({
          where: {
            id: newDocumentDataId,
          },
        });

        await tx.documentData.update({
          where: {
            id: oldDocumentDataId,
          },
          data: {
            data: newData.data,
          },
        });
      }

      await tx.envelope.update({
        where: {
          id: envelope.id,
        },
        data: {
          status: isRejected ? DocumentStatus.REJECTED : DocumentStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      await tx.documentAuditLog.create({
        data: createDocumentAuditLogData({
          type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_COMPLETED,
          envelopeId: envelope.id,
          requestMetadata,
          user: null,
          data: {
            transactionId: nanoid(),
            ...(isRejected ? { isRejected: true, rejectionReason: rejectionReason } : {}),
          },
        }),
      });
    });

    return {
      envelopeId: envelope.id,
      envelopeStatus: envelope.status,
      isRejected,
    };
  });

  const updatedEnvelope = await prisma.envelope.findFirstOrThrow({
    where: {
      id: envelopeId,
    },
    include: {
      documentMeta: true,
      recipients: true,
    },
  });

  await triggerWebhook({
    event: isRejected
      ? WebhookTriggerEvents.DOCUMENT_REJECTED
      : WebhookTriggerEvents.DOCUMENT_COMPLETED,
    data: ZWebhookDocumentSchema.parse(mapEnvelopeToWebhookDocumentPayload(updatedEnvelope)),
    userId: updatedEnvelope.userId,
    teamId: updatedEnvelope.teamId ?? undefined,
  });

  await io.runTask('send-final-document-to-laravel', async () => {
    try {
      const finalEnvelope = await prisma.envelope.findFirstOrThrow({
        where: { id: envelopeId },
        include: {
          recipients: true,
          envelopeItems: {
            include: {
              documentData: true,
            },
          },
        },
      });

      const legacyDocumentId = mapSecondaryIdToDocumentId(finalEnvelope.secondaryId);

      const parsedSigningContext =
        finalEnvelope.signingContext === null
          ? null
          : ZSigningContextSchema.safeParse(finalEnvelope.signingContext);

      const documentDetails: TSigningContext = parsedSigningContext?.data || null;

      if (!documentDetails || typeof documentDetails !== 'object') {
        await createLog({
          level: LogLevel.ERROR,
          action: 'LARAVEL_FINAL_SUBMISSION_SKIPPED_NO_DETAILS',
          message: 'Laravel final submission skipped - invalid signingContext',
          data: {
            envelopeId,
            legacyDocumentId: legacyDocumentId,
            signingContext: finalEnvelope.signingContext,
          },
          metadata: requestMetadata,
        });

        return;
      }

      const finalEnvelopeItem = finalEnvelope.envelopeItems[0];
      if (!finalEnvelopeItem?.documentData) {
        await createLog({
          level: LogLevel.ERROR,
          action: 'LARAVEL_FINAL_SUBMISSION_SKIPPED_NO_PDF',
          message: 'Laravel final submission skipped - no PDF data available',
          data: {
            envelopeId,
            legacyDocumentId: legacyDocumentId,
            hasEnvelopeItems: finalEnvelope.envelopeItems.length > 0,
          },
          metadata: requestMetadata,
        });

        return;
      }

      let base64FinalPdf: string;

      if (finalEnvelopeItem.documentData.type === DocumentDataType.BYTES_64) {
        base64FinalPdf = finalEnvelopeItem.documentData.data;
      } else {
        const finalPdfData = await getFileServerSide({
          type: finalEnvelopeItem.documentData.type,
          data: finalEnvelopeItem.documentData.data,
        });

        base64FinalPdf = Buffer.from(finalPdfData).toString('base64');
      }

      const mainRecipient = finalEnvelope.recipients.find((r) => r.role !== RecipientRole.CC);

      if (!mainRecipient) {
        await createLog({
          level: LogLevel.ERROR,
          action: 'LARAVEL_FINAL_SUBMISSION_SKIPPED_NO_RECIPIENT',
          message: 'Laravel final submission skipped - no main recipient found',
          data: {
            envelopeId,
            legacyDocumentId: legacyDocumentId,
            totalRecipients: finalEnvelope.recipients.length,
            recipientRoles: finalEnvelope.recipients.map((r) => r.role),
          },
          metadata: requestMetadata,
        });

        return;
      }

      await createLog({
        level: LogLevel.INFO,
        action: 'LARAVEL_FINAL_SUBMISSION_START',
        message: 'Starting final document submission to Laravel',
        data: {
          envelopeId,
          legacyDocumentId: legacyDocumentId,
          recipientEmail: mainRecipient.email,
          dataType: finalEnvelopeItem.documentData.type,
        },
        metadata: requestMetadata,
      });

      const result = await storeSignedDocument(
        finalEnvelope,
        base64FinalPdf,
        documentDetails,
        legacyDocumentId,
        mainRecipient,
        true,
      );

      if (result.fileUrl) {
        await prisma.envelope.update({
          where: { id: envelopeId },
          data: {
            finalDocumentUrl: result.fileUrl,
          },
        });

        await createLog({
          level: LogLevel.INFO,
          action: 'FINAL_DOCUMENT_URL_STORED',
          message: 'Final document URL stored',
          data: {
            envelopeId,
            legacyDocumentId: documentId,
            fileUrl: result.fileUrl,
          },
        });
      }

      await createLog({
        level: LogLevel.INFO,
        action: 'LARAVEL_FINAL_SUBMISSION_SUCCESS',
        message: 'Final document submitted to Laravel',
        data: {
          envelopeId,
          legacyDocumentId: documentId,
          fileUrl: result.fileUrl,
        },
      });
    } catch (error) {
      await createLog({
        level: LogLevel.ERROR,
        action: 'LARAVEL_FINAL_SUBMISSION_ERROR',
        message: 'Error submitting final document to Laravel',
        data: {
          envelopeId,
          legacyDocumentId: documentId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      });

      console.error('Error submitting final document to Laravel:', error);
    }
  });

  await io.runTask('send-completed-email', async () => {
    let shouldSendCompletedEmail = sendEmail && !isResealing && !isRejected;

    if (isResealing && !isDocumentCompleted(envelopeStatus)) {
      shouldSendCompletedEmail = sendEmail;
    }

    if (shouldSendCompletedEmail) {
      await sendCompletedEmail({
        id: { type: 'envelopeId', id: envelopeId },
        requestMetadata,
      });
    }
  });
};

type DecorateAndSignPdfOptions = {
  envelope: Pick<Envelope, 'id' | 'title' | 'useLegacyFieldInsertion' | 'internalVersion'>;
  envelopeItem: EnvelopeItem & { documentData: DocumentData };
  envelopeItemFields: Field[];
  isRejected: boolean;
  rejectionReason: string;
  certificateData: Buffer | null;
  auditLogData: Buffer | null;
};

/**
 * Fetch, normalize, flatten and insert fields into a PDF document.
 */
const decorateAndSignPdf = async ({
  envelope,
  envelopeItem,
  envelopeItemFields,
  isRejected,
  rejectionReason,
  certificateData,
  auditLogData,
}: DecorateAndSignPdfOptions) => {
  const pdfData = await getFileServerSide(envelopeItem.documentData);

  const pdfDoc = await PDFDocument.load(pdfData);

  // Normalize and flatten layers that could cause issues with the signature
  normalizeSignatureAppearances(pdfDoc);
  await flattenForm(pdfDoc);
  flattenAnnotations(pdfDoc);

  // Add rejection stamp if the document is rejected
  if (isRejected && rejectionReason) {
    await addRejectionStampToPdf(pdfDoc, rejectionReason);
  }

  if (certificateData) {
    await createLog({
      level: LogLevel.INFO,
      action: 'ADDING_CERTIFICATE_TO_PDF',
      message: 'Adding certificate to PDF',
    });

    const certificateDoc = await PDFDocument.load(certificateData);

    const certificatePages = await pdfDoc.copyPages(
      certificateDoc,
      certificateDoc.getPageIndices(),
    );

    certificatePages.forEach((page) => {
      pdfDoc.addPage(page);
    });
  }

  if (auditLogData) {
    const auditLogDoc = await PDFDocument.load(auditLogData);

    const auditLogPages = await pdfDoc.copyPages(auditLogDoc, auditLogDoc.getPageIndices());

    auditLogPages.forEach((page) => {
      pdfDoc.addPage(page);
    });
  }

  // Handle V1 and legacy insertions.
  if (envelope.internalVersion === 1) {
    for (const field of envelopeItemFields) {
      if (field.inserted) {
        if (envelope.useLegacyFieldInsertion) {
          await legacy_insertFieldInPDF(pdfDoc, field);
        } else {
          await insertFieldInPDFV1(pdfDoc, field);
        }
      }
    }
  }

  // Handle V2 envelope insertions.
  if (envelope.internalVersion === 2) {
    const fieldsGroupedByPage = groupBy(envelopeItemFields, (field) => field.page);

    for (const [pageNumber, fields] of Object.entries(fieldsGroupedByPage)) {
      const page = pdfDoc.getPage(Number(pageNumber) - 1);
      const pageRotation = page.getRotation();

      let { width: pageWidth, height: pageHeight } = getPageSize(page);

      let pageRotationInDegrees = match(pageRotation.type)
        .with(RotationTypes.Degrees, () => pageRotation.angle)
        .with(RotationTypes.Radians, () => radiansToDegrees(pageRotation.angle))
        .exhaustive();

      // Round to the closest multiple of 90 degrees.
      pageRotationInDegrees = Math.round(pageRotationInDegrees / 90) * 90;

      // PDFs can have pages that are rotated, which are correctly rendered in the frontend.
      // However when we load the PDF in the backend, the rotation is applied.
      // To account for this, we swap the width and height for pages that are rotated by 90/270
      // degrees. This is so we can calculate the virtual position the field was placed if it
      // was correctly oriented in the frontend.
      if (pageRotationInDegrees === 90 || pageRotationInDegrees === 270) {
        [pageWidth, pageHeight] = [pageHeight, pageWidth];
      }

      // Rotate the page to the orientation that the react-pdf renders on the frontend.
      // Note: These transformations are undone at the end of the function.
      // If you change this if statement, update the if statement at the end as well
      if (pageRotationInDegrees !== 0) {
        let translateX = 0;
        let translateY = 0;

        switch (pageRotationInDegrees) {
          case 90:
            translateX = pageHeight;
            translateY = 0;
            break;
          case 180:
            translateX = pageWidth;
            translateY = pageHeight;
            break;
          case 270:
            translateX = 0;
            translateY = pageWidth;
            break;
          case 0:
          default:
            translateX = 0;
            translateY = 0;
        }

        page.pushOperators(pushGraphicsState());
        page.pushOperators(translate(translateX, translateY), rotateDegrees(pageRotationInDegrees));
      }

      const renderedPdfOverlay = await insertFieldInPDFV2({
        pageWidth,
        pageHeight,
        fields,
      });

      const [embeddedPage] = await pdfDoc.embedPdf(renderedPdfOverlay);

      // Draw the SVG on the page
      page.drawPage(embeddedPage, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
      });

      // Remove the transformations applied to the page if any were applied.
      if (pageRotationInDegrees !== 0) {
        page.pushOperators(popGraphicsState());
      }
    }
  }

  // Re-flatten the form to handle our checkbox and radio fields that
  // create native arcoFields
  await flattenForm(pdfDoc);

  const pdfBytes = await pdfDoc.save();

  await createLog({
    level: LogLevel.INFO,
    action: 'PDF_GENERATED_BEFORE_SIGN',
    message: 'PDF generated before signing',
    data: {
      size: pdfBytes.length,
    },
  });

  let pdfBuffer;

  try {
    pdfBuffer = await signPdf({ pdf: Buffer.from(pdfBytes) });

    await createLog({
      level: LogLevel.INFO,
      action: 'PDF_SIGNED_SUCCESS',
      message: 'PDF signed successfully',
      data: {
        size: pdfBuffer.length,
      },
    });
  } catch (error) {
    await createLog({
      level: LogLevel.ERROR,
      action: 'PDF_SIGN_FAILED',
      message: 'Error signing PDF',
      data: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    });

    throw error;
  }

  const { name } = path.parse(envelopeItem.title);

  // Add suffix based on document status
  const suffix = isRejected ? '_rejected.pdf' : '_signed.pdf';

  await createLog({
    level: LogLevel.INFO,
    action: 'UPLOAD_FINAL_PDF_START',
    message: 'Uploading final PDF',
    data: {
      fileName: `${name}${suffix}`,
    },
  });

  const newDocumentData = await putPdfFileServerSide({
    name: `${name}${suffix}`,
    type: 'application/pdf',
    arrayBuffer: async () => Promise.resolve(pdfBuffer),
  });

  await createLog({
    level: LogLevel.INFO,
    action: 'PDF_UPLOAD_SUCCESS',
    message: 'Final PDF uploaded successfully',
    data: {
      newDocumentDataId: newDocumentData.id,
    },
  });

  return {
    oldDocumentDataId: envelopeItem.documentData.id,
    newDocumentDataId: newDocumentData.id,
  };
};

export const getCertificateAndAuditLogData = async ({
  legacyDocumentId,
  documentMeta,
  settings,
  envelopeId,
  authOptions,
  envelopeOwner,
  recipients,
  fields,
}: {
  legacyDocumentId: number;
  documentMeta: DocumentMeta;
  settings: { includeSigningCertificate: boolean; includeAuditLog: boolean };
  envelopeId: string;
  authOptions: unknown;
  envelopeOwner: { name: string; email: string };
  recipients: Recipient[];
  fields: (Pick<Field, 'id' | 'type' | 'secondaryId' | 'recipientId'> & {
    signature?: Pick<
      Signature,
      'signatureImageAsBase64' | 'typedSignature' | 'typedSignatureSettings'
    > | null;
  })[];
}) => {
  const getCertificateDataPromise = settings.includeSigningCertificate
    ? (NEXT_PRIVATE_USE_PLAYWRIGHT_CERTIFICATE()
        ? getCertificatePdf({ documentId: legacyDocumentId, language: documentMeta.language })
        : generateCertificatePdf({
            envelopeId,
            authOptions,
            timezone: documentMeta.timezone,
            language: documentMeta.language,
            envelopeOwner,
            recipients,
            fields,
          })
      ).catch(async (error) => {
        await createLog({
          level: LogLevel.ERROR,
          action: 'CERTIFICATE_GENERATION_FAILED',
          message: 'Error generating certificate PDF',
          data: {
            legacyDocumentId,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
        });
        throw error;
      })
    : null;

  const getAuditLogDataPromise = settings.includeAuditLog
    ? getAuditLogsPdf({
        documentId: legacyDocumentId,
        language: documentMeta.language,
      }).catch((e) => {
        console.log('Failed to get audit logs PDF');
        console.error(e);

        return null;
      })
    : null;

  const [certificateData, auditLogData] = await Promise.all([
    getCertificateDataPromise,
    getAuditLogDataPromise,
  ]);

  return {
    certificateData,
    auditLogData,
  };
};
