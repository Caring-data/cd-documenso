import { FolderType } from '@prisma/client';
import 'dotenv/config';

import { createFolder } from '@documenso/lib/server-only/folder/create-folder';
import { env } from '@documenso/lib/utils/env';
import { prisma } from '@documenso/prisma';

type FolderSeedConfig = {
  name: string;
  type: 'TEMPLATE' | 'DOCUMENT';
  parentName?: string;
};

export const FOLDERS_TO_CREATE: FolderSeedConfig[] = [
  { name: 'resident-forms', type: 'TEMPLATE' },
  { name: 'staff-forms', type: 'TEMPLATE' },
  { name: 'facility-forms', type: 'TEMPLATE' },
  { name: 'facility-custom-forms', type: 'TEMPLATE' },
  { name: 'resident-custom-forms', type: 'TEMPLATE' },
  { name: 'staff-custom-forms', type: 'TEMPLATE' },

  {
    name: 'resident-standard-forms',
    type: 'DOCUMENT',
  },
  {
    name: 'resident-custom-forms',
    type: 'DOCUMENT',
  },
  {
    name: 'staff-standard-forms',
    type: 'DOCUMENT',
  },
  {
    name: 'staff-custom-forms',
    type: 'DOCUMENT',
  },
  {
    name: 'facility-standard-forms',
    type: 'DOCUMENT',
  },
  {
    name: 'facility-custom-forms',
    type: 'DOCUMENT',
  },
];

const seedFolders = async () => {
  const ADMIN_EMAIL = env('SEED_ADMIN_EMAIL');

  if (!ADMIN_EMAIL) {
    throw new Error('Missing required environment variable: SEED_ADMIN_EMAIL');
  }

  const adminUser = await prisma.user.findFirst({
    where: {
      email: ADMIN_EMAIL,
    },
  });

  if (!adminUser) {
    throw new Error(`Admin user with email ${ADMIN_EMAIL} not found. Run initial-seed first.`);
  }

  const team = await prisma.team.findFirst({
    where: {
      organisation: {
        ownerUserId: adminUser.id,
        name: 'Caring Data',
      },
    },
  });

  if (!team) {
    throw new Error('Team "Caring Data" not found for admin user. Run initial-seed first.');
  }

  const createdFolders: string[] = [];
  const skippedFolders: string[] = [];
  const errorFolders: Array<{ name: string; error: string }> = [];

  const folderMap = new Map<string, string>();

  const foldersWithoutParent = FOLDERS_TO_CREATE.filter((f) => !f.parentName);
  const foldersWithParent = FOLDERS_TO_CREATE.filter((f) => f.parentName);

  for (const folderConfig of foldersWithoutParent) {
    const folderType = folderConfig.type === 'TEMPLATE' ? FolderType.TEMPLATE : FolderType.DOCUMENT;
    const mapKey = `${folderConfig.type}-${folderConfig.name}`;

    try {
      const existingFolder = await prisma.folder.findFirst({
        where: {
          name: folderConfig.name,
          type: folderType,
          teamId: team.id,
          parentId: null,
        },
      });

      if (existingFolder) {
        console.log(
          `Folder "${folderConfig.name}" (${folderConfig.type}) already exists, skipping...`,
        );
        skippedFolders.push(`${folderConfig.name} (${folderConfig.type})`);
        folderMap.set(mapKey, existingFolder.id);
        continue;
      }

      const folder = await createFolder({
        userId: adminUser.id,
        teamId: team.id,
        name: folderConfig.name,
        type: folderType,
        parentId: null,
      });

      console.log(`Created folder "${folderConfig.name}" (${folderConfig.type})`);
      createdFolders.push(`${folderConfig.name} (${folderConfig.type})`);
      folderMap.set(mapKey, folder.id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(
        `Failed to create folder "${folderConfig.name}" (${folderConfig.type}): ${errorMessage}`,
      );
      errorFolders.push({
        name: `${folderConfig.name} (${folderConfig.type})`,
        error: errorMessage,
      });
    }
  }

  for (const folderConfig of foldersWithParent) {
    const folderType = folderConfig.type === 'TEMPLATE' ? FolderType.TEMPLATE : FolderType.DOCUMENT;
    const parentMapKey = `${folderConfig.type}-${folderConfig.parentName}`;
    const parentId = folderMap.get(parentMapKey);

    if (!parentId) {
      const errorMessage = `Parent folder "${folderConfig.parentName}" not found`;
      console.error(`Failed to create folder "${folderConfig.name}": ${errorMessage}`);
      errorFolders.push({
        name: `${folderConfig.name} (${folderConfig.type})`,
        error: errorMessage,
      });
      continue;
    }

    try {
      const existingFolder = await prisma.folder.findFirst({
        where: {
          name: folderConfig.name,
          type: folderType,
          teamId: team.id,
          parentId,
        },
      });

      if (existingFolder) {
        console.log(
          `Folder "${folderConfig.name}" (${folderConfig.type}) in "${folderConfig.parentName}" already exists, skipping...`,
        );
        skippedFolders.push(
          `${folderConfig.name} (${folderConfig.type}) in ${folderConfig.parentName}`,
        );
        continue;
      }

      await createFolder({
        userId: adminUser.id,
        teamId: team.id,
        name: folderConfig.name,
        type: folderType,
        parentId,
      });

      console.log(
        `Created folder "${folderConfig.name}" (${folderConfig.type}) in "${folderConfig.parentName}"`,
      );
      createdFolders.push(
        `${folderConfig.name} (${folderConfig.type}) in ${folderConfig.parentName}`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(
        `Failed to create folder "${folderConfig.name}" (${folderConfig.type}) in "${folderConfig.parentName}": ${errorMessage}`,
      );
      errorFolders.push({
        name: `${folderConfig.name} (${folderConfig.type}) in ${folderConfig.parentName}`,
        error: errorMessage,
      });
    }
  }

  console.log('\n=== Folders Seed Summary ===');
  console.log(`Created: ${createdFolders.length}`);
  if (createdFolders.length > 0) {
    createdFolders.forEach((name) => console.log(`  - ${name}`));
  }
  console.log(`Skipped (already exist): ${skippedFolders.length}`);
  if (skippedFolders.length > 0) {
    skippedFolders.forEach((name) => console.log(`  - ${name}`));
  }
  console.log(`Errors: ${errorFolders.length}`);
  if (errorFolders.length > 0) {
    errorFolders.forEach(({ name, error }) => console.log(`  - ${name}: ${error}`));
  }
};

seedFolders()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Folders seed failed:', error);
    process.exit(1);
  });
