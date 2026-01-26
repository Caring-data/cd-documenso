import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { RecipientRole } from '@prisma/client';

import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';

import { Body, Button, Container, Head, Html, Img, Preview, Section, Text } from '../components';
import { useBranding } from '../providers/branding';
import TemplateDocumentImage from '../template-components/template-document-image';
import { TemplateFooter } from '../template-components/template-footer';

export type DocumentCompletedEmailTemplateProps = {
  recipientName?: string;
  recipientRole?: RecipientRole;
  documentLink?: string;
  documentName?: string;
  assetBaseUrl?: string;
  signingContext?: {
    companyName?: string;
    facilityAdministrator?: string;
    documentName?: string;
    ownerName?: string;
    locationName?: string;
  };
};

export const DocumentCreatedFromDirectTemplateEmailTemplate = ({
  recipientName = 'John Doe',
  recipientRole = RecipientRole.SIGNER,
  documentLink = 'http://localhost:3002',
  documentName = 'Open Source Pledge.pdf',
  assetBaseUrl = 'http://localhost:3002',
  signingContext,
}: DocumentCompletedEmailTemplateProps) => {
  const { _ } = useLingui();
  const branding = useBranding();

  const action = _(RECIPIENT_ROLES_DESCRIPTION[recipientRole].actioned).toLowerCase();

  const previewText = msg`Document created from direct template`;

  const getAssetUrl = (path: string) => {
    return new URL(path, assetBaseUrl).toString();
  };

  return (
    <Html>
      <Head />
      <Preview>{_(previewText)}</Preview>

      <Body className="mx-auto my-auto bg-white font-sans">
        <div className="flex flex-col items-center justify-center gap-6 rounded-lg bg-zinc-50 p-6">
          <Section>
            <Container className="mx-auto mb-2 mt-8 max-w-xl rounded-lg border border-solid border-slate-200 bg-white p-6">
              <Section>
                {branding.brandingEnabled && branding.brandingLogo ? (
                  <Img src={branding.brandingLogo} alt="Branding Logo" className="mb-4 h-6" />
                ) : (
                  <Img
                    src={getAssetUrl('/static/logo.png')}
                    alt="Documenso Logo"
                    className="mb-4 h-6"
                  />
                )}

                <TemplateDocumentImage className="mt-6" assetBaseUrl={assetBaseUrl} />

                <Section>
                  <Text className="mb-0 text-center text-lg font-semibold text-primary">
                    <Trans>
                      {recipientName} {action} a document by using one of your direct links
                    </Trans>
                  </Text>

                  <div className="mx-auto my-2 w-fit rounded-lg bg-gray-50 px-4 py-2 text-sm text-slate-600">
                    {documentName}
                  </div>

                  <Section className="my-6 text-center">
                    <Button
                      className="inline-flex items-center justify-center rounded-lg bg-documenso-500 px-6 py-3 text-center text-sm font-medium text-black no-underline"
                      href={documentLink}
                    >
                      <Trans>View document</Trans>
                    </Button>
                  </Section>
                </Section>
              </Section>
            </Container>

            <TemplateFooter companyName={signingContext?.companyName || ''} />
          </Section>
        </div>
      </Body>
    </Html>
  );
};

export default DocumentCreatedFromDirectTemplateEmailTemplate;
