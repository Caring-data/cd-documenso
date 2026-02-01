import { useRef } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import { RecipientRole } from '@prisma/client';
import { Plus, Trash } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';

import { useGetContactCategories } from '@documenso/lib/client-only/hooks/use-get-contact-categories';
import type { TEnvelope } from '@documenso/lib/types/envelope';
import { ZRecipientEmailSchema } from '@documenso/lib/types/recipient';
import { generateRecipientPlaceholder } from '@documenso/lib/utils/templates';
import { RecipientRoleSelect } from '@documenso/ui/components/recipient/recipient-role-select';
import { Button } from '@documenso/ui/primitives/button';
import {
  DocumentFlowFormContainerActions,
  DocumentFlowFormContainerContent,
  DocumentFlowFormContainerFooter,
  DocumentFlowFormContainerHeader,
  DocumentFlowFormContainerStep,
} from '@documenso/ui/primitives/document-flow/document-flow-root';
import type { DocumentFlowStep } from '@documenso/ui/primitives/document-flow/types';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { Separator } from '@documenso/ui/primitives/separator';
import { useStep } from '@documenso/ui/primitives/stepper';

const ZAddTemplateSettingsFormSchema = z.object({
  title: z.string().min(1, { message: 'Title is required' }),
  recipients: z.array(
    z.object({
      id: z.number().optional(),
      formId: z.string().min(1),
      name: z.string().min(1, { message: 'Name is required' }),
      contactCategoryKey: z.string().optional(),
      email: ZRecipientEmailSchema,
      role: z.nativeEnum(RecipientRole),
      signingOrder: z.number().optional(),
    }),
  ),
});

type TAddTemplateSettingsFormSchema = z.infer<typeof ZAddTemplateSettingsFormSchema>;

export type AddTemplateSettingsFormProps = {
  flowStep: DocumentFlowStep;
  envelope: TEnvelope;
  onSubmit: (data: {
    title: string;
    recipients: TAddTemplateSettingsFormSchema['recipients'];
  }) => void | Promise<void>;
};

