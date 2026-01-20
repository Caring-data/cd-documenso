import { OrganisationType } from '@prisma/client';

import { createOrganisation } from '@documenso/lib/server-only/organisation/create-organisation';

import { adminProcedure } from '../trpc';
import {
  ZCreateAdminOrganisationRequestSchema,
  ZCreateAdminOrganisationResponseSchema,
} from './create-admin-organisation.types';

export const createAdminOrganisationRoute = adminProcedure
  .input(ZCreateAdminOrganisationRequestSchema)
  .output(ZCreateAdminOrganisationResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { ownerUserId, data } = input;

    ctx.logger.info({
      input: {
        ownerUserId,
      },
    });

    const organisation = await createOrganisation({
      userId: ownerUserId,
      name: data.name,
      type: OrganisationType.ORGANISATION,
    });

    return {
      organisationId: organisation.id,
    };
  });
