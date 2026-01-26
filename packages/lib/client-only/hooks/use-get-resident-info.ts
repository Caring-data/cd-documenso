import { useQuery } from '@tanstack/react-query';

import { env } from '../../utils/env';

export type UseGetResidentInfoOptions = {
  residentId: string;
};

export type ResidentInfo = {
  resident: {
    first_name: string;
    last_name: string;
    dob: string;
    gender_identity: string;
  };
  location: {
    name: string;
    state: string;
    address: string;
    city: string;
    zip: string;
    country: string;
  };
};

export const useGetResidentInfo = ({ residentId }: UseGetResidentInfoOptions) => {
  return useQuery<ResidentInfo>({
    queryKey: ['get-resident-info', residentId],
    queryFn: async () => {
      const baseUrl = env('NEXT_PUBLIC_CD_SERVICE_URL');
      const apiKey = env('NEXT_PUBLIC_CD_SERVICE_API_KEY');

      if (!baseUrl) {
        throw new Error('NEXT_PUBLIC_CD_SERVICE_URL is not configured');
      }

      if (!apiKey) {
        throw new Error('NEXT_PUBLIC_CD_SERVICE_API_KEY is not configured');
      }

      const response = await fetch(`${baseUrl}/v1/residents/${residentId}`, {
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to fetch resident info' }));
        throw new Error(error.message || `Failed to fetch resident info: ${response.status}`);
      }

      const data = await response.json();
      return data.data;
    },
    enabled: !!residentId,
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
