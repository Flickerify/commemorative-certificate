import { Context } from 'hono';

import { internal } from '../../_generated/api';
import type { WorkosHonoEnv } from '../../types';

/**
 * Handle user webhooks from WorkOS.
 *
 * IMPORTANT: Respond immediately with 200 OK, then process async.
 * Per WorkOS docs: "respond to a webhook request with a 200 OK response
 * as quickly as possible once received"
 */
export async function handleUserWebhooks(ctx: Context<WorkosHonoEnv>) {
  const event = ctx.var.workosEvent;

  // Schedule async processing - await the scheduling (not the processing)
  // The scheduler call itself is fast, the actual processing happens async
  await ctx.env.scheduler.runAfter(0, internal.workos.events.process.processWebhookEvent, {
    eventId: event.id,
    eventType: event.event,
    eventData: event.data,
    source: 'webhook' as const,
  });

  console.log(`[Webhook] Received user event: ${event.id} (${event.event}) - scheduled for processing`);

  // Return 200 immediately - processing happens async
  return new Response(null, { status: 200 });
}
