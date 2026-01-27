import { initContract } from '@ts-rest/core';

import {
  ZCreateTemplateBase64RequestSchema,
  ZCreateTemplateBase64ResponseSchema,
  ZCreateTemplateV2RequestSchema,
  ZCreateTemplateV2ResponseSchema,
} from '@documenso/trpc/server/template-router/schema';

import {
  ZApiKeyHeadersSchema,
  ZAuthorizationHeadersSchema,
  ZCreateDocumentFromTemplateMutationResponseSchema,
  ZCreateDocumentFromTemplateMutationSchema,
  ZCreateDocumentMutationResponseSchema,
  ZCreateDocumentMutationSchema,
  ZCreateEmbebedTemplateMutationSchema,
  ZCreateEmbebedTemplateResponseSchema,
  ZCreateFieldMutationSchema,
  ZCreateRecipientMutationSchema,
  ZCreateUserRequestSchema,
  ZDeleteDocumentMutationSchema,
  ZDeleteFieldMutationSchema,
  ZDeleteRecipientMutationSchema,
  ZDownloadDocumentQuerySchema,
  ZDownloadDocumentSuccessfulSchema,
  ZGenerateDocumentFromTemplateBase64MutationSchema,
  ZGenerateDocumentFromTemplateMutationResponseSchema,
  ZGenerateDocumentFromTemplateMutationSchema,
  ZGetDocumentsQuerySchema,
  ZGetSignatureAuditResponseSchema,
  ZGetTemplatesQuerySchema,
  ZGetUsersQuerySchema,
  ZNoBodyMutationSchema,
  ZResendDocumentByEmailSchema,
  ZResendDocumentForSigningMutationSchema,
  ZSendDocumentForSigningMutationSchema,
  ZSuccessfulDeleteTemplateResponseSchema,
  ZSuccessfulDocumentResponseSchema,
  ZSuccessfulFieldCreationResponseSchema,
  ZSuccessfulFieldResponseSchema,
  ZSuccessfulGetDocumentResponseSchema,
  ZSuccessfulGetTemplateResponseSchema,
  ZSuccessfulGetTemplatesResponseSchema,
  ZSuccessfulGetUsersResponseSchema,
  ZSuccessfulRecipientResponseSchema,
  ZSuccessfulResendDocumentResponseSchema,
  ZSuccessfulResponseSchema,
  ZSuccessfulSigningResponseSchema,
  ZUnsuccessfulResponseSchema,
  ZUpdateFieldMutationSchema,
  ZUpdateRecipientMutationSchema,
  ZUpdateUserRequestSchema,
  ZUserResponseSchema,
} from './schema';

const c = initContract();

