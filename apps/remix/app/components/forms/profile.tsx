import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useSession } from '@documenso/lib/client-only/providers/session';
import { DocumentSignatureType } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { SignaturePadDialog } from '@documenso/ui/primitives/signature-pad/signature-pad-dialog';
import { useToast } from '@documenso/ui/primitives/use-toast';

export const ZProfileFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: msg`Please enter a valid name.`.id }),
  signature: z.object({
    type: z.nativeEnum(DocumentSignatureType),
    value: z.string().min(1, { message: msg`Signature cannot be empty.`.id }),
    font: z.string().optional(),
    color: z.string().optional(),
  }),
});

type SignatureTypedSettings = {
  font?: string;
  color?: string;
} | null;

export type TProfileFormSchema = z.infer<typeof ZProfileFormSchema>;

export type ProfileFormProps = {
  className?: string;
};

export const ProfileForm = ({ className }: ProfileFormProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { user, refreshSession } = useSession();

  const form = useForm<TProfileFormSchema>({
    defaultValues: {
      name: '',
      signature: {
        type: DocumentSignatureType.TYPE,
        value: '',
        font: 'Dancing Script',
        color: 'black',
      },
    },
    resolver: zodResolver(ZProfileFormSchema),
  });

  const buildSignatureFromUser = (signature: string | null, settings: SignatureTypedSettings) => {
    if (!signature) return null;

    const isBase64 = signature.startsWith('data:');

    if (isBase64) {
      return {
        type: DocumentSignatureType.DRAW,
        value: signature,
      };
    }

    return {
      type: DocumentSignatureType.TYPE,
      value: signature,
      font: settings?.font ?? 'Dancing Script',
      color: settings?.color ?? 'black',
    };
  };

  useEffect(() => {
    const parsed = z
      .object({
        font: z.string().optional(),
        color: z.string().optional(),
      })
      .nullable()
      .safeParse(user.signatureTypedSettings);

    const settings = parsed.success ? parsed.data : null;

    const signatureValue = buildSignatureFromUser(user.signature, settings);

    form.reset({
      name: user.name ?? '',
      signature: signatureValue ?? {
        type: DocumentSignatureType.TYPE,
        value: '',
        font: 'Dancing Script',
        color: 'black',
      },
    });
  }, [user.name, user.signature, user.signatureTypedSettings]);

  const isSubmitting = form.formState.isSubmitting;

  const { mutateAsync: updateProfile } = trpc.profile.updateProfile.useMutation();

  const onFormSubmit = async ({ name, signature }: TProfileFormSchema) => {
    try {
      const typedSettings =
        signature.type === DocumentSignatureType.TYPE
          ? { font: signature.font ?? 'Dancing Script', color: signature.color ?? 'black' }
          : null;

      await updateProfile({
        name,
        signature: signature.value,
        signatureTypedSettings: typedSettings,
      });

      await refreshSession();

      toast({
        title: _(msg`Profile updated`),
        description: _(msg`Your profile has been updated successfully.`),
        duration: 5000,
      });
    } catch (err) {
      toast({
        title: _(msg`An unknown error occurred`),
        description: _(
          msg`We encountered an unknown error while attempting update your profile. Please try again later.`,
        ),
        variant: 'destructive',
      });
    }
  };

  return (
    <Form {...form}>
      <form
        className={cn('flex w-full flex-col gap-y-4', className)}
        onSubmit={form.handleSubmit(onFormSubmit)}
      >
        <fieldset className="flex w-full flex-col gap-y-4" disabled={isSubmitting}>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Full Name</Trans>
                </FormLabel>
                <FormControl>
                  <Input type="text" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div>
            <Label htmlFor="email" className="text-muted-foreground">
              <Trans>Email</Trans>
            </Label>
            <Input id="email" type="email" className="mt-2 bg-muted" value={user.email} disabled />
          </div>

          <FormField
            control={form.control}
            name="signature"
            render={({ field: { onChange, value } }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Signature</Trans>
                </FormLabel>
                <FormControl>
                  <SignaturePadDialog
                    disabled={isSubmitting}
                    fullName={user.name ?? ''}
                    value={value}
                    onChange={(v) => onChange(v ?? undefined)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>

        <Button type="submit" loading={isSubmitting} className="self-end">
          <Trans>Update profile</Trans>
        </Button>
      </form>
    </Form>
  );
};
