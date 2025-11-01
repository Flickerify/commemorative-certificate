/**
 * CSV column mapping configuration for location imports
 * Each country can have a different CSV format
 */
export interface CsvColumnMapping {
  /** Column name in CSV header */
  column: string;
  /** Optional transformation function */
  transform?: (value: string) => string | number | undefined;
}

export interface LocationImportConfig {
  /** ISO 3166-1 alpha-2 country code */
  country: string;
  /** Mapping of location fields to CSV columns */
  mapping: {
    /** External ID column (used for deduplication) */
    externalId: CsvColumnMapping;
    /** Region column (canton, state, province, etc.) */
    region?: CsvColumnMapping;
    /** Sub-region column (commune, city, district, etc.) */
    subRegion?: CsvColumnMapping;
    /** City column (city, town, village, etc.) */
    city?: CsvColumnMapping;
    /** Longitude column */
    longitude: CsvColumnMapping;
    /** Latitude column */
    latitude: CsvColumnMapping;
    /** Optional postal code column */
    postalCode?: CsvColumnMapping;
    /** Optional language column */
    language?: CsvColumnMapping;
  };
  /** Default timezone for the country */
  defaultTimezone: string;
  /** Optional function to determine timezone from coordinates */
  timezoneResolver?: (lat: number, lng: number) => string;
  /** CSV delimiter (default: ',') */
  delimiter?: string;
}
