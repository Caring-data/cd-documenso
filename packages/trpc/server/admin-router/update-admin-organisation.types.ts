import { z } from 'zod';

import { ZClaimFlagsSchema } from '@documenso/lib/types/subscription';
import { ZOrganisationNameSchema } from '../organisation-router/create-organisation.types';
import { ZTeamUrlSchema } from '../team-router/schema';

export const ZUpdateAdminOrganisationRequestSchema = z.object({
  organisationId: z.string(),
  data: z.object({
    name: ZOrganisationNameSchema.optional(),
    url: ZTeamUrlSchema.optional(),
    claims: z.object({
      teamCount: z.number().optional(),
      memberCount: z.number().optional(),
      envelopeItemCount: z.number().optional(),
      flags: ZClaimFlagsSchema.optional(),
    }).optional(),
    customerId: z.string().optional(),
    originalSubscriptionClaimId: z.string().optional(),
  }),
});

export const ZUpdateAdminOrganisationResponseSchema = z.void();

export type TUpdateAdminOrganisationRequest = z.infer<typeof ZUpdateAdminOrganisationRequestSchema>;
