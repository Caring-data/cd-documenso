import { Trans } from '@lingui/react/macro';

import { Section, Text } from '../components';

export interface TemplateDocumentRecipientSignedProps {
  recipientName: string;
  recipientEmail: string;
  signingContext?: {
    companyName?: string;
    facilityAdministrator?: string;
    documentName?: string;
    ownerName?: string;
    locationName?: string;
  };
}

export const TemplateDocumentRecipientSigned = ({
  recipientName,
  recipientEmail,
  signingContext,
}: TemplateDocumentRecipientSignedProps) => {
  const recipientReference = recipientName || recipientEmail;

  return (
    <Section>
      <Text className="mb-0 text-center text-lg font-semibold text-primary">
        <Trans>
          {recipientReference} has signed "{signingContext?.documentName}"
        </Trans>
      </Text>

      <Text className="text-xs font-medium leading-5 text-zinc-600">
        <Trans>{recipientReference} has completed signing the document.</Trans>
      </Text>
    </Section>
  );
};

export default TemplateDocumentRecipientSigned;
