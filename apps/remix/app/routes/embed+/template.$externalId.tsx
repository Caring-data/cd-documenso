import type { TEnvelope } from '@documenso/lib/types/envelope';
import { TrpcProvider } from '@documenso/trpc/react';
import { getTemplateByExternalId } from '@documenso/trpc/server/template-router/get-template-by-external-id';

import type { Route } from './+types/template.$externalId';
import { Client } from './components/client';

export async function loader({ params }: Route.LoaderArgs) {
  const { externalId } = params;

  if (!externalId) {
    throw new Response('Not Found', { status: 404 });
  }

  const result = await getTemplateByExternalId(externalId);

  return {
    envelopeId: result.envelopeId,
    externalId: result.externalId,
    initialEnvelope: result.initialEnvelope as unknown as TEnvelope,
    teamId: result.teamId,
  };
}

export default function EmbedTemplatePage({ loaderData }: Route.ComponentProps) {
  const { envelopeId, externalId, initialEnvelope, teamId } = loaderData;

  const trpcHeaders = teamId
    ? {
        'x-team-id': teamId.toString(),
      }
    : undefined;

  return (
    <TrpcProvider headers={trpcHeaders}>
      <Client
        envelopeId={envelopeId}
        externalId={externalId}
        initialEnvelope={initialEnvelope as unknown as TEnvelope}
      />
    </TrpcProvider>
  );
}
