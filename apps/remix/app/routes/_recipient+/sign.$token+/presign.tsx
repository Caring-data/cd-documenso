import { Trans, useLingui } from '@lingui/react/macro';

import { FileText, Loader } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { Button } from '@documenso/ui/primitives/button';
import { useToast } from '@documenso/ui/primitives/use-toast';

export default function PreSigningPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLingui();

  const [documentDetails, setDocumentDetails] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedData = sessionStorage.getItem('preSigningData');

      if (storedData) {
        const parsedData = JSON.parse(storedData);
        setDocumentDetails(parsedData);
        setLoading(false);
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error('Error parsing document details:', err);
      toast({
        title: t`Error`,
        description: t`Failed to fetch document details`,
        variant: 'destructive',
      });
      setLoading(false);
    }
  }, [toast]);

  if (!token) {
    return null;
  }

  const signDocumentUrl = `/sign/${token}?accessed=true`;
  const rejectDocumentUrl = `/sign/${token}?reject=true`;

  const getAssetUrl = (path: string) => {
    const baseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3002';
    return new URL(path, baseUrl).toString();
  };

  const handleAccept = () => {
    void navigate(signDocumentUrl);
  };

  const handleDecline = () => {
    void navigate(rejectDocumentUrl);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-700">
        <Loader className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="fixed left-0 top-0 flex h-screen w-screen items-center justify-center overflow-hidden pb-11 text-white">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${getAssetUrl('/static/pre-signature-image.jpg')})`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/50 to-blue-300/50" />

        <div className="relative z-10 mt-20 flex flex-col items-center justify-center text-center sm:mt-28 lg:mt-10">
          <div className="mb-6 flex items-center justify-center">
            <img
              src={getAssetUrl('/static/logo-cd-white.png')}
              alt="Logo - Caring Data"
              className="h-16 w-auto md:h-28"
            />
          </div>

          <div className="mb-10 flex w-11/12 max-w-lg flex-col items-center justify-center gap-6 rounded-lg bg-white p-6 text-center shadow-md md:w-full md:p-8">
            <div className="item-center flex w-full flex-col gap-4">
              <div className="flex w-full flex-col items-center justify-center gap-4">
                <FileText className="h-8 flex-shrink-0 text-primary" />
              </div>

              <p className="w-full text-center text-xl font-semibold leading-6 text-zinc-600">
                <Trans>
                  You have been requested by:{' '}
                  <span className="text-brand-accent">{documentDetails?.facilityAdministrator}</span>{' '}
                  from <span className="text-brand-accent">{documentDetails?.locationName}</span> to
                  sign documents electronically
                </Trans>
              </p>
            </div>

            <div className="max-w-l flex h-auto w-full items-center justify-center gap-2 rounded-lg bg-zinc-100 px-4 py-3">
              <span className="text-brand-accent text-sm font-medium">
                <a
                  href="https://rise.caringdata.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-accent text-sm font-semibold underline hover:text-blue-900"
                >
                  www.rise.caringdata.com
                </a>{' '}
                would like to use your current location to ensure secure and accurate document
                processing.
              </span>
            </div>
            <hr className="w-full border-t border-gray-300 bg-gray-300" />
            <div>
              <p className="text-xs font-normal leading-4 text-zinc-600">
                By clicking the <strong>"I ACCEPT"</strong> button, you agree to review the
                documents and provide your electronic signature. You acknowledge that your
                electronic signature will have the same legal validity and effect as a handwritten
                signature, ensuring the document is complete and legally binding.
              </p>
            </div>

            
            <div className="flex w-full flex-col gap-4 md:flex-row">
              <Button
                variant="outline"
                className="h-9 w-full border-zinc-300 bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                onClick={handleDecline}
              >
                <Trans>I Decline</Trans>
              </Button>
              <Button
                className="bg-brand h-9 w-full text-white hover:bg-blue-700"
                onClick={handleAccept}
              >
                <Trans>I Accept</Trans>
              </Button>
            </div>
          </div>
        </div>
      </div>
  );
}

