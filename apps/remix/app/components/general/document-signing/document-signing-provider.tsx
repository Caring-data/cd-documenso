import { createContext, useContext, useState } from 'react';

import { isBase64Image } from '@documenso/lib/constants/signatures';
import { DocumentSignatureType } from '@documenso/lib/utils/teams';
import type { SignaturePadValue } from '@documenso/ui/primitives/signature-pad';

export type DocumentSigningContextValue = {
  fullName: string;
  setFullName: (_value: string) => void;
  email: string;
  setEmail: (_value: string) => void;
  signature: SignaturePadValue | null;
  setSignature: (_value: SignaturePadValue | null) => void;
};

const DocumentSigningContext = createContext<DocumentSigningContextValue | null>(null);

export const useDocumentSigningContext = () => {
  return useContext(DocumentSigningContext);
};

export const useRequiredDocumentSigningContext = () => {
  const context = useDocumentSigningContext();

  if (!context) {
    throw new Error('Signing context is required');
  }

  return context;
};

export interface DocumentSigningProviderProps {
  fullName?: string | null;
  email?: string | null;
  signature?: string | SignaturePadValue | null;
  typedSignatureEnabled?: boolean;
  uploadSignatureEnabled?: boolean;
  drawSignatureEnabled?: boolean;
  children: React.ReactNode;
}

export const DocumentSigningProvider = ({
  fullName: initialFullName,
  email: initialEmail,
  signature: initialSignature,
  typedSignatureEnabled = true,
  uploadSignatureEnabled = true,
  drawSignatureEnabled = true,
  children,
}: DocumentSigningProviderProps) => {
  const [fullName, setFullName] = useState(initialFullName || '');
  const [email, setEmail] = useState(initialEmail || '');

  const [signature, setSignature] = useState<SignaturePadValue | null>(() => {
    if (!initialSignature) {
      return null;
    }

    if (typeof initialSignature === 'object') {
      return initialSignature;
    }

    const sig = initialSignature;
    const isBase64 = isBase64Image(sig);

    // DRAW o UPLOAD (base64)
    if (isBase64 && (uploadSignatureEnabled || drawSignatureEnabled)) {
      return {
        type: drawSignatureEnabled ? DocumentSignatureType.DRAW : DocumentSignatureType.UPLOAD,
        value: sig,
      };
    }

    // TYPE
    if (!isBase64 && typedSignatureEnabled) {
      return {
        type: DocumentSignatureType.TYPE,
        value: sig,
        font: 'Dancing Script',
        color: 'black',
      };
    }

    return null;
  });

  return (
    <DocumentSigningContext.Provider
      value={{
        fullName,
        setFullName,
        email,
        setEmail,
        signature,
        setSignature,
      }}
    >
      {children}
    </DocumentSigningContext.Provider>
  );
};

DocumentSigningProvider.displayName = 'DocumentSigningProvider';
