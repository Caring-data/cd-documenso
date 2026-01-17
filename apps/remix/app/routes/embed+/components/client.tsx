import { lazy, startTransition, Suspense, useEffect, useState } from 'react';
import { useRevalidator } from 'react-router';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { ReadStatus, RecipientRole, SendStatus, SigningStatus } from '@prisma/client';

import { EnvelopeRenderProvider } from '@documenso/lib/client-only/providers/envelope-render-provider';
import { AppError } from '@documenso/lib/errors/app-error';
import type { TEnvelope } from '@documenso/lib/types/envelope';
import type { DocumentData } from '@documenso/prisma/client';
import { generateRecipientPlaceholder } from '@documenso/lib/utils/templates';
import { trpc } from '@documenso/trpc/react';
import PDFViewerKonvaLazy from '@documenso/ui/components/pdf-viewer/pdf-viewer-konva-lazy';
import { DocumentFlowFormContainer } from '@documenso/ui/primitives/document-flow/document-flow-root';
import type { DocumentFlowStep } from '@documenso/ui/primitives/document-flow/types';
import { Stepper } from '@documenso/ui/primitives/stepper';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { EmbedTemplateEditorProvider, useCurrentEmbedTemplateEditor } from './providers/embed-template-editor-provider';
import { AddTemplateSettingsFormPartial } from './template-flow/add-template-settings';
import { EmbedAddTemplateFieldsFormPartial } from './template-flow/add-template-fields';

const EmbedFieldsPageRenderer = lazy(
  async () => import('./template-flow/embed-fields-page-renderer'),
);

type TemplateStep = 'general' | 'fields';

export type ClientProps = {
  envelopeId: string;
  externalId: string;
  documentData: DocumentData;
  initialEnvelope: TEnvelope;
};

export function Client({ envelopeId, externalId, documentData, initialEnvelope }: ClientProps) {
  return (
    <EmbedTemplateEditorProvider initialEnvelope={initialEnvelope}>
      <EnvelopeRenderProvider
        envelope={initialEnvelope}
        token={undefined}
        fields={initialEnvelope.fields}
        recipients={initialEnvelope.recipients}
      >
        <ClientInner envelopeId={envelopeId} initialEnvelope={initialEnvelope} />
      </EnvelopeRenderProvider>
    </EmbedTemplateEditorProvider>
  );
}

type ClientInnerProps = {
  envelopeId: string;
  initialEnvelope: TEnvelope;
};

