import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { FieldType, RecipientRole } from '@prisma/client';
import {
  Building,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  Clipboard,
  Contact,
  Disc,
  Flag,
  Hash,
  Home,
  Info,
  Mail,
  MapPin,
  Phone,
  Printer,
  Type,
  User,
  UserCheck,
  UserCircle2,
} from 'lucide-react';
import { isDeepEqual } from 'remeda';
import { match } from 'ts-pattern';

import { getBoundingClientRect } from '@documenso/lib/client-only/get-bounding-client-rect';
import { useDocumentElement } from '@documenso/lib/client-only/hooks/use-document-element';
import type { TLocalField } from '@documenso/lib/client-only/hooks/use-editor-fields';
import { useCurrentEnvelopeRender } from '@documenso/lib/client-only/providers/envelope-render-provider';
import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import {
  FIELD_META_DEFAULT_VALUES,
  type TCheckboxFieldMeta,
  type TDateFieldMeta,
  type TDropdownFieldMeta,
  type TEmailFieldMeta,
  type TFieldMetaSchema,
  type TInitialsFieldMeta,
  type TNameFieldMeta,
  type TNumberFieldMeta,
  type TRadioFieldMeta,
  type TSignatureFieldMeta,
  type TTextFieldMeta,
} from '@documenso/lib/types/field-meta';
import { parseMessageDescriptor } from '@documenso/lib/utils/i18n';
import { AnimateGenericFadeInOut } from '@documenso/ui/components/animate/animate-generic-fade-in-out';
import { RECIPIENT_COLOR_STYLES } from '@documenso/ui/lib/recipient-colors';
import { cn } from '@documenso/ui/lib/utils';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import {
  DocumentFlowFormContainerActions,
  DocumentFlowFormContainerContent,
  DocumentFlowFormContainerFooter,
  DocumentFlowFormContainerHeader,
  DocumentFlowFormContainerStep,
} from '@documenso/ui/primitives/document-flow/document-flow-root';
import {
  type DocumentFlowStep,
  FRIENDLY_FIELD_TYPE,
} from '@documenso/ui/primitives/document-flow/types';
import { RecipientSelector } from '@documenso/ui/primitives/recipient-selector';
import { Separator } from '@documenso/ui/primitives/separator';
import { useStep } from '@documenso/ui/primitives/stepper';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@documenso/ui/primitives/tabs';

import { EditorFieldCheckboxForm } from '~/components/forms/editor/editor-field-checkbox-form';
import { EditorFieldDateForm } from '~/components/forms/editor/editor-field-date-form';
import { EditorFieldDropdownForm } from '~/components/forms/editor/editor-field-dropdown-form';
import { EditorFieldEmailForm } from '~/components/forms/editor/editor-field-email-form';
import { EditorFieldInitialsForm } from '~/components/forms/editor/editor-field-initials-form';
import { EditorFieldNameForm } from '~/components/forms/editor/editor-field-name-form';
import { EditorFieldNumberForm } from '~/components/forms/editor/editor-field-number-form';
import { EditorFieldRadioForm } from '~/components/forms/editor/editor-field-radio-form';
import { EditorFieldSignatureForm } from '~/components/forms/editor/editor-field-signature-form';
import { EditorFieldTextForm } from '~/components/forms/editor/editor-field-text-form';

import { useCurrentEmbedTemplateEditor } from '../providers/embed-template-editor-provider';

const MIN_HEIGHT_PX = 12;
const MIN_WIDTH_PX = 36;

const DEFAULT_HEIGHT_PX = MIN_HEIGHT_PX * 2.5;
const DEFAULT_WIDTH_PX = MIN_WIDTH_PX * 2.5;

