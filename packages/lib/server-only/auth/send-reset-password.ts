import { createElement } from 'react';

import { sendEmailWithNotify } from '@documenso/email/notify';
import { ResetPasswordTemplate } from '@documenso/email/templates/reset-password';
import { prisma } from '@documenso/prisma';

import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';

export interface SendResetPasswordOptions {
  userId: number;
}

export const sendResetPassword = async ({ userId }: SendResetPasswordOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
  });

  const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3002';

  const template = createElement(ResetPasswordTemplate, {
    assetBaseUrl,
    userEmail: user.email,
    userName: user.name || '',
  });

  const [html] = await Promise.all([
    renderEmailWithI18N(template),
    renderEmailWithI18N(template, { plainText: true }),
  ]);

  return await sendEmailWithNotify(
    {
      email: user.email,
      name: user.name ?? undefined,
    },
    'Password Reset Success!',
    html,
  );
};
