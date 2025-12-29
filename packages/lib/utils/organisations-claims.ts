import type { SubscriptionClaim } from '@prisma/client';

const DEFAULT_MINIMUM_ENVELOPE_ITEM_COUNT = 5;

export const generateDefaultSubscriptionClaim = (): Omit<
  SubscriptionClaim,
  'id' | 'organisation' | 'createdAt' | 'updatedAt' | 'originalSubscriptionClaimId'
> => {
  return {
    name: '',
    teamCount: 1,
    memberCount: 1,
    envelopeItemCount: DEFAULT_MINIMUM_ENVELOPE_ITEM_COUNT,
    locked: false,
    flags: {},
  };
};
