import { z } from 'zod';

export const ZGetResidentInfoRequestSchema = z.object({
  token: z.string(),
});

export const ZGetResidentInfoResponseSchema = z.object({
  residentId: z.string().nullable(),
});

export const getResidentInfoMeta = {
  openapi: {
    method: 'GET',
    path: '/envelope/getResidentInfo',
    summary: 'Get resident info',
    description: 'Get residentId from envelope by recipient token',
    tags: ['Envelope'],
  },
};
