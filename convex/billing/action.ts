'use node';

import { v } from 'convex/values';
import { action, internalAction } from '../_generated/server';
import { internal, api } from '../_generated/api';
import {
  stripe,
  STRIPE_PRICE_IDS,
  STRIPE_WEBHOOK_EVENTS,
  getTierFromPriceId,
  getBillingIntervalFromPriceId,
  isUpgrade,
  isDowngrade,
} from './stripe';
import { WorkOS } from '@workos-inc/node';
import type { Id } from '../_generated/dataModel';

type ResumeCheckoutResult = {
  checkoutUrl: string;
  checkoutSessionId: string;
  isNewSession: boolean;
};

/**
 * Resume a pending checkout for an organization that abandoned the initial checkout.
 * Creates a new checkout session if the previous one expired.
 */
export const resumeCheckout = action({
  args: {
    organizationId: v.id('organizations'),
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  returns: v.object({
    checkoutUrl: v.string(),
    checkoutSessionId: v.string(),
    isNewSession: v.boolean(),
  }),
  handler: async (ctx, args): Promise<ResumeCheckoutResult> => {
    // Get the organization
    type OrgResult = { externalId: string; name: string } | null;
    const organization: OrgResult = await ctx.runQuery(api.organizations.query.getOrganizationById, {
      id: args.organizationId,
    });
    if (!organization) {
      throw new Error('Organization not found');
    }

    // Get the Stripe customer
    type CustomerResult = { stripeCustomerId: string } | null;
    const customer: CustomerResult = await ctx.runQuery(internal.billing.query.getStripeCustomer, {
      organizationId: args.organizationId,
    });
    if (!customer) {
      throw new Error('No billing account found. Please contact support.');
    }

    // Get the pending subscription to check for existing checkout session
    type SubscriptionResult = {
      pendingCheckoutSessionId?: string;
      pendingPriceId?: string;
    } | null;
    const subscription: SubscriptionResult = await ctx.runQuery(internal.billing.query.getSubscriptionWithPending, {
      organizationId: args.organizationId,
    });

    // If there's a pending checkout session, try to retrieve it
    if (subscription?.pendingCheckoutSessionId) {
      try {
        const existingSession = await stripe.checkout.sessions.retrieve(subscription.pendingCheckoutSessionId);

        // If session is still valid (not expired and not completed), return it
        if (existingSession.status === 'open' && existingSession.url) {
          console.log(`[Stripe] Resuming existing checkout session ${existingSession.id}`);
          return {
            checkoutUrl: existingSession.url,
            checkoutSessionId: existingSession.id,
            isNewSession: false,
          };
        }
      } catch {
        // Session expired or not found, we'll create a new one
        console.log(`[Stripe] Previous checkout session expired or invalid, creating new one`);
      }
    }

    // Determine the price ID to use
    const priceId = subscription?.pendingPriceId || STRIPE_PRICE_IDS.proMonthly;
    if (!priceId) {
      throw new Error('No price ID configured. Please contact support.');
    }

    // Create a new checkout session
    const checkout = await stripe.checkout.sessions.create({
      customer: customer.stripeCustomerId,
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
      subscription_data: {
        metadata: {
          workosOrganizationId: organization.externalId,
        },
      },
      metadata: {
        workosOrganizationId: organization.externalId,
        convexOrganizationId: args.organizationId,
      },
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 hours
    });

    // Update the pending checkout info
    await ctx.runMutation(internal.billing.internal.mutation.createPendingSubscription, {
      organizationId: args.organizationId,
      stripeCustomerId: customer.stripeCustomerId,
      checkoutSessionId: checkout.id,
      priceId,
    });

    console.log(`[Stripe] Created new checkout session ${checkout.id} for organization ${organization.name}`);

    return {
      checkoutUrl: checkout.url!,
      checkoutSessionId: checkout.id,
      isNewSession: true,
    };
  },
});

/**
 * Create a Stripe checkout session for a NEW subscription.
 * Use this when the organization doesn't have an active subscription.
 *
 * For existing subscriptions, use `updateSubscription` instead.
 */
export const createCheckoutSession = action({
  args: {
    organizationId: v.id('organizations'),
    priceId: v.string(),
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, args) => {
    // 1. Get the organization
    const organization = await ctx.runQuery(api.organizations.query.getOrganizationById, {
      id: args.organizationId,
    });
    if (!organization) {
      throw new Error('Organization not found');
    }

    // 2. Get current user for email
    const user = await ctx.runQuery(api.users.query.me);
    if (!user) {
      throw new Error('User not found');
    }

    // 3. Get or create Stripe customer
    const existingCustomer = await ctx.runQuery(internal.billing.query.getStripeCustomer, {
      organizationId: args.organizationId,
    });

    let stripeCustomerId: string;

    if (existingCustomer) {
      stripeCustomerId = existingCustomer.stripeCustomerId;
    } else {
      // Create a new Stripe customer
      console.log(`[Stripe] Creating customer for organization ${organization.name}`);

      const newCustomer = await stripe.customers.create({
        email: user.email,
        name: organization.name,
        metadata: {
          workosOrganizationId: organization.externalId,
          organizationName: organization.name,
        },
      });

      await ctx.runMutation(internal.billing.internal.mutation.upsertStripeCustomer, {
        organizationId: args.organizationId,
        stripeCustomerId: newCustomer.id,
      });

      // Sync to WorkOS
      const workos = new WorkOS(process.env.WORKOS_API_KEY);
      await workos.organizations.updateOrganization({
        organization: organization.externalId,
        stripeCustomerId: newCustomer.id,
      });

      stripeCustomerId = newCustomer.id;
    }

    // 4. Check if there's already an active subscription
    const activeSubscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'active',
      limit: 1,
    });

    if (activeSubscriptions.data.length > 0) {
      // Redirect to updateSubscription flow instead
      throw new Error('Organization already has an active subscription. Use updateSubscription instead.');
    }

    // 5. Create checkout session for new subscription
    const checkout = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      line_items: [{ price: args.priceId, quantity: 1 }],
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
      subscription_data: {
        metadata: { organizationId: args.organizationId },
      },
      metadata: {
        organizationId: args.organizationId,
        tier: getTierFromPriceId(args.priceId),
      },
    });

    if (!checkout.url) {
      throw new Error('Failed to create checkout session');
    }

    console.log(`[Stripe] Created checkout session for new subscription`);
    return { url: checkout.url };
  },
});

