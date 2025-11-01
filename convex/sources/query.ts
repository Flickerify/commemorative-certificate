import { v } from 'convex/values';
import { protectedAdminQuery } from '../functions';
import { entityTypeValidator, languageValidator } from '../schema';
import { Doc } from '../_generated/dataModel';

/**
 * List all sources with optional filters
 */
export const listSources = protectedAdminQuery({
  args: {
    enabled: v.optional(v.boolean()),
    locationId: v.optional(v.id('locations')),
    entityType: v.optional(entityTypeValidator),
    lang: v.optional(languageValidator),
  },
  async handler(ctx, args) {
    let query = ctx.db.query('sources');

    // Apply filters
    let sources;
    if (args.enabled !== undefined) {
      const enabled = args.enabled;
      sources = await query.withIndex('by_enabled', (q) => q.eq('enabled', enabled)).collect();
    } else {
      // If no enabled filter, collect all
      sources = await query.collect();
    }

    // Apply additional filters
    const filtered = sources.filter((source) => {
      if (args.locationId && source.locationId !== args.locationId) return false;
      if (args.entityType && source.entityType !== args.entityType) return false;
      if (args.lang && source.lang !== args.lang) return false;
      return true;
    });

    // Fetch related data
    const results = await Promise.all(
      filtered.map(async (source) => {
        let location: Doc<'locations'> | null = null;
        let profile: Doc<'profiles'> | null = null;

        if (source.locationId) {
          location = await ctx.db.get(source.locationId);
        }

        if (source.profileId) {
          profile = await ctx.db.get(source.profileId);
        }

        return {
          _id: source._id,
          url: source.url,
          name: source.name,
          entityType: source.entityType,
          location,
          lang: source.lang,
          profile,
          enabled: source.enabled,
          hash: source.hash,
          lastFetchAt: source.lastFetchAt,
          etag: source.etag,
          lastModified: source.lastModified,
          notes: source.notes,
          updatedAt: source.updatedAt,
        };
      }),
    );

    return results;
  },
});

/**
 * Get single source by ID with related profile and location data
 */
export const getSource = protectedAdminQuery({
  args: {
    sourceId: v.id('sources'),
  },
  async handler(ctx, args) {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      return null;
    }

    // Fetch related location
    let location;
    if (source.locationId) {
      const loc = await ctx.db.get(source.locationId);
      if (loc) {
        location = {
          _id: loc._id,
          country: loc.country,
          region: loc.region,
          subRegion: loc.subRegion,
        };
      }
    }

    // Fetch related profile
    let profile;
    if (source.profileId) {
      const prof = await ctx.db.get(source.profileId);
      if (prof) {
        profile = {
          _id: prof._id,
          sourceId: prof.sourceId,
          domain: prof.domain,
          lang: prof.lang,
        };
      }
    }

    // Count docs for this source
    const docs = await ctx.db
      .query('docs')
      .withIndex('by_source', (q) => q.eq('sourceId', args.sourceId))
      .collect();
    const docCount = docs.length;

    // Count events for this source (by sourceUrl)
    const events = await ctx.db
      .query('events')
      .filter((q) => q.eq(q.field('sourceUrl'), source.url))
      .collect();
    const eventCount = events.length;

    return {
      _id: source._id,
      url: source.url,
      name: source.name,
      entityType: source.entityType,
      locationId: source.locationId,
      lang: source.lang,
      profileId: source.profileId,
      enabled: source.enabled,
      hash: source.hash,
      lastFetchAt: source.lastFetchAt,
      etag: source.etag,
      lastModified: source.lastModified,
      notes: source.notes,
      updatedAt: source.updatedAt,
      location,
      profile,
      docCount,
      eventCount,
    };
  },
});

/**
 * Get source statistics (doc count, last fetch, run history)
 */
export const getSourceStats = protectedAdminQuery({
  args: {
    sourceId: v.id('sources'),
  },
  async handler(ctx, args) {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      throw new Error('Source not found');
    }

    // Count docs
    const docs = await ctx.db
      .query('docs')
      .withIndex('by_source', (q) => q.eq('sourceId', args.sourceId))
      .collect();
    const docCount = docs.length;

    // Get recent runs (last 10)
    const runs = await ctx.db
      .query('runs')
      .withIndex('by_ref', (q) => q.eq('ref', args.sourceId))
      .order('desc')
      .take(10);

    return {
      docCount,
      lastFetchAt: source.lastFetchAt,
      recentRuns: runs.map((run) => ({
        _id: run._id,
        kind: run.kind,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        ok: run.ok,
        error: run.error,
      })),
    };
  },
});
