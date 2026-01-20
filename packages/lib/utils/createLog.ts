import { prisma } from '@documenso/prisma';
import { LogLevel, LogCategory } from '@documenso/prisma/client';
import type { ApiRequestMetadata, RequestMetadata } from '../universal/extract-request-metadata';

interface CreateLogParams {
  level?: LogLevel;
  category?: LogCategory;
  action: string;
  message?: string;
  data?: unknown;
  metadata?: RequestMetadata | ApiRequestMetadata;
  userId?: number | null;
  envelopeId?: string | null;
}

export async function createLog({
  level = LogLevel.ERROR,
  category = LogCategory.SYSTEM,
  action,
  message,
  data,
  metadata,
  userId,
  envelopeId,
}: CreateLogParams) {
  try {
    return await prisma.log.create({
      data: {
        level,
        category,
        action,
        message,
        data,
        metaData: metadata,
        userId,
        envelopeId,
      },
    });
  } catch (error) {
    // Fallback a console si falla el logging
    console.error('Failed to create log:', error);
    console.error('Log data:', { action, message, data });
  }
}
