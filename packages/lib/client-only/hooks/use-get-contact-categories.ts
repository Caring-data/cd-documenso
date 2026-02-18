import { useQuery } from '@tanstack/react-query';

import { env } from '../../utils/env';

export type ContactCategoryKey =
  | 'administrator'
  | 'physician'
  | 'responsible_party'
  | 'hospiceContact'
  | 'homeHealthContact';

export type ContactCategory = {
  key: ContactCategoryKey;
  name: string;
};

const getFormsSegment = (isSystem?: boolean) => (isSystem === true ? 'system-forms' : 'forms');

export const useGetContactCategories = (isSystem?: boolean) => {
  const segment = getFormsSegment(isSystem);

  return useQuery<ContactCategory[]>({
    queryKey: ['get-contact-categories', isSystem],
    queryFn: async () => {
      const baseUrl = env('NEXT_PUBLIC_CD_SERVICE_URL');
      const apiKey = env('NEXT_PUBLIC_CD_SERVICE_API_KEY');

      if (!baseUrl) {
        throw new Error('NEXT_PUBLIC_CD_SERVICE_URL is not configured');
      }

      if (!apiKey) {
        throw new Error('NEXT_PUBLIC_CD_SERVICE_API_KEY is not configured');
      }

      const response = await fetch(`${baseUrl}/v1/${segment}/contact-categories`, {
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ message: 'Failed to fetch contact categories' }));
        throw new Error(error.message || `Failed to fetch contact categories: ${response.status}`);
      }

      const data = await response.json();
      return data.data;
    },

    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });
};