export const AddTemplateSettingsFormPartial = ({
  flowStep,
  envelope,
  onSubmit,
}: AddTemplateSettingsFormProps) => {
  const { t } = useLingui();

  const { data: categories } = useGetContactCategories();

  const generateDefaultRecipients = () => {
    if (envelope.recipients.length === 0) {
      const placeholder = generateRecipientPlaceholder(1);
      return [
        {
          formId: 'recipient-new-1',
          name: 'Recipient 1',
          email: placeholder.email,
          contactCategoryKey: undefined,
          role: RecipientRole.SIGNER,
          signingOrder: 1,
        },
      ];
    }

    return envelope.recipients.map((recipient, index) => {
      // Ensure email is valid, use placeholder if not
      const email =
        recipient.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.email.trim().toLowerCase())
          ? recipient.email.trim().toLowerCase()
          : generateRecipientPlaceholder(index + 1).email;

      return {
        id: recipient.id,
        formId: `recipient-${recipient.id ?? index}`,
        name: recipient.name || `Recipient ${index + 1}`,
        email,
        role: recipient.role,
        signingOrder: recipient.signingOrder ?? index + 1,
      };
    });
  };

  const defaultValues = {
    title: envelope.title,
    recipients: generateDefaultRecipients(),
  };

  const form = useForm<TAddTemplateSettingsFormSchema>({
    resolver: zodResolver(ZAddTemplateSettingsFormSchema),
    defaultValues,
  });

  const initialValuesRef = useRef<TAddTemplateSettingsFormSchema>(defaultValues);
  const hadNoRecipientsInitiallyRef = useRef<boolean>(envelope.recipients.length === 0);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'recipients',
  });

  const { stepIndex, currentStep, totalSteps, previousStep, nextStep } = useStep();

  const handleAddRecipient = () => {
    const nextIndex = fields.length + 1;
    const placeholder = generateRecipientPlaceholder(nextIndex);
    append({
      formId: `recipient-new-${nextIndex}`,
      name: `Recipient ${nextIndex}`,
      email: placeholder.email,
      role: RecipientRole.SIGNER,
      signingOrder: nextIndex,
    });
  };

  const normalizeRecipientForComparison = (
    recipient: TAddTemplateSettingsFormSchema['recipients'][0],
  ) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const email =
      recipient.email && emailRegex.test(recipient.email.trim().toLowerCase())
        ? recipient.email.trim().toLowerCase()
        : recipient.email?.trim().toLowerCase() || '';

    return {
      name: recipient.name.trim(),
      email,
      role: recipient.role,
      signingOrder: recipient.signingOrder ?? 0,
      contactCategoryKey: recipient.contactCategoryKey ?? null,
    };
  };

  const hasValuesChanged = (
    current: TAddTemplateSettingsFormSchema,
    initial: TAddTemplateSettingsFormSchema,
  ): boolean => {
    // Check if title changed
    if (current.title.trim() !== initial.title.trim()) {
      return true;
    }

    // Check if recipients count changed
    if (current.recipients.length !== initial.recipients.length) {
      return true;
    }

    // Check if any recipient properties changed (normalize for comparison)
    for (let i = 0; i < current.recipients.length; i++) {
      const currentRecipient = normalizeRecipientForComparison(current.recipients[i]);
      const initialRecipient = normalizeRecipientForComparison(initial.recipients[i]);

      if (
        currentRecipient.name !== initialRecipient.name ||
        currentRecipient.email !== initialRecipient.email ||
        currentRecipient.role !== initialRecipient.role ||
        currentRecipient.signingOrder !== initialRecipient.signingOrder ||
        currentRecipient.contactCategoryKey !== initialRecipient.contactCategoryKey
      ) {
        return true;
      }
    }

    return false;
  };

  const handleSubmit = async (data: TAddTemplateSettingsFormSchema) => {
    const shouldSave =
      hadNoRecipientsInitiallyRef.current || hasValuesChanged(data, initialValuesRef.current);

    if (!shouldSave) {
      nextStep();
      return;
    }

    // Validate all recipients have valid emails before submitting
    const validRecipients = data.recipients.filter((recipient) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return recipient.email && emailRegex.test(recipient.email.trim().toLowerCase());
    });

    if (validRecipients.length === 0) {
      // If no valid recipients, generate a placeholder for the first one
      const placeholder = generateRecipientPlaceholder(1);
      validRecipients.push({
        formId: 'recipient-new-1',
        name: 'Recipient 1',
        email: placeholder.email,
        role: RecipientRole.SIGNER,
        signingOrder: 1,
      });
    }

    // Ensure all recipients have valid emails, fix invalid ones
    const fixedRecipients = validRecipients.map((recipient, index) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const email =
        recipient.email && emailRegex.test(recipient.email.trim().toLowerCase())
          ? recipient.email.trim().toLowerCase()
          : generateRecipientPlaceholder(index + 1).email;

      return {
        ...recipient,
        email,
        contactCategoryKey: recipient.contactCategoryKey,
      };
    });

    await onSubmit({ title: data.title, recipients: fixedRecipients });
  };

  return (
    <div className="flex h-full flex-col">
      <DocumentFlowFormContainerHeader title={flowStep.title} description={flowStep.description} />

      <DocumentFlowFormContainerContent>
        <Form {...form}>
          <fieldset disabled={form.formState.isSubmitting} className="space-y-3">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans>Template Title</Trans>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder={t`Enter template title`} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <h3 className="text-xl font-semibold text-foreground">
              <Trans>Add Participants</Trans>
            </h3>

            <p className="mt-2 text-sm text-muted-foreground">
              <Trans>
                Set the number of recipients you'll later assign fields and signatures to.
              </Trans>
            </p>

            {fields.map((field, index) => {
              return (
                <div key={field.id} className="flex items-center gap-2">
                  <FormField
                    control={form.control}
                    name={`recipients.${index}.contactCategoryKey`}
                    render={({ field: selectField }) => {
                      const categoryName = categories?.find(
                        (c) => c.key === selectField.value,
                      )?.name;

                      return (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Select
                              value={selectField.value || ''}
                              onValueChange={(value) => {
                                selectField.onChange(value === '' ? undefined : value);
                              }}
                            >
                              <SelectTrigger className="truncate bg-white">
                                <SelectValue placeholder={`Recipient ${index + 1} - Select`}>
                                  {selectField.value && categoryName
                                    ? `Recipient ${index + 1} - ${categoryName}`
                                    : undefined}
                                </SelectValue>
                              </SelectTrigger>

                              <SelectContent>
                                <SelectGroup>
                                  <SelectLabel>
                                    <Trans>Category</Trans>
                                  </SelectLabel>

                                  {categories?.map((category) => (
                                    <SelectItem key={category.key} value={category.key}>
                                      {category.name}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />

                  <FormField
                    control={form.control}
                    name={`recipients.${index}.role`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <RecipientRoleSelect
                            value={field.value}
                            onValueChange={field.onChange}
                            showAdvancedRoles={false}
                            hideAssistant
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                      className="h-10 w-10 p-0"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}

            <Button type="button" variant="outline" onClick={handleAddRecipient} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              <Trans>Add Recipient</Trans>
            </Button>
          </fieldset>
        </Form>
      </DocumentFlowFormContainerContent>

      <DocumentFlowFormContainerFooter>
        <DocumentFlowFormContainerStep step={currentStep} maxStep={totalSteps} />

        <DocumentFlowFormContainerActions
          loading={form.formState.isSubmitting}
          disabled={form.formState.isSubmitting}
          canGoBack={stepIndex !== 0}
          onGoBackClick={previousStep}
          onGoNextClick={form.handleSubmit(handleSubmit)}
        />
      </DocumentFlowFormContainerFooter>
    </div>
  );
};
