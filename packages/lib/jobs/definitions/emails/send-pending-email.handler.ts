import { LogCategory, LogLevel } from '@prisma/client';

import { EmailDeliveryError } from '@documenso/email/notify';

import { sendPendingEmail } from '../../../server-only/document/send-pending-email';
import { createLog } from '../../../utils/createLog';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSendPendingEmailJobDefinition } from './send-pending-email';

const TASK_EXCEEDED_RETRIES_ERROR_NAME = 'BackgroundTaskExceededRetriesError';

const describeError = (error: unknown): string => {
  if (error instanceof EmailDeliveryError) {
    return error.reason;
  }

  return error instanceof Error ? error.message : String(error);
};

export const run = async ({
  payload,
  io,
}: {
  payload: TSendPendingEmailJobDefinition;
  io: JobRunIO;
}) => {
  const { documentId, recipientId } = payload;

  try {
    await io.runTask('send-document-pending-email', async () => {
      try {
        await sendPendingEmail({
          id: {
            type: 'documentId',
            id: documentId,
          },
          recipientId,
        });
      } catch (error) {
        await createLog({
          level: LogLevel.WARN,
          category: LogCategory.EMAIL,
          action: 'SEND_PENDING_EMAIL_ATTEMPT_FAILED',
          message: 'Attempt to send the waiting-for-others email failed',
          data: {
            legacyDocumentId: documentId,
            recipientId,
            error: describeError(error),
          },
        });

        throw error;
      }
    });
  } catch (error) {
    if (error instanceof Error && error.name === TASK_EXCEEDED_RETRIES_ERROR_NAME) {
      await createLog({
        level: LogLevel.ERROR,
        category: LogCategory.EMAIL,
        action: 'SEND_PENDING_EMAIL_JOB_FAILED',
        message: 'Waiting-for-others email was not sent; all attempts failed',
        data: {
          legacyDocumentId: documentId,
          recipientId,
        },
      });
    }

    throw error;
  }
};
