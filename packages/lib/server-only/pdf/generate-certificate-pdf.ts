import { PDFDocument } from '@cantoo/pdf-lib';
import { i18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { Envelope, Field, Recipient, Signature } from '@prisma/client';
import { FieldType } from '@prisma/client';
import { prop, sortBy } from 'remeda';
import { match } from 'ts-pattern';

import { ZSupportedLanguageCodeSchema } from '../../constants/i18n';
import { extractDocumentAuthMethods } from '../../utils/document-auth';
import { getTranslations } from '../../utils/i18n';
import { getDocumentCertificateAuditLogs } from '../document/get-document-certificate-audit-logs';
import { type CertificateRecipient, renderCertificate } from './render-certificate';

// A4 en puntos. Igual que tu llamada anterior a Playwright (`format: 'A4'`).
const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;

// Inferido directamente de tu propia función — nunca se desincroniza,
// no importa qué forma tenga internamente.
type DocumentCertificateAuditLogs = Awaited<ReturnType<typeof getDocumentCertificateAuditLogs>>;

type FieldWithSignature = Pick<Field, 'id' | 'type' | 'secondaryId' | 'recipientId'> & {
  signature?: Pick<
    Signature,
    'signatureImageAsBase64' | 'typedSignature' | 'typedSignatureSettings'
  > | null;
};

export type GenerateCertificatePdfOptions = {
  envelopeId: string;
  /**
   * `authOptions` es el campo Json del Envelope (tipado como
   * `DocumentAuthOptions` vía tu generador zod-prisma). Se pasa tal cual
   * viene de `envelope.authOptions`.
   */
  authOptions: Envelope['authOptions'];
  timezone?: string | null;
  language?: string | null;
  envelopeOwner: {
    name: string;
    email: string;
  };
  /**
   * Pasa la lista de recipients que ya filtras en tu job (sin CC), tal
   * como sale de `prisma.recipient.findMany(...)`.
   */
  recipients: Recipient[];
  /**
   * Pasa los `fields` que ya cargas en tu job vía
   * `prisma.field.findMany({ include: { signature: true } })`.
   */
  fields: FieldWithSignature[];
};

/**
 * Genera el PDF del certificado de firma completamente in-process
 * (Konva + skia-canvas), reemplazando la implementación anterior con
 * Playwright/Chromium. Devuelve un Buffer, mismo shape que
 * `getCertificatePdf(...)` para que sea un reemplazo directo.
 */
export const generateCertificatePdf = async (
  options: GenerateCertificatePdfOptions,
): Promise<Buffer> => {
  const { envelopeId, authOptions, timezone, language, envelopeOwner, recipients, fields } =
    options;

  const documentLanguage = ZSupportedLanguageCodeSchema.parse(language);

  const [auditLogs, messages] = await Promise.all([
    getDocumentCertificateAuditLogs({ envelopeId }),
    getTranslations(documentLanguage),
  ]);

  i18n.loadAndActivate({ locale: documentLanguage, messages });

  const certificateRecipients: CertificateRecipient[] = recipients.map((recipient) => {
    const signatureField = fields.find(
      (field) =>
        field.recipientId === recipient.id &&
        (field.type === FieldType.SIGNATURE || field.type === FieldType.FREE_SIGNATURE),
    );

    const emailSent = findAuditLog(auditLogs, 'EMAIL_SENT', recipient.id);
    const documentOpened = findAuditLog(auditLogs, 'DOCUMENT_OPENED', recipient.id);
    const documentRecipientCompleted = findAuditLog(
      auditLogs,
      'DOCUMENT_RECIPIENT_COMPLETED',
      recipient.id,
    );

    const extractedAuthMethods = extractDocumentAuthMethods({
      documentAuth: authOptions,
      recipientAuth: recipient.authOptions,
    });

    const insertedAuditLogsWithFieldAuth = sortBy(
      (auditLogs.DOCUMENT_FIELD_INSERTED ?? []).filter(
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        (log: any) => log.data?.recipientId === recipient.id && log.data?.fieldSecurity,
      ),
      [prop('createdAt'), 'desc'],
    );

    const actionAuthMethod = insertedAuditLogsWithFieldAuth.at(0)?.data?.fieldSecurity?.type;

    let authLevel = match(actionAuthMethod)
      .with('ACCOUNT', () => i18n._(msg`Account Re-Authentication`))
      .with('TWO_FACTOR_AUTH', () => i18n._(msg`Two-Factor Re-Authentication`))
      .with('PASSWORD', () => i18n._(msg`Password Re-Authentication`))
      .with('EXPLICIT_NONE', () => i18n._(msg`Email`))
      .with(undefined, () => null)
      .otherwise(() => null);

    if (!authLevel) {
      const accessAuthMethod = extractedAuthMethods.derivedRecipientAccessAuth.at(0);

      authLevel = match(accessAuthMethod)
        .with('ACCOUNT', () => i18n._(msg`Account Authentication`))
        .with('TWO_FACTOR_AUTH', () => i18n._(msg`Two-Factor Authentication`))
        .with(undefined, () => i18n._(msg`Email`))
        .otherwise(() => i18n._(msg`Email`));
    }

    return {
      id: recipient.id,
      name: recipient.name,
      email: recipient.email,
      signatureField,
      authLevel,
      logs: {
        emailed: emailSent,
        opened: documentOpened,
        completed: documentRecipientCompleted,
      },
    };
  });

  const pages = await renderCertificate({
    recipients: certificateRecipients,
    envelopeOwner,
    timezone,
    pageWidth: A4_WIDTH_PT,
    pageHeight: A4_HEIGHT_PT,
    i18n,
  });

  return mergePdfPages(pages);
};

/**
 * Busca el log más relevante para un recipient dentro del objeto que
 * devuelve `getDocumentCertificateAuditLogs`. Si tu función devuelve una
 * forma distinta (por ejemplo, ya viene filtrada por recipient, o el
 * bucket se llama distinto), ajusta esta función — es el único punto que
 * necesita conocer la forma real de tus audit logs.
 */
const findAuditLog = (
  auditLogs: DocumentCertificateAuditLogs,
  type: 'EMAIL_SENT' | 'DOCUMENT_OPENED' | 'DOCUMENT_RECIPIENT_COMPLETED',
  recipientId: number,
): { createdAt: Date; ipAddress: string | null } | null => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const bucket = (auditLogs as any)[type] as
    | Array<{
        data?: { recipientId?: number };
        createdAt: Date;
        ipAddress: string | null;
      }>
    | undefined;

  const log = bucket?.find((entry) => entry.data?.recipientId === recipientId);

  return log ? { createdAt: log.createdAt, ipAddress: log.ipAddress } : null;
};

/**
 * skia-canvas nos da un PDF de una sola página por cada `canvas.toBuffer('pdf')`.
 * Los unimos en un único PDF multipágina usando tu dependencia existente
 * de pdf-lib (no hace falta @libpdf/core).
 */
const mergePdfPages = async (pages: Uint8Array[]): Promise<Buffer> => {
  const merged = await PDFDocument.create();

  for (const pageBytes of pages) {
    const source = await PDFDocument.load(pageBytes);
    const copiedPages = await merged.copyPages(source, source.getPageIndices());

    copiedPages.forEach((page) => merged.addPage(page));
  }

  return Buffer.from(await merged.save());
};
