'use node';

import Stripe from 'stripe';

/**
 * Stripe client singleton for server-side operations.
 * Only use this in Node.js actions.
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover',
  typescript: true,
});

/**
 * Price IDs for different subscription tiers.
 * These should be set in your environment variables.
 */
export const STRIPE_PRICE_IDS = {
  // Personal tier - 14-day free trial, then paid
  personalMonthly: process.env.STRIPE_PRICE_PERSONAL_MONTHLY ?? '',
  personalYearly: process.env.STRIPE_PRICE_PERSONAL_YEARLY ?? '',
  // Pro tier
  proMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? '',
  proYearly: process.env.STRIPE_PRICE_PRO_YEARLY ?? '',
  // Enterprise tier
  enterpriseMonthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY ?? '',
  enterpriseYearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY ?? '',
} as const;

/**
 * Trial period for personal tier (in days).
 */
export const TRIAL_PERIOD_DAYS = 14;

/**
 * Check if a price ID is for the Personal tier (eligible for trial).
 */
export function isPersonalTierPrice(priceId: string): boolean {
  return priceId === STRIPE_PRICE_IDS.personalMonthly || priceId === STRIPE_PRICE_IDS.personalYearly;
}

/**
 * Get tier from Stripe price ID.
 */
export function getTierFromPriceId(priceId: string): 'personal' | 'pro' | 'enterprise' {
  switch (priceId) {
    case STRIPE_PRICE_IDS.personalMonthly:
    case STRIPE_PRICE_IDS.personalYearly:
      return 'personal';
    case STRIPE_PRICE_IDS.proMonthly:
    case STRIPE_PRICE_IDS.proYearly:
      return 'pro';
    case STRIPE_PRICE_IDS.enterpriseMonthly:
    case STRIPE_PRICE_IDS.enterpriseYearly:
      return 'enterprise';
    default:
      // Default to personal for unknown prices
      return 'personal';
  }
}

/**
 * Get billing interval from Stripe price ID.
 */
export function getBillingIntervalFromPriceId(priceId: string): 'month' | 'year' {
  switch (priceId) {
    case STRIPE_PRICE_IDS.personalMonthly:
    case STRIPE_PRICE_IDS.proMonthly:
    case STRIPE_PRICE_IDS.enterpriseMonthly:
      return 'month';
    case STRIPE_PRICE_IDS.personalYearly:
    case STRIPE_PRICE_IDS.proYearly:
    case STRIPE_PRICE_IDS.enterpriseYearly:
      return 'year';
    default:
      return 'month'; // Default to monthly
  }
}

/**
 * Stripe webhook events we care about for subscription sync.
 */
export const STRIPE_WEBHOOK_EVENTS: Stripe.Event.Type[] = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
  'customer.subscription.pending_update_applied',
  'customer.subscription.pending_update_expired',
  'customer.subscription.trial_will_end',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.payment_action_required',
  'invoice.upcoming',
  'invoice.marked_uncollectible',
  'invoice.payment_succeeded',
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
];
