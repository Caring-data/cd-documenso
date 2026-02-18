import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc';

export const ZGetSigningContextRequestSchema = z.object({
  token: z.string(),
});

export const ZSigningContextSchema = z
  .object({
    module: z.enum(['resident', 'staff', 'facility', 'reports']).optional(),
  })
  .nullable();

export const ZGetSigningContextResponseSchema = z.object({
  ownerId: z.string().nullable(),
  signingContext: ZSigningContextSchema.nullable(),
});

export const getSigningContextMeta = {
  openapi: {
    method: 'GET' as const,
    path: '/envelope/getSigningContext' as const,
    summary: 'Get signing context',
    description: 'Get ownerId and signingContext from envelope by recipient token',
    tags: ['Envelope'],
  },
} satisfies TrpcRouteMeta;
