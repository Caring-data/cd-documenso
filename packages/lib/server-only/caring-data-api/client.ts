import { env } from '@documenso/lib/utils/env';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type {
  CaringDataApiError,
  UpdateTemplateSettingsRequest,
  UpdateTemplateSettingsResponse,
  UpdateTemplateSignersRequest,
  UpdateTemplateSignersResponse,
} from './types';

const getBaseUrl = (): string => {
  const url = env('NEXT_PUBLIC_CD_SERVICE_URL');
  if (!url) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'NEXT_PUBLIC_CD_SERVICE_URL is not configured',
    });
  }
  return url;
};

const getApiKey = (): string => {
  const apiKey = env('NEXT_PUBLIC_CD_SERVICE_API_KEY');
  if (!apiKey) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'NEXT_PUBLIC_CD_SERVICE_API_KEY is not configured',
    });
  }
  return apiKey;
};

const handleApiError = async (response: Response): Promise<never> => {
  let errorMessage = `API request failed with status ${response.status}`;
  let errorCode = AppErrorCode.UNKNOWN_ERROR;

  try {
    const errorData = (await response.json()) as CaringDataApiError;
    if (errorData.error) {
      errorMessage = errorData.error.message || errorMessage;
      if (errorData.error.code === 'NOT_FOUND') {
        errorCode = AppErrorCode.NOT_FOUND;
      } else if (errorData.error.code === 'UNAUTHORIZED') {
        errorCode = AppErrorCode.UNAUTHORIZED;
      } else if (errorData.error.code === 'INVALID_REQUEST') {
        errorCode = AppErrorCode.INVALID_REQUEST;
      }
    }
  } catch {
    // If parsing fails, use the default error message
  }

  throw new AppError(errorCode, {
    message: errorMessage,
  });
};

export const updateTemplateSettings = async (
  externalId: string,
  settings: UpdateTemplateSettingsRequest,
): Promise<UpdateTemplateSettingsResponse> => {
  const baseUrl = getBaseUrl();
  const apiKey = getApiKey();

  const url = `${baseUrl}/v1/forms/templates/${externalId}/settings`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(settings),
  });

  if (!response.ok) {
    await handleApiError(response);
  }

  const data = (await response.json()) as UpdateTemplateSettingsResponse;

  if (!data.data?.id) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'Failed to update template settings',
    });
  }

  return data;
};

export const updateTemplateSigners = async (
  externalId: string,
  signers: UpdateTemplateSignersRequest,
): Promise<UpdateTemplateSignersResponse> => {
  const baseUrl = getBaseUrl();
  const apiKey = getApiKey();

  const url = `${baseUrl}/v1/forms/templates/${externalId}/signers`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(signers),
  });

  if (!response.ok) {
    await handleApiError(response);
  }

  const data = (await response.json()) as UpdateTemplateSignersResponse;

  if (!data.data?.length) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'Failed to update template signers',
    });
  }

  return data;
};
