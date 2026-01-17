import { useMemo } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { Loader } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import type { z } from 'zod';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { AppError } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import type { TGetAdminOrganisationResponse } from '@documenso/trpc/server/admin-router/get-admin-organisation.types';
import { ZUpdateAdminOrganisationRequestSchema } from '@documenso/trpc/server/admin-router/update-admin-organisation.types';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import { DataTable, type DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { AdminOrganisationMemberUpdateDialog } from '~/components/dialogs/admin-organisation-member-update-dialog';
import { GenericErrorLayout } from '~/components/general/generic-error-layout';
import { SettingsHeader } from '~/components/general/settings-header';

import type { Route } from './+types/organisations.$id';

export default function OrganisationGroupSettingsPage({ params }: Route.ComponentProps) {
  const { t } = useLingui();
  const { toast } = useToast();

  const navigate = useNavigate();

  const organisationId = params.id;

  const { data: organisation, isLoading: isLoadingOrganisation } =
    trpc.admin.organisation.get.useQuery({
      organisationId,
    });


  const teamsColumns = useMemo(() => {
    return [
      {
        header: t`Team`,
        accessorKey: 'name',
      },
      {
        header: t`Team url`,
        accessorKey: 'url',
      },
    ] satisfies DataTableColumnDef<TGetAdminOrganisationResponse['teams'][number]>[];
  }, []);

  const organisationMembersColumns = useMemo(() => {
    return [
      {
        header: t`Member`,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Link to={`/admin/users/${row.original.user.id}`}>{row.original.user.name}</Link>
            {row.original.user.id === organisation?.ownerUserId && <Badge>Owner</Badge>}
          </div>
        ),
      },
      {
        header: t`Email`,
        cell: ({ row }) => (
          <Link to={`/admin/users/${row.original.user.id}`}>{row.original.user.email}</Link>
        ),
      },
      {
        header: t`Actions`,
        cell: ({ row }) => {
          const isOwner = row.original.userId === organisation?.ownerUserId;

          return (
            <div className="flex justify-end space-x-2">
              <AdminOrganisationMemberUpdateDialog
                trigger={
                  <Button variant="outline">
                    <Trans>Update role</Trans>
                  </Button>
                }
                organisationId={organisationId}
                organisationMember={row.original}
                isOwner={isOwner}
              />
            </div>
          );
        },
      },
    ] satisfies DataTableColumnDef<TGetAdminOrganisationResponse['members'][number]>[];
  }, [organisation]);

  if (isLoadingOrganisation) {
    return (
      <div className="flex items-center justify-center rounded-lg py-32">
        <Loader className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!organisation) {
    return (
      <GenericErrorLayout
        errorCode={404}
        errorCodeMap={{
          404: {
            heading: msg`Organisation not found`,
            subHeading: msg`404 Organisation not found`,
            message: msg`The organisation you are looking for may have been removed, renamed or may have never existed.`,
          },
        }}
        primaryButton={
          <Button asChild>
            <Link to={`/admin/organisations`}>
              <Trans>Go back</Trans>
            </Link>
          </Button>
        }
        secondaryButton={null}
      />
    );
  }

  return (
    <div>
      <SettingsHeader
        title={t`Manage organisation`}
        subtitle={t`Manage the ${organisation.name} organisation`}
      >
        <Button variant="outline" asChild>
          <Link to={`/admin/organisation-insights/${organisationId}`}>
            <Trans>View insights</Trans>
          </Link>
        </Button>
      </SettingsHeader>

      <GenericOrganisationAdminForm organisation={organisation} />

      <div className="mt-16 space-y-10">
        <div>
          <label className="text-sm font-medium leading-none">
            <Trans>Organisation Members</Trans>
          </label>

          <div className="my-2">
            <DataTable columns={organisationMembersColumns} data={organisation.members} />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium leading-none">
            <Trans>Organisation Teams</Trans>
          </label>

          <div className="my-2">
            <DataTable columns={teamsColumns} data={organisation.teams} />
          </div>
        </div>
      </div>
    </div>
  );
}

const ZUpdateGenericOrganisationDataFormSchema =
  ZUpdateAdminOrganisationRequestSchema.shape.data.pick({
    name: true,
    url: true,
  });

type TUpdateGenericOrganisationDataFormSchema = z.infer<
  typeof ZUpdateGenericOrganisationDataFormSchema
>;

type OrganisationAdminFormOptions = {
  organisation: TGetAdminOrganisationResponse;
};

const GenericOrganisationAdminForm = ({ organisation }: OrganisationAdminFormOptions) => {
  const { toast } = useToast();
  const { t } = useLingui();

  const { mutateAsync: updateOrganisation } = trpc.admin.organisation.update.useMutation();

  const form = useForm<TUpdateGenericOrganisationDataFormSchema>({
    resolver: zodResolver(ZUpdateGenericOrganisationDataFormSchema),
    defaultValues: {
      name: organisation.name,
      url: organisation.url,
    },
  });

  const onSubmit = async (data: TUpdateGenericOrganisationDataFormSchema) => {
    try {
      await updateOrganisation({
        organisationId: organisation.id,
        data,
      });

      toast({
        title: t`Success`,
        description: t`Organisation has been updated successfully`,
        duration: 5000,
      });
    } catch (err) {
      const error = AppError.parseError(err);
      console.error(error);

      toast({
        title: t`An error occurred`,
        description: t`We couldn't update the organisation. Please try again.`,
        variant: 'destructive',
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel required>
                <Trans>Organisation Name</Trans>
              </FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel required>
                <Trans>Organisation URL</Trans>
              </FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              {!form.formState.errors.url && (
                <span className="text-foreground/50 text-xs font-normal">
                  {field.value ? (
                    `${NEXT_PUBLIC_WEBAPP_URL()}/o/${field.value}`
                  ) : (
                    <Trans>A unique URL to identify the organisation</Trans>
                  )}
                </span>
              )}

              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end">
          <Button type="submit" loading={form.formState.isSubmitting}>
            <Trans>Update</Trans>
          </Button>
        </div>
      </form>
    </Form>
  );
};

