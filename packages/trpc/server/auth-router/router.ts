import { z } from 'zod';

import { authenticatedProcedure, router } from '../trpc';

export const authRouter = router({
  // Stub for linkAccount - TODO: Implement
  linkAccount: authenticatedProcedure.input(z.object({ token: z.string() })).mutation(() => ({})),
});
