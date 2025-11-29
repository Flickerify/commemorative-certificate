import { v } from 'convex/values';
import { internalMutation } from '../../functions';
import { userWithoutRole, Metadata, metadataValidator } from '../../schema';

export const upsertFromWorkos = internalMutation({
  args: userWithoutRole,
  async handler(ctx, args) {
    const user = await ctx.db
      .query('users')
      .withIndex('by_external_id', (q) => q.eq('externalId', args.externalId))
      .first();

    if (!user) {
      // New user: set defaults for role, use metadata from WorkOS (or default onboardingComplete: 'false')
      const defaultMetadata: Metadata = {
        onboardingComplete: 'false',
        ...args.metadata, // WorkOS metadata overrides defaults
      };
      return await ctx.db.insert('users', {
        ...args,
        role: 'user',
        metadata: defaultMetadata,
      });
    }

    // WorkOS is the source of truth for metadata - use incoming metadata directly
    // Merge with existing to preserve any Convex-only fields, but WorkOS values take precedence
    const mergedMetadata: Metadata = {
      ...user.metadata,
      ...args.metadata, // WorkOS metadata takes precedence
    };

    await ctx.db.patch(user._id, {
      ...args,
      role: user.role,
      metadata: mergedMetadata,
    });

    return user._id;
  },
});

export const updateMetadata = internalMutation({
  args: {
    userId: v.id('users'),
    metadata: metadataValidator,
  },
  async handler(ctx, { userId, metadata }) {
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    const mergedMetadata: Metadata = {
      ...user.metadata,
      ...metadata,
    };

    await ctx.db.patch(userId, {
      metadata: mergedMetadata,
      updatedAt: Date.now(),
    });

    return { success: true };
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
