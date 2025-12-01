import { v } from 'convex/values';
import { internalQuery as baseInternalQuery } from '../_generated/server';
import { protectedQuery, internalQuery } from '../functions';

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
 * - hasActiveSubscription: true = Active/trialing subscription
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
      // Trial info
      trialStart: v.optional(v.number()),
      trialEnd: v.optional(v.number()),
      isTrialing: v.boolean(),
      trialDaysRemaining: v.optional(v.number()),
      seatLimit: v.number(),
      paymentMethodBrand: v.optional(v.string()),
      paymentMethodLast4: v.optional(v.string()),
      features: v.array(v.string()),
      hasActiveSubscription: v.boolean(),
      isPersonalWorkspace: v.literal(false),
      isPendingSetup: v.literal(false),
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
      isTrialing: v.literal(false),
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
      isTrialing: v.literal(false),
    }),
  ),
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query('organizationSubscriptions')
      .withIndex('by_organization', (q) => q.eq('organizationId', args.organizationId))
      .first();

    // No subscription = personal workspace (legacy, should not happen with new signup flow)
    if (!subscription) {
      return {
        isPersonalWorkspace: true as const,
        isPendingSetup: false as const,
        tier: 'personal' as const,
        status: 'none' as const,
        cancelAtPeriodEnd: false as const,
        seatLimit: 1 as const,
        features: getFeaturesForTier('personal'),
        hasActiveSubscription: false as const,
        isTrialing: false as const,
      };
    }

    // Check if this is a pending setup (has pending checkout and status is 'none')
    const isPendingSetup = subscription.status === 'none' && subscription.pendingCheckoutSessionId !== undefined;

    if (isPendingSetup) {
      return {
        isPersonalWorkspace: false as const,
        isPendingSetup: true as const,
        pendingCheckoutSessionId: subscription.pendingCheckoutSessionId,
        tier: 'personal' as const,
        status: 'none' as const,
        cancelAtPeriodEnd: false as const,
        seatLimit: 1 as const,
        features: getFeaturesForTier('personal'),
        hasActiveSubscription: false as const,
        isTrialing: false as const,
      };
    }

    const hasActiveSubscription = subscription.status === 'active' || subscription.status === 'trialing';
    const isTrialing = subscription.status === 'trialing';

    // Calculate trial days remaining
    let trialDaysRemaining: number | undefined;
    if (isTrialing && subscription.trialEnd) {
      const now = Date.now();
      const msRemaining = subscription.trialEnd - now;
      trialDaysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
    }

    return {
      isPersonalWorkspace: false as const,
      isPendingSetup: false as const,
      tier: subscription.tier as 'personal' | 'pro' | 'enterprise',
      status: subscription.status,
      billingInterval: subscription.billingInterval,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      cancelAt: subscription.cancelAt, // Scheduled cancellation timestamp
      trialStart: subscription.trialStart,
      trialEnd: subscription.trialEnd,
      isTrialing,
      trialDaysRemaining,
      seatLimit: subscription.seatLimit,
      paymentMethodBrand: subscription.paymentMethodBrand,
      paymentMethodLast4: subscription.paymentMethodLast4,
      features: getFeaturesForTier(subscription.tier),
      hasActiveSubscription,
    };
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

    // Get subscription tier
    const subscription = await ctx.db
      .query('organizationSubscriptions')
      .withIndex('by_organization', (q) => q.eq('organizationId', args.organizationId))
      .first();

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
    const subscription = await ctx.db
      .query('organizationSubscriptions')
      .withIndex('by_organization', (q) => q.eq('organizationId', args.organizationId))
      .first();

    const tier = subscription?.tier ?? 'personal';
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
  }),
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query('organizationSubscriptions')
      .withIndex('by_organization', (q) => q.eq('organizationId', args.organizationId))
      .first();

    // No subscription = personal workspace (can delete)
    if (!subscription) {
      return {
        canDelete: true,
        hasActiveSubscription: false,
        cancelAtPeriodEnd: false,
        isPendingSetup: false,
      };
    }

    // Check if this is a pending setup (checkout never completed)
    const isPendingSetup = subscription.status === 'none' && subscription.pendingCheckoutSessionId !== undefined;
    if (isPendingSetup) {
      return {
        canDelete: true,
        reason: 'Organization setup was not completed. You can safely delete it.',
        hasActiveSubscription: false,
        cancelAtPeriodEnd: false,
        isPendingSetup: true,
      };
    }

    const hasActiveSubscription = subscription.status === 'active' || subscription.status === 'trialing';
    const cancelAtPeriodEnd = subscription.cancelAtPeriodEnd;

    // Can delete if:
    // 1. No active subscription
    // 2. Subscription is canceled (not just cancelAtPeriodEnd)
    // 3. Subscription is set to cancel at period end (we allow deletion after period ends)
    if (!hasActiveSubscription) {
      return {
        canDelete: true,
        hasActiveSubscription: false,
        cancelAtPeriodEnd,
        currentPeriodEnd: subscription.currentPeriodEnd,
        isPendingSetup: false,
      };
    }

    // Has active subscription - check if it's set to cancel
    if (cancelAtPeriodEnd) {
      return {
        canDelete: false,
        reason: `Subscription is set to cancel on ${new Date(subscription.currentPeriodEnd!).toLocaleDateString()}. You can delete the organization after this date, or wait for the subscription to end.`,
        hasActiveSubscription: true,
        cancelAtPeriodEnd: true,
        currentPeriodEnd: subscription.currentPeriodEnd,
        isPendingSetup: false,
      };
    }

    // Active subscription without cancellation
    return {
      canDelete: false,
      reason: 'You must cancel your subscription before deleting this organization.',
      hasActiveSubscription: true,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: subscription.currentPeriodEnd,
      isPendingSetup: false,
    };
  },
});

/**
 * Internal version for use in actions.
 */
export const canDeleteOrganizationInternal = baseInternalQuery({
  args: {
    organizationId: v.id('organizations'),
  },
  returns: v.object({
    canDelete: v.boolean(),
    reason: v.optional(v.string()),
    hasActiveSubscription: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query('organizationSubscriptions')
      .withIndex('by_organization', (q) => q.eq('organizationId', args.organizationId))
      .first();

    // No subscription = can delete
    if (!subscription) {
      return {
        canDelete: true,
        hasActiveSubscription: false,
      };
    }

    // Pending setup (checkout never completed) = can delete
    const isPendingSetup = subscription.status === 'none' && subscription.pendingCheckoutSessionId !== undefined;
    if (isPendingSetup) {
      return {
        canDelete: true,
        hasActiveSubscription: false,
      };
    }

    const hasActiveSubscription = subscription.status === 'active' || subscription.status === 'trialing';

    // Can delete if no active subscription or subscription is fully canceled
    if (!hasActiveSubscription || subscription.status === 'canceled') {
      return {
        canDelete: true,
        hasActiveSubscription: false,
      };
    }

    // Active subscription - cannot delete
    return {
      canDelete: false,
      reason: subscription.cancelAtPeriodEnd
        ? `Subscription cancels on ${new Date(subscription.currentPeriodEnd!).toLocaleDateString()}`
        : 'Active subscription must be canceled first',
      hasActiveSubscription: true,
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
