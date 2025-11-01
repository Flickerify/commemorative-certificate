import { v } from 'convex/values';
import { internalMutation } from '../../functions';
import { languageValidator } from '../../schema';
import slugify from 'slugify';

/**
 * Upsert a single location with deduplication based on externalId
 */
export const upsertLocation = internalMutation({
  args: {
    country: v.string(),
    region: v.optional(v.string()),
    subRegion: v.optional(v.string()),
    city: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    language: v.array(languageValidator),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    geohash5: v.optional(v.string()),
    geohash7: v.optional(v.string()),
    timezone: v.string(),
    externalId: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const now = Date.now();

    const slugName = slugify(
      `${args.country}-${args.region ? `${args.region}-` : ''}${args.subRegion ? `${args.subRegion}-` : ''}${args.city ? `${args.city}` : ''}${args.postalCode ? `${args.postalCode}` : ''}`,
      {
        lower: true,
        strict: true,
        locale: 'en',
        trim: true,
        replacement: '-',
      },
    );

    const existing = await ctx.db
      .query('locations')
      .withIndex('slugName', (q) => q.eq('slugName', slugName))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        country: args.country,
        region: args.region,
        subRegion: args.subRegion,
        city: args.city,
        postalCode: args.postalCode,
        language: args.language,
        lat: args.lat,
        lng: args.lng,
        geohash5: args.geohash5,
        geohash7: args.geohash7,
        timezone: args.timezone,
        notes: args.notes,
        updatedAt: now,
      });
      return { id: existing._id, created: false };
    }

    // Create new location
    const id = await ctx.db.insert('locations', {
      slugName,
      country: args.country,
      region: args.region,
      subRegion: args.subRegion,
      city: args.city,
      postalCode: args.postalCode,
      language: args.language,
      lat: args.lat,
      lng: args.lng,
      geohash5: args.geohash5,
      geohash7: args.geohash7,
      timezone: args.timezone,
      externalId: args.externalId,
      notes: args.notes,
      updatedAt: now,
    });

    return { id, created: true };
  },
});