/**
 * Update an existing subscription (upgrade, downgrade, or change billing interval).
 * Uses Stripe's built-in proration - no manual refund calculations needed.
 *
 * Behavior:
 * - Upgrade (e.g., Personal → Pro): Immediate change, Stripe prorates automatically
 * - Monthly → Yearly: Immediate change, Stripe prorates automatically
 * - Downgrade (e.g., Pro → Personal): Scheduled for end of billing period
 * - Yearly → Monthly: Scheduled for end of billing period
 */
// ============================================================
// SUBSCRIPTION PLAN CHANGES
// ============================================================
// Standard SaaS billing rules:
// - UPGRADES: Immediate, pay prorated difference (no refund to card)
// - DOWNGRADES: Scheduled at period end (no refund)
// - CANCELLATION: Access until period end (no refund, except 30-day guarantee)
// ============================================================

type UpdateSubscriptionResult = {
  success: boolean;
  message: string;
  effectiveDate?: string;
};

/**
 * Update subscription plan (upgrade, downgrade, or change interval).
 *
 * Standard SaaS rules:
 * - Upgrades (higher tier or monthly→yearly): Immediate, prorated charge
 * - Downgrades (lower tier or yearly→monthly): Scheduled at period end, no refund
 */
export const updateSubscription = action({
  args: {
    organizationId: v.id('organizations'),
    priceId: v.string(),
    successUrl: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    effectiveDate: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<UpdateSubscriptionResult> => {
    // 1. Get Stripe customer
    type CustomerResult = { stripeCustomerId: string } | null;
    const customer: CustomerResult = await ctx.runQuery(internal.billing.query.getStripeCustomer, {
      organizationId: args.organizationId,
    });
    if (!customer) {
      throw new Error('No billing account found');
    }

    // 2. Get current active subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.stripeCustomerId,
      status: 'active',
      limit: 1,
    });

    const currentSubscription = subscriptions.data[0] as import('stripe').Stripe.Subscription | undefined;
    if (!currentSubscription) {
      throw new Error('No active subscription found');
    }

    const subscriptionItemId = currentSubscription.items.data[0].id;
    const currentPriceId = currentSubscription.items.data[0].price.id;

    // 3. Determine change type
    const currentTier = getTierFromPriceId(currentPriceId);
    const newTier = getTierFromPriceId(args.priceId);
    const currentInterval = getBillingIntervalFromPriceId(currentPriceId);
    const newInterval = getBillingIntervalFromPriceId(args.priceId);

    const isTierUpgrade = isUpgrade(currentTier, newTier);
    const isTierDowngrade = isDowngrade(currentTier, newTier);
    const isIntervalUpgrade = currentTier === newTier && currentInterval === 'month' && newInterval === 'year';
    const isIntervalDowngrade = currentTier === newTier && currentInterval === 'year' && newInterval === 'month';

    // 4. Apply change based on type
    if (isTierUpgrade || isIntervalUpgrade) {
      // ═══════════════════════════════════════════════════════════════
      // UPGRADE: Immediate change, customer pays prorated difference
      // No refund to card - Stripe applies credit to new charge
      // ═══════════════════════════════════════════════════════════════
      console.log(`[Stripe] Upgrade: ${currentTier}/${currentInterval} → ${newTier}/${newInterval}`);

      await stripe.subscriptions.update(currentSubscription.id, {
        items: [{ id: subscriptionItemId, price: args.priceId }],
        proration_behavior: 'create_prorations',
        payment_behavior: 'error_if_incomplete',
      });

      // Sync updated subscription data
      await ctx.runAction(internal.billing.action.syncStripeDataForCustomer, {
        stripeCustomerId: customer.stripeCustomerId,
      });

      return {
        success: true,
        message: `Upgraded to ${newTier} (${newInterval}ly). You've been charged the prorated difference.`,
        effectiveDate: new Date().toISOString(),
      };
    } else if (isTierDowngrade || isIntervalDowngrade) {
      // ═══════════════════════════════════════════════════════════════
      // DOWNGRADE: Scheduled at end of billing period, NO REFUND
      // Customer keeps current plan until period ends
      // ═══════════════════════════════════════════════════════════════
      console.log(`[Stripe] Downgrade scheduled: ${currentTier}/${currentInterval} → ${newTier}/${newInterval}`);

      // Release any existing schedule
      if (currentSubscription.schedule) {
        const scheduleId =
          typeof currentSubscription.schedule === 'string'
            ? currentSubscription.schedule
            : currentSubscription.schedule.id;
        await stripe.subscriptionSchedules.release(scheduleId);
      }

      // Create schedule from subscription
      const schedule = await stripe.subscriptionSchedules.create({
        from_subscription: currentSubscription.id,
      });

      const periodStart: number = currentSubscription.items.data[0].current_period_start;
      const periodEnd: number = currentSubscription.items.data[0].current_period_end;

      // Update schedule with two phases
      await stripe.subscriptionSchedules.update(schedule.id, {
        phases: [
          {
            items: [{ price: currentPriceId, quantity: 1 }],
            start_date: periodStart,
            end_date: periodEnd,
          },
          {
            items: [{ price: args.priceId, quantity: 1 }],
            start_date: periodEnd,
          },
        ],
        end_behavior: 'release',
      });

      const effectiveDateStr: string = new Date(periodEnd * 1000).toISOString();

      return {
        success: true,
        message: `Downgrade to ${newTier} (${newInterval}ly) scheduled for ${new Date(periodEnd * 1000).toLocaleDateString()}. You'll keep your current plan until then.`,
        effectiveDate: effectiveDateStr,
      };
    } else {
      // Same plan - no change needed
      return {
        success: true,
        message: 'No change needed - already on this plan.',
      };
    }
  },
});

