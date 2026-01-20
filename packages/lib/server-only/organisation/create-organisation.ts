import { OrganisationType } from '@prisma/client';
import { OrganisationMemberRole } from '@prisma/client';

import { prisma } from '@documenso/prisma';
import { ORGANISATION_INTERNAL_GROUPS } from '../../constants/organisations';
import { AppErrorCode } from '../../errors/app-error';
import { AppError } from '../../errors/app-error';
import { generateDatabaseId, prefixedId } from '../../universal/id';
import { generateDefaultOrganisationSettings } from '../../utils/organisations';
import { createTeam } from '../team/create-team';

type CreateOrganisationOptions = {
  userId: number;
  name: string;
  type: OrganisationType;
  url?: string;
};

export const createOrganisation = async ({
  name,
  url,
  type,
  userId,
}: CreateOrganisationOptions) => {
  return await prisma.$transaction(async (tx) => {
    const organisationSetting = await tx.organisationGlobalSettings.create({
      data: {
        ...generateDefaultOrganisationSettings(),
        id: generateDatabaseId('org_setting'),
      },
    });

    const organisationAuthenticationPortal = await tx.organisationAuthenticationPortal.create({
      data: {
        id: generateDatabaseId('org_sso'),
        enabled: false,
        clientId: '',
        clientSecret: '',
        wellKnownUrl: '',
      },
    });

    const orgIdAndUrl = prefixedId('org');

    const organisation = await tx.organisation
      .create({
        data: {
          id: orgIdAndUrl,
          name,
          type,
          url: url || orgIdAndUrl,
          ownerUserId: userId,
          organisationGlobalSettingsId: organisationSetting.id,
          organisationAuthenticationPortalId: organisationAuthenticationPortal.id,
          groups: {
            create: ORGANISATION_INTERNAL_GROUPS.map((group) => ({
              ...group,
              id: generateDatabaseId('org_group'),
            })),
          },
        },
        include: {
          groups: true,
        },
      })
      .catch((err) => {
        if (err.code === 'P2002') {
          throw new AppError(AppErrorCode.ALREADY_EXISTS, {
            message: 'Organisation URL already exists',
          });
        }

        throw err;
      });

    const adminGroup = organisation.groups.find(
      (group) => group.organisationRole === OrganisationMemberRole.ADMIN,
    );

    if (!adminGroup) {
      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Admin group not found',
      });
    }

    await tx.organisationMember.create({
      data: {
        id: generateDatabaseId('member'),
        userId,
        organisationId: organisation.id,
        organisationGroupMembers: {
          create: {
            id: generateDatabaseId('group_member'),
            groupId: adminGroup.id,
          },
        },
      },
    });

    return organisation;
  });
};

type CreatePersonalOrganisationOptions = {
  userId: number;
  orgUrl?: string;
  throwErrorOnOrganisationCreationFailure?: boolean;
  inheritMembers?: boolean;
  type?: OrganisationType;
};

export const createPersonalOrganisation = async ({
  userId,
  orgUrl,
  throwErrorOnOrganisationCreationFailure = false,
  inheritMembers = true,
  type = OrganisationType.PERSONAL,
}: CreatePersonalOrganisationOptions) => {
  const organisation = await createOrganisation({
    name: 'Personal Organisation',
    userId,
    url: orgUrl,
    type,
  }).catch((err) => {
    console.error(err);

    if (throwErrorOnOrganisationCreationFailure) {
      throw err;
    }

    // Todo: (LOGS)
  });

  if (organisation) {
    await createTeam({
      userId,
      teamName: 'Personal Team',
      teamUrl: prefixedId('personal'),
      organisationId: organisation.id,
      inheritMembers,
    }).catch((err) => {
      console.error(err);

      // Todo: (LOGS)
    });
  }

  return organisation;
};
