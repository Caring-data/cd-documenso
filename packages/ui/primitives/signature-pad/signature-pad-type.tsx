import { useEffect, useRef, useState } from 'react';

import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';

import { DocumentSignatureType } from '@documenso/lib/utils/teams';

import { cn } from '../../lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger } from '../select';
import type { SignaturePadValue } from './signature-pad';
import { SignaturePadColorPicker } from './signature-pad-color-picker';

export type SignaturePadTypeProps = {
  className?: string;
  value?: SignaturePadValue;
  defaultValue?: string;
  onChange: (_value: SignaturePadValue) => void;
};

export const SignaturePadType = ({
  className,
  value,
  defaultValue,
  onChange,
}: SignaturePadTypeProps) => {
  const { t } = useLingui();

  const $isDirty = useRef(false);

  const [selectedFont, setSelectedFont] = useState(value?.font || 'Dancing Script');
  const [selectedColor, setSelectedColor] = useState(value?.color || 'black');

  useEffect(() => {
    if (!$isDirty.current && !value?.value && defaultValue) {
      $isDirty.current = true;
      onChange({
        type: DocumentSignatureType.TYPE,
        value: defaultValue,
        font: selectedFont,
        color: selectedColor,
      });
    }
  }, [defaultValue, value?.value, selectedFont, selectedColor, onChange]);

  useEffect(() => {
    if (value?.font && value.font !== selectedFont) {
      setSelectedFont(value.font);
    }
    if (value?.color && value.color !== selectedColor) {
      setSelectedColor(value.color);
    }
  }, [value?.font, value?.color]);

  const handleChange = (newValue: string) => {
    onChange({
      type: DocumentSignatureType.TYPE,
      value: newValue.trimStart(),
      font: selectedFont,
      color: selectedColor,
    });
    $isDirty.current = true;
  };

  return (
    <div className={cn('relative flex h-full w-full items-center justify-center', className)}>
      <input
        data-testid="signature-pad-type-input"
        placeholder={t`Type your signature`}
        className="w-full bg-transparent px-4 text-center text-7xl text-black placeholder:text-4xl focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:text-white"
        style={{
          color: selectedColor,
          fontFamily: selectedFont,
        }}
        value={value?.value || ''}
        onChange={(event) => handleChange(event.target.value)}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />

      <div className="absolute left-2 top-2 bg-neutral-50 dark:bg-background">
        <Select
          value={selectedFont}
          onValueChange={(font) => {
            setSelectedFont(font);
            if (value?.value) {
              onChange({
                type: DocumentSignatureType.TYPE,
                value: value.value,
                font,
                color: selectedColor,
              });
            }
          }}
        >
          <SelectTrigger className="h-auto w-auto border-none p-0.5">
            <p className="px-2 text-sm text-foreground">
              <Trans>Choose font</Trans>
            </p>
          </SelectTrigger>

          <SelectContent className="w-[200px]" align="start">
            {['Dancing Script', 'Great Vibes', 'Cookie', 'Monte Carlo', 'Caveat', 'Lato'].map(
              (font) => (
                <SelectItem key={font} value={font}>
                  <span style={{ fontFamily: font }} className="text-base">
                    {value?.value || font}
                  </span>
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
      </div>

      <SignaturePadColorPicker
        selectedColor={selectedColor}
        setSelectedColor={(color) => {
          setSelectedColor(color);
          if (value?.value) {
            onChange({
              type: DocumentSignatureType.TYPE,
              value: value.value,
              font: selectedFont,
              color,
            });
          }
        }}
      />
    </div>
  );
};
