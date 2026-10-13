import {
  BackgroundJobStatus,
  DocumentStatus,
  EnvelopeType,
  RecipientRole,
  SigningStatus,
} from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import {
  SEAL_DOCUMENT_JOB_DEFINITION_ID,
  SEAL_DOCUMENT_LARAVEL_TASK_NAME,
  ZSealDocumentLaravelTaskResultSchema,
} from '@documenso/lib/jobs/definitions/internal/seal-document';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';

import { maybeAuthenticatedProcedure } from '../trpc';
import {
  ZSigningStatusEnvelopeRequestSchema,
  ZSigningStatusEnvelopeResponseSchema,
} from './signing-status-envelope.types';

const SEALING_STALE_THRESHOLD_MS = 10 * 60 * 1000;

// Internal route - not intended for public API usage
export const signingStatusEnvelopeRoute = maybeAuthenticatedProcedure
  .input(ZSigningStatusEnvelopeRequestSchema)
  .output(ZSigningStatusEnvelopeResponseSchema)
  .query(async ({ input, ctx }) => {
    const { token } = input;

    ctx.logger.info({
      input: {
        token,
      },
    });

    const envelope = await prisma.envelope.findFirst({
      where: {
        type: EnvelopeType.DOCUMENT,
        recipients: {
          some: {
            token,
          },
        },
      },
      include: {
        recipients: {
          select: {
            id: true,
            name: true,
            email: true,
            signingStatus: true,
            signedAt: true,
            role: true,
          },
        },
      },
    });

    if (!envelope) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Envelope not found',
      });
    }

    // Check if envelope is rejected
    if (envelope.status === DocumentStatus.REJECTED) {
      return {
        status: 'REJECTED',
      };
    }

    const sealJob = await getLatestSealJob(mapSecondaryIdToDocumentId(envelope.secondaryId));

    if (envelope.status === DocumentStatus.COMPLETED) {
      const laravelTask = sealJob?.tasks.find(
        (task) => task.name === SEAL_DOCUMENT_LARAVEL_TASK_NAME,
      );

      const laravelTaskResult = ZSealDocumentLaravelTaskResultSchema.safeParse(laravelTask?.result);

      if (laravelTaskResult.success && !laravelTaskResult.data.isStored) {
        return {
          status: 'FAILED',
        };
      }

      return {
        status: 'COMPLETED',
      };
    }

    const isComplete =
      envelope.recipients.some((recipient) => recipient.signingStatus === SigningStatus.REJECTED) ||
      envelope.recipients.every(
        (recipient) =>
          recipient.role === RecipientRole.CC || recipient.signingStatus === SigningStatus.SIGNED,
      );

    if (!isComplete) {
      return {
        status: 'PENDING',
      };
    }

    if (sealJob?.status === BackgroundJobStatus.FAILED) {
      return {
        status: 'FAILED',
      };
    }

    const lastActivityAt =
      sealJob?.updatedAt ??
      envelope.recipients.reduce<Date | null>((latest, recipient) => {
        if (!recipient.signedAt) {
          return latest;
        }

        return !latest || recipient.signedAt > latest ? recipient.signedAt : latest;
      }, null);

    if (lastActivityAt && Date.now() - lastActivityAt.getTime() > SEALING_STALE_THRESHOLD_MS) {
      return {
        status: 'FAILED',
      };
    }

    return {
      status: 'PROCESSING',
    };
  });

const getLatestSealJob = async (legacyDocumentId: number) => {
  return await prisma.backgroundJob.findFirst({
    where: {
      jobId: SEAL_DOCUMENT_JOB_DEFINITION_ID,
      payload: {
        path: ['documentId'],
        equals: legacyDocumentId,
      },
    },
    orderBy: {
      submittedAt: 'desc',
    },
    select: {
      status: true,
      updatedAt: true,
      tasks: {
        select: {
          name: true,
          result: true,
        },
      },
    },
  });
};