const FieldSettingsTypeTranslations: Record<FieldType, MessageDescriptor> = {
  [FieldType.SIGNATURE]: msg`Signature Settings`,
  [FieldType.FREE_SIGNATURE]: msg`Free Signature Settings`,
  [FieldType.TEXT]: msg`Text Settings`,
  [FieldType.DATE]: msg`Date Settings`,
  [FieldType.CALENDAR]: msg`Calendar Settings`,
  [FieldType.EMAIL]: msg`Email Settings`,
  [FieldType.NAME]: msg`Name Settings`,
  [FieldType.INITIALS]: msg`Initials Settings`,
  [FieldType.NUMBER]: msg`Number Settings`,
  [FieldType.RADIO]: msg`Radio Settings`,
  [FieldType.CHECKBOX]: msg`Checkbox Settings`,
  [FieldType.DROPDOWN]: msg`Dropdown Settings`,
  [FieldType.RESIDENT_FIRST_NAME]: msg`Resident First Name Settings`,
  [FieldType.RESIDENT_LAST_NAME]: msg`Resident Last Name Settings`,
  [FieldType.RESIDENT_DOB]: msg`Resident Date of Birth Settings`,
  [FieldType.RESIDENT_GENDER_IDENTITY]: msg`Resident Gender Identity Settings`,
  [FieldType.RESIDENT_LOCATION_NAME]: msg`Location Name Settings`,
  [FieldType.RESIDENT_LOCATION_STATE]: msg`Location State Settings`,
  [FieldType.RESIDENT_LOCATION_ADDRESS]: msg`Location Address Settings`,
  [FieldType.RESIDENT_LOCATION_CITY]: msg`Location City Settings`,
  [FieldType.RESIDENT_LOCATION_ZIP_CODE]: msg`Location Zip Code Settings`,
  [FieldType.RESIDENT_LOCATION_COUNTRY]: msg`Location Country Settings`,
  [FieldType.RESIDENT_LOCATION_FAX]: msg`Location Fax Settings`,
  [FieldType.RESIDENT_LOCATION_LICENSING]: msg`Location Licensing Settings`,
  [FieldType.RESIDENT_LOCATION_LICENSING_NAME]: msg`Location Licensing Name Settings`,
  [FieldType.RESIDENT_LOCATION_ADMINISTRATOR_NAME]: msg`Location Admin Name Settings`,
  [FieldType.RESIDENT_LOCATION_ADMINISTRATOR_PHONE]: msg`Location Admin Phone Settings`,
};

export type EmbedAddTemplateFieldsFormProps = {
  flowStep: DocumentFlowStep;
  onSubmit: () => void;
};

