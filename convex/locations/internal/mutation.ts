import { v } from 'convex/values';
import { internalMutation } from '../../functions';

/**
 * Upsert a single location with deduplication based on externalId
 */
export const upsertLocation = internalMutation({
  args: {
    country: v.string(),
    region: v.optional(v.string()),
    subRegion: v.optional(v.string()),
    timezone: v.string(),
    externalId: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const now = Date.now();

    // Try to find existing location by externalId if provided
    if (args.externalId) {
      const existing = await ctx.db
        .query('locations')
        .withIndex('by_external', (q) => q.eq('externalId', args.externalId))
        .first();

      if (existing) {
        // Update existing location
        await ctx.db.patch(existing._id, {
          country: args.country,
          region: args.region,
          subRegion: args.subRegion,
          timezone: args.timezone,
          notes: args.notes,
          updatedAt: now,
        });
        return { id: existing._id, created: false };
      }
    }

    // Create new location
    const id = await ctx.db.insert('locations', {
      country: args.country,
      region: args.region,
      subRegion: args.subRegion,
      timezone: args.timezone,
      externalId: args.externalId,
      notes: args.notes,
      updatedAt: now,
    });

    return { id, created: true };
  },
});
