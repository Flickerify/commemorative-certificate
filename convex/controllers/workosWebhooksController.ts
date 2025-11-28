import type { HonoWithConvex } from 'convex-helpers/server/hono';
import type { ActionCtx } from '../_generated/server';
import { Hono } from 'hono';
import { workosWebhookMiddleware } from '../workos/webhooks/middleware';
import { env } from '../env';
import { handleUserWebhooks } from '../workos/webhooks/users';
import { handleOrganizationWebhooks } from '../workos/webhooks/organizations';
import { handleMembershipWebhooks } from '../workos/webhooks/memberships';

const workosWebhooksController: HonoWithConvex<ActionCtx> = new Hono();

workosWebhooksController.post('/users', workosWebhookMiddleware(env.WORKOS_WEBHOOK_USERS_SECRET), handleUserWebhooks);

workosWebhooksController.post(
  '/organizations',
  workosWebhookMiddleware(env.WORKOS_WEBHOOK_ORGANIZATIONS_SECRET),
  handleOrganizationWebhooks,
);

workosWebhooksController.post(
  '/memberships',
  workosWebhookMiddleware(env.WORKOS_WEBHOOK_MEMBERSHIPS_SECRET),
  handleMembershipWebhooks,
);

export { workosWebhooksController };
