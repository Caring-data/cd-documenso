import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { createCallable } from 'react-call';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { TDateFieldMeta } from '@documenso/lib/types/field-meta';
import { Button } from '@documenso/ui/primitives/button';
import { Calendar } from '@documenso/ui/primitives/calendar';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';

const ZSignFieldCalendarFormSchema = z.object({
  date: z.date({
    required_error: msg`Date is required`.id,
  }),
});

type TSignFieldCalendarFormSchema = z.infer<typeof ZSignFieldCalendarFormSchema>;

export type SignFieldCalendarDialogProps = {
  fieldMeta?: TDateFieldMeta;
};

export const SignFieldCalendarDialog = createCallable<SignFieldCalendarDialogProps, string | null>(
  ({ call, fieldMeta }) => {

    const form = useForm<TSignFieldCalendarFormSchema>({
      resolver: zodResolver(ZSignFieldCalendarFormSchema),
      defaultValues: {
        date: undefined,
      },
    });

    const selectedDate = form.watch('date');

    return (
      <Dialog open={true} onOpenChange={(value) => (!value ? call.end(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <Trans>Select Date</Trans>
            </DialogTitle>

            <DialogDescription className="mt-4">
              <Trans>Choose a date for this field</Trans>
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) => {
                const formattedDate = data.date.toISOString().split('T')[0];
                call.end(formattedDate);
              })}
            >
              <fieldset
                className="flex h-full flex-col space-y-4"
                disabled={form.formState.isSubmitting}
              >
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      {fieldMeta?.label && <FormLabel>{fieldMeta?.label}</FormLabel>}

                      <div className="flex justify-center">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          captionLayout="dropdown"
                          initialFocus
                        />
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={() => call.end(null)}>
                    <Trans>Cancel</Trans>
                  </Button>

                  <Button type="submit" disabled={!selectedDate}>
                    <Trans>Sign</Trans>
                  </Button>
                </DialogFooter>
              </fieldset>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    );
  },
);
