import { v } from 'convex/values';
import { internalMutation } from '../../functions';
import { TIER_SEAT_LIMITS, subscriptionStatusValidator } from '../../schema';
import { internal } from '../../_generated/api';

// Retry configuration for Stripe customer binding
const MAX_RETRIES = 5;
const INITIAL_DELAY_MS = 2000;
const MAX_DELAY_MS = 30000;

/**
 * Create a pending subscription record for an organization awaiting checkout.
 * This is called during org creation BEFORE the user completes Stripe checkout.
 */
export const createPendingSubscription = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    stripeCustomerId: v.string(),
    checkoutSessionId: v.string(),
    priceId: v.string(),
  },
  returns: v.id('organizationSubscriptions'),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if a subscription record already exists
    const existing = await ctx.db
      .query('organizationSubscriptions')
      .withIndex('by_organization', (q) => q.eq('organizationId', args.organizationId))
      .first();

    if (existing) {
      // Update the existing record with new pending checkout info
      await ctx.db.patch(existing._id, {
        pendingCheckoutSessionId: args.checkoutSessionId,
        pendingPriceId: args.priceId,
        updatedAt: now,
      });
      return existing._id;
    }

    // Create a new pending subscription record
    return await ctx.db.insert('organizationSubscriptions', {
      organizationId: args.organizationId,
      stripeCustomerId: args.stripeCustomerId,
      tier: 'personal', // Will be updated when checkout completes
      status: 'none', // Pending checkout
      cancelAtPeriodEnd: false,
      seatLimit: 1, // Default to 1 until checkout completes
      pendingCheckoutSessionId: args.checkoutSessionId,
      pendingPriceId: args.priceId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Clear the pending checkout session (called when checkout completes or is abandoned).
 */
export const clearPendingCheckout = internalMutation({
  args: {
    organizationId: v.id('organizations'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query('organizationSubscriptions')
      .withIndex('by_organization', (q) => q.eq('organizationId', args.organizationId))
      .first();

    if (subscription) {
      await ctx.db.patch(subscription._id, {
        pendingCheckoutSessionId: undefined,
        pendingPriceId: undefined,
        updatedAt: Date.now(),
      });
    }

    return null;
  },
});

/**
 * Create or update a Stripe customer record.
 */
export const upsertStripeCustomer = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    stripeCustomerId: v.string(),
  },
  returns: v.id('stripeCustomers'),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('stripeCustomers')
      .withIndex('by_organization', (q) => q.eq('organizationId', args.organizationId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        stripeCustomerId: args.stripeCustomerId,
      });
      return existing._id;
    }

    return await ctx.db.insert('stripeCustomers', {
      organizationId: args.organizationId,
      stripeCustomerId: args.stripeCustomerId,
      createdAt: Date.now(),
    });
  },
});

/**
 * Create or update a Stripe customer record using WorkOS organization ID.
 * This is used when creating organizations since we don't have the Convex ID yet.
 * The organization webhook syncs the org to Convex, and this runs shortly after.
 *
 * Implements exponential backoff retry if the organization hasn't synced yet:
 * - Max retries: 5
 * - Initial delay: 2s, then 4s, 8s, 16s, 30s (capped)
 */
