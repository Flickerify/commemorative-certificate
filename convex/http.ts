import { Hono } from 'hono';
import { HttpRouterWithHono } from 'convex-helpers/server/hono';
import type { HonoWithConvex } from 'convex-helpers/server/hono';

import type { ActionCtx } from './_generated/server';
import { workosWebhooksController } from './controllers/workosWebhooksController';
import { stripeWebhooksController } from './controllers/stripeWebhooksController';
import { workosActionsController } from './controllers/workosActionsController';
import { resendWebhooksController } from './controllers/resendWebhooksController';

// Create typed Hono app with all webhook routes
const app: HonoWithConvex<ActionCtx> = new Hono();

// Mount WorkOS webhooks at /workos-webhooks/*
app.route('/workos-webhooks', workosWebhooksController);

// Mount WorkOS actions at /workos-actions/*
app.route('/workos-actions', workosActionsController);

// Mount Stripe webhooks at /stripe-webhooks/*
app.route('/stripe-webhooks', stripeWebhooksController);

// Mount Resend webhooks at /resend-webhooks/*
app.route('/resend-webhooks', resendWebhooksController);

// Export the combined HTTP router using HttpRouterWithHono
const httpRouter = new HttpRouterWithHono(app);
export default httpRouter;
