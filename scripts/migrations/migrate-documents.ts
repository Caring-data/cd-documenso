import { DocumentSource, DocumentStatus, EnvelopeType } from '@prisma/client';
import 'dotenv/config';
import { Client } from 'pg';

import { prefixedId } from '@documenso/lib/universal/id';
import { env } from '@documenso/lib/utils/env';
import { mapDocumentIdToSecondaryId } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';

const oldDb = new Client({
  connectionString: env('DATABASE_URL_OLD'),
});

const normalizeJson = (value: any) => {
  if (value === null) return null;
  if (value === 'null') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
};

const emptyToNull = (value?: string | null) => (value && value.trim() !== '' ? value : null);

async function migrateDocuments() {
  await oldDb.connect();

  try {
    const { rows: documents } = await oldDb.query(`
      SELECT
        d.*,
        dd.type as doc_data_type,
        dd.data as doc_data,
        dd."initialData" as doc_initial_data,
        dm.subject,
        dm.message,
        dm.timezone,
        dm.password,
        dm."dateFormat",
        dm."signingOrder",
        dm."typedSignatureEnabled",
        dm."distributionMethod",
        dm.language,
        dm."emailSettings"
      FROM "Document" d
      LEFT JOIN "DocumentData" dd ON d."documentDataId" = dd.id
      LEFT JOIN "DocumentMeta" dm ON dm."documentId" = d.id
      WHERE d."deletedAt" IS NULL
      LIMIT 1
    `);

    console.log(`Found ${documents.length} documents to migrate`);

    let successCount = 0;
    let errorCount = 0;

    for (const oldDoc of documents) {
      try {
        const documentData = await prisma.documentData.create({
          data: {
            type: oldDoc.doc_data_type || 'BYTES_64',
            data: oldDoc.doc_data || '',
            initialData: oldDoc.doc_initial_data || oldDoc.doc_data || '',
          },
        });

        const documentMeta = await prisma.documentMeta.create({
          data: {
            subject: emptyToNull(oldDoc.subject),
            message: emptyToNull(oldDoc.message),
            timezone: oldDoc.timezone,
            dateFormat: oldDoc.dateFormat,
            signingOrder: oldDoc.signingOrder,
            typedSignatureEnabled: oldDoc.typedSignatureEnabled ?? true,
            distributionMethod: oldDoc.distributionMethod,
            emailSettings: normalizeJson(oldDoc.emailSettings),
            language: oldDoc.language ?? 'en',
            drawSignatureEnabled: true,
            uploadSignatureEnabled: true,
            allowDictateNextSigner: false,
          },
        });
        console.log(`newEnvelopeId ${oldDoc.id}`);
        const newEnvelopeId = mapDocumentIdToSecondaryId(oldDoc.id);
        console.log(`newEnvelopeId ${newEnvelopeId}`);
        const envelope = await prisma.envelope.create({
          data: {
            id: prefixedId('envelope'),
            secondaryId: newEnvelopeId,
            externalId: oldDoc.externalId,
            type: EnvelopeType.DOCUMENT,
            title: oldDoc.title,
            status: oldDoc.status ?? DocumentStatus.DRAFT,
            source: oldDoc.source ?? DocumentSource.DOCUMENT,
            qrToken: prefixedId('qr'),
            internalVersion: 1,
            useLegacyFieldInsertion: false,
            authOptions: normalizeJson(oldDoc.authOptions),
            visibility: oldDoc.visibility ?? 'EVERYONE',
            templateType: 'PRIVATE',
            userId: 3,
            teamId: 3,
            templateId: oldDoc.templateId,
            documentMetaId: documentMeta.id,
            formKey: oldDoc.formKey,
            ownerId: oldDoc.residentId,
            signingContext: normalizeJson(oldDoc.documentDetails),
            finalDocumentUrl: oldDoc.documentUrl,
            createdAt: oldDoc.createdAt,
            updatedAt: oldDoc.updatedAt,
            completedAt: oldDoc.completedAt,
            deletedAt: oldDoc.deletedAt,
          },
        });

        const envelopeItem = await prisma.envelopeItem.create({
          data: {
            id: prefixedId('envelope_item'),
            title: oldDoc.title,
            documentDataId: documentData.id,
            envelopeId: oldDoc.id,
            order: 1,
          },
        });

        const { rows: auditLogs } = await oldDb.query(
          `SELECT * FROM "DocumentAuditLog" WHERE "documentId" = $1`,
          [oldDoc.id],
        );

        for (const log of auditLogs) {
          await prisma.documentAuditLog.create({
            data: {
              envelopeId: envelope.id,
              createdAt: log.createdAt,
              type: log.type,
              data: normalizeJson(log.data),
              name: log.name,
              email: log.email,
              userId: 3,
              userAgent: log.userAgent,
              ipAddress: log.ipAddress,
            },
          });
        }

        const { rows: recipients } = await oldDb.query(
          `SELECT * FROM "Recipient" WHERE "templateId" = $1`,
          [oldDoc.id],
        );

        for (const oldRecipient of recipients) {
          const newRecipient = await prisma.recipient.create({
            data: {
              email: oldRecipient.email || '',
              name: oldRecipient.name || '',
              token: oldRecipient.token,
              expired: oldRecipient.expired,
              readStatus: oldRecipient.readStatus || 'NOT_OPENED',
              signingStatus: oldRecipient.signingStatus || 'NOT_SIGNED',
              sendStatus: oldRecipient.sendStatus || 'NOT_SENT',
              signedAt: oldRecipient.signedAt,
              role: oldRecipient.role || 'SIGNER',
              authOptions: oldRecipient.authOptions,
              documentDeletedAt: oldRecipient.documentDeletedAt,
              signingOrder: oldRecipient.signingOrder,
              rejectionReason: oldRecipient.rejectionReason,
              envelopeId: envelope.id,
            },
          });

          const fieldMap = new Map<number, number>();

          const { rows: fields } = await oldDb.query(
            `SELECT * FROM "Field" WHERE "recipientId" = $1`,
            [oldRecipient.id],
          );

          for (const field of fields) {
            const newField = await prisma.field.create({
              data: {
                envelopeId: envelope.id,
                envelopeItemId: envelopeItem.id,
                recipientId: newRecipient.id,
                type: field.type,
                page: field.page,
                positionX: field.positionX,
                positionY: field.positionY,
                width: field.width,
                height: field.height,
                customText:
                  field.customText && field.customText.trim() !== '' ? field.customText : null,
                inserted: field.inserted || false,
                fieldMeta: normalizeJson(field.fieldMeta),
                secondaryId: field.secondaryId,
              },
            });

            fieldMap.set(field.id, newField.id);
          }

          const { rows: signatures } = await oldDb.query(
            `SELECT * FROM "Signature" WHERE "recipientId" = $1:`,
            [oldRecipient.id],
          );

          for (const sig of signatures) {
            const newFieldId = fieldMap.get(sig.fieldId);

            if (!newFieldId) {
              console.warn(
                `Skipping signature ${sig.id}: field ${sig.fieldId} not found for recipient ${oldRecipient.id}`,
              );
              continue;
            }

            await prisma.signature.create({
              data: {
                created: sig.created,
                recipientId: newRecipient.id,
                fieldId: newFieldId,
                signatureImageAsBase64: sig.signatureImageAsBase64,
                typedSignature: sig.typedSignature,
                typedSignatureSettings: normalizeJson(sig.typedSignatureSettings),
              },
            });
          }
        }

        successCount++;
        console.log(`✓ Migrated document ${oldDoc.id} (${successCount}/${documents.length})`);
      } catch (error) {
        errorCount++;
        console.error(`✗ Error migrating document ${oldDoc.id}:`, error);
      }
    }

    console.log('\n=== Migration Summary ===');
    console.log(`Total documents: ${documents.length}`);
    console.log(`Successfully migrated: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
  } catch (error) {
    console.error('Fatal error during migration:', error);
    throw error;
  } finally {
    await oldDb.end();
    await prisma.$disconnect();
  }
}

migrateDocuments()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
