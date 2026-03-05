import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { RecipientRole } from '@prisma/client';
import { match } from 'ts-pattern';

import { Button, Img, Section, Text } from '../components';

export interface TemplateDocumentInviteProps {
  inviterEmail: string;
  signDocumentLink: string;
  assetBaseUrl: string;
  role: RecipientRole;
  recipientName?: string;
  signingContext?: {
    companyName?: string;
    facilityAdministrator?: string;
    documentName?: string;
    ownerName?: string;
    locationName?: string;
  };
  tokenExpiration?: Date | string | undefined;
  customBody?: string;
}

export const TemplateDocumentInvite = ({
  signDocumentLink,
  assetBaseUrl,
  role,
  recipientName,
  signingContext,
  tokenExpiration,
  customBody,
}: TemplateDocumentInviteProps) => {
  const { _ } = useLingui();

  const getAssetUrl = (path: string) => {
    return new URL(path, assetBaseUrl).toString();
  };

  return (
    <>
      <Section className="flex flex-col gap-6">
        {match(role)
          .with(RecipientRole.SIGNER, () => (
            <>
              <Text className="self-stretch text-sm font-medium leading-5 text-zinc-600">
                <Trans>Dear </Trans> {recipientName},
              </Text>
              {customBody ? (
                <>
                  <Text className="text-sm font-medium leading-5 text-zinc-600">{customBody}</Text>
                </>
              ) : (
                <>
                  <Text className="text-sm font-medium leading-5 text-zinc-600">
                    <Trans>
                      <span className="font-semibold">{signingContext?.facilityAdministrator}</span>{' '}
                      from <span className="font-semibold">{signingContext?.locationName}</span> has
                      requested your electronic signature on the following document:
                    </Trans>
                  </Text>
                  <div className="flex items-center gap-6">
                    <Img
                      src={getAssetUrl('/static/user-round.png')}
                      alt="Document Icon"
                      className="my-auto h-4 w-auto pr-2 align-middle"
                    />
                    <div className="flex flex-col text-sm font-medium leading-5 text-zinc-600">
                      <Text>
                        <Trans>Regarding: {signingContext?.ownerName}</Trans>
                      </Text>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <Img
                      src={getAssetUrl('/static/file-text.png')}
                      alt="Document Icon"
                      className="my-auto h-4 w-auto pr-2 align-middle"
                    />
                    <div className="flex flex-col justify-center text-sm font-medium leading-5 text-zinc-600">
                      <Text>
                        <Trans>Document: {signingContext?.documentName}</Trans>
                      </Text>
                    </div>
                  </div>
                </>
              )}
              <Text className="text-xs font-medium leading-5 text-zinc-600">
                <Trans>
                  Ready to get started?
                  <br />
                  Click the button below to review and sign the document.
                </Trans>
              </Text>
            </>
          ))
          .otherwise(() => null)}
      </Section>

      <Section className="mb-4 mt-8 text-center">
        <Button
          className="inline-flex items-center justify-center rounded-lg bg-brand px-6 py-3 text-center text-sm font-medium text-white no-underline"
          href={signDocumentLink}
        >
          {match(role)
            .with(RecipientRole.SIGNER, () => <Trans>Accept Invite and Sign</Trans>)
            .with(RecipientRole.VIEWER, () => <Trans>View Document</Trans>)
            .with(RecipientRole.APPROVER, () => <Trans>View Document to approve</Trans>)
            .with(RecipientRole.CC, () => '')
            .with(RecipientRole.ASSISTANT, () => <Trans>View Document to assist</Trans>)
            .exhaustive()}
        </Button>
      </Section>
      <Text className="text-center text-xs font-medium leading-4 text-red-600">
        <Trans>
          This link is valid until{' '}
          {tokenExpiration ? new Date(tokenExpiration).toLocaleDateString('en-US') : 'N/A'}.
          <br />
          If the process is disabled, please contact Administrator to send the document again.
        </Trans>
      </Text>
    </>
  );
};

export default TemplateDocumentInvite;
