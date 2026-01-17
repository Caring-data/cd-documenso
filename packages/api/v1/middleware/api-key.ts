import type { TsRestRequest } from '@ts-rest/serverless';
import type { Logger } from 'pino';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { BaseApiLog, RootApiLog } from '@documenso/lib/types/api-logs';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { extractRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { nanoid } from '@documenso/lib/universal/id';
import { env } from '@documenso/lib/utils/env';
import { logger } from '@documenso/lib/utils/logger';

type B = {
  request: TsRestRequest;
  responseHeaders: Headers;
};

export const apiKeyMiddleware = <
  T extends {
    headers: {
      'x-api-key'?: string;
    };
  },
  R extends {
    status: number;
    body: unknown;
  },
>(
  handler: (
    args: T & { req: TsRestRequest },
    options: { metadata: ApiRequestMetadata; logger: Logger },
  ) => Promise<R>,
) => {
  return async (args: T, { request }: B) => {
    const requestMetadata = extractRequestMetadata(request);

    const apiLogger = logger.child({
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      requestId: nanoid(),
    } satisfies RootApiLog);

    const infoToLog: BaseApiLog = {
      auth: 'api',
      source: 'apiV1',
      path: request.url,
    };

    try {
      const apiKey = args.headers['x-api-key'];

      if (!apiKey) {
        throw new AppError(AppErrorCode.UNAUTHORIZED, {
          message: 'API key was not provided',
        });
      }

      const expectedApiKey = env('NEXT_PRIVATE_API_KEY');

      if (!expectedApiKey) {
        throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
          message: 'API key authentication is not configured',
        });
      }

      if (apiKey !== expectedApiKey) {
        throw new AppError(AppErrorCode.UNAUTHORIZED, {
          message: 'Invalid API key',
        });
      }

      apiLogger.info({
        ...infoToLog,
      } satisfies BaseApiLog);

      const metadata: ApiRequestMetadata = {
        requestMetadata,
        source: 'apiV1',
        auth: 'api',
        auditUser: {
          id: null,
          email: null,
          name: 'API Key',
        },
      };

      return await handler(
        {
          ...args,
          req: request,
        },
        { metadata, logger: apiLogger },
      );
    } catch (err) {
      console.log({ err });

      apiLogger.info(infoToLog);

      let message = 'Unauthorized';

      if (err instanceof AppError) {
        message = err.message;
      }

      return {
        status: 401,
        body: {
          message,
        },
      } as const;
    }
  };
};
