'use node';

import { v } from 'convex/values';
import { action, internalAction } from '../_generated/server';
import { internal, api } from '../_generated/api';
import { stripe, STRIPE_PRICE_IDS, STRIPE_WEBHOOK_EVENTS, getTierFromPriceId, isUpgrade } from './stripe';
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

    // 4. Check if customer has had previous subscriptions (to disable trial for personal plan)
    const previousSubscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'all',
      limit: 10, // Get enough to check history
    });
    const hasPreviousSubscription = previousSubscriptions.data.length > 0;

    // Check if any previous subscription had a trial (to prevent giving another trial)
    const hasUsedTrial = previousSubscriptions.data.some((sub) => sub.trial_start !== null && sub.trial_end !== null);

    // 5. Determine the new tier from the price ID
    const newTier = getTierFromPriceId(args.priceId);
    const isPersonalPlan = newTier === 'personal';

    // 6. Check for active subscription and handle upgrade with prorated refund
    const activeSubscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'active',
      limit: 1,
    });

    // Also check for trialing subscriptions
    const trialingSubscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'trialing',
      limit: 1,
    });

    const currentSubscription = activeSubscriptions.data[0] || trialingSubscriptions.data[0];

    if (currentSubscription) {
      const currentPriceId = currentSubscription.items.data[0]?.price.id;
      const currentTier = currentPriceId ? getTierFromPriceId(currentPriceId) : 'personal';

      // Check if this is an upgrade
      if (isUpgrade(currentTier, newTier)) {
        console.log(`[Stripe] Upgrade detected: ${currentTier} -> ${newTier}. Processing prorated refund.`);

        // Calculate prorated refund amount for unused time
        const now = Math.floor(Date.now() / 1000); // Current time in seconds
        // Access period times from subscription items (first item)
        const subscriptionItem = currentSubscription.items.data[0];
        const periodStart = subscriptionItem?.current_period_start ?? now;
        const periodEnd = subscriptionItem?.current_period_end ?? now;
        const totalPeriodSeconds = periodEnd - periodStart;
        const usedSeconds = now - periodStart;
        const unusedRatio =
          totalPeriodSeconds > 0 ? Math.max(0, (totalPeriodSeconds - usedSeconds) / totalPeriodSeconds) : 0;

        // Get the latest paid invoice for this subscription
        const invoices = await stripe.invoices.list({
          subscription: currentSubscription.id,
          status: 'paid',
          limit: 1,
        });

        const latestInvoice = invoices.data[0];
        let refundAmount = 0;

        if (latestInvoice && latestInvoice.amount_paid > 0 && unusedRatio > 0) {
          // Calculate prorated refund (unused portion of the paid amount)
          refundAmount = Math.floor(latestInvoice.amount_paid * unusedRatio);

          // Get payment intent from the invoice (can be string ID or expanded object)
          // Note: payment_intent exists on Invoice but TypeScript definitions may not include it
          const invoicePaymentIntent = (latestInvoice as { payment_intent?: string | { id: string } | null })
            .payment_intent;
          const paymentIntentId =
            typeof invoicePaymentIntent === 'string' ? invoicePaymentIntent : invoicePaymentIntent?.id;

          if (refundAmount > 0 && paymentIntentId) {
            // Issue prorated refund using the Refunds API
            try {
              const refund = await stripe.refunds.create({
                payment_intent: paymentIntentId,
                amount: refundAmount,
                reason: 'requested_by_customer',
                metadata: {
                  type: 'upgrade_proration',
                  fromTier: currentTier,
                  toTier: newTier,
                  subscriptionId: currentSubscription.id,
                  unusedRatio: unusedRatio.toFixed(4),
                },
              });

              console.log(
                `[Stripe] Issued prorated refund of ${refundAmount} cents (${(unusedRatio * 100).toFixed(1)}% unused) for upgrade. Refund ID: ${refund.id}`,
              );
            } catch (refundError) {
              // Log but don't block the upgrade if refund fails
              console.error(`[Stripe] Failed to issue prorated refund:`, refundError);
            }
          }
        }

        // Cancel the current subscription immediately
        await stripe.subscriptions.cancel(currentSubscription.id, {
          invoice_now: false, // Don't generate a new invoice
          prorate: false, // We handled proration manually
        });

        console.log(
          `[Stripe] Canceled subscription ${currentSubscription.id} for upgrade to ${newTier}. Refund: ${refundAmount} cents`,
        );
      } else if (currentTier === newTier) {
        // Same tier - switching billing interval (monthly <-> yearly)
        const currentPriceInfo = currentSubscription.items.data[0]?.price;
        const currentInterval = currentPriceInfo?.recurring?.interval; // 'month' or 'year'
        const newPrice = await stripe.prices.retrieve(args.priceId);
        const newInterval = newPrice.recurring?.interval;

        console.log(`[Stripe] Same tier ${currentTier}, switching interval: ${currentInterval} -> ${newInterval}`);

        if (currentInterval && newInterval && currentInterval !== newInterval) {
          if (newInterval === 'year') {
            // Monthly to Yearly - Immediate switch with prorated credit (like an upgrade)
            console.log(`[Stripe] Monthly to Yearly switch - processing with prorated credit`);

            // Calculate prorated credit for unused monthly time
            const now = Math.floor(Date.now() / 1000);
            const subscriptionItem = currentSubscription.items.data[0];
            const periodStart = subscriptionItem?.current_period_start ?? now;
            const periodEnd = subscriptionItem?.current_period_end ?? now;
            const totalPeriodSeconds = periodEnd - periodStart;
            const usedSeconds = now - periodStart;
            const unusedRatio =
              totalPeriodSeconds > 0 ? Math.max(0, (totalPeriodSeconds - usedSeconds) / totalPeriodSeconds) : 0;

            // Get the latest paid invoice
            const invoices = await stripe.invoices.list({
              subscription: currentSubscription.id,
              status: 'paid',
              limit: 1,
            });

            const latestInvoice = invoices.data[0];

            if (latestInvoice && latestInvoice.amount_paid > 0 && unusedRatio > 0) {
              const refundAmount = Math.floor(latestInvoice.amount_paid * unusedRatio);
              const invoicePaymentIntent = (latestInvoice as { payment_intent?: string | { id: string } | null })
                .payment_intent;
              const paymentIntentId =
                typeof invoicePaymentIntent === 'string' ? invoicePaymentIntent : invoicePaymentIntent?.id;

              if (refundAmount > 0 && paymentIntentId) {
                try {
                  const refund = await stripe.refunds.create({
                    payment_intent: paymentIntentId,
                    amount: refundAmount,
                    reason: 'requested_by_customer',
                    metadata: {
                      type: 'interval_switch_proration',
                      fromInterval: currentInterval,
                      toInterval: newInterval,
                      subscriptionId: currentSubscription.id,
                      unusedRatio: unusedRatio.toFixed(4),
                    },
                  });
                  console.log(
                    `[Stripe] Issued prorated refund of ${refundAmount} cents for monthly to yearly switch. Refund ID: ${refund.id}`,
                  );
                } catch (refundError) {
                  console.error(`[Stripe] Failed to issue prorated refund for interval switch:`, refundError);
                }
              }
            }

            // Cancel the current subscription immediately
            await stripe.subscriptions.cancel(currentSubscription.id, {
              invoice_now: false,
              prorate: false,
            });
            console.log(`[Stripe] Canceled monthly subscription ${currentSubscription.id} for yearly switch`);
          } else {
            // Yearly to Monthly - Schedule change for end of billing period (no refund)
            console.log(`[Stripe] Yearly to Monthly switch - scheduling for end of billing period`);

            const subscriptionItem = currentSubscription.items.data[0];
            const periodEnd = subscriptionItem?.current_period_end ?? Math.floor(Date.now() / 1000);

            // Use Stripe Subscription Schedules to schedule the price change at period end
            const periodStart = subscriptionItem?.current_period_start ?? Math.floor(Date.now() / 1000);

            // First, check if there's an existing schedule
            if (currentSubscription.schedule) {
              // Release the existing schedule first, then create a new one
              const scheduleId =
                typeof currentSubscription.schedule === 'string'
                  ? currentSubscription.schedule
                  : currentSubscription.schedule.id;
              await stripe.subscriptionSchedules.release(scheduleId);
              console.log(`[Stripe] Released existing schedule ${scheduleId}`);
            }

            // Create a new schedule from the subscription
            const schedule = await stripe.subscriptionSchedules.create({
              from_subscription: currentSubscription.id,
            });

            // Update the schedule to switch to monthly at period end
            await stripe.subscriptionSchedules.update(schedule.id, {
              phases: [
                {
                  // Current phase until period end
                  items: [{ price: currentPriceInfo?.id ?? args.priceId, quantity: 1 }],
                  start_date: periodStart,
                  end_date: periodEnd,
                },
                {
                  // New phase with monthly billing
                  items: [{ price: args.priceId, quantity: 1 }],
                  start_date: periodEnd,
                },
              ],
              end_behavior: 'release', // Continue as a regular subscription after schedule completes
            });
            console.log(
              `[Stripe] Created schedule ${schedule.id} for yearly to monthly switch at ${new Date(periodEnd * 1000).toISOString()}`,
            );

            // Redirect to success since we scheduled the change
            return { url: args.successUrl };
          }
        }
      } else {
        // Downgrade - no refund, just let Stripe handle it
        console.log(`[Stripe] Downgrade detected: ${currentTier} -> ${newTier}. No refund issued.`);
      }
    }

    // 7. Create checkout session with the customer
    // If customer has had previous subscriptions (especially with trials), disable trial for personal plan
    const shouldDisableTrial = isPersonalPlan && (hasPreviousSubscription || hasUsedTrial);

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
        // Explicitly disable trial if customer has had previous subscriptions
        ...(shouldDisableTrial && { trial_period_days: 0 }),
      },
      metadata: {
        organizationId: args.organizationId,
        hasPreviousSubscription: hasPreviousSubscription.toString(),
        hasUsedTrial: hasUsedTrial.toString(),
        isPersonalPlan: isPersonalPlan.toString(),
        trialDisabled: shouldDisableTrial.toString(),
        upgradeFrom: currentSubscription ? getTierFromPriceId(currentSubscription.items.data[0]?.price.id || '') : '',
        upgradeTo: newTier,
      },
    });

    if (shouldDisableTrial) {
      console.log(
        `[Stripe] Disabling trial for customer ${stripeCustomerId} - hasPreviousSubscription: ${hasPreviousSubscription}, hasUsedTrial: ${hasUsedTrial}`,
      );
    }

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
          trialStart: subscription.trial_start ?? undefined, // Trial start timestamp (seconds)
          trialEnd: subscription.trial_end ?? undefined, // Trial end timestamp (seconds)
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

/**
 * Get billing events/activity for an organization.
 * Combines subscription changes and invoice events.
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
          'customer.subscription.trial_will_end',
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
            case 'customer.subscription.trial_will_end':
              description = 'Trial ending soon';
              status = 'warning';
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
