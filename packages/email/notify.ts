import { LogCategory, LogLevel } from '@prisma/client';
import { Resend } from 'resend';

import { env } from '@documenso/lib/utils/env';

import { createLog } from '../lib/utils/createLog';

const RESEND_API_KEY = env('RESEND_EMAIL_API_KEY');
const RESEND_FROM_EMAIL = env('RESEND_EMAIL_FROM');

const MAX_SEND_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1_000;

export interface EmailRecipient {
  name?: string;
  email: string;
}

interface EmailErrorInfo {
  name: string;
  message: string;
  statusCode: number | null;
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

  const formattedRecipient = to.name ? `${to.name} <${to.email}>` : to.email;

  const idempotencyKey = `notify-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  let lastError: EmailErrorInfo | null = null;
  let attemptsMade = 0;

  for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt += 1) {
    attemptsMade = attempt;

    try {
      const { data, error } = await resend.emails.send(
        {
          from: RESEND_FROM_EMAIL!,
          to: formattedRecipient,
          subject,
          html,
        },
        {
          idempotencyKey,
        },
      );

      if (!error) {
        if (attempt > 1) {
          await createLog({
            level: LogLevel.INFO,
            category: LogCategory.EMAIL,
            action: 'notify_email_retry_succeeded',
            message: 'Email was accepted by Resend after retry',
            data: {
              mailTo: to.email,
              subject,
              resendEmailId: data?.id ?? null,
              attempt,
            },
          });
        }

        return {
          success: true,
          id: data?.id,
        };
      }

      lastError = {
        name: error.name,
        message: error.message,
        statusCode: error.statusCode,
      };
    } catch (error) {
      lastError = {
        name: error instanceof Error ? error.name : 'UnknownError',
        message: error instanceof Error ? error.message : String(error),
        statusCode: null,
      };
    }

    const statusCode = lastError.statusCode;

    const shouldRetry =
      statusCode === null || statusCode === 429 || (statusCode !== null && statusCode >= 500);

    const hasAnotherAttempt = attempt < MAX_SEND_ATTEMPTS;

    if (!shouldRetry || !hasAnotherAttempt) {
      break;
    }

    await createLog({
      level: LogLevel.INFO,
      category: LogCategory.EMAIL,
      action: 'notify_email_retry_scheduled',
      message: 'Temporary email error detected; retry scheduled',
      data: {
        mailTo: to.email,
        subject,
        error: lastError,
        attempt,
        nextAttempt: attempt + 1,
        retryDelayMs: RETRY_DELAY_MS,
      },
    });

    await new Promise<void>((resolve) => {
      setTimeout(resolve, RETRY_DELAY_MS);
    });
  }

  if (!lastError) {
    lastError = {
      name: 'UnknownEmailError',
      message: 'Email sending failed without an identifiable error',
      statusCode: null,
    };
  }

  await createLog({
    level: LogLevel.ERROR,
    category: LogCategory.EMAIL,
    action: 'notify_email_failed',
    message:
      lastError.statusCode === null
        ? 'Unable to confirm whether Resend accepted the email after all attempts'
        : 'Resend service returned an error after all attempts',
    data: {
      error: lastError,
      mailTo: to.email,
      subject,
      attemptsMade,
      maxAttempts: MAX_SEND_ATTEMPTS,
      statusUnknown: lastError.statusCode === null,
    },
  });

  throw new Error(`Resend error: ${lastError.message}`);
};
