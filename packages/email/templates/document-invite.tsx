import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { RecipientRole } from '@prisma/client';
import { OrganisationType } from '@prisma/client';

import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';

import { Body, Container, Head, Html, Img, Preview, Section, Text } from '../components';
import { useBranding } from '../providers/branding';
import type { TemplateDocumentInviteProps } from '../template-components/template-document-invite';
import { TemplateDocumentInvite } from '../template-components/template-document-invite';
import { TemplateFooter } from '../template-components/template-footer';

export type DocumentInviteEmailTemplateProps = Partial<TemplateDocumentInviteProps> & {
  inviterName?: string;
  inviterEmail?: string;
  documentName?: string;
  customBody?: string;
  role: RecipientRole;
  selfSigner?: boolean;
  teamName?: string;
  teamEmail?: string;
  includeSenderDetails?: boolean;
  organisationType?: OrganisationType;
  recipientName?: string;
  signingContext?: {
    companyName?: string;
    facilityAdministrator?: string;
    documentName?: string;
    ownerName?: string;
    locationName?: string;
  };
  tokenExpiration?: Date | string | undefined;
};

export const DocumentInviteEmailTemplate = ({
  inviterName = 'Lucas Smith',
  inviterEmail = 'lucas@documenso.com',
  documentName = 'Open Source Pledge.pdf',
  signDocumentLink = 'https://documenso.com',
  assetBaseUrl = 'http://localhost:3002',
  customBody,
  role,
  selfSigner = false,
  teamName = '',
  includeSenderDetails,
  organisationType,
  recipientName,
  signingContext,
  tokenExpiration,
}: DocumentInviteEmailTemplateProps) => {
  const { _ } = useLingui();
  const branding = useBranding();

  const action = _(RECIPIENT_ROLES_DESCRIPTION[role].actionVerb).toLowerCase();

  let previewText = msg`${inviterName} has invited you to ${action} ${documentName}`;

  if (organisationType === OrganisationType.ORGANISATION) {
    previewText = includeSenderDetails
      ? msg`${inviterName} on behalf of "${teamName}" has invited you to ${action} ${documentName}`
      : msg`${teamName} has invited you to ${action} ${documentName}`;
  }

  if (selfSigner) {
    previewText = msg`Please ${action} your document ${documentName}`;
  }

  const getAssetUrl = (path: string) => {
    return new URL(path, assetBaseUrl).toString();
  };

  return (
    <Html>
      <Head />
      <Preview>{_(previewText)}</Preview>

      <Body className="mx-auto my-auto bg-white font-sans">
        <div className="flex w-full flex-col items-center justify-center gap-6 rounded-lg bg-zinc-50 p-6">
          <Section>
            <Container className="mt-8 mb-4 w-full items-center justify-center rounded-lg border border-solid border-slate-200 bg-white p-6 backdrop-blur-sm">
              <Section>
                {branding.brandingEnabled && branding.brandingLogo ? (
                  <Img src={branding.brandingLogo} alt="Branding Logo" className="mb-4 h-6" />
                ) : (
                  <div className="bg-brand mb-6 w-[97%] items-center justify-center gap-1 rounded-md px-2 py-4 text-center">
                    <div className="text-center text-white">
                      <Img
                        src={getAssetUrl('/static/file-pen-line-white.png')}
                        alt="icon image - file pen line"
                        className="inline h-8"
                      />
                    </div>
                    <Text className="text-center text-lg font-medium text-white">
                      <Trans>You are invited to sign a document</Trans>
                    </Text>
                  </div>
                )}

                <TemplateDocumentInvite
                  inviterEmail={inviterEmail}
                  signDocumentLink={signDocumentLink}
                  assetBaseUrl={assetBaseUrl}
                  role={role}
                  recipientName={recipientName}
                  signingContext={signingContext}
                  tokenExpiration={tokenExpiration}
                  customBody={customBody}
                />
              </Section>
            </Container>

            <TemplateFooter companyName={signingContext?.companyName || ''} />
          </Section>
        </div>
      </Body>
    </Html>
  );
};

export default DocumentInviteEmailTemplate;
