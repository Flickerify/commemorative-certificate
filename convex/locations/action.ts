'use node';

import { ConvexError, v } from 'convex/values';
import { protectedAction } from '../functions';
import { internal } from '../_generated/api';
import * as fs from 'node:fs';

interface ImportResult {
  total: number;
  created: number;
  updated: number;
  errors: number;
  errorMessages: string[];
}

/**
 * Import locations from a CSV file path (for server-side usage)
 * This is a protected action that requires authentication
 */
export const importLocationsFromFile = protectedAction({
  args: {
    filePath: v.string(),
    country: v.string(),
  },
  async handler(ctx, args): Promise<ImportResult> {
    // Read file
    if (!fs.existsSync(args.filePath)) {
      throw new ConvexError(`File not found: ${args.filePath}`);
    }

    const csvText = fs.readFileSync(args.filePath, 'utf-8');

    // Call internal action to process the CSV
    return await ctx.runAction(internal.locations.internal.action.importLocationsFromCsv, {
      csvText,
      country: args.country,
    });
  },
});

/**
 * Import locations from CSV text (for client-side usage)
 * This is a protected action that requires authentication
 */
export const importLocationsFromText = protectedAction({
  args: {
    csvText: v.string(),
    country: v.string(),
  },
  async handler(ctx, args): Promise<ImportResult> {
    // Call internal action to process the CSV
    return await ctx.runAction(internal.locations.internal.action.importLocationsFromCsv, {
      csvText: args.csvText,
      country: args.country,
    });
  },
});
