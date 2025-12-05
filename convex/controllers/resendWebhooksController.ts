import type { HonoWithConvex } from 'convex-helpers/server/hono';
import type { ActionCtx } from '../_generated/server';
import { Hono } from 'hono';
import { resend } from '../enterpriseInquiry/email';

const resendWebhooksController: HonoWithConvex<ActionCtx> = new Hono();

/**
 * Resend webhook endpoint for email status tracking.
 * Handles email delivery events like delivered, bounced, complained, etc.
 *
 * Events tracked:
 * - email.sent
 * - email.delivered
 * - email.delivery_delayed
 * - email.complained
 * - email.bounced
 * - email.opened
 * - email.clicked
 */
resendWebhooksController.post('/events', async (c) => {
  const ctx = c.env;
  return await resend.handleResendEventWebhook(ctx, c.req.raw);
});

export { resendWebhooksController };
