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
  FREE_TRIAL_DAYS,
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
// - UPGRADES: Immediate, pay prorated difference
// - DOWNGRADES: Scheduled at period end
// - CANCELLATION: Access until period end
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
 * - Downgrades (lower tier or yearly→monthly): Scheduled at period end
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
    isImmediateRefund: v.optional(v.boolean()),
    refundAmount: v.optional(v.number()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<UpdateSubscriptionResult & { isImmediateRefund?: boolean; refundAmount?: number }> => {
    // 1. Get Stripe customer
    type CustomerResult = { stripeCustomerId: string } | null;
    const customer: CustomerResult = await ctx.runQuery(internal.billing.query.getStripeCustomer, {
      organizationId: args.organizationId,
    });
    if (!customer) {
      throw new Error('No billing account found');
    }

    // 2. Get current active or trialing subscription
    // Note: We need to check for both 'active' AND 'trialing' status
    // so users on free trial can upgrade their plan
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.stripeCustomerId,
      limit: 10,
    });

    // Find the first active or trialing subscription
    const currentSubscription = subscriptions.data.find((s) => s.status === 'active' || s.status === 'trialing') as
      | import('stripe').Stripe.Subscription
      | undefined;

    if (!currentSubscription) {
      throw new Error('No active subscription found. Please subscribe first.');
    }

    const isTrialing = currentSubscription.status === 'trialing';

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

    // Get current user for audit logging
    const currentUser = await ctx.runQuery(api.users.query.me);

    // Helper to log audit events for billing changes
    const logBillingAudit = async (
      action: 'billing.plan_upgraded' | 'billing.plan_downgraded' | 'billing.subscription_updated',
      status: 'success' | 'failure',
      description: string,
      metadata?: Record<string, unknown>,
    ) => {
      await ctx.runMutation(internal.audit.internal.mutation.logAuditEvent, {
        organizationId: args.organizationId,
        actorId: currentUser?._id,
        actorExternalId: currentUser?.externalId,
        actorEmail: currentUser?.email,
        actorName: currentUser
          ? [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ') || undefined
          : undefined,
        actorType: 'user' as const,
        category: 'billing' as const,
        action,
        status,
        targetType: 'subscription',
        targetId: currentSubscription.id,
        targetName: `${newTier} (${newInterval}ly)`,
        description,
        metadata: {
          previousTier: currentTier,
          previousInterval: currentInterval,
          newTier,
          newInterval,
          wasTrialing: isTrialing,
          stripeSubscriptionId: currentSubscription.id,
          ...metadata,
        },
      });
    };

    // 4. Apply change based on type
    if (isTierUpgrade || isIntervalUpgrade) {
      // ═══════════════════════════════════════════════════════════════
      // UPGRADE: Behavior depends on trial status
      // - If trialing: Keep the trial, just change the plan (trial applies to all plans)
      // - If active: Immediate change, customer pays prorated difference
      // ═══════════════════════════════════════════════════════════════

      if (isTrialing) {
        // During trial, upgrade immediately but KEEP the trial
        // The 14-day trial applies to all plans - user can explore freely
        console.log(
          `[Stripe] Upgrade during trial (keeping trial): ${currentTier}/${currentInterval} → ${newTier}/${newInterval}`,
        );

        await stripe.subscriptions.update(currentSubscription.id, {
          items: [{ id: subscriptionItemId, price: args.priceId }],
          proration_behavior: 'none', // No proration during trial
          // DON'T set trial_end - keep the trial running
        });

        // Sync updated subscription data
        await ctx.runAction(internal.billing.action.syncStripeDataForCustomer, {
          stripeCustomerId: customer.stripeCustomerId,
        });

        // Log audit event for the upgrade during trial
        await logBillingAudit(
          'billing.plan_upgraded',
          'success',
          `Subscription upgraded from ${currentTier} (${currentInterval}ly) to ${newTier} (${newInterval}ly) during trial (trial continues)`,
          { effectiveImmediately: true, trialContinues: true },
        );

        return {
          success: true,
          message: `Upgraded to ${newTier} (${newInterval}ly). Your free trial continues with the new plan!`,
          effectiveDate: new Date().toISOString(),
        };
      }

      // For active (paid) subscriptions, charge prorated difference
      console.log(`[Stripe] Upgrade: ${currentTier}/${currentInterval} → ${newTier}/${newInterval}`);

      await stripe.subscriptions.update(currentSubscription.id, {
        items: [{ id: subscriptionItemId, price: args.priceId }],
        proration_behavior: 'always_invoice',
        payment_behavior: 'error_if_incomplete',
      });

      // Sync updated subscription data
      await ctx.runAction(internal.billing.action.syncStripeDataForCustomer, {
        stripeCustomerId: customer.stripeCustomerId,
      });

      // Log audit event for the upgrade
      await logBillingAudit(
        'billing.plan_upgraded',
        'success',
        `Subscription upgraded from ${currentTier} (${currentInterval}ly) to ${newTier} (${newInterval}ly)`,
        { effectiveImmediately: true },
      );

      return {
        success: true,
        message: `Upgraded to ${newTier} (${newInterval}ly). You've been charged the prorated difference.`,
        effectiveDate: new Date().toISOString(),
      };
    } else if (isTierDowngrade || isIntervalDowngrade) {
      // ═══════════════════════════════════════════════════════════════
      // DOWNGRADE: Behavior depends on trial status
      // - If trialing: Immediate change (no money involved yet)
      // - If active: Scheduled at period end
      // ═══════════════════════════════════════════════════════════════

      if (isTrialing) {
        // During trial, downgrade immediately since no payment has been made
        console.log(`[Stripe] Downgrade during trial: ${currentTier}/${currentInterval} → ${newTier}/${newInterval}`);

        await stripe.subscriptions.update(currentSubscription.id, {
          items: [{ id: subscriptionItemId, price: args.priceId }],
          proration_behavior: 'none', // No proration during trial
        });

        // Sync updated subscription data
        await ctx.runAction(internal.billing.action.syncStripeDataForCustomer, {
          stripeCustomerId: customer.stripeCustomerId,
        });

        // Log audit event for the downgrade during trial
        await logBillingAudit(
          'billing.plan_downgraded',
          'success',
          `Subscription changed from ${currentTier} (${currentInterval}ly) to ${newTier} (${newInterval}ly) during trial`,
          { effectiveImmediately: true, duringTrial: true },
        );

        return {
          success: true,
          message: `Changed to ${newTier} (${newInterval}ly). Your trial continues with the new plan.`,
          effectiveDate: new Date().toISOString(),
        };
      }

      // For active (paid) subscriptions, schedule downgrade at period end
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

      // Sync to get the scheduled change in Convex
      await ctx.runAction(internal.billing.action.syncStripeDataForCustomer, {
        stripeCustomerId: customer.stripeCustomerId,
      });

      const effectiveDateStr: string = new Date(periodEnd * 1000).toISOString();

      // Log audit event for the scheduled downgrade
      await logBillingAudit(
        'billing.plan_downgraded',
        'success',
        `Subscription downgrade from ${currentTier} (${currentInterval}ly) to ${newTier} (${newInterval}ly) scheduled for ${new Date(periodEnd * 1000).toLocaleDateString()}`,
        {
          effectiveImmediately: false,
          scheduledFor: effectiveDateStr,
          stripeScheduleId: schedule.id,
        },
      );

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

/**
 * End the free trial early and start paying immediately.
 * For users who love the product and want to support it right away! 🚀
 *
 * BONUS: Remaining trial days are added to the first billing cycle!
 * Example: 10 days remaining + yearly plan = 1 year + 10 days first cycle
 *
 * Optionally allows changing the plan at the same time.
 */
export const endTrialAndStartPaying = action({
  args: {
    organizationId: v.id('organizations'),
    priceId: v.optional(v.string()), // Optional: change plan at the same time
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    bonusDays: v.optional(v.number()),
    nextBillingDate: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // 1. Get Stripe customer
    type CustomerResult = { stripeCustomerId: string } | null;
    const customer: CustomerResult = await ctx.runQuery(internal.billing.query.getStripeCustomer, {
      organizationId: args.organizationId,
    });
    if (!customer) {
      return { success: false, message: 'No billing account found' };
    }

    // 2. Get current trialing subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.stripeCustomerId,
      limit: 10,
    });

    const currentSubscription = subscriptions.data.find((s) => s.status === 'trialing') as
      | import('stripe').Stripe.Subscription
      | undefined;

    if (!currentSubscription) {
      return {
        success: false,
        message: "You're not currently on a free trial. Your subscription is already active!",
      };
    }

    // 3. Get current user for audit logging
    const currentUser = await ctx.runQuery(api.users.query.me);

    const currentPriceId = currentSubscription.items.data[0].price.id;
    const currentTier = getTierFromPriceId(currentPriceId);
    const currentInterval = getBillingIntervalFromPriceId(currentPriceId);

    // Determine final plan (use new price if provided, otherwise keep current)
    const finalPriceId = args.priceId ?? currentPriceId;
    const finalTier = getTierFromPriceId(finalPriceId);
    const finalInterval = getBillingIntervalFromPriceId(finalPriceId);
    const isPlanChange = args.priceId && args.priceId !== currentPriceId;

    // 4. Calculate remaining trial days as bonus
    const nowSeconds = Math.floor(Date.now() / 1000);
    const trialEndSeconds = currentSubscription.trial_end ?? nowSeconds;
    const remainingTrialSeconds = Math.max(0, trialEndSeconds - nowSeconds);
    const bonusDays = Math.ceil(remainingTrialSeconds / (24 * 60 * 60));

    // Calculate billing interval in seconds
    const intervalSeconds = finalInterval === 'year' ? 365 * 24 * 60 * 60 : 30 * 24 * 60 * 60;

    // Calculate extended period end (now + bonus days + billing interval)
    const extendedPeriodEnd = nowSeconds + remainingTrialSeconds + intervalSeconds;

    try {
      // 5. Release any existing schedule first
      if (currentSubscription.schedule) {
        const scheduleId =
          typeof currentSubscription.schedule === 'string'
            ? currentSubscription.schedule
            : currentSubscription.schedule.id;
        try {
          await stripe.subscriptionSchedules.release(scheduleId);
        } catch {
          // Schedule might already be released, ignore
        }
      }

      // 6. Create a subscription schedule from the current subscription
      // This allows us to set a custom first billing period
      const schedule = await stripe.subscriptionSchedules.create({
        from_subscription: currentSubscription.id,
      });

      // 7. Update the schedule with an extended first phase
      // Phase 1: Starts now, ends at (now + bonus days + billing interval)
      // This gives them the full billing period PLUS their remaining trial days
      await stripe.subscriptionSchedules.update(schedule.id, {
        end_behavior: 'release', // After schedule ends, subscription continues normally
        phases: [
          {
            items: [{ price: finalPriceId, quantity: 1 }],
            start_date: nowSeconds,
            end_date: extendedPeriodEnd,
            proration_behavior: 'none',
          },
        ],
      });

      const nextBillingDate = new Date(extendedPeriodEnd * 1000).toISOString();

      console.log(
        `[Stripe] Trial ended with ${bonusDays} bonus days. Next billing: ${nextBillingDate}${isPlanChange ? ` (changed to ${finalTier}/${finalInterval})` : ''}`,
      );

      // 8. Sync updated subscription data
      await ctx.runAction(internal.billing.action.syncStripeDataForCustomer, {
        stripeCustomerId: customer.stripeCustomerId,
      });

      // 9. Log audit event
      await ctx.runMutation(internal.audit.internal.mutation.logAuditEvent, {
        organizationId: args.organizationId,
        actorId: currentUser?._id,
        actorExternalId: currentUser?.externalId,
        actorEmail: currentUser?.email,
        actorName: currentUser
          ? [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ') || undefined
          : undefined,
        actorType: 'user' as const,
        category: 'billing' as const,
        action: 'billing.subscription_updated' as const,
        status: 'success' as const,
        targetType: 'subscription',
        targetId: currentSubscription.id,
        targetName: `${finalTier} (${finalInterval}ly)`,
        description: `User opted out of free trial and started ${finalTier} (${finalInterval}ly) subscription with ${bonusDays} bonus days`,
        metadata: {
          previousTier: currentTier,
          previousInterval: currentInterval,
          finalTier,
          finalInterval,
          trialEndedEarly: true,
          planChanged: isPlanChange,
          bonusDays,
          nextBillingDate,
          stripeSubscriptionId: currentSubscription.id,
          stripeScheduleId: schedule.id,
        },
      });

      const intervalLabel = finalInterval === 'year' ? '1 year' : '1 month';

      return {
        success: true,
        message: `🎉 Thank you for your support! Your ${finalTier} subscription is now active with ${bonusDays} bonus days. First billing cycle: ${intervalLabel} + ${bonusDays} days!`,
        bonusDays,
        nextBillingDate,
      };
    } catch (error) {
      console.error('[Stripe] Failed to end trial:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to activate subscription. Please try again.',
      };
    }
  },
});

// ============================================================
// FREE TRIAL SUBSCRIPTION
// ============================================================

export type TrialEligibility = {
  eligible: boolean;
  reason: string;
  trialDays?: number;
};

/**
 * Check if organization is eligible for a free trial.
 * Users can only use the free trial once per account.
 */
export const checkTrialEligibility = action({
  args: {
    organizationId: v.id('organizations'),
  },
  returns: v.object({
    eligible: v.boolean(),
    reason: v.string(),
    trialDays: v.optional(v.number()),
  }),
  handler: async (ctx, args): Promise<TrialEligibility> => {
    // Check if organization has already used their trial
    type TrialStatus = { hasUsedTrial?: boolean } | null;
    const trialStatus: TrialStatus = await ctx.runQuery(internal.billing.query.getTrialStatus, {
      organizationId: args.organizationId,
    });

    if (trialStatus?.hasUsedTrial) {
      return {
        eligible: false,
        reason: 'You have already used your free trial. Please subscribe to continue.',
      };
    }

    return {
      eligible: true,
      reason: `You are eligible for a ${FREE_TRIAL_DAYS}-day free trial. No credit card required.`,
      trialDays: FREE_TRIAL_DAYS,
    };
  },
});

/**
 * Start a free trial subscription without requiring a credit card.
 * The subscription will be canceled automatically if no payment method is added.
 */
export const startFreeTrial = action({
  args: {
    organizationId: v.id('organizations'),
    priceId: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    subscriptionId: v.optional(v.string()),
    trialEndsAt: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    // 1. Check trial eligibility
    const eligibility: TrialEligibility = await ctx.runAction(api.billing.action.checkTrialEligibility, {
      organizationId: args.organizationId,
    });

    if (!eligibility.eligible) {
      return {
        success: false,
        message: eligibility.reason,
      };
    }

    // 2. Get the organization
    const organization = await ctx.runQuery(api.organizations.query.getOrganizationById, {
      id: args.organizationId,
    });
    if (!organization) {
      return { success: false, message: 'Organization not found' };
    }

    // 3. Get current user for email
    const user = await ctx.runQuery(api.users.query.me);
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    // 4. Get or create Stripe customer
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

      stripeCustomerId = newCustomer.id;
    }

    // 5. Create subscription with free trial (no payment method required)
    try {
      const subscription = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: args.priceId }],
        trial_period_days: FREE_TRIAL_DAYS,
        payment_settings: {
          save_default_payment_method: 'on_subscription',
        },
        trial_settings: {
          end_behavior: {
            missing_payment_method: 'pause', // Pause if no payment method at trial end
          },
        },
        metadata: {
          organizationId: args.organizationId,
          tier: getTierFromPriceId(args.priceId),
        },
      });

      const trialEndsAt = subscription.trial_end ? subscription.trial_end * 1000 : undefined;
      const trialStartedAt = Date.now();

      // 6. Mark trial as used and store trial dates
      await ctx.runMutation(internal.billing.internal.mutation.markTrialUsed, {
        organizationId: args.organizationId,
        trialStartedAt,
        trialEndsAt: trialEndsAt ?? trialStartedAt + FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000,
      });

      // 7. Sync subscription data
      await ctx.runAction(internal.billing.action.syncStripeDataForCustomer, {
        stripeCustomerId,
      });

      console.log(`[Stripe] Started free trial for organization ${organization.name}`);

      return {
        success: true,
        message: `Your ${FREE_TRIAL_DAYS}-day free trial has started! Add a payment method before it ends to continue using the service.`,
        subscriptionId: subscription.id,
        trialEndsAt,
      };
    } catch (error) {
      console.error('[Stripe] Failed to start free trial:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to start free trial. Please try again.',
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
        expand: ['data.default_payment_method', 'data.schedule'],
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

        // Check for scheduled plan changes via subscription schedule
        let scheduledPriceId: string | undefined;
        let stripeScheduleId: string | undefined;

        const schedule = subscription.schedule;
        if (schedule && typeof schedule !== 'string') {
          stripeScheduleId = schedule.id;

          // If there's a schedule with multiple phases, the next phase has the scheduled plan
          if (schedule.phases && schedule.phases.length > 1) {
            const nextPhase = schedule.phases[1]; // The second phase is the scheduled change
            if (nextPhase?.items?.[0]?.price) {
              const nextPrice = nextPhase.items[0].price;
              scheduledPriceId = typeof nextPrice === 'string' ? nextPrice : nextPrice.id;
            }
          }
        } else if (typeof schedule === 'string') {
          // Schedule is just an ID, we need to fetch it
          try {
            const fullSchedule = await stripe.subscriptionSchedules.retrieve(schedule);
            stripeScheduleId = fullSchedule.id;

            if (fullSchedule.phases && fullSchedule.phases.length > 1) {
              const nextPhase = fullSchedule.phases[1];
              if (nextPhase?.items?.[0]?.price) {
                const nextPrice = nextPhase.items[0].price;
                scheduledPriceId = typeof nextPrice === 'string' ? nextPrice : nextPrice.id;
              }
            }
          } catch (err) {
            console.log(`[Stripe Sync] Could not fetch schedule ${schedule}:`, err);
          }
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
          billingInterval: subscription.items.data[0].price.recurring?.interval as 'month' | 'year',
          priceId: subscription.items.data[0].price.id,
          currentPeriodStart: subscription.items.data[0].current_period_start,
          currentPeriodEnd: subscription.items.data[0].current_period_end,
          cancelAtPeriodEnd: willCancel, // Use combined check for both cancellation methods
          cancelAt: subscription.cancel_at ?? undefined, // Pass the actual cancel timestamp
          paymentMethodBrand,
          paymentMethodLast4,
          scheduledPriceId,
          stripeScheduleId,
        };

        console.log(
          `[Stripe Sync] Syncing subscription ${subscription.id} (status: ${subscription.status})${scheduledPriceId ? `, scheduled change to ${scheduledPriceId}` : ''}`,
        );

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
 * Cancel a scheduled downgrade (removes the subscription schedule).
 * This keeps the current plan instead of switching to the scheduled one at period end.
 */
export const cancelScheduledDowngrade = action({
  args: {
    organizationId: v.id('organizations'),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    // 1. Get Stripe customer
    type CustomerResult = { stripeCustomerId: string } | null;
    const customer: CustomerResult = await ctx.runQuery(internal.billing.query.getStripeCustomer, {
      organizationId: args.organizationId,
    });
    if (!customer) {
      return { success: false, message: 'No billing account found' };
    }

    // 2. Get current active subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.stripeCustomerId,
      status: 'active',
      limit: 1,
      expand: ['data.schedule'],
    });

    const currentSubscription = subscriptions.data[0] as import('stripe').Stripe.Subscription | undefined;
    if (!currentSubscription) {
      return { success: false, message: 'No active subscription found' };
    }

    // 3. Check if there's a schedule to cancel
    const schedule = currentSubscription.schedule;
    if (!schedule) {
      return { success: false, message: 'No scheduled plan change found' };
    }

    const scheduleId = typeof schedule === 'string' ? schedule : schedule.id;

    try {
      // 4. Release the subscription schedule (this keeps the current plan)
      await stripe.subscriptionSchedules.release(scheduleId);

      console.log(`[Stripe] Canceled scheduled downgrade for subscription ${currentSubscription.id}`);

      // 5. Sync the updated subscription data
      await ctx.runAction(internal.billing.action.syncStripeDataForCustomer, {
        stripeCustomerId: customer.stripeCustomerId,
      });

      return {
        success: true,
        message: 'Scheduled plan change has been canceled. You will keep your current plan.',
      };
    } catch (error) {
      console.error('[Stripe] Failed to cancel scheduled downgrade:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to cancel scheduled change',
      };
    }
  },
});

