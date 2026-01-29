import { EnvelopeType } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { setFieldsForTemplate } from '@documenso/lib/server-only/field/set-fields-for-template';
import { prisma } from '@documenso/prisma';

import { procedure } from '../trpc';
import {
  ZSetEnvelopeFieldsByExternalIdRequestSchema,
  ZSetEnvelopeFieldsByExternalIdResponseSchema,
  setEnvelopeFieldsByExternalIdMeta,
} from './set-envelope-fields-by-external-id.types';

export const setEnvelopeFieldsByExternalIdRoute = procedure
  .meta(setEnvelopeFieldsByExternalIdMeta)
  .input(ZSetEnvelopeFieldsByExternalIdRequestSchema)
  .output(ZSetEnvelopeFieldsByExternalIdResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { externalId, fields } = input;

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

    const result = await setFieldsForTemplate({
      userId: envelope.userId,
      teamId: envelope.teamId,
      id: {
        type: 'envelopeId',
        id: envelope.id,
      },
      fields: fields.map((field) => ({
        ...field,
        pageNumber: field.page,
        pageX: field.positionX,
        pageY: field.positionY,
        pageWidth: field.width,
        pageHeight: field.height,
      })),
    });

    return {
      data: result.fields.map((field) => ({
        ...field,
        formId: field.formId,
      })),
    };
  });
