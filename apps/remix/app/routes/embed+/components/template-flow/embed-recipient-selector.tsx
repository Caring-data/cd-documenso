import { useCallback, useMemo } from 'react';

import type { I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import type { Recipient } from '@prisma/client';
import { RecipientRole } from '@prisma/client';
import { Check } from 'lucide-react';
import { sortBy } from 'remeda';

import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import { getRecipientColorStyles } from '@documenso/ui/lib/recipient-colors';
import { cn } from '@documenso/ui/lib/utils';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@documenso/ui/primitives/command';

interface EmbedRecipientSelectorCommandProps {
  className?: string;
  selectedRecipient: Recipient | null;
  onSelectedRecipientChange: (recipient: Recipient) => void;
  recipients: Recipient[];
  placeholder?: string;
}

export const EmbedRecipientSelectorCommand = ({
  className,
  selectedRecipient,
  onSelectedRecipientChange,
  recipients,
  placeholder,
}: EmbedRecipientSelectorCommandProps) => {
  const { t, i18n } = useLingui();

  const recipientsByRole = useCallback(() => {
    const recipientsByRole: Record<RecipientRole, Recipient[]> = {
      CC: [],
      VIEWER: [],
      SIGNER: [],
      APPROVER: [],
      ASSISTANT: [],
    };

    recipients.forEach((recipient) => {
      recipientsByRole[recipient.role].push(recipient);
    });

    return recipientsByRole;
  }, [recipients]);

  const recipientsByRoleToDisplay = useMemo(() => {
    return Object.entries(recipientsByRole())
      .filter(
        ([role]) =>
          role !== RecipientRole.CC &&
          role !== RecipientRole.VIEWER &&
          role !== RecipientRole.ASSISTANT,
      )
      .filter(([_, roleRecipients]) => roleRecipients.length > 0)
      .map(
        ([role, roleRecipients]) =>
          [
            role,
            sortBy(
              roleRecipients,
              [(r) => r.signingOrder || Number.MAX_SAFE_INTEGER, 'asc'],
              [(r) => r.id, 'asc'],
            ),
          ] as [RecipientRole, Recipient[]],
      );
  }, [recipientsByRole]);

  const getRecipientLabel = useCallback(
    (recipient: Recipient) => extractRecipientLabel(recipient, recipients, i18n),
    [recipients, i18n],
  );

  return (
    <Command
      value={selectedRecipient ? selectedRecipient.id.toString() : undefined}
      className={className}
    >
      <CommandInput placeholder={placeholder} />

      <CommandEmpty>
        <span className="inline-block px-4 text-muted-foreground">
          <Trans>No recipient matching this description was found.</Trans>
        </span>
      </CommandEmpty>

      {recipientsByRoleToDisplay.map(([role, roleRecipients], roleIndex) => (
        <CommandGroup key={roleIndex}>
          <div className="mb-1 ml-2 mt-2 text-xs font-medium text-muted-foreground">
            {t(RECIPIENT_ROLES_DESCRIPTION[role].roleNamePlural)}
          </div>

          {roleRecipients.map((recipient) => (
            <CommandItem
              key={recipient.id}
              className={cn(
                'px-2 last:mb-1 [&:not(:first-child)]:mt-1',
                getRecipientColorStyles(
                  Math.max(
                    recipients.findIndex((r) => r.id === recipient.id),
                    0,
                  ),
                ).comboxBoxItem,
              )}
              onSelect={() => {
                onSelectedRecipientChange(recipient);
              }}
            >
              <span
                className={cn('truncate text-foreground/70', {
                  'text-foreground/80': recipient.id === selectedRecipient?.id,
                })}
              >
                {getRecipientLabel(recipient)}
              </span>

              <div className="ml-auto flex items-center justify-center">
                <Check
                  aria-hidden={recipient.id !== selectedRecipient?.id}
                  className={cn('h-4 w-4 flex-shrink-0', {
                    'opacity-0': recipient.id !== selectedRecipient?.id,
                    'opacity-100': recipient.id === selectedRecipient?.id,
                  })}
                />
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      ))}
    </Command>
  );
};

const extractRecipientLabel = (recipient: Recipient, recipients: Recipient[], i18n: I18n) => {
  if (recipient.name && recipient.email) {
    return `${recipient.name} (${recipient.email})`;
  }

  if (recipient.name) {
    return recipient.name;
  }

  if (recipient.email) {
    return recipient.email;
  }

  const index = recipients.indexOf(recipient);

  return i18n._(msg`Recipient ${index + 1}`);
};
