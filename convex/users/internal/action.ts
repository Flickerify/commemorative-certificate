'use node';

import { ConvexError, v } from 'convex/values';
import { internal } from '../../_generated/api';
import { internalAction } from '../../functions';
import { WorkOS } from '@workos-inc/node';
import { ROLES } from '../../schema';

export const upsertFromWorkos = internalAction({
  args: {
    externalId: v.string(),
  },
  async handler(ctx, { externalId }) {
    const workos = new WorkOS(process.env.WORKOS_API_KEY);
    const workosUser = await workos.userManagement.getUser(externalId);

    if (!workosUser) {
      throw new ConvexError('workosUser not found');
    }

    // Check if user exists to preserve role
    const existingUser = await ctx.runQuery(internal.users.internal.query.findByExternalId, {
      externalId: workosUser.id,
    });

    await ctx.runMutation(internal.users.internal.mutation.upsertFromWorkos, {
      externalId: workosUser.id,
      email: workosUser.email,
      emailVerified: workosUser.emailVerified,
      firstName: workosUser.firstName,
      lastName: workosUser.lastName,
      profilePictureUrl: workosUser.profilePictureUrl,
      role: existingUser?.role || ROLES.USER,
      updatedAt: Date.now(),
    });
  },
});
