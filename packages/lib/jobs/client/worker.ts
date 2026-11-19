import { BackgroundJobStatus } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { logger } from '../../utils/logger';
import { ZSimpleTriggerJobOptionsSchema } from './_internal/job';
import type { LocalJobProvider } from './local';

// Jobs younger than this were probably just submitted and are about to start.
const MIN_PENDING_JOB_AGE_MS = 5_000;

// Older PENDING jobs are left alone. Without this limit, the first run after a deploy would execute
// every job that ever got stuck, sending emails and webhooks that are no longer relevant.
const MAX_PENDING_JOB_AGE_MS = 60 * 60 * 1_000;

export class LocalJobWorker {
  private _intervalId: NodeJS.Timeout | null = null;
  private _isRunning = false;
  private _provider: LocalJobProvider;
  private _pollInterval: number;

  constructor(provider: LocalJobProvider, pollIntervalMs = 10000) {
    this._provider = provider;
    this._pollInterval = pollIntervalMs;
  }

  public start() {
    if (this._isRunning) {
      logger.warn('[JOBS WORKER]: Worker is already running');
      return;
    }

    this._isRunning = true;
    logger.info(`[JOBS WORKER]: Starting worker with ${this._pollInterval}ms interval`);

    // Process immediately on start
    void this.processPendingJobs();

    // Then process periodically
    this._intervalId = setInterval(() => {
      void this.processPendingJobs();
    }, this._pollInterval);
  }

  public stop() {
    if (!this._isRunning) {
      return;
    }

    this._isRunning = false;

    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }

    logger.info('[JOBS WORKER]: Worker stopped');
  }

  private async processPendingJobs() {
    try {
      const enabledJobIds = this._provider.getEnabledJobDefinitionIds();

      if (enabledJobIds.length === 0) {
        return;
      }

      const now = Date.now();

      const pendingJobs = await prisma.backgroundJob.findMany({
        where: {
          status: BackgroundJobStatus.PENDING,
          submittedAt: {
            lte: new Date(now - MIN_PENDING_JOB_AGE_MS),
            gte: new Date(now - MAX_PENDING_JOB_AGE_MS),
          },
          // Jobs this server cannot run would get a 404 on every cycle and fill the batch.
          jobId: {
            in: enabledJobIds,
          },
        },
        take: 20, // Process max 20 jobs per cycle to avoid overload
        orderBy: {
          submittedAt: 'asc', // Process oldest first
        },
      });

      if (pendingJobs.length === 0) {
        return;
      }

      logger.info(`[JOBS WORKER]: Found ${pendingJobs.length} pending jobs to process`);

      // Process jobs sequentially to avoid overload
      for (const job of pendingJobs) {
        try {
          // The endpoint finds the definition by its id (job.jobId), not by job.name, which is the
          // display name. The data goes through the same schema the endpoint parses before checking
          // the signature: the schema reorders keys, and the signature covers the JSON text.
          const jobData = ZSimpleTriggerJobOptionsSchema.parse({
            name: job.jobId,
            payload: job.payload,
          });

          // Re-submit the job to the endpoint
          await this._provider.submitJobToEndpoint({
            jobId: job.id,
            jobDefinitionId: job.jobId,
            data: jobData,
            isRetry: job.retried > 0,
          });

          logger.debug(`[JOBS WORKER]: Re-submitted job ${job.id} (${job.name})`);
        } catch (error) {
          // Log error but don't stop processing other jobs
          logger.error({ err: error, jobId: job.id }, '[JOBS WORKER]: Failed to re-submit job');
        }
      }
    } catch (error) {
      // Log error but don't crash the worker
      logger.error({ err: error }, '[JOBS WORKER]: Error processing pending jobs');
    }
  }
}
