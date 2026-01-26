'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { base64 } from '@scure/base';
import { Loader } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { Document as PDFDocument, Page as PDFPage, pdfjs } from 'react-pdf';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { getFile } from '@documenso/lib/universal/upload/get-file';
import type { DocumentData } from '@documenso/prisma/client';

import { cn } from '../../lib/utils';
import { useToast } from '../use-toast';

export type LoadedPDFDocument = PDFDocumentProxy;

if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
}

const pdfViewerOptions = {
  cMapUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/static/cmaps/`,
};

const PDFLoader = () => (
  <>
    <Loader className="text-documenso h-12 w-12 animate-spin" />
    <p className="text-muted-foreground mt-4">
      <Trans>Loading document...</Trans>
    </p>
  </>
);

export type DocumentDataViewerProps = {
  className?: string;
  documentData: DocumentData;
  onDocumentLoad?: () => void;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'onClick'>;

export const DocumentDataViewer = ({
  className,
  documentData,
  onDocumentLoad,
  onClick,
  ...props
}: DocumentDataViewerProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const $el = useRef<HTMLDivElement>(null);

  const [isDocumentBytesLoading, setIsDocumentBytesLoading] = useState(false);
  const [documentBytes, setDocumentBytes] = useState<Uint8Array | null>(
    documentData.type === 'BYTES_64' ? base64.decode(documentData.data) : null,
  );

  const [width, setWidth] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [pdfError, setPdfError] = useState(false);

  const isLoading = isDocumentBytesLoading || !documentBytes;

  const pdfFile = useMemo(() => {
    if (!documentBytes) {
      return null;
    }
    return {
      data: documentBytes,
    };
  }, [documentBytes]);

  const onDocumentLoaded = (doc: LoadedPDFDocument) => {
    setNumPages(doc.numPages);
    onDocumentLoad?.();
  };

  // --- SOLUCIÓN: Usar ResizeObserver en lugar de window resize ---
  useEffect(() => {
    if (!$el.current) return;

    const container = $el.current;

    // Esta función se ejecuta cada vez que el contenedor cambia de tamaño
    // (no solo la ventana, sino el div en sí mismo)
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect) {
          // contentRect.width nos da el ancho exacto disponible sin bordes/padding
          setWidth(entry.contentRect.width);
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);
  // -------------------------------------------------------------

  useEffect(() => {
    const fetchDocumentBytes = async () => {
      try {
        setIsDocumentBytesLoading(true);

        const bytes = await getFile({
          type: documentData.type,
          data: documentData.data,
        });

        setDocumentBytes(bytes);
        setIsDocumentBytesLoading(false);
      } catch (err) {
        console.error(err);
        toast({
          title: _(msg`Error`),
          description: _(msg`An error occurred while loading the document.`),
          variant: 'destructive',
        });
        setIsDocumentBytesLoading(false);
      }
    };

    if (documentData.type !== 'BYTES_64' || !documentBytes) {
      void fetchDocumentBytes();
    }
  }, [documentData.type, documentData.data, documentBytes, toast]);

  return (
    // IMPORTANTE: Eliminé 'overflow-hidden' del contenedor padre principal temporalmente
    // o asegúrate que el width se calcule bien. A veces el overflow oculta sombras o bordes.
    <div ref={$el} className={cn('w-full', className)} onClick={onClick} {...props}>
      {isLoading ? (
        <div
          className={cn(
            'flex h-[80vh] max-h-[60rem] w-full flex-col items-center justify-center overflow-hidden rounded',
          )}
        >
          <PDFLoader />
        </div>
      ) : (
        <>
          <PDFDocument
            file={pdfFile}
            className={cn('w-full rounded', {
              'h-[80vh] max-h-[60rem]': numPages === 0,
            })}
            onLoadSuccess={(d) => onDocumentLoaded(d)}
            onSourceError={() => {
              setPdfError(true);
            }}
            externalLinkTarget="_blank"
            loading={
              <div className="dark:bg-background flex h-[80vh] max-h-[60rem] flex-col items-center justify-center bg-white/50">
                {pdfError ? (
                  <div className="text-muted-foreground text-center">
                    <p>
                      <Trans>Something went wrong while loading the document.</Trans>
                    </p>
                    <p className="mt-1 text-sm">
                      <Trans>Please try again or contact our support.</Trans>
                    </p>
                  </div>
                ) : (
                  <PDFLoader />
                )}
              </div>
            }
            error={
              <div className="dark:bg-background flex h-[80vh] max-h-[60rem] flex-col items-center justify-center bg-white/50">
                <div className="text-muted-foreground text-center">
                  <p>
                    <Trans>Something went wrong while loading the document.</Trans>
                  </p>
                  <p className="mt-1 text-sm">
                    <Trans>Please try again or contact our support.</Trans>
                  </p>
                </div>
              </div>
            }
            options={pdfViewerOptions}
          >
            {Array(numPages)
              .fill(null)
              .map((_, i) => (
                <div key={i} className="last:-mb-2">
                  {/* Contenedor de la página */}
                  <div className="border-border overflow-hidden rounded border will-change-transform">
                    <PDFPage
                      pageNumber={i + 1}
                      width={width} // Aquí pasamos el ancho dinámico del Observer
                      renderAnnotationLayer={false}
                      renderTextLayer={false}
                      loading={() => ''}
                      renderMode="canvas"
                      // Opcional: scale={1} asegura que respete el width
                    />
                  </div>
                  <p className="text-muted-foreground/80 my-2 text-center text-[11px]">
                    <Trans>
                      Page {i + 1} of {numPages}
                    </Trans>
                  </p>
                </div>
              ))}
          </PDFDocument>
        </>
      )}
    </div>
  );
};