/**
 * Resume a subscription that was scheduled to cancel (cancel_at_period_end = true).
 * This keeps the subscription active past the current period.
 *
 * Use this when:
 * - User canceled but subscription hasn't ended yet
 * - User wants to undo the cancellation and continue
 */
export const resumeSubscription = action({
  args: {
    organizationId: v.id('organizations'),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    // 1. Get Stripe customer
    type CustomerResult = { stripeCustomerId: string } | null;
    const customer: CustomerResult = await ctx.runQuery(internal.billing.query.getStripeCustomer, {
      organizationId: args.organizationId,
    });
    if (!customer) {
      return { success: false, message: 'No billing account found' };
    }

    // 2. Find subscription scheduled for cancellation
    // Include both active and trialing in case they cancel during trial
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.stripeCustomerId,
      limit: 10,
    });

    // Find the subscription that's scheduled to cancel
    const subscription = subscriptions.data.find(
      (s) => (s.status === 'active' || s.status === 'trialing') && (s.cancel_at_period_end || s.cancel_at !== null),
    );

    if (!subscription) {
      // Check if there's an active subscription that's NOT scheduled for cancellation
      const activeSubscription = subscriptions.data.find((s) => s.status === 'active' || s.status === 'trialing');

      if (activeSubscription) {
        return {
          success: false,
          message: 'Your subscription is already active and not scheduled for cancellation.',
        };
      }

      return {
        success: false,
        message: 'No subscription found to resume. You may need to create a new subscription.',
      };
    }

    try {
      // 3. Remove the cancellation by clearing both flags
      await stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: false,
        cancel_at: '', // Empty string clears the cancel_at timestamp
      });

      console.log(`[Stripe] Resumed subscription ${subscription.id} for customer ${customer.stripeCustomerId}`);

      // 4. Sync the updated subscription data
      await ctx.runAction(internal.billing.action.syncStripeDataForCustomer, {
        stripeCustomerId: customer.stripeCustomerId,
      });

      return {
        success: true,
        message: 'Your subscription has been resumed. You will continue to be billed as normal.',
      };
    } catch (error) {
      console.error('[Stripe] Failed to resume subscription:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to resume subscription. Please try again.',
      };
    }
  },
});

