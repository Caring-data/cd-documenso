import type { I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { Field, Signature } from '@prisma/client';
import Konva from 'konva';
import 'konva/skia-backend';
import { DateTime } from 'luxon';
import fs from 'node:fs';
import path from 'node:path';
import type { Canvas } from 'skia-canvas';
import { Image as SkiaImage } from 'skia-canvas';

import { ensureFontLibrary } from './helpers';

// ---- Design tokens -------------------------------------------------------
// TODO: reemplaza por tu color de marca real (equivalente a tus clases
// Tailwind `text-brand` / `border-brand`).
const BRAND_COLOR = '#0F172A';
const TEXT_MUTED = '#71717a'; // zinc-500-ish, equivalente a text-zinc-600/700
const VERIFIED_GREEN = '#16A34A';
const BORDER_COLOR = '#e4e4e7'; // zinc-200

const FONT_FAMILY = 'Inter';
const TEXT_SM = 9;
const TEXT_XS = 8;
const FONT_MEDIUM = '500';
const FONT_BOLD = '700';

const PAGE_MARGIN = 20; // margen exterior, equivalente a tu `m-3`
const CONTENT_PADDING = 20; // equivalente a tu `p-5`
const columnWidthPercentages = [33.33, 33.33, 33.34]; // Signer Events / Timestamp / Signature
const rowVerticalPadding = 16;
const tableHeaderHeight = 24;
// -----------------------------------------------------------------------

// No dependemos de ningún tipo de schema de audit log externo — solo de
// los dos campos que realmente usamos. Esto evita el problema de
// `TDocumentAuditLogBaseSchema` no existiendo en tu repo: no lo
// necesitamos en absoluto.
type BaseAuditLog = {
  createdAt: Date;
  ipAddress: string | null;
};

export type CertificateRecipient = {
  id: number;
  name: string;
  email: string;
  authLevel: string;
  signatureField?: Pick<Field, 'id'> & {
    signature?: Pick<
      Signature,
      'signatureImageAsBase64' | 'typedSignature' | 'typedSignatureSettings'
    > | null;
  };
  logs: {
    emailed: BaseAuditLog | null;
    opened: BaseAuditLog | null;
    completed: BaseAuditLog | null;
  };
};

export type RenderCertificateOptions = {
  recipients: CertificateRecipient[];
  envelopeOwner: { name: string; email: string };
  timezone?: string | null;
  pageWidth: number;
  pageHeight: number;
  i18n: I18n;
};

const formatDateWithTimezone = (
  date: Date | null | undefined,
  timezone: string | null | undefined,
  i18n: I18n,
): string => {
  if (!date) {
    return i18n._(msg`Unknown`);
  }

  const zone = timezone ?? DateTime.local().zoneName ?? 'UTC';

  return DateTime.fromJSDate(date).setZone(zone).toFormat('dd LLL yyyy hh:mm:ss a (ZZZZ)');
};

const getSignatureFontFamily = (typedSignature?: string | null) => 'Dancing Script';

const parseTypedSignatureSettings = (
  settings: unknown,
): { font?: string; color?: string } | undefined => {
  if (
    typeof settings === 'object' &&
    settings !== null &&
    ('font' in settings || 'color' in settings)
  ) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return settings as { font?: string; color?: string };
  }

  return undefined;
};

// ---- Small building blocks ------------------------------------------------

const renderTableHeader = (columnWidths: [number, number, number], i18n: I18n) => {
  const header = new Konva.Group();

  const labels = [i18n._(msg`Signer Events`), i18n._(msg`Timestamp`), i18n._(msg`Signature`)];

  let x = 0;

  labels.forEach((label, index) => {
    header.add(
      new Konva.Text({
        x,
        y: 0,
        width: columnWidths[index],
        text: label,
        fontFamily: FONT_FAMILY,
        fontSize: TEXT_SM,
        fontStyle: FONT_MEDIUM,
        fill: BRAND_COLOR,
        height: tableHeaderHeight,
        verticalAlign: 'middle',
      }),
    );

    x += columnWidths[index];
  });

  header.add(
    new Konva.Line({
      points: [
        0,
        tableHeaderHeight,
        columnWidths[0] + columnWidths[1] + columnWidths[2],
        tableHeaderHeight,
      ],
      stroke: BORDER_COLOR,
      strokeWidth: 1,
    }),
  );

  return header;
};

