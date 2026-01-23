import fs from 'node:fs';
import path from 'node:path';

import { incrementDocumentId } from '@documenso/lib/server-only/envelope/increment-id';
import { prefixedId } from '@documenso/lib/universal/id';
import { env } from '@documenso/lib/utils/env';

import { prisma } from '..';
import { DocumentDataType, DocumentSource, EnvelopeType } from '../client';
import { seedPendingDocument } from './documents';
import { seedDirectTemplate, seedTemplate } from './templates';
import { seedUser } from './users';

const createDocumentData = async ({ documentData }: { documentData: string }) => {
  return prisma.documentData.create({
    data: {
      type: DocumentDataType.BYTES_64,
      data: documentData,
      initialData: documentData,
    },
  });
};

export const seedDatabase = async () => {
  const ADMIN_EMAIL = env('SEED_ADMIN_EMAIL');
  const ADMIN_NAME = env('SEED_ADMIN_NAME');
  const ADMIN_PASSWORD = env('SEED_ADMIN_PASSWORD');

  const examplePdf = fs
    .readFileSync(path.join(__dirname, '../../../assets/example.pdf'))
    .toString('base64');

  const exampleUserExists = await prisma.user.findFirst({
    where: {
      email: 'example@caringdata.com',
    },
  });

  const adminUserExists = await prisma.user.findFirst({
    where: {
      email: ADMIN_EMAIL,
    },
  });

  if (exampleUserExists || adminUserExists) {
    return;
  }

  // Create Admin User
  const adminUser = await seedUser({
    name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    isAdmin: true,
  });

  // Rename Admin Organisation and Team
  await prisma.organisation.update({
    where: { id: adminUser.organisation.id },
    data: { name: 'Caring Data' },
  });

  await prisma.team.update({
    where: { id: adminUser.team.id },
    data: { name: 'Caring Data' },
  });

  // Create Example User
  const exampleUser = await seedUser({
    name: 'Example User',
    email: 'example@caringdata.com',
    password: 'password',
  });

  // Rename Example Organisation and Team
  await prisma.organisation.update({
    where: { id: exampleUser.organisation.id },
    data: { name: 'Example Caring Data' },
  });

  await prisma.team.update({
    where: { id: exampleUser.team.id },
    data: { name: 'Example Caring Data' },
  });

  // Create documents for Example User (sent to Admin)
  for (let i = 1; i <= 4; i++) {
    const documentData = await createDocumentData({ documentData: examplePdf });

    const documentId = await incrementDocumentId();

    const documentMeta = await prisma.documentMeta.create({
      data: {},
    });

    await prisma.envelope.create({
      data: {
        id: prefixedId('envelope'),
        secondaryId: documentId.formattedDocumentId,
        internalVersion: 1,
        type: EnvelopeType.DOCUMENT,
        documentMetaId: documentMeta.id,
        source: DocumentSource.DOCUMENT,
        title: `Example Document ${i}`,
        envelopeItems: {
          create: {
            id: prefixedId('envelope_item'),
            title: `Example Document ${i}`,
            documentDataId: documentData.id,
            order: 1,
          },
        },
        userId: exampleUser.user.id,
        teamId: exampleUser.team.id,
        recipients: {
          create: {
            name: String(adminUser.user.name),
            email: adminUser.user.email,
            token: Math.random().toString(36).slice(2, 9),
          },
        },
      },
    });
  }

  // Create documents for Example User (sent to Admin) - Batch 2
  for (let i = 5; i <= 8; i++) {
    const documentData = await createDocumentData({ documentData: examplePdf });

    const documentId = await incrementDocumentId();

    const documentMeta = await prisma.documentMeta.create({
      data: {},
    });

    await prisma.envelope.create({
      data: {
        id: prefixedId('envelope'),
        secondaryId: documentId.formattedDocumentId,
        internalVersion: 1,
        type: EnvelopeType.DOCUMENT,
        source: DocumentSource.DOCUMENT,
        title: `Example Document ${i}`,
        documentMetaId: documentMeta.id,
        envelopeItems: {
          create: {
            id: prefixedId('envelope_item'),
            title: `Example Document ${i}`,
            documentDataId: documentData.id,
            order: 1,
          },
        },
        userId: exampleUser.user.id,
        teamId: exampleUser.team.id,
        recipients: {
          create: {
            name: String(adminUser.user.name),
            email: adminUser.user.email,
            token: Math.random().toString(36).slice(2, 9),
          },
        },
      },
    });
  }

  await seedPendingDocument(exampleUser.user, exampleUser.team.id, [adminUser.user], {
    key: 'example-pending',
    createDocumentOptions: {
      title: 'Pending Document',
    },
  });

  await seedPendingDocument(exampleUser.user, exampleUser.team.id, [adminUser.user], {
    key: 'example-pending-2',
    createDocumentOptions: {
      title: 'Pending Document 2',
    },
  });

  await Promise.all([
    seedTemplate({
      title: 'Template 1',
      userId: exampleUser.user.id,
      teamId: exampleUser.team.id,
    }),
    seedDirectTemplate({
      title: 'Direct Template 1',
      userId: exampleUser.user.id,
      teamId: exampleUser.team.id,
    }),
    seedTemplate({
      title: 'Template 2',
      userId: exampleUser.user.id,
      teamId: exampleUser.team.id,
    }),
    seedDirectTemplate({
      title: 'Direct Template 2',
      userId: exampleUser.user.id,
      teamId: exampleUser.team.id,
    }),
  ]);
};
