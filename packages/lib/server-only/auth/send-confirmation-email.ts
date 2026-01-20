import { createElement } from 'react';

import { msg } from '@lingui/core/macro';

import { sendEmailWithNotify } from '@documenso/email/notify';
import { ConfirmEmailTemplate } from '@documenso/email/templates/confirm-email';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { USER_SIGNUP_VERIFICATION_TOKEN_IDENTIFIER } from '../../constants/email';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';

export interface SendConfirmationEmailProps {
  userId: number;
}

export const sendConfirmationEmail = async ({ userId }: SendConfirmationEmailProps) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
    include: {
      verificationTokens: {
        where: {
          identifier: USER_SIGNUP_VERIFICATION_TOKEN_IDENTIFIER,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
  });

  const [verificationToken] = user.verificationTokens;

  if (!verificationToken?.token) {
    throw new Error('Verification token not found for the user');
  }

  const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3002';
  const confirmationLink = `${assetBaseUrl}/verify-email/${verificationToken.token}`;

  const confirmationTemplate = createElement(ConfirmEmailTemplate, {
    assetBaseUrl,
    confirmationLink,
  });

  const [html] = await Promise.all([
    renderEmailWithI18N(confirmationTemplate),
    renderEmailWithI18N(confirmationTemplate, { plainText: true }),
  ]);

  const i18n = await getI18nInstance();

  return await sendEmailWithNotify(
    {
      email: user.email,
      name: user.name ?? undefined,
    },
    i18n._(msg`Please confirm your email`),
    html,
  );
};
