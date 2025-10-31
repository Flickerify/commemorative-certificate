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
