'use node';

import { ConvexError, v } from 'convex/values';
import { internalAction } from '../../functions';
import { internal } from '../../_generated/api';
import { getCountryConfig } from '../configs';
import { parseCsvHeader, parseCsvLine, getTimezoneFromCoordinates, generateGeohash5, generateGeohash7 } from '../utils';
import { LANGUAGES } from '../../schema';

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
  returns: v.object({
    total: v.number(),
    created: v.number(),
    updated: v.number(),
    errors: v.number(),
    errorMessages: v.array(v.string()),
  }),
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
    const cityIndex = config.mapping.city ? getColumnIndex(config.mapping.city.column) : undefined;
    const longitudeIndex = getColumnIndex(config.mapping.longitude.column);
    const latitudeIndex = getColumnIndex(config.mapping.latitude.column);
    const postalCodeIndex = config.mapping.postalCode ? getColumnIndex(config.mapping.postalCode.column) : undefined;
    const languageIndex = config.mapping.language ? getColumnIndex(config.mapping.language.column) : undefined;

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

        const city =
          cityIndex !== undefined && values[cityIndex]
            ? config.mapping.city?.transform
              ? config.mapping.city.transform(values[cityIndex])
              : values[cityIndex].trim()
            : undefined;

        // Extract postal code
        let postalCode: string | undefined = undefined;
        if (postalCodeIndex !== undefined && values[postalCodeIndex]) {
          const postalCodeValue = config.mapping.postalCode?.transform
            ? config.mapping.postalCode.transform(values[postalCodeIndex])
            : values[postalCodeIndex].trim();
          postalCode = typeof postalCodeValue === 'string' ? postalCodeValue : undefined;
        }

        // Extract language
        let language: (typeof LANGUAGES)[keyof typeof LANGUAGES][] = [];
        if (languageIndex !== undefined && values[languageIndex]) {
          const languageValue = config.mapping.language?.transform
            ? config.mapping.language.transform(values[languageIndex])
            : values[languageIndex].trim().toLowerCase();
          const langStr = typeof languageValue === 'string' ? languageValue : String(languageValue);
          // Validate against allowed language values
          if (
            langStr === LANGUAGES.DE ||
            langStr === LANGUAGES.FR ||
            langStr === LANGUAGES.IT ||
            langStr === LANGUAGES.RM ||
            langStr === LANGUAGES.EN
          ) {
            language.push(langStr as (typeof LANGUAGES)[keyof typeof LANGUAGES]);
          }
        }

        // Determine timezone
        const timezone = config.timezoneResolver
          ? config.timezoneResolver(latitude as number, longitude as number)
          : getTimezoneFromCoordinates(latitude as number, longitude as number, config.defaultTimezone);

        // Generate geohashes
        const geohash5 = generateGeohash5(latitude as number, longitude as number);
        const geohash7 = generateGeohash7(latitude as number, longitude as number);

        // Build notes
        const notesParts: string[] = [];

        // Upsert location
        const upsertResult = await ctx.runMutation(internal.locations.internal.mutation.upsertLocation, {
          country: config.country,
          region: region?.toString(),
          subRegion: subRegion?.toString(),
          city: city?.toString(),
          postalCode,
          language,
          lat: latitude,
          lng: longitude,
          geohash5,
          geohash7,
          timezone,
          externalId: String(externalId),
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
