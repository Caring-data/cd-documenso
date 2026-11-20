import { useQuery } from '@tanstack/react-query';

import { env } from '../../utils/env';

export type ContactCategoryKey =
  | 'administrator'
  | 'primary_physician'
  | 'responsible_person'
  | 'hospice'
  | 'home_health'
  | 'staff'
  | 'physician';

export type ContactCategory = {
  key: ContactCategoryKey;
  name: string;
};

/** The template whose module (resident, staff or facility) decides the allowed categories. */
export type ContactCategoriesTemplate = {
  templateKey?: string | null;
  documensoTemplateId?: number | null;
};

const getFormsSegment = (isSystem?: boolean) => (isSystem === true ? 'system-forms' : 'forms');

export const useGetContactCategories = (
  isSystem?: boolean,
  template?: ContactCategoriesTemplate,
) => {
  const segment = getFormsSegment(isSystem);
  const templateKey = template?.templateKey ?? undefined;
  const documensoTemplateId = template?.documensoTemplateId ?? undefined;

  return useQuery<ContactCategory[]>({
    queryKey: ['get-contact-categories', isSystem, templateKey, documensoTemplateId],
    queryFn: async () => {
      const baseUrl = env('NEXT_PUBLIC_CD_SERVICE_URL');
      const apiKey = env('NEXT_PUBLIC_CD_SERVICE_API_KEY');

      if (!baseUrl) {
        throw new Error('NEXT_PUBLIC_CD_SERVICE_URL is not configured');
      }

      if (!apiKey) {
        throw new Error('NEXT_PUBLIC_CD_SERVICE_API_KEY is not configured');
      }

      const url = new URL(`${baseUrl}/v1/${segment}/contact-categories`);

      if (templateKey && documensoTemplateId) {
        url.searchParams.set('key', templateKey);
        url.searchParams.set('documentTemplateId', String(documensoTemplateId));
      }

      const response = await fetch(url.toString(), {
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
