import { v } from 'convex/values';
import { protectedAdminQuery } from '../functions';
import { languageValidator } from '../schema';

/**
 * List all profiles with optional filters
 */
export const listProfiles = protectedAdminQuery({
  args: {
    enabled: v.optional(v.boolean()),
    domain: v.optional(v.string()),
    lang: v.optional(languageValidator),
  },
  returns: v.array(
    v.object({
      _id: v.id('profiles'),
      siteId: v.string(),
      domain: v.string(),
      lang: languageValidator,
      timezone: v.string(),
      version: v.number(),
      enabled: v.boolean(),
      notes: v.optional(v.string()),
      updatedAt: v.number(),
      sourcesCount: v.number(),
    }),
  ),
  async handler(ctx, args) {
    let profiles = await ctx.db.query('profiles').collect();

    // Apply filters
    if (args.enabled !== undefined) {
      profiles = profiles.filter((p) => p.enabled === args.enabled);
    }
    if (args.domain) {
      profiles = profiles.filter((p) => p.domain.toLowerCase().includes(args.domain!.toLowerCase()));
    }
    if (args.lang) {
      profiles = profiles.filter((p) => p.lang === args.lang);
    }

    // Fetch source counts for each profile
    const results = await Promise.all(
      profiles.map(async (profile) => {
        const sources = await ctx.db
          .query('sources')
          .filter((q) => q.eq(q.field('profileId'), profile._id))
          .collect();

        return {
          _id: profile._id,
          siteId: profile.siteId,
          domain: profile.domain,
          lang: profile.lang,
          timezone: profile.timezone,
          version: profile.version,
          enabled: profile.enabled,
          notes: profile.notes,
          updatedAt: profile.updatedAt,
          sourcesCount: sources.length,
        };
      }),
    );

    return results;
  },
});

/**
 * Get single profile by ID
 */
export const getProfile = protectedAdminQuery({
  args: {
    profileId: v.id('profiles'),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id('profiles'),
      siteId: v.string(),
      domain: v.string(),
      lang: languageValidator,
      timezone: v.string(),
      config: v.any(),
      version: v.number(),
      enabled: v.boolean(),
      notes: v.optional(v.string()),
      updatedAt: v.number(),
    }),
  ),
  async handler(ctx, args) {
    const profile = await ctx.db.get(args.profileId);
    if (!profile) {
      return null;
    }

    return {
      _id: profile._id,
      siteId: profile.siteId,
      domain: profile.domain,
      lang: profile.lang,
      timezone: profile.timezone,
      config: profile.config,
      version: profile.version,
      enabled: profile.enabled,
      notes: profile.notes,
      updatedAt: profile.updatedAt,
    };
  },
});

/**
 * List all sources using a specific profile
 */
export const getSourcesByProfile = protectedAdminQuery({
  args: {
    profileId: v.id('profiles'),
  },
  returns: v.array(
    v.object({
      _id: v.id('sources'),
      url: v.string(),
      name: v.optional(v.string()),
      enabled: v.boolean(),
    }),
  ),
  async handler(ctx, args) {
    const sources = await ctx.db
      .query('sources')
      .filter((q) => q.eq(q.field('profileId'), args.profileId))
      .collect();

    return sources.map((source) => ({
      _id: source._id,
      url: source.url,
      name: source.name,
      enabled: source.enabled,
    }));
  },
});
