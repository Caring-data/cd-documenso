import { z } from 'zod';

import { DocumentMetaSchema } from '@documenso/prisma/generated/zod/modelSchema/DocumentMetaSchema';
import { EnvelopeItemSchema } from '@documenso/prisma/generated/zod/modelSchema/EnvelopeItemSchema';
import { EnvelopeSchema } from '@documenso/prisma/generated/zod/modelSchema/EnvelopeSchema';
import { FieldSchema } from '@documenso/prisma/generated/zod/modelSchema/FieldSchema';
import { RecipientSchema } from '@documenso/prisma/generated/zod/modelSchema/RecipientSchema';
import { TeamSchema } from '@documenso/prisma/generated/zod/modelSchema/TeamSchema';
import TemplateDirectLinkSchema from '@documenso/prisma/generated/zod/modelSchema/TemplateDirectLinkSchema';

import type { TrpcRouteMeta } from '../trpc';

export const getTemplateByExternalIdMeta: TrpcRouteMeta = {
  openapi: {
    method: 'GET',
    path: '/template/external/{externalId}',
    summary: 'Get template by external ID (public embed)',
    tags: ['Template'],
  },
};

export const ZGetTemplateByExternalIdRequestSchema = z.object({
  externalId: z.string().min(1),
});

/**
 * Field schema with numeric position/size fields instead of Decimal.
 * This is needed because Prisma Decimal types don't serialize well through loaders.
 */
const ZFieldWithNumbersSchema = FieldSchema.pick({
  envelopeId: true,
  envelopeItemId: true,
  type: true,
  id: true,
  secondaryId: true,
  recipientId: true,
  page: true,
  customText: true,
  inserted: true,
  fieldMeta: true,
}).extend({
  positionX: z.number(),
  positionY: z.number(),
  width: z.number(),
  height: z.number(),
});

const ZRecipientLiteSchema = RecipientSchema.pick({
  envelopeId: true,
  role: true,
  readStatus: true,
  signingStatus: true,
  sendStatus: true,
  id: true,
  email: true,
  name: true,
  token: true,
  documentDeletedAt: true,
  expired: true,
  signedAt: true,
  authOptions: true,
  signingOrder: true,
  rejectionReason: true,
});

/**
 * Envelope schema for embed responses.
 * Uses numeric fields instead of Decimal for position/size values.
 */
const ZEmbedEnvelopeSchema = EnvelopeSchema.pick({
  internalVersion: true,
  type: true,
  status: true,
  source: true,
  visibility: true,
  templateType: true,
  id: true,
  secondaryId: true,
  externalId: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  deletedAt: true,
  title: true,
  formKey: true,
  authOptions: true,
  formValues: true,
  publicTitle: true,
  publicDescription: true,
  userId: true,
  teamId: true,
  folderId: true,
  templateId: true,
}).extend({
  documentMeta: DocumentMetaSchema.pick({
    signingOrder: true,
    distributionMethod: true,
    id: true,
    subject: true,
    message: true,
    timezone: true,
    dateFormat: true,
    redirectUrl: true,
    typedSignatureEnabled: true,
    uploadSignatureEnabled: true,
    drawSignatureEnabled: true,
    allowDictateNextSigner: true,
    language: true,
    emailSettings: true,
    emailId: true,
    emailReplyTo: true,
  }),
  recipients: ZRecipientLiteSchema.array(),
  fields: ZFieldWithNumbersSchema.array(),
  envelopeItems: EnvelopeItemSchema.pick({
    envelopeId: true,
    id: true,
    title: true,
    order: true,
  }).array(),
  directLink: TemplateDirectLinkSchema.pick({
    directTemplateRecipientId: true,
    enabled: true,
    id: true,
    token: true,
  }).nullable(),
  team: TeamSchema.pick({
    id: true,
    url: true,
  }),
  user: z.object({
    id: z.number(),
    name: z.string(),
    email: z.string(),
  }),
});

export const ZGetTemplateByExternalIdResponseSchema = z.object({
  envelopeId: z.string(),
  externalId: z.string(),
  initialEnvelope: ZEmbedEnvelopeSchema,
  teamId: z.number().nullable(),
});

export type TGetTemplateByExternalIdRequest = z.infer<typeof ZGetTemplateByExternalIdRequestSchema>;
export type TGetTemplateByExternalIdResponse = z.infer<
  typeof ZGetTemplateByExternalIdResponseSchema
>;
