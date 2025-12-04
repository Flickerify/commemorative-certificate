import { v } from 'convex/values';
import { internalQuery as baseInternalQuery, DatabaseReader } from '../_generated/server';
import { protectedQuery, internalQuery } from '../functions';
import { Id, Doc } from '../_generated/dataModel';

/**
 * Helper to find active subscription using the by_organization_and_status index.
 */
async function findActiveSubscription(
  db: DatabaseReader,
  organizationId: Id<'organizations'>,
): Promise<Doc<'organizationSubscriptions'> | null> {
  // Check for 'active' status
  const activeSubscription = await db
    .query('organizationSubscriptions')
    .withIndex('by_organization_and_status', (q) => q.eq('organizationId', organizationId).eq('status', 'active'))
    .first();

  return activeSubscription;
}

/**
 * Helper to get the most recent subscription (for fallback when no active).
 */
async function getMostRecentSubscription(
  db: DatabaseReader,
  organizationId: Id<'organizations'>,
): Promise<Doc<'organizationSubscriptions'> | null> {
  const subscriptions = await db
    .query('organizationSubscriptions')
    .withIndex('by_organization', (q) => q.eq('organizationId', organizationId))
    .collect();

  if (subscriptions.length === 0) return null;

  return subscriptions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
}

/**
 * Helper to count total subscriptions for an organization.
 */
async function countSubscriptions(db: DatabaseReader, organizationId: Id<'organizations'>): Promise<number> {
  const subscriptions = await db
    .query('organizationSubscriptions')
    .withIndex('by_organization', (q) => q.eq('organizationId', organizationId))
    .collect();

  return subscriptions.length;
}

/**
 * Get subscription with pending checkout info.
 * Used to check if there's an abandoned checkout that can be resumed.
 */
