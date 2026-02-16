import type { HTMLAttributes } from 'react';
import { useEffect, useState } from 'react';

import { Trans } from '@lingui/react/macro';
import { KeyboardIcon, UploadCloudIcon } from 'lucide-react';
import { match } from 'ts-pattern';

import { DocumentSignatureType } from '@documenso/lib/constants/document';
import { isBase64Image } from '@documenso/lib/constants/signatures';

import { SignatureIcon } from '../../icons/signature';
import { cn } from '../../lib/utils';
import { SignaturePadDraw } from './signature-pad-draw';
import { SignaturePadType } from './signature-pad-type';
import { SignaturePadUpload } from './signature-pad-upload';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './signature-tabs';

export type SignaturePadValue = {
  type: DocumentSignatureType;
  value: string;
  font?: string;
  color?: string;
};

export type SignaturePadProps = Omit<HTMLAttributes<HTMLCanvasElement>, 'onChange'> & {
  fullName?: string;
  value?: SignaturePadValue;
  onChange?: (_value: SignaturePadValue) => void;

  disabled?: boolean;

  typedSignatureEnabled?: boolean;
  uploadSignatureEnabled?: boolean;
  drawSignatureEnabled?: boolean;

  onValidityChange?: (isValid: boolean) => void;
};

export const SignaturePad = ({
  fullName,
  value,
  onChange,
  disabled = false,
  typedSignatureEnabled = true,
  uploadSignatureEnabled = true,
  drawSignatureEnabled = true,
}: SignaturePadProps) => {
  const [imageSignature, setImageSignature] = useState(
    value?.type === DocumentSignatureType.UPLOAD && isBase64Image(value?.value) ? value.value : '',
  );

  const [drawSignature, setDrawSignature] = useState(
    value?.type === DocumentSignatureType.DRAW && isBase64Image(value?.value) ? value.value : '',
  );

  const [typedSignature, setTypedSignature] = useState<SignaturePadValue>({
    type: DocumentSignatureType.TYPE,
    value:
      value?.type === DocumentSignatureType.TYPE && !isBase64Image(value.value) ? value.value : '',
    font: value?.font || 'Dancing Script',
    color: value?.color || 'black',
  });

  useEffect(() => {
    if (!value) return;

    switch (value.type) {
      case DocumentSignatureType.DRAW:
        setDrawSignature(value.value);
        break;
      case DocumentSignatureType.UPLOAD:
        setImageSignature(value.value);
        break;
      case DocumentSignatureType.TYPE:
        setTypedSignature({
          type: DocumentSignatureType.TYPE,
          value: value.value,
          font: value.font || 'Dancing Script',
          color: value.color || 'black',
        });
        break;
    }
  }, [value]);

  /**
   * Get the first enabled tab that has a signature if possible, otherwise just get
   * the first enabled tab.
   */
  const [tab, setTab] = useState<'draw' | 'text' | 'image'>(() => {
    if (value?.type === DocumentSignatureType.DRAW && drawSignatureEnabled) return 'draw';
    if (value?.type === DocumentSignatureType.UPLOAD && uploadSignatureEnabled) return 'image';
    if (value?.type === DocumentSignatureType.TYPE && typedSignatureEnabled) return 'text';

    // Second passthrough to check if there's a signature for a given tab
    if (drawSignatureEnabled && drawSignature) return 'draw';
    if (typedSignatureEnabled && typedSignature.value) return 'text';
    if (uploadSignatureEnabled && imageSignature) return 'image';

    // Third passthrough to just select the first available tab
    if (drawSignatureEnabled) return 'draw';
    if (typedSignatureEnabled) return 'text';
    if (uploadSignatureEnabled) return 'image';

    throw new Error('No signature enabled');
  });

  const onImageSignatureChange = (value: string) => {
    setImageSignature(value);

    onChange?.({
      type: DocumentSignatureType.UPLOAD,
      value,
    });
  };

  const onDrawSignatureChange = (value: string) => {
    setDrawSignature(value);

    onChange?.({
      type: DocumentSignatureType.DRAW,
      value,
    });
  };

  const onTypedSignatureChange = (signature: SignaturePadValue) => {
    setTypedSignature(signature);
    onChange?.(signature);
  };

  const onTabChange = (selectedTab: 'draw' | 'text' | 'image') => {
    if (disabled) return;

    setTab(selectedTab);

    match(selectedTab)
      .with('draw', () => {
        setTypedSignature({
          type: DocumentSignatureType.TYPE,
          value: '',
          font: 'Dancing Script',
          color: 'black',
        });
        setImageSignature('');
        onDrawSignatureChange(drawSignature);
      })
      .with('text', () => {
        setDrawSignature('');
        setImageSignature('');
        onTypedSignatureChange(typedSignature);
      })
      .with('image', () => {
        setTypedSignature({
          type: DocumentSignatureType.TYPE,
          value: '',
          font: 'Dancing Script',
          color: 'black',
        });
        setDrawSignature('');
        onImageSignatureChange(imageSignature);
      })
      .exhaustive();
  };

  if (!drawSignatureEnabled && !typedSignatureEnabled && !uploadSignatureEnabled) {
    return null;
  }

  return (
    <Tabs
      defaultValue={tab}
      className={cn('mt-0', {
        'pointer-events-none': disabled,
      })}
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      onValueChange={(value) => onTabChange(value as 'draw' | 'text' | 'image')}
    >
      <TabsList>
        {drawSignatureEnabled && (
          <TabsTrigger value="draw">
            <SignatureIcon className="mr-2 size-4" />
            <Trans context="Draw signature">Draw</Trans>
          </TabsTrigger>
        )}

        {typedSignatureEnabled && (
          <TabsTrigger value="text">
            <KeyboardIcon className="mr-2 size-4" />
            <Trans context="Type signature">Type</Trans>
          </TabsTrigger>
        )}

        {uploadSignatureEnabled && (
          <TabsTrigger value="image">
            <UploadCloudIcon className="mr-2 size-4" />
            <Trans context="Upload signature">Upload</Trans>
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent
        value="draw"
        className="relative flex aspect-signature-pad items-center justify-center rounded-md border border-border bg-neutral-50 text-center dark:bg-background"
      >
        <SignaturePadDraw
          className="h-full w-full"
          onChange={onDrawSignatureChange}
          value={drawSignature}
        />
      </TabsContent>

      <TabsContent
        value="text"
        className="relative flex aspect-signature-pad items-center justify-center rounded-md border border-border bg-neutral-50 text-center dark:bg-background"
      >
        <SignaturePadType
          value={typedSignature}
          defaultValue={fullName}
          onChange={onTypedSignatureChange}
        />
      </TabsContent>

      <TabsContent
        value="image"
        className={cn(
          'relative aspect-signature-pad rounded-md border border-border bg-neutral-50 dark:bg-background',
          {
            'bg-white': imageSignature,
          },
        )}
      >
        <SignaturePadUpload value={imageSignature} onChange={onImageSignatureChange} />
      </TabsContent>
    </Tabs>
  );
};
