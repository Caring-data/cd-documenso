import { z } from 'zod';

import { ZOrganisationNameSchema } from '../organisation-router/create-organisation.types';
import { ZTeamUrlSchema } from '../team-router/schema';

export const ZUpdateAdminOrganisationRequestSchema = z.object({
  organisationId: z.string(),
  data: z.object({
    name: ZOrganisationNameSchema.optional(),
    url: ZTeamUrlSchema.optional(),
  }),
});

export const ZUpdateAdminOrganisationResponseSchema = z.void();

export type TUpdateAdminOrganisationRequest = z.infer<typeof ZUpdateAdminOrganisationRequestSchema>;
