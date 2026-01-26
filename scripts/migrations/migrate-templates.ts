import { DocumentSource, DocumentStatus, EnvelopeType, Prisma } from '@prisma/client';
import 'dotenv/config';
import { Client } from 'pg';

import { incrementTemplateId } from '@documenso/lib/server-only/envelope/increment-id';
import { nanoid, prefixedId } from '@documenso/lib/universal/id';
import { env } from '@documenso/lib/utils/env';
import { mapTemplateIdToSecondaryId } from '@documenso/lib/utils/envelope';
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

const normalizeAuthOptions = () => ({
  globalAccessAuth: [],
  globalActionAuth: [],
});

const normalizeRecipientAuthOptions = () => ({
  accessAuth: [],
  actionAuth: [],
});

async function migrateTemplates() {
  await oldDb.connect();

  try {
    const { rows: templates } = await oldDb.query(`
      SELECT
        t.*,
        dd.type as doc_data_type,
        dd.data as doc_data,
        dd."initialData" as doc_initial_data,
        tm.subject as meta_subject,
        tm.message as meta_message,
        tm.timezone as meta_timezone,
        tm.password as meta_password,
        tm."dateFormat" as meta_date_format,
        tm."signingOrder" as meta_signing_order,
        tm."typedSignatureEnabled" as meta_typed_signature,
        tm."distributionMethod" as meta_distribution_method,
        tm."redirectUrl" as meta_redirect_url,
        tm.language as meta_language,
        tm."emailSettings" as meta_email_settings
      FROM "Template" t
      LEFT JOIN "DocumentData" dd ON t."templateDocumentDataId" = dd.id
      LEFT JOIN "TemplateMeta" tm ON tm."templateId" = t.id
      WHERE t."deletedAt" IS NULL
      ORDER BY t.id
    `);

    console.log(`Found ${templates.length} templates to migrate`);

    let successCount = 0;
    let errorCount = 0;

    for (const template of templates) {
      try {
        if (!template.teamId) {
          console.warn(`Template ${template.id} skipped: missing teamId`);
          errorCount++;
          continue;
        }

        const documentData = await prisma.documentData.create({
          data: {
            type: template.doc_data_type || 'BYTES_64',
            data: template.doc_data || '',
            initialData: template.doc_initial_data || template.doc_data || '',
          },
        });

        const normalizedEmailSettings = normalizeJson(template.meta_email_settings);

        const documentMeta = await prisma.documentMeta.create({
          data: {
            dateFormat: template.meta_date_format || 'MM/dd/yyyy',
            timezone: template.meta_timezone || 'Etc/UTC',
            signingOrder: template.meta_signing_order || 'SEQUENTIAL',
            typedSignatureEnabled: template.meta_typed_signature ?? true,
            distributionMethod: template.meta_distribution_method || 'EMAIL',
            ...(normalizedEmailSettings !== null && { emailSettings: normalizedEmailSettings }),
            language: template.meta_language || 'en',
            drawSignatureEnabled: true,
            uploadSignatureEnabled: true,
            allowDictateNextSigner: false,
          },
        });

        const newTemplateId = mapTemplateIdToSecondaryId(template.id);

        const envelope = await prisma.envelope.create({
          data: {
            id: prefixedId('envelope'),
            secondaryId: newTemplateId,
            externalId: template.externalId,
            type: EnvelopeType.TEMPLATE,
            title: template.title,
            status: DocumentStatus.DRAFT,
            source: DocumentSource.TEMPLATE,
            qrToken: prefixedId('qr'),
            internalVersion: 2,
            useLegacyFieldInsertion: false,
            authOptions: normalizeAuthOptions(),
            visibility: template.visibility || 'EVERYONE',
            templateType: template.type || 'PRIVATE',
            userId: 3,
            teamId: 3,
            documentMetaId: documentMeta.id,
            formKey: template.formKey,
            createdAt: template.createdAt,
            updatedAt: template.updatedAt,
            deletedAt: template.deletedAt,
          },
        });

        const envelopeItem = await prisma.envelopeItem.create({
          data: {
            id: prefixedId('envelope_item'),
            title: template.title,
            documentDataId: documentData.id,
            envelopeId: envelope.id,
            order: 1,
          },
        });

        const { rows: recipients } = await oldDb.query(
          `SELECT * FROM "Recipient" WHERE "templateId" = $1`,
          [template.id],
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

          const { rows: fields } = await oldDb.query(
            `SELECT * FROM "Field" WHERE "recipientId" = $1`,
            [oldRecipient.id],
          );

          for (const field of fields) {
            const normalizedFieldMeta = normalizeJson(field.fieldMeta);

            await prisma.field.create({
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
                secondaryId: field.secondaryId,

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
          }
        }

        successCount++;
        console.log(`✓ Migrated template ${template.id} (${successCount}/${templates.length})`);
      } catch (error) {
        errorCount++;
        console.error(`✗ Error migrating template ${template.id}:`, error);
      }
    }

    console.log('\n=== Migration Summary ===');
    console.log(`Total templates: ${templates.length}`);
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

migrateTemplates()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
