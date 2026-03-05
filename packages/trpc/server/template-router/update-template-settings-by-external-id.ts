import { EnvelopeType } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { updateTemplateSettings } from '@documenso/lib/server-only/template/update-template-settings';
import { prisma } from '@documenso/prisma';

import { procedure } from '../trpc';
import {
  ZUpdateTemplateSettingsByExternalIdRequestSchema,
  ZUpdateTemplateSettingsByExternalIdResponseSchema,
  updateTemplateSettingsByExternalIdMeta,
} from './update-template-settings-by-external-id.types';

export const updateTemplateSettingsByExternalIdRoute = procedure
  .meta(updateTemplateSettingsByExternalIdMeta)
  .input(ZUpdateTemplateSettingsByExternalIdRequestSchema)
  .output(ZUpdateTemplateSettingsByExternalIdResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { externalId, title, isSystem, recipients } = input;

    ctx.logger.info({
      input: {
        externalId,
      },
    });

    const envelope = await prisma.envelope.findFirst({
      where: {
        externalId,
        type: EnvelopeType.TEMPLATE,
        deletedAt: null,
      },
      select: {
        id: true,
        userId: true,
        teamId: true,
      },
    });

    if (!envelope || envelope.teamId === null) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Template not found',
      });
    }

    return await updateTemplateSettings({
      userId: envelope.userId,
      teamId: envelope.teamId,
      envelopeId: envelope.id,
      title,
      isSystem,
      recipients,
    });
  });
