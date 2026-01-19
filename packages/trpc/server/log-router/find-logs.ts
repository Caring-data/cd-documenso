import { findLogs } from '@documenso/lib/server-only/logs/find-logs';

import { adminProcedure } from '../trpc';
import { ZFindLogsRequestSchema, ZFindLogsResponseSchema } from './find-logs.types';

export const findLogsRoute = adminProcedure
  .input(ZFindLogsRequestSchema)
  .output(ZFindLogsResponseSchema)
  .query(async ({ input }) => {
    const { query, ...rest } = input;
    return findLogs({
      ...rest,
      action: query || rest.action,
    });
  });
