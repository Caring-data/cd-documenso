import { createElement } from 'react';

import { msg } from '@lingui/core/macro';

import { sendEmailWithNotify } from '@documenso/email/notify';
import { ForgotPasswordTemplate } from '@documenso/email/templates/forgot-password';
import { prisma } from '@documenso/prisma';

import { getI18nInstance } from '../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';

export interface SendForgotPasswordOptions {
  userId: number;
}

export const sendForgotPassword = async ({ userId }: SendForgotPasswordOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
    include: {
      passwordResetTokens: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const token = user.passwordResetTokens[0].token;
  const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:4000';
  const resetPasswordLink = `${NEXT_PUBLIC_WEBAPP_URL()}/reset-password/${token}`;

  const template = createElement(ForgotPasswordTemplate, {
    assetBaseUrl,
    resetPasswordLink,
  });

  const [html] = await Promise.all([
    renderEmailWithI18N(template),
    renderEmailWithI18N(template, { plainText: true }),
  ]);

  const i18n = await getI18nInstance();

  return await sendEmailWithNotify(
    {
      email: user.email,
      name: user.name ?? undefined,
    },
    i18n._(msg`Forgot Password?`),
    html,
  );
};