const renderVerifiedBadge = (authLevel: string, i18n: I18n, width: number) => {
  const group = new Konva.Group();

  const label = new Konva.Text({
    x: 0,
    y: 0,
    width,
    text: `${i18n._(msg`Recipient Verification`)}:`,
    fontFamily: FONT_FAMILY,
    fontSize: TEXT_SM,
    fill: TEXT_MUTED,
    fontStyle: FONT_MEDIUM,
  });
  group.add(label);

  const badgeY = label.getClientRect().height + 2;

  // Checkmark (equivalente al icono SVG de tu JSX)
  const check = new Konva.Line({
    points: [0, 4, 3, 7, 8, 0],
    x: 0,
    y: badgeY + 2,
    stroke: VERIFIED_GREEN,
    strokeWidth: 1.6,
    lineCap: 'round',
    lineJoin: 'round',
  });
  group.add(check);

  const badgeText = new Konva.Text({
    x: 12,
    y: badgeY,
    width: width - 12,
    text: `${authLevel} ${i18n._(msg`Verified`)}`,
    fontFamily: FONT_FAMILY,
    fontSize: TEXT_XS,
    fontStyle: FONT_MEDIUM,
    fill: VERIFIED_GREEN,
    wrap: 'word',
  });
  group.add(badgeText);

  return group;
};

type RenderColumnOneOptions = { recipient: CertificateRecipient; width: number; i18n: I18n };

// Columna 1: Signer Events (nombre, email, labels Sent/Viewed/Signed, badge verificado)
const renderColumnOne = ({ recipient, width, i18n }: RenderColumnOneOptions) => {
  const group = new Konva.Group();

  const name = new Konva.Text({
    x: 0,
    y: 0,
    width,
    text: recipient.name,
    fontFamily: FONT_FAMILY,
    fontSize: TEXT_SM,
    fontStyle: FONT_MEDIUM,
    fill: '#3f3f46',
    wrap: 'word',
  });
  group.add(name);

  const email = new Konva.Text({
    x: 0,
    y: group.getClientRect().height,
    width,
    text: `${i18n._(msg`Email`)}: ${recipient.email}`,
    fontFamily: FONT_FAMILY,
    fontSize: TEXT_SM,
    fill: TEXT_MUTED,
    wrap: 'char',
  });
  group.add(email);

  const labelsY = group.getClientRect().height + 8;
  const labels = [i18n._(msg`Sent`), i18n._(msg`Viewed`), i18n._(msg`Signed`)];
  const lineHeight = TEXT_SM + 4;

  labels.forEach((label, index) => {
    group.add(
      new Konva.Text({
        x: 0,
        y: labelsY + index * lineHeight,
        text: `${label}:`,
        fontFamily: FONT_FAMILY,
        fontSize: TEXT_SM,
        fontStyle: FONT_MEDIUM,
        fill: '#3f3f46',
      }),
    );
  });

  const badge = renderVerifiedBadge(recipient.authLevel, i18n, width);
  badge.setAttrs({ y: group.getClientRect().height + 8 });
  group.add(badge);

  return group;
};

type RenderColumnTwoOptions = {
  recipient: CertificateRecipient;
  width: number;
  timezone: string | null | undefined;
  i18n: I18n;
};

