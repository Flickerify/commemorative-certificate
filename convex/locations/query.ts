import { v } from 'convex/values';
import { publicQuery } from '../functions';

/**
 * Query locations by country
 */
export const listByCountry = publicQuery({
  args: {
    country: v.string(),
  },
  async handler(ctx, args) {
    return await ctx.db
      .query('locations')
      .withIndex('by_country', (q) => q.eq('country', args.country))
      .collect();
  },
});

/**
 * Query locations by country and region
 */
export const listByCountryAndRegion = publicQuery({
  args: {
    country: v.string(),
    region: v.string(),
  },
  async handler(ctx, args) {
    return await ctx.db
      .query('locations')
      .withIndex('by_country_region', (q) => q.eq('country', args.country).eq('region', args.region))
      .collect();
  },
});

/**
 * Get location by external ID
 */
export const getByExternalId = publicQuery({
  args: {
    externalId: v.string(),
  },
  async handler(ctx, args) {
    return await ctx.db
      .query('locations')
      .withIndex('by_external', (q) => q.eq('externalId', args.externalId))
      .first();
  },
});

/**
 * Get top locations without sources (for combobox)
 */
export const listWithoutSources = publicQuery({
  args: {
    country: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id('locations'),
      country: v.string(),
      region: v.optional(v.string()),
      subRegion: v.optional(v.string()),
      postalCode: v.optional(v.string()),
      externalId: v.optional(v.string()),
    }),
  ),
  async handler(ctx, args) {
    const limit = args.limit ?? 100;

    const allLocations = args.country
      ? await ctx.db
          .query('locations')
          .withIndex('by_country', (q) => q.eq('country', args.country!))
          .collect()
      : await ctx.db.query('locations').collect();

    // Get all sources with locationId
    const sourcesWithLocation = await ctx.db
      .query('sources')
      .filter((q) => q.neq(q.field('locationId'), undefined))
      .collect();

    const usedLocationIds = new Set(sourcesWithLocation.map((s) => s.locationId).filter(Boolean));

    // Filter out locations that have sources
    const locationsWithoutSources = allLocations.filter((loc) => !usedLocationIds.has(loc._id)).slice(0, limit);

    return locationsWithoutSources.map((loc) => ({
      _id: loc._id,
      country: loc.country,
      region: loc.region,
      subRegion: loc.subRegion,
      postalCode: loc.postalCode,
      externalId: loc.externalId,
    }));
  },
});

/**
 * Search locations by text fields (country, region, subRegion, postalCode, externalId, notes)
 */
export const searchLocations = publicQuery({
  args: {
    search: v.string(),
    country: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id('locations'),
      country: v.string(),
      region: v.optional(v.string()),
      subRegion: v.optional(v.string()),
      postalCode: v.optional(v.string()),
      externalId: v.optional(v.string()),
    }),
  ),
  async handler(ctx, args) {
    const limit = args.limit ?? 100;
    const searchLower = args.search.toLowerCase().trim();
    const country = args.country;

    if (!searchLower) {
      const allLocations = country
        ? await ctx.db
            .query('locations')
            .withIndex('by_country', (q) => q.eq('country', country))
            .collect()
        : await ctx.db.query('locations').collect();

      return allLocations.slice(0, limit).map((loc) => ({
        _id: loc._id,
        country: loc.country,
        region: loc.region,
        subRegion: loc.subRegion,
        postalCode: loc.postalCode,
        externalId: loc.externalId,
      }));
    }

    const allLocations = await ctx.db
      .query('locations')
      .withSearchIndex('search_city', (q) => {
        let searchQuery = q.search('subRegion', searchLower);

        if (country) {
          searchQuery = searchQuery.eq('country', country);
        }

        return searchQuery;
      })
      .collect();

    return allLocations.map((loc) => ({
      _id: loc._id,
      country: loc.country,
      region: loc.region,
      subRegion: loc.subRegion,
      postalCode: loc.postalCode,
      externalId: loc.externalId,
    }));
  },
});
