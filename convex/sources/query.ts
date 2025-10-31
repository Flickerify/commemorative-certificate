import { v } from 'convex/values';
import { protectedAdminQuery } from '../functions';
import { entityTypeValidator, languageValidator } from '../schema';

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
  returns: v.array(
    v.object({
      _id: v.id('sources'),
      url: v.string(),
      name: v.optional(v.string()),
      entityType: v.optional(entityTypeValidator),
      locationId: v.optional(v.id('locations')),
      lang: v.optional(languageValidator),
      profileId: v.optional(v.id('profiles')),
      enabled: v.boolean(),
      hash: v.string(),
      lastFetchAt: v.optional(v.number()),
      etag: v.optional(v.string()),
      lastModified: v.optional(v.string()),
      notes: v.optional(v.string()),
      updatedAt: v.number(),
      // Related data
      locationName: v.optional(v.string()),
      profileSiteId: v.optional(v.string()),
    }),
  ),
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
        let locationName: string | undefined;
        let profileSiteId: string | undefined;

        if (source.locationId) {
          const location = await ctx.db.get(source.locationId);
          if (location) {
            locationName = location.subRegion || location.region || location.country;
          }
        }

        if (source.profileId) {
          const profile = await ctx.db.get(source.profileId);
          if (profile) {
            profileSiteId = profile.siteId;
          }
        }

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
          locationName,
          profileSiteId,
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
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id('sources'),
      url: v.string(),
      name: v.optional(v.string()),
      entityType: v.optional(entityTypeValidator),
      locationId: v.optional(v.id('locations')),
      lang: v.optional(languageValidator),
      profileId: v.optional(v.id('profiles')),
      enabled: v.boolean(),
      hash: v.string(),
      lastFetchAt: v.optional(v.number()),
      etag: v.optional(v.string()),
      lastModified: v.optional(v.string()),
      notes: v.optional(v.string()),
      updatedAt: v.number(),
      // Related data
      location: v.optional(
        v.object({
          _id: v.id('locations'),
          country: v.string(),
          region: v.optional(v.string()),
          subRegion: v.optional(v.string()),
        }),
      ),
      profile: v.optional(
        v.object({
          _id: v.id('profiles'),
          siteId: v.string(),
          domain: v.string(),
          lang: languageValidator,
        }),
      ),
      docCount: v.number(),
      eventCount: v.number(),
    }),
  ),
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
          siteId: prof.siteId,
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
  returns: v.object({
    docCount: v.number(),
    lastFetchAt: v.optional(v.number()),
    recentRuns: v.array(
      v.object({
        _id: v.id('runs'),
        kind: v.string(),
        startedAt: v.number(),
        finishedAt: v.optional(v.number()),
        ok: v.optional(v.boolean()),
        error: v.optional(v.string()),
      }),
    ),
  }),
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
