import { EnvelopeType } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { procedure } from '../trpc';
import {
  type TGetTemplateByExternalIdResponse,
  ZGetTemplateByExternalIdRequestSchema,
  ZGetTemplateByExternalIdResponseSchema,
  getTemplateByExternalIdMeta,
} from './get-template-by-external-id.types';

/**
 * Fetches a template by its external ID.
 * This function can be used directly from loaders or other server-side code.
 */
export async function getTemplateByExternalId(
  externalId: string,
): Promise<TGetTemplateByExternalIdResponse> {
  const envelope = await prisma.envelope.findFirst({
    where: {
      externalId,
      type: EnvelopeType.TEMPLATE,
      deletedAt: null,
    },
    include: {
      directLink: true,
      documentMeta: true,
      envelopeItems: {
        include: {
          documentData: true,
        },
        orderBy: {
          order: 'asc',
        },
      },
      recipients: {
        orderBy: {
          id: 'asc',
        },
      },
      fields: {
        orderBy: {
          id: 'asc',
        },
      },
      team: {
        select: {
          id: true,
          url: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Template not found',
    });
  }

  const firstEnvelopeItem = envelope.envelopeItems[0];

  if (!firstEnvelopeItem || !firstEnvelopeItem.documentData) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Template document not found',
    });
  }

  if (!envelope.team) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Team not found',
    });
  }

  const initialEnvelope = {
    internalVersion: envelope.internalVersion,
    type: envelope.type,
    status: envelope.status,
    source: envelope.source,
    visibility: envelope.visibility,
    templateType: envelope.templateType,
    id: envelope.id,
    secondaryId: envelope.secondaryId,
    externalId: envelope.externalId,
    createdAt: envelope.createdAt,
    updatedAt: envelope.updatedAt,
    completedAt: envelope.completedAt,
    deletedAt: envelope.deletedAt,
    title: envelope.title,
    authOptions: envelope.authOptions,
    formValues: envelope.formValues,
    publicTitle: envelope.publicTitle,
    publicDescription: envelope.publicDescription,
    userId: envelope.userId,
    teamId: envelope.teamId,
    folderId: envelope.folderId,
    templateId: envelope.templateId,
    formKey: envelope.formKey,
    documentMeta: {
      signingOrder: envelope.documentMeta.signingOrder,
      distributionMethod: envelope.documentMeta.distributionMethod,
      id: envelope.documentMeta.id,
      subject: envelope.documentMeta.subject,
      message: envelope.documentMeta.message,
      timezone: envelope.documentMeta.timezone,
      dateFormat: envelope.documentMeta.dateFormat,
      redirectUrl: envelope.documentMeta.redirectUrl,
      typedSignatureEnabled: envelope.documentMeta.typedSignatureEnabled,
      uploadSignatureEnabled: envelope.documentMeta.uploadSignatureEnabled,
      drawSignatureEnabled: envelope.documentMeta.drawSignatureEnabled,
      allowDictateNextSigner: envelope.documentMeta.allowDictateNextSigner,
      language: envelope.documentMeta.language,
      emailSettings: envelope.documentMeta.emailSettings,
      emailId: envelope.documentMeta.emailId,
      emailReplyTo: envelope.documentMeta.emailReplyTo,
    },
    recipients: envelope.recipients.map((recipient) => ({
      envelopeId: recipient.envelopeId,
      role: recipient.role,
      readStatus: recipient.readStatus,
      signingStatus: recipient.signingStatus,
      sendStatus: recipient.sendStatus,
      id: recipient.id,
      email: recipient.email,
      name: recipient.name,
      token: recipient.token,
      documentDeletedAt: recipient.documentDeletedAt,
      expired: recipient.expired,
      signedAt: recipient.signedAt,
      authOptions: recipient.authOptions,
      signingOrder: recipient.signingOrder,
      rejectionReason: recipient.rejectionReason,
    })),
    fields: envelope.fields.map((field) => ({
      envelopeId: field.envelopeId,
      envelopeItemId: field.envelopeItemId,
      type: field.type,
      id: field.id,
      secondaryId: field.secondaryId,
      recipientId: field.recipientId,
      page: field.page,
      positionX: Number(field.positionX),
      positionY: Number(field.positionY),
      width: Number(field.width),
      height: Number(field.height),
      customText: field.customText,
      inserted: field.inserted,
      fieldMeta: field.fieldMeta,
    })),
    envelopeItems: envelope.envelopeItems.map((item) => ({
      envelopeId: item.envelopeId,
      id: item.id,
      title: item.title,
      order: item.order,
    })),
    directLink: envelope.directLink
      ? {
          directTemplateRecipientId: envelope.directLink.directTemplateRecipientId,
          enabled: envelope.directLink.enabled,
          id: envelope.directLink.id,
          token: envelope.directLink.token,
        }
      : null,
    team: {
      id: envelope.team.id,
      url: envelope.team.url,
    },
    user: {
      id: envelope.user.id,
      name: envelope.user.name || '',
      email: envelope.user.email,
    },
  };

  return {
    envelopeId: envelope.id,
    externalId: envelope.externalId || '',
    initialEnvelope,
    teamId: envelope.teamId,
  };
}

export const getTemplateByExternalIdRoute = procedure
  .meta(getTemplateByExternalIdMeta)
  .input(ZGetTemplateByExternalIdRequestSchema)
  .output(ZGetTemplateByExternalIdResponseSchema)
  .query(async ({ input, ctx }) => {
    const { externalId } = input;

    ctx.logger.info({
      input: {
        externalId,
      },
    });

    return getTemplateByExternalId(externalId);
  });