export const getSubscriptionWithPending = internalQuery({
  args: {
    organizationId: v.id('organizations'),
  },
  returns: v.union(
    v.object({
      _id: v.id('organizationSubscriptions'),
      status: v.string(),
      tier: v.string(),
      pendingCheckoutSessionId: v.optional(v.string()),
      pendingPriceId: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query('organizationSubscriptions')
      .withIndex('by_organization', (q) => q.eq('organizationId', args.organizationId))
      .first();

    if (!subscription) return null;

    return {
      _id: subscription._id,
      status: subscription.status,
      tier: subscription.tier,
      pendingCheckoutSessionId: subscription.pendingCheckoutSessionId,
      pendingPriceId: subscription.pendingPriceId,
    };
  },
});

/**
 * Get Stripe customer for an organization.
 */
export const getStripeCustomer = internalQuery({
  args: {
    organizationId: v.id('organizations'),
  },
  returns: v.union(
    v.object({
      _id: v.id('stripeCustomers'),
      organizationId: v.id('organizations'),
      stripeCustomerId: v.string(),
      createdAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query('stripeCustomers')
      .withIndex('by_organization', (q) => q.eq('organizationId', args.organizationId))
      .first();

    if (!customer) return null;

    return {
      _id: customer._id,
      organizationId: customer.organizationId,
      stripeCustomerId: customer.stripeCustomerId,
      createdAt: customer.createdAt,
    };
  },
});

/**
 * Get subscription for an organization.
 * Returns the subscription object or null if no subscription exists (personal workspace).
 *
 * Note: Personal workspaces do NOT have subscriptions.
 * Regular organizations MUST have a subscription (Pro or Enterprise).
 *
 * States:
 * - isPersonalWorkspace: true = Personal workspace (no subscription needed)
 * - isPendingSetup: true = Organization created but checkout not completed
 * - hasActiveSubscription: true = Active subscription
 * - hasActiveSubscription: false = Canceled/past_due/etc
 */
export const getOrganizationSubscription = protectedQuery({
  args: {
    organizationId: v.id('organizations'),
  },
  returns: v.union(
    // Active organization with subscription
    v.object({
      tier: v.union(v.literal('personal'), v.literal('pro'), v.literal('enterprise')),
      status: v.string(),
      billingInterval: v.optional(v.union(v.literal('month'), v.literal('year'))),
      currentPeriodStart: v.optional(v.number()),
      currentPeriodEnd: v.optional(v.number()),
      cancelAtPeriodEnd: v.boolean(),
      cancelAt: v.optional(v.number()), // Scheduled cancellation timestamp (ms)
      seatLimit: v.number(),
      paymentMethodBrand: v.optional(v.string()),
      paymentMethodLast4: v.optional(v.string()),
      features: v.array(v.string()),
      hasActiveSubscription: v.boolean(),
      isPersonalWorkspace: v.literal(false),
      isPendingSetup: v.literal(false),
      // Money-back guarantee info
      isWithinGuaranteePeriod: v.boolean(),
      guaranteeDaysRemaining: v.optional(v.number()),
    }),
    // Personal workspace (no subscription) - legacy, should not happen with new signup flow
    v.object({
      isPersonalWorkspace: v.literal(true),
      isPendingSetup: v.literal(false),
      tier: v.literal('personal'),
      status: v.literal('none'),
      cancelAtPeriodEnd: v.literal(false),
      seatLimit: v.literal(1),
      features: v.array(v.string()),
      hasActiveSubscription: v.literal(false),
    }),
    // Pending setup (checkout not completed)
    v.object({
      isPersonalWorkspace: v.literal(false),
      isPendingSetup: v.literal(true),
      pendingCheckoutSessionId: v.optional(v.string()),
      tier: v.literal('personal'),
      status: v.literal('none'),
      cancelAtPeriodEnd: v.literal(false),
      seatLimit: v.literal(1),
      features: v.array(v.string()),
      hasActiveSubscription: v.literal(false),
    }),
  ),
  handler: async (ctx, args) => {
    // First, try to find an active subscription using the indexed query (most efficient)
    const activeSubscription = await findActiveSubscription(ctx.db, args.organizationId);

    if (activeSubscription) {
      // Calculate money-back guarantee period (30 days from subscription start)
      const GUARANTEE_DAYS = 30;
      const now = Date.now();
      const subscriptionStart = activeSubscription.currentPeriodStart ?? activeSubscription.createdAt;
      const guaranteeEndMs = subscriptionStart + GUARANTEE_DAYS * 24 * 60 * 60 * 1000;
      const isWithinGuaranteePeriod = now < guaranteeEndMs;
      const guaranteeDaysRemaining = isWithinGuaranteePeriod
        ? Math.max(0, Math.ceil((guaranteeEndMs - now) / (1000 * 60 * 60 * 24)))
        : undefined;

      return {
        isPersonalWorkspace: false as const,
        isPendingSetup: false as const,
        tier: activeSubscription.tier as 'personal' | 'pro' | 'enterprise',
        status: activeSubscription.status,
        billingInterval: activeSubscription.billingInterval,
        currentPeriodStart: activeSubscription.currentPeriodStart,
        currentPeriodEnd: activeSubscription.currentPeriodEnd,
        cancelAtPeriodEnd: activeSubscription.cancelAtPeriodEnd,
        cancelAt: activeSubscription.cancelAt,
        seatLimit: activeSubscription.seatLimit,
        paymentMethodBrand: activeSubscription.paymentMethodBrand,
        paymentMethodLast4: activeSubscription.paymentMethodLast4,
        features: getFeaturesForTier(activeSubscription.tier),
        hasActiveSubscription: true as const,
        isWithinGuaranteePeriod,
        guaranteeDaysRemaining,
      };
    }

    // No active subscription - check for pending setup using indexed query
    const pendingSubscription = await ctx.db
      .query('organizationSubscriptions')
      .withIndex('by_organization_and_status', (q) => q.eq('organizationId', args.organizationId).eq('status', 'none'))
      .first();

    if (pendingSubscription?.pendingCheckoutSessionId) {
      return {
        isPersonalWorkspace: false as const,
        isPendingSetup: true as const,
        pendingCheckoutSessionId: pendingSubscription.pendingCheckoutSessionId,
        tier: 'personal' as const,
        status: 'none' as const,
        cancelAtPeriodEnd: false as const,
        seatLimit: 1 as const,
        features: getFeaturesForTier('personal'),
        hasActiveSubscription: false as const,
      };
    }

    // No active or pending - get most recent subscription (for canceled history)
    const mostRecentSubscription = await getMostRecentSubscription(ctx.db, args.organizationId);

    // No subscriptions at all = personal workspace (legacy)
    if (!mostRecentSubscription) {
      return {
        isPersonalWorkspace: true as const,
        isPendingSetup: false as const,
        tier: 'personal' as const,
        status: 'none' as const,
        cancelAtPeriodEnd: false as const,
        seatLimit: 1 as const,
        features: getFeaturesForTier('personal'),
        hasActiveSubscription: false as const,
      };
    }

    // Return most recent (likely canceled) subscription info
    return {
      isPersonalWorkspace: false as const,
      isPendingSetup: false as const,
      tier: mostRecentSubscription.tier as 'personal' | 'pro' | 'enterprise',
      status: mostRecentSubscription.status,
      billingInterval: mostRecentSubscription.billingInterval,
      currentPeriodStart: mostRecentSubscription.currentPeriodStart,
      currentPeriodEnd: mostRecentSubscription.currentPeriodEnd,
      cancelAtPeriodEnd: mostRecentSubscription.cancelAtPeriodEnd,
      cancelAt: mostRecentSubscription.cancelAt,
      seatLimit: mostRecentSubscription.seatLimit,
      paymentMethodBrand: mostRecentSubscription.paymentMethodBrand,
      paymentMethodLast4: mostRecentSubscription.paymentMethodLast4,
      features: getFeaturesForTier(mostRecentSubscription.tier),
      hasActiveSubscription: false as const,
      isWithinGuaranteePeriod: false,
    };
  },
});

/**
 * Get all subscriptions for an organization (for history).
 */
export const getAllOrganizationSubscriptions = protectedQuery({
  args: {
    organizationId: v.id('organizations'),
  },
  returns: v.array(
    v.object({
      _id: v.id('organizationSubscriptions'),
      stripeSubscriptionId: v.optional(v.string()),
      tier: v.string(),
      status: v.string(),
      billingInterval: v.optional(v.union(v.literal('month'), v.literal('year'))),
      currentPeriodStart: v.optional(v.number()),
      currentPeriodEnd: v.optional(v.number()),
      cancelAtPeriodEnd: v.boolean(),
      cancelAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const subscriptions = await ctx.db
      .query('organizationSubscriptions')
      .withIndex('by_organization', (q) => q.eq('organizationId', args.organizationId))
      .collect();

    return subscriptions
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .map((sub) => ({
        _id: sub._id,
        stripeSubscriptionId: sub.stripeSubscriptionId,
        tier: sub.tier,
        status: sub.status,
        billingInterval: sub.billingInterval,
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        cancelAt: sub.cancelAt,
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt,
      }));
  },
});

/**
 * Get seat information for an organization.
 */
export const getSeatInfo = protectedQuery({
  args: {
    organizationId: v.id('organizations'),
  },
  returns: v.object({
    currentSeats: v.number(),
    seatLimit: v.number(),
    isUnlimited: v.boolean(),
    canAddMember: v.boolean(),
    utilizationPercent: v.number(),
    tier: v.union(v.literal('personal'), v.literal('pro'), v.literal('enterprise')),
    isPersonalWorkspace: v.boolean(),
    isPendingSetup: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // Get the organization to find its external ID
    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      return {
        currentSeats: 0,
        seatLimit: 1,
        isUnlimited: false,
        canAddMember: false,
        utilizationPercent: 0,
        tier: 'personal' as const,
        isPersonalWorkspace: true,
        isPendingSetup: false,
      };
    }

    // Count active memberships
    const memberships = await ctx.db
      .query('organizationMemberships')
      .withIndex('by_org', (q) => q.eq('organizationId', org.externalId))
      .filter((q) => q.eq(q.field('status'), 'active'))
      .collect();

    const currentSeats = memberships.length;

    // Get all subscriptions and find the active one (or most recent)
    const allSubscriptions = await ctx.db
      .query('organizationSubscriptions')
      .withIndex('by_organization', (q) => q.eq('organizationId', args.organizationId))
      .collect();

    // Prioritize active subscriptions
    const activeSubscription = allSubscriptions.find((sub) => sub.status === 'active');
    const subscription =
      activeSubscription || allSubscriptions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];

    // No subscription = personal workspace
    const isPersonalWorkspace = !subscription;
    const tier = subscription?.tier ?? ('personal' as const);
    const seatLimit = subscription?.seatLimit ?? 1;
    const isUnlimited = seatLimit === -1;
    const canAddMember = isUnlimited || currentSeats < seatLimit;
    const utilizationPercent = isUnlimited ? 0 : Math.min((currentSeats / seatLimit) * 100, 100);

    // Check if pending setup
    const isPendingSetup = subscription?.status === 'none' && subscription?.pendingCheckoutSessionId !== undefined;

    return {
      currentSeats,
      seatLimit,
      isUnlimited,
      canAddMember,
      utilizationPercent,
      tier: tier as 'personal' | 'pro' | 'enterprise',
      isPersonalWorkspace,
      isPendingSetup,
    };
  },
});

/**
 * Check if organization has a specific feature.
 */
export const hasFeature = protectedQuery({
  args: {
    organizationId: v.id('organizations'),
    feature: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    // Use indexed query to find active subscription
    const activeSubscription = await findActiveSubscription(ctx.db, args.organizationId);
    const tier = activeSubscription?.tier ?? 'personal';
    const features = getFeaturesForTier(tier);

    return features.includes(args.feature);
  },
});

/**
 * Check if an organization can be deleted.
 * Organizations with active subscriptions cannot be deleted.
 * Organizations with pending checkout CAN be deleted.
 * Returns deletion status and reason.
 */
export const canDeleteOrganization = protectedQuery({
  args: {
    organizationId: v.id('organizations'),
  },
  returns: v.object({
    canDelete: v.boolean(),
    reason: v.optional(v.string()),
    hasActiveSubscription: v.boolean(),
    cancelAtPeriodEnd: v.boolean(),
    currentPeriodEnd: v.optional(v.number()),
    isPendingSetup: v.boolean(),
    totalSubscriptions: v.number(),
    activeSubscriptions: v.number(),
  }),
  handler: async (ctx, args) => {
    // First, efficiently check for active subscription using indexed query
    const activeSubscription = await findActiveSubscription(ctx.db, args.organizationId);

    if (activeSubscription) {
      // Has active subscription - cannot delete
      const totalSubscriptions = await countSubscriptions(ctx.db, args.organizationId);

      if (activeSubscription.cancelAtPeriodEnd) {
        return {
          canDelete: false,
          reason: `Subscription is set to cancel on ${new Date(activeSubscription.currentPeriodEnd!).toLocaleDateString()}. You can delete the organization after this date.`,
          hasActiveSubscription: true,
          cancelAtPeriodEnd: true,
          currentPeriodEnd: activeSubscription.currentPeriodEnd,
          isPendingSetup: false,
          totalSubscriptions,
          activeSubscriptions: 1,
        };
      }

      return {
        canDelete: false,
        reason: 'You must cancel your subscription before deleting this organization.',
        hasActiveSubscription: true,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: activeSubscription.currentPeriodEnd,
        isPendingSetup: false,
        totalSubscriptions,
        activeSubscriptions: 1,
      };
    }

    // No active subscription - check for pending setup using indexed query
    const pendingSubscription = await ctx.db
      .query('organizationSubscriptions')
      .withIndex('by_organization_and_status', (q) => q.eq('organizationId', args.organizationId).eq('status', 'none'))
      .first();

    if (pendingSubscription?.pendingCheckoutSessionId) {
      const totalSubscriptions = await countSubscriptions(ctx.db, args.organizationId);
      return {
        canDelete: true,
        reason: 'Organization setup was not completed. You can safely delete it.',
        hasActiveSubscription: false,
        cancelAtPeriodEnd: false,
        isPendingSetup: true,
        totalSubscriptions,
        activeSubscriptions: 0,
      };
    }

    // No active or pending - count total and get most recent for details
    const totalSubscriptions = await countSubscriptions(ctx.db, args.organizationId);

    // No subscriptions = can delete
    if (totalSubscriptions === 0) {
      return {
        canDelete: true,
        hasActiveSubscription: false,
        cancelAtPeriodEnd: false,
        isPendingSetup: false,
        totalSubscriptions: 0,
        activeSubscriptions: 0,
      };
    }

    // Has subscriptions but none active = can delete (all canceled)
    const mostRecent = await getMostRecentSubscription(ctx.db, args.organizationId);
    return {
      canDelete: true,
      hasActiveSubscription: false,
      cancelAtPeriodEnd: mostRecent?.cancelAtPeriodEnd || false,
      currentPeriodEnd: mostRecent?.currentPeriodEnd,
      isPendingSetup: false,
      totalSubscriptions,
      activeSubscriptions: 0,
    };
  },
});

/**
 * Internal version for use in actions.
 * Uses indexed queries for efficient lookup.
 */
export const canDeleteOrganizationInternal = baseInternalQuery({
  args: {
    organizationId: v.id('organizations'),
  },
  returns: v.object({
    canDelete: v.boolean(),
    reason: v.optional(v.string()),
    hasActiveSubscription: v.boolean(),
    totalSubscriptions: v.number(),
    activeSubscriptions: v.number(),
  }),
  handler: async (ctx, args) => {
    // Efficiently check for active subscription using indexed query
    const activeSubscription = await findActiveSubscription(ctx.db, args.organizationId);

    if (activeSubscription) {
      const totalSubscriptions = await countSubscriptions(ctx.db, args.organizationId);
      return {
        canDelete: false,
        reason: activeSubscription.cancelAtPeriodEnd
          ? `Subscription cancels on ${new Date(activeSubscription.currentPeriodEnd!).toLocaleDateString()}`
          : 'Active subscription must be canceled first',
        hasActiveSubscription: true,
        totalSubscriptions,
        activeSubscriptions: 1,
      };
    }

    // No active subscription - count total
    const totalSubscriptions = await countSubscriptions(ctx.db, args.organizationId);

    return {
      canDelete: true,
      hasActiveSubscription: false,
      totalSubscriptions,
      activeSubscriptions: 0,
    };
  },
});

/**
 * Get features available for a tier.
 */
function getFeaturesForTier(tier: 'personal' | 'pro' | 'enterprise'): string[] {
  const personalFeatures = ['basic_api', 'community_support'];

  const proFeatures = [
    ...personalFeatures,
    'advanced_api',
    'custom_schemas',
    'api_analytics',
    'email_support',
    'priority_queue',
  ];

  const enterpriseFeatures = [
    ...proFeatures,
    'unlimited_members',
    'advanced_analytics',
    'custom_integrations',
    'priority_support',
    'sso_saml',
    'audit_logs',
    'custom_branding',
  ];

  switch (tier) {
    case 'enterprise':
      return enterpriseFeatures;
    case 'pro':
      return proFeatures;
    case 'personal':
    // Personal tier has same features as basic tier (removed 'none' case)
    default:
      return personalFeatures;
  }
}
