import { Resend } from 'resend';

import { env } from '@documenso/lib/utils/env';
import { LogCategory, LogLevel } from '@documenso/prisma/client';

import { createLog } from '../lib/utils/createLog';

const RESEND_API_KEY = env('RESEND_EMAIL_API_KEY');
const RESEND_FROM_EMAIL = env('RESEND_EMAIL_FROM');

const MAX_SEND_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1_000;

export interface EmailRecipient {
  name?: string;
  email: string;
}

export interface NotifyEmailOptions {
  idempotencyKey: string;
}

interface EmailSendFailure {
  source: 'resend_sdk' | 'unexpected_exception';
  name: string;
  message: string;
  statusCode: number | null;
  stack: string | null;
}

type EmailAttemptResult =
  | {
      success: true;
      id: string | undefined;
    }
  | {
      success: false;
      failure: EmailSendFailure;
    };

const wait = async (milliseconds: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const normalizeUnexpectedError = (error: unknown): EmailSendFailure => {
  if (error instanceof Error) {
    return {
      source: 'unexpected_exception',
      name: error.name,
      message: error.message,
      statusCode: null,
      stack: error.stack ?? null,
    };
  }

  return {
    source: 'unexpected_exception',
    name: 'UnknownError',
    message: String(error),
    statusCode: null,
    stack: null,
  };
};

const isRetryableFailure = (failure: EmailSendFailure) => {
  const { statusCode, source } = failure;

  return (
    source === 'unexpected_exception' ||
    statusCode === null ||
    statusCode === 429 ||
    (statusCode !== null && statusCode >= 500)
  );
};

const validateNotifyConfig = async () => {
  if (RESEND_API_KEY && RESEND_FROM_EMAIL) {
    return;
  }

  await createLog({
    level: LogLevel.ERROR,
    category: LogCategory.EMAIL,
    action: 'notify_config_missing',
    message: 'Resend configuration is missing',
    data: {
      hasApiKey: Boolean(RESEND_API_KEY),
      hasFromEmail: Boolean(RESEND_FROM_EMAIL),
    },
  });

  throw new Error(
    'Resend is not properly configured. Please set RESEND_EMAIL_API_KEY and RESEND_EMAIL_FROM',
  );
};

export const sendEmailWithNotify = async (
  to: EmailRecipient,
  subject: string,
  html: string,
  options: NotifyEmailOptions,
) => {
  await validateNotifyConfig();

  const { idempotencyKey } = options;

  if (!idempotencyKey.trim() || idempotencyKey.length > 256) {
    throw new Error('A valid Resend idempotency key between 1 and 256 characters is required');
  }

  const resend = new Resend(RESEND_API_KEY!);

  const formattedRecipient = to.name ? `${to.name} <${to.email}>` : to.email;

  const emailPayload = {
    from: RESEND_FROM_EMAIL!,
    to: formattedRecipient,
    subject,
    html,
  };

  let lastFailure: EmailSendFailure | null = null;
  let attemptsMade = 0;

  for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt += 1) {
    attemptsMade = attempt;

    let attemptResult: EmailAttemptResult;

    try {
      const result = await resend.emails.send(emailPayload, {
        idempotencyKey,
      });

      if (result.error) {
        attemptResult = {
          success: false,
          failure: {
            source: 'resend_sdk',
            name: result.error.name,
            message: result.error.message,
            statusCode: result.error.statusCode,
            stack: null,
          },
        };
      } else {
        attemptResult = {
          success: true,
          id: result.data?.id,
        };
      }
    } catch (error) {
      attemptResult = {
        success: false,
        failure: normalizeUnexpectedError(error),
      };
    }

    if (attemptResult.success) {
      if (attempt > 1) {
        await createLog({
          level: LogLevel.INFO,
          category: LogCategory.EMAIL,
          action: 'notify_email_retry_succeeded',
          message: 'Email was accepted by Resend after retry',
          data: {
            mailTo: to.email,
            subject,
            resendEmailId: attemptResult.id ?? null,
            attempt,
            maxAttempts: MAX_SEND_ATTEMPTS,
            idempotencyKey,
          },
        });
      }

      return {
        success: true,
        id: attemptResult.id,
      };
    }

    lastFailure = attemptResult.failure;

    const retryable = isRetryableFailure(lastFailure);
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

        errorSource: lastFailure.source,
        errorName: lastFailure.name,
        errorMessage: lastFailure.message,
        errorStatusCode: lastFailure.statusCode,
        errorStack: lastFailure.stack,

        attempt,
        nextAttempt: attempt + 1,
        maxAttempts: MAX_SEND_ATTEMPTS,
        retryDelayMs: RETRY_DELAY_MS,
        idempotencyKey,
      },
    });

    await wait(RETRY_DELAY_MS);
  }

  if (!lastFailure) {
    throw new Error('Email sending failed without an identifiable error');
  }

  const statusIsUnknown = lastFailure.statusCode === null;

  await createLog({
    level: LogLevel.ERROR,
    category: LogCategory.EMAIL,
    action: statusIsUnknown ? 'notify_email_status_unknown' : 'notify_email_failed',
    message: statusIsUnknown
      ? 'Unable to confirm whether Resend accepted the email after all attempts'
      : 'Resend returned an error after all email attempts',
    data: {
      mailTo: to.email,
      subject,

      errorSource: lastFailure.source,
      errorName: lastFailure.name,
      errorMessage: lastFailure.message,
      errorStatusCode: lastFailure.statusCode,
      errorStack: lastFailure.stack,

      attemptsMade,
      maxAttempts: MAX_SEND_ATTEMPTS,
      retryable: isRetryableFailure(lastFailure),
      idempotencyKey,
    },
  });

  if (statusIsUnknown) {
    throw new Error(
      `Unable to confirm the Resend email status after ${attemptsMade} attempts: ${lastFailure.message}`,
    );
  }

  throw new Error(`Resend email failed after ${attemptsMade} attempts: ${lastFailure.message}`);
};
