import { Trans } from '@lingui/react/macro';

import { Container, Section, Text } from '../components';

interface TemplateDocumentRejectionConfirmedProps {
  reason?: string;
  signingContext?: {
    companyName?: string;
    facilityAdministrator?: string;
    documentName?: string;
    ownerName?: string;
    locationName?: string;
  };
}

export function TemplateDocumentRejectionConfirmed({
  reason,
  signingContext,
}: TemplateDocumentRejectionConfirmedProps) {
  return (
    <Container>
      <Section>
        <Text className="text-base text-primary">
          <Trans>
            This email confirms that you have rejected the document{' '}
            <strong className="font-bold">"{signingContext?.documentName}"</strong> sent by{' '}
            {signingContext?.facilityAdministrator}.
          </Trans>
        </Text>

        {reason && (
          <Text className="text-base font-medium text-slate-400">
            <Trans>Rejection reason: {reason}</Trans>
          </Text>
        )}

        <Text className="text-base">
          <Trans>
            The document owner has been notified of this rejection. No further action is required
            from you at this time. The document owner may contact you with any questions regarding
            this rejection.
          </Trans>
        </Text>
      </Section>
    </Container>
  );
}
