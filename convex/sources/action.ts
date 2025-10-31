'use node';

import { ConvexError, v } from 'convex/values';
import { protectedAdminAction } from '../functions';
import { internal, api } from '../_generated/api';
import { entityTypeValidator, languageValidator, ENTITY_TYPES, LANGUAGES } from '../schema';
import { Id } from '../_generated/dataModel';

type EntityType = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES];
type LanguageType = (typeof LANGUAGES)[keyof typeof LANGUAGES];

interface ImportResult {
  total: number;
  created: number;
  updated: number;
  errors: number;
  errorMessages: string[];
}

/**
 * Import sources from CSV/TSV text
 */
export const importSourcesFromText = protectedAdminAction({
  args: {
    csvText: v.string(),
    delimiter: v.optional(v.string()), // Default to tab for TSV, comma for CSV
  },
  returns: v.object({
    total: v.number(),
    created: v.number(),
    updated: v.number(),
    errors: v.number(),
    errorMessages: v.array(v.string()),
  }),
  async handler(ctx, args): Promise<ImportResult> {
    const delimiter = args.delimiter || (args.csvText.includes('\t') ? '\t' : ',');
    const lines = args.csvText.split('\n').filter((line) => line.trim().length > 0);

    if (lines.length < 2) {
      throw new ConvexError('CSV must have at least a header and one data row');
    }

    // Parse header
    const headerLine = lines[0];
    const headerColumns = headerLine.split(delimiter).map((col) => col.trim().toLowerCase());
    const columnMap = new Map<string, number>();
    headerColumns.forEach((col, idx) => {
      columnMap.set(col, idx);
    });

    // Expected columns (flexible matching)
    const getColumnIndex = (possibleNames: string[]): number | undefined => {
      for (const name of possibleNames) {
        const index = columnMap.get(name.toLowerCase());
        if (index !== undefined) return index;
      }
      return undefined;
    };

    const urlIndex = getColumnIndex(['url', 'website', 'link']);
    const nameIndex = getColumnIndex(['name', 'title', 'entity']);
    const entityTypeIndex = getColumnIndex(['type', 'entitytype', 'kind']);
    const locationIdIndex = getColumnIndex(['locationid', 'location_id']);
    const langIndex = getColumnIndex(['language', 'lang', 'sprache']);
    const enabledIndex = getColumnIndex(['enabled', 'active']);

    if (urlIndex === undefined) {
      throw new ConvexError('CSV must contain a URL column (url, website, or link)');
    }

    const result: ImportResult = {
      total: lines.length - 1, // Exclude header
      created: 0,
      updated: 0,
      errors: 0,
      errorMessages: [],
    };

    // Process each data row
    for (let i = 1; i < lines.length; i++) {
      try {
        const line = lines[i];
        const values = line.split(delimiter).map((v) => v.trim());

        // Extract URL (required)
        const url = values[urlIndex]?.trim();
        if (!url) {
          result.errors++;
          result.errorMessages.push(`Row ${i + 1}: Missing URL`);
          continue;
        }

        // Validate URL format
        try {
          new URL(url);
        } catch {
          result.errors++;
          result.errorMessages.push(`Row ${i + 1}: Invalid URL format: ${url}`);
          continue;
        }

        // Extract optional fields
        const name = nameIndex !== undefined ? values[nameIndex]?.trim() : undefined;
        const entityTypeStr = entityTypeIndex !== undefined ? values[entityTypeIndex]?.trim().toLowerCase() : undefined;
        const locationIdStr = locationIdIndex !== undefined ? values[locationIdIndex]?.trim() : undefined;
        const langStr = langIndex !== undefined ? values[langIndex]?.trim().toLowerCase() : undefined;
        const enabledStr = enabledIndex !== undefined ? values[enabledIndex]?.trim().toLowerCase() : undefined;

        // Validate and transform entity type
        let entityType: EntityType | undefined;
        if (entityTypeStr) {
          entityType = entityTypeStr as EntityType;
        }

        // Validate location ID if provided
        let locationId: string | undefined;
        if (locationIdStr) {
          // Try to find location by external ID
          // getByExternalId is a public query, so we use api instead of internal
          const location = await ctx.runQuery(api.locations.query.getByExternalId, {
            externalId: locationIdStr,
          });
          if (location) {
            locationId = location._id;
          } else {
            result.errors++;
            result.errorMessages.push(`Row ${i + 1}: Location not found: ${locationIdStr}`);
            continue;
          }
        }

        // боль валидация language
        let lang: LanguageType | undefined;
        if (langStr) {
          lang = langStr as LanguageType;
        }

        // Parse enabled flag
        const enabled =
          enabledStr === undefined ? true : enabledStr === 'true' || enabledStr === '1' || enabledStr === 'yes';

        // Compute hash for deduplication
        const hash = await ctx.runMutation(internal.sources.internal.mutation.computeHash, { url });

        // Check if source exists
        const existing = await ctx.runQuery(internal.sources.internal.query.findByHash, { hash });

        if (existing) {
          // Update existing source
          await ctx.runMutation(internal.sources.internal.mutation.updateSource, {
            sourceId: existing._id,
            name,
            entityType,
            locationId: locationId ? (locationId as Id<'locations'>) : undefined,
            lang: lang,
            enabled,
          });
          result.updated++;
        } else {
          // Create new source
          await ctx.runMutation(internal.sources.internal.mutation.createSource, {
            url,
            name,
            entityType,
            locationId: locationId ? (locationId as Id<'locations'>) : undefined,
            lang: lang,
            enabled,
          });
          result.created++;
        }
      } catch (error) {
        result.errors++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errorMessages.push(`Row ${i + 1}: ${errorMessage}`);
      }
    }

    return result;
  },
});
