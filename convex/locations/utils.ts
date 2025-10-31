/**
 * Utility functions for location processing
 */

/**
 * Determine timezone from coordinates (Switzerland uses Europe/Zurich for all locations)
 * This can be extended for other countries that span multiple timezones
 */
export function getTimezoneFromCoordinates(lat: number, lng: number, defaultTimezone: string): string {
  // For Switzerland, all locations use Europe/Zurich
  // For other countries, this can be extended with timezone lookup libraries
  return defaultTimezone;
}

/**
 * Parse CSV line into record
 */
export function parseCsvLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * Parse CSV header to get column indices
 */
export function parseCsvHeader(headerLine: string, delimiter: string = ','): Map<string, number> {
  const columns = parseCsvLine(headerLine, delimiter);
  const columnMap = new Map<string, number>();

  columns.forEach((col, index) => {
    const normalized = col.trim().toLowerCase();
    columnMap.set(normalized, index);
    // Also map original case
    columnMap.set(col.trim(), index);
  });

  return columnMap;
}
