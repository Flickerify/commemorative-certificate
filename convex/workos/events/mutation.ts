import { v } from 'convex/values';
import { internalMutation } from '../../_generated/server';

/**
 * Update the events cursor.
 */
export const updateCursor = internalMutation({
  args: {
    cursor: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { cursor }) => {
    const existing = await ctx.db
      .query('workosEventsCursor')
      .withIndex('by_key', (q) => q.eq('key', 'main'))
      .unique();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        cursor,
        lastPolledAt: now,
        lastProcessedEventId: cursor,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert('workosEventsCursor', {
        key: 'main',
        cursor,
        lastPolledAt: now,
        lastProcessedEventId: cursor,
        updatedAt: now,
      });
    }

    return null;
  },
});

/**
 * Mark an event as processed (for idempotency).
 */
export const markEventProcessed = internalMutation({
  args: {
    eventId: v.string(),
    eventType: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { eventId, eventType }) => {
    // Check if already exists (shouldn't happen but be safe)
    const existing = await ctx.db
      .query('workosProcessedEvents')
      .withIndex('by_event_id', (q) => q.eq('eventId', eventId))
      .unique();

    if (existing) {
      return null;
    }

    await ctx.db.insert('workosProcessedEvents', {
      eventId,
      eventType,
      processedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Clean up old processed events (keep last 30 days).
 * Run this periodically to prevent unbounded growth.
 */
export const cleanupOldProcessedEvents = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    // Get old events
    const oldEvents = await ctx.db
      .query('workosProcessedEvents')
      .filter((q) => q.lt(q.field('processedAt'), thirtyDaysAgo))
      .take(500); // Delete in batches to avoid timeout

    for (const event of oldEvents) {
      await ctx.db.delete(event._id);
    }

    return oldEvents.length;
  },
});