// ============================================================
// 30-DAY MONEY-BACK GUARANTEE
// ============================================================

type RefundEligibility = {
  eligible: boolean;
  reason: string;
  daysRemaining?: number;
  refundableAmount?: number;
  currency?: string;
};

/**
 * Check if organization is eligible for the 30-day money-back guarantee refund.
 */
export const checkRefundEligibility = action({
  args: {
    organizationId: v.id('organizations'),
  },
  returns: v.object({
    eligible: v.boolean(),
    reason: v.string(),
    daysRemaining: v.optional(v.number()),
    refundableAmount: v.optional(v.number()),
    currency: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<RefundEligibility> => {
    // Get Stripe customer
    type CustomerResult = { stripeCustomerId: string } | null;
    const customer: CustomerResult = await ctx.runQuery(internal.billing.query.getStripeCustomer, {
      organizationId: args.organizationId,
    });

    if (!customer) {
      return { eligible: false, reason: 'No billing account found' };
    }

    // Get all subscriptions (including canceled) to find the first payment
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.stripeCustomerId,
      status: 'all',
      limit: 10,
    });

    if (subscriptions.data.length === 0) {
      return { eligible: false, reason: 'No subscription history found' };
    }

    // Find the earliest subscription start date (first ever payment)
    const firstSubscription = subscriptions.data.reduce((earliest, sub) => {
      return sub.created < earliest.created ? sub : earliest;
    });

    const firstPaymentDate = firstSubscription.created * 1000; // Convert to ms
    const now = Date.now();
    const daysSinceFirstPayment = Math.floor((now - firstPaymentDate) / (1000 * 60 * 60 * 24));
    const guaranteeDays = 30;

    if (daysSinceFirstPayment > guaranteeDays) {
      return {
        eligible: false,
        reason: `The 30-day money-back guarantee period has expired. Your first payment was ${daysSinceFirstPayment} days ago.`,
      };
    }

    // Check if already refunded
    const refunds = await stripe.refunds.list({
      limit: 100,
    });

    // Get customer's charges to check for existing refunds
    const charges = await stripe.charges.list({
      customer: customer.stripeCustomerId,
      limit: 100,
    });

    const customerChargeIds = new Set(charges.data.map((c) => c.id));
    const hasExistingRefund = refunds.data.some((r) => {
      const chargeId = typeof r.charge === 'string' ? r.charge : r.charge?.id;
      return chargeId && customerChargeIds.has(chargeId) && r.metadata?.type === 'money_back_guarantee';
    });

    if (hasExistingRefund) {
      return {
        eligible: false,
        reason: 'You have already used your 30-day money-back guarantee.',
      };
    }

    // Calculate refundable amount (total paid minus any previous refunds)
    const invoices = await stripe.invoices.list({
      customer: customer.stripeCustomerId,
      status: 'paid',
      limit: 50,
    });

    const totalPaid = invoices.data.reduce((sum, inv) => sum + inv.amount_paid, 0);
    const existingRefundsTotal = refunds.data
      .filter((r) => {
        const chargeId = typeof r.charge === 'string' ? r.charge : r.charge?.id;
        return chargeId && customerChargeIds.has(chargeId);
      })
      .reduce((sum, r) => sum + r.amount, 0);

    const refundableAmount = totalPaid - existingRefundsTotal;

    if (refundableAmount <= 0) {
      return {
        eligible: false,
        reason: 'No refundable amount found.',
      };
    }

    const daysRemaining = guaranteeDays - daysSinceFirstPayment;

    return {
      eligible: true,
      reason: `You are eligible for a full refund. ${daysRemaining} days remaining in the guarantee period.`,
      daysRemaining,
      refundableAmount,
      currency: invoices.data[0]?.currency ?? 'usd',
    };
  },
});

type RefundResult = {
  success: boolean;
  message: string;
  refundId?: string;
  refundedAmount?: number;
  currency?: string;
};

/**
 * Request a full refund under the 30-day money-back guarantee.
 * This will:
 * 1. Verify eligibility
 * 2. Cancel all active subscriptions immediately
 * 3. Issue full refund for all payments
 */
