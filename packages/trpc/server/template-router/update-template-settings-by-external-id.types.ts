import { RecipientRole } from '@prisma/client';
import { z } from 'zod';

import { ZRecipientActionAuthTypesSchema } from '@documenso/lib/types/document-auth';
import { ZRecipientEmailSchema } from '@documenso/lib/types/recipient';

import { ZDocumentTitleSchema } from '../document-router/schema';
import type { TrpcRouteMeta } from '../trpc';

export const updateTemplateSettingsByExternalIdMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/template/update-settings-by-external-id',
    summary: 'Update template settings by external ID (embed, no auth)',
    tags: ['Template'],
  },
};

export const ZUpdateTemplateSettingsByExternalIdRequestSchema = z.object({
  externalId: z.string().min(1),
  title: ZDocumentTitleSchema,
  recipients: z.array(
    z.object({
      id: z.number().optional(),
      email: ZRecipientEmailSchema,
      name: z.string().min(1),
      role: z.nativeEnum(RecipientRole),
      signingOrder: z.number().optional().nullable(),
      actionAuth: z.array(ZRecipientActionAuthTypesSchema).optional(),
    }),
  ),
});

export const ZUpdateTemplateSettingsByExternalIdResponseSchema = z.object({
  envelopeId: z.string(),
  title: z.string(),
  recipients: z.array(
    z.object({
      id: z.number(),
      email: z.string(),
      name: z.string(),
      role: z.nativeEnum(RecipientRole),
      signingOrder: z.number().nullable(),
    }),
  ),
});

export type TUpdateTemplateSettingsByExternalIdRequest = z.infer<
  typeof ZUpdateTemplateSettingsByExternalIdRequestSchema
>;
export type TUpdateTemplateSettingsByExternalIdResponse = z.infer<
  typeof ZUpdateTemplateSettingsByExternalIdResponseSchema
>;
