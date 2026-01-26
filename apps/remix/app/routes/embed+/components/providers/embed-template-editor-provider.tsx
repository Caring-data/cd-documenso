import React, { createContext, useCallback, useContext, useState } from 'react';

import type { TRecipientColor } from '@documenso/ui/lib/recipient-colors';
import { AVAILABLE_RECIPIENT_COLORS } from '@documenso/ui/lib/recipient-colors';

import { useEditorFields } from '@documenso/lib/client-only/hooks/use-editor-fields';
import type { TLocalField } from '@documenso/lib/client-only/hooks/use-editor-fields';
import type { TEnvelope } from '@documenso/lib/types/envelope';

type EmbedTemplateEditorContextValue = {
  envelope: TEnvelope;
  setLocalEnvelope: (localEnvelope: Partial<TEnvelope>) => void;
  editorFields: ReturnType<typeof useEditorFields>;
  getRecipientColorKey: (recipientId: number) => TRecipientColor;
  getFields: () => TLocalField[];
};

interface EmbedTemplateEditorProviderProps {
  children: React.ReactNode;
  initialEnvelope: TEnvelope;
  onFieldsUpdate?: (fields: TLocalField[]) => void;
}

const EmbedTemplateEditorContext = createContext<EmbedTemplateEditorContextValue | null>(null);

export const useCurrentEmbedTemplateEditor = () => {
  const context = useContext(EmbedTemplateEditorContext);

  if (!context) {
    throw new Error(
      'useCurrentEmbedTemplateEditor must be used within an EmbedTemplateEditorProvider',
    );
  }

  return context;
};

export const EmbedTemplateEditorProvider = ({
  children,
  initialEnvelope,
  onFieldsUpdate,
}: EmbedTemplateEditorProviderProps) => {
  const [envelope, setEnvelope] = useState(initialEnvelope);

  const handleFieldsUpdate = useCallback(
    (fields: TLocalField[]) => {
      onFieldsUpdate?.(fields);
    },
    [onFieldsUpdate],
  );

  const editorFields = useEditorFields({
    envelope,
    handleFieldsUpdate,
  });

  const getRecipientColorKey = useCallback(
    (recipientId: number) => {
      const recipientIndex = envelope.recipients.findIndex(
        (recipient) => recipient.id === recipientId,
      );

      return AVAILABLE_RECIPIENT_COLORS[
        Math.max(recipientIndex, 0) % AVAILABLE_RECIPIENT_COLORS.length
      ];
    },
    [envelope.recipients],
  );

  const setLocalEnvelope = (localEnvelope: Partial<TEnvelope>) => {
    setEnvelope((prev) => ({ ...prev, ...localEnvelope }));
  };

  const getFields = useCallback(() => {
    return editorFields.localFields;
  }, [editorFields.localFields]);

  return (
    <EmbedTemplateEditorContext.Provider
      value={{
        envelope,
        setLocalEnvelope,
        editorFields,
        getRecipientColorKey,
        getFields,
      }}
    >
      {children}
    </EmbedTemplateEditorContext.Provider>
  );
};
