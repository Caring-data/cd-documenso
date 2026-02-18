import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { EnvelopeType, FieldType } from '@prisma/client';
import { DateTime } from 'luxon';
import { redirect } from 'react-router';
import { prop, sortBy } from 'remeda';
import { match } from 'ts-pattern';
import { UAParser } from 'ua-parser-js';
import z from 'zod';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { ZSupportedLanguageCodeSchema } from '@documenso/lib/constants/i18n';
import { unsafeGetEntireEnvelope } from '@documenso/lib/server-only/admin/get-entire-document';
import { decryptSecondaryData } from '@documenso/lib/server-only/crypto/decrypt';
import { getDocumentCertificateAuditLogs } from '@documenso/lib/server-only/document/get-document-certificate-audit-logs';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';
import { getTranslations } from '@documenso/lib/utils/i18n';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@documenso/ui/primitives/table';

import type { Route } from './+types/certificate';

const ZTypedSignatureSettings = z
  .object({
    font: z.string().optional(),
    color: z.string().optional(),
  })
  .nullable()
  .optional();

export async function loader({ request }: Route.LoaderArgs) {
  const d = new URL(request.url).searchParams.get('d');

  if (typeof d !== 'string' || !d) {
    throw redirect('/');
  }

  const rawDocumentId = decryptSecondaryData(d);

  if (!rawDocumentId || isNaN(Number(rawDocumentId))) {
    throw redirect('/');
  }

  const documentId = Number(rawDocumentId);

  const envelope = await unsafeGetEntireEnvelope({
    id: {
      type: 'documentId',
      id: documentId,
    },
    type: EnvelopeType.DOCUMENT,
  }).catch(() => null);

  if (!envelope) {
    throw redirect('/');
  }

  // Feature flags removed - all features always available

  const documentLanguage = ZSupportedLanguageCodeSchema.parse(envelope.documentMeta?.language);

  const auditLogs = await getDocumentCertificateAuditLogs({
    envelopeId: envelope.id,
  });

  const messages = await getTranslations(documentLanguage);

  return {
    document: {
      id: mapSecondaryIdToDocumentId(envelope.secondaryId),
      title: envelope.title,
      status: envelope.status,
      user: {
        name: envelope.user.name,
        email: envelope.user.email,
      },
      qrToken: envelope.qrToken,
      authOptions: envelope.authOptions,
      recipients: envelope.recipients,
      createdAt: envelope.createdAt,
      updatedAt: envelope.updatedAt,
      deletedAt: envelope.deletedAt,
      documentMeta: envelope.documentMeta,
    },
    hidePoweredBy: false, // Feature flags removed
    documentLanguage,
    auditLogs,
    messages,
  };
}

/**
/**
 * DO NOT USE TRANS. YOU MUST USE _ FOR THIS FILE AND ALL CHILDREN COMPONENTS.
 *
 * Cannot use dynamicActivate by itself to translate this specific page and all
 * children components because `not-found.tsx` page runs and overrides the i18n.
 *
 * Update: Maybe <Trans> tags work now after RR7 migration.
 */
