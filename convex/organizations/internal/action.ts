'use node';

import { ConvexError, v } from 'convex/values';
import { internalAction } from '../../functions';
import { WorkOS } from '@workos-inc/node';
import { stripe, STRIPE_PRICE_IDS, TRIAL_PERIOD_DAYS } from '../../billing/stripe';

/**
 * Create a personal workspace in WorkOS with Stripe subscription.
 * Personal workspaces have a 14-day free trial on the Personal tier.
 * They are created automatically when a user signs up.
 *
 * Flow:
 * 1. Get WorkOS user
 * 2. Create personal organization in WorkOS with tier metadata
 * 3. Add the user as owner
 * 4. Create Stripe customer linked to the organization
 * 5. Create Stripe subscription with 14-day trial on Personal price
 *
 * The organization and subscription will be synced to Convex via webhooks:
 * - WorkOS organization.created → creates org in Convex
 * - Stripe customer.subscription.created → creates subscription in Convex
 */
export const createPersonalOrganizationWorkos = internalAction({
  args: {
    externalId: v.string(),
  },
  returns: v.null(),
  async handler(ctx, { externalId }) {
    const workos = new WorkOS(process.env.WORKOS_API_KEY);

    // 1. Get WorkOS user
    const workosUser = await workos.userManagement.getUser(externalId);
    if (!workosUser) {
      throw new ConvexError('workosUser not found');
    }

    const orgName = `${workosUser.firstName ? `${workosUser.firstName}'s` : 'My'} Workspace`;

    // 2. Create personal organization in WorkOS with tier metadata
    const personalOrganization = await workos.organizations.createOrganization({
      name: orgName,
      metadata: {
        tier: 'personal',
        isPersonalWorkspace: 'true',
      },
    });

    console.log(`[Personal Workspace] Created org ${personalOrganization.id} for user ${externalId}`);

    // 3. Add the user as owner
    await workos.userManagement.createOrganizationMembership({
      organizationId: personalOrganization.id,
      userId: externalId,
      roleSlug: 'owner',
    });

    console.log(`[Personal Workspace] Added user ${externalId} as owner`);

    // 4. Create Stripe customer linked to the organization
    const customer = await stripe.customers.create({
      email: workosUser.email,
      name: orgName,
      metadata: {
        workosOrganizationId: personalOrganization.id,
        workosUserId: externalId,
        isPersonalWorkspace: 'true',
      },
    });

    console.log(`[Personal Workspace] Created Stripe customer ${customer.id}`);

    // 5. Create Stripe subscription with 14-day trial on Personal Monthly price
    if (!STRIPE_PRICE_IDS.personalMonthly) {
      console.error('[Personal Workspace] STRIPE_PRICE_PERSONAL_MONTHLY not configured, skipping subscription');
      return null;
    }

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: STRIPE_PRICE_IDS.personalMonthly }],
      trial_period_days: TRIAL_PERIOD_DAYS,
      metadata: {
        workosOrganizationId: personalOrganization.id,
        tier: 'personal',
      },
      // Don't require payment method during trial
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
    });

    console.log(
      `[Personal Workspace] Created subscription ${subscription.id} with ${TRIAL_PERIOD_DAYS}-day trial, trial_end: ${new Date(subscription.trial_end! * 1000).toISOString()}`,
    );

    return null;
  },
});
