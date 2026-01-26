import { hash } from '@node-rs/bcrypt';
import { tsr } from '@ts-rest/serverless/fetch';

import { SALT_ROUNDS } from '@documenso/lib/constants/auth';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { createUser } from '@documenso/lib/server-only/user/create-user';
import { disableUser } from '@documenso/lib/server-only/user/disable-user';
import { prisma } from '@documenso/prisma';

import { ApiContractV1Users } from './contract';
import { apiKeyMiddleware } from './middleware/api-key';

export const ApiContractV1UsersImplementation = tsr.router(ApiContractV1Users, {
  createUser: apiKeyMiddleware(async (args, { logger }) => {
    const { body } = args;

    logger.info({
      input: {
        email: body.email,
        name: body.name,
      },
    });

    try {
      const user = await createUser({
        name: body.name,
        email: body.email,
        password: body.password,
      });

      return {
        status: 200,
        body: {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      };
    } catch (err) {
      if (err instanceof AppError && err.code === AppErrorCode.ALREADY_EXISTS) {
        return {
          status: 400,
          body: {
            message: 'User with this email already exists',
          },
        };
      }

      return AppError.toRestAPIError(err);
    }
  }),

  getUsers: apiKeyMiddleware(async (args, { logger }) => {
    const page = Number(args.query.page) || 1;
    const perPage = Number(args.query.perPage) || 10;

    logger.info({
      input: {
        page,
        perPage,
      },
    });

    try {
      const skip = (page - 1) * perPage;

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          skip,
          take: perPage,
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.user.count(),
      ]);

      const totalPages = Math.ceil(total / perPage);

      return {
        status: 200,
        body: {
          users: users.map((user) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          })),
          totalPages,
        },
      };
    } catch (err) {
      return AppError.toRestAPIError(err);
    }
  }),

  getUser: apiKeyMiddleware(async (args, { logger }) => {
    const { id } = args.params;

    logger.info({
      input: {
        id,
      },
    });

    try {
      const userId = Number(id);

      const user = await prisma.user.findFirst({
        where: {
          id: userId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        return {
          status: 404,
          body: {
            message: 'User not found',
          },
        };
      }

      return {
        status: 200,
        body: {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      };
    } catch (err) {
      return AppError.toRestAPIError(err);
    }
  }),

  updateUser: apiKeyMiddleware(async (args, { logger }) => {
    const { id } = args.params;
    const { body } = args;

    logger.info({
      input: {
        id,
        email: body.email,
        name: body.name,
        hasPassword: !!body.password,
      },
    });

    try {
      const userId = Number(id);

      const existingUser = await prisma.user.findFirst({
        where: {
          id: userId,
        },
      });

      if (!existingUser) {
        return {
          status: 404,
          body: {
            message: 'User not found',
          },
        };
      }

      // Check if email is being changed and if it already exists
      if (body.email && body.email.toLowerCase() !== existingUser.email.toLowerCase()) {
        const emailExists = await prisma.user.findFirst({
          where: {
            email: body.email.toLowerCase(),
            id: {
              not: userId,
            },
          },
        });

        if (emailExists) {
          return {
            status: 400,
            body: {
              message: 'User with this email already exists',
            },
          };
        }
      }

      const updateData: {
        name?: string;
        email?: string;
        password?: string;
      } = {};

      if (body.name) {
        updateData.name = body.name;
      }

      if (body.email) {
        updateData.email = body.email.toLowerCase();
      }

      if (body.password) {
        updateData.password = await hash(body.password, SALT_ROUNDS);
      }

      const updatedUser = await prisma.user.update({
        where: {
          id: userId,
        },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return {
        status: 200,
        body: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          createdAt: updatedUser.createdAt,
          updatedAt: updatedUser.updatedAt,
        },
      };
    } catch (err) {
      return AppError.toRestAPIError(err);
    }
  }),

  deleteUser: apiKeyMiddleware(async (args, { logger }) => {
    const { id } = args.params;

    logger.info({
      input: {
        id,
      },
    });

    try {
      const userId = Number(id);

      const user = await prisma.user.findFirst({
        where: {
          id: userId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        return {
          status: 404,
          body: {
            message: 'User not found',
          },
        };
      }

      await disableUser({ id: userId });

      return {
        status: 200,
        body: {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      };
    } catch (err) {
      return AppError.toRestAPIError(err);
    }
  }),
});
