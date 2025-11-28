import { internal } from '../_generated/api';
import { internalMutation } from '../functions';
import { v } from 'convex/values';
import { internalAction } from '../_generated/server';

export const run = internalAction({
  args: {
    id: v.string(), // WorkOS ID
    convexId: v.id('organizations'),
    createdAt: v.optional(v.number()),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const { id, convexId, createdAt, updatedAt } = args;

    try {
      // Log start
      await ctx.runMutation(internal.workflows.syncOrganizationToPlanetScale.logSyncStatus, {
        entityType: 'organization',
        entityId: id,
        status: 'pending',
      });

      // Call PlanetScale action
      await ctx.runAction(internal.planetscale.internal.action.upsertOrganization, {
        id,
        convexId,
        createdAt,
        updatedAt,
      });

      // Log success
      await ctx.runMutation(internal.workflows.syncOrganizationToPlanetScale.logSyncStatus, {
        entityType: 'organization',
        entityId: id,
        status: 'success',
      });
    } catch (error: any) {
      // Log failure
      await ctx.runMutation(internal.workflows.syncOrganizationToPlanetScale.logSyncStatus, {
        entityType: 'organization',
        entityId: id,
        status: 'failed',
        error: error.message || 'Unknown error',
      });
      throw error;
    }
  },
});

export const logSyncStatus = internalMutation({
  args: {
    entityType: v.union(v.literal('user'), v.literal('organization')),
    entityId: v.string(),
    status: v.union(v.literal('pending'), v.literal('success'), v.literal('failed')),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { entityType, entityId, status, error } = args;
    const existing = await ctx.db
      .query('syncStatus')
      .withIndex('by_entity', (q) => q.eq('entityType', entityType).eq('entityId', entityId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status,
        lastSyncedAt: Date.now(),
        error,
      });
    } else {
      await ctx.db.insert('syncStatus', {
        entityType,
        entityId,
        targetSystem: 'planetscale',
        status,
        lastSyncedAt: Date.now(),
        error,
      });
    }
  },
});