export const ApiContractV1 = c.router(
  {
    getDocuments: {
      method: 'GET',
      path: '/api/v1/documents',
      query: ZGetDocumentsQuerySchema,
      responses: {
        200: ZSuccessfulResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
      },
      summary: 'Get all documents',
    },

    getDocument: {
      method: 'GET',
      path: '/api/v1/documents/:id',
      responses: {
        200: ZSuccessfulGetDocumentResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
      },
      summary: 'Get a single document',
    },

    getSignatureAudit: {
      method: 'GET',
      path: '/api/v1/documents/:id/signature-audit',
      responses: {
        200: ZGetSignatureAuditResponseSchema,
        404: ZUnsuccessfulResponseSchema,
        500: ZUnsuccessfulResponseSchema,
      },
      summary: 'Get electronic signature audit trail for a document',
    },

    downloadSignedDocument: {
      method: 'GET',
      path: '/api/v1/documents/:id/download',
      query: ZDownloadDocumentQuerySchema,
      responses: {
        200: ZDownloadDocumentSuccessfulSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
      },
      summary: 'Download a signed document when the storage transport is S3',
    },

    createDocument: {
      method: 'POST',
      path: '/api/v1/documents',
      body: ZCreateDocumentMutationSchema,
      responses: {
        200: ZCreateDocumentMutationResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
      },
      summary: 'Upload a new document and get a presigned URL',
    },

    createTemplate: {
      method: 'POST',
      path: '/api/v1/templates',
      body: ZCreateTemplateV2RequestSchema,
      responses: {
        200: ZCreateTemplateV2ResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
      },
      summary: 'Create a new template and get a presigned URL',
    },

    createTemplateBase64: {
      method: 'POST',
      path: '/api/v1/templates/base64',
      body: ZCreateTemplateBase64RequestSchema,
      responses: {
        200: ZCreateTemplateBase64ResponseSchema,
        400: ZUnsuccessfulResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        500: ZUnsuccessfulResponseSchema,
      },
      summary: 'Create a new template with base64 PDF data',
      description:
        'Create a template by directly uploading base64 encoded PDF data. Does not require S3 configuration.',
    },

    createEmbebedTemplate: {
      method: 'POST',
      path: '/api/v1/templates/embed',
      body: ZCreateEmbebedTemplateMutationSchema,
      responses: {
        200: ZCreateEmbebedTemplateResponseSchema,
        400: ZUnsuccessfulResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
        500: ZUnsuccessfulResponseSchema,
      },
      summary: 'Create a new template for embedding',
      description: 'Create a new template for embedding',
    },

    deleteTemplate: {
      method: 'DELETE',
      path: '/api/v1/templates/:id',
      body: ZNoBodyMutationSchema,
      responses: {
        200: ZSuccessfulDeleteTemplateResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
      },
      summary: 'Delete a template',
    },

    getTemplate: {
      method: 'GET',
      path: '/api/v1/templates/:id',
      responses: {
        200: ZSuccessfulGetTemplateResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
      },
      summary: 'Get a single template',
    },

    getTemplates: {
      method: 'GET',
      path: '/api/v1/templates',
      query: ZGetTemplatesQuerySchema,
      responses: {
        200: ZSuccessfulGetTemplatesResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
      },
      summary: 'Get all templates',
    },

    createDocumentFromTemplate: {
      method: 'POST',
      path: '/api/v1/templates/:templateId/create-document',
      body: ZCreateDocumentFromTemplateMutationSchema,
      responses: {
        200: ZCreateDocumentFromTemplateMutationResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
      },
      summary: 'Create a new document from an existing template',
      deprecated: true,
      description: `This has been deprecated in favour of "/api/v1/templates/:templateId/generate-document". You may face unpredictable behavior using this endpoint as it is no longer maintained.`,
    },

    generateDocumentFromTemplate: {
      method: 'POST',
      path: '/api/v1/templates/:templateId/generate-document',
      body: ZGenerateDocumentFromTemplateMutationSchema,
      responses: {
        200: ZGenerateDocumentFromTemplateMutationResponseSchema,
        400: ZUnsuccessfulResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
        500: ZUnsuccessfulResponseSchema,
      },
      summary: 'Create a new document from an existing template',
      description:
        'Create a new document from an existing template. Passing in values for title and meta will override the original values defined in the template. If you do not pass in values for recipients, it will use the values defined in the template.',
    },

    generateDocumentFromTemplateBase64: {
      method: 'POST',
      path: '/api/v1/templates/:templateId/generate-document-base64',
      body: ZGenerateDocumentFromTemplateBase64MutationSchema,
      responses: {
        200: ZGenerateDocumentFromTemplateMutationResponseSchema,
        400: ZUnsuccessfulResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
        500: ZUnsuccessfulResponseSchema,
      },
      summary: 'Create a document from a template using a dynamic PDF',
      description:
        'Creates a new document using the configuration from the template but replaces the template PDF with a dynamically provided base64 encoded PDF. Useful when the document content is generated at runtime.',
    },

    sendDocument: {
      method: 'POST',
      path: '/api/v1/documents/:id/send',
      body: ZSendDocumentForSigningMutationSchema,
      responses: {
        200: ZSuccessfulSigningResponseSchema,
        400: ZUnsuccessfulResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
        500: ZUnsuccessfulResponseSchema,
      },
      summary: 'Send a document for signing',
      // I'm aware this should be in the variable itself, which it is, however it's difficult for users to find in our current UI.
      description:
        'Notes\n\n`sendEmail` - Whether to send an email to the recipients asking them to action the document. If you disable this, you will need to manually distribute the document to the recipients using the generated signing links. Defaults to true',
    },

    resendDocument: {
      method: 'POST',
      path: '/api/v1/documents/:id/resend',
      body: ZResendDocumentForSigningMutationSchema,
      responses: {
        200: ZSuccessfulResendDocumentResponseSchema,
        400: ZUnsuccessfulResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
        500: ZUnsuccessfulResponseSchema,
      },
      summary: 'Re-send a document for signing',
    },

    resendDocumentByEmail: {
      method: 'POST',
      path: '/api/v1/documents/:id/resendByEmail',
      body: ZResendDocumentByEmailSchema,
      responses: {
        200: ZSuccessfulResendDocumentResponseSchema,
        400: ZUnsuccessfulResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
        500: ZUnsuccessfulResponseSchema,
      },
      summary: 'Re-send a document for a specific recipient email',
    },

    deleteDocument: {
      method: 'DELETE',
      path: '/api/v1/documents/:id',
      body: ZDeleteDocumentMutationSchema,
      responses: {
        200: ZSuccessfulDocumentResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
      },
      summary: 'Delete a document',
    },

    createRecipient: {
      method: 'POST',
      path: '/api/v1/documents/:id/recipients',
      body: ZCreateRecipientMutationSchema,
      responses: {
        200: ZSuccessfulRecipientResponseSchema,
        400: ZUnsuccessfulResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
        500: ZUnsuccessfulResponseSchema,
      },
      summary: 'Create a recipient for a document',
    },

    updateRecipient: {
      method: 'PATCH',
      path: '/api/v1/documents/:id/recipients/:recipientId',
      body: ZUpdateRecipientMutationSchema,
      responses: {
        200: ZSuccessfulRecipientResponseSchema,
        400: ZUnsuccessfulResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
        500: ZUnsuccessfulResponseSchema,
      },
      summary: 'Update a recipient for a document',
    },

    deleteRecipient: {
      method: 'DELETE',
      path: '/api/v1/documents/:id/recipients/:recipientId',
      body: ZDeleteRecipientMutationSchema,
      responses: {
        200: ZSuccessfulRecipientResponseSchema,
        400: ZUnsuccessfulResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
        500: ZUnsuccessfulResponseSchema,
      },
      summary: 'Delete a recipient from a document',
    },

    createField: {
      method: 'POST',
      path: '/api/v1/documents/:id/fields',
      body: ZCreateFieldMutationSchema,
      responses: {
        200: ZSuccessfulFieldCreationResponseSchema,
        400: ZUnsuccessfulResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
        500: ZUnsuccessfulResponseSchema,
      },
      summary: 'Create a field for a document',
    },

    updateField: {
      method: 'PATCH',
      path: '/api/v1/documents/:id/fields/:fieldId',
      body: ZUpdateFieldMutationSchema,
      responses: {
        200: ZSuccessfulFieldResponseSchema,
        400: ZUnsuccessfulResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
        500: ZUnsuccessfulResponseSchema,
      },
      summary: 'Update a field for a document',
    },

    deleteField: {
      method: 'DELETE',
      path: '/api/v1/documents/:id/fields/:fieldId',
      body: ZDeleteFieldMutationSchema,
      responses: {
        200: ZSuccessfulFieldResponseSchema,
        400: ZUnsuccessfulResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
        500: ZUnsuccessfulResponseSchema,
      },
      summary: 'Delete a field from a document',
    },
  },
  {
    baseHeaders: ZAuthorizationHeadersSchema,
  },
);

