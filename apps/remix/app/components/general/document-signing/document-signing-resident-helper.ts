import { FieldType } from '@prisma/client';
import { DateTime } from 'luxon';

import type { DocumentContext } from '@documenso/lib/client-only/hooks/use-get-document-context';
import { DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';

const toStr = (value: unknown): string => (typeof value === 'string' ? value : '');

export const getResidentValue = (
  fieldType: FieldType,
  residentInfo?: DocumentContext | null,
): string => {
  if (!residentInfo) return '';

  const resident = residentInfo.resident ?? null;
  const location = residentInfo.location ?? null;

  switch (fieldType) {
    case FieldType.RESIDENT_FIRST_NAME:
      return toStr(resident?.first_name);
    case FieldType.RESIDENT_LAST_NAME:
      return toStr(resident?.last_name);
    case FieldType.RESIDENT_DOB: {
      const dob = resident?.dob;
      if (dob && typeof dob === 'string') {
        return DateTime.fromJSDate(new Date(dob)).toFormat(DEFAULT_DOCUMENT_DATE_FORMAT);
      }
      return '';
    }
    case FieldType.RESIDENT_GENDER_IDENTITY:
      return toStr(resident?.gender_identity);
    case FieldType.RESIDENT_LOCATION_NAME:
      return toStr(location?.name);
    case FieldType.RESIDENT_LOCATION_STATE:
      return toStr(location?.state?.name);
    case FieldType.RESIDENT_LOCATION_ADDRESS:
      return toStr(location?.address);
    case FieldType.RESIDENT_LOCATION_CITY:
      return toStr(location?.city);
    case FieldType.RESIDENT_LOCATION_ZIP_CODE:
      return toStr(location?.zip);
    case FieldType.RESIDENT_LOCATION_COUNTRY:
      return toStr(location?.country);
    case FieldType.RESIDENT_LOCATION_FAX:
      return toStr(location?.location_fax);
    case FieldType.RESIDENT_LOCATION_LICENSING:
      return toStr(location?.licensing);
    case FieldType.RESIDENT_LOCATION_LICENSING_NAME:
      return toStr(location?.licensing_name);
    case FieldType.RESIDENT_LOCATION_ADMINISTRATOR_NAME:
      return toStr(location?.admin);
    case FieldType.RESIDENT_LOCATION_ADMINISTRATOR_PHONE:
      return toStr(location?.phone_lic);
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
