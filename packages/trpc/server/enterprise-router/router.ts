import { z } from 'zod';

import { authenticatedProcedure, router } from '../trpc';
import { createOrganisationEmailRoute } from './create-organisation-email';
import { declineLinkOrganisationAccountRoute } from './decline-link-organisation-account';
import { deleteOrganisationEmailRoute } from './delete-organisation-email';
import { findOrganisationEmailsRoute } from './find-organisation-emails';
import { getOrganisationAuthenticationPortalRoute } from './get-organisation-authentication-portal';
import { getOrganisationEmailDomainRoute } from './get-organisation-email-domain';
import {
  ZFindOrganisationEmailDomainsRequestSchema,
  ZFindOrganisationEmailDomainsResponseSchema,
} from './find-organisation-email-domain.types';
import { updateOrganisationAuthenticationPortalRoute } from './update-organisation-authentication-portal';
import { updateOrganisationEmailRoute } from './update-organisation-email';

// Stub router for emailDomain - TODO: Implement remaining routes
const emailDomainRouter = router({
  find: authenticatedProcedure
    .input(ZFindOrganisationEmailDomainsRequestSchema.omit({ organisationId: true, emailDomainId: true, statuses: true }).extend({ organisationId: z.string().optional(), query: z.string().optional() }))
    .output(ZFindOrganisationEmailDomainsResponseSchema)
    .query(() => ({ data: [], count: 0, perPage: 10, currentPage: 1, totalPages: 1 })),
  get: getOrganisationEmailDomainRoute,
  create: authenticatedProcedure
    .input(z.object({ domain: z.string(), organisationId: z.string() }))
    .mutation(() => ({ records: [] })),
  update: authenticatedProcedure.input(z.any()).mutation(() => ({})),
  delete: authenticatedProcedure.input(z.any()).mutation(() => ({})),
  verify: authenticatedProcedure.input(z.any()).mutation(() => ({ verified: false })),
});

export const enterpriseRouter = router({
  organisation: {
    email: {
      find: findOrganisationEmailsRoute,
      create: createOrganisationEmailRoute,
      update: updateOrganisationEmailRoute,
      delete: deleteOrganisationEmailRoute,
    },
    emailDomain: emailDomainRouter,
    authenticationPortal: {
      get: getOrganisationAuthenticationPortalRoute,
      update: updateOrganisationAuthenticationPortalRoute,
      declineLinkAccount: declineLinkOrganisationAccountRoute,
      linkAccount: authenticatedProcedure
        .input(z.object({ token: z.string() }))
        .mutation(() => ({})),
    },
  },
});
