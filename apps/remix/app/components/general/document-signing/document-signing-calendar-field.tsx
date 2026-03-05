import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { Loader } from 'lucide-react';
import { DateTime } from 'luxon';
import { useRevalidator } from 'react-router';

import { DEFAULT_DOCUMENT_DATE_FORMAT } from '@documenso/lib/constants/date-formats';
import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { ZDateFieldMeta } from '@documenso/lib/types/field-meta';
import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
import { trpc } from '@documenso/trpc/react';
import type {
  TRemovedSignedFieldWithTokenMutationSchema,
  TSignFieldWithTokenMutationSchema,
} from '@documenso/trpc/server/field-router/schema';
import { cn } from '@documenso/ui/lib/utils';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { SignFieldCalendarDialog } from '~/components/dialogs/sign-field-calendar-dialog';

import { useRequiredDocumentSigningAuthContext } from './document-signing-auth-provider';
import { DocumentSigningFieldContainer } from './document-signing-field-container';
import { useDocumentSigningRecipientContext } from './document-signing-recipient-provider';

export type DocumentSigningCalendarFieldProps = {
  field: FieldWithSignature;
  dateFormat?: string | null;
  onSignField?: (value: TSignFieldWithTokenMutationSchema) => Promise<void> | void;
  onUnsignField?: (value: TRemovedSignedFieldWithTokenMutationSchema) => Promise<void> | void;
};

export const DocumentSigningCalendarField = ({
  field,
  dateFormat = DEFAULT_DOCUMENT_DATE_FORMAT,
  onSignField,
  onUnsignField,
}: DocumentSigningCalendarFieldProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { revalidate } = useRevalidator();

  const { recipient, isAssistantMode } = useDocumentSigningRecipientContext();

  const { mutateAsync: signFieldWithToken, isPending: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const {
    mutateAsync: removeSignedFieldWithToken,
    isPending: isRemoveSignedFieldWithTokenLoading,
  } = trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading;

  const safeFieldMeta = ZDateFieldMeta.safeParse(field.fieldMeta);
  const parsedFieldMeta = safeFieldMeta.success ? safeFieldMeta.data : null;

  const { executeActionAuthProcedure } = useRequiredDocumentSigningAuthContext();

  const onPreSign = async () => {
    if (field.inserted) {
      return true;
    }

    // Show calendar dialog
    const safeFieldMeta = ZDateFieldMeta.safeParse(field.fieldMeta);
    const parsedFieldMeta = safeFieldMeta.success ? safeFieldMeta.data : undefined;

    const selectedDate = await SignFieldCalendarDialog.call({
      fieldMeta: parsedFieldMeta,
    });

    if (!selectedDate) {
      return false;
    }

    // Auto-sign with selected date
    void executeActionAuthProcedure({
      onReauthFormSubmit: async (authOptions) => await onSign(authOptions, selectedDate),
      actionTarget: field.type,
    });

    return true;
  };

  const onSign = async (authOptions?: TRecipientActionAuth, dateValue?: string) => {
    try {
      // If dateValue is provided, use it; otherwise use the field's customText if inserted
      const value = dateValue || field.customText || '';

      if (!value && !isAssistantMode) {
        return;
      }

      const payload: TSignFieldWithTokenMutationSchema = {
        token: recipient.token,
        fieldId: field.id,
        value,
        isBase64: true,
        authOptions,
      };

      if (onSignField) {
        await onSignField(payload);
        return;
      }

      await signFieldWithToken(payload);

      await revalidate();
    } catch (err) {
      const error = AppError.parseError(err);

      if (error.code === AppErrorCode.UNAUTHORIZED) {
        throw error;
      }

      console.error(err);

      toast({
        title: _(msg`Error`),
        description: isAssistantMode
          ? _(msg`An error occurred while signing as assistant.`)
          : _(msg`An error occurred while signing the document.`),
        variant: 'destructive',
      });
    }
  };

  const onRemove = async () => {
    try {
      const payload: TRemovedSignedFieldWithTokenMutationSchema = {
        token: recipient.token,
        fieldId: field.id,
      };

      if (onUnsignField) {
        await onUnsignField(payload);
        return;
      }

      await removeSignedFieldWithToken(payload);

      await revalidate();
    } catch (err) {
      console.error(err);

      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while removing the field.`),
        variant: 'destructive',
      });
    }
  };

  // Format the date for display (YYYY-MM-DD or ISO) as mm/dd/yyyy
  const displayDateFormat = dateFormat ?? DEFAULT_DOCUMENT_DATE_FORMAT;

  const formatDateForDisplay = (dateString: string): string => {
    if (!dateString) {
      return '';
    }

    try {
      const dt = DateTime.fromISO(dateString);
      if (dt.isValid) {
        return dt.toFormat(displayDateFormat);
      }
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return DateTime.fromJSDate(date).toFormat(displayDateFormat);
      }
      return dateString;
    } catch {
      return dateString;
    }
  };

  return (
    <DocumentSigningFieldContainer
      field={field}
      onPreSign={onPreSign}
      onSign={onSign}
      onRemove={onRemove}
      type="Calendar"
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background">
          <Loader className="h-5 w-5 animate-spin text-primary md:h-8 md:w-8" />
        </div>
      )}

      {!field.inserted && (
        <p className="text-[clamp(0.425rem,25cqw,0.825rem)] text-foreground duration-200 group-hover:text-primary">
          <Trans>Calendar</Trans>
        </p>
      )}

      {field.inserted && (
        <div className="flex h-full w-full items-center">
          <p
            className={cn(
              'w-full whitespace-nowrap text-left text-[clamp(0.425rem,25cqw,0.825rem)] text-foreground duration-200',
              {
                '!text-center': parsedFieldMeta?.textAlign === 'center',
                '!text-right': parsedFieldMeta?.textAlign === 'right',
              },
            )}
          >
            {formatDateForDisplay(field.customText)}
          </p>
        </div>
      )}
    </DocumentSigningFieldContainer>
  );
};
