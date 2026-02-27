import { z } from 'zod';

import { ZRecipientActionAuthSchema } from '@documenso/lib/types/document-auth';
import { ZFieldSchema } from '@documenso/lib/types/field';
import { FieldType } from '@documenso/prisma/client';
import SignatureSchema from '@documenso/prisma/generated/zod/modelSchema/SignatureSchema';

export const ZSignEnvelopeFieldValue = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(FieldType.CHECKBOX),
    value: z.array(z.number()).describe('The indices of the selected options'),
  }),
  z.object({
    type: z.literal(FieldType.RADIO),
    value: z.number().nullable().describe('The index of the selected option'),
  }),
  z.object({
    type: z.literal(FieldType.NUMBER),
    value: z.string().nullable(),
  }),
  z.object({
    type: z.literal(FieldType.EMAIL),
    value: z.string().nullable(),
  }),
  z.object({
    type: z.literal(FieldType.NAME),
    value: z.string().nullable(),
  }),
  z.object({
    type: z.literal(FieldType.INITIALS),
    value: z.string().nullable(),
    typedSignatureSettings: z
      .object({
        font: z.string().optional(),
        color: z.string().optional(),
      })
      .nullable()
      .optional(),
  }),
  z.object({
    type: z.literal(FieldType.TEXT),
    value: z.string().nullable(),
  }),
  z.object({
    type: z.literal(FieldType.DROPDOWN),
    value: z.string().nullable(),
  }),
  z.object({
    type: z.literal(FieldType.DATE),
    value: z.boolean(),
  }),
  z.object({
    type: z.literal(FieldType.CALENDAR),
    value: z.string().nullable(),
  }),
  z.object({
    type: z.literal(FieldType.SIGNATURE),
    value: z.string().nullable(),
    typedSignatureSettings: z
      .object({
        font: z.string().optional(),
        color: z.string().optional(),
      })
      .nullable()
      .optional(),
  }),
  // Resident fields - all behave like text fields
  z.object({
    type: z.literal(FieldType.RESIDENT_FIRST_NAME),
    value: z.string().nullable(),
  }),
  z.object({
    type: z.literal(FieldType.RESIDENT_LAST_NAME),
    value: z.string().nullable(),
  }),
  z.object({
    type: z.literal(FieldType.RESIDENT_DOB),
    value: z.string().nullable(),
  }),
  z.object({
    type: z.literal(FieldType.RESIDENT_GENDER_IDENTITY),
    value: z.string().nullable(),
  }),
  z.object({
    type: z.literal(FieldType.RESIDENT_LOCATION_NAME),
    value: z.string().nullable(),
  }),
  z.object({
    type: z.literal(FieldType.RESIDENT_LOCATION_STATE),
    value: z.string().nullable(),
  }),
  z.object({
    type: z.literal(FieldType.RESIDENT_LOCATION_ADDRESS),
    value: z.string().nullable(),
  }),
  z.object({
    type: z.literal(FieldType.RESIDENT_LOCATION_CITY),
    value: z.string().nullable(),
  }),
  z.object({
    type: z.literal(FieldType.RESIDENT_LOCATION_ZIP_CODE),
    value: z.string().nullable(),
  }),
  z.object({
    type: z.literal(FieldType.RESIDENT_LOCATION_COUNTRY),
    value: z.string().nullable(),
  }),
  z.object({
    type: z.literal(FieldType.RESIDENT_LOCATION_FAX),
    value: z.string().nullable(),
  }),
  z.object({
    type: z.literal(FieldType.RESIDENT_LOCATION_LICENSING),
    value: z.string().nullable(),
  }),
  z.object({
    type: z.literal(FieldType.RESIDENT_LOCATION_LICENSING_NAME),
    value: z.string().nullable(),
  }),
  z.object({
    type: z.literal(FieldType.RESIDENT_LOCATION_ADMINISTRATOR_NAME),
    value: z.string().nullable(),
  }),
  z.object({
    type: z.literal(FieldType.RESIDENT_LOCATION_ADMINISTRATOR_PHONE),
    value: z.string().nullable(),
  }),
]);

export const ZSignEnvelopeFieldRequestSchema = z.object({
  token: z.string(),
  fieldId: z.number(),
  fieldValue: ZSignEnvelopeFieldValue,
  authOptions: ZRecipientActionAuthSchema.optional(),
});

export const ZSignEnvelopeFieldResponseSchema = z.object({
  signedField: ZFieldSchema.omit({
    templateId: true,
    documentId: true,
  }).extend({
    signature: SignatureSchema.nullish(),
  }),
});

export type TSignEnvelopeFieldValue = z.infer<typeof ZSignEnvelopeFieldValue>;
export type TSignEnvelopeFieldRequest = z.infer<typeof ZSignEnvelopeFieldRequestSchema>;
export type TSignEnvelopeFieldResponse = z.infer<typeof ZSignEnvelopeFieldResponseSchema>;
