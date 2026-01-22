import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { MailsIcon } from 'lucide-react';
import { Link, redirect, useSearchParams } from 'react-router';

import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';
import { Button } from '@documenso/ui/primitives/button';

import { GenericErrorLayout } from '~/components/general/generic-error-layout';
import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/o.$orgUrl.signin';

export function meta() {
  return appMetaTags('Sign In');
}

export function ErrorBoundary() {
  return (
    <GenericErrorLayout
      errorCode={404}
      errorCodeMap={{
        404: {
          heading: msg`Authentication Portal Not Found`,
          subHeading: msg`404 Not Found`,
          message: msg`The organisation authentication portal does not exist, or is not configured`,
        },
      }}
      primaryButton={
        <Button asChild>
          <Link to={`/`}>
            <Trans>Go back</Trans>
          </Link>
        </Button>
      }
      secondaryButton={null}
    />
  );
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { isAuthenticated, user } = await getOptionalSession(request);

  const orgUrl = params.orgUrl;

  const organisation = await prisma.organisation.findFirst({
    where: {
      url: orgUrl,
    },
    select: {
      name: true,
      organisationAuthenticationPortal: {
        select: {
          enabled: true,
        },
      },
      members: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!organisation || !organisation.organisationAuthenticationPortal.enabled) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Organisation not found',
    });
  }

  // Redirect to organisation if already signed in and a member of the organisation.
  if (isAuthenticated && user && organisation.members.find((member) => member.userId === user.id)) {
    throw redirect(`/o/${orgUrl}`);
  }

  return {
    organisationName: organisation.name,
    orgUrl,
  };
}

export default function OrganisationSignIn({ loaderData }: Route.ComponentProps) {
  const [searchParams] = useSearchParams();

  const { organisationName, orgUrl } = loaderData;

  const action = searchParams.get('action');

  if (action === 'verification-required') {
    return (
      <div className="w-screen max-w-lg px-4">
        <div className="flex items-start">
          <div className="mr-4 mt-1 hidden md:block">
            <MailsIcon className="text-primary h-10 w-10" strokeWidth={2} />
          </div>
          <div className="">
            <h2 className="text-2xl font-bold md:text-4xl">
              <Trans>Confirmation email sent</Trans>
            </h2>

            <p className="text-muted-foreground mt-4">
              <Trans>
                To gain access to your account, please confirm your email address by clicking on the
                confirmation link from your inbox.
              </Trans>
            </p>

            <div className="mt-4 flex items-center gap-x-2">
              <Button asChild>
                <Link to={`/o/${orgUrl}/signin`} replace>
                  <Trans>Return</Trans>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen max-w-lg px-4">
      <div className="border-border dark:bg-background z-10 rounded-xl border bg-neutral-100 p-6">
        <h1 className="text-2xl font-semibold">
          <Trans>Welcome to {organisationName}</Trans>
        </h1>

        <p className="text-muted-foreground mt-2 text-sm">
          <Trans>Sign in to your account</Trans>
        </p>

        <hr className="-mx-6 my-4" />

        <div className="text-muted-foreground mt-1 flex items-center justify-center text-xs">
          <Link to="/signin">
            <Trans>Return to Documenso sign in page here</Trans>
          </Link>
        </div>
      </div>
    </div>
  );
}
