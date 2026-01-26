import { env } from '@documenso/lib/utils/env';

import { prisma } from '..';
import { seedUser } from './users';

export const seedDatabase = async () => {
  const ADMIN_EMAIL = env('SEED_ADMIN_EMAIL');
  const ADMIN_NAME = env('SEED_ADMIN_NAME');
  const ADMIN_PASSWORD = env('SEED_ADMIN_PASSWORD');

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
};
