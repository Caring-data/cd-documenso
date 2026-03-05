import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

import {
  DEFAULT_FIELD_FONT_SIZE,
  FIELD_DEFAULT_GENERIC_ALIGN,
  FIELD_DEFAULT_GENERIC_VERTICAL_ALIGN,
  FIELD_DEFAULT_LETTER_SPACING,
  FIELD_DEFAULT_LINE_HEIGHT,
  type TTextFieldMeta as TextFieldMeta,
  ZTextFieldMeta,
} from '@documenso/lib/types/field-meta';
import { Form } from '@documenso/ui/primitives/form/form';

import {
  EditorGenericFontSizeField,
  EditorGenericRequiredField,
  EditorGenericTextAlignField,
  EditorGenericVerticalAlignField,
} from '../editor/editor-field-generic-field-forms';

const ZTextFieldFormSchema = ZTextFieldMeta.pick({
  label: true,
  placeholder: true,
  text: true,
  characterLimit: true,
  fontSize: true,
  textAlign: true,
  lineHeight: true,
  letterSpacing: true,
  verticalAlign: true,
  required: true,
  readOnly: true,
}).refine(
  (data) => {
    return !data.readOnly || (data.text && data.text.length > 0);
  },
  {
    message: 'A read-only field must have text',
    path: ['text'],
  },
);

type TTextFieldFormSchema = z.infer<typeof ZTextFieldFormSchema>;

type EmbedEditorFieldResidentTextFormProps = {
  value: TextFieldMeta | undefined;
  onValueChange: (value: TextFieldMeta) => void;
};

export const EmbedEditorFieldResidentTextForm = ({
  value = {
    type: 'text',
  },
  onValueChange,
}: EmbedEditorFieldResidentTextFormProps) => {
  const form = useForm<TTextFieldFormSchema>({
    resolver: zodResolver(ZTextFieldFormSchema),
    mode: 'onChange',
    defaultValues: {
      label: value.label || '',
      placeholder: value.placeholder || '',
      text: value.text || '',
      characterLimit: value.characterLimit || 0,
      fontSize: value.fontSize || DEFAULT_FIELD_FONT_SIZE,
      textAlign: value.textAlign ?? FIELD_DEFAULT_GENERIC_ALIGN,
      lineHeight: value.lineHeight ?? FIELD_DEFAULT_LINE_HEIGHT,
      letterSpacing: value.letterSpacing ?? FIELD_DEFAULT_LETTER_SPACING,
      verticalAlign: value.verticalAlign ?? FIELD_DEFAULT_GENERIC_VERTICAL_ALIGN,
      required: value.required || false,
      readOnly: value.readOnly || false,
    },
  });

  const { control } = form;

  const formValues = useWatch({
    control,
  });

  useEffect(() => {
    const validatedFormValues = ZTextFieldFormSchema.safeParse(formValues);

    if (validatedFormValues.success) {
      onValueChange({
        type: 'text',
        ...validatedFormValues.data,
      });
    }
  }, [formValues]);

  return (
    <Form {...form}>
      <div>
        <fieldset className="flex flex-col gap-2">
          <EditorGenericFontSizeField className="w-full" formControl={form.control} />

          <div className="flex w-full flex-row gap-x-4">
            <EditorGenericTextAlignField className="w-full" formControl={form.control} />

            <EditorGenericVerticalAlignField className="w-full" formControl={form.control} />
          </div>

          <div className="mt-1">
            <EditorGenericRequiredField formControl={form.control} />
          </div>
        </fieldset>
      </div>
    </Form>
  );
};