export const requestMoneyBackRefund = action({
  args: {
    organizationId: v.id('organizations'),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    refundId: v.optional(v.string()),
    refundedAmount: v.optional(v.number()),
    currency: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<RefundResult> => {
    // 1. Check eligibility first
    const eligibility: RefundEligibility = await ctx.runAction(api.billing.action.checkRefundEligibility, {
      organizationId: args.organizationId,
    });

    if (!eligibility.eligible) {
      return {
        success: false,
        message: eligibility.reason,
      };
    }

    // 2. Get Stripe customer
    type CustomerResult = { stripeCustomerId: string } | null;
    const customer: CustomerResult = await ctx.runQuery(internal.billing.query.getStripeCustomer, {
      organizationId: args.organizationId,
    });

    if (!customer) {
      return { success: false, message: 'No billing account found' };
    }

    try {
      // 3. Cancel all active subscriptions immediately
      const activeSubscriptions = await stripe.subscriptions.list({
        customer: customer.stripeCustomerId,
        status: 'active',
      });

      for (const sub of activeSubscriptions.data) {
        await stripe.subscriptions.cancel(sub.id, {
          prorate: false, // No proration, we're doing full refund
        });
        console.log(`[Stripe] Canceled subscription ${sub.id} for money-back guarantee`);
      }

      // 4. Get all paid invoices and refund each payment
      const invoices = await stripe.invoices.list({
        customer: customer.stripeCustomerId,
        status: 'paid',
        limit: 50,
      });

      let totalRefunded = 0;
      const refundIds: string[] = [];
      let currency = 'usd';

      for (const invoice of invoices.data) {
        if (invoice.amount_paid <= 0) continue;

        // Get the payment intent or charge (cast to access these fields)
        const invoiceAny = invoice as unknown as {
          payment_intent?: string | { id: string } | null;
          charge?: string | { id: string } | null;
        };
        const paymentIntent = invoiceAny.payment_intent;
        const charge = invoiceAny.charge;

        const chargeId = typeof charge === 'string' ? charge : charge?.id;

        if (chargeId) {
          try {
            const refund = await stripe.refunds.create({
              charge: chargeId,
              reason: 'requested_by_customer',
              metadata: {
                type: 'money_back_guarantee',
                organizationId: args.organizationId,
                invoiceId: invoice.id,
                userReason: args.reason ?? 'Not specified',
              },
            });

            totalRefunded += refund.amount;
            refundIds.push(refund.id);
            currency = refund.currency;
            console.log(`[Stripe] Refunded ${refund.amount} cents from invoice ${invoice.id}`);
          } catch (refundError) {
            console.error(`[Stripe] Failed to refund invoice ${invoice.id}:`, refundError);
          }
        } else if (paymentIntent) {
          const paymentIntentId = typeof paymentIntent === 'string' ? paymentIntent : paymentIntent.id;
          try {
            const refund = await stripe.refunds.create({
              payment_intent: paymentIntentId,
              reason: 'requested_by_customer',
              metadata: {
                type: 'money_back_guarantee',
                organizationId: args.organizationId,
                invoiceId: invoice.id,
                userReason: args.reason ?? 'Not specified',
              },
            });

            totalRefunded += refund.amount;
            refundIds.push(refund.id);
            currency = refund.currency;
            console.log(`[Stripe] Refunded ${refund.amount} cents from invoice ${invoice.id}`);
          } catch (refundError) {
            console.error(`[Stripe] Failed to refund invoice ${invoice.id}:`, refundError);
          }
        }
      }

      // 5. Sync subscription data
      await ctx.runAction(internal.billing.action.syncStripeDataForCustomer, {
        stripeCustomerId: customer.stripeCustomerId,
      });

      if (totalRefunded === 0) {
        return {
          success: false,
          message: 'No payments found to refund.',
        };
      }

      return {
        success: true,
        message: `Full refund of ${(totalRefunded / 100).toFixed(2)} ${currency.toUpperCase()} processed. Your subscription has been canceled.`,
        refundId: refundIds[0],
        refundedAmount: totalRefunded,
        currency,
      };
    } catch (error) {
      console.error('[Stripe] Money-back refund error:', error);
      return {
        success: false,
        message: 'Failed to process refund. Please contact support.',
      };
    }
  },
});

/**
 * Sync Stripe data after successful checkout.
 * Call this from your /success page to ensure data is synced before webhooks arrive.
 */
export const syncAfterCheckout = action({
  args: {
    organizationId: v.id('organizations'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get the Stripe customer for this organization
    const customer = await ctx.runQuery(internal.billing.query.getStripeCustomer, {
      organizationId: args.organizationId,
    });

    if (!customer) {
      console.log('[Stripe Sync] No Stripe customer found for organization');
      return null;
    }

    // Call the internal sync action
    await ctx.runAction(internal.billing.action.syncStripeDataForCustomer, {
      stripeCustomerId: customer.stripeCustomerId,
    });

    return null;
  },
});

/**
 * Internal action to sync Stripe subscription data for a customer.
 * This fetches the latest data from Stripe and updates Convex.
 * Following Theo's syncStripeDataToKV pattern exactly.
 */
export const syncStripeDataForCustomer = internalAction({
  args: {
    stripeCustomerId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      // Fetch ALL subscription data from Stripe (supporting multiple subscriptions)
      const subscriptions = await stripe.subscriptions.list({
        customer: args.stripeCustomerId,
        status: 'all',
        expand: ['data.default_payment_method'],
      });

      if (subscriptions.data.length === 0) {
        // No subscriptions - sync as "none"
        await ctx.runMutation(internal.billing.internal.mutation.syncSubscriptionData, {
          stripeCustomerId: args.stripeCustomerId,
          subscription: { status: 'none' },
        });
        return null;
      }

      // Sync each subscription individually
      // Each subscription gets its own record in Convex, keyed by stripeSubscriptionId
      for (const subscription of subscriptions.data) {
        // Check both cancel_at_period_end AND cancel_at for scheduled cancellations
        // Stripe uses cancel_at when user schedules cancellation via billing portal
        const willCancel = subscription.cancel_at_period_end || subscription.cancel_at !== null;

        // Extract payment method details (following Theo's pattern)
        const paymentMethod = subscription.default_payment_method;
        let paymentMethodBrand: string | undefined;
        let paymentMethodLast4: string | undefined;

        if (paymentMethod && typeof paymentMethod !== 'string') {
          paymentMethodBrand = paymentMethod.card?.brand ?? undefined;
          paymentMethodLast4 = paymentMethod.card?.last4 ?? undefined;
        }

        // Build subscription data object - exactly as Theo recommends
        // Note: cancelAtPeriodEnd is true if EITHER cancel_at_period_end or cancel_at is set
        const subscriptionData = {
          subscriptionId: subscription.id,
          status: subscription.status as
            | 'active'
            | 'canceled'
            | 'incomplete'
            | 'incomplete_expired'
            | 'past_due'
            | 'paused'
            | 'trialing'
            | 'unpaid',
          priceId: subscription.items.data[0].price.id,
          currentPeriodStart: subscription.items.data[0].current_period_start,
          currentPeriodEnd: subscription.items.data[0].current_period_end,
          cancelAtPeriodEnd: willCancel, // Use combined check for both cancellation methods
          cancelAt: subscription.cancel_at ?? undefined, // Pass the actual cancel timestamp
          paymentMethodBrand,
          paymentMethodLast4,
        };

        console.log(`[Stripe Sync] Syncing subscription ${subscription.id} (status: ${subscription.status})`);

        await ctx.runMutation(internal.billing.internal.mutation.syncSubscriptionData, {
          stripeCustomerId: args.stripeCustomerId,
          subscription: subscriptionData,
        });
      }

      console.log(
        `[Stripe Sync] Synced ${subscriptions.data.length} subscription(s) for customer ${args.stripeCustomerId}`,
      );

      return null;
    } catch (error) {
      console.error('[Stripe Sync] Error syncing data:', error);
      throw error;
    }
  },
});

/**
 * Create a Stripe billing portal session for subscription management.
 */
export const createBillingPortalSession = action({
  args: {
    organizationId: v.id('organizations'),
    returnUrl: v.string(),
  },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, args) => {
    const customer = await ctx.runQuery(internal.billing.query.getStripeCustomer, {
      organizationId: args.organizationId,
    });

    if (!customer) {
      throw new Error('No billing account found for this organization');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customer.stripeCustomerId,
      return_url: args.returnUrl,
    });

    return { url: session.url };
  },
});

