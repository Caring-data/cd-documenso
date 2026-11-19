import { LogCategory, LogLevel } from '@prisma/client';
import { Resend } from 'resend';

import { env } from '@documenso/lib/utils/env';

import { createLog } from '../lib/utils/createLog';

const RESEND_API_KEY = env('RESEND_EMAIL_API_KEY');
const RESEND_FROM_EMAIL = env('RESEND_EMAIL_FROM');
const RESEND_API_URL = 'https://api.resend.com';

const MAX_SEND_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1_000;
const DIAGNOSTIC_TIMEOUT_MS = 3_000;
const DNS_ERROR_CODES = new Set(['ENOTFOUND', 'EAI_AGAIN']);

const EMAIL_DELIVERY_FAILED_MESSAGE = 'The email could not be sent. Please try again later.';

export class EmailDeliveryError extends Error {
  readonly #reason: string;

  constructor(reason: string) {
    super(EMAIL_DELIVERY_FAILED_MESSAGE);
    this.name = 'EmailDeliveryError';
    this.#reason = reason;
  }

  get reason(): string {
    return this.#reason;
  }
}

export interface EmailRecipient {
  name?: string;
  email: string;
}

export interface SendEmailOptions {
  idempotencyKey?: string;
}

interface EmailErrorInfo {
  name: string;
  message: string;
  statusCode: number | null;
}

type NetworkDiagnostic = {
  verdict: 'dns_failed' | 'connection_failed' | 'network_ok_at_check';
  httpStatus: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  checkedAt: string;
};

const readProperty = (value: unknown, key: string): unknown => {
  if (typeof value === 'object' && value !== null && key in value) {
    return (value as Record<string, unknown>)[key];
  }

  return undefined;
};

const readString = (value: unknown, key: string): string | null => {
  const property = readProperty(value, key);

  return typeof property === 'string' ? property : null;
};

const diagnoseNetworkFailure = async (): Promise<NetworkDiagnostic> => {
  const checkedAt = new Date().toISOString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DIAGNOSTIC_TIMEOUT_MS);

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'HEAD',
      signal: controller.signal,
    });

    return {
      verdict: 'network_ok_at_check',
      httpStatus: response.status,
      errorCode: null,
      errorMessage: null,
      checkedAt,
    };
  } catch (error) {
    const cause = readProperty(error, 'cause');
    const errorCode = readString(cause, 'code') ?? readString(error, 'name');

    return {
      verdict: errorCode && DNS_ERROR_CODES.has(errorCode) ? 'dns_failed' : 'connection_failed',
      httpStatus: null,
      errorCode,
      errorMessage: readString(cause, 'message') ?? readString(error, 'message'),
      checkedAt,
    };
  } finally {
    clearTimeout(timer);
  }
};

const describeDiagnostic = (diagnostic: NetworkDiagnostic): string =>
  diagnostic.errorCode ? `${diagnostic.verdict}: ${diagnostic.errorCode}` : diagnostic.verdict;

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

    throw new EmailDeliveryError(
      'Resend is not properly configured. Please set RESEND_EMAIL_API_KEY and RESEND_EMAIL_FROM',
    );
  }
};

export const sendEmailWithNotify = async (
  to: EmailRecipient,
  subject: string,
  html: string,
  options: SendEmailOptions = {},
) => {
  await validateNotifyConfig();

  const resend = new Resend(RESEND_API_KEY!);

  const formattedRecipient = to.name ? `${to.name} <${to.email}>` : to.email;

  const idempotencyKey =
    options.idempotencyKey ?? `notify-${Date.now()}-${Math.random().toString(36).slice(2)}`;

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

  const networkDiagnostic = lastError.statusCode === null ? await diagnoseNetworkFailure() : null;

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
      networkDiagnostic,
    },
  });

  const diagnosticSuffix = networkDiagnostic ? ` (${describeDiagnostic(networkDiagnostic)})` : '';

  throw new EmailDeliveryError(`Resend error: ${lastError.message}${diagnosticSuffix}`);
};
