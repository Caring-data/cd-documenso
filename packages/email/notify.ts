import { LogCategory, LogLevel } from '@prisma/client';
import { Resend } from 'resend';

import { env } from '@documenso/lib/utils/env';

import { createLog } from '../lib/utils/createLog';

const RESEND_API_KEY = env('RESEND_EMAIL_API_KEY');
const RESEND_FROM_EMAIL = env('RESEND_EMAIL_FROM');

export interface EmailRecipient {
  name?: string;
  email: string;
}

const validateNotifyConfig = async () => {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    await createLog({
      level: LogLevel.INFO,
      category: LogCategory.EMAIL,
      action: 'notify_config_missing',
      message: 'Resend configuration is missing',
      data: {
        hasApiKey: !!RESEND_API_KEY,
        hasFromEmail: !!RESEND_FROM_EMAIL,
      },
    });

    throw new Error(
      'Resend is not properly configured. Please set RESEND_EMAIL_API_KEY and RESEND_EMAIL_FROM',
    );
  }
};

export const sendEmailWithNotify = async (to: EmailRecipient, subject: string, html: string) => {
  await validateNotifyConfig();

  const resend = new Resend(RESEND_API_KEY!);

  const { data, error } = await resend.emails.send({
    from: RESEND_FROM_EMAIL!,
    to: to.name ? `${to.name} <${to.email}>` : to.email,
    subject,
    html,
  });

  if (error) {
    await createLog({
      level: LogLevel.ERROR,
      category: LogCategory.EMAIL,
      action: 'notify_email_failed',
      message: 'Resend service returned an error',
      data: {
        error,
        mailTo: to.email,
        subject,
      },
    });

    throw new Error(`Resend error: ${error.message}`);
  }

  return { success: true, id: data?.id };
};
