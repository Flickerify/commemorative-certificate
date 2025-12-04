import { v } from 'convex/values';
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

/**
 * Check if a user can delete their account.
 * Returns info about owned organizations and their subscription status.
 */
export const canDeleteAccountCheck = internalQuery({
  args: {
    userExternalId: v.string(),
  },
  returns: v.object({
    canDelete: v.boolean(),
    reason: v.optional(v.string()),
    organizationsWithActiveSubscriptions: v.array(v.string()),
    ownedOrganizations: v.array(
      v.object({
        externalId: v.string(),
        name: v.string(),
      }),
    ),
  }),
  handler: async (ctx, { userExternalId }) => {
    // Get all organization memberships for this user
    const memberships = await ctx.db
      .query('organizationMemberships')
      .withIndex('by_user', (q) => q.eq('userId', userExternalId))
      .collect();

    const orgsWithActiveSubscriptions: string[] = [];
    const ownedOrganizations: Array<{ externalId: string; name: string }> = [];

    // Check each organization for active subscriptions
    for (const membership of memberships) {
      // Only check organizations where user is admin (owner)
      if (membership.role !== 'admin') continue;

      // Get the organization
      const org = await ctx.db
        .query('organizations')
        .withIndex('externalId', (q) => q.eq('externalId', membership.organizationId))
        .first();

      if (!org) continue;

      ownedOrganizations.push({ externalId: org.externalId, name: org.name });

      // Check for active subscription
      const activeSubscription = await ctx.db
        .query('organizationSubscriptions')
        .withIndex('by_organization_and_status', (q) => q.eq('organizationId', org._id).eq('status', 'active'))
        .first();

      if (activeSubscription) {
        orgsWithActiveSubscriptions.push(org.name);
      }
    }

    if (orgsWithActiveSubscriptions.length > 0) {
      return {
        canDelete: false,
        reason: `You must cancel subscriptions for the following organizations before deleting your account: ${orgsWithActiveSubscriptions.join(', ')}`,
        organizationsWithActiveSubscriptions: orgsWithActiveSubscriptions,
        ownedOrganizations,
      };
    }

    return {
      canDelete: true,
      organizationsWithActiveSubscriptions: [],
      ownedOrganizations,
    };
  },
});
