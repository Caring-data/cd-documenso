import type { HTMLAttributes } from 'react';

import { Trans } from '@lingui/react/macro';

import { cn } from '@documenso/ui/lib/utils';

export type DocumentSigningDisclosureProps = HTMLAttributes<HTMLParagraphElement>;

export const DocumentSigningDisclosure = ({
  className,
  ...props
}: DocumentSigningDisclosureProps) => {
  return (
    <p className={cn('text-xs text-muted-foreground dark:text-zinc-300', className)} {...props}>
      <Trans>
        By clicking the <strong>"I ACCEPT"</strong> button, you agree to review the documents and
        provide your electronic signature. You acknowledge that your electronic signature will have
        the same legal validity and effect as a handwritten signature, ensuring the document is
        complete and legally binding.{' '}
      </Trans>
    </p>
  );
};
