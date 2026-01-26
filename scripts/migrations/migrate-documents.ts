import { nanoid } from 'nanoid';
import { Client } from 'pg';

import { env } from '@documenso/lib/utils/env';
import { prisma } from '@documenso/prisma';

const oldDb = new Client({
  connectionString: env('DATABASE_URL_OLD'),
});

async function migrate() {
  await oldDb.connect();

  const { rows: documents } = await oldDb.query(`
    SELECT *
    FROM "Document"
    ORDER BY id
    LIMIT 1
  `);

  for (const doc of documents) {
    const envelopeId = `envelope_${nanoid(16)}`;
    const documentMetaId = nanoid();

    await prisma.documentMeta.create({
      data: {
        id: documentMetaId,
        title: doc.title,
      },
    });

    await newDb.envelope.create({
      data: {
        id: envelopeId,
        secondaryId: `document_${doc.id}`,
        externalId: doc.externalid,
        type: 'DOCUMENT',
        title: doc.title,
        status: doc.status,
        source: doc.source,
        userId: doc.userid,
        teamId: doc.teamid ?? 1,
        formKey: doc.formkey,
        finalDocumentUrl: doc.documenturl,
        internalVersion: 1,
        documentMetaId,
        createdAt: doc.createdat,
        updatedAt: doc.updatedat,
        completedAt: doc.completedat,
        deletedAt: doc.deletedat,
      },
    });

    await newDb.envelopeItem.create({
      data: {
        envelopeId,
        documentMetaId,
        type: 'DOCUMENT',
      },
    });
  }

  await oldDb.end();
}

migrate()
  .then(() => console.log('✅ Migración completada'))
  .catch(console.error)
  .finally(() => newDb.$disconnect());
