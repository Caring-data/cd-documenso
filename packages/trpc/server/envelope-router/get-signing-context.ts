import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { procedure } from '../trpc';
import {
  ZGetSigningContextRequestSchema,
  ZGetSigningContextResponseSchema,
  getSigningContextMeta,
} from './get-signing-context.types';

// NOTE: PUBLIC PROCEDURE (no authentication required for signing)
export const getSigningContextRoute = procedure
  .meta(getSigningContextMeta)
  .input(ZGetSigningContextRequestSchema)
  .output(ZGetSigningContextResponseSchema)
  .query(async ({ input, ctx }) => {
    const { token } = input;

    ctx.logger.info({ input: { token } });

    const result = await prisma.recipient.findFirst({
      where: { token },
      include: {
        envelope: {
          select: {
            ownerId: true,
            signingContext: true,
          },
        },
      },
    });

    if (!result) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Recipient not found',
      });
    }

    const ownerId = result.envelope?.ownerId ?? null;
    const signingContext = result.envelope?.signingContext ?? null;

    return {
      ownerId,
      signingContext,
    };
  });