export const upsertStripeCustomerByExternalId = internalMutation({
  args: {
    workosOrganizationId: v.string(),
    stripeCustomerId: v.string(),
    retryCount: v.optional(v.number()),
  },
  returns: v.union(v.id('stripeCustomers'), v.null()),
  handler: async (ctx, args) => {
    const retryCount = args.retryCount ?? 0;

    // Find the organization by its WorkOS external ID
    const organization = await ctx.db
      .query('organizations')
      .withIndex('externalId', (q) => q.eq('externalId', args.workosOrganizationId))
      .first();

    if (!organization) {
      // Organization hasn't been synced yet via webhook
      if (retryCount >= MAX_RETRIES) {
        console.error(
          `[Stripe Customer] FAILED: Organization ${args.workosOrganizationId} not found after ${MAX_RETRIES} retries. ` +
            `Stripe customer ${args.stripeCustomerId} binding will be lost. Manual intervention required.`,
        );
        return null;
      }

      // Calculate delay with exponential backoff (2^retryCount * INITIAL_DELAY, capped at MAX_DELAY)
      const delay = Math.min(INITIAL_DELAY_MS * Math.pow(2, retryCount), MAX_DELAY_MS);

      console.log(
        `[Stripe Customer] Organization ${args.workosOrganizationId} not found yet. ` +
          `Retry ${retryCount + 1}/${MAX_RETRIES} in ${delay}ms`,
      );

      // Schedule retry with incremented count
      await ctx.scheduler.runAfter(delay, internal.billing.internal.mutation.upsertStripeCustomerByExternalId, {
        workosOrganizationId: args.workosOrganizationId,
        stripeCustomerId: args.stripeCustomerId,
        retryCount: retryCount + 1,
      });

      return null;
    }

    // Check if we already have a stripe customer for this org
    const existing = await ctx.db
      .query('stripeCustomers')
      .withIndex('by_organization', (q) => q.eq('organizationId', organization._id))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        stripeCustomerId: args.stripeCustomerId,
      });
      console.log(
        `[Stripe Customer] Updated stripeCustomerId ${args.stripeCustomerId} for organization ${organization._id}`,
      );
      return existing._id;
    }

    const id = await ctx.db.insert('stripeCustomers', {
      organizationId: organization._id,
      stripeCustomerId: args.stripeCustomerId,
      createdAt: Date.now(),
    });

    console.log(
      `[Stripe Customer] Created stripeCustomers record for organization ${organization._id} with stripeCustomerId ${args.stripeCustomerId}` +
        (retryCount > 0 ? ` (after ${retryCount} retries)` : ''),
    );

    return id;
  },
});

/**
 * Sync subscription data from Stripe to Convex.
 * This is the core sync function - called after checkout success and on webhook events.
 * Also triggers PlanetScale sync for subscription tier updates.
 */