export default function SigningCertificate({ loaderData }: Route.ComponentProps) {
  const {
    document,
    documentLanguage,
    hidePoweredBy: _hidePoweredBy,
    auditLogs,
    messages,
  } = loaderData;

  const { i18n, _ } = useLingui();

  i18n.loadAndActivate({ locale: documentLanguage, messages });

  const _isOwner = (email: string) => {
    return email.toLowerCase() === document.user.email.toLowerCase();
  };

  const _getDevice = (userAgent?: string | null) => {
    if (!userAgent) {
      return 'Unknown';
    }

    const parser = new UAParser(userAgent);

    parser.setUA(userAgent);

    const result = parser.getResult();

    return `${result.os.name} - ${result.browser.name} ${result.browser.version}`;
  };

  const getAuthenticationLevel = (recipientId: number) => {
    const recipient = document.recipients.find((recipient) => recipient.id === recipientId);

    if (!recipient) {
      return 'Unknown';
    }

    const extractedAuthMethods = extractDocumentAuthMethods({
      documentAuth: document.authOptions,
      recipientAuth: recipient.authOptions,
    });

    const insertedAuditLogsWithFieldAuth = sortBy(
      auditLogs.DOCUMENT_FIELD_INSERTED.filter(
        (log) => log.data.recipientId === recipient.id && log.data.fieldSecurity,
      ),
      [prop('createdAt'), 'desc'],
    );

    const actionAuthMethod = insertedAuditLogsWithFieldAuth.at(0)?.data?.fieldSecurity?.type;

    let authLevel = match(actionAuthMethod)
      .with('ACCOUNT', () => _(msg`Account Re-Authentication`))
      .with('TWO_FACTOR_AUTH', () => _(msg`Two-Factor Re-Authentication`))
      .with('PASSWORD', () => _(msg`Password Re-Authentication`))
      .with('EXPLICIT_NONE', () => _(msg`Email`))
      .with(undefined, () => null)
      .exhaustive();

    if (!authLevel) {
      const accessAuthMethod = extractedAuthMethods.derivedRecipientAccessAuth.at(0);

      authLevel = match(accessAuthMethod)
        .with('ACCOUNT', () => _(msg`Account Authentication`))
        .with('TWO_FACTOR_AUTH', () => _(msg`Two-Factor Authentication`))
        .with(undefined, () => _(msg`Email`))
        .exhaustive();
    }

    return authLevel;
  };

  const getRecipientAuditLogs = (recipientId: number) => {
    return {
      [DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT]: auditLogs[DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT].filter(
        (log) =>
          log.type === DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT && log.data.recipientId === recipientId,
      ),
      [DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_SENT]: auditLogs[
        DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_SENT
      ].filter((log) => log.type === DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_SENT),
      [DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_OPENED]: auditLogs[
        DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_OPENED
      ].filter(
        (log) =>
          log.type === DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_OPENED &&
          log.data.recipientId === recipientId,
      ),
      [DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED]: auditLogs[
        DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED
      ].filter(
        (log) =>
          log.type === DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED &&
          log.data.recipientId === recipientId,
      ),
      [DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_REJECTED]: auditLogs[
        DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_REJECTED
      ].filter(
        (log) =>
          log.type === DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_REJECTED &&
          log.data.recipientId === recipientId,
      ),
    };
  };

  const getRecipientSignatureField = (recipientId: number) => {
    return document.recipients
      .find((recipient) => recipient.id === recipientId)
      ?.fields.find(
        (field) => field.type === FieldType.SIGNATURE || field.type === FieldType.FREE_SIGNATURE,
      );
  };

  const getAssetUrl = (path: string) => {
    return new URL(path, NEXT_PUBLIC_WEBAPP_URL()).toString();
  };

  const backgroundUrl = getAssetUrl('/static/background-certificate.png');

  const getFinalCompletionDate = () => {
    const allCompletionDates: Date[] = [];

    for (const recipient of document.recipients) {
      const log = auditLogs[DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED].find(
        (log) => log.data.recipientId === recipient.id,
      );

      if (log?.createdAt instanceof Date) {
        allCompletionDates.push(log.createdAt);
      }
    }

    if (allCompletionDates.length !== document.recipients.length) {
      return null;
    }

    return allCompletionDates.reduce((latest, current) => (current > latest ? current : latest));
  };

  const formatDateWithTimezone = (
    date: Date | null | undefined,
    fallbackZone: string = DateTime.local().zoneName ?? 'UTC',
    timezone: string | null | undefined = null,
  ): string => {
    if (!date) {
      return 'Unknown';
    }

    const zoneToUse = timezone ?? fallbackZone;

    return DateTime.fromJSDate(date).setZone(zoneToUse).toFormat('dd LLL yyyy hh:mm:ss a (ZZZZ)');
  };

  const isTypedSignatureSettings = (
    settings: unknown,
  ): settings is { font?: string; color?: string } => {
    return (
      typeof settings === 'object' &&
      settings !== null &&
      ('font' in settings || 'color' in settings)
    );
  };

  return (
    <div
      className="relative min-h-[100vh] w-full bg-cover bg-center bg-no-repeat print:overflow-hidden"
      style={{ backgroundImage: `url('${backgroundUrl}')` }}
    >
      <div className="print-provider pointer-events-none w-full print:mx-0 print:w-full print:max-w-none print:p-0">
        <div className="m-3 flex min-h-[calc(100vh-24px)] flex-col justify-between border border-brand p-5 print:m-3 print:min-h-[calc(100vh-24px)] print:p-5">
          <div className="flex-1">
            <div className="mb-12 mt-12 flex items-center justify-center">
              <h1 className="flex h-6 w-full flex-col justify-center text-2xl font-bold leading-4 text-brand">
                {_(msg`Signature Certificate`)}
              </h1>
            </div>

            <Table className="w-full border-collapse border-0" overflowHidden>
              <TableHeader>
                <TableRow className="border-b border-zinc-200">
                  <TableHead className="w-1/3 text-sm font-semibold leading-4 text-brand print:text-xs">
                    {_(msg`Signer Events`)}
                  </TableHead>
                  <TableHead className="w-1/3 text-sm font-semibold leading-4 text-brand print:text-xs">
                    {_(msg`Timestamp`)}
                  </TableHead>
                  <TableHead className="w-1/3 text-sm font-semibold leading-4 text-brand print:text-xs">
                    {_(msg`Signature`)}
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="print:text-xs">
                {document.recipients.map((recipient, i) => {
                  const logs = getRecipientAuditLogs(recipient.id);
                  const signature = getRecipientSignatureField(recipient.id);

                  return (
                    <TableRow
                      key={i}
                      className="h-[1px] border-b border-zinc-200 print:break-inside-avoid"
                    >
                      <TableCell
                        truncate={false}
                        className="w-[min-content] max-w-[220px] align-top"
                      >
                        <div className="hyphens-auto break-words text-sm font-semibold leading-4 text-zinc-700 print:text-xs">
                          {recipient.name}
                        </div>
                        <div className="break-all text-sm font-medium leading-4 text-zinc-600 print:text-xs">
                          Email: {recipient.email}
                        </div>
                        <div className="mt-2 space-y-1 text-sm text-zinc-700 print:text-xs">
                          <p>
                            <span className="font-medium">{_(msg`Sent`)}:</span>
                          </p>
                          <p>
                            <span className="font-medium">{_(msg`Viewed`)}:</span>
                          </p>
                          <p>
                            <span className="font-medium">{_(msg`Signed`)}:</span>
                          </p>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground print:text-xs">
                          <span className="font-medium">{_(msg`Recipient Verification`)}:</span>{' '}
                          <span className="flex items-center gap-1 text-[10px] font-medium leading-[18px] text-[#16A34A]">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 16 16"
                              fill="none"
                            >
                              <path
                                d="M13.3334 4L6.00008 11.3333L2.66675 8"
                                stroke="#16A34A"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            {getAuthenticationLevel(recipient.id)} {_(msg`Verified`)}
                          </span>
                        </p>
                      </TableCell>

                      <TableCell truncate={false} className="w-[min-content] align-top">
                        <p className="invisible text-sm leading-4 print:text-xs">Placeholder</p>
                        <p className="invisible text-sm leading-4 print:text-xs">Placeholder</p>
                        <div className="mt-2 space-y-1">
                          <p className="text-sm text-muted-foreground print:text-xs">
                            <span className="inline-block">
                              {formatDateWithTimezone(
                                logs.EMAIL_SENT[0]?.createdAt || logs.DOCUMENT_SENT[0]?.createdAt,
                                undefined,
                                document.documentMeta?.timezone,
                              )}
                            </span>
                          </p>

                          <p className="text-sm text-muted-foreground print:text-xs">
                            <span className="inline-block">
                              {formatDateWithTimezone(
                                logs.DOCUMENT_OPENED[0]?.createdAt,
                                undefined,
                                document.documentMeta?.timezone,
                              )}
                            </span>
                          </p>

                          <p className="text-sm text-muted-foreground print:text-xs">
                            <span className="inline-block">
                              {formatDateWithTimezone(
                                logs.DOCUMENT_RECIPIENT_COMPLETED[0]?.createdAt,
                                undefined,
                                document.documentMeta?.timezone,
                              )}
                            </span>
                          </p>
                        </div>
                      </TableCell>

                      <TableCell truncate={false} className="align-top">
                        {signature ? (
                          <>
                            <div className="flex h-[73px] w-full items-center justify-center rounded-sm border border-zinc-200 bg-white p-1">
                              {signature.signature?.signatureImageAsBase64 && (
                                <img
                                  src={`${signature.signature?.signatureImageAsBase64}`}
                                  alt="Signature"
                                  className="max-h-12 max-w-full object-contain"
                                />
                              )}

                              {signature.signature?.typedSignature &&
                                (() => {
                                  const parsed = ZTypedSignatureSettings.safeParse(
                                    signature.signature?.typedSignatureSettings,
                                  );
                                  const settings = parsed.success ? parsed.data : undefined;

                                  return (
                                    <p
                                      className="text-center text-sm print:text-xs"
                                      style={{
                                        fontFamily: settings?.font || 'Dancing Script',
                                        color: settings?.color || 'black',
                                      }}
                                    >
                                      {signature.signature.typedSignature}
                                    </p>
                                  );
                                })()}
                            </div>

                            <p className="mt-2 flex h-4 flex-col justify-center self-stretch">
                              <span className="text-sm font-medium leading-4 text-zinc-600 print:text-xs">
                                {_(msg`IP address`)}:
                              </span>{' '}
                              <span className="text-sm font-normal leading-4 text-zinc-600 print:text-xs">
                                {logs.DOCUMENT_RECIPIENT_COMPLETED[0]?.ipAddress ?? _(msg`Unknown`)}
                              </span>
                            </p>
                          </>
                        ) : (
                          <p className="text-muted-foreground">N/A</p>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="mb-9 flex items-start gap-4">
            <div className="flex h-[60px] w-[60px] flex-shrink-0 items-center justify-center rounded-full bg-white">
              <img
                src={getAssetUrl('/static/logo-bg-white.png')}
                alt="Logo - Caring Data"
                className="h-9 w-auto pt-1"
              />
            </div>

            <div className="text-sm font-medium leading-[18px] text-zinc-700 print:text-xs">
              <p>{_(msg`Document Completed by all parties on`)}:</p>
              <p>
                {(() => {
                  const finalDate = getFinalCompletionDate();
                  const fallbackZone = DateTime.local().zoneName ?? 'UTC';
                  const docTimezone = document.documentMeta?.timezone ?? fallbackZone;

                  return finalDate
                    ? DateTime.fromJSDate(finalDate)
                        .setZone(docTimezone)
                        .toFormat('dd LLL yyyy hh:mm:ss a (ZZZZ)')
                    : _(msg`Unknown`);
                })()}
              </p>
              <p>
                {_(msg`Page`)} 1 {_(msg`of`)} 1
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
