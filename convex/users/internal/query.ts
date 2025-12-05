import { v, Infer } from 'convex/values';
import { internalQuery } from '../../functions';

export const findByExternalId = internalQuery({
  args: {
    externalId: v.string(),
  },
  handler: async (ctx, { externalId }) => {
    return await ctx.db
      .query('users')
      .withIndex('by_external_id', (q) => q.eq('externalId', externalId))
      .first();
  },
});

export const findByEmail = internalQuery({
  args: {
    email: v.string(),
  },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', email))
      .first();
  },
});

// Exported validators for reuse in action.ts
export const ownedOrgInfoValidator = v.object({
  organizationId: v.id('organizations'),
  externalId: v.string(),
  name: v.string(),
  hasActiveSubscription: v.boolean(),
  subscriptionStatus: v.optional(v.string()),
  cancelAtPeriodEnd: v.boolean(),
  currentPeriodEnd: v.optional(v.number()),
  memberCount: v.number(),
  hasOtherAdmins: v.boolean(),
  // Action required to delete account
  requiredAction: v.union(
    v.literal('none'), // Can delete - no subscription
    v.literal('transfer_ownership'), // Must transfer ownership to another admin/member
    v.literal('cancel_subscription'), // Must cancel subscription first
    v.literal('delete_organization'), // Must delete org (has active sub, no other admins)
  ),
});

// Exported validator for non-owned membership info
export const membershipInfoValidator = v.object({
  organizationId: v.id('organizations'),
  externalId: v.string(),
  name: v.string(),
  role: v.optional(v.string()),
  // These memberships will be auto-deleted
  willBeAutoDeleted: v.literal(true),
});

// Exported validator for the full result
export const canDeleteAccountCheckResultValidator = v.object({
  canDelete: v.boolean(),
  reason: v.optional(v.string()),
  ownedOrganizations: v.array(ownedOrgInfoValidator),
  memberOrganizations: v.array(membershipInfoValidator),
  totalOrganizations: v.number(),
  ownedCount: v.number(),
  memberCount: v.number(),
  organizationsRequiringAction: v.array(v.string()),
  hasBlockingIssues: v.boolean(),
});

// Export inferred types for use in other files
export type OwnedOrgInfo = Infer<typeof ownedOrgInfoValidator>;
export type MemberOrgInfo = Infer<typeof membershipInfoValidator>;
export type CanDeleteAccountCheckResult = Infer<typeof canDeleteAccountCheckResultValidator>;

/**
 * Check if a user can delete their account.
 * Provides comprehensive information about all organizations the user belongs to.
 *
 * User deletion rules (WorkOS roles: owner > admin > member):
 *
 * 1. If user is an OWNER with OTHER OWNERS in the org:
 *    - Can safely leave - membership will be auto-deleted
 *    - Other owners will continue managing the organization
 *
 * 2. If user is the SOLE OWNER with active subscription:
 *    - Must promote an admin to owner to keep the subscription, OR
 *    - Must cancel the subscription and delete the organization
 *
 * 3. If user is the SOLE OWNER without active subscription:
 *    - Must promote an admin to owner, OR delete the organization
 *
 * 4. If user is an ADMIN or MEMBER (not owner):
 *    - Can safely leave - membership will be auto-deleted
 *
 * A user can belong to multiple organizations - all must be handled.
 */
