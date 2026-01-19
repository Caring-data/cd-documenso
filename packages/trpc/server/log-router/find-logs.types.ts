import { z } from 'zod';

import { LogLevel, LogCategory } from '@documenso/prisma/client';
import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';

export const ZFindLogsRequestSchema = ZFindSearchParamsSchema.extend({
  level: z.nativeEnum(LogLevel).optional(),
  category: z.nativeEnum(LogCategory).optional(),
  userId: z.number().optional(),
  envelopeId: z.string().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  perPage: z.number().min(1).max(100).optional().default(30),
});

export const ZFindLogsResponseSchema = ZFindResultResponse.extend({
  data: z.array(
    z.object({
      id: z.string(),
      level: z.nativeEnum(LogLevel),
      category: z.nativeEnum(LogCategory),
      action: z.string(),
      message: z.string().nullable(),
      data: z.unknown().nullable(),
      metaData: z.unknown().nullable(),
      userId: z.number().nullable(),
      envelopeId: z.string().nullable(),
      createdAt: z.date(),
      user: z
        .object({
          id: z.number(),
          email: z.string(),
          name: z.string().nullable(),
        })
        .nullable(),
      envelope: z
        .object({
          id: z.string(),
          secondaryId: z.string(),
          title: z.string(),
        })
        .nullable(),
    }),
  ),
});

export type TFindLogsRequest = z.infer<typeof ZFindLogsRequestSchema>;
export type TFindLogsResponse = z.infer<typeof ZFindLogsResponseSchema>;
