import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { Eraser } from 'lucide-react';
import { createCallable } from 'react-call';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { TTextFieldMeta } from '@documenso/lib/types/field-meta';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Textarea } from '@documenso/ui/primitives/textarea';

const ZSignFieldTextFormSchema = z.object({
  text: z.string(),
});

type TSignFieldTextFormSchema = z.infer<typeof ZSignFieldTextFormSchema>;

export type SignFieldTextDialogProps = {
  fieldMeta?: TTextFieldMeta;
  initialText?: string;
  isRequired?: boolean;
};

export type TSignFieldTextDialogResult = {
  action: 'save';
  value: string | null;
};

export const SignFieldTextDialog = createCallable<
  SignFieldTextDialogProps,
  TSignFieldTextDialogResult | null
>(({ call, fieldMeta, initialText = '', isRequired = false }) => {
  const { t } = useLingui();

  const form = useForm<TSignFieldTextFormSchema>({
    resolver: zodResolver(ZSignFieldTextFormSchema),
    mode: 'onChange',
    defaultValues: {
      text: initialText,
    },
  });

  useEffect(() => {
    form.reset({
      text: initialText,
    });
  }, [initialText, form]);

  const textValue = form.watch('text');
  const characterLimit = fieldMeta?.characterLimit ?? 0;

  const normalizedText = textValue.trim();

  const isOverLimit = characterLimit > 0 && textValue.length > characterLimit;

  const isDisabled = form.formState.isSubmitting || isOverLimit;

  const handleClear = () => {
    form.setValue('text', '', {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });

    form.clearErrors('text');
  };

  const handleSubmit = (data: TSignFieldTextFormSchema) => {
    const value = data.text.trim();

    if (isRequired && value.length === 0) {
      form.setError('text', {
        type: 'required',
        message: msg`Text is required`.id,
      });

      return;
    }

    call.end({
      action: 'save',
      value: value.length > 0 ? data.text : null,
    });
  };

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) {
          call.end(null);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Enter Text info</Trans>
          </DialogTitle>

          <DialogDescription className="mt-4">
            <Trans>Insert a value into the text field</Trans>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <fieldset
              className="flex h-full flex-col space-y-4"
              disabled={form.formState.isSubmitting}
            >
              <FormField
                control={form.control}
                name="text"
                render={({ field, fieldState }) => (
                  <FormItem>
                    {fieldMeta?.label && (
                      <FormLabel>
                        {fieldMeta.label}

                        {isRequired && <span className="ml-1 text-destructive">*</span>}
                      </FormLabel>
                    )}

                    <FormControl>
                      <Textarea
                        id="custom-text"
                        placeholder={fieldMeta?.placeholder ?? t`Enter your text here`}
                        className={cn('w-full rounded-md', {
                          'border-2 border-red-300 text-left ring-2 ring-red-200 ring-offset-2 ring-offset-red-200 focus-visible:border-red-400 focus-visible:ring-4 focus-visible:ring-red-200 focus-visible:ring-offset-2 focus-visible:ring-offset-red-200':
                            fieldState.error,
                        })}
                        {...field}
                        onChange={(event) => {
                          field.onChange(event);

                          if (fieldState.error) {
                            form.clearErrors('text');
                          }
                        }}
                      />
                    </FormControl>

                    <FormMessage />

                    {characterLimit > 0 && !fieldState.error && (
                      <div className="text-sm text-muted-foreground">
                        <Plural
                          value={characterLimit - (field.value?.length ?? 0)}
                          one="# character remaining"
                          other="# characters remaining"
                        />
                      </div>
                    )}
                  </FormItem>
                )}
              />

              <DialogFooter className="sm:justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-muted-foreground"
                  disabled={normalizedText.length === 0}
                  onClick={handleClear}
                >
                  <Eraser className="mr-2 h-4 w-4" />

                  <Trans>Clear</Trans>
                </Button>

                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => call.end(null)}>
                    <Trans>Cancel</Trans>
                  </Button>

                  <Button type="submit" disabled={isDisabled}>
                    <Trans>Save</Trans>
                  </Button>
                </div>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
});
