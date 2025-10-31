# Location Import Pipeline

A flexible CSV import pipeline for importing location data from different countries with deduplication support.

## Features

- **Country-specific configurations**: Each country can have its own CSV format mapping
- **Automatic deduplication**: Uses `externalId` to prevent duplicate locations
- **Flexible field mapping**: Configurable column mappings and transformations
- **Error handling**: Comprehensive error reporting with per-row error messages
- **Extensible**: Easy to add new country formats

## Usage

### Import from CSV Text

```typescript
import { api } from '@/convex/_generated/api';
import { useMutation } from 'convex/react';

const importLocations = useMutation(api.locations.action.importLocationsFromText);

const result = await importLocations({
  csvText: `Ortschaftsname;PLZ;BFS-Nr;Kantonskürzel;E;N;Sprache
Aeugst am Albis;8914;1;ZH;8.487911353880977;47.26870659169308;de`,
  country: 'CH',
});

console.log(result);
// {
//   total: 1,
//   created: 1,
//   updated: 0,
//   errors: 0,
//   errorMessages: []
// }
```

### Import from File Path

```typescript
import { api } from '@/convex/_generated/api';
import { useMutation } from 'convex/react';

const importLocations = useMutation(api.locations.action.importLocationsFromFile);

const result = await importLocations({
  filePath: '/path/to/AMTOVZ_CSV_WGS84.csv',
  country: 'CH',
});
```

## Adding New Country Formats

To add support for a new country:

1. Create a configuration in `convex/locations/configs.ts`:

```typescript
export const germanyConfig: LocationImportConfig = {
  country: 'DE',
  delimiter: ',',
  defaultTimezone: 'Europe/Berlin',
  mapping: {
    externalId: {
      column: 'AGS', // Amtlicher Gemeindeschlüssel
      transform: (value) => value.trim(),
    },
    region: {
      column: 'Bundesland',
      transform: (value) => value.trim(),
    },
    subRegion: {
      column: 'Gemeinde',
      transform: (value) => value.trim(),
    },
    longitude: {
      column: 'Longitude',
      transform: (value) => parseFloat(value.trim()),
    },
    latitude: {
      column: 'Latitude',
      transform: (value) => parseFloat(value.trim()),
    },
  },
};

// Add to registry
export const countryConfigs: Record<string, LocationImportConfig> = {
  CH: switzerlandConfig,
  DE: germanyConfig, // Add here
};
```

2. The configuration will automatically be available for imports.

## Deduplication

The import pipeline uses the `externalId` field (mapped from country-specific columns like BFS-Nr for Switzerland) to prevent duplicates:

- If a location with the same `externalId` exists, it will be **updated**
- If no matching `externalId` exists, a new location will be **created**

This means you can safely re-run imports on updated CSV files without creating duplicates.

## CSV Format Requirements

- Must have a header row with column names
- Required columns (per country config):
  - `externalId` column (for deduplication)
  - `longitude` column
  - `latitude` column
- Optional columns:
  - `region` (canton, state, province, etc.)
  - `subRegion` (commune, city, district, etc.)
  - `postalCode`
  - `language`

## Error Handling

The import process will:

- Continue processing even if individual rows fail
- Return a summary with:
  - Total rows processed
  - Number of locations created
  - Number of locations updated
  - Number of errors
  - List of error messages with row numbers

Example error response:

```typescript
{
  total: 100,
  created: 95,
  updated: 3,
  errors: 2,
  errorMessages: [
    "Row 42: Invalid longitude: abc",
    "Row 67: Missing externalId"
  ]
}
```