export const EmbedAddTemplateFieldsFormPartial = ({
  flowStep,
  onSubmit,
}: EmbedAddTemplateFieldsFormProps) => {
  const { _ } = useLingui();
  const { envelope, editorFields, getRecipientColorKey } = useCurrentEmbedTemplateEditor();
  const { currentEnvelopeItem } = useCurrentEnvelopeRender();

  const recipients = envelope.recipients;
  const { stepIndex, currentStep, totalSteps, previousStep } = useStep();

  const [selectedField, setSelectedField] = useState<FieldType | null>(null);
  const [selectedSigner, setSelectedSigner] = useState<(typeof recipients)[0] | null>(null);

  const selectedFieldFromEditor = useMemo(
    () => structuredClone(editorFields.selectedField),
    [editorFields.selectedField],
  );

  const selectedSignerIndex = recipients.findIndex((r) => r.id === selectedSigner?.id);
  const selectedSignerColor =
    selectedSignerIndex === -1 ? 'blue' : getRecipientColorKey(selectedSigner?.id || 0);

  const { isWithinPageBounds, getPage } = useDocumentElement();

  const [isFieldWithinBounds, setIsFieldWithinBounds] = useState(false);
  const [coords, setCoords] = useState({
    x: 0,
    y: 0,
  });

  const fieldBounds = useRef({
    height: DEFAULT_HEIGHT_PX,
    width: DEFAULT_WIDTH_PX,
  });

  const initialFieldsRef = useRef<TLocalField[]>([]);

  const filterFieldsWithEmptyValues = (
    fields: typeof editorFields.localFields,
    fieldType: string,
  ) =>
    fields
      .filter((field) => field.type === fieldType)
      .filter((field) => {
        if (field.fieldMeta && 'values' in field.fieldMeta) {
          return field.fieldMeta.values?.length === 0;
        }
        return true;
      });

  const emptyCheckboxFields = useMemo(
    () => filterFieldsWithEmptyValues(editorFields.localFields, FieldType.CHECKBOX),
    [editorFields.localFields],
  );

  const emptyRadioFields = useMemo(
    () => filterFieldsWithEmptyValues(editorFields.localFields, FieldType.RADIO),
    [editorFields.localFields],
  );

  const emptySelectFields = useMemo(
    () => filterFieldsWithEmptyValues(editorFields.localFields, FieldType.DROPDOWN),
    [editorFields.localFields],
  );

  const hasErrors =
    emptyCheckboxFields.length > 0 || emptyRadioFields.length > 0 || emptySelectFields.length > 0;

  const isFieldsDisabled = useMemo(() => {
    return !selectedSigner;
  }, [selectedSigner]);

  const onMouseMove = useCallback(
    (event: MouseEvent) => {
      setIsFieldWithinBounds(
        isWithinPageBounds(
          event,
          PDF_VIEWER_PAGE_SELECTOR,
          fieldBounds.current.width,
          fieldBounds.current.height,
        ),
      );

      setCoords({
        x: event.clientX - fieldBounds.current.width / 2,
        y: event.clientY - fieldBounds.current.height / 2,
      });
    },
    [isWithinPageBounds],
  );

  const onMouseClick = useCallback(
    (event: MouseEvent) => {
      if (!selectedField || !selectedSigner || !currentEnvelopeItem) {
        return;
      }

      const $page = getPage(event, PDF_VIEWER_PAGE_SELECTOR);

      if (
        !$page ||
        !isWithinPageBounds(
          event,
          PDF_VIEWER_PAGE_SELECTOR,
          fieldBounds.current.width,
          fieldBounds.current.height,
        )
      ) {
        setSelectedField(null);
        return;
      }

      const { top, left, height, width } = getBoundingClientRect($page);

      const pageNumber = parseInt($page.getAttribute('data-page-number') ?? '1', 10);

      let pageX = ((event.pageX - left) / width) * 100;
      let pageY = ((event.pageY - top) / height) * 100;

      const fieldPageWidth = (fieldBounds.current.width / width) * 100;
      const fieldPageHeight = (fieldBounds.current.height / height) * 100;

      pageX -= fieldPageWidth / 2;
      pageY -= fieldPageHeight / 2;

      editorFields.addField({
        envelopeItemId: currentEnvelopeItem.id,
        type: selectedField,
        page: pageNumber,
        positionX: pageX,
        positionY: pageY,
        width: fieldPageWidth,
        height: fieldPageHeight,
        recipientId: selectedSigner.id,
        fieldMeta: structuredClone(FIELD_META_DEFAULT_VALUES[selectedField]),
      });

      setIsFieldWithinBounds(false);
      setSelectedField(null);
    },
    [editorFields, isWithinPageBounds, selectedField, selectedSigner, getPage, currentEnvelopeItem],
  );

  useEffect(() => {
    if (selectedField) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseClick);
    }

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseClick);
    };
  }, [onMouseClick, onMouseMove, selectedField]);

  useEffect(() => {
    const recipientsByRoleToDisplay = recipients.filter(
      (recipient) =>
        recipient.role !== RecipientRole.CC && recipient.role !== RecipientRole.ASSISTANT,
    );

    const firstRecipient = recipientsByRoleToDisplay[0] ?? null;
    setSelectedSigner(firstRecipient);

    if (firstRecipient) {
      editorFields.setSelectedRecipient(firstRecipient.id);
    }
  }, [recipients]);

  useEffect(() => {
    if (initialFieldsRef.current.length === 0 && editorFields.localFields.length > 0) {
      initialFieldsRef.current = editorFields.localFields.map((field) => structuredClone(field));
    }
  }, [editorFields.localFields]);

  const handleRecipientChange = (recipient: (typeof recipients)[0] | null) => {
    setSelectedSigner(recipient);
    if (recipient) {
      editorFields.setSelectedRecipient(recipient.id);
    }
  };

  const normalizeFieldForComparison = (field: TLocalField) => {
    const safeNumber = (value: number) => {
      if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
        return 0;
      }
      return Number(value.toFixed(2));
    };

    return {
      envelopeItemId: field.envelopeItemId,
      recipientId: field.recipientId,
      type: field.type,
      page: field.page,
      positionX: safeNumber(field.positionX),
      positionY: safeNumber(field.positionY),
      width: safeNumber(field.width),
      height: safeNumber(field.height),
      fieldMeta: field.fieldMeta,
    };
  };

  const hasFieldsChanged = (current: TLocalField[], initial: TLocalField[]): boolean => {
    // Check if field count changed
    if (current.length !== initial.length) {
      return true;
    }

    // Check if any field properties changed (normalize for comparison)
    for (let i = 0; i < current.length; i++) {
      const currentField = normalizeFieldForComparison(current[i]);
      const initialField = normalizeFieldForComparison(initial[i]);

      if (
        currentField.envelopeItemId !== initialField.envelopeItemId ||
        currentField.recipientId !== initialField.recipientId ||
        currentField.type !== initialField.type ||
        currentField.page !== initialField.page ||
        currentField.positionX !== initialField.positionX ||
        currentField.positionY !== initialField.positionY ||
        currentField.width !== initialField.width ||
        currentField.height !== initialField.height ||
        !isDeepEqual(currentField.fieldMeta, initialField.fieldMeta)
      ) {
        return true;
      }
    }

    return false;
  };

  const updateSelectedFieldMeta = (fieldMeta: TFieldMetaSchema) => {
    if (!selectedFieldFromEditor) {
      return;
    }

    const isMetaSame = isDeepEqual(selectedFieldFromEditor.fieldMeta, fieldMeta);

    if (!isMetaSame) {
      editorFields.updateFieldByFormId(selectedFieldFromEditor.formId, {
        fieldMeta,
      });
    }
  };

  const handleGoNextClick = async () => {
    // Check if fields have changed
    if (!hasFieldsChanged(editorFields.localFields, initialFieldsRef.current)) {
      // No changes, just proceed
      return;
    }

    // Fields have changed, save them
    await onSubmit();
  };

  return (
    <div className="flex h-full flex-col">
      <DocumentFlowFormContainerHeader title={flowStep.title} description={flowStep.description} />

      <DocumentFlowFormContainerContent>
        <div className="mt-2 flex flex-col">
          {selectedField && (
            <div
              className={cn(
                'dark:text-muted-background pointer-events-none fixed z-50 flex cursor-pointer flex-col items-center justify-center rounded-[2px] bg-white text-muted-foreground ring-2 transition duration-200 [container-type:size]',
                RECIPIENT_COLOR_STYLES[selectedSignerColor]?.base,
                {
                  '-rotate-6 scale-90 opacity-50 dark:bg-black/20': !isFieldWithinBounds,
                  'dark:text-black/60': isFieldWithinBounds,
                },
              )}
              style={{
                top: coords.y,
                left: coords.x,
                height: fieldBounds.current.height,
                width: fieldBounds.current.width,
              }}
            >
              <span className="text-[clamp(0.425rem,25cqw,0.825rem)]">
                {parseMessageDescriptor(_, FRIENDLY_FIELD_TYPE[selectedField])}
              </span>
            </div>
          )}

          <RecipientSelector
            selectedRecipient={selectedSigner}
            onSelectedRecipientChange={handleRecipientChange}
            recipients={recipients}
            className="mb-4"
          />

          <div className="-mx-2 flex-1 px-2">
            <Tabs defaultValue="default" className="w-full">
              <TabsList className="mb-4 flex w-full flex-col items-stretch gap-1 sm:flex-row sm:items-center sm:justify-start">
                <TabsTrigger className="w-full sm:w-auto" value="default">
                  <Trans>Main Fields</Trans>
                </TabsTrigger>

                <TabsTrigger className="w-full sm:w-auto" value="resident">
                  <Trans>Resident Fields</Trans>
                </TabsTrigger>

                <TabsTrigger className="w-full sm:w-auto" value="resident-location">
                  <Trans>Location Fields</Trans>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="default">
                <fieldset disabled={isFieldsDisabled} className="my-2 grid grid-cols-3 gap-4">
                  <FieldButton
                    type={FieldType.SIGNATURE}
                    selectedField={selectedField}
                    onSelect={setSelectedField}
                    label={<Trans>Signature</Trans>}
                    className="font-signature text-[16px]"
                  />

                  <FieldButton
                    type={FieldType.INITIALS}
                    selectedField={selectedField}
                    onSelect={setSelectedField}
                    icon={Contact}
                    label="Initials"
                  />

                  <FieldButton
                    type={FieldType.EMAIL}
                    selectedField={selectedField}
                    onSelect={setSelectedField}
                    icon={Mail}
                    label={<Trans>Email</Trans>}
                  />

                  <FieldButton
                    type={FieldType.NAME}
                    selectedField={selectedField}
                    onSelect={setSelectedField}
                    icon={User}
                    label={<Trans>Name</Trans>}
                  />

                  <FieldButton
                    type={FieldType.DATE}
                    selectedField={selectedField}
                    onSelect={setSelectedField}
                    icon={CalendarDays}
                    label={<Trans>Date</Trans>}
                  />

                  <FieldButton
                    type={FieldType.CALENDAR}
                    selectedField={selectedField}
                    onSelect={setSelectedField}
                    icon={CalendarDays}
                    label={<Trans>Calendar</Trans>}
                  />

                  <FieldButton
                    type={FieldType.TEXT}
                    selectedField={selectedField}
                    onSelect={setSelectedField}
                    icon={Type}
                    label={<Trans>Text</Trans>}
                  />

                  <FieldButton
                    type={FieldType.NUMBER}
                    selectedField={selectedField}
                    onSelect={setSelectedField}
                    icon={Hash}
                    label={<Trans>Number</Trans>}
                  />

                  <FieldButton
                    type={FieldType.RADIO}
                    selectedField={selectedField}
                    onSelect={setSelectedField}
                    icon={Disc}
                    label="Radio"
                  />

                  <FieldButton
                    type={FieldType.CHECKBOX}
                    selectedField={selectedField}
                    onSelect={setSelectedField}
                    icon={CheckSquare}
                    label="Checkbox"
                  />

                  <FieldButton
                    type={FieldType.DROPDOWN}
                    selectedField={selectedField}
                    onSelect={setSelectedField}
                    icon={ChevronDown}
                    label={<Trans>Dropdown</Trans>}
                  />
                </fieldset>
              </TabsContent>

              <TabsContent value="resident">
                <>
                  <fieldset disabled={isFieldsDisabled} className="grid grid-cols-2 gap-4">
                    <FieldButton
                      type={FieldType.RESIDENT_FIRST_NAME}
                      selectedField={selectedField}
                      onSelect={setSelectedField}
                      icon={User}
                      label={<Trans>First Name</Trans>}
                    />

                    <FieldButton
                      type={FieldType.RESIDENT_LAST_NAME}
                      selectedField={selectedField}
                      onSelect={setSelectedField}
                      icon={User}
                      label={<Trans>Last Name</Trans>}
                    />

                    <FieldButton
                      type={FieldType.RESIDENT_DOB}
                      selectedField={selectedField}
                      onSelect={setSelectedField}
                      icon={CalendarDays}
                      label={<Trans>Date of Birth</Trans>}
                    />

                    <FieldButton
                      type={FieldType.RESIDENT_GENDER_IDENTITY}
                      selectedField={selectedField}
                      onSelect={setSelectedField}
                      icon={UserCircle2}
                      label={<Trans>Gender Identity</Trans>}
                    />
                  </fieldset>
                  <div className="mb-1 mt-2 flex items-start gap-1">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 items-center text-zinc-400" />
                    <span className="inline-flex max-w-full py-0.5 text-sm leading-snug text-zinc-700">
                      These fields will auto-fill when the document is sent.
                    </span>
                  </div>
                </>
              </TabsContent>

              <TabsContent value="resident-location">
                <fieldset disabled={isFieldsDisabled} className="grid gap-4 sm:grid-cols-2">
                  <FieldButton
                    type={FieldType.RESIDENT_LOCATION_NAME}
                    selectedField={selectedField}
                    onSelect={setSelectedField}
                    icon={Building}
                    label={<Trans>Location Name</Trans>}
                  />

                  <FieldButton
                    type={FieldType.RESIDENT_LOCATION_STATE}
                    selectedField={selectedField}
                    onSelect={setSelectedField}
                    icon={Flag}
                    label={<Trans>State</Trans>}
                  />

                  <FieldButton
                    type={FieldType.RESIDENT_LOCATION_ADDRESS}
                    selectedField={selectedField}
                    onSelect={setSelectedField}
                    icon={Home}
                    label={<Trans>Address</Trans>}
                  />

                  <FieldButton
                    type={FieldType.RESIDENT_LOCATION_CITY}
                    selectedField={selectedField}
                    onSelect={setSelectedField}
                    icon={Building}
                    label={<Trans>City</Trans>}
                  />

                  <FieldButton
                    type={FieldType.RESIDENT_LOCATION_ZIP_CODE}
                    selectedField={selectedField}
                    onSelect={setSelectedField}
                    icon={Hash}
                    label={<Trans>ZIP Code</Trans>}
                  />

                  <FieldButton
                    type={FieldType.RESIDENT_LOCATION_COUNTRY}
                    selectedField={selectedField}
                    onSelect={setSelectedField}
                    icon={MapPin}
                    label={<Trans>Country</Trans>}
                  />

                  <FieldButton
                    type={FieldType.RESIDENT_LOCATION_FAX}
                    selectedField={selectedField}
                    onSelect={setSelectedField}
                    icon={Printer}
                    label={<Trans>Fax</Trans>}
                  />

                  <FieldButton
                    type={FieldType.RESIDENT_LOCATION_LICENSING}
                    selectedField={selectedField}
                    onSelect={setSelectedField}
                    icon={Clipboard}
                    label={<Trans>Licensing</Trans>}
                  />

                  <FieldButton
                    type={FieldType.RESIDENT_LOCATION_LICENSING_NAME}
                    selectedField={selectedField}
                    onSelect={setSelectedField}
                    icon={UserCircle2}
                    label={<Trans>Licensing Name</Trans>}
                  />

                  <FieldButton
                    type={FieldType.RESIDENT_LOCATION_ADMINISTRATOR_NAME}
                    selectedField={selectedField}
                    onSelect={setSelectedField}
                    icon={UserCheck}
                    label={<Trans>Admin Name</Trans>}
                  />

                  <FieldButton
                    type={FieldType.RESIDENT_LOCATION_ADMINISTRATOR_PHONE}
                    selectedField={selectedField}
                    onSelect={setSelectedField}
                    icon={Phone}
                    label={<Trans>Admin Phone</Trans>}
                  />
                </fieldset>
              </TabsContent>
            </Tabs>
          </div>

          <AnimateGenericFadeInOut key={editorFields.selectedField?.formId}>
            {selectedFieldFromEditor && (
              <div className="mt-4">
                <Separator className="my-4" />

                <div className="px-4 [&_label]:text-xs [&_label]:text-foreground/70">
                  <h3 className="text-sm font-semibold">
                    {_(FieldSettingsTypeTranslations[selectedFieldFromEditor.type])}
                  </h3>

                  {match(selectedFieldFromEditor.type)
                    .with(FieldType.SIGNATURE, () => (
                      <EditorFieldSignatureForm
                        value={
                          selectedFieldFromEditor?.fieldMeta as TSignatureFieldMeta | undefined
                        }
                        onValueChange={(value) => updateSelectedFieldMeta(value)}
                      />
                    ))
                    .with(FieldType.CHECKBOX, () => (
                      <EditorFieldCheckboxForm
                        value={selectedFieldFromEditor?.fieldMeta as TCheckboxFieldMeta | undefined}
                        onValueChange={(value) => updateSelectedFieldMeta(value)}
                      />
                    ))
                    .with(FieldType.DATE, () => (
                      <EditorFieldDateForm
                        value={selectedFieldFromEditor?.fieldMeta as TDateFieldMeta | undefined}
                        onValueChange={(value) => updateSelectedFieldMeta(value)}
                      />
                    ))
                    .with(FieldType.CALENDAR, () => (
                      <EditorFieldDateForm
                        value={selectedFieldFromEditor?.fieldMeta as TDateFieldMeta | undefined}
                        onValueChange={(value) => updateSelectedFieldMeta(value)}
                      />
                    ))
                    .with(FieldType.DROPDOWN, () => (
                      <EditorFieldDropdownForm
                        value={selectedFieldFromEditor?.fieldMeta as TDropdownFieldMeta | undefined}
                        onValueChange={(value) => updateSelectedFieldMeta(value)}
                      />
                    ))
                    .with(FieldType.EMAIL, () => (
                      <EditorFieldEmailForm
                        value={selectedFieldFromEditor?.fieldMeta as TEmailFieldMeta | undefined}
                        onValueChange={(value) => updateSelectedFieldMeta(value)}
                      />
                    ))
                    .with(FieldType.INITIALS, () => (
                      <EditorFieldInitialsForm
                        value={selectedFieldFromEditor?.fieldMeta as TInitialsFieldMeta | undefined}
                        onValueChange={(value) => updateSelectedFieldMeta(value)}
                      />
                    ))
                    .with(FieldType.NAME, () => (
                      <EditorFieldNameForm
                        value={selectedFieldFromEditor?.fieldMeta as TNameFieldMeta | undefined}
                        onValueChange={(value) => updateSelectedFieldMeta(value)}
                      />
                    ))
                    .with(FieldType.NUMBER, () => (
                      <EditorFieldNumberForm
                        value={selectedFieldFromEditor?.fieldMeta as TNumberFieldMeta | undefined}
                        onValueChange={(value) => updateSelectedFieldMeta(value)}
                      />
                    ))
                    .with(FieldType.RADIO, () => (
                      <EditorFieldRadioForm
                        value={selectedFieldFromEditor?.fieldMeta as TRadioFieldMeta | undefined}
                        onValueChange={(value) => updateSelectedFieldMeta(value)}
                      />
                    ))
                    .with(FieldType.TEXT, () => (
                      <EditorFieldTextForm
                        value={selectedFieldFromEditor?.fieldMeta as TTextFieldMeta | undefined}
                        onValueChange={(value) => updateSelectedFieldMeta(value)}
                      />
                    ))
                    .with(FieldType.RESIDENT_FIRST_NAME, () => (
                      <EditorFieldTextForm
                        value={selectedFieldFromEditor?.fieldMeta as TTextFieldMeta | undefined}
                        onValueChange={(value) => updateSelectedFieldMeta(value)}
                      />
                    ))
                    .with(FieldType.RESIDENT_LAST_NAME, () => (
                      <EditorFieldTextForm
                        value={selectedFieldFromEditor?.fieldMeta as TTextFieldMeta | undefined}
                        onValueChange={(value) => updateSelectedFieldMeta(value)}
                      />
                    ))
                    .with(FieldType.RESIDENT_DOB, () => (
                      <EditorFieldDateForm
                        value={selectedFieldFromEditor?.fieldMeta as TDateFieldMeta | undefined}
                        onValueChange={(value) => updateSelectedFieldMeta(value)}
                      />
                    ))
                    .with(FieldType.RESIDENT_GENDER_IDENTITY, () => (
                      <EditorFieldTextForm
                        value={selectedFieldFromEditor?.fieldMeta as TTextFieldMeta | undefined}
                        onValueChange={(value) => updateSelectedFieldMeta(value)}
                      />
                    ))
                    .with(FieldType.RESIDENT_LOCATION_NAME, () => (
                      <EditorFieldTextForm
                        value={selectedFieldFromEditor?.fieldMeta as TTextFieldMeta | undefined}
                        onValueChange={(value) => updateSelectedFieldMeta(value)}
                      />
                    ))
                    .with(FieldType.RESIDENT_LOCATION_STATE, () => (
                      <EditorFieldTextForm
                        value={selectedFieldFromEditor?.fieldMeta as TTextFieldMeta | undefined}
                        onValueChange={(value) => updateSelectedFieldMeta(value)}
                      />
                    ))
                    .with(FieldType.RESIDENT_LOCATION_ADDRESS, () => (
                      <EditorFieldTextForm
                        value={selectedFieldFromEditor?.fieldMeta as TTextFieldMeta | undefined}
                        onValueChange={(value) => updateSelectedFieldMeta(value)}
                      />
                    ))
                    .with(FieldType.RESIDENT_LOCATION_CITY, () => (
                      <EditorFieldTextForm
                        value={selectedFieldFromEditor?.fieldMeta as TTextFieldMeta | undefined}
                        onValueChange={(value) => updateSelectedFieldMeta(value)}
                      />
                    ))
                    .with(FieldType.RESIDENT_LOCATION_ZIP_CODE, () => (
                      <EditorFieldTextForm
                        value={selectedFieldFromEditor?.fieldMeta as TTextFieldMeta | undefined}
                        onValueChange={(value) => updateSelectedFieldMeta(value)}
                      />
                    ))
                    .with(FieldType.RESIDENT_LOCATION_COUNTRY, () => (
                      <EditorFieldTextForm
                        value={selectedFieldFromEditor?.fieldMeta as TTextFieldMeta | undefined}
                        onValueChange={(value) => updateSelectedFieldMeta(value)}
                      />
                    ))
                    .with(FieldType.RESIDENT_LOCATION_FAX, () => (
                      <EditorFieldTextForm
                        value={selectedFieldFromEditor?.fieldMeta as TTextFieldMeta | undefined}
                        onValueChange={(value) => updateSelectedFieldMeta(value)}
                      />
                    ))
                    .with(FieldType.RESIDENT_LOCATION_LICENSING, () => (
                      <EditorFieldTextForm
                        value={selectedFieldFromEditor?.fieldMeta as TTextFieldMeta | undefined}
                        onValueChange={(value) => updateSelectedFieldMeta(value)}
                      />
                    ))
                    .with(FieldType.RESIDENT_LOCATION_LICENSING_NAME, () => (
                      <EditorFieldTextForm
                        value={selectedFieldFromEditor?.fieldMeta as TTextFieldMeta | undefined}
                        onValueChange={(value) => updateSelectedFieldMeta(value)}
                      />
                    ))
                    .with(FieldType.RESIDENT_LOCATION_ADMINISTRATOR_NAME, () => (
                      <EditorFieldTextForm
                        value={selectedFieldFromEditor?.fieldMeta as TTextFieldMeta | undefined}
                        onValueChange={(value) => updateSelectedFieldMeta(value)}
                      />
                    ))
                    .with(FieldType.RESIDENT_LOCATION_ADMINISTRATOR_PHONE, () => (
                      <EditorFieldTextForm
                        value={selectedFieldFromEditor?.fieldMeta as TTextFieldMeta | undefined}
                        onValueChange={(value) => updateSelectedFieldMeta(value)}
                      />
                    ))
                    .otherwise(() => null)}
                </div>
              </div>
            )}
          </AnimateGenericFadeInOut>
        </div>
      </DocumentFlowFormContainerContent>

      {hasErrors && (
        <div className="mt-4">
          <ul>
            <li className="text-sm text-red-500">
              <Trans>
                To proceed further, please set at least one value for the{' '}
                {emptyCheckboxFields.length > 0
                  ? 'Checkbox'
                  : emptyRadioFields.length > 0
                    ? 'Radio'
                    : 'Select'}{' '}
                field.
              </Trans>
            </li>
          </ul>
        </div>
      )}

      <DocumentFlowFormContainerFooter>
        <DocumentFlowFormContainerStep step={currentStep} maxStep={totalSteps} />

        <DocumentFlowFormContainerActions
          loading={false}
          disabled={false}
          disableNextStep={hasErrors}
          canGoBack={stepIndex !== 0}
          onGoBackClick={previousStep}
          onGoNextClick={handleGoNextClick}
        />
      </DocumentFlowFormContainerFooter>
    </div>
  );
};

type FieldButtonProps = {
  type: FieldType;
  selectedField: FieldType | null;
  onSelect: (type: FieldType) => void;
  icon?: React.ComponentType<{ className?: string }>;
  label: React.ReactNode;
  className?: string;
};

const FieldButton = ({
  type,
  selectedField,
  onSelect,
  icon: Icon,
  label,
  className,
}: FieldButtonProps) => {
  return (
    <button
      type="button"
      className="group h-full w-full"
      onClick={() => {
        onSelect(type);
      }}
      onMouseDown={() => {
        onSelect(type);
      }}
      data-selected={selectedField === type ? true : undefined}
    >
      <Card
        className={cn(
          'flex h-full w-full cursor-pointer items-center justify-center group-disabled:opacity-50',
        )}
      >
        <CardContent className="flex flex-col items-center justify-center px-5 py-[10px]">
          <p
            className={cn(
              'flex items-center justify-center gap-x-1.5 text-sm font-normal text-muted-foreground group-data-[selected]:text-foreground',
              className,
            )}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {label}
          </p>
        </CardContent>
      </Card>
    </button>
  );
};
