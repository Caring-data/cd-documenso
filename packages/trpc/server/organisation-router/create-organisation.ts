import { OrganisationType } from '@prisma/client';

import { createOrganisation } from '@documenso/lib/server-only/organisation/create-organisation';

import { authenticatedProcedure } from '../trpc';
import {
  ZCreateOrganisationRequestSchema,
  ZCreateOrganisationResponseSchema,
} from './create-organisation.types';

export const createOrganisationRoute = authenticatedProcedure
  // .meta(createOrganisationMeta)
  .input(ZCreateOrganisationRequestSchema)
  .output(ZCreateOrganisationResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { name } = input;
    const { user } = ctx;

    ctx.logger.info({
      input: {
        name,
      },
    });

    await createOrganisation({
      userId: user.id,
      name,
      type: OrganisationType.ORGANISATION,
    });

    return {
      paymentRequired: false,
    };
  });
