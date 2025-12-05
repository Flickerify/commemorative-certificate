import { v } from 'convex/values';
import { internalQuery } from '../../_generated/server';

/**
 * Get the current events cursor.
 */
export const getCursor = internalQuery({
  args: {},
  returns: v.union(
    v.object({
      cursor: v.optional(v.string()),
      lastPolledAt: v.number(),
      lastProcessedEventId: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const cursorDoc = await ctx.db
      .query('workosEventsCursor')
      .withIndex('by_key', (q) => q.eq('key', 'main'))
      .unique();

    if (!cursorDoc) {
      return null;
    }

    return {
      cursor: cursorDoc.cursor,
      lastPolledAt: cursorDoc.lastPolledAt,
      lastProcessedEventId: cursorDoc.lastProcessedEventId,
    };
  },
});

/**
 * Check if an event has already been processed (idempotency check).
 */
export const isEventProcessed = internalQuery({
  args: {
    eventId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, { eventId }) => {
    const existing = await ctx.db
      .query('workosProcessedEvents')
      .withIndex('by_event_id', (q) => q.eq('eventId', eventId))
      .unique();

    return existing !== null;
  },
});

/**
 * Get recent processed events (for debugging).
 */
export const getRecentProcessedEvents = internalQuery({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      eventId: v.string(),
      eventType: v.string(),
      processedAt: v.number(),
    }),
  ),
  handler: async (ctx, { limit = 50 }) => {
    const events = await ctx.db.query('workosProcessedEvents').order('desc').take(limit);

    return events.map((e) => ({
      eventId: e.eventId,
      eventType: e.eventType,
      processedAt: e.processedAt,
    }));
  },
});
