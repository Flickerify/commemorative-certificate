import type { LocationImportConfig } from './types';

/**
 * Swiss location CSV format configuration
 * Format: Ortschaftsname;PLZ;Zusatzziffer;Gemeindename;BFS-Nr;Kantonskürzel;E;N;Sprache;Validity
 */
export const switzerlandConfig: LocationImportConfig = {
  country: 'CH',
  delimiter: ';',
  defaultTimezone: 'Europe/Zurich',
  mapping: {
    externalId: {
      column: 'BFS-Nr',
      transform: (value) => value.trim(),
    },
    region: {
      column: 'Kantonskürzel',
      transform: (value) => value.trim().toUpperCase(),
    },
    subRegion: {
      column: 'Gemeindename',
      transform: (value) => value.trim(),
    },
    longitude: {
      column: 'E',
      transform: (value) => {
        const num = parseFloat(value.trim());
        return isNaN(num) ? undefined : num;
      },
    },
    latitude: {
      column: 'N',
      transform: (value) => {
        const num = parseFloat(value.trim());
        return isNaN(num) ? undefined : num;
      },
    },
    postalCode: {
      column: 'PLZ',
      transform: (value) => value.trim(),
    },
    language: {
      column: 'Sprache',
      transform: (value) => value.trim().toLowerCase(),
    },
  },
};

/**
 * Registry of country-specific CSV import configurations
 */
export const countryConfigs: Record<string, LocationImportConfig> = {
  CH: switzerlandConfig,
};

/**
 * Get import configuration for a country
 */
export function getCountryConfig(country: string): LocationImportConfig | null {
  return countryConfigs[country.toUpperCase()] || null;
}
