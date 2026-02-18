import { useQuery } from '@tanstack/react-query';

import { env } from '../../utils/env';

export type UseGetDocumentContextOptions = {
  ownerId: string;
  module: 'resident' | 'staff' | 'facility' | 'reports' | null | undefined;
};

type LocationState = {
  id: string;
  name: string;
  code: string;
};

type LocationContext = {
  id: string;
  name?: string | null;
  state_id?: string | null;
  address?: string | null;
  city?: string | null;
  zip?: string | null;
  country?: string | null;
  location_fax?: string | null;
  licensing?: string | null;
  licensing_name?: string | null;
  admin?: string | null;
  phone_lic?: string | null;
  status?: string | null;
  deleted_at?: Date | string | null;
  state?: LocationState | null;
};

export type DocumentContext = {
  resident?: {
    first_name: string;
    last_name: string;
    dob: string;
    gender_identity: string;
  };
  location?: LocationContext;
};

export const useGetDocumentContext = ({ ownerId, module }: UseGetDocumentContextOptions) => {
  return useQuery<DocumentContext>({
    queryKey: ['document-context', module, ownerId],
    queryFn: async () => {
      const baseUrl = env('NEXT_PUBLIC_CD_SERVICE_URL');
      const apiKey = env('NEXT_PUBLIC_CD_SERVICE_API_KEY');

      if (!baseUrl) throw new Error('NEXT_PUBLIC_CD_SERVICE_URL is not configured');
      if (!apiKey) throw new Error('NEXT_PUBLIC_CD_SERVICE_API_KEY is not configured');
      if (!module) throw new Error('module is required');

      const url = new URL(`${baseUrl}/v1/residents/document-context/${ownerId}`);
      url.searchParams.set('module', module);

      const response = await fetch(url.toString(), {
        headers: { 'x-api-key': apiKey },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to fetch context' }));
        throw new Error(error.message || `Failed to fetch context: ${response.status}`);
      }

      const data = await response.json();
      return data.data;
    },
    enabled: !!ownerId && !!module,
    staleTime: 500,
    gcTime: 1000,
    refetchOnMount: (query) => {
      const data = query.state.data;
      return !data;
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: (failureCount, error) => {
      // Only retry on 5xx errors, max 2 attempts
      if (error instanceof Error && 'status' in error) {
        const status = (error as { status?: number }).status;
        if (status && status >= 400 && status < 500) {
          return false;
        }
      }
      return failureCount < 2;
    },
  });
};
