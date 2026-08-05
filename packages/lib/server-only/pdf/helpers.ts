import path from 'node:path';
import { FontLibrary } from 'skia-canvas';

/**
 * Registers all fonts used by the certificate renderer in the skia-canvas
 * FontLibrary. Registration is process-global and idempotent — calling this
 * multiple times after the first successful call is a no-op.
 *
 * IMPORTANT: adjust the file names below to match whatever .ttf/.otf files
 * you actually ship in `public/fonts`. These need to be REAL font files on
 * disk — skia-canvas cannot load fonts from a CSS @font-face / web font the
 * way Chromium could.
 */
export const ensureFontLibrary = () => {
  const fontPath = path.join(process.cwd(), 'public/fonts');

  if (!FontLibrary.has('Inter')) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    FontLibrary.use({
      Inter: [path.join(fontPath, 'inter-variablefont_opsz,wght.ttf')],
    });
  }

  // Used for typed signatures (matches the `Dancing Script` fallback in your
  // current certificate.tsx). If recipients can pick other typed-signature
  // fonts, register each of those font files here too and route through a
  // `getSignatureFontFamily` helper like the new Documenso version does.
  if (!FontLibrary.has('Dancing Script')) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    FontLibrary.use({
      'Dancing Script': [path.join(fontPath, 'dancing-script.ttf')],
    });
  }

  // Optional, only needed if you support non-latin locales.
  if (!FontLibrary.has('Noto Sans')) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    FontLibrary.use({
      'Noto Sans': [path.join(fontPath, 'noto-sans.ttf')],
    });
  }
};