function ClientInner({ envelopeId, initialEnvelope }: ClientInnerProps) {
  const { t } = useLingui();
  const { toast } = useToast();
  const { revalidate } = useRevalidator();
  const [currentStep, setCurrentStep] = useState(1);

  const { envelope, editorFields, setLocalEnvelope } = useCurrentEmbedTemplateEditor();

  const { mutateAsync: updateTemplateSettings, isPending } =
    trpc.template.updateTemplateSettings.useMutation({
      onSuccess: async (data) => {
        await revalidate();

        // Update the envelope in the provider with the new recipients
        editorFields.setSelectedRecipient(null);
        setLocalEnvelope({
          recipients: data.recipients.map((recipient) => ({
            ...recipient,
            envelopeId: envelope.id,
            token: '',
            readStatus: ReadStatus.NOT_OPENED,
            signingStatus: SigningStatus.NOT_SIGNED,
            sendStatus: SendStatus.NOT_SENT,
            documentDeletedAt: null,
            expired: null,
            signedAt: null,
            authOptions: null,
            rejectionReason: null,
          })),
        });

        toast({
          title: t`Success`,
          description: t`Template settings updated successfully`,
        });
        setCurrentStep(2);
      },
      onError: (error) => {
        const appError = AppError.parseError(error);
        toast({
          title: t`Error`,
          description: t`Failed to update template settings: ${appError.message}`,
          variant: 'destructive',
        });
      },
    });

  const { mutateAsync: setEnvelopeFields } = trpc.envelope.field.set.useMutation({
    onSuccess: () => {
      toast({
        title: t`Success`,
        description: t`Template fields saved successfully`,
      });
    },
    onError: (error) => {
      const appError = AppError.parseError(error);
      toast({
        title: t`Error`,
        description: t`Failed to save template fields: ${appError.message}`,
        variant: 'destructive',
      });
    },
  });

  const templateFlow: Record<TemplateStep, DocumentFlowStep> = {
    general: {
      title: msg`General`,
      description: msg`Set up the basic details for your template. Add a title and define the recipients who will complete or sign this document.`,
      stepIndex: 1,
    },
    fields: {
      title: msg`Add Template Fields`,
      description: msg`Add template fields to your envelope.`,
      stepIndex: 2,
    },
  };

  const onAddGeneralSettings = async (data: { title: string; recipients: any[] }) => {
    try {
      // Map recipients to the format expected by TRPC, removing formId and ensuring valid emails
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      const mappedRecipients = data.recipients.map((recipient, index) => {
        // Ensure email is valid - if not, use a valid placeholder
        const isValidEmail = recipient.email && emailRegex.test(recipient.email.trim().toLowerCase());
        const email = isValidEmail 
          ? recipient.email.trim().toLowerCase() 
          : generateRecipientPlaceholder(index + 1).email;
        
        return {
          id: recipient.id,
          email,
          name: recipient.name,
          role: recipient.role,
          signingOrder: recipient.signingOrder,
          actionAuth: recipient.actionAuth,
        };
      });

      await updateTemplateSettings({
        envelopeId,
        title: data.title,
        recipients: mappedRecipients,
      });
    } catch (error) {
      console.error('Error updating template settings:', error);
    }
  };

  const onAddTemplateFields = async () => {
    try {
      const fields = editorFields.localFields.map((field) => {
        // Ensure all numeric values are valid numbers
        const safeNumber = (value: number) => {
          if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
            return 0;
          }
          return value;
        };

        return {
          ...field,
          positionX: safeNumber(field.positionX),
          positionY: safeNumber(field.positionY),
          width: safeNumber(field.width),
          height: safeNumber(field.height),
        };
      });

      await setEnvelopeFields({
        envelopeId: initialEnvelope.id,
        envelopeType: initialEnvelope.type,
        fields: fields,
      });
    } catch (error) {
      console.error('Error saving template fields:', error);
    }
  };

  const handleStepChange = (step: number) => {
    setCurrentStep(step);
  };

  useEffect(() => {
    const firstSelectableRecipient = envelope.recipients.find(
      (recipient) =>
        recipient.role === RecipientRole.SIGNER || recipient.role === RecipientRole.APPROVER,
    );

    if (firstSelectableRecipient) {
      startTransition(() => {
        editorFields.setSelectedRecipient(firstSelectableRecipient.id);
      });
    }
  }, [envelope.recipients]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-muted/10">
      <main className="relative flex-1 overflow-y-auto scroll-smooth p-4 lg:p-8">
        <div className="mx-auto flex min-h-full max-w-[800px] flex-col items-center justify-center">
          <Suspense fallback={<div className="flex h-[60vh] items-center justify-center">Loading...</div>}>
            <PDFViewerKonvaLazy
              renderer="editor"
              customPageRenderer={EmbedFieldsPageRenderer}
              className="w-full"
            />
          </Suspense>
        </div>
      </main>

      <aside className="bg-background flex w-full max-w-md flex-col border-l shadow-2xl lg:w-[550px] xl:max-w-lg 2xl:max-w-xl">
        <div className="flex h-full flex-col overflow-y-auto p-6">
          <DocumentFlowFormContainer
            className="flex flex-1 flex-col gap-6"
            onSubmit={(e) => e.preventDefault()}
          >
            <Stepper currentStep={currentStep} setCurrentStep={handleStepChange}>
              <AddTemplateSettingsFormPartial
                onSubmit={onAddGeneralSettings}
                envelope={envelope}
                flowStep={templateFlow.general}
              />
              <EmbedAddTemplateFieldsFormPartial
                onSubmit={onAddTemplateFields}
                flowStep={templateFlow.fields}
              />
            </Stepper>
          </DocumentFlowFormContainer>
        </div>
      </aside>
    </div>
  );
}
