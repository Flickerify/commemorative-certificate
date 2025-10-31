import { v } from 'convex/values';
import { internalMutation } from '../../functions';
import { entityTypeValidator, languageValidator, ENTITY_TYPES, LANGUAGES } from '../../schema';
import { Id } from '../../_generated/dataModel';

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
 * Compute hash (exposed as mutation for action use)
 */
export const computeHash = internalMutation({
  args: {
    url: v.string(),
  },
  returns: v.string(),
  async handler(ctx, args) {
    return await computeUrlHash(args.url);
  },
});

/**
 * Create source (internal version, used by import action)
 */
export const createSource = internalMutation({
  args: {
    url: v.string(),
    name: v.optional(v.string()),
    entityType: v.optional(entityTypeValidator),
    locationId: v.optional(v.id('locations')),
    lang: v.optional(languageValidator),
    enabled: v.boolean(),
  },
  returns: v.id('sources'),
  async handler(ctx, args) {
    if (!validateUrl(args.url)) {
      throw new Error('Invalid URL format');
    }

    const hash = await computeUrlHash(args.url);
    const now = Date.now();

    const sourceId = await ctx.db.insert('sources', {
      url: args.url.trim(),
      name: args.name?.trim(),
      entityType: args.entityType,
      locationId: args.locationId,
      lang: args.lang,
      enabled: args.enabled,
      hash,
      updatedAt: now,
    });

    return sourceId;
  },
});

/**
 * Update source (internal version, used by import action)
 */
export const updateSource = internalMutation({
  args: {
    sourceId: v.id('sources'),
    name: v.optional(v.string()),
    entityType: v.optional(entityTypeValidator),
    locationId: v.optional(v.id('locations')),
    lang: v.optional(languageValidator),
    enabled: v.optional(v.boolean()),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const updates: {
      name?: string;
      entityType?: EntityType;
      locationId?: Id<'locations'> | undefined;
      lang?: LanguageType;
      enabled?: boolean;
      updatedAt: number;
    } = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) {
      updates.name = args.name?.trim();
    }
    if (args.entityType !== undefined) {
      updates.entityType = args.entityType;
    }
    if (args.locationId !== undefined) {
      updates.locationId = args.locationId as Id<'locations'>;
    }
    if (args.lang !== undefined) {
      updates.lang = args.lang as LanguageType;
    }
    if (args.enabled !== undefined) {
      updates.enabled = args.enabled as boolean;
    }

    await ctx.db.patch(args.sourceId, updates);
    return null;
  },
});
