import { LogCategory, LogLevel } from '@prisma/client';

import { env } from '@documenso/lib/utils/env';

import { createLog } from '../lib/utils/createLog';

const NOTIFY_ENDPOINT = env('NEXT_PRIVATE_NOTIFY_ENDPOINT');
const NOTIFY_EMAIL = env('NEXT_PRIVATE_NOTIFY_EMAIL');
const NOTIFY_PASSWORD = env('NEXT_PRIVATE_NOTIFY_PASSWORD');

export interface EmailRecipient {
  name?: string;
  email: string;
}

interface EmailRequestBody {
  mailTo: string;
  subject: string;
  richContent: string;
}

const validateNotifyConfig = async () => {
  if (!NOTIFY_ENDPOINT || !NOTIFY_EMAIL || !NOTIFY_PASSWORD) {
    await createLog({
      level: LogLevel.INFO,
      category: LogCategory.EMAIL,
      action: 'notify_config_missing',
      message: 'Notify configuration is missing',
      data: {
        hasEndpoint: !!NOTIFY_ENDPOINT,
        hasEmail: !!NOTIFY_EMAIL,
        hasPassword: !!NOTIFY_PASSWORD,
      },
    });

    throw new Error(
      'Notify is not properly configured. Please set NEXT_PRIVATE_NOTIFY_ENDPOINT, NEXT_PRIVATE_NOTIFY_EMAIL and NEXT_PRIVATE_NOTIFY_PASSWORD',
    );
  }
};

export const sendEmailWithNotify = async (to: EmailRecipient, subject: string, html: string) => {
  await validateNotifyConfig();

  const url = `${NOTIFY_ENDPOINT}sendImmediateEmailNotification?login=${NOTIFY_EMAIL}&password=${NOTIFY_PASSWORD}`;

  const body: EmailRequestBody = {
    mailTo: to.email,
    subject,
    richContent: html,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();

    await createLog({
      level: LogLevel.ERROR,
      category: LogCategory.EMAIL,
      action: 'notify_email_failed',
      message: 'Notify service returned an error',
      data: {
        status: response.status,
        response: text,
        mailTo: body.mailTo,
        subject: body.subject,
      },
    });

    throw new Error(`Notify error: ${response.status} - ${text}`);
  }

  return { success: true };
};
