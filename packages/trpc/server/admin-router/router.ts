import { router } from '../trpc';
import { createAdminOrganisationRoute } from './create-admin-organisation';
import { deleteDocumentRoute } from './delete-document';
import { deleteUserRoute } from './delete-user';
import { disableUserRoute } from './disable-user';
import { enableUserRoute } from './enable-user';
import { findAdminOrganisationsRoute } from './find-admin-organisations';
import { findDocumentJobsRoute } from './find-document-jobs';
import { findDocumentsRoute } from './find-documents';
import { getAdminOrganisationRoute } from './get-admin-organisation';
import { getUserRoute } from './get-user';
import { promoteMemberToOwnerRoute } from './promote-member-to-owner';
import { resealDocumentRoute } from './reseal-document';
import { resetTwoFactorRoute } from './reset-two-factor-authentication';
import { updateAdminOrganisationRoute } from './update-admin-organisation';
import { updateOrganisationMemberRoleRoute } from './update-organisation-member-role';
import { updateRecipientRoute } from './update-recipient';
import { updateSiteSettingRoute } from './update-site-setting';
import { updateUserRoute } from './update-user';

export const adminRouter = router({
  organisation: {
    find: findAdminOrganisationsRoute,
    get: getAdminOrganisationRoute,
    create: createAdminOrganisationRoute,
    update: updateAdminOrganisationRoute,
  },
  organisationMember: {
    promoteToOwner: promoteMemberToOwnerRoute,
    updateRole: updateOrganisationMemberRoleRoute,
  },
  user: {
    get: getUserRoute,
    update: updateUserRoute,
    delete: deleteUserRoute,
    enable: enableUserRoute,
    disable: disableUserRoute,
    resetTwoFactor: resetTwoFactorRoute,
  },
  document: {
    find: findDocumentsRoute,
    delete: deleteDocumentRoute,
    reseal: resealDocumentRoute,
    findJobs: findDocumentJobsRoute,
  },
  recipient: {
    update: updateRecipientRoute,
  },
  updateSiteSetting: updateSiteSettingRoute,
});
