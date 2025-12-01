'use node';

import { v } from 'convex/values';
import { internalAction } from '../../_generated/server';
import { stripe } from '../../billing/stripe';
import type Stripe from 'stripe';

/**
 * Verify a Stripe webhook signature and return the event.
 */
export const verifyWebhook = internalAction({
  args: {
    payload: v.string(),
    signature: v.string(),
    secret: v.string(),
  },
  returns: v.any(),
  handler: async (_, args): Promise<Stripe.Event> => {
    try {
      const event = stripe.webhooks.constructEvent(args.payload, args.signature, args.secret);
      return event;
    } catch (err) {
      console.error('[Stripe Webhook] Signature verification failed:', err);
      throw new Error('Webhook signature verification failed');
    }
  },
});


