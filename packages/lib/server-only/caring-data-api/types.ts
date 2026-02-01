import { RecipientRole } from '@prisma/client';

export type CaringDataRecipientRole = 'CC' | 'SIGNER' | 'VIEWER' | 'APPROVER' | 'ASSISTANT';

export type CaringDataSigner = {
  documensoSignerId?: number;
  name: string;
  email: string;
  role: CaringDataRecipientRole;
  signingOrder?: number | null;
  contactCategoryKey?: string | null;
};

export type UpdateTemplateSettingsRequest = {
  title: string;
  defaultLanguage: string;
  defaultTimezone: string;
  defaultEmailSubject: string;
  defaultEmailMessage: string;
};

export type UpdateTemplateSettingsResponse = {
  data: {
    id: string;
    formTemplateId: string;
    defaultLanguage: string;
    defaultTimezone: string;
    defaultEmailSubject: string;
    defaultEmailMessage: string;
    createdAt: string;
    updatedAt: string;
  };
};

export type UpdateTemplateSignersRequest = CaringDataSigner[];

export type UpdateTemplateSignersResponse = {
  data: CaringDataSigner[];
};

export type CaringDataApiError = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export const mapRecipientRoleToCaringData = (role: RecipientRole): CaringDataRecipientRole => {
  switch (role) {
    case RecipientRole.CC:
      return 'CC';
    case RecipientRole.SIGNER:
      return 'SIGNER';
    case RecipientRole.VIEWER:
      return 'VIEWER';
    case RecipientRole.APPROVER:
      return 'APPROVER';
    case RecipientRole.ASSISTANT:
      return 'ASSISTANT';
    default:
      return 'SIGNER';
  }
};
