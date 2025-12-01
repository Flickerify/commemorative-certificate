import type { Context, Next } from 'hono';
import type { StripeHonoEnv } from '../../types';

import { createMiddleware } from 'hono/factory';
import { internal } from '../../_generated/api';

/**
 * Middleware to verify a Stripe webhook event.
 * @param secret - The webhook signing secret from Stripe.
 * @returns The middleware function.
 */
export const stripeWebhookMiddleware = (secret: string) =>
  createMiddleware<StripeHonoEnv>(async (ctx: Context<StripeHonoEnv>, next: Next) => {
    const request = ctx.req;
    const bodyText = await request.text();
    const sigHeader = String(request.header('stripe-signature'));

    if (!sigHeader) {
      return new Response('Missing Stripe signature', { status: 400 });
    }

    try {
      const result = await ctx.env.runAction(internal.stripe.internal.action.verifyWebhook, {
        payload: bodyText,
        signature: sigHeader,
        secret,
      });

      ctx.set('stripeEvent', result);
      await next();
    } catch (error) {
      console.error('[Stripe Webhook] Error verifying webhook:', error);
      return new Response('Signature Verification Error', { status: 400 });
    }
  });

