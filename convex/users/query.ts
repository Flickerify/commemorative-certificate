import { internal } from '../_generated/api';
import { protectedQuery } from '../functions';
import { v } from 'convex/values';
import { ownedOrgInfoValidator } from './internal/query';
import { membershipInfoValidator } from './internal/query';
import { CanDeleteAccountCheckResult } from './internal/query';

/**
 * Check if user account can be deleted.
 * Provides comprehensive information about all organizations the user belongs to.
 *
 * User deletion rules:
 * 1. If owner of an org with active subscription:
 *    - Must transfer ownership to another member if they want to keep the subscription
 *    - OR must delete the organization (which requires canceling the subscription first)
 * 2. If owner of an org without active subscription:
 *    - Must delete the organization first (no subscription to worry about)
 * 3. If member/admin (not owner) of an org:
 *    - Membership will be automatically deleted when user deletes their account
 *
 * A user can belong to multiple organizations - all must be handled.
 */
export const canDeleteAccount = protectedQuery({
  args: {},
  returns: v.object({
    canDelete: v.boolean(),
    reason: v.optional(v.string()),
    // Detailed breakdown
    ownedOrganizations: v.array(ownedOrgInfoValidator),
    memberOrganizations: v.array(membershipInfoValidator),
    // Summary counts
    totalOrganizations: v.number(),
    ownedCount: v.number(),
    memberCount: v.number(),
    // Blocking issues
    organizationsRequiringAction: v.array(v.string()),
    hasBlockingIssues: v.boolean(),
  }),
  async handler(ctx) {
    const result: CanDeleteAccountCheckResult = await ctx.runQuery(
      internal.users.internal.query.canDeleteAccountCheck,
      { userExternalId: ctx.user.externalId },
    );

    return {
      canDelete: result.canDelete,
      reason: result.reason,
      ownedOrganizations: result.ownedOrganizations,
      memberOrganizations: result.memberOrganizations,
      totalOrganizations: result.totalOrganizations,
      ownedCount: result.ownedCount,
      memberCount: result.memberCount,
      organizationsRequiringAction: result.organizationsRequiringAction,
      hasBlockingIssues: result.hasBlockingIssues,
    };
  },
});

export const me = protectedQuery({
  args: {},
  async handler(ctx) {
    return ctx.user;
  },
});

/**
 * Get onboarding context for the current user.
 * This determines whether the user needs to create an organization
 * or if they've already been invited to one.
 *
 * Flow logic:
 * - If user has NO organization memberships → must create org + subscription
 * - If user has ANY organization membership (owner, admin, or member) → skip org creation
 *   (they were invited to an existing organization)
 */
export const getOnboardingContext = protectedQuery({
  args: {},
  returns: v.object({
    // Whether user needs to create an organization (no existing memberships)
    requiresOrgCreation: v.boolean(),
    // User's existing memberships
    memberships: v.array(
      v.object({
        organizationId: v.string(),
        organizationName: v.string(),
        roleSlug: v.string(), // e.g., 'owner', 'admin', 'member', 'finance'
      }),
    ),
    // Summary info
    hasOrganizations: v.boolean(),
  }),
  async handler(ctx) {
    // Get all organization memberships for this user
    const memberships = await ctx.db
      .query('organizationMemberships')
      .withIndex('by_user', (q) => q.eq('userId', ctx.user.externalId))
      .collect();

    if (memberships.length === 0) {
      // No organizations - user must create one
      return {
        requiresOrgCreation: true,
        memberships: [],
        hasOrganizations: false,
      };
    }

    // Get organization details for each membership
    const membershipDetails: Array<{
      organizationId: string;
      organizationName: string;
      roleSlug: string;
    }> = [];

    for (const membership of memberships) {
      const org = await ctx.db
        .query('organizations')
        .withIndex('externalId', (q) => q.eq('externalId', membership.organizationId))
        .first();

      if (!org) continue;

      membershipDetails.push({
        organizationId: org.externalId,
        organizationName: org.name,
        roleSlug: membership.roleSlug ?? 'member',
      });
    }

    // User already belongs to organization(s) - no need to create one
    return {
      requiresOrgCreation: false,
      memberships: membershipDetails,
      hasOrganizations: true,
    };
  },
});
