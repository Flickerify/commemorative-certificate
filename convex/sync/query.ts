import { protectedAdminQuery } from '../functions';
import { v } from 'convex/values';
import { WorkflowManager, WorkflowId } from '@convex-dev/workflow';
import { components } from '../_generated/api';

const workflow = new WorkflowManager(components.workflow);

export const getSyncStatus = protectedAdminQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    const statuses = await ctx.db.query('syncStatus').order('desc').take(limit);
    return statuses;
  },
});

export const getFailedSyncs = protectedAdminQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    return await ctx.db
      .query('syncStatus')
      .withIndex('by_status', (q) => q.eq('status', 'failed'))
      .order('desc')
      .take(limit);
  },
});

export const getPendingSyncs = protectedAdminQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    return await ctx.db
      .query('syncStatus')
      .withIndex('by_status', (q) => q.eq('status', 'pending'))
      .order('desc')
      .take(limit);
  },
});

export const getEntityHistory = protectedAdminQuery({
  args: {
    entityType: v.union(v.literal('user'), v.literal('organization')),
    entityId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;

    // Get all sync records for this entity, ordered by creation time (newest first)
    const syncs = await ctx.db
      .query('syncStatus')
      .withIndex('by_entity', (q) => q.eq('entityType', args.entityType).eq('entityId', args.entityId))
      .order('desc')
      .take(limit);

    // Fetch workflow status for each sync
    const syncsWithStatus = await Promise.all(
      syncs.map(async (sync) => {
        let workflowStatus = null;
        try {
          workflowStatus = await workflow.status(ctx, sync.workflowId as WorkflowId);
        } catch {
          workflowStatus = null;
        }
        return { ...sync, workflowStatus };
      }),
    );

    return syncsWithStatus;
  },
});

export const getSyncsWithWorkflowStatus = protectedAdminQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    const syncs = await ctx.db.query('syncStatus').order('desc').take(limit);

    // Fetch workflow status for each sync
    const syncsWithStatus = await Promise.all(
      syncs.map(async (sync) => {
        let workflowStatus = null;
        try {
          workflowStatus = await workflow.status(ctx, sync.workflowId as WorkflowId);
        } catch {
          workflowStatus = null;
        }
        return { ...sync, workflowStatus };
      }),
    );

    return syncsWithStatus;
  },
});

export const getSyncsGroupedByEntity = protectedAdminQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    const syncs = await ctx.db.query('syncStatus').order('desc').take(limit);

    // Group syncs by entity
    const grouped = new Map<string, typeof syncs>();

    for (const sync of syncs) {
      const key = `${sync.entityType}:${sync.entityId}`;
      const existing = grouped.get(key) || [];
      existing.push(sync);
      grouped.set(key, existing);
    }

    // Convert to array with entity info and fetch workflow status for latest sync
    const result = await Promise.all(
      Array.from(grouped.entries()).map(async ([key, entitySyncs]) => {
        const [entityType, entityId] = key.split(':');
        const latestSync = entitySyncs[0]; // Already sorted desc

        let workflowStatus = null;
        try {
          workflowStatus = await workflow.status(ctx, latestSync.workflowId as WorkflowId);
        } catch {
          workflowStatus = null;
        }

        return {
          entityType: entityType as 'user' | 'organization',
          entityId,
          totalSyncs: entitySyncs.length,
          latestSync: { ...latestSync, workflowStatus },
          successCount: entitySyncs.filter((s) => s.status === 'success').length,
          failedCount: entitySyncs.filter((s) => s.status === 'failed').length,
          pendingCount: entitySyncs.filter((s) => s.status === 'pending').length,
        };
      }),
    );

    // Sort by latest sync time
    return result.sort((a, b) => b.latestSync._creationTime - a.latestSync._creationTime);
  },
});

export const getSyncStats = protectedAdminQuery({
  args: {},
  handler: async (ctx) => {
    const allSyncs = await ctx.db.query('syncStatus').collect();

    const total = allSyncs.length;
    const pending = allSyncs.filter((s) => s.status === 'pending').length;
    const success = allSyncs.filter((s) => s.status === 'success').length;
    const failed = allSyncs.filter((s) => s.status === 'failed').length;

    // Count unique entities
    const uniqueEntities = new Set(allSyncs.map((s) => `${s.entityType}:${s.entityId}`)).size;

    // Calculate average duration for completed syncs
    const completedSyncs = allSyncs.filter((s) => s.durationMs !== undefined);
    const avgDurationMs =
      completedSyncs.length > 0
        ? completedSyncs.reduce((sum, s) => sum + (s.durationMs || 0), 0) / completedSyncs.length
        : 0;

    // Count dead letter queue items
    const deadLetterItems = await ctx.db
      .query('deadLetterQueue')
      .withIndex('by_status', (q) => q.eq('retryable', true).eq('resolvedAt', undefined))
      .collect();

    return {
      total,
      pending,
      success,
      failed,
      uniqueEntities,
      avgDurationMs: Math.round(avgDurationMs),
      deadLetterCount: deadLetterItems.length,
    };
  },
});

// ============================================================
// DEAD LETTER QUEUE QUERIES
// ============================================================

export const getDeadLetterQueue = protectedAdminQuery({
  args: {
    limit: v.optional(v.number()),
    includeResolved: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    if (args.includeResolved) {
      // Get all items
      return await ctx.db.query('deadLetterQueue').order('desc').take(limit);
    }

    // Get only unresolved, retryable items
    return await ctx.db
      .query('deadLetterQueue')
      .withIndex('by_status', (q) => q.eq('retryable', true).eq('resolvedAt', undefined))
      .order('desc')
      .take(limit);
  },
});
