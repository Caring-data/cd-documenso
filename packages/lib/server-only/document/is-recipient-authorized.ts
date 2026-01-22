import type { Envelope, Recipient } from '@prisma/client';
import { match } from 'ts-pattern';

import { prisma } from '@documenso/prisma';

import { validateTwoFactorTokenFromEmail } from '../2fa/email/validate-2fa-token-from-email';
import { verifyTwoFactorAuthenticationToken } from '../2fa/verify-2fa-token';
import { verifyPassword } from '../2fa/verify-password';
import { AppError, AppErrorCode } from '../../errors/app-error';
import type { TDocumentAuth, TDocumentAuthMethods } from '../../types/document-auth';
import { DocumentAuth } from '../../types/document-auth';
import { extractDocumentAuthMethods } from '../../utils/document-auth';

type IsRecipientAuthorizedOptions = {
  // !: Probably find a better name than 'ACCESS_2FA' if requirements change.
  type: 'ACCESS' | 'ACCESS_2FA' | 'ACTION';
  documentAuthOptions: Envelope['authOptions'];
  recipient: Pick<Recipient, 'authOptions' | 'email' | 'envelopeId'>;

  /**
   * The ID of the user who initiated the request.
   */
  userId?: number;

  /**
   * The auth details to check.
   *
   * Optional because there are scenarios where no auth options are required such as
   * using the user ID.
   */
  authOptions?: TDocumentAuthMethods;
};

const getUserByEmail = async (email: string) => {
  return await prisma.user.findFirst({
    where: {
      email,
    },
    select: {
      id: true,
    },
  });
};

/**
 * Whether the recipient is authorized to perform the requested operation on a
 * document, given the provided auth options.
 *
 * @returns True if the recipient can perform the requested operation.
 */
export const isRecipientAuthorized = async ({
  type,
  documentAuthOptions,
  recipient,
  userId,
  authOptions,
}: IsRecipientAuthorizedOptions): Promise<boolean> => {
  const { derivedRecipientAccessAuth, derivedRecipientActionAuth } = extractDocumentAuthMethods({
    documentAuth: documentAuthOptions,
    recipientAuth: recipient.authOptions,
  });

  const authMethods: TDocumentAuth[] = match(type)
    .with('ACCESS', () => derivedRecipientAccessAuth)
    .with('ACCESS_2FA', () => derivedRecipientAccessAuth)
    .with('ACTION', () => derivedRecipientActionAuth)
    .exhaustive();

  // Early true return when auth is not required.
  if (
    authMethods.length === 0 ||
    authMethods.some((method) => method === DocumentAuth.EXPLICIT_NONE)
  ) {
    return true;
  }

  // Early true return for ACCESS auth if all methods are 2FA since validation happens in ACCESS_2FA.
  if (type === 'ACCESS' && authMethods.every((method) => method === DocumentAuth.TWO_FACTOR_AUTH)) {
    return true;
  }

  // Create auth options when none are passed for account.
  if (!authOptions && authMethods.some((method) => method === DocumentAuth.ACCOUNT)) {
    authOptions = {
      type: DocumentAuth.ACCOUNT,
    };
  }

  // Authentication required does not match provided method.
  if (!authOptions || !authMethods.includes(authOptions.type)) {
    return false;
  }

  return await match(authOptions)
    .with({ type: DocumentAuth.ACCOUNT }, async () => {
      if (!userId) {
        return false;
      }

      const recipientUser = await getUserByEmail(recipient.email);

      if (!recipientUser) {
        return false;
      }

      return recipientUser.id === userId;
    })
    .with({ type: DocumentAuth.TWO_FACTOR_AUTH }, async ({ token, method }) => {
      if (type === 'ACCESS') {
        return true;
      }

      if (type === 'ACCESS_2FA' && method === 'email') {
        return await validateTwoFactorTokenFromEmail({
          envelopeId: recipient.envelopeId,
          email: recipient.email,
          code: token,
          window: 10, // 5 minutes worth of tokens
        });
      }

      if (!userId) {
        return false;
      }

      const user = await prisma.user.findFirst({
        where: {
          id: userId,
        },
      });

      // Should not be possible.
      if (!user) {
        throw new AppError(AppErrorCode.NOT_FOUND, {
          message: 'User not found',
        });
      }

      // For ACTION auth or authenticator method, use TOTP
      return await verifyTwoFactorAuthenticationToken({
        user,
        totpCode: token,
        window: 10, // 5 minutes worth of tokens
      });
    })
    .with({ type: DocumentAuth.PASSWORD }, async ({ password }) => {
      if (!userId) {
        return false;
      }

      return await verifyPassword({
        userId,
        password,
      });
    })
    .with({ type: DocumentAuth.EXPLICIT_NONE }, () => {
      return true;
    })
    .exhaustive();
};
