import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../trpc';
import {
  ZUpdateAdminOrganisationRequestSchema,
  ZUpdateAdminOrganisationResponseSchema,
} from './update-admin-organisation.types';

export const updateAdminOrganisationRoute = adminProcedure
  .input(ZUpdateAdminOrganisationRequestSchema)
  .output(ZUpdateAdminOrganisationResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId, data } = input;

    ctx.logger.info({
      input: {
        organisationId,
      },
    });

    const organisation = await prisma.organisation.findUnique({
      where: {
        id: organisationId,
      },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.NOT_FOUND);
    }

    const { name, url } = data;

    await prisma.organisation.update({
      where: {
        id: organisationId,
      },
      data: {
        name,
        url,
      },
    });
  });
