'use node';

import { ConvexError, v } from 'convex/values';
import { internalAction } from '../../functions';
import { WorkOS } from '@workos-inc/node';

export const createPersonalOrganizationWorkos = internalAction({
  args: {
    externalId: v.string(),
  },
  async handler(ctx, { externalId }) {
    const workos = new WorkOS(process.env.WORKOS_API_KEY);
    const workosUser = await workos.userManagement.getUser(externalId);

    if (!workosUser) {
      throw new ConvexError('workosUser not found');
    }

    const personalOrganization = await workos.organizations.createOrganization({
      name: `${workosUser.firstName ? `${workosUser.firstName}'s` : 'My'} Workspace`,
      metadata: {
        tier: 'personal',
      },
    });

    await workos.userManagement.createOrganizationMembership({
      organizationId: personalOrganization.id,
      userId: externalId,
      roleSlug: 'owner',
    });
  },
});
