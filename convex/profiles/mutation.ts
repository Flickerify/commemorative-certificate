import { ConvexError, v } from 'convex/values';
import { protectedAdminMutation } from '../functions';
import { languageValidator, LANGUAGES } from '../schema';

type Language = (typeof LANGUAGES)[keyof typeof LANGUAGES];

/**
 * Create new profile
 */
export const createProfile = protectedAdminMutation({
  args: {
    siteId: v.string(),
    domain: v.string(),
    lang: languageValidator,
    timezone: v.string(),
    config: v.any(),
    enabled: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  async handler(ctx, args) {
    // Check for duplicate siteId
    const existing = await ctx.db
      .query('profiles')
      .withIndex('by_site', (q) => q.eq('siteId', args.siteId))
      .first();

    if (existing) {
      throw new ConvexError('Profile with this site ID already exists');
    }

    // Validate config is valid JSON (basic check)
    if (args.config === null || typeof args.config !== 'object') {
      throw new ConvexError('Config must be a valid JSON object');
    }

    const now = Date.now();
    const profileId = await ctx.db.insert('profiles', {
      siteId: args.siteId.trim(),
      domain: args.domain.trim(),
      lang: args.lang,
      config: args.config,
      version: 1,
      enabled: args.enabled ?? true,
      notes: args.notes?.trim(),
      updatedAt: now,
    });

    return profileId;
  },
});

/**
 * Update profile (increments version)
 */
export const updateProfile = protectedAdminMutation({
  args: {
    profileId: v.id('profiles'),
    siteId: v.optional(v.string()),
    domain: v.optional(v.string()),
    lang: v.optional(languageValidator),
    timezone: v.optional(v.string()),
    config: v.optional(v.any()),
    enabled: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const profile = await ctx.db.get(args.profileId);
    if (!profile) {
      throw new ConvexError('Profile not found');
    }

    const updates: {
      siteId?: string;
      domain?: string;
      lang?: Language;
      timezone?: string;
      config?: any;
      version?: number;
      enabled?: boolean;
      notes?: string;
      updatedAt: number;
    } = {
      updatedAt: Date.now(),
    };

    if (args.siteId !== undefined) {
      // Check for duplicate siteId (excluding current profile)
      const siteId = args.siteId;
      const existing = await ctx.db
        .query('profiles')
        .withIndex('by_site', (q) => q.eq('siteId', siteId))
        .first();

      if (existing && existing._id !== args.profileId) {
        throw new ConvexError('Profile with this site ID already exists');
      }
      updates.siteId = args.siteId.trim();
    }

    if (args.domain !== undefined) {
      updates.domain = args.domain.trim();
    }
    if (args.lang !== undefined) {
      updates.lang = args.lang;
    }
    if (args.timezone !== undefined) {
      updates.timezone = args.timezone;
    }
    if (args.config !== undefined) {
      // Validate config is valid JSON
      if (args.config === null || typeof args.config !== 'object') {
        throw new ConvexError('Config must be a valid JSON object');
      }
      updates.config = args.config;
      // Increment version when config changes
      updates.version = profile.version + 1;
    }
    if (args.enabled !== undefined) {
      updates.enabled = args.enabled;
    }
    if (args.notes !== undefined) {
      updates.notes = args.notes?.trim();
    }

    await ctx.db.patch(args.profileId, updates);
  },
});

/**
 * Delete profile (check for sources using it)
 */
export const deleteProfile = protectedAdminMutation({
  args: {
    profileId: v.id('profiles'),
  },
  async handler(ctx, args) {
    const profile = await ctx.db.get(args.profileId);
    if (!profile) {
      throw new ConvexError('Profile not found');
    }

    // Check if any sources are using this profile
    const sources = await ctx.db
      .query('sources')
      .filter((q) => q.eq(q.field('profileId'), args.profileId))
      .collect();

    if (sources.length > 0) {
      throw new ConvexError(
        `Cannot delete profile: ${sources.length} source(s) are using it. Unassign the profile from all sources first.`,
      );
    }

    await ctx.db.delete(args.profileId);
  },
});

/**
 * Enable/disable profile
 */
export const toggleProfileEnabled = protectedAdminMutation({
  args: {
    profileId: v.id('profiles'),
    enabled: v.boolean(),
  },
  async handler(ctx, args) {
    const profile = await ctx.db.get(args.profileId);
    if (!profile) {
      throw new ConvexError('Profile not found');
    }

    await ctx.db.patch(args.profileId, {
      enabled: args.enabled,
      updatedAt: Date.now(),
    });
  },
});