export const canDeleteAccountCheck = internalQuery({
  args: {
    userExternalId: v.string(),
  },
  returns: canDeleteAccountCheckResultValidator,
  handler: async (ctx, { userExternalId }) => {
    // Get all organization memberships for this user
    const memberships = await ctx.db
      .query('organizationMemberships')
      .withIndex('by_user', (q) => q.eq('userId', userExternalId))
      .collect();

    const ownedOrganizations: Array<OwnedOrgInfo> = [];

    const memberOrganizations: Array<MemberOrgInfo> = [];

    const organizationsRequiringAction: string[] = [];

    // Check each organization membership
    for (const membership of memberships) {
      // Get the organization
      const org = await ctx.db
        .query('organizations')
        .withIndex('externalId', (q) => q.eq('externalId', membership.organizationId))
        .first();

      if (!org) continue;

      // Only users with 'owner' role need special handling
      // 'admin' and 'member' roles can leave freely - their membership will be auto-deleted
      const isOwner = membership.role === 'owner';

      if (!isOwner) {
        // User is admin or member - membership will be auto-deleted
        memberOrganizations.push({
          organizationId: org._id,
          externalId: org.externalId,
          name: org.name,
          role: membership.role,
          willBeAutoDeleted: true as const,
        });
        continue;
      }

      // User is an OWNER - need to check if there are other owners
      const allOrgMemberships = await ctx.db
        .query('organizationMemberships')
        .withIndex('by_org', (q) => q.eq('organizationId', org.externalId))
        .collect();

      const memberCount = allOrgMemberships.length;

      // Check if there are OTHER OWNERS
      const otherOwners = allOrgMemberships.filter((m) => m.userId !== userExternalId && m.role === 'owner');
      const hasOtherOwners = otherOwners.length > 0;

      // If there are other owners, this owner can safely leave
      // Their membership will be auto-deleted, other owners will manage the org
      if (hasOtherOwners) {
        memberOrganizations.push({
          organizationId: org._id,
          externalId: org.externalId,
          name: org.name,
          role: membership.role,
          willBeAutoDeleted: true as const,
        });
        continue;
      }

      // User is the SOLE OWNER - need to handle subscription and org
      // Check if there are admins who could be promoted to owner
      const otherAdmins = allOrgMemberships.filter((m) => m.userId !== userExternalId && m.role === 'admin');
      const hasOtherAdmins = otherAdmins.length > 0;

      const activeSubscription = await ctx.db
        .query('organizationSubscriptions')
        .withIndex('by_organization_and_status', (q) => q.eq('organizationId', org._id).eq('status', 'active'))
        .first();

      // Determine required action for sole owner
      let requiredAction: 'none' | 'transfer_ownership' | 'cancel_subscription' | 'delete_organization';

      if (activeSubscription) {
        if (activeSubscription.cancelAtPeriodEnd) {
          // Subscription is already set to cancel
          if (hasOtherAdmins) {
            // Can promote an admin to owner
            requiredAction = 'transfer_ownership';
            organizationsRequiringAction.push(`${org.name}: Promote an admin to owner before deleting your account`);
          } else {
            // No other admins - must wait for subscription to end or delete org
            requiredAction = 'delete_organization';
            organizationsRequiringAction.push(
              `${org.name}: Delete the organization or wait for subscription to end (cancels on ${new Date(activeSubscription.currentPeriodEnd!).toLocaleDateString()})`,
            );
          }
        } else {
          // Active subscription not set to cancel
          if (hasOtherAdmins) {
            // Can promote an admin to owner to keep the subscription
            requiredAction = 'transfer_ownership';
            organizationsRequiringAction.push(
              `${org.name}: Promote an admin to owner to keep the subscription, or cancel it first`,
            );
          } else {
            // No other admins and active subscription - must cancel first
            requiredAction = 'cancel_subscription';
            organizationsRequiringAction.push(
              `${org.name}: Cancel subscription first, then delete the organization (you're the only owner)`,
            );
          }
        }
      } else {
        // No active subscription - org needs to be deleted or ownership transferred
        if (hasOtherAdmins) {
          // Can promote an admin to owner
          requiredAction = 'transfer_ownership';
          organizationsRequiringAction.push(`${org.name}: Promote an admin to owner, or delete the organization`);
        } else if (memberCount > 1) {
          // There are other members (but no admins) - should delete or handle
          requiredAction = 'delete_organization';
          organizationsRequiringAction.push(`${org.name}: Delete the organization (you're the only owner)`);
        } else {
          // User is the only member - must delete org
          requiredAction = 'delete_organization';
          organizationsRequiringAction.push(`${org.name}: Delete the organization first`);
        }
      }

      ownedOrganizations.push({
        organizationId: org._id,
        externalId: org.externalId,
        name: org.name,
        hasActiveSubscription: !!activeSubscription,
        subscriptionStatus: activeSubscription?.status,
        cancelAtPeriodEnd: activeSubscription?.cancelAtPeriodEnd ?? false,
        currentPeriodEnd: activeSubscription?.currentPeriodEnd,
        memberCount,
        hasOtherAdmins,
        requiredAction,
      });
    }

    const hasBlockingIssues = organizationsRequiringAction.length > 0;
    const canDelete = !hasBlockingIssues;

    let reason: string | undefined;
    if (!canDelete) {
      if (organizationsRequiringAction.length === 1) {
        reason = organizationsRequiringAction[0];
      } else {
        reason = `You must resolve the following before deleting your account:\n${organizationsRequiringAction.map((a, i) => `${i + 1}. ${a}`).join('\n')}`;
      }
    }

    return {
      canDelete,
      reason,
      ownedOrganizations,
      memberOrganizations,
      totalOrganizations: memberships.length,
      ownedCount: ownedOrganizations.length,
      memberCount: memberOrganizations.length,
      organizationsRequiringAction,
      hasBlockingIssues,
    };
  },
});
