import { FieldType } from '@prisma/client';

import type { ResidentInfo } from '@documenso/lib/client-only/hooks/use-get-resident-info';

export const getResidentValue = (
  fieldType: FieldType,
  residentInfo?: ResidentInfo | null,
): string => {
  if (!residentInfo || !residentInfo.resident) {
    return '';
  }

  const { resident, location } = residentInfo;

  switch (fieldType) {
    case FieldType.RESIDENT_FIRST_NAME:
      return resident.first_name || '';
    case FieldType.RESIDENT_LAST_NAME:
      return resident.last_name || '';
    case FieldType.RESIDENT_DOB: {
      const dob = resident.dob;
      if (dob) {
        return new Date(dob).toISOString().split('T')[0];
      }
      return '';
    }
    case FieldType.RESIDENT_GENDER_IDENTITY:
      return resident.gender_identity || '';
    case FieldType.RESIDENT_LOCATION_NAME:
      return location?.name || '';
    case FieldType.RESIDENT_LOCATION_STATE:
      return location?.state || '';
    case FieldType.RESIDENT_LOCATION_ADDRESS:
      return location?.address || '';
    case FieldType.RESIDENT_LOCATION_CITY:
      return location?.city || '';
    case FieldType.RESIDENT_LOCATION_ZIP_CODE:
      return location?.zip || '';
    case FieldType.RESIDENT_LOCATION_COUNTRY:
      return location?.country || '';
    case FieldType.RESIDENT_LOCATION_FAX:
      return location?.location_fax || '';
    case FieldType.RESIDENT_LOCATION_LICENSING:
      return location?.licensing || '';
    case FieldType.RESIDENT_LOCATION_LICENSING_NAME:
      return location?.licensing_name || '';
    case FieldType.RESIDENT_LOCATION_ADMINISTRATOR_NAME:
      return location?.admin || '';
    case FieldType.RESIDENT_LOCATION_ADMINISTRATOR_PHONE:
      return location?.phone_lic || '';
    default:
      return '';
  }
};

export const isResidentFieldType = (fieldType: FieldType): boolean => {
  const residentFieldTypes = [
    FieldType.RESIDENT_FIRST_NAME,
    FieldType.RESIDENT_LAST_NAME,
    FieldType.RESIDENT_DOB,
    FieldType.RESIDENT_GENDER_IDENTITY,
    FieldType.RESIDENT_LOCATION_NAME,
    FieldType.RESIDENT_LOCATION_STATE,
    FieldType.RESIDENT_LOCATION_ADDRESS,
    FieldType.RESIDENT_LOCATION_CITY,
    FieldType.RESIDENT_LOCATION_ZIP_CODE,
    FieldType.RESIDENT_LOCATION_COUNTRY,
    FieldType.RESIDENT_LOCATION_FAX,
    FieldType.RESIDENT_LOCATION_LICENSING,
    FieldType.RESIDENT_LOCATION_LICENSING_NAME,
    FieldType.RESIDENT_LOCATION_ADMINISTRATOR_NAME,
    FieldType.RESIDENT_LOCATION_ADMINISTRATOR_PHONE,
  ] as const satisfies readonly FieldType[];
  return (residentFieldTypes as readonly FieldType[]).includes(fieldType);
};