export const syncSubscriptionData = internalMutation({
  args: {
    stripeCustomerId: v.string(),
    subscription: v.union(
      v.object({
        subscriptionId: v.string(),
        status: subscriptionStatusValidator,
        priceId: v.string(),
        currentPeriodStart: v.number(),
        currentPeriodEnd: v.number(),
        cancelAtPeriodEnd: v.boolean(),
        cancelAt: v.optional(v.number()), // Stripe's scheduled cancellation timestamp
        paymentMethodBrand: v.optional(v.string()),
        paymentMethodLast4: v.optional(v.string()),
      }),
      v.object({
        status: v.literal('none'),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Find the organization for this Stripe customer
    const customer = await ctx.db
      .query('stripeCustomers')
      .withIndex('by_stripe_customer', (q) => q.eq('stripeCustomerId', args.stripeCustomerId))
      .first();

    if (!customer) {
      console.log(`[Stripe Sync] No organization found for customer ${args.stripeCustomerId}`);
      return null;
    }

    const organizationId = customer.organizationId;

    // Get the organization to find its WorkOS ID for PlanetScale sync
    const organization = await ctx.db.get(organizationId);
    const workosId = organization?.externalId;

    // Handle "no subscription" case (legacy - shouldn't happen with new signup flow)
    if (args.subscription.status === 'none') {
      // For "none" status, we don't create a subscription record
      // Just sync to PlanetScale as personal tier
      if (workosId) {
        await ctx.scheduler.runAfter(0, internal.workflows.syncToPlanetScale.kickoffSubscriptionSync, {
          workosId,
          tier: 'personal' as const,
          status: 'none' as const,
        });
      }
      return null;
    }

    // Find existing subscription record by stripeSubscriptionId (supports multiple subscriptions)
    // TypeScript: We know subscriptionId exists because we returned early if status is 'none'
    const subscriptionId = 'subscriptionId' in args.subscription ? args.subscription.subscriptionId : '';
    const priceId = 'priceId' in args.subscription ? args.subscription.priceId : '';
    const existingSubscription = await ctx.db
      .query('organizationSubscriptions')
      .withIndex('by_stripe_subscription', (q) => q.eq('stripeSubscriptionId', subscriptionId))
      .first();

    // Determine tier and billing interval from price ID
    const tier = getTierFromPriceId(priceId);
    const billingInterval = getBillingIntervalFromPriceId(priceId);
    const seatLimit = TIER_SEAT_LIMITS[tier];

    // TypeScript: We know all these properties exist because we returned early if status is 'none'
    const subscription = 'subscriptionId' in args.subscription ? args.subscription : null;
    if (!subscription) {
      return null; // Should never happen, but TypeScript needs this
    }

    const subscriptionData = {
      organizationId,
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: priceId,
      tier,
      status: subscription.status,
      billingInterval,
      currentPeriodStart: subscription.currentPeriodStart * 1000, // Convert to ms
      currentPeriodEnd: subscription.currentPeriodEnd * 1000,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      cancelAt: subscription.cancelAt ? subscription.cancelAt * 1000 : undefined, // Convert to ms
      seatLimit,
      paymentMethodBrand: subscription.paymentMethodBrand,
      paymentMethodLast4: subscription.paymentMethodLast4,
      // Clear pending checkout state since we now have a real subscription
      pendingCheckoutSessionId: undefined,
      pendingPriceId: undefined,
      updatedAt: now,
    };

    if (existingSubscription) {
      await ctx.db.patch(existingSubscription._id, subscriptionData);
    } else {
      await ctx.db.insert('organizationSubscriptions', {
        ...subscriptionData,
        createdAt: now,
      });
    }

    // Sync subscription tier to PlanetScale - use the active subscription if available
    if (workosId) {
      // Find the active subscription for this organization to determine the tier to sync
      const activeSubscription = await ctx.db
        .query('organizationSubscriptions')
        .withIndex('by_organization', (q) => q.eq('organizationId', organizationId))
        .filter((q) => q.eq(q.field('status'), 'active'))
        .first();

      const subscriptionToSync = activeSubscription ||
        existingSubscription || { tier, status: args.subscription.status };

      await ctx.scheduler.runAfter(0, internal.workflows.syncToPlanetScale.kickoffSubscriptionSync, {
        workosId,
        tier: subscriptionToSync.tier as 'personal' | 'pro' | 'enterprise',
        status: subscriptionToSync.status as
          | 'active'
          | 'canceled'
          | 'incomplete'
          | 'incomplete_expired'
          | 'past_due'
          | 'paused'
          | 'trialing'
          | 'unpaid'
          | 'none',
      });
    }

    return null;
  },
});

// ============================================================
// STRIPE WEBHOOK IDEMPOTENCY
// ============================================================

/**
 * Check if a Stripe webhook event has already been processed.
 */
export const checkWebhookEventProcessed = internalMutation({
  args: {
    eventId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('stripeWebhookEvents')
      .withIndex('by_event_id', (q) => q.eq('eventId', args.eventId))
      .unique();

    return existing !== null;
  },
});

/**
 * Record a processed Stripe webhook event for idempotency.
 */
export const recordWebhookEvent = internalMutation({
  args: {
    eventId: v.string(),
    eventType: v.string(),
    customerId: v.optional(v.string()),
  },
  returns: v.id('stripeWebhookEvents'),
  handler: async (ctx, args) => {
    return await ctx.db.insert('stripeWebhookEvents', {
      eventId: args.eventId,
      eventType: args.eventType,
      customerId: args.customerId,
      processedAt: Date.now(),
    });
  },
});

// Helper functions (duplicated here since we can't import from Node.js file)
function getTierFromPriceId(priceId: string): 'personal' | 'pro' | 'enterprise' {
  const proMonthly = process.env.STRIPE_PRICE_PRO_MONTHLY ?? '';
  const proYearly = process.env.STRIPE_PRICE_PRO_YEARLY ?? '';
  const enterpriseMonthly = process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY ?? '';
  const enterpriseYearly = process.env.STRIPE_PRICE_ENTERPRISE_YEARLY ?? '';

  if (priceId === proMonthly || priceId === proYearly) {
    return 'pro';
  }
  if (priceId === enterpriseMonthly || priceId === enterpriseYearly) {
    return 'enterprise';
  }
  return 'personal';
}

function getBillingIntervalFromPriceId(priceId: string): 'month' | 'year' | undefined {
  const proMonthly = process.env.STRIPE_PRICE_PRO_MONTHLY ?? '';
  const enterpriseMonthly = process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY ?? '';
  const proYearly = process.env.STRIPE_PRICE_PRO_YEARLY ?? '';
  const enterpriseYearly = process.env.STRIPE_PRICE_ENTERPRISE_YEARLY ?? '';

  if (priceId === proMonthly || priceId === enterpriseMonthly) {
    return 'month';
  }
  if (priceId === proYearly || priceId === enterpriseYearly) {
    return 'year';
  }
  return undefined;
}
