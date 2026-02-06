import { FieldType } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TFieldCalendar } from '@documenso/lib/types/field';
import { ZDateFieldMeta } from '@documenso/lib/types/field-meta';
import type { TSignEnvelopeFieldValue } from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';

import { SignFieldCalendarDialog } from '~/components/dialogs/sign-field-calendar-dialog';

type HandleCalendarFieldClickOptions = {
  field: TFieldCalendar | { type: FieldType; inserted: boolean; fieldMeta: unknown };
  date: string | null;
};

export const handleCalendarFieldClick = async (
  options: HandleCalendarFieldClickOptions,
): Promise<TSignEnvelopeFieldValue | null> => {
  const { field, date } = options;

  if (field.type !== FieldType.CALENDAR && field.type !== FieldType.RESIDENT_DOB) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid field type',
    });
  }

  if (field.inserted) {
    return {
      type: field.type,
      value: null,
    } as TSignEnvelopeFieldValue;
  }

  let dateToInsert = date;

  if (!dateToInsert) {
    // Parse fieldMeta to ensure it's the correct type for calendar fields
    let parsedFieldMeta: ReturnType<typeof ZDateFieldMeta.safeParse>['data'] | undefined;

    if (field.fieldMeta) {
      const parseResult = ZDateFieldMeta.safeParse(field.fieldMeta);
      if (parseResult.success) {
        parsedFieldMeta = parseResult.data;
      }
    }

    dateToInsert = await SignFieldCalendarDialog.call({
      fieldMeta: parsedFieldMeta,
    });
  }

  if (!dateToInsert) {
    return null;
  }

  return {
    type: field.type,
    value: dateToInsert,
  } as TSignEnvelopeFieldValue;
};
