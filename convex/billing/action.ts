'use node';

import { v } from 'convex/values';
import { action, internalAction } from '../_generated/server';
import { internal, api } from '../_generated/api';
import { stripe, STRIPE_PRICE_IDS, STRIPE_WEBHOOK_EVENTS } from './stripe';
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
 * Create a Stripe checkout session for an organization.
 * Following Theo's pattern: ALWAYS create customer BEFORE checkout.
 *
 * Stripe customers are normally created during organization creation (see organizations/action.ts).
 * This includes a fallback to create the customer here for backward compatibility with
 * organizations that existed before the WorkOS + Stripe integration.
 *
 * See: https://workos.com/docs/authkit/add-ons/stripe/connect-to-stripe
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

    // 3. Check if this organization already has a Stripe customer
    // (Should exist if org was created after WorkOS + Stripe integration)
    const existingCustomer = await ctx.runQuery(internal.billing.query.getStripeCustomer, {
      organizationId: args.organizationId,
    });

    let stripeCustomerId: string;

    if (existingCustomer) {
      stripeCustomerId = existingCustomer.stripeCustomerId;
    } else {
      // Fallback: Create a new Stripe customer for orgs created before integration
      console.log(`[Stripe] Creating customer for existing organization ${organization.name} (legacy fallback)`);

      const newCustomer = await stripe.customers.create({
        email: user.email,
        name: organization.name,
        metadata: {
          workosOrganizationId: organization.externalId,
          organizationName: organization.name,
        },
      });

      // Store the customer binding in Convex
      await ctx.runMutation(internal.billing.internal.mutation.upsertStripeCustomer, {
        organizationId: args.organizationId,
        stripeCustomerId: newCustomer.id,
      });

      // Sync the Stripe customer ID to WorkOS for entitlements and seat sync
      const workos = new WorkOS(process.env.WORKOS_API_KEY);
      await workos.organizations.updateOrganization({
        organization: organization.externalId,
        stripeCustomerId: newCustomer.id,
      });
      console.log(
        `[WorkOS + Stripe] Synced stripeCustomerId ${newCustomer.id} to WorkOS organization ${organization.externalId}`,
      );

      stripeCustomerId = newCustomer.id;
    }

    // 4. Create checkout session with the customer
    const checkout = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      line_items: [
        {
          price: args.priceId,
          quantity: 1,
        },
      ],
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
      subscription_data: {
        metadata: {
          organizationId: args.organizationId,
        },
      },
      metadata: {
        organizationId: args.organizationId,
      },
    });

    if (!checkout.url) {
      throw new Error('Failed to create checkout session');
    }

    return { url: checkout.url };
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
      // Fetch latest subscription data from Stripe
      // Following Theo's exact pattern from stripe-recommendations
      const subscriptions = await stripe.subscriptions.list({
        customer: args.stripeCustomerId,
        limit: 1,
        status: 'all',
        expand: ['data.default_payment_method'],
      });

      if (subscriptions.data.length === 0) {
        // No subscription - sync as "none"
        await ctx.runMutation(internal.billing.internal.mutation.syncSubscriptionData, {
          stripeCustomerId: args.stripeCustomerId,
          subscription: { status: 'none' },
        });
        return null;
      }

      // Cast to access runtime properties that aren't in Stripe v20 types
      // The API returns current_period_start and current_period_end, just not typed
      const subscription = subscriptions.data[0];

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
        trialStart: subscription.trial_start ?? undefined, // Trial start timestamp (seconds)
        trialEnd: subscription.trial_end ?? undefined, // Trial end timestamp (seconds)
        paymentMethodBrand,
        paymentMethodLast4,
      };

      console.log('[Stripe Sync] Subscription data to sync:', JSON.stringify(subscriptionData));

      await ctx.runMutation(internal.billing.internal.mutation.syncSubscriptionData, {
        stripeCustomerId: args.stripeCustomerId,
        subscription: subscriptionData,
      });

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

      // Cancel any active or trialing subscriptions
      for (const subscription of subscriptions.data) {
        if (['active', 'trialing', 'past_due', 'unpaid'].includes(subscription.status)) {
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
