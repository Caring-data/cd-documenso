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
  if (!value || value === 'null' || value === '"null"' || value === '""') {
    return null;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed === 'null' || parsed === null ? null : parsed;
    } catch {
      return null;
    }
  }

  return value === 'null' ? null : value;
};

const emptyToNull = (value?: string | null) => (value && value.trim() !== '' ? value : null);

const normalizeAuthOptions = () => ({
  globalAccessAuth: [],
  globalActionAuth: [],
});

const normalizeRecipientAuthOptions = () => ({
  accessAuth: [],
  actionAuth: [],
});

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

        const normalizedSubject = emptyToNull(oldDoc.subject);
        const normalizedMessage = emptyToNull(oldDoc.message);
        const normalizedEmailSettings = normalizeJson(oldDoc.emailSettings);

        const documentMeta = await prisma.documentMeta.create({
          data: {
            ...(normalizedSubject !== null && { subject: normalizedSubject }),
            ...(normalizedMessage !== null && { message: normalizedMessage }),
            timezone: oldDoc.timezone || 'Etc/UTC',
            dateFormat: oldDoc.dateFormat || 'MM/dd/yyyy',
            signingOrder: oldDoc.signingOrder || 'SEQUENTIAL',
            typedSignatureEnabled: true,
            distributionMethod: 'EMAIL',
            ...(normalizedEmailSettings !== null && { emailSettings: normalizedEmailSettings }),
            language: 'en',
            drawSignatureEnabled: true,
            uploadSignatureEnabled: true,
            allowDictateNextSigner: false,
          },
        });

        const newEnvelopeId = mapDocumentIdToSecondaryId(oldDoc.id);
        const normalizedSigningContext = normalizeJson(oldDoc.documentDetails);

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
            internalVersion: 2,
            useLegacyFieldInsertion: false,
            authOptions: normalizeAuthOptions(),
            visibility: oldDoc.visibility ?? 'EVERYONE',
            templateType: 'PRIVATE',
            userId: 3,
            teamId: 3,
            templateId: oldDoc.templateId,
            documentMetaId: documentMeta.id,
            formKey: oldDoc.formKey,
            ownerId: oldDoc.residentId,
            ...(normalizedSigningContext !== null && { signingContext: normalizedSigningContext }),
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
            envelopeId: envelope.id,
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
              data: log.data,
              name: log.name,
              email: log.email,
              userId: 3,
              userAgent: log.userAgent,
              ipAddress: log.ipAddress,
            },
          });
        }

        const { rows: recipients } = await oldDb.query(
          `SELECT * FROM "Recipient" WHERE "documentId" = $1`,
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
              authOptions: normalizeRecipientAuthOptions(),
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
            const normalizedFieldMeta = normalizeJson(field.fieldMeta);

            const newField = await prisma.field.create({
              data: {
                type: field.type,
                page: field.page,
                positionX: field.positionX,
                positionY: field.positionY,
                width: field.width,
                height: field.height,
                customText:
                  field.customText && field.customText.trim() !== '' ? field.customText : '',
                inserted: field.inserted || false,
                ...(normalizedFieldMeta !== null && { fieldMeta: normalizedFieldMeta }),

                envelope: {
                  connect: { id: envelope.id },
                },

                envelopeItem: {
                  connect: { id: envelopeItem.id },
                },

                recipient: {
                  connect: { id: newRecipient.id },
                },
              },
            });

            fieldMap.set(field.id, newField.id);
          }

          const { rows: signatures } = await oldDb.query(
            `SELECT * FROM "Signature" WHERE "recipientId" = $1`,
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

            const normalizedTypedSignatureSettings = normalizeJson(sig.typedSignatureSettings);

            await prisma.signature.create({
              data: {
                created: sig.created,
                recipientId: newRecipient.id,
                fieldId: newFieldId,
                signatureImageAsBase64: sig.signatureImageAsBase64,
                typedSignature: sig.typedSignature,
                ...(normalizedTypedSignatureSettings !== null && {
                  typedSignatureSettings: normalizedTypedSignatureSettings,
                }),
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
