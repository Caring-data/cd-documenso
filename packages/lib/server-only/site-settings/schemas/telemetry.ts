import { z } from 'zod';

import { ZSiteSettingsBaseSchema } from './_base';

export const SITE_SETTINGS_TELEMETRY_ID = 'site.telemetry';

export const ZSiteSettingsTelemetrySchema = ZSiteSettingsBaseSchema.extend({
  id: z.literal(SITE_SETTINGS_TELEMETRY_ID),
  data: z.object({}).optional().default({}),
});

export type TSiteSettingsTelemetrySchema = z.infer<typeof ZSiteSettingsTelemetrySchema>;
