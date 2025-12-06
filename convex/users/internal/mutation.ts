import { v } from 'convex/values';
import { internalMutation } from '../../functions';
import { userWithoutRole, Metadata, metadataValidator } from '../../schema';

export const upsertFromWorkos = internalMutation({
  args: userWithoutRole,
  async handler(ctx, args) {
    // First, try to find by external ID (normal case)
    const user = await ctx.db
      .query('users')
      .withIndex('by_external_id', (q) => q.eq('externalId', args.externalId))
      .first();

    // Extract only the fields we sync from WorkOS (excluding metadata which is local-only)
    const workosFields = {
      externalId: args.externalId,
      email: args.email,
      emailVerified: args.emailVerified,
      firstName: args.firstName,
      lastName: args.lastName,
      profilePictureUrl: args.profilePictureUrl,
      updatedAt: args.updatedAt,
    };

    if (!user) {
      // New user: set defaults for role and metadata
      // Note: args.metadata is ignored - metadata is stored locally only
      const defaultMetadata: Metadata = {
        onboardingComplete: false,
        preferredLocale: 'en',
      };
      return await ctx.db.insert('users', {
        ...workosFields,
        role: 'user',
        metadata: defaultMetadata,
      });
    }

    // Existing user: preserve local metadata (not synced from WorkOS)
    // Only update non-metadata fields from WorkOS webhook
    await ctx.db.patch(user._id, {
      ...workosFields,
      role: user.role,
      // Keep existing metadata - don't overwrite with WorkOS data
      metadata: user.metadata,
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

    // Merge new metadata with existing (stored locally only, not synced to WorkOS)
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

export const updateProfile = internalMutation({
  args: {
    userId: v.id('users'),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
  },
  async handler(ctx, { userId, firstName, lastName }) {
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    const updates: Partial<{ firstName: string | null; lastName: string | null; updatedAt: number }> = {
      updatedAt: Date.now(),
    };

    if (firstName !== undefined) {
      updates.firstName = firstName || null;
    }

    if (lastName !== undefined) {
      updates.lastName = lastName || null;
    }

    await ctx.db.patch(userId, updates);

    return { success: true };
  },
});

export const setPlanetscaleId = internalMutation({
  args: {
    convexId: v.id('users'),
    planetscaleId: v.number(),
  },
  returns: v.null(),
  async handler(ctx, { convexId, planetscaleId }) {
    const user = await ctx.db.get(convexId);
    if (!user) {
      console.warn(`Can't set planetscaleId, user not found: ${convexId}`);
      return null;
    }

    await ctx.db.patch(convexId, { planetscaleId });
    return null;
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
