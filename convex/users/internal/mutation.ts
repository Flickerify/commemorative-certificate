import { v } from 'convex/values';
import { internalMutation } from '../../functions';
import { userWithoutRole, Metadata } from '../../schema';

export const upsertFromWorkos = internalMutation({
  args: userWithoutRole,
  async handler(ctx, args) {
    const user = await ctx.db
      .query('users')
      .withIndex('by_external_id', (q) => q.eq('externalId', args.externalId))
      .first();

    if (!user) {
      // New user: set defaults for role and metadata with onboardingComplete: false
      const defaultMetadata: Metadata = {
        ...args.metadata,
        onboardingComplete: false,
      };
      return await ctx.db.insert('users', {
        ...args,
        role: 'user',
        metadata: defaultMetadata,
      });
    }

    // Merge metadata: preserve local fields (like onboardingComplete), update from WorkOS
    const existingOnboardingComplete = user.metadata?.onboardingComplete ?? false;
    const mergedMetadata: Metadata = {
      ...user.metadata,
      ...args.metadata,
      // Always preserve local onboardingComplete status
      onboardingComplete: existingOnboardingComplete,
    };

    await ctx.db.patch(user._id, {
      ...args,
      role: user.role,
      metadata: mergedMetadata,
    });

    return user._id;
  },
});

export const deleteFromWorkos = internalMutation({
  args: { externalId: v.string() },
  returns: v.null(),
  async handler(ctx, { externalId }) {
    const user = await ctx.db
      .query('users')
      .withIndex('by_external_id', (q) => q.eq('externalId', externalId))
      .first();

    if (user === null) {
      console.warn(`Can't delete user, there is none for user ID: ${externalId}`);
      return null;
    }

    // Cascade: Delete all memberships for this user
    const memberships = await ctx.db
      .query('organizationMemberships')
      .withIndex('by_user', (q) => q.eq('userId', externalId))
      .collect();

    for (const membership of memberships) {
      await ctx.db.delete(membership._id);
    }

    // Delete the user
    await ctx.db.delete(user._id);

    return null;
  },
});
