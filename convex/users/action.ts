import { v } from 'convex/values';
import { ConvexError } from 'convex/values';
import { WorkOS } from '@workos-inc/node';
import { protectedAction } from '../functions';
import { languageValidator, Metadata } from '../schema';
import { internal } from '../_generated/api';
// Import validators and types from internal query (single source of truth)
import { type CanDeleteAccountCheckResult } from './internal/query';

export const completeOnboarding = protectedAction({
  args: {
    preferredLocale: v.optional(languageValidator),
  },
  async handler(ctx, args) {
    // Build metadata
    const metadata: Metadata = {
      onboardingComplete: true,
    };

    if (args.preferredLocale) {
      metadata.preferredLocale = args.preferredLocale;
    }

    // Update Convex - metadata is stored locally only (not synced to WorkOS)
    await ctx.runMutation(internal.users.internal.mutation.updateMetadata, {
      userId: ctx.user._id,
      metadata,
    });

    return { success: true };
  },
});

/**
 * Update user preferences (theme, language, notifications, etc.)
 * Metadata is stored locally in Convex only (not synced to WorkOS).
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
      metadata.emailNotifications = args.emailNotifications ? true : false;
    }

    if (args.marketingEmails !== undefined) {
      metadata.marketingEmails = args.marketingEmails ? true : false;
    }

    // Update Convex - metadata is stored locally only (not synced to WorkOS)
    await ctx.runMutation(internal.users.internal.mutation.updateMetadata, {
      userId: ctx.user._id,
      metadata,
    });

    return { success: true, metadata };
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
 * Delete user account.
 *
 * IMPORTANT: This action has safeguards to prevent data loss:
 *
 * 1. If user owns organizations with active subscriptions:
 *    - They must first transfer ownership to another admin, OR
 *    - Cancel the subscription and delete the organization
 *
 * 2. If user owns organizations without subscriptions:
 *    - They must delete those organizations first
 *
 * 3. If user is a member (not owner) of organizations:
 *    - Their memberships will be automatically deleted
 *    - The user from WorkOS will be deleted
 *    - The webhook will handle cleanup in Convex and PlanetScale
 *
 * This action will:
 * 1. Check if user can be deleted (comprehensive org check)
 * 2. Revoke all user sessions
 * 3. Delete the user from WorkOS (triggers webhook for cleanup)
 */
export const deleteAccount = protectedAction({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    // Include details about what was affected
    deletedMemberships: v.number(),
  }),
  async handler(ctx) {
    // Comprehensive check if account can be deleted
    // Explicit type annotation to break circular reference
    const deletionCheck: CanDeleteAccountCheckResult = await ctx.runQuery(
      internal.users.internal.query.canDeleteAccountCheck,
      { userExternalId: ctx.user.externalId },
    );

    if (!deletionCheck.canDelete) {
      // Build a helpful error message
      let errorMessage = 'Cannot delete your account.\n\n';

      if (deletionCheck.ownedOrganizations.length > 0) {
        errorMessage += 'You own the following organizations that require action:\n';
        for (const org of deletionCheck.ownedOrganizations) {
          switch (org.requiredAction) {
            case 'transfer_ownership':
              errorMessage += `• ${org.name}: Transfer ownership to another admin`;
              if (org.hasActiveSubscription) {
                errorMessage += ' (to keep the subscription active)';
              }
              errorMessage += '\n';
              break;
            case 'cancel_subscription':
              errorMessage += `• ${org.name}: Cancel the subscription first (you're the only admin)\n`;
              break;
            case 'delete_organization':
              if (org.hasActiveSubscription && org.cancelAtPeriodEnd) {
                errorMessage += `• ${org.name}: Wait for subscription to end on ${new Date(org.currentPeriodEnd!).toLocaleDateString()}, or delete the organization now\n`;
              } else {
                errorMessage += `• ${org.name}: Delete the organization first\n`;
              }
              break;
          }
        }
      }

      throw new ConvexError(errorMessage.trim());
    }

    const workos = new WorkOS(process.env.WORKOS_API_KEY);

    // Revoke all user sessions first
    await ctx.runAction(internal.workos.internal.action.revokeAllUserSessions, {
      workosUserId: ctx.user.externalId,
    });

    // Delete all non-owner memberships from WorkOS
    // (Owner memberships should have been handled before calling this)
    // WorkOS will handle membership deletion automatically when user is deleted,
    // but we log for tracking purposes
    const membershipCount = deletionCheck.memberOrganizations.length;
    console.log(
      `[Account Deletion] User ${ctx.user.email} has ${membershipCount} non-owner membership(s) that will be auto-deleted`,
    );

    // Delete the user from WorkOS
    // This will trigger the user.deleted webhook which handles:
    // - Deleting all memberships from Convex
    // - Deleting from Convex users table
    // - Syncing deletion to PlanetScale
    await workos.userManagement.deleteUser(ctx.user.externalId);

    console.log(`[WorkOS] Deleted user ${ctx.user.email} (${ctx.user.externalId})`);

    return {
      success: true,
      message:
        membershipCount > 0
          ? `Account deleted successfully. ${membershipCount} organization membership(s) were also removed.`
          : 'Account deleted successfully.',
      deletedMemberships: membershipCount,
    };
  },
});
