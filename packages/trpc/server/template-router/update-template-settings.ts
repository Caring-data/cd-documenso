import { updateTemplateSettings } from '@documenso/lib/server-only/template/update-template-settings';

import { authenticatedProcedure } from '../trpc';
import {
  ZUpdateTemplateSettingsRequestSchema,
  ZUpdateTemplateSettingsResponseSchema,
  updateTemplateSettingsMeta,
} from './update-template-settings.types';

export const updateTemplateSettingsRoute = authenticatedProcedure
  .meta(updateTemplateSettingsMeta)
  .input(ZUpdateTemplateSettingsRequestSchema)
  .output(ZUpdateTemplateSettingsResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId } = ctx;
    const { envelopeId, title, recipients } = input;

    ctx.logger.info({
      input: {
        envelopeId,
      },
    });

    return await updateTemplateSettings({
      userId: ctx.user.id,
      teamId,
      envelopeId,
      title,
      recipients,
    });
  });
