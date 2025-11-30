import { v } from 'convex/values';
import { protectedAction } from '../functions';
import { languageValidator, Metadata } from '../schema';
import { internal } from '../_generated/api';

export const completeOnboarding = protectedAction({
  args: {
    preferredLocale: v.optional(languageValidator),
  },
  async handler(ctx, args) {
    // Build metadata
    const metadata: Metadata = {
      onboardingComplete: 'true',
    };

    if (args.preferredLocale) {
      metadata.preferredLocale = args.preferredLocale;
    }

    // 1. Update Convex immediately - this adds the version timestamp
    const result = await ctx.runMutation(internal.users.internal.mutation.updateMetadata, {
      userId: ctx.user._id,
      metadata,
    });

    // 2. Sync to WorkOS with the same version timestamp
    const metadataWithVersion: Metadata = {
      ...metadata,
      _metadataVersion: result.version,
    };

    await ctx.runAction(internal.workos.internal.action.updateUserMetadata, {
      workosUserId: ctx.user.externalId,
      metadata: metadataWithVersion,
    });

    return { success: true };
  },
});

/**
 * Update user preferences (theme, language, notifications, etc.)
 * Syncs to both Convex and WorkOS for persistence.
 * Uses version timestamps to prevent webhook race conditions.
 */
export const updatePreferences = protectedAction({
  args: {
    theme: v.optional(v.union(v.literal('light'), v.literal('dark'), v.literal('system'))),
    preferredLocale: v.optional(languageValidator),
    emailNotifications: v.optional(v.boolean()),
    marketingEmails: v.optional(v.boolean()),
  },
  async handler(ctx, args) {
    // Build metadata from current + new values
    const currentMetadata = ctx.user.metadata || {};
    const metadata: Metadata = { ...currentMetadata };

    if (args.theme !== undefined) {
      metadata.theme = args.theme;
    }

    if (args.preferredLocale !== undefined) {
      metadata.preferredLocale = args.preferredLocale;
    }

    if (args.emailNotifications !== undefined) {
      metadata.emailNotifications = args.emailNotifications ? 'true' : 'false';
    }

    if (args.marketingEmails !== undefined) {
      metadata.marketingEmails = args.marketingEmails ? 'true' : 'false';
    }

    // 1. Update Convex immediately - this adds the version timestamp
    const result = await ctx.runMutation(internal.users.internal.mutation.updateMetadata, {
      userId: ctx.user._id,
      metadata,
    });

    // 2. Sync to WorkOS with the same version timestamp
    // This ensures webhook won't overwrite newer local changes
    const metadataWithVersion: Metadata = {
      ...metadata,
      _metadataVersion: result.version,
    };

    await ctx.runAction(internal.workos.internal.action.updateUserMetadata, {
      workosUserId: ctx.user.externalId,
      metadata: metadataWithVersion,
    });

    return { success: true, metadata: metadataWithVersion };
  },
});

/**
 * Update user profile information.
 */
export const updateProfile = protectedAction({
  args: {
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
  },
  async handler(ctx, args) {
    // Update in Convex
    await ctx.runMutation(internal.users.internal.mutation.updateProfile, {
      userId: ctx.user._id,
      firstName: args.firstName,
      lastName: args.lastName,
    });

    return { success: true };
  },
});
