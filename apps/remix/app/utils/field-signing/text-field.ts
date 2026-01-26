import { FieldType } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TFieldText } from '@documenso/lib/types/field';
import { ZTextFieldMeta } from '@documenso/lib/types/field-meta';
import type { TSignEnvelopeFieldValue } from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';

import { SignFieldTextDialog } from '~/components/dialogs/sign-field-text-dialog';
import { isResidentFieldType } from '~/components/general/document-signing/document-signing-resident-helper';

type HandleTextFieldClickOptions = {
  field: TFieldText | { type: FieldType; inserted: boolean; fieldMeta: unknown };
  text: string | null;
};

export const handleTextFieldClick = async (
  options: HandleTextFieldClickOptions,
): Promise<TSignEnvelopeFieldValue | null> => {
  const { field, text } = options;

  // Accept TEXT and all resident field types
  const isValidType = field.type === FieldType.TEXT || isResidentFieldType(field.type);

  if (!isValidType) {
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

  let textToInsert = text;

  if (!textToInsert) {
    // Parse fieldMeta to ensure it's the correct type for text fields
    let parsedFieldMeta: ReturnType<typeof ZTextFieldMeta.safeParse>['data'] | undefined;
    
    if (field.fieldMeta) {
      const parseResult = ZTextFieldMeta.safeParse(field.fieldMeta);
      if (parseResult.success) {
        parsedFieldMeta = parseResult.data;
      }
    }

    textToInsert = await SignFieldTextDialog.call({
      fieldMeta: parsedFieldMeta,
    });
  }

  if (!textToInsert) {
    return null;
  }

  return {
    type: field.type,
    value: textToInsert,
  } as TSignEnvelopeFieldValue;
};
