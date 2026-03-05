import { LogCategory, LogLevel } from '@prisma/client';
import { Resend } from 'resend';

import { createLog } from '@documenso/lib/utils/createLog';
import { env } from '@documenso/lib/utils/env';

const RESEND_API_KEY = env('NEXT_PRIVATE_RESEND_API_KEY');

export interface EmailRecipient {
  name?: string;
  email: string;
}

const validateResendConfig = async () => {
  if (!RESEND_API_KEY) {
    await createLog({
      level: LogLevel.INFO,
      category: LogCategory.EMAIL,
      action: 'resend_config_missing',
      message: 'Resend configuration is missing',
      data: {
        hasApiKey: !!RESEND_API_KEY,
      },
    });

    throw new Error('Resend is not properly configured. Please set NEXT_PRIVATE_RESEND_API_KEY');
  }
};

export const sendEmailWithResend = async (to: EmailRecipient, subject: string, html: string) => {
  await validateResendConfig();

  const resend = new Resend(RESEND_API_KEY);

  const response = await resend.emails.send({
    from: 'notifications@ballancify.com',
    to: to.email,
    subject,
    html,
  });

  if (response.error) {
    await createLog({
      level: LogLevel.ERROR,
      category: LogCategory.EMAIL,
      action: 'resend_email_failed',
      message: 'Resend service returned an error',
      data: {
        error: response.error,
      },
    });

    throw new Error(`Resend error: ${response.error.message}`);
  }

  await createLog({
    level: LogLevel.INFO,
    category: LogCategory.EMAIL,
    action: 'resend_email_sent',
    message: 'Resend service accepted the email',
    data: {
      id: response.data.id,
    },
  });

  return { success: true };
};
