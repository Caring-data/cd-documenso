import { Trans } from '@lingui/react/macro';
import { XCircle } from 'lucide-react';
import { redirect } from 'react-router';

import { isTokenExpired } from '@documenso/lib/utils/token-verification';
import { prisma } from '@documenso/prisma';

import type { Route } from './+types/expired';

export async function loader({ params }: Route.LoaderArgs) {
  const token = params.token;

  if (!token) {
    return { state: 'InvalidLink' } as const;
  }

  const recipient = await prisma.recipient.findFirst({
    where: { token },
    select: { expired: true },
  });

  if (!recipient) {
    return { state: 'InvalidLink' } as const;
  }

  if (recipient.expired && isTokenExpired(recipient.expired)) {
    return { state: 'Expired' } as const;
  }

  throw redirect(`/sign/${token}/presign`);
}

export default function SignTokenExpiredPage({ loaderData }: Route.ComponentProps) {
  const data = loaderData;

  if (data.state === 'InvalidLink') {
    return (
      <div className="flex flex-col items-center pt-24 lg:pt-36 xl:pt-60">
        <div className="flex items-center gap-x-4">
          <h1 className="text-4xl font-semibold">
            <Trans>Invalid link</Trans>
          </h1>
        </div>

        <p className="mt-6 max-w-[60ch] text-center text-sm text-muted-foreground">
          <Trans>This link is invalid or has expired. Please contact the sender.</Trans>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center pt-24 lg:pt-36 xl:pt-60">
      <div className="flex items-center gap-x-4">
        <XCircle className="h-10 w-10 text-destructive" strokeWidth={2} />

        <h2 className="max-w-[35ch] text-center text-2xl font-semibold leading-normal md:text-3xl lg:text-4xl">
          <Trans>Your link has expired!</Trans>
        </h2>
      </div>

      <p className="mt-6 max-w-[60ch] text-center text-sm text-muted-foreground">
        <Trans>
          This signing link has expired. Please contact the sender to request a new link.
        </Trans>
      </p>
    </div>
  );
}
