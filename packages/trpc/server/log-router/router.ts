import { router } from '../trpc';
import { findLogsRoute } from './find-logs';

export const logRouter = router({
  find: findLogsRoute,
});
