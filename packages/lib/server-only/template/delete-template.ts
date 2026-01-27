import { EnvelopeType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { type EnvelopeIdOptions } from '../../utils/envelope';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export type DeleteTemplateOptions = {
  id: EnvelopeIdOptions;
  userId: number;
  teamId: number;
};

export const deleteTemplate = async ({ id, userId, teamId }: DeleteTemplateOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id,
    type: EnvelopeType.TEMPLATE,
    userId,
    teamId,
  });

  // Verificar que existe antes de actualizar
  const existingEnvelope = await prisma.envelope.findFirst({
    where: envelopeWhereInput,
  });

  if (!existingEnvelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Template not found',
    });
  }

  return await prisma.envelope.update({
    where: { id: existingEnvelope.id },
    data: {
      deletedAt: new Date().toISOString(),
    },
  });
};
