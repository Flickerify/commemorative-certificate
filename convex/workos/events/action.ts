'use node';

import { v } from 'convex/values';
import { WorkOS } from '@workos-inc/node';
import { internalAction } from '../../_generated/server';
import { internal } from '../../_generated/api';

// Event types to poll from WorkOS
const WORKOS_EVENT_TYPES = [
  'user.created',
  'user.updated',
  'user.deleted',
  'organization.created',
  'organization.updated',
  'organization.deleted',
  'organization_membership.created',
  'organization_membership.updated',
  'organization_membership.deleted',
  'organization_domain.verified',
  'organization_domain.verification_failed',
] as const;

/**
 * Poll WorkOS Events API for new events.
 * Acts as a SAFEGUARD for missed webhooks.
 *
 * Flow:
 * 1. Get current cursor from database
 * 2. Fetch new events from WorkOS
 * 3. For each event, call the shared processor (same as webhooks)
 * 4. Update cursor for next poll
 *
 * Deduplication: Both webhooks and Events API use the same event ID
 * and processedEvents table, so events are never processed twice.
 */
export const pollEvents = internalAction({
  args: {},
  returns: v.object({
    processed: v.number(),
    skipped: v.number(),
    newCursor: v.optional(v.string()),
    errors: v.array(v.string()),
  }),
  handler: async (ctx) => {
    const workos = new WorkOS(process.env.WORKOS_API_KEY);

    // Get current cursor
    const cursorDoc = await ctx.runQuery(internal.workos.events.query.getCursor, {});
    const currentCursor = cursorDoc?.cursor;

    console.log(`[Events API] Starting poll with cursor: ${currentCursor ?? 'none'}`);

    let processed = 0;
    let skipped = 0;
    const errors: Array<string> = [];
    let newCursor: string | undefined;

    try {
      // Fetch events from WorkOS
      const response = await workos.events.listEvents({
        events: [...WORKOS_EVENT_TYPES],
        after: currentCursor,
        limit: 100,
      });

      console.log(`[Events API] Fetched ${response.data.length} events`);

      // Process events in order using the shared processor
      for (const event of response.data) {
        try {
          const result = await ctx.runAction(internal.workos.events.process.processWebhookEvent, {
            eventId: event.id,
            event: event,
            source: 'events_api' as const,
          });

          if (result.skipped) {
            skipped++;
          } else if (result.success) {
            processed++;
          } else if (result.error) {
            errors.push(`Event ${event.id} (${event.event}): ${result.error}`);
          }

          newCursor = event.id;
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error(`[Events API] Error processing event ${event.id}:`, errorMsg);
          errors.push(`Event ${event.id} (${event.event}): ${errorMsg}`);
          // Continue processing other events, update cursor to skip this one
          newCursor = event.id;
        }
      }

      // Update cursor if we processed any events
      if (newCursor) {
        await ctx.runMutation(internal.workos.events.mutation.updateCursor, {
          cursor: newCursor,
        });
      }

      console.log(
        `[Events API] Poll complete. Processed: ${processed}, Skipped (already done by webhook): ${skipped}, Errors: ${errors.length}`,
      );

      return { processed, skipped, newCursor, errors };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Events API] Fatal error polling events:`, errorMsg);
      errors.push(`Fatal: ${errorMsg}`);
      return { processed, skipped, newCursor, errors };
    }
  },
});

/**
 * Initialize the cursor to start from a specific point in time.
 * Use this when first setting up or to skip old events.
 */
export const initializeCursor = internalAction({
  args: {
    rangeStart: v.optional(v.number()), // Unix timestamp (ms) to start from
  },
  returns: v.object({
    success: v.boolean(),
    cursor: v.optional(v.string()),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const workos = new WorkOS(process.env.WORKOS_API_KEY);

    try {
      if (args.rangeStart) {
        const response = await workos.events.listEvents({
          events: [...WORKOS_EVENT_TYPES],
          rangeStart: new Date(args.rangeStart).toISOString(),
          limit: 1,
        });

        if (response.data.length > 0) {
          const cursor = response.data[0].id;
          await ctx.runMutation(internal.workos.events.mutation.updateCursor, {
            cursor,
          });
          return {
            success: true,
            cursor,
            message: `Cursor initialized from rangeStart: ${cursor}`,
          };
        }
      }

      // Initialize without a cursor
      await ctx.runMutation(internal.workos.events.mutation.updateCursor, {
        cursor: undefined,
      });

      return {
        success: true,
        cursor: undefined,
        message: 'Cursor initialized. Will fetch all available events.',
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('[Events API] Error initializing cursor:', errorMsg);
      return {
        success: false,
        cursor: undefined,
        message: `Failed to initialize cursor: ${errorMsg}`,
      };
    }
  },
});
