import { prisma } from '@documenso/prisma';
import type { LogLevel, LogCategory, Prisma } from '@documenso/prisma/client';

export interface FindLogsOptions {
  level?: LogLevel | LogLevel[];
  category?: LogCategory | LogCategory[];
  action?: string;
  userId?: number;
  envelopeId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  perPage?: number;
  orderBy?: {
    column: 'createdAt' | 'level';
    direction: 'asc' | 'desc';
  };
}

export const findLogs = async (options: FindLogsOptions = {}) => {
  const {
    level,
    category,
    action,
    userId,
    envelopeId,
    startDate,
    endDate,
    page = 1,
    perPage = 30,
    orderBy = { column: 'createdAt', direction: 'desc' },
  } = options;

  const where: Prisma.LogWhereInput = {};

  if (level) {
    where.level = Array.isArray(level) ? { in: level } : level;
  }

  if (category) {
    where.category = Array.isArray(category) ? { in: category } : category;
  }

  if (action) {
    where.action = { contains: action, mode: 'insensitive' };
  }

  if (userId) {
    where.userId = userId;
  }

  if (envelopeId) {
    where.envelopeId = envelopeId;
  }

  if (startDate || endDate) {
    where.createdAt = {
      ...(startDate && { gte: startDate }),
      ...(endDate && { lte: endDate }),
    };
  }

  const [data, count] = await Promise.all([
    prisma.log.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        envelope: {
          select: {
            id: true,
            secondaryId: true,
            title: true,
          },
        },
      },
      orderBy: {
        [orderBy.column]: orderBy.direction,
      },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.log.count({ where }),
  ]);

  return {
    data,
    count,
    currentPage: page,
    perPage,
    totalPages: Math.ceil(count / perPage),
  };
};
