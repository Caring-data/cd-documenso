import { useState } from 'react';

import { Trans } from '@lingui/react/macro';
import { createCallable } from 'react-call';

import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { SignaturePad, type SignaturePadValue } from '@documenso/ui/primitives/signature-pad';

import { DocumentSigningDisclosure } from '../general/document-signing/document-signing-disclosure';

export type SignFieldSignatureDialogProps = {
  initialSignature?: SignaturePadValue;
  fullName?: string;
  typedSignatureEnabled?: boolean;
  uploadSignatureEnabled?: boolean;
  drawSignatureEnabled?: boolean;
};

export const SignFieldSignatureDialog = createCallable<
  SignFieldSignatureDialogProps,
  SignaturePadValue | null
>(
  ({
    call,
    fullName,
    typedSignatureEnabled,
    uploadSignatureEnabled,
    drawSignatureEnabled,
    initialSignature,
  }) => {
    const [localSignature, setLocalSignature] = useState<SignaturePadValue | null>(
      initialSignature ?? null,
    );

    return (
      <Dialog open={true} onOpenChange={(value) => (!value ? call.end(null) : null)}>
        <DialogContent position="center">
          <div>
            <DialogHeader>
              <DialogTitle>
                <Trans>Sign as {fullName}</Trans>
              </DialogTitle>
            </DialogHeader>

            <SignaturePad
              fullName={fullName}
              value={localSignature ?? undefined}
              onChange={setLocalSignature}
              typedSignatureEnabled={typedSignatureEnabled}
              uploadSignatureEnabled={uploadSignatureEnabled}
              drawSignatureEnabled={drawSignatureEnabled}
            />
          </div>

          <DocumentSigningDisclosure />

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => call.end(null)}>
              <Trans>Cancel</Trans>
            </Button>

            <Button
              type="button"
              disabled={!localSignature?.value}
              onClick={() => call.end(localSignature)}
            >
              <Trans>Sign</Trans>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  },
);