// Columna 2: Timestamp — alineada con los labels Sent/Viewed/Signed de la columna 1
const renderColumnTwo = ({ recipient, width, timezone, i18n }: RenderColumnTwoOptions) => {
  const group = new Konva.Group();

  // Mismo offset superior que el bloque nombre+email de la columna 1, para
  // que las tres fechas queden alineadas con Sent/Viewed/Signed.
  const topOffset = 2 * (TEXT_SM + 2) + 8; // aproxima la altura de name + email

  const dates = [
    recipient.logs.emailed?.createdAt,
    recipient.logs.opened?.createdAt,
    recipient.logs.completed?.createdAt,
  ];

  const lineHeight = TEXT_SM + 4;

  dates.forEach((date, index) => {
    group.add(
      new Konva.Text({
        x: 0,
        y: topOffset + index * lineHeight,
        width,
        text: formatDateWithTimezone(date, timezone, i18n),
        fontFamily: FONT_FAMILY,
        fontSize: TEXT_SM,
        fill: TEXT_MUTED,
        wrap: 'char',
      }),
    );
  });

  return group;
};

type RenderColumnThreeOptions = { recipient: CertificateRecipient; width: number; i18n: I18n };

// Columna 3: firma (imagen/tipeada) + IP
const renderColumnThree = ({ recipient, width, i18n }: RenderColumnThreeOptions) => {
  const group = new Konva.Group();

  const boxHeight = 56;
  const signature = recipient.signatureField?.signature;

  const box = new Konva.Rect({
    x: 0,
    y: 0,
    width,
    height: boxHeight,
    stroke: BORDER_COLOR,
    strokeWidth: 1,
    cornerRadius: 4,
    fill: '#ffffff',
  });
  group.add(box);

  if (signature?.signatureImageAsBase64) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const img = new SkiaImage(signature.signatureImageAsBase64) as unknown as HTMLImageElement;

    const maxWidth = width - 8;
    const maxHeight = boxHeight - 8;
    const scale = Math.min(maxWidth / img.width, maxHeight / img.height);

    const imgWidth = img.width * scale;
    const imgHeight = img.height * scale;

    group.add(
      new Konva.Image({
        image: img,
        x: (width - imgWidth) / 2,
        y: (boxHeight - imgHeight) / 2,
        width: imgWidth,
        height: imgHeight,
      }),
    );
  } else if (signature?.typedSignature) {
    const settings = parseTypedSignatureSettings(signature.typedSignatureSettings);

    group.add(
      new Konva.Text({
        x: 0,
        y: 0,
        width,
        height: boxHeight,
        text: signature.typedSignature,
        fontFamily: settings?.font ?? getSignatureFontFamily(signature.typedSignature),
        fontSize: 16,
        fill: settings?.color ?? '#000000',
        align: 'center',
        verticalAlign: 'middle',
      }),
    );
  } else {
    group.add(
      new Konva.Text({
        x: 0,
        y: 0,
        width,
        height: boxHeight,
        text: 'N/A',
        fontFamily: FONT_FAMILY,
        fontSize: TEXT_SM,
        fill: TEXT_MUTED,
        align: 'center',
        verticalAlign: 'middle',
      }),
    );
  }

  const ipLabel = new Konva.Text({
    x: 0,
    y: boxHeight + 8,
    width,
    text: `${i18n._(msg`IP address`)}:`,
    fontFamily: FONT_FAMILY,
    fontSize: TEXT_SM,
    fontStyle: FONT_MEDIUM,
    fill: '#3f3f46',
  });
  group.add(ipLabel);

  group.add(
    new Konva.Text({
      x: 0,
      y: boxHeight + 8 + ipLabel.getClientRect().height,
      width,
      text: recipient.logs.completed?.ipAddress ?? i18n._(msg`Unknown`),
      fontFamily: FONT_FAMILY,
      fontSize: TEXT_SM,
      fill: TEXT_MUTED,
      wrap: 'char',
    }),
  );

  return group;
};

type RenderRowOptions = {
  recipient: CertificateRecipient;
  columnWidths: [number, number, number];
  timezone: string | null | undefined;
  i18n: I18n;
};

