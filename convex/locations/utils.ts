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
 * Simple geohash encoding for lat/lng coordinates
 * This is a basic implementation - for production, consider using a proper geohash library
 */
function encodeGeohash(lat: number, lng: number, precision: number): string {
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let bits = 0;
  let bit = 0;
  let evenBit = true;
  let geohash = '';

  let latMin = -90.0;
  let latMax = 90.0;
  let lngMin = -180.0;
  let lngMax = 180.0;

  while (geohash.length < precision) {
    if (evenBit) {
      // longitude
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) {
        bits = (bits << 1) + 1;
        lngMin = mid;
      } else {
        bits = (bits << 1) + 0;
        lngMax = mid;
      }
    } else {
      // latitude
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        bits = (bits << 1) + 1;
        latMin = mid;
      } else {
        bits = (bits << 1) + 0;
        latMax = mid;
      }
    }
    evenBit = !evenBit;

    if (++bit === 5) {
      geohash += BASE32[bits];
      bit = 0;
      bits = 0;
    }
  }

  return geohash;
}

/**
 * Generate geohash5 (5-character precision, ~5km accuracy)
 */
export function generateGeohash5(lat: number, lng: number): string {
  return encodeGeohash(lat, lng, 5);
}

/**
 * Generate geohash7 (7-character precision, ~150m accuracy)
 */
export function generateGeohash7(lat: number, lng: number): string {
  return encodeGeohash(lat, lng, 7);
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
