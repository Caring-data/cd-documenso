import { FieldType } from '@prisma/client';
import { z } from 'zod';

import {
  ZClampedFieldHeightSchema,
  ZClampedFieldPositionXSchema,
  ZClampedFieldPositionYSchema,
  ZClampedFieldWidthSchema,
  ZEnvelopeFieldSchema,
} from '@documenso/lib/types/field';
import { ZFieldMetaSchema } from '@documenso/lib/types/field-meta';

import type { TrpcRouteMeta } from '../trpc';

export const setEnvelopeFieldsByExternalIdMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/field/set-by-external-id',
    summary: 'Set envelope fields by external ID (embed, no auth)',
    tags: ['Envelope'],
  },
};

export const ZSetEnvelopeFieldsByExternalIdRequestSchema = z.object({
  externalId: z.string().min(1),
  fields: z.array(
    z.object({
      id: z
        .number()
        .optional()
        .describe('The id of the field. If not provided, a new field will be created.'),
      formId: z.string().optional().describe('A temporary ID to keep track of new fields created'),
      envelopeItemId: z.string().describe('The id of the envelope item to put the field on'),
      recipientId: z.number(),
      type: z.nativeEnum(FieldType),
      page: z
        .number()
        .min(1)
        .describe('The page number of the field on the envelope. Starts from 1.'),
      positionX: ZClampedFieldPositionXSchema,
      positionY: ZClampedFieldPositionYSchema,
      width: ZClampedFieldWidthSchema,
      height: ZClampedFieldHeightSchema,
      fieldMeta: ZFieldMetaSchema,
    }),
  ),
});

export const ZSetEnvelopeFieldsByExternalIdResponseSchema = z.object({
  data: ZEnvelopeFieldSchema.extend({
    formId: z.string().optional(),
  }).array(),
});

export type TSetEnvelopeFieldsByExternalIdRequest = z.infer<
  typeof ZSetEnvelopeFieldsByExternalIdRequestSchema
>;
export type TSetEnvelopeFieldsByExternalIdResponse = z.infer<
  typeof ZSetEnvelopeFieldsByExternalIdResponseSchema
>;
