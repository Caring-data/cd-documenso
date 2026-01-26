import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

import { Body, Container, Head, Html, Img, Preview, Section } from '../components';
import { useBranding } from '../providers/branding';
import type { TemplateDocumentPendingProps } from '../template-components/template-document-pending';
import { TemplateDocumentPending } from '../template-components/template-document-pending';
import { TemplateFooter } from '../template-components/template-footer';

export type DocumentPendingEmailTemplateProps = Partial<TemplateDocumentPendingProps>;

export const DocumentPendingEmailTemplate = ({
  documentName = 'Open Source Pledge.pdf',
  assetBaseUrl = 'http://localhost:3002',
  signingContext,
  recipientName,
}: DocumentPendingEmailTemplateProps) => {
  const { _ } = useLingui();
  const branding = useBranding();

  const previewText = msg`Pending Document`;

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
            <Container className="mx-auto mb-4 mt-8 max-w-xl rounded-lg border border-solid border-slate-200 bg-white p-6">
              <Section>
                {branding.brandingEnabled && branding.brandingLogo ? (
                  <Img src={branding.brandingLogo} alt="Branding Logo" className="mb-4 h-6" />
                ) : (
                  <div className="mb-6 w-[97%] items-center justify-center gap-1 rounded-md bg-brand px-2 py-4 text-center">
                    <div className="text-center text-white">
                      <Img
                        src={getAssetUrl('/static/clock-white.png')}
                        alt="icon image - clock"
                        className="inline h-8"
                      />
                    </div>
                    <p className="text-center text-lg font-medium text-white">
                      <Trans>Waiting for others</Trans>
                    </p>
                  </div>
                )}

                <TemplateDocumentPending
                  assetBaseUrl={assetBaseUrl}
                  signingContext={signingContext}
                  recipientName={recipientName}
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

export default DocumentPendingEmailTemplate;
