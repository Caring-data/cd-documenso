import { z } from 'zod';

import { type JobDefinition } from '../../client/_internal/job';

const DOCUMENT_COMPLETE_PROCESSING_JOB_DEFINITION_ID = 'document.complete.processing';

const DOCUMENT_COMPLETE_PROCESSING_JOB_DEFINITION_SCHEMA = z.object({
  envelopeId: z.string(),
  legacyDocumentId: z.number(),
  recipientId: z.number(),
  requestMetadata: z
    .object({
      userAgent: z.string().optional(),
      ipAddress: z.string().optional(),
      timestamp: z.string().optional(),
    })
    .optional(),
});

export type TDocumentCompleteProcessingJobDefinition = z.infer<
  typeof DOCUMENT_COMPLETE_PROCESSING_JOB_DEFINITION_SCHEMA
>;

export const DOCUMENT_COMPLETE_PROCESSING_JOB_DEFINITION = {
  id: DOCUMENT_COMPLETE_PROCESSING_JOB_DEFINITION_ID,
  name: 'Document Complete Processing',
  version: '1.0.0',
  trigger: {
    name: DOCUMENT_COMPLETE_PROCESSING_JOB_DEFINITION_ID,
    schema: DOCUMENT_COMPLETE_PROCESSING_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./document-complete-processing.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof DOCUMENT_COMPLETE_PROCESSING_JOB_DEFINITION_ID,
  z.infer<typeof DOCUMENT_COMPLETE_PROCESSING_JOB_DEFINITION_SCHEMA>
>;
