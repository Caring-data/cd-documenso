import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { procedure } from '../trpc';
import {
  ZGetResidentInfoRequestSchema,
  ZGetResidentInfoResponseSchema,
  getResidentInfoMeta,
} from './get-resident-info.types';

// NOTE: THIS IS A PUBLIC PROCEDURE (no authentication required for signing)
export const getResidentInfoRoute = procedure
  .meta(getResidentInfoMeta)
  .input(ZGetResidentInfoRequestSchema)
  .output(ZGetResidentInfoResponseSchema)
  .query(async ({ input, ctx }) => {
    const { token } = input;

    ctx.logger.info({
      input: {
        token,
      },
    });

    const result = await prisma.recipient.findFirst({
      where: { token },
      include: {
        envelope: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    if (!result) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Recipient not found',
      });
    }

    return {
      residentId: result.envelope?.ownerId ?? null,
    };
  });
