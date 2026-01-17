import { z } from 'zod';

import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';
import OrganisationSchema from '@documenso/prisma/generated/zod/modelSchema/OrganisationSchema';
import UserSchema from '@documenso/prisma/generated/zod/modelSchema/UserSchema';

export const ZFindAdminOrganisationsRequestSchema = ZFindSearchParamsSchema.extend({
  ownerUserId: z.number().optional(),
  memberUserId: z.number().optional(),
});

export const ZFindAdminOrganisationsResponseSchema = ZFindResultResponse.extend({
  data: OrganisationSchema.pick({
    id: true,
    createdAt: true,
    updatedAt: true,
    name: true,
    url: true,
  })
    .extend({
      owner: UserSchema.pick({
        id: true,
        email: true,
        name: true,
      }),
    })
    .array(),
});

export type TFindAdminOrganisationsResponse = z.infer<typeof ZFindAdminOrganisationsResponseSchema>;
