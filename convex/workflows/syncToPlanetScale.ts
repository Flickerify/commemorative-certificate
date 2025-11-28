import { WorkflowManager, WorkflowId } from '@convex-dev/workflow';
import { components, internal } from '../_generated/api';
import { internalMutation } from '../functions';
import { v } from 'convex/values';

// Create workflow manager
const workflow = new WorkflowManager(components.workflow);

// Retry configuration for PlanetScale sync
const SYNC_RETRY_CONFIG = {
  maxAttempts: 5,
  initialBackoffMs: 100,
  base: 2,
} as const;

// ============================================================
// USER SYNC WORKFLOW
// ============================================================

export const syncUser = workflow.define({
  args: {
    workosId: v.string(),
    convexId: v.id('users'),
    email: v.string(),
    createdAt: v.optional(v.number()),
    updatedAt: v.number(),
  },
  handler: async (step, args): Promise<void> => {
    const { workosId, convexId, email, createdAt, updatedAt } = args;

    // Log pending status
    await step.runMutation(internal.workflows.syncToPlanetScale.logSyncStatus, {
      entityType: 'user' as const,
      entityId: workosId,
      status: 'pending' as const,
    });

    try {
      // Sync to PlanetScale with retry
      await step.runAction(
        internal.planetscale.internal.action.upsertUser,
        {
          id: workosId,
          convexId,
          email,
          createdAt,
          updatedAt,
        },
        { retry: SYNC_RETRY_CONFIG, name: 'upsert-user-planetscale' },
      );

      // Log success
      await step.runMutation(internal.workflows.syncToPlanetScale.logSyncStatus, {
        entityType: 'user' as const,
        entityId: workosId,
        status: 'success' as const,
      });
    } catch (error) {
      // Log failure
      await step.runMutation(internal.workflows.syncToPlanetScale.logSyncStatus, {
        entityType: 'user' as const,
        entityId: workosId,
        status: 'failed' as const,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  },
});

// ============================================================
// ORGANIZATION SYNC WORKFLOW
// ============================================================

export const syncOrganization = workflow.define({
  args: {
    workosId: v.string(),
    convexId: v.id('organizations'),
    createdAt: v.optional(v.number()),
    updatedAt: v.number(),
  },
  handler: async (step, args): Promise<void> => {
    const { workosId, convexId, createdAt, updatedAt } = args;

    // Log pending status
    await step.runMutation(internal.workflows.syncToPlanetScale.logSyncStatus, {
      entityType: 'organization' as const,
      entityId: workosId,
      status: 'pending' as const,
    });

    try {
      // Sync to PlanetScale with retry
      await step.runAction(
        internal.planetscale.internal.action.upsertOrganization,
        {
          id: workosId,
          convexId,
          createdAt,
          updatedAt,
        },
        { retry: SYNC_RETRY_CONFIG, name: 'upsert-organization-planetscale' },
      );

      // Log success
      await step.runMutation(internal.workflows.syncToPlanetScale.logSyncStatus, {
        entityType: 'organization' as const,
        entityId: workosId,
        status: 'success' as const,
      });
    } catch (error) {
      // Log failure
      await step.runMutation(internal.workflows.syncToPlanetScale.logSyncStatus, {
        entityType: 'organization' as const,
        entityId: workosId,
        status: 'failed' as const,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  },
});

// ============================================================
// SHARED SYNC STATUS LOGGING
// ============================================================

export const logSyncStatus = internalMutation({
  args: {
    entityType: v.union(v.literal('user'), v.literal('organization')),
    entityId: v.string(),
    status: v.union(v.literal('pending'), v.literal('success'), v.literal('failed')),
    error: v.optional(v.string()),
  },
  returns: v.null(),
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

    return null;
  },
});

// ============================================================
// WORKFLOW KICKOFF FUNCTIONS (called from webhooks)
// ============================================================

export const kickoffUserSync = internalMutation({
  args: {
    workosId: v.string(),
    convexId: v.id('users'),
    email: v.string(),
    createdAt: v.optional(v.number()),
    updatedAt: v.number(),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const workflowId: WorkflowId = await workflow.start(
      ctx,
      internal.workflows.syncToPlanetScale.syncUser,
      args,
    );
    return workflowId;
  },
});

export const kickoffOrganizationSync = internalMutation({
  args: {
    workosId: v.string(),
    convexId: v.id('organizations'),
    createdAt: v.optional(v.number()),
    updatedAt: v.number(),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const workflowId: WorkflowId = await workflow.start(
      ctx,
      internal.workflows.syncToPlanetScale.syncOrganization,
      args,
    );
    return workflowId;
  },
});
