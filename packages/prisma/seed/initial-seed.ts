import { env } from '@documenso/lib/utils/env';

import { prisma } from '..';
import { seedUser } from './users';

export const seedDatabase = async () => {
  const ADMIN_EMAIL = env('SEED_ADMIN_EMAIL');
  const ADMIN_NAME = env('SEED_ADMIN_NAME');
  const ADMIN_PASSWORD = env('SEED_ADMIN_PASSWORD');

  if (!ADMIN_EMAIL || !ADMIN_NAME || !ADMIN_PASSWORD) {
    throw new Error(
      'Missing required environment variables: SEED_ADMIN_EMAIL, SEED_ADMIN_NAME, SEED_ADMIN_PASSWORD',
    );
  }

  const adminUserExists = await prisma.user.findFirst({
    where: {
      email: ADMIN_EMAIL,
    },
  });

  if (adminUserExists) {
    console.log('Admin user already exists, skipping...');
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

  console.log('Production seed completed successfully');
};
