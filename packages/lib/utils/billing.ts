import type { Subscription } from '@documenso/prisma/generated/zod/modelSchema/SubscriptionSchema';

/**
 * Billing is disabled - this function always returns without validation.
 */
export const validateIfSubscriptionIsRequired = (subscription?: Subscription | null) => {
  // Billing is disabled, no validation needed
  return subscription;
};
