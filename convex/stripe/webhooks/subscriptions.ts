import type { Context } from 'hono';
import type { StripeHonoEnv } from '../../types';
import { internal } from '../../_generated/api';
import { STRIPE_WEBHOOK_EVENTS } from '../../billing/stripe';
import type Stripe from 'stripe';

/**
 * Handle Stripe subscription-related webhook events.
 * Following Theo's pattern: on any relevant event, sync the full subscription state.
 *
 * Includes idempotency check to prevent duplicate processing of the same event.
 */
export const handleSubscriptionWebhooks = async (ctx: Context<StripeHonoEnv>) => {
  const event = ctx.get('stripeEvent');

  if (!event) {
    console.error('[Stripe Webhook] No event in context');
    return ctx.json({ received: true, error: 'No event in context' }, 200);
  }

  console.log(`[Stripe Webhook] Processing event: ${event.type} (${event.id})`);

  // Skip events we don't care about
  if (!STRIPE_WEBHOOK_EVENTS.includes(event.type)) {
    console.log(`[Stripe Webhook] Skipping untracked event: ${event.type}`);
    return ctx.json({ received: true, skipped: true });
  }

  // Idempotency check: Skip if event was already processed
  const alreadyProcessed = await ctx.env.runMutation(internal.billing.internal.mutation.checkWebhookEventProcessed, {
    eventId: event.id,
  });

  if (alreadyProcessed) {
    console.log(`[Stripe Webhook] Skipping duplicate event: ${event.id}`);
    return ctx.json({ received: true, duplicate: true });
  }

  // Extract customer ID from the event data
  // All the events I track have a customerId
  const { customer: customerId } = event?.data?.object as Stripe.Event.Data.Object & { customer: string };

  if (typeof customerId !== 'string') {
    console.error(`[Stripe Webhook] No customer ID in event: ${event.type}`);
    return ctx.json({ received: true, error: 'No customer ID' }, 200);
  }

  try {
    // Sync the subscription data for this customer
    // This is the key to Theo's pattern - ONE function to sync ALL subscription state
    await ctx.env.runAction(internal.billing.action.syncStripeDataForCustomer, {
      stripeCustomerId: customerId,
    });

    // Record the event as processed for idempotency
    await ctx.env.runMutation(internal.billing.internal.mutation.recordWebhookEvent, {
      eventId: event.id,
      eventType: event.type,
      customerId,
    });

    console.log(`[Stripe Webhook] Successfully synced customer: ${customerId} (event: ${event.id})`);
    return ctx.json({ received: true, synced: true });
  } catch (error) {
    console.error('[Stripe Webhook] Error syncing subscription:', error);
    // Still return 200 to prevent Stripe from retrying
    // Note: We don't record failed events so they can be retried by Stripe
    return ctx.json({ received: true, error: 'Sync failed' }, 200);
  }
};
