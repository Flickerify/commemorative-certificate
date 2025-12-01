import type { HonoWithConvex } from 'convex-helpers/server/hono';
import type { ActionCtx } from '../_generated/server';
import { Hono } from 'hono';
import { stripeWebhookMiddleware } from '../stripe/webhooks/middleware';
import { handleSubscriptionWebhooks } from '../stripe/webhooks/subscriptions';

// Get the webhook secret from environment
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';

const stripeWebhooksController: HonoWithConvex<ActionCtx> = new Hono();

/**
 * Main Stripe webhook endpoint.
 * All subscription-related events are handled here.
 *
 * Events tracked:
 * - checkout.session.completed
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - customer.subscription.paused
 * - customer.subscription.resumed
 * - invoice.paid
 * - invoice.payment_failed
 * - invoice.payment_succeeded
 *
 */
stripeWebhooksController.post('/events', stripeWebhookMiddleware(STRIPE_WEBHOOK_SECRET), handleSubscriptionWebhooks);

export { stripeWebhooksController };
