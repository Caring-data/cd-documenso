import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';

import { AuthenticationErrorCode } from '@documenso/auth/server/lib/errors/error-codes';

export const signupErrorMessages: Record<string, MessageDescriptor> = {
  [AuthenticationErrorCode.InvalidRequest]: msg`Invalid request. Please try again.`,
  [AuthenticationErrorCode.AccountDisabled]: msg`This account has been disabled. Please contact support.`,
  [AuthenticationErrorCode.UnverifiedEmail]: msg`This account has not been verified. Please verify your account before signing in.`,
  EMAIL_ALREADY_EXISTS: msg`This email is already in use. Please sign in instead.`,
};
