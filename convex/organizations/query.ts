import { v } from 'convex/values';
import { protectedQuery, publicQuery } from '../functions';

/**
 * Get an organization by its Convex ID.
 */
export const getOrganizationById = publicQuery({
  args: {
    id: v.id('organizations'),
  },
  returns: v.union(
    v.object({
      _id: v.id('organizations'),
      externalId: v.string(),
      name: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.id);
    if (!org) return null;
    return {
      _id: org._id,
      externalId: org.externalId,
      name: org.name,
    };
  },
});

export const getOrganizationsByUserId = protectedQuery({
  args: {},
  async handler(ctx) {
    const organizationMemberships = await ctx.db
      .query('organizationMemberships')
      .withIndex('by_user', (q) => q.eq('userId', ctx.user.externalId))
      .collect();

    if (!organizationMemberships) {
      return null;
    }

    const organizations = await Promise.all(
      organizationMemberships.map(async (membership) => {
        const organization = await ctx.db
          .query('organizations')
          .withIndex('externalId', (q) => q.eq('externalId', membership.organizationId))
          .first();

        if (organization) {
          // Get subscription tier using indexed query
          const activeSubscription = await ctx.db
            .query('organizationSubscriptions')
            .withIndex('by_organization_and_status', (q) =>
              q.eq('organizationId', organization._id).eq('status', 'active'),
            )
            .first();

          const subscriptionTier = activeSubscription?.tier || 'personal';
          const hasActiveSubscription = !!activeSubscription;

          return {
            ...organization,
            role: membership.role,
            subscriptionTier,
            hasActiveSubscription,
          };
        }
      }),
    );

    return organizations.filter((organization) => organization !== null && organization !== undefined);
  },
});

/**
 * Get the current organization details.
 */
export const getCurrent = protectedQuery({
  args: {
    organizationId: v.string(),
  },
  async handler(ctx, { organizationId }) {
    const organization = await ctx.db
      .query('organizations')
      .withIndex('externalId', (q) => q.eq('externalId', organizationId))
      .first();

    if (!organization) {
      return null;
    }

    // Get domain info
    const domains = await ctx.db
      .query('organizationDomains')
      .withIndex('organizationId', (q) => q.eq('organizationId', organization._id))
      .collect();

    // Get member count
    const memberships = await ctx.db
      .query('organizationMemberships')
      .withIndex('by_org', (q) => q.eq('organizationId', organizationId))
      .collect();

    // Get current user's role
    const currentUserMembership = memberships.find((m) => m.userId === ctx.user.externalId);

    // Get subscription tier using indexed query
    const activeSubscription = await ctx.db
      .query('organizationSubscriptions')
      .withIndex('by_organization_and_status', (q) =>
        q.eq('organizationId', organization._id).eq('status', 'active'),
      )
      .first();

    const subscriptionTier = activeSubscription?.tier || 'personal';
    const hasActiveSubscription = !!activeSubscription;

    return {
      ...organization,
      domains,
      memberCount: memberships.length,
      currentUserRole: currentUserMembership?.role || 'member',
      subscriptionTier,
      hasActiveSubscription,
    };
  },
});

/**
 * Get all members of an organization with their user details.
 */
export const getMembers = protectedQuery({
  args: {
    organizationId: v.string(),
  },
  async handler(ctx, { organizationId }) {
    // Get all memberships for this organization
    const memberships = await ctx.db
      .query('organizationMemberships')
      .withIndex('by_org', (q) => q.eq('organizationId', organizationId))
      .collect();

    // Get user details for each membership
    const membersWithDetails = await Promise.all(
      memberships.map(async (membership) => {
        const user = await ctx.db
          .query('users')
          .withIndex('by_external_id', (q) => q.eq('externalId', membership.userId))
          .first();

        return {
          ...membership,
          user: user
            ? {
                _id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                profilePictureUrl: user.profilePictureUrl,
              }
            : null,
        };
      }),
    );

    return membersWithDetails.filter((m) => m.user !== null);
  },
});

/**
 * Check if current user is admin of an organization.
 */
export const isAdmin = protectedQuery({
  args: {
    organizationId: v.string(),
  },
  async handler(ctx, { organizationId }) {
    const membership = await ctx.db
      .query('organizationMemberships')
      .withIndex('by_org_user', (q) => q.eq('organizationId', organizationId).eq('userId', ctx.user.externalId))
      .first();

    if (!membership) {
      return false;
    }

    return membership.role === 'admin' || membership.role === 'owner';
  },
});
