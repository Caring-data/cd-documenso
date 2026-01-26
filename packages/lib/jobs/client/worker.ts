import { BackgroundJobStatus } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { logger } from '../../utils/logger';
import type { LocalJobProvider } from './local';
import type { SimpleTriggerJobOptions } from './_internal/job';

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
      // Find jobs that are PENDING and have been submitted more than 5 seconds ago
      // This avoids processing jobs that were just created
      const fiveSecondsAgo = new Date(Date.now() - 5000);

      const pendingJobs = await prisma.backgroundJob.findMany({
        where: {
          status: BackgroundJobStatus.PENDING,
          submittedAt: {
            lte: fiveSecondsAgo,
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
          // Reconstruct the SimpleTriggerJobOptions from the stored job
          const jobData: SimpleTriggerJobOptions = {
            name: job.name,
            payload: job.payload as unknown,
            id: job.id,
            timestamp: job.submittedAt.getTime(),
          };

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
          logger.error(`[JOBS WORKER]: Failed to re-submit job ${job.id}:`, error);
        }
      }
    } catch (error) {
      // Log error but don't crash the worker
      logger.error('[JOBS WORKER]: Error processing pending jobs:', error);
    }
  }
}
