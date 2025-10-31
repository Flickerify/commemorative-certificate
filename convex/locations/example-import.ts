/**
 * Example script for importing Swiss locations from CSV
 *
 * This is a reference example showing how to use the import pipeline.
 * In a real application, you would call this from your frontend or via a script.
 *
 * Usage:
 * 1. Read the CSV file
 * 2. Call the import action with the CSV text and country code
 */

import { api } from '../_generated/api';

// Example: Import from CSV text (from frontend)
async function importSwissLocationsExample(csvText: string) {
  // In a React component, you would use:
  // const importLocations = useMutation(api.locations.action.importLocationsFromText);
  // const result = await importLocations({ csvText, country: "CH" });

  // Example result structure:
  const exampleResult = {
    total: 5759,
    created: 5759,
    updated: 0,
    errors: 0,
    errorMessages: [],
  };

  return exampleResult;
}

// Example: Import from file path (from server-side script)
async function importSwissLocationsFromFileExample(filePath: string) {
  // In a server action or script, you would use:
  // const importLocations = useMutation(api.locations.action.importLocationsFromFile);
  // const result = await importLocations({ filePath, country: "CH" });

  // Example result structure:
  const exampleResult = {
    total: 5759,
    created: 5759,
    updated: 0,
    errors: 0,
    errorMessages: [],
  };

  return exampleResult;
}

/**
 * Example CSV format for Switzerland:
 *
 * Ortschaftsname;PLZ;Zusatzziffer;Gemeindename;BFS-Nr;Kantonskürzel;E;N;Sprache;Validity
 * Aeugst am Albis;8914;00;Aeugst am Albis;1;ZH;8.487911353880977;47.26870659169308;de;2008-07-01
 */

export { importSwissLocationsExample, importSwissLocationsFromFileExample };
