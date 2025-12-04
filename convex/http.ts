import { Hono } from 'hono';
import { HttpRouterWithHono } from 'convex-helpers/server/hono';
import type { HonoWithConvex } from 'convex-helpers/server/hono';

import type { ActionCtx } from './_generated/server';
import { workosWebhooksController } from './controllers/workosWebhooksController';
import { stripeWebhooksController } from './controllers/stripeWebhooksController';
import { workosActionsController } from './controllers/workosActionsController';

// Create typed Hono app with all webhook routes
const app: HonoWithConvex<ActionCtx> = new Hono();

// Mount WorkOS webhooks at /workos-webhooks/*
app.route('/workos-webhooks', workosWebhooksController);

// Mount WorkOS actions at /workos-actions/*
app.route('/workos-actions', workosActionsController);

// Mount Stripe webhooks at /stripe/*
app.route('/stripe-webhooks', stripeWebhooksController);

// Export the combined HTTP router using HttpRouterWithHono
export default new HttpRouterWithHono(app);
