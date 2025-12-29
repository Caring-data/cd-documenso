import { router } from '../trpc';
import { createOrganisationEmailRoute } from './create-organisation-email';
import { declineLinkOrganisationAccountRoute } from './decline-link-organisation-account';
import { deleteOrganisationEmailRoute } from './delete-organisation-email';
import { findOrganisationEmailsRoute } from './find-organisation-emails';
import { getOrganisationAuthenticationPortalRoute } from './get-organisation-authentication-portal';
import { updateOrganisationAuthenticationPortalRoute } from './update-organisation-authentication-portal';
import { updateOrganisationEmailRoute } from './update-organisation-email';

export const enterpriseRouter = router({
  organisation: {
    email: {
      find: findOrganisationEmailsRoute,
      create: createOrganisationEmailRoute,
      update: updateOrganisationEmailRoute,
      delete: deleteOrganisationEmailRoute,
    },
    authenticationPortal: {
      get: getOrganisationAuthenticationPortalRoute,
      update: updateOrganisationAuthenticationPortalRoute,
      declineLinkAccount: declineLinkOrganisationAccountRoute,
    },
  },
});
