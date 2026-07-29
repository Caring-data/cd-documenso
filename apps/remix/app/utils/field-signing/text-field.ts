import { FieldType } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TFieldText } from '@documenso/lib/types/field';
import { ZTextFieldMeta } from '@documenso/lib/types/field-meta';
import type { TSignEnvelopeFieldValue } from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';

import { SignFieldTextDialog } from '~/components/dialogs/sign-field-text-dialog';
import { isResidentFieldType } from '~/components/general/document-signing/document-signing-resident-helper';

type TextFieldWithCurrentValue = {
  type: FieldType;
  inserted: boolean;
  fieldMeta: unknown;
  customText?: string | null;
  required?: boolean;
};

type HandleTextFieldClickOptions = {
  field: TFieldText | TextFieldWithCurrentValue;
  text: string | null;
};

export const handleTextFieldClick = async (
  options: HandleTextFieldClickOptions,
): Promise<TSignEnvelopeFieldValue | null> => {
  const { field, text } = options;

  const isValidType = field.type === FieldType.TEXT || isResidentFieldType(field.type);

  if (!isValidType) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid field type',
    });
  }

  let parsedFieldMeta: ReturnType<typeof ZTextFieldMeta.safeParse>['data'] | undefined;

  if (field.fieldMeta) {
    const parseResult = ZTextFieldMeta.safeParse(field.fieldMeta);

    if (parseResult.success) {
      parsedFieldMeta = parseResult.data;
    }
  }

  if (field.inserted || text === null) {
    const currentText = typeof field.customText === 'string' ? field.customText : '';

    const result = await SignFieldTextDialog.call({
      fieldMeta: parsedFieldMeta,
      initialText: currentText,
      isRequired: parsedFieldMeta?.required ?? false,
    });

    if (result === null) {
      return null;
    }

    return {
      type: field.type,
      value: result.value,
    } as TSignEnvelopeFieldValue;
  }

  return {
    type: field.type,
    value: text,
  } as TSignEnvelopeFieldValue;
};
