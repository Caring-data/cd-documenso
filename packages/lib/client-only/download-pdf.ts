import type { DocumentData, EnvelopeItem } from '@documenso/prisma/client';

import { getFile } from '../universal/upload/get-file';
import { downloadFile } from './download-file';

type EnvelopeItemToDownload = Pick<EnvelopeItem, 'id' | 'envelopeId' | 'title' | 'order'>;

export type DownloadPDFProps = {
  documentData?: DocumentData;
  fileName?: string;
  envelopeItem?: EnvelopeItemToDownload;
  token?: string;
  version?: 'original' | 'signed';
};

export const downloadPDF = async ({
  documentData,
  fileName,
  envelopeItem,
  token,
  version = 'signed',
}: DownloadPDFProps) => {
  let blob: Blob;
  let baseTitle: string;

  if (envelopeItem) {
    // Download envelope item via API
    const url = token
      ? `/api/files/token/${token}/envelopeItem/${envelopeItem.id}/download/${version}`
      : `/api/files/envelope/${envelopeItem.envelopeId}/envelopeItem/${envelopeItem.id}/download/${version}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Failed to download document');
    }

    blob = await response.blob();
    baseTitle = (fileName ?? envelopeItem.title ?? 'document').replace(/\.pdf$/, '');
  } else if (documentData) {
    // Original behavior - download from document data
    const bytes = await getFile(documentData);

    blob = new Blob([new Uint8Array(bytes)], {
      type: 'application/pdf',
    });

    baseTitle = (fileName ?? 'document').replace(/\.pdf$/, '');
  } else {
    throw new Error('Either documentData or envelopeItem must be provided');
  }

  const suffix = version === 'original' ? '' : '_signed';

  downloadFile({
    filename: `${baseTitle}${suffix}.pdf`,
    data: blob,
  });
};
