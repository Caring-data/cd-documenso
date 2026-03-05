import { RecipientRole } from '@prisma/client';
import { z } from 'zod';

import { ZRecipientActionAuthTypesSchema } from '@documenso/lib/types/document-auth';
import { ZRecipientEmailSchema } from '@documenso/lib/types/recipient';

import { ZDocumentTitleSchema } from '../document-router/schema';
import type { TrpcRouteMeta } from '../trpc';

export const updateTemplateSettingsMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/template/update-settings',
    summary: 'Update template settings',
    tags: ['Template'],
  },
};

export const ZUpdateTemplateSettingsRequestSchema = z.object({
  envelopeId: z.string(),
  title: ZDocumentTitleSchema,
  recipients: z.array(
    z.object({
      id: z.number().optional(),
      email: ZRecipientEmailSchema,
      name: z.string().min(1),
      role: z.nativeEnum(RecipientRole),
      signingOrder: z.number().optional().nullable(),
      actionAuth: z.array(ZRecipientActionAuthTypesSchema).optional(),
      contactCategoryKey: z.string().optional().nullable(),
    }),
  ),
});

export const ZUpdateTemplateSettingsResponseSchema = z.object({
  envelopeId: z.string(),
  title: z.string(),
  recipients: z.array(
    z.object({
      id: z.number(),
      email: z.string(),
      name: z.string(),
      role: z.nativeEnum(RecipientRole),
      signingOrder: z.number().nullable(),
      contactCategoryKey: z.string().optional().nullable(),
    }),
  ),
});

export type TUpdateTemplateSettingsRequest = z.infer<typeof ZUpdateTemplateSettingsRequestSchema>;
export type TUpdateTemplateSettingsResponse = z.infer<typeof ZUpdateTemplateSettingsResponseSchema>;