/**
 * Get available prices for display.
 */
export const getPrices = action({
  args: {},
  returns: v.array(
    v.object({
      id: v.string(),
      productId: v.string(),
      productName: v.string(),
      unitAmount: v.number(),
      currency: v.string(),
      interval: v.string(),
      tier: v.string(),
    }),
  ),
  handler: async () => {
    const priceIds = Object.values(STRIPE_PRICE_IDS).filter(Boolean);

    if (priceIds.length === 0) {
      return [];
    }

    const prices = await Promise.all(
      priceIds.map(async (priceId) => {
        try {
          const price = await stripe.prices.retrieve(priceId, {
            expand: ['product'],
          });

          const product = price.product as { name: string; id: string };

          // Determine tier from price ID
          let tier = 'personal';
          if (priceId === STRIPE_PRICE_IDS.personalMonthly || priceId === STRIPE_PRICE_IDS.personalYearly) {
            tier = 'personal';
          } else if (priceId === STRIPE_PRICE_IDS.proMonthly || priceId === STRIPE_PRICE_IDS.proYearly) {
            tier = 'pro';
          } else if (priceId === STRIPE_PRICE_IDS.enterpriseMonthly || priceId === STRIPE_PRICE_IDS.enterpriseYearly) {
            tier = 'enterprise';
          }

          return {
            id: price.id,
            productId: product.id,
            productName: product.name,
            unitAmount: price.unit_amount ?? 0,
            currency: price.currency,
            interval: price.recurring?.interval ?? 'month',
            tier,
          };
        } catch {
          return null;
        }
      }),
    );

    return prices.filter((p): p is NonNullable<typeof p> => p !== null);
  },
});

/**
 * Process Stripe webhook event.
 * This is called by the HTTP webhook handler.
 */
export const processWebhookEvent = internalAction({
  args: {
    payload: v.string(),
    signature: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

    let event: import('stripe').Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(args.payload, args.signature, webhookSecret);
    } catch (err) {
      console.error('[Stripe Webhook] Signature verification failed:', err);
      throw new Error('Webhook signature verification failed');
    }

    // Skip events we don't care about
    if (!STRIPE_WEBHOOK_EVENTS.includes(event.type)) {
      console.log(`[Stripe Webhook] Skipping event: ${event.type}`);
      return null;
    }

    console.log(`[Stripe Webhook] Processing event: ${event.type}`);

    // Extract customer ID from the event
    const eventData = event.data.object as { customer?: string };
    const customerId = eventData.customer;

    if (typeof customerId !== 'string') {
      console.error(`[Stripe Webhook] No customer ID in event: ${event.type}`);
      return null;
    }

    // Sync the subscription data
    await ctx.runAction(internal.billing.action.syncStripeDataForCustomer, {
      stripeCustomerId: customerId,
    });

    return null;
  },
});

// ============================================================
// INTERNAL ACTIONS FOR DELETION WORKFLOW
// ============================================================

/**
 * Cancel all active Stripe subscriptions for an organization.
 * This is a safety net called during organization deletion to ensure
 * no orphaned subscriptions remain.
 *
 * @param workosId - The WorkOS organization ID to cancel subscriptions for
 */
