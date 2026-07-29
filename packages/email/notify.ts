import { LogCategory, LogLevel } from '@prisma/client';
import { randomUUID } from 'node:crypto';
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

interface NotifyEmailError {
  name: string;
  message: string;
  statusCode: number | null;
  stack: string | null;
}

const wait = async (milliseconds: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const normalizeUnexpectedError = (error: unknown): NotifyEmailError => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      statusCode: null,
      stack: error.stack ?? null,
    };
  }

  return {
    name: 'UnknownError',
    message: String(error),
    statusCode: null,
    stack: null,
  };
};

const isRetryableError = (error: NotifyEmailError) => {
  const { statusCode } = error;

  return statusCode === null || statusCode === 429 || (statusCode !== null && statusCode >= 500);
};

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

  const idempotencyKey = `notify-email/${randomUUID()}`;

  const formattedRecipient = to.name ? `${to.name} <${to.email}>` : to.email;

  let lastError: NotifyEmailError | null = null;
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
              maxAttempts: MAX_SEND_ATTEMPTS,
              idempotencyKey,
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
        stack: null,
      };
    } catch (error) {
      lastError = normalizeUnexpectedError(error);
    }

    const retryable = isRetryableError(lastError);
    const hasAttemptsRemaining = attempt < MAX_SEND_ATTEMPTS;
    const willRetry = retryable && hasAttemptsRemaining;

    if (!willRetry) {
      break;
    }

    await createLog({
      level: LogLevel.INFO,
      category: LogCategory.EMAIL,
      action: 'notify_email_retry_scheduled',
      message: 'Transient email failure detected; retry scheduled',
      data: {
        mailTo: to.email,
        subject,

        errorName: lastError.name,
        errorMessage: lastError.message,
        errorStatusCode: lastError.statusCode,
        errorStack: lastError.stack,

        attempt,
        nextAttempt: attempt + 1,
        maxAttempts: MAX_SEND_ATTEMPTS,
        retryDelayMs: RETRY_DELAY_MS,
        idempotencyKey,
      },
    });

    await wait(RETRY_DELAY_MS);
  }

  if (!lastError) {
    lastError = {
      name: 'UnknownEmailError',
      message: 'Email sending failed without an identifiable error',
      statusCode: null,
      stack: null,
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
      mailTo: to.email,
      subject,

      errorName: lastError.name,
      errorMessage: lastError.message,
      errorStatusCode: lastError.statusCode,
      errorStack: lastError.stack,

      statusUnknown: lastError.statusCode === null,
      retryable: isRetryableError(lastError),
      attemptsMade,
      maxAttempts: MAX_SEND_ATTEMPTS,
      idempotencyKey,
    },
  });

  throw new Error(`Resend error: ${lastError.message}`);
};
