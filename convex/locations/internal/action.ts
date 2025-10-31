'use node';

import { ConvexError, v } from 'convex/values';
import { internalAction } from '../../functions';
import { internal } from '../../_generated/api';
import type { LocationImportConfig } from '../types';
import { getCountryConfig } from '../configs';
import { parseCsvHeader, parseCsvLine, getTimezoneFromCoordinates } from '../utils';

interface ImportResult {
  total: number;
  created: number;
  updated: number;
  errors: number;
  errorMessages: string[];
}

/**
 * Import locations from CSV text
 */
export const importLocationsFromCsv = internalAction({
  args: {
    csvText: v.string(),
    country: v.string(),
  },
  async handler(ctx, args): Promise<ImportResult> {
    const config = getCountryConfig(args.country);
    if (!config) {
      throw new ConvexError(`No import configuration found for country: ${args.country}`);
    }

    const delimiter = config.delimiter || ',';
    const lines = args.csvText.split('\n').filter((line) => line.trim().length > 0);

    if (lines.length < 2) {
      throw new ConvexError('CSV must have at least a header and one data row');
    }

    // Parse header
    const headerLine = lines[0];
    const columnMap = parseCsvHeader(headerLine, delimiter);

    // Get column indices
    const getColumnIndex = (columnName: string): number => {
      const index = columnMap.get(columnName);
      if (index === undefined) {
        throw new ConvexError(`Column not found: ${columnName}`);
      }
      return index;
    };

    const externalIdIndex = getColumnIndex(config.mapping.externalId.column);
    const regionIndex = config.mapping.region ? getColumnIndex(config.mapping.region.column) : undefined;
    const subRegionIndex = config.mapping.subRegion ? getColumnIndex(config.mapping.subRegion.column) : undefined;
    const longitudeIndex = getColumnIndex(config.mapping.longitude.column);
    const latitudeIndex = getColumnIndex(config.mapping.latitude.column);

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
        const values = parseCsvLine(line, delimiter);

        // Extract values
        const externalIdValue = values[externalIdIndex]?.trim() || '';
        const externalId = config.mapping.externalId.transform
          ? config.mapping.externalId.transform(externalIdValue)
          : externalIdValue;

        if (!externalId || externalId === '') {
          result.errors++;
          result.errorMessages.push(`Row ${i + 1}: Missing externalId`);
          continue;
        }

        const longitudeValue = values[longitudeIndex]?.trim() || '';
        const longitude = config.mapping.longitude.transform
          ? config.mapping.longitude.transform(longitudeValue)
          : parseFloat(longitudeValue);

        const latitudeValue = values[latitudeIndex]?.trim() || '';
        const latitude = config.mapping.latitude.transform
          ? config.mapping.latitude.transform(latitudeValue)
          : parseFloat(latitudeValue);

        if (typeof longitude !== 'number' || isNaN(longitude)) {
          result.errors++;
          result.errorMessages.push(`Row ${i + 1}: Invalid longitude: ${longitudeValue}`);
          continue;
        }

        if (typeof latitude !== 'number' || isNaN(latitude)) {
          result.errors++;
          result.errorMessages.push(`Row ${i + 1}: Invalid latitude: ${latitudeValue}`);
          continue;
        }

        const region =
          regionIndex !== undefined && values[regionIndex]
            ? config.mapping.region?.transform
              ? config.mapping.region.transform(values[regionIndex])
              : values[regionIndex].trim()
            : undefined;

        const subRegion =
          subRegionIndex !== undefined && values[subRegionIndex]
            ? config.mapping.subRegion?.transform
              ? config.mapping.subRegion.transform(values[subRegionIndex])
              : values[subRegionIndex].trim()
            : undefined;

        // Determine timezone
        const timezone = config.timezoneResolver
          ? config.timezoneResolver(latitude as number, longitude as number)
          : getTimezoneFromCoordinates(latitude as number, longitude as number, config.defaultTimezone);

        // Build notes
        const notesParts: string[] = [];
        if (config.mapping.postalCode && values[getColumnIndex(config.mapping.postalCode.column)]) {
          const postalCode = config.mapping.postalCode.transform
            ? config.mapping.postalCode.transform(values[getColumnIndex(config.mapping.postalCode.column)])
            : values[getColumnIndex(config.mapping.postalCode.column)].trim();
          notesParts.push(`Postal Code: ${postalCode}`);
        }

        // Upsert location
        const upsertResult = await ctx.runMutation(internal.locations.internal.mutation.upsertLocation, {
          country: config.country,
          region: typeof region === 'string' ? region : undefined,
          subRegion: typeof subRegion === 'string' ? subRegion : undefined,
          timezone,
          externalId: typeof externalId === 'string' ? externalId : String(externalId),
          notes: notesParts.length > 0 ? notesParts.join('; ') : undefined,
        });

        if (upsertResult.created) {
          result.created++;
        } else {
          result.updated++;
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