const renderRow = ({ recipient, columnWidths, timezone, i18n }: RenderRowOptions) => {
  const row = new Konva.Group();

  const col1 = renderColumnOne({ recipient, width: columnWidths[0], i18n });
  row.add(col1);

  const col2 = renderColumnTwo({ recipient, width: columnWidths[1], timezone, i18n });
  col2.setAttrs({ x: columnWidths[0] });
  row.add(col2);

  const col3 = renderColumnThree({ recipient, width: columnWidths[2], i18n });
  col3.setAttrs({ x: columnWidths[0] + columnWidths[1] });
  row.add(col3);

  const bottomLine = new Konva.Line({
    points: [
      0,
      row.getClientRect().height + rowVerticalPadding / 2,
      columnWidths[0] + columnWidths[1] + columnWidths[2],
      row.getClientRect().height + rowVerticalPadding / 2,
    ],
    stroke: BORDER_COLOR,
    strokeWidth: 1,
  });
  row.add(bottomLine);

  return row;
};

const loadLocalImage = (relativePath: string): HTMLImageElement | null => {
  try {
    const buffer = fs.readFileSync(path.join(process.cwd(), relativePath));

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return new SkiaImage(buffer) as unknown as HTMLImageElement;
  } catch {
    return null;
  }
};

/**
 * Renderiza el certificado a uno o más PDFs de una página cada uno (un
 * `Uint8Array` por página). La paginación entra en juego automáticamente
 * si tienes suficientes recipients como para no caber en una sola A4.
 */
