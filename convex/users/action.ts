import { v } from 'convex/values';
import { ConvexError } from 'convex/values';
import { WorkOS } from '@workos-inc/node';
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

/**
 * Check if user account can be deleted.
 * User cannot delete their account if they own organizations with active subscriptions.
 */
export const canDeleteAccount = protectedAction({
  args: {},
  returns: v.object({
    canDelete: v.boolean(),
    reason: v.optional(v.string()),
    organizationsWithActiveSubscriptions: v.array(v.string()),
  }),
  async handler(ctx): Promise<{
    canDelete: boolean;
    reason?: string;
    organizationsWithActiveSubscriptions: string[];
  }> {
    const result = await ctx.runQuery(internal.users.internal.query.canDeleteAccountCheck, {
      userExternalId: ctx.user.externalId,
    });

    return {
      canDelete: result.canDelete,
      reason: result.reason,
      organizationsWithActiveSubscriptions: result.organizationsWithActiveSubscriptions,
    };
  },
});

/**
 * Delete user account.
 * This will:
 * 1. Check if user can be deleted (no owned orgs with active subscriptions)
 * 2. Delete all organizations owned by the user
 * 3. Delete the user from WorkOS (triggers webhook to delete from Convex)
 */
export const deleteAccount = protectedAction({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  async handler(ctx) {
    // Check if account can be deleted
    const deletionCheck = await ctx.runQuery(internal.users.internal.query.canDeleteAccountCheck, {
      userExternalId: ctx.user.externalId,
    });

    if (!deletionCheck.canDelete) {
      throw new ConvexError(deletionCheck.reason || 'Cannot delete account with active subscriptions');
    }

    const workos = new WorkOS(process.env.WORKOS_API_KEY);

    await ctx.runAction(internal.workos.internal.action.revokeAllUserSessions, {
      workosUserId: ctx.user.externalId,
    });

    // Delete the user from WorkOS
    // This will trigger the user.deleted webhook which handles:
    // - Revoking all sessions
    // - Deleting from Convex and PlanetScale
    await workos.userManagement.deleteUser(ctx.user.externalId);

    console.log(`[WorkOS] Deleted user ${ctx.user.email} (${ctx.user.externalId})`);

    return {
      success: true,
      message: 'Account deleted successfully',
    };
  },
});
