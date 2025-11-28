import { internal } from '../_generated/api';
import { internalMutation } from '../functions';
import { v } from 'convex/values';
import { internalAction } from '../_generated/server';

export const run = internalAction({
  args: {
    id: v.string(), // WorkOS ID
    convexId: v.id('users'), // Convex ID
    email: v.string(),
    createdAt: v.optional(v.number()),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const { id, email, convexId, updatedAt } = args;

    try {
      // Log start
      await ctx.runMutation(internal.workflows.syncUserToPlanetScale.logSyncStatus, {
        entityType: 'user',
        entityId: id,
        status: 'pending',
      });

      // Call PlanetScale action
      await ctx.runAction(internal.planetscale.internal.action.upsertUser, {
        id,
        email,
        convexId,
        updatedAt,
      });

      // Log success
      await ctx.runMutation(internal.workflows.syncUserToPlanetScale.logSyncStatus, {
        entityType: 'user',
        entityId: id,
        status: 'success',
      });
    } catch (error: any) {
      // Log failure
      await ctx.runMutation(internal.workflows.syncUserToPlanetScale.logSyncStatus, {
        entityType: 'user',
        entityId: id,
        status: 'failed',
        error: error.message || 'Unknown error',
      });
      throw error; // Re-throw to allow retry if configured
    }
  },
});

export const logSyncStatus = internalMutation({
  args: {
    entityType: v.union(v.literal('user'), v.literal('organisation')),
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