export async function renderCertificate(options: RenderCertificateOptions): Promise<Uint8Array[]> {
  ensureFontLibrary();

  const { recipients, timezone, pageWidth, pageHeight, i18n } = options;

  const contentWidth = pageWidth - PAGE_MARGIN * 2 - CONTENT_PADDING * 2;

  const columnWidths: [number, number, number] = [
    (contentWidth * columnWidthPercentages[0]) / 100,
    (contentWidth * columnWidthPercentages[1]) / 100,
    (contentWidth * columnWidthPercentages[2]) / 100,
  ];

  const rows = recipients.map((recipient) =>
    renderRow({ recipient, columnWidths, timezone, i18n }),
  );

  // --- paginación: empaqueta filas en páginas que quepan en el alto disponible ---
  const titleHeight = 60;
  const footerHeight = 90;
  const availableTableHeight =
    pageHeight - PAGE_MARGIN * 2 - CONTENT_PADDING * 2 - titleHeight - footerHeight;

  const rowGroups: Konva.Group[][] = [[]];
  let usedHeight = tableHeaderHeight;
  let pageIndex = 0;

  for (const row of rows) {
    const rowHeight = row.getClientRect().height + rowVerticalPadding;

    if (usedHeight + rowHeight > availableTableHeight && rowGroups[pageIndex].length > 0) {
      pageIndex += 1;
      rowGroups[pageIndex] = [];
      usedHeight = tableHeaderHeight;
    }

    rowGroups[pageIndex].push(row);
    usedHeight += rowHeight;
  }

  const backgroundImage = loadLocalImage('public/static/background-certificate.png');
  const logoImage = loadLocalImage('public/static/logo-bg-white.png');

  const pages: Uint8Array[] = [];

  const stage = new Konva.Stage({ width: pageWidth, height: pageHeight });

  for (const [index, pageRows] of rowGroups.entries()) {
    const layer = new Konva.Layer();

    if (backgroundImage) {
      layer.add(
        new Konva.Image({
          image: backgroundImage,
          x: 0,
          y: 0,
          width: pageWidth,
          height: pageHeight,
        }),
      );
    }

    layer.add(
      new Konva.Rect({
        x: PAGE_MARGIN,
        y: PAGE_MARGIN,
        width: pageWidth - PAGE_MARGIN * 2,
        height: pageHeight - PAGE_MARGIN * 2,
        stroke: BRAND_COLOR,
        strokeWidth: 1,
      }),
    );

    const content = new Konva.Group({
      x: PAGE_MARGIN + CONTENT_PADDING,
      y: PAGE_MARGIN + CONTENT_PADDING,
    });

    if (index === 0) {
      content.add(
        new Konva.Text({
          x: 0,
          y: 0,
          width: contentWidth,
          height: titleHeight,
          text: i18n._(msg`Signature Certificate`),
          fontFamily: FONT_FAMILY,
          fontSize: 18,
          fontStyle: FONT_BOLD,
          fill: BRAND_COLOR,
          align: 'center',
          verticalAlign: 'middle',
        }),
      );
    }

    const table = new Konva.Group({ y: index === 0 ? titleHeight : 0 });
    const headerClone = renderTableHeader(columnWidths, i18n);
    table.add(headerClone);

    let rowY = tableHeaderHeight;

    for (const row of pageRows) {
      row.setAttrs({ x: 0, y: rowY });
      table.add(row);
      rowY += row.getClientRect().height + rowVerticalPadding;
    }

    content.add(table);

    // Footer (logo + "Document Completed by all parties on") solo en la
    // última página, igual que tu layout actual de una sola página.
    if (index === rowGroups.length - 1) {
      const footerY = pageHeight - PAGE_MARGIN - CONTENT_PADDING - footerHeight + 20;
      const footer = new Konva.Group({ x: 0, y: footerY });

      if (logoImage) {
        const logoSize = 60;

        footer.add(
          new Konva.Circle({
            x: logoSize / 2,
            y: logoSize / 2,
            radius: logoSize / 2,
            fill: '#ffffff',
          }),
        );

        const logoScale = Math.min(
          (logoSize - 12) / logoImage.width,
          (logoSize - 12) / logoImage.height,
        );

        footer.add(
          new Konva.Image({
            image: logoImage,
            x: (logoSize - logoImage.width * logoScale) / 2,
            y: (logoSize - logoImage.height * logoScale) / 2,
            width: logoImage.width * logoScale,
            height: logoImage.height * logoScale,
          }),
        );
      }

      const lastCompleted = recipients
        .map((r) => r.logs.completed?.createdAt)
        .filter((d): d is Date => Boolean(d))
        .sort((a, b) => b.getTime() - a.getTime())[0];

      const allCompleted =
        recipients.length > 0 && recipients.every((r) => Boolean(r.logs.completed?.createdAt));

      const footerText = new Konva.Group({ x: 76, y: 4 });

      footerText.add(
        new Konva.Text({
          x: 0,
          y: 0,
          text: i18n._(msg`Document Completed by all parties on`) + ':',
          fontFamily: FONT_FAMILY,
          fontSize: TEXT_SM,
          fontStyle: FONT_MEDIUM,
          fill: '#3f3f46',
        }),
      );

      footerText.add(
        new Konva.Text({
          x: 0,
          y: TEXT_SM + 4,
          text: allCompleted
            ? formatDateWithTimezone(lastCompleted, timezone, i18n)
            : i18n._(msg`Unknown`),
          fontFamily: FONT_FAMILY,
          fontSize: TEXT_SM,
          fontStyle: FONT_MEDIUM,
          fill: '#3f3f46',
        }),
      );

      footerText.add(
        new Konva.Text({
          x: 0,
          y: 2 * (TEXT_SM + 4),
          text: `${i18n._(msg`Page`)} ${index + 1} ${i18n._(msg`of`)} ${rowGroups.length}`,
          fontFamily: FONT_FAMILY,
          fontSize: TEXT_SM,
          fontStyle: FONT_MEDIUM,
          fill: '#3f3f46',
        }),
      );

      footer.add(footerText);
      content.add(footer);
    }

    layer.add(content);
    stage.add(layer);

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const canvas = layer.canvas._canvas as unknown as Canvas;
    const buffer = await canvas.toBuffer('pdf');
    pages.push(new Uint8Array(buffer));

    layer.destroy();
  }

  stage.destroy();

  return pages;
}
