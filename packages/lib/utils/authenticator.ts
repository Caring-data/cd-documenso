import { NEXT_PUBLIC_WEBAPP_URL } from '../constants/app';

/**
 * Extracts common fields to identify the RP (relying party)
 */
export const getAuthenticatorOptions = () => {
  const webAppBaseUrl = new URL(NEXT_PUBLIC_WEBAPP_URL());
  const rpId = webAppBaseUrl.hostname;

  return {
    rpName: 'Documenso',
    rpId,
    origin: NEXT_PUBLIC_WEBAPP_URL(),
  };
};
