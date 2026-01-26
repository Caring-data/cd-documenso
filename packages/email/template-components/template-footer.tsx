import { Trans } from '@lingui/react/macro';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';

import { Container, Img, Link, Section, Text } from '../components';
import { useBranding } from '../providers/branding';

export type TemplateFooterProps = {
  isDocument?: boolean;
  companyName?: string;
};

export const TemplateFooter = ({ isDocument = true, companyName = '' }: TemplateFooterProps) => {
  const branding = useBranding();

  const getAssetUrl = (path: string) => {
    const baseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3002';
    return new URL(path, baseUrl).toString();
  };

  return (
    <div className="gap-6">
      <Container className="mx-auto max-w-xl items-center justify-center gap-2 self-stretch rounded-lg border border-slate-200 bg-white px-6 py-4">
        <Section>
          {isDocument && !branding.brandingHidePoweredBy && (
            <Text className="my-4 text-center text-xs font-medium leading-4 text-zinc-500">
              <Trans>
                <span className="font-medium text-brand-accent">Caring Data</span> is a secure
                platform used by{' '}
                <span className="font-medium text-brand-accent">{companyName}</span> to manage
                communication and documentation. We prioritize your privacy and security. For more
                details, please review our{' '}
                <Link
                  className="text-brand-accent underline decoration-solid decoration-auto underline-offset-auto"
                  href="https://home.caringdata.com/index.php/privacy-policy/"
                >
                  Privacy Statement
                </Link>
              </Trans>
            </Text>
          )}

          {branding.brandingEnabled && branding.brandingCompanyDetails && (
            <Text className="my-8 text-sm text-slate-400">
              {branding.brandingCompanyDetails.split('\n').map((line, idx) => {
                return (
                  <>
                    {idx > 0 && <br />}
                    {line}
                  </>
                );
              })}
            </Text>
          )}

          {!branding.brandingEnabled && (
            <div className="w-full items-center justify-center text-center">
              <Text className="font-montserrat text-xs font-medium text-zinc-500">
                Visit{' '}
                <a
                  href="https://rise.caringdata.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-brand-accent"
                >
                  www.caringdata.com
                </a>{' '}
                to learn more.
                <br />
                <span className="font-montserrat text-[10px] font-medium text-zinc-500">
                  2025 Caring Data, LLC. All rights reserved.
                </span>
              </Text>
              {branding.brandingEnabled && branding.brandingLogo && (
                <Img src={branding.brandingLogo} alt="Logo - Caring Data" className="mb-4 h-6" />
              )}
              <div className="text-center text-white">
                <Img
                  src={getAssetUrl('/static/logo-bg-white.png')}
                  alt="Logo - Caring Data"
                  className="inline h-8"
                />
              </div>
            </div>
          )}
        </Section>
      </Container>
      <Container className="mx-auto mt-4 max-w-xl gap-1 self-stretch rounded-lg border border-slate-200 bg-white px-6 py-2">
        {isDocument && !branding.brandingHidePoweredBy && (
          <>
            <Text className="font-montserrat text-xs text-zinc-600">
              <Trans>
                This document was sent using{' '}
                <Link
                  className="font-medium text-brand-accent underline"
                  href="https://documen.so/mail-footer"
                >
                  Documenso
                </Link>
                .
              </Trans>
            </Text>
          </>
        )}
        {!branding.brandingEnabled && (
          <Text className="font-montserrat text-xs text-zinc-600">
            Documenso, Inc.
            <br />
            2261 Market Street, #5211, San Francisco, CA 94114, USA
          </Text>
        )}
      </Container>
    </div>
  );
};

export default TemplateFooter;
