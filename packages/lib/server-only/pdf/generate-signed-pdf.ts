import {
  PDFDocument,
  RotationTypes,
  popGraphicsState,
  pushGraphicsState,
  radiansToDegrees,
  rotateDegrees,
  translate,
} from '@cantoo/pdf-lib';
// 🆕 Cambio de librería
import type { DocumentData, Envelope, EnvelopeItem, Field } from '@prisma/client';
import { groupBy } from 'remeda';
import { match } from 'ts-pattern';

import { signPdf } from '@documenso/signing';

import { getFileServerSide } from '../../universal/upload/get-file.server';
import { compressPdfBuffer } from './compress-pdf';
import { flattenAnnotations } from './flatten-annotations';
import { flattenForm } from './flatten-form';
import { getPageSize } from './get-page-size';
import { insertFieldInPDFV1 } from './insert-field-in-pdf-v1';
import { insertFieldInPDFV2 } from './insert-field-in-pdf-v2';
// Si existe
import { legacy_insertFieldInPDF } from './legacy-insert-field-in-pdf';
// Si existe
import { normalizeSignatureAppearances } from './normalize-signature-appearances';

export const generateSignedPdf = async ({
  envelope,
  envelopeItem,
  fields,
}: {
  envelope: Envelope & {
    internalVersion?: number;
    useLegacyFieldInsertion?: boolean;
  };
  envelopeItem: EnvelopeItem & { documentData: DocumentData };
  fields: Field[];
  certificateData?: Buffer | null;
}): Promise<Buffer> => {
  const pdfData = await getFileServerSide(envelopeItem.documentData);

  const pdfDoc = await PDFDocument.load(pdfData);

  normalizeSignatureAppearances(pdfDoc);
  await flattenForm(pdfDoc);
  flattenAnnotations(pdfDoc);

  if (envelope.internalVersion === 1) {
    for (const field of fields) {
      if (field.inserted) {
        if (envelope.useLegacyFieldInsertion) {
          await legacy_insertFieldInPDF(pdfDoc, field);
        } else {
          await insertFieldInPDFV1(pdfDoc, field);
        }
      }
    }
  } else if (envelope.internalVersion === 2) {
    const fieldsGroupedByPage = groupBy(fields, (field) => field.page);

    for (const [pageNumber, pageFields] of Object.entries(fieldsGroupedByPage)) {
      const page = pdfDoc.getPage(Number(pageNumber) - 1);
      const pageRotation = page.getRotation();

      let { width: pageWidth, height: pageHeight } = getPageSize(page);

      let pageRotationInDegrees = match(pageRotation.type)
        .with(RotationTypes.Degrees, () => pageRotation.angle)
        .with(RotationTypes.Radians, () => radiansToDegrees(pageRotation.angle))
        .exhaustive();

      pageRotationInDegrees = Math.round(pageRotationInDegrees / 90) * 90;

      if (pageRotationInDegrees === 90 || pageRotationInDegrees === 270) {
        [pageWidth, pageHeight] = [pageHeight, pageWidth];
      }

      if (pageRotationInDegrees !== 0) {
        let translateX = 0;
        let translateY = 0;

        switch (pageRotationInDegrees) {
          case 90:
            translateX = pageHeight;
            break;
          case 180:
            translateX = pageWidth;
            translateY = pageHeight;
            break;
          case 270:
            translateY = pageWidth;
            break;
        }

        page.pushOperators(pushGraphicsState());
        page.pushOperators(translate(translateX, translateY), rotateDegrees(pageRotationInDegrees));
      }

      const renderedPdfOverlay = await insertFieldInPDFV2({
        pageWidth,
        pageHeight,
        fields: pageFields,
      });

      const [embeddedPage] = await pdfDoc.embedPdf(renderedPdfOverlay);

      page.drawPage(embeddedPage, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
      });

      if (pageRotationInDegrees !== 0) {
        page.pushOperators(popGraphicsState());
      }
    }
  } else {
    console.warn(`Unknown internalVersion: ${envelope.internalVersion}, using V1`);
  }

  await flattenForm(pdfDoc);
  const signedPdfBytes = await pdfDoc.save();
  const signedPdf = await signPdf({ pdf: Buffer.from(signedPdfBytes) });
  const compressedPdf = await compressPdfBuffer(signedPdf, 'medium');

  return compressedPdf;
};
