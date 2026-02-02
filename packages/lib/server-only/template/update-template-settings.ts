import type { RecipientRole } from '@prisma/client';
import { EnvelopeType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { TRecipientActionAuthTypes } from '../../types/document-auth';
import {
  updateTemplateSettings as updateCaringDataTemplateSettings,
  updateTemplateSigners as updateCaringDataTemplateSigners,
} from '../caring-data-api/client';
import { mapRecipientRoleToCaringData } from '../caring-data-api/types';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';
import { setTemplateRecipients } from '../recipient/set-template-recipients';

export interface UpdateTemplateSettingsOptions {
  userId: number;
  teamId: number;
  envelopeId: string;
  title: string;
  recipients: {
    id?: number;
    email: string;
    name: string;
    role: RecipientRole;
    signingOrder?: number | null;
    actionAuth?: TRecipientActionAuthTypes[];
    contactCategoryKey?: string | null;
  }[];
}

export const updateTemplateSettings = async ({
  userId,
  teamId,
  envelopeId,
  title,
  recipients,
}: UpdateTemplateSettingsOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id: {
      type: 'envelopeId',
      id: envelopeId,
    },
    type: EnvelopeType.TEMPLATE,
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findFirst({
    where: envelopeWhereInput,
    include: {
      documentMeta: true,
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Template not found',
    });
  }

  // Sync with Caring Data API if externalId is present
  if (envelope.externalId) {
    try {
      const documentMeta = envelope.documentMeta;

      // Update template settings in Caring Data
      await updateCaringDataTemplateSettings(envelope.externalId, {
        title,
        defaultLanguage: documentMeta?.language || 'en',
        defaultTimezone: documentMeta?.timezone || 'Etc/UTC',
        defaultEmailSubject: documentMeta?.subject || '',
        defaultEmailMessage: documentMeta?.message || '',
      });

      // Map recipients to Caring Data format
      const caringDataSigners = recipients.map((recipient) => ({
        documensoSignerId: recipient.id,
        name: recipient.name,
        email: recipient.email,
        role: mapRecipientRoleToCaringData(recipient.role),
        signingOrder: recipient.signingOrder ?? null,
        contactCategoryKey: recipient.contactCategoryKey ?? null,
      }));

      // Update template signers in Caring Data
      await updateCaringDataTemplateSigners(envelope.externalId, caringDataSigners);
    } catch (error) {
      // Log the error for debugging with context
      console.error('Failed to sync template settings with Caring Data API:', {
        envelopeId,
        externalId: envelope.externalId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Re-throw as AppError if it's not already one
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Failed to sync template settings with Caring Data API',
      });
    }
  }

  // Update title
  await prisma.envelope.update({
    where: {
      id: envelopeId,
    },
    data: {
      title,
    },
  });

  // Update recipients
  const { recipients: updatedRecipients } = await setTemplateRecipients({
    userId,
    teamId,
    id: {
      type: 'envelopeId',
      id: envelopeId,
    },
    recipients,
  });

  return {
    envelopeId,
    title,
    recipients: updatedRecipients,
  };
};