export const cancelAllSubscriptionsForOrganization = internalAction({
  args: {
    workosId: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    cancelledCount: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const errors: Array<string> = [];
    let cancelledCount = 0;

    try {
      // Find the organization in Convex by WorkOS ID
      const organization = await ctx.runQuery(internal.organizations.internal.query.getByExternalId, {
        externalId: args.workosId,
      });

      if (!organization) {
        console.log(
          `[Stripe Cleanup] Organization ${args.workosId} not found in Convex, skipping subscription cleanup`,
        );
        return { success: true, cancelledCount: 0, errors: [] };
      }

      // Get the Stripe customer for this organization
      const stripeCustomer = await ctx.runQuery(internal.billing.query.getStripeCustomer, {
        organizationId: organization._id as Id<'organizations'>,
      });

      if (!stripeCustomer) {
        console.log(`[Stripe Cleanup] No Stripe customer found for organization ${args.workosId}`);
        return { success: true, cancelledCount: 0, errors: [] };
      }

      // List all subscriptions for this customer
      const subscriptions = await stripe.subscriptions.list({
        customer: stripeCustomer.stripeCustomerId,
        status: 'all',
      });

      // Cancel any active subscriptions
      for (const subscription of subscriptions.data) {
        if (['active', 'past_due', 'unpaid'].includes(subscription.status)) {
          try {
            await stripe.subscriptions.cancel(subscription.id, {
              prorate: true,
            });
            cancelledCount++;
            console.log(`[Stripe Cleanup] Cancelled subscription ${subscription.id} for organization ${args.workosId}`);
          } catch (err) {
            const errorMsg = `Failed to cancel subscription ${subscription.id}: ${err instanceof Error ? err.message : 'Unknown error'}`;
            errors.push(errorMsg);
            console.error(`[Stripe Cleanup] ${errorMsg}`);
          }
        }
      }

      // Clean up subscription record in Convex
      if (cancelledCount > 0) {
        await ctx.runMutation(internal.billing.internal.mutation.syncSubscriptionData, {
          stripeCustomerId: stripeCustomer.stripeCustomerId,
          subscription: { status: 'none' },
        });
      }

      console.log(
        `[Stripe Cleanup] Completed for organization ${args.workosId}. Cancelled: ${cancelledCount}, Errors: ${errors.length}`,
      );

      return {
        success: errors.length === 0,
        cancelledCount,
        errors,
      };
    } catch (error) {
      const errorMsg = `Unexpected error during subscription cleanup: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMsg);
      console.error(`[Stripe Cleanup] ${errorMsg}`);
      return { success: false, cancelledCount, errors };
    }
  },
});

/**
 * Get invoices for an organization from Stripe.
 * Returns a list of invoices with download URLs.
 */
export const getInvoices = action({
  args: {
    organizationId: v.id('organizations'),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      id: v.string(),
      number: v.union(v.string(), v.null()),
      status: v.string(),
      amountDue: v.number(),
      amountPaid: v.number(),
      currency: v.string(),
      created: v.number(),
      periodStart: v.number(),
      periodEnd: v.number(),
      hostedInvoiceUrl: v.union(v.string(), v.null()),
      invoicePdf: v.union(v.string(), v.null()),
      description: v.union(v.string(), v.null()),
      subscriptionId: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<{
      id: string;
      number: string | null;
      status: string;
      amountDue: number;
      amountPaid: number;
      currency: string;
      created: number;
      periodStart: number;
      periodEnd: number;
      hostedInvoiceUrl: string | null;
      invoicePdf: string | null;
      description: string | null;
      subscriptionId: string | null;
    }>
  > => {
    // Get the Stripe customer for this organization
    const customer: { stripeCustomerId: string } | null = await ctx.runQuery(internal.billing.query.getStripeCustomer, {
      organizationId: args.organizationId,
    });

    if (!customer) {
      return [];
    }

    try {
      const invoices = await stripe.invoices.list({
        customer: customer.stripeCustomerId,
        limit: args.limit ?? 20,
      });

      return invoices.data.map((invoice) => ({
        id: invoice.id,
        number: invoice.number ?? null,
        status: invoice.status ?? 'unknown',
        amountDue: invoice.amount_due,
        amountPaid: invoice.amount_paid,
        currency: invoice.currency,
        created: invoice.created * 1000, // Convert to ms
        periodStart: invoice.period_start * 1000,
        periodEnd: invoice.period_end * 1000,
        hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
        invoicePdf: invoice.invoice_pdf ?? null,
        description: invoice.description ?? null,
        subscriptionId:
          typeof invoice.lines.data[0].subscription === 'string'
            ? invoice.lines.data[0].subscription
            : (invoice.lines.data[0].subscription?.id ?? null),
      }));
    } catch (error) {
      console.error('[Stripe] Failed to fetch invoices:', error);
      return [];
    }
  },
});

// ============================================================
// COMPREHENSIVE BILLING DATA
// ============================================================

/**
 * Invoice data type
 */
type InvoiceData = {
  id: string;
  number: string | null;
  status: string;
  billingReason: string;
  amountDue: number;
  amountPaid: number;
  amountRemaining: number;
  currency: string;
  created: number;
  periodStart: number;
  periodEnd: number;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  subscriptionId: string | null;
  planName: string | null;
  lineItems: Array<{
    description: string;
    amount: number;
    quantity: number;
  }>;
};

/**
 * Refund data type
 */
type RefundData = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  reason: string | null;
  created: number;
  invoiceId: string | null;
  metadata: Record<string, string>;
};

/**
 * Subscription data type
 */
type SubscriptionData = {
  id: string;
  status: string;
  planName: string;
  tier: string;
  interval: string;
  amount: number;
  currency: string;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  canceledAt: number | null;
  endedAt: number | null;
  created: number;
};

/**
 * Account activity event type
 */
type ActivityEvent = {
  id: string;
  type: string;
  description: string;
  details: string | null;
  status: string;
  created: number;
};

/**
 * Complete billing data response
 */
type CompleteBillingData = {
  invoices: InvoiceData[];
  refunds: RefundData[];
  subscriptions: SubscriptionData[];
  activity: ActivityEvent[];
};

const billingDataValidator = v.object({
  invoices: v.array(
    v.object({
      id: v.string(),
      number: v.union(v.string(), v.null()),
      status: v.string(),
      billingReason: v.string(),
      amountDue: v.number(),
      amountPaid: v.number(),
      amountRemaining: v.number(),
      currency: v.string(),
      created: v.number(),
      periodStart: v.number(),
      periodEnd: v.number(),
      hostedInvoiceUrl: v.union(v.string(), v.null()),
      invoicePdf: v.union(v.string(), v.null()),
      subscriptionId: v.union(v.string(), v.null()),
      planName: v.union(v.string(), v.null()),
      lineItems: v.array(
        v.object({
          description: v.string(),
          amount: v.number(),
          quantity: v.number(),
        }),
      ),
    }),
  ),
  refunds: v.array(
    v.object({
      id: v.string(),
      amount: v.number(),
      currency: v.string(),
      status: v.string(),
      reason: v.union(v.string(), v.null()),
      created: v.number(),
      invoiceId: v.union(v.string(), v.null()),
      metadata: v.record(v.string(), v.string()),
    }),
  ),
  subscriptions: v.array(
    v.object({
      id: v.string(),
      status: v.string(),
      planName: v.string(),
      tier: v.string(),
      interval: v.string(),
      amount: v.number(),
      currency: v.string(),
      currentPeriodStart: v.number(),
      currentPeriodEnd: v.number(),
      cancelAtPeriodEnd: v.boolean(),
      canceledAt: v.union(v.number(), v.null()),
      endedAt: v.union(v.number(), v.null()),
      created: v.number(),
    }),
  ),
  activity: v.array(
    v.object({
      id: v.string(),
      type: v.string(),
      description: v.string(),
      details: v.union(v.string(), v.null()),
      status: v.string(),
      created: v.number(),
    }),
  ),
});

/**
 * Get comprehensive billing data including invoices, refunds, subscriptions, and activity.
 */
export const getCompleteBillingData = action({
  args: {
    organizationId: v.id('organizations'),
  },
  returns: billingDataValidator,
  handler: async (ctx, args): Promise<CompleteBillingData> => {
    const customer: { stripeCustomerId: string } | null = await ctx.runQuery(internal.billing.query.getStripeCustomer, {
      organizationId: args.organizationId,
    });

    if (!customer) {
      return { invoices: [], refunds: [], subscriptions: [], activity: [] };
    }

    const stripeCustomerId = customer.stripeCustomerId;

    try {
      // Fetch all data in parallel
      const [invoicesResponse, refundsResponse, subscriptionsResponse, eventsResponse] = await Promise.all([
        stripe.invoices.list({
          customer: stripeCustomerId,
          limit: 50,
          expand: ['data.subscription'],
        }),
        stripe.refunds.list({
          limit: 50,
        }),
        stripe.subscriptions.list({
          customer: stripeCustomerId,
          status: 'all',
          limit: 20,
        }),
        stripe.events.list({
          types: [
            'customer.subscription.created',
            'customer.subscription.updated',
            'customer.subscription.deleted',
            'customer.subscription.paused',
            'customer.subscription.resumed',
            'invoice.paid',
            'invoice.payment_failed',
            'charge.refunded',
          ],
          limit: 50,
        }),
      ]);

      // Process invoices
      const invoices: InvoiceData[] = invoicesResponse.data.map((inv) => {
        // Access subscription from the expanded data
        const invAny = inv as unknown as {
          subscription?: string | { id: string; items: { data: Array<{ price: { product?: { name?: string } } }> } };
        };
        const subscription = invAny.subscription;
        let planName: string | null = null;
        let subscriptionId: string | null = null;

        if (subscription) {
          if (typeof subscription === 'string') {
            subscriptionId = subscription;
          } else {
            subscriptionId = subscription.id;
            const product = subscription.items?.data?.[0]?.price?.product;
            if (product && typeof product !== 'string' && 'name' in product) {
              planName = product.name ?? null;
            }
          }
        }

        return {
          id: inv.id,
          number: inv.number ?? null,
          status: inv.status ?? 'unknown',
          billingReason: inv.billing_reason ?? 'unknown',
          amountDue: inv.amount_due,
          amountPaid: inv.amount_paid,
          amountRemaining: inv.amount_remaining,
          currency: inv.currency,
          created: inv.created * 1000,
          periodStart: inv.period_start * 1000,
          periodEnd: inv.period_end * 1000,
          hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
          invoicePdf: inv.invoice_pdf ?? null,
          subscriptionId,
          planName,
          lineItems: inv.lines.data.map((line) => ({
            description: line.description ?? 'Subscription',
            amount: line.amount,
            quantity: line.quantity ?? 1,
          })),
        };
      });

      // Process refunds (filter by customer's payment intents)
      const customerCharges = await stripe.charges.list({
        customer: stripeCustomerId,
        limit: 100,
      });
      const customerChargeIds = new Set(customerCharges.data.map((c) => c.id));

      const refunds: RefundData[] = refundsResponse.data
        .filter((ref) => {
          const chargeId = typeof ref.charge === 'string' ? ref.charge : ref.charge?.id;
          return chargeId && customerChargeIds.has(chargeId);
        })
        .map((ref) => {
          // Find the associated invoice
          const chargeAny = customerCharges.data.find(
            (c) => c.id === (typeof ref.charge === 'string' ? ref.charge : ref.charge?.id),
          ) as { invoice?: string | { id: string } } | undefined;
          const invoiceId = chargeAny?.invoice
            ? typeof chargeAny.invoice === 'string'
              ? chargeAny.invoice
              : chargeAny.invoice.id
            : null;

          return {
            id: ref.id,
            amount: ref.amount,
            currency: ref.currency,
            status: ref.status ?? 'unknown',
            reason: ref.reason,
            created: ref.created * 1000,
            invoiceId,
            metadata: (ref.metadata ?? {}) as Record<string, string>,
          };
        });

      // Process subscriptions
      const subscriptions: SubscriptionData[] = subscriptionsResponse.data.map((sub) => {
        const price = sub.items.data[0]?.price;
        const tier = getTierFromPriceId(price?.id ?? '');

        // Derive plan name from tier (no deep expansion needed)
        const tierNames: Record<string, string> = {
          personal: 'Personal Plan',
          pro: 'Pro Plan',
          enterprise: 'Enterprise Plan',
        };
        const planName = tierNames[tier] || 'Subscription';

        return {
          id: sub.id,
          status: sub.status,
          planName,
          tier,
          interval: price?.recurring?.interval ?? 'month',
          amount: price?.unit_amount ?? 0,
          currency: price?.currency ?? 'usd',
          currentPeriodStart: sub.items.data[0]?.current_period_start
            ? sub.items.data[0].current_period_start * 1000
            : 0,
          currentPeriodEnd: sub.items.data[0]?.current_period_end ? sub.items.data[0].current_period_end * 1000 : 0,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          canceledAt: sub.canceled_at ? sub.canceled_at * 1000 : null,
          endedAt: sub.ended_at ? sub.ended_at * 1000 : null,
          created: sub.created * 1000,
        };
      });

      // Process activity events
      const activity: ActivityEvent[] = [];

      for (const event of eventsResponse.data) {
        const eventData = event.data.object as unknown as Record<string, unknown>;
        const eventCustomer = eventData.customer as string | undefined;

        // Only include events for this customer
        if (eventCustomer !== stripeCustomerId) continue;

        let description = '';
        let details: string | null = null;
        let status = 'completed';

        switch (event.type) {
          case 'customer.subscription.created':
            description = 'Subscription created';
            details = `New subscription started`;
            break;
          case 'customer.subscription.updated':
            description = 'Subscription updated';
            details = 'Plan or billing details changed';
            break;
          case 'customer.subscription.deleted':
            description = 'Subscription canceled';
            status = 'canceled';
            break;
          case 'customer.subscription.paused':
            description = 'Subscription paused';
            status = 'paused';
            break;
          case 'customer.subscription.resumed':
            description = 'Subscription resumed';
            break;
          case 'invoice.paid':
            description = 'Payment successful';
            const paidAmount = (eventData.amount_paid as number) ?? 0;
            details = `$${(paidAmount / 100).toFixed(2)} charged`;
            break;
          case 'invoice.payment_failed':
            description = 'Payment failed';
            status = 'failed';
            break;
          case 'charge.refunded':
            description = 'Refund processed';
            const refundedAmount = (eventData.amount_refunded as number) ?? 0;
            details = `$${(refundedAmount / 100).toFixed(2)} refunded`;
            break;
          default:
            continue;
        }

        activity.push({
          id: event.id,
          type: event.type,
          description,
          details,
          status,
          created: event.created * 1000,
        });
      }

      // Sort activity by date descending
      activity.sort((a, b) => b.created - a.created);

      return { invoices, refunds, subscriptions, activity };
    } catch (error) {
      console.error('[Stripe] Failed to fetch billing data:', error);
      return { invoices: [], refunds: [], subscriptions: [], activity: [] };
    }
  },
});

/**
 * @deprecated Use getCompleteBillingData instead
 * Get billing events/activity for an organization.
 */
type BillingHistoryEvent = {
  id: string;
  type: string;
  description: string;
  amount?: number;
  currency?: string;
  status: string;
  created: number;
  invoiceUrl?: string;
  invoicePdf?: string;
};

export const getBillingHistory = action({
  args: {
    organizationId: v.id('organizations'),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      id: v.string(),
      type: v.string(),
      description: v.string(),
      amount: v.optional(v.number()),
      currency: v.optional(v.string()),
      status: v.string(),
      created: v.number(),
      invoiceUrl: v.optional(v.string()),
      invoicePdf: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args): Promise<BillingHistoryEvent[]> => {
    // Get the Stripe customer for this organization
    const customer: { stripeCustomerId: string } | null = await ctx.runQuery(internal.billing.query.getStripeCustomer, {
      organizationId: args.organizationId,
    });

    if (!customer) {
      return [];
    }

    const events: BillingHistoryEvent[] = [];

    try {
      // Fetch invoices
      const invoices = await stripe.invoices.list({
        customer: customer.stripeCustomerId,
        limit: args.limit ?? 20,
      });

      for (const invoice of invoices.data) {
        let description = 'Invoice';
        if (invoice.billing_reason === 'subscription_create') {
          description = 'Subscription started';
        } else if (invoice.billing_reason === 'subscription_cycle') {
          description = 'Subscription renewal';
        } else if (invoice.billing_reason === 'subscription_update') {
          description = 'Subscription updated';
        } else if (invoice.billing_reason === 'subscription_threshold') {
          description = 'Usage threshold reached';
        } else if (invoice.billing_reason === 'manual') {
          description = 'Manual invoice';
        }

        events.push({
          id: invoice.id,
          type: 'invoice',
          description,
          amount: invoice.amount_paid,
          currency: invoice.currency,
          status: invoice.status ?? 'unknown',
          created: invoice.created * 1000,
          invoiceUrl: invoice.hosted_invoice_url ?? undefined,
          invoicePdf: invoice.invoice_pdf ?? undefined,
        });
      }

      // Fetch recent subscription events from Stripe events API
      const stripeEvents = await stripe.events.list({
        types: [
          'customer.subscription.created',
          'customer.subscription.updated',
          'customer.subscription.deleted',
          'customer.subscription.paused',
          'customer.subscription.resumed',
        ],
        limit: 20,
      });

      // Filter events for this customer
      for (const event of stripeEvents.data) {
        const subscription = event.data.object as { customer?: string; id?: string };
        if (subscription.customer === customer.stripeCustomerId) {
          let description = 'Subscription event';
          let status = 'completed';

          switch (event.type) {
            case 'customer.subscription.created':
              description = 'Subscription created';
              break;
            case 'customer.subscription.updated':
              description = 'Subscription updated';
              break;
            case 'customer.subscription.deleted':
              description = 'Subscription canceled';
              status = 'canceled';
              break;
            case 'customer.subscription.paused':
              description = 'Subscription paused';
              status = 'paused';
              break;
            case 'customer.subscription.resumed':
              description = 'Subscription resumed';
              break;
          }

          events.push({
            id: event.id,
            type: 'subscription_event',
            description,
            status,
            created: event.created * 1000,
          });
        }
      }

      // Sort by created date descending
      events.sort((a, b) => b.created - a.created);

      return events.slice(0, args.limit ?? 20);
    } catch (error) {
      console.error('[Stripe] Failed to fetch billing history:', error);
      return [];
    }
  },
});
