import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';

import { Body, Container, Head, Html, Img, Preview, Section } from '../components';
import { useBranding } from '../providers/branding';
import { TemplateDocumentRejectionConfirmed } from '../template-components/template-document-rejection-confirmed';
import { TemplateFooter } from '../template-components/template-footer';

export type DocumentRejectionConfirmedEmailProps = {
  documentName: string;
  reason: string;
  signingContext?: {
    companyName?: string;
    facilityAdministrator?: string;
    documentName?: string;
    ownerName?: string;
    locationName?: string;
  };
};

export function DocumentRejectionConfirmedEmail({
  documentName,
  reason,
  signingContext,
}: DocumentRejectionConfirmedEmailProps) {
  const { _ } = useLingui();
  const branding = useBranding();

  const previewText = _(msg`You have rejected the document '${documentName}'`);

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>

      <Body className="mx-auto my-auto bg-white font-sans">
        <div className="flex flex-col items-center justify-center gap-6 rounded-lg bg-zinc-50 p-6">
          <Section>
            <Container className="mx-auto mb-2 mt-8 max-w-xl rounded-lg border border-solid border-slate-200 bg-white p-6">
              <Section>
                {branding.brandingEnabled && branding.brandingLogo ? (
                  <Img src={branding.brandingLogo} alt="Branding Logo" className="mb-4 h-6" />
                ) : (
                  <div className="mb-6 w-[97%] items-center justify-center gap-2 rounded-md bg-brand px-2 py-4">
                    <p className="text-center text-lg font-medium text-white">
                      Rejection Confirmed
                    </p>
                  </div>
                )}

                <TemplateDocumentRejectionConfirmed
                  reason={reason}
                  signingContext={signingContext}
                />
              </Section>
            </Container>

            <TemplateFooter companyName={signingContext?.companyName || ''} />
          </Section>
        </div>
      </Body>
    </Html>
  );
}

export default DocumentRejectionConfirmedEmail;
