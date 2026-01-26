import { useEffect, useMemo, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { authClient } from '@documenso/auth/client';
import { AuthenticationErrorCode } from '@documenso/auth/server/lib/errors/error-codes';
import { AppError } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { ZCurrentPasswordSchema } from '@documenso/trpc/server/auth-router/schema';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { PasswordInput } from '@documenso/ui/primitives/password-input';
import { PinInput, PinInputGroup, PinInputSlot } from '@documenso/ui/primitives/pin-input';
import { useToast } from '@documenso/ui/primitives/use-toast';

const CommonErrorMessages: Record<string, MessageDescriptor> = {
  [AuthenticationErrorCode.AccountDisabled]: msg`This account has been disabled. Please contact support.`,
};

const handleFallbackErrorMessages = (code: string) => {
  const message = CommonErrorMessages[code];

  if (!message) {
    return msg`An unknown error occurred`;
  }

  return message;
};

const LOGIN_REDIRECT_PATH = '/';

export const ZSignInFormSchema = z.object({
  email: z.string().email().min(1),
  password: ZCurrentPasswordSchema,
  totpCode: z.string().trim().optional(),
  backupCode: z.string().trim().optional(),
});

export type TSignInFormSchema = z.infer<typeof ZSignInFormSchema>;

export type SignInFormProps = {
  className?: string;
  initialEmail?: string;
  returnTo?: string;
};

export const SignInForm = ({
  className,
  initialEmail,
  returnTo,
}: SignInFormProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const navigate = useNavigate();

  const [isTwoFactorAuthenticationDialogOpen, setIsTwoFactorAuthenticationDialogOpen] =
    useState(false);
  const [isEmbeddedRedirect, setIsEmbeddedRedirect] = useState(false);

  const [twoFactorAuthenticationMethod, setTwoFactorAuthenticationMethod] = useState<
    'totp' | 'backup'
  >('totp');

  const redirectPath = useMemo(() => {
    // Handle SSR
    if (typeof window === 'undefined') {
      return LOGIN_REDIRECT_PATH;
    }

    let url = new URL(returnTo || LOGIN_REDIRECT_PATH, window.location.origin);

    // Don't allow different origins
    if (url.origin !== window.location.origin) {
      url = new URL(LOGIN_REDIRECT_PATH, window.location.origin);
    }

    return url.toString();
  }, [returnTo]);

  const form = useForm<TSignInFormSchema>({
    values: {
      email: initialEmail ?? '',
      password: '',
      totpCode: '',
      backupCode: '',
    },
    resolver: zodResolver(ZSignInFormSchema),
  });

  const isSubmitting = form.formState.isSubmitting;

  const onCloseTwoFactorAuthenticationDialog = () => {
    form.setValue('totpCode', '');
    form.setValue('backupCode', '');

    setIsTwoFactorAuthenticationDialogOpen(false);
  };

  const onToggleTwoFactorAuthenticationMethodClick = () => {
    const method = twoFactorAuthenticationMethod === 'totp' ? 'backup' : 'totp';

    if (method === 'totp') {
      form.setValue('backupCode', '');
    }

    if (method === 'backup') {
      form.setValue('totpCode', '');
    }

    setTwoFactorAuthenticationMethod(method);
  };

  const onFormSubmit = async ({ email, password, totpCode, backupCode }: TSignInFormSchema) => {
    try {
      await authClient.emailPassword.signIn({
        email,
        password,
        totpCode,
        backupCode,
        redirectPath,
      });
    } catch (err) {
      console.log(err);

      const error = AppError.parseError(err);

      if (error.code === 'TWO_FACTOR_MISSING_CREDENTIALS') {
        setIsTwoFactorAuthenticationDialogOpen(true);
        return;
      }

      if (error.code === AuthenticationErrorCode.UnverifiedEmail) {
        await navigate('/unverified-account');

        toast({
          title: _(msg`Unable to sign in`),
          description: _(
            msg`This account has not been verified. Please verify your account before signing in.`,
          ),
        });

        return;
      }

      const errorMessage = match(error.code)
        .with(
          AuthenticationErrorCode.InvalidCredentials,
          () => msg`The email or password provided is incorrect.`,
        )
        .with(
          AuthenticationErrorCode.InvalidTwoFactorCode,
          () => msg`The two-factor authentication code provided is incorrect.`,
        )
        .otherwise(() => handleFallbackErrorMessages(error.code));

      toast({
        title: _(msg`Unable to sign in`),
        description: _(errorMessage),
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    const hash = window.location.hash.slice(1);

    const params = new URLSearchParams(hash);

    const email = params.get('email');

    if (email) {
      form.setValue('email', email);
    }

    setIsEmbeddedRedirect(params.get('embedded') === 'true');
  }, [form]);

  return (
    <Form {...form}>
      <form
        className={cn('flex w-full flex-col gap-y-4', className)}
        onSubmit={form.handleSubmit(onFormSubmit)}
      >
        <fieldset
          className="flex w-full flex-col gap-y-4"
          disabled={isSubmitting}
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Email</Trans>
                </FormLabel>

                <FormControl>
                  <Input type="email" {...field} />
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Password</Trans>
                </FormLabel>

                <FormControl>
                  <PasswordInput {...field} />
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            size="lg"
            loading={isSubmitting}
            className="dark:bg-documenso dark:hover:opacity-90"
          >
            {isSubmitting ? <Trans>Signing in...</Trans> : <Trans>Sign In</Trans>}
          </Button>
        </fieldset>
      </form>

      <Dialog
        open={isTwoFactorAuthenticationDialogOpen}
        onOpenChange={onCloseTwoFactorAuthenticationDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <Trans>Two-Factor Authentication</Trans>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onFormSubmit)}>
            <fieldset disabled={isSubmitting}>
              {twoFactorAuthenticationMethod === 'totp' && (
                <FormField
                  control={form.control}
                  name="totpCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Token</FormLabel>
                      <FormControl>
                        <PinInput {...field} value={field.value ?? ''} maxLength={6}>
                          {Array(6)
                            .fill(null)
                            .map((_, i) => (
                              <PinInputGroup key={i}>
                                <PinInputSlot index={i} />
                              </PinInputGroup>
                            ))}
                        </PinInput>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {twoFactorAuthenticationMethod === 'backup' && (
                <FormField
                  control={form.control}
                  name="backupCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Backup Code</Trans>
                      </FormLabel>
                      <FormControl>
                        <Input type="text" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <DialogFooter className="mt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onToggleTwoFactorAuthenticationMethodClick}
                >
                  {twoFactorAuthenticationMethod === 'totp' ? (
                    <Trans>Use Backup Code</Trans>
                  ) : (
                    <Trans>Use Authenticator</Trans>
                  )}
                </Button>

                <Button type="submit" loading={isSubmitting}>
                  {isSubmitting ? <Trans>Signing in...</Trans> : <Trans>Sign In</Trans>}
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </DialogContent>
      </Dialog>
    </Form>
  );
};
