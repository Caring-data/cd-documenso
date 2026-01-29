import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { FieldType } from '@prisma/client';
import { z } from 'zod';

import { ZFieldMetaSchema } from '@documenso/lib/types/field-meta';

export const ZDocumentFlowFormSchema = z.object({
  title: z.string().min(1),

  signers: z.array(
    z.object({
      formId: z.string().min(1),
      nativeId: z.number().optional(),
      email: z.string().min(1).email(),
      name: z.string(),
    }),
  ),

  fields: z.array(
    z.object({
      formId: z.string().min(1),
      nativeId: z.number().optional(),
      type: z.nativeEnum(FieldType),
      signerEmail: z.string().min(1).optional(),
      recipientId: z.number().min(1),
      pageNumber: z.number().min(1),
      pageX: z.number().min(0),
      pageY: z.number().min(0),
      pageWidth: z.number().min(0),
      pageHeight: z.number().min(0),
      fieldMeta: ZFieldMetaSchema,
    }),
  ),

  email: z.object({
    subject: z.string(),
    message: z.string(),
  }),
});

export type TDocumentFlowFormSchema = z.infer<typeof ZDocumentFlowFormSchema>;

export const FRIENDLY_FIELD_TYPE: Record<FieldType, MessageDescriptor> = {
  [FieldType.SIGNATURE]: msg`Signature`,
  [FieldType.FREE_SIGNATURE]: msg`Free Signature`,
  [FieldType.INITIALS]: msg`Initials`,
  [FieldType.TEXT]: msg`Text`,
  [FieldType.DATE]: msg`Date`,
  [FieldType.CALENDAR]: msg`Calendar`,
  [FieldType.EMAIL]: msg`Email`,
  [FieldType.NAME]: msg`Name`,
  [FieldType.NUMBER]: msg`Number`,
  [FieldType.RADIO]: msg`Radio`,
  [FieldType.CHECKBOX]: msg`Checkbox`,
  [FieldType.DROPDOWN]: msg`Select`,
  [FieldType.RESIDENT_FIRST_NAME]: msg`Resident First Name`,
  [FieldType.RESIDENT_LAST_NAME]: msg`Resident Last Name`,
  [FieldType.RESIDENT_DOB]: msg`Date of Birth`,
  [FieldType.RESIDENT_GENDER_IDENTITY]: msg`Gender Identity`,
  [FieldType.RESIDENT_LOCATION_NAME]: msg`Location Name`,
  [FieldType.RESIDENT_LOCATION_STATE]: msg`Location State`,
  [FieldType.RESIDENT_LOCATION_ADDRESS]: msg`Location Address`,
  [FieldType.RESIDENT_LOCATION_CITY]: msg`Location City`,
  [FieldType.RESIDENT_LOCATION_ZIP_CODE]: msg`Location Zip Code`,
  [FieldType.RESIDENT_LOCATION_COUNTRY]: msg`Location Country`,
  [FieldType.RESIDENT_LOCATION_FAX]: msg`Location Fax`,
  [FieldType.RESIDENT_LOCATION_LICENSING]: msg`Licensing`,
  [FieldType.RESIDENT_LOCATION_LICENSING_NAME]: msg`Licensing Name`,
  [FieldType.RESIDENT_LOCATION_ADMINISTRATOR_NAME]: msg`Admin Name`,
  [FieldType.RESIDENT_LOCATION_ADMINISTRATOR_PHONE]: msg`Admin Phone`,
};

export interface DocumentFlowStep {
  title: MessageDescriptor;
  description: MessageDescriptor;
  stepIndex?: number;
  onBackStep?: () => unknown;
  onNextStep?: () => unknown;
}
