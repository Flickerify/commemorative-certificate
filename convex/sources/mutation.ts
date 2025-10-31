import { ConvexError, v } from 'convex/values';
import { protectedAdminMutation } from '../functions';
import { entityTypeValidator, languageValidator, ENTITY_TYPES, LANGUAGES } from '../schema';
import { Id } from '../_generated/dataModel';

type EntityType = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES];
type LanguageType = (typeof LANGUAGES)[keyof typeof LANGUAGES];
/**
 * Compute hash from URL for deduplication using Web Crypto API
 */
async function computeUrlHash(url: string): Promise<string> {
  const normalizedUrl = url.trim().toLowerCase();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalizedUrl);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex.substring(0, 16);
}

/**
 * Validate URL format
 */
function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create new source
 */
export const createSource = protectedAdminMutation({
  args: {
    url: v.string(),
    name: v.optional(v.string()),
    entityType: v.optional(entityTypeValidator),
    locationId: v.optional(v.id('locations')),
    lang: v.optional(languageValidator),
    enabled: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  returns: v.id('sources'),
  async handler(ctx, args) {
    // Validate URL
    if (!validateUrl(args.url)) {
      throw new ConvexError('Invalid URL format');
    }

    // Check for duplicate by hash
    const hash = await computeUrlHash(args.url);
    const existing = await ctx.db
      .query('sources')
      .withIndex('by_hash', (q) => q.eq('hash', hash))
      .first();

    if (existing) {
      throw new ConvexError('Source with this URL already exists');
    }

    // Validate location exists if provided
    if (args.locationId) {
      const location = await ctx.db.get(args.locationId);
      if (!location) {
        throw new ConvexError('Location not found');
      }
    }

    const now = Date.now();
    const sourceId = await ctx.db.insert('sources', {
      url: args.url.trim(),
      name: args.name?.trim(),
      entityType: args.entityType,
      locationId: args.locationId,
      lang: args.lang,
      enabled: args.enabled ?? true,
      hash,
      notes: args.notes?.trim(),
      updatedAt: now,
    });

    return sourceId;
  },
});

/**
 * Update source fields
 */
export const updateSource = protectedAdminMutation({
  args: {
    sourceId: v.id('sources'),
    url: v.optional(v.string()),
    name: v.optional(v.string()),
    entityType: v.optional(entityTypeValidator),
    locationId: v.optional(v.union(v.id('locations'), v.null())),
    lang: v.optional(languageValidator),
    enabled: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      throw new ConvexError('Source not found');
    }

    const updates: {
      url?: string;
      name?: string;
      entityType?: EntityType;
      locationId?: Id<'locations'> | undefined;
      lang?: LanguageType;
      enabled?: boolean;
      hash?: string;
      notes?: string;
      updatedAt: number;
    } = {
      updatedAt: Date.now(),
    };

    // If URL changed, validate and update hash
    if (args.url !== undefined) {
      if (!validateUrl(args.url)) {
        throw new ConvexError('Invalid URL format');
      }
      const newHash = await computeUrlHash(args.url);
      // Check for duplicate by hash (excluding current source)
      const existing = await ctx.db
        .query('sources')
        .withIndex('by_hash', (q) => q.eq('hash', newHash))
        .first();

      if (existing && existing._id !== args.sourceId) {
        throw new ConvexError('Source with this URL already exists');
      }
      updates.url = args.url.trim();
      updates.hash = newHash;
    }

    if (args.name !== undefined) {
      updates.name = args.name?.trim();
    }
    if (args.entityType !== undefined) {
      updates.entityType = args.entityType;
    }
    if (args.locationId !== undefined) {
      if (args.locationId === null) {
        // Remove locationId by omitting it from updates
        // Don't include locationId in the patch
      } else {
        // Validate location exists
        const location = await ctx.db.get(args.locationId);
        if (!location) {
          throw new ConvexError('Location not found');
        }
        updates.locationId = args.locationId;
      }
    }
    if (args.lang !== undefined) {
      updates.lang = args.lang;
    }
    if (args.enabled !== undefined) {
      updates.enabled = args.enabled;
    }
    if (args.notes !== undefined) {
      updates.notes = args.notes?.trim();
    }

    // Handle locationId removal separately if needed
    if (args.locationId === null) {
      await ctx.db.patch(args.sourceId, {
        ...updates,
        locationId: undefined,
      });
    } else {
      await ctx.db.patch(args.sourceId, updates);
    }
    return null;
  },
});

/**
 * Delete source
 */
export const deleteSource = protectedAdminMutation({
  args: {
    sourceId: v.id('sources'),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      throw new ConvexError('Source not found');
    }

    // Note: We don't cascade delete docs/events - they can be cleaned up separately
    await ctx.db.delete(args.sourceId);
    return null;
  },
});

/**
 * Enable/disable source
 */
export const toggleSourceEnabled = protectedAdminMutation({
  args: {
    sourceId: v.id('sources'),
    enabled: v.boolean(),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      throw new ConvexError('Source not found');
    }

    await ctx.db.patch(args.sourceId, {
      enabled: args.enabled,
      updatedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Assign profile to source
 */
export const assignProfileToSource = protectedAdminMutation({
  args: {
    sourceId: v.id('sources'),
    profileId: v.union(v.id('profiles'), v.null()),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      throw new ConvexError('Source not found');
    }

    if (args.profileId !== null) {
      const profile = await ctx.db.get(args.profileId);
      if (!profile) {
        throw new ConvexError('Profile not found');
      }
    }

    await ctx.db.patch(args.sourceId, {
      profileId: args.profileId || undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});