/**
 * Create a new subscription for an organization.
 * This is the primary way to create subscriptions after initial checkout.
 *
 * Behavior:
 * - If organization has never had a subscription: Creates checkout with trial (if eligible)
 * - If organization has used trial: Creates checkout without trial
 * - If organization has active/trialing subscription: Throws error (use updateSubscription instead)
 *
 * Use this when:
 * - User's subscription has fully ended and they want to resubscribe
 * - User never completed the initial checkout
 */
type CreateNewSubscriptionResult = {
  url: string;
  hasTrialIncluded: boolean;
};

export const createNewSubscription = action({
  args: {
    organizationId: v.id('organizations'),
    priceId: v.string(),
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  returns: v.object({
    url: v.string(),
    hasTrialIncluded: v.boolean(),
  }),
  handler: async (ctx, args): Promise<CreateNewSubscriptionResult> => {
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

    // 3. Check if they've already used their trial
    type TrialStatus = { hasUsedTrial?: boolean } | null;
    const trialStatus: TrialStatus = await ctx.runQuery(internal.billing.query.getTrialStatus, {
      organizationId: args.organizationId,
    });
    const hasUsedTrial: boolean = trialStatus?.hasUsedTrial ?? false;

    // 4. Get or create Stripe customer
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

    // 5. Check for existing active or trialing subscription
    const existingSubscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      limit: 10,
    });

    const activeOrTrialing = existingSubscriptions.data.find((s) => s.status === 'active' || s.status === 'trialing');

    if (activeOrTrialing) {
      throw new Error(
        'Organization already has an active subscription. Use updateSubscription to change plans, or cancelSubscription first.',
      );
    }

    // 6. Create checkout session
    // Include trial ONLY if they haven't used it before
    const hasTrialIncluded: boolean = !hasUsedTrial;

    const checkoutConfig: import('stripe').Stripe.Checkout.SessionCreateParams = {
      customer: stripeCustomerId,
      mode: 'subscription',
      line_items: [{ price: args.priceId, quantity: 1 }],
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
      metadata: {
        organizationId: args.organizationId,
        tier: getTierFromPriceId(args.priceId),
        isResubscription: 'true',
      },
    };

    // Add trial if eligible
    if (hasTrialIncluded) {
      checkoutConfig.subscription_data = {
        trial_period_days: FREE_TRIAL_DAYS,
        trial_settings: {
          end_behavior: {
            missing_payment_method: 'pause',
          },
        },
        metadata: {
          organizationId: args.organizationId,
          tier: getTierFromPriceId(args.priceId),
        },
      };
    } else {
      checkoutConfig.subscription_data = {
        metadata: {
          organizationId: args.organizationId,
          tier: getTierFromPriceId(args.priceId),
        },
      };
    }

    const checkout = await stripe.checkout.sessions.create(checkoutConfig);

    if (!checkout.url) {
      throw new Error('Failed to create checkout session');
    }

    console.log(
      `[Stripe] Created checkout session for ${hasTrialIncluded ? 'new subscription with trial' : 'resubscription without trial'}`,
    );

    return {
      url: checkout.url,
      hasTrialIncluded,
    };
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
