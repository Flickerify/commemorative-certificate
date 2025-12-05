import { v } from 'convex/values';
import { internalMutation } from '../../functions';
import { userWithoutRole, Metadata, metadataValidator } from '../../schema';

/**
 * Pre-provision a user from WorkOS registration action data.
 * Called asynchronously during the registration flow (before the user exists in WorkOS).
 * Creates a pending user record that will be completed when the user.created webhook arrives.
 *
 * Uses email as the temporary identifier since WorkOS user ID doesn't exist yet.
 */
export const provisionFromRegistration = internalMutation({
  args: {
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
  },
  returns: v.union(v.id('users'), v.null()),
  async handler(ctx, args) {
    // Check if user already exists by email (prevents duplicates)
    const existingByEmail = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .first();

    if (existingByEmail) {
      console.log(`[Registration] User already exists for email: ${args.email}`);
      return existingByEmail._id;
    }

    // Create pending user record
    // Note: externalId is set to a placeholder - will be updated by user.created webhook
    const now = Date.now();
    const userId = await ctx.db.insert('users', {
      externalId: `pending:${args.email}`, // Placeholder until webhook arrives
      email: args.email,
      firstName: args.firstName ?? null,
      lastName: args.lastName ?? null,
      emailVerified: false,
      profilePictureUrl: null,
      role: 'user',
      metadata: {
        onboardingComplete: 'false',
      },
      updatedAt: now,
    });

    console.log(`[Registration] Pre-provisioned user: ${userId} for email: ${args.email}`);
    return userId;
  },
});

export const upsertFromWorkos = internalMutation({
  args: userWithoutRole,
  async handler(ctx, args) {
    // First, try to find by external ID (normal case)
    let user = await ctx.db
      .query('users')
      .withIndex('by_external_id', (q) => q.eq('externalId', args.externalId))
      .first();

    // If not found by external ID, check for pre-provisioned user by email
    // Pre-provisioned users have externalId = "pending:email"
    if (!user && args.email) {
      const pendingUser = await ctx.db
        .query('users')
        .withIndex('by_email', (q) => q.eq('email', args.email))
        .first();

      // Only match if this is a pending record (not a different user's record)
      if (pendingUser && pendingUser.externalId.startsWith('pending:')) {
        console.log(`[Webhook] Linking pre-provisioned user ${pendingUser._id} to WorkOS ID: ${args.externalId}`);
        user = pendingUser;
      }
    }

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

    // Check if local metadata is newer than incoming webhook data
    // We use _metadataVersion as a timestamp to prevent webhook overwrites
    const localVersion = parseInt(user.metadata?._metadataVersion || '0', 10);
    const incomingVersion = parseInt(args.metadata?._metadataVersion || '0', 10);

    // If local version is newer, preserve local metadata (user-initiated changes)
    // Otherwise, merge with incoming webhook data
    let mergedMetadata: Metadata;
    if (localVersion > incomingVersion) {
      // Local is newer - keep local metadata, but update non-metadata fields
      mergedMetadata = user.metadata || {};
      console.log(`Skipping metadata update from webhook: local version ${localVersion} > incoming ${incomingVersion}`);
    } else {
      // Webhook is newer or same - merge with preference for incoming
      mergedMetadata = {
        ...user.metadata,
        ...args.metadata,
      };
    }

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

    // Add version timestamp to prevent webhook overwrites
    const version = Date.now().toString();
    const mergedMetadata: Metadata = {
      ...user.metadata,
      ...metadata,
      _metadataVersion: version,
    };

    await ctx.db.patch(userId, {
      metadata: mergedMetadata,
      updatedAt: Date.now(),
    });

    return { success: true, version };
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