export const ApiContractV1Users = c.router(
  {
    createUser: {
      method: 'POST',
      path: '/api/v1/users',
      body: ZCreateUserRequestSchema,
      responses: {
        200: ZUserResponseSchema,
        400: ZUnsuccessfulResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        500: ZUnsuccessfulResponseSchema,
      },
      summary: 'Create a new user',
    },

    getUsers: {
      method: 'GET',
      path: '/api/v1/users',
      query: ZGetUsersQuerySchema,
      responses: {
        200: ZSuccessfulGetUsersResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        500: ZUnsuccessfulResponseSchema,
      },
      summary: 'Get all users',
    },

    getUser: {
      method: 'GET',
      path: '/api/v1/users/:id',
      responses: {
        200: ZUserResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
        500: ZUnsuccessfulResponseSchema,
      },
      summary: 'Get a single user',
    },

    updateUser: {
      method: 'PUT',
      path: '/api/v1/users/:id',
      body: ZUpdateUserRequestSchema,
      responses: {
        200: ZUserResponseSchema,
        400: ZUnsuccessfulResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
        500: ZUnsuccessfulResponseSchema,
      },
      summary: 'Update a user',
    },

    deleteUser: {
      method: 'DELETE',
      path: '/api/v1/users/:id',
      body: ZNoBodyMutationSchema,
      responses: {
        200: ZUserResponseSchema,
        401: ZUnsuccessfulResponseSchema,
        404: ZUnsuccessfulResponseSchema,
        500: ZUnsuccessfulResponseSchema,
      },
      summary: 'Delete a user',
    },
  },
  {
    baseHeaders: ZApiKeyHeadersSchema,
  },
);
