import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from 'react-router';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { isPersonalLayout } from '@documenso/lib/utils/organisations';

import { OrganisationEmailDomainCreateDialog } from '~/components/dialogs/organisation-email-domain-create-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { OrganisationEmailDomainsDataTable } from '~/components/tables/organisation-email-domains-table';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Email Domains');
}

export default function OrganisationSettingsEmailDomains() {
  const { t } = useLingui();
  const { organisations } = useSession();

  const organisation = useCurrentOrganisation();

  const isPersonalLayoutMode = isPersonalLayout(organisations);

  const isEmailDomainsEnabled = true; // Feature flags removed - email domains always available

  return (
    <div>
      <SettingsHeader
        title={t`Email Domains`}
        subtitle={t`Here you can add email domains to your organisation.`}
      >
        {isEmailDomainsEnabled && <OrganisationEmailDomainCreateDialog />}
      </SettingsHeader>

      {isEmailDomainsEnabled && (
        <section>
          <OrganisationEmailDomainsDataTable />
        </section>
      )}
    </div>
  );
}
