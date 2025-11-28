import { WorkflowManager, WorkflowId, vWorkflowId } from '@convex-dev/workflow';
import { vResultValidator } from '@convex-dev/workpool';
import { components, internal } from '../_generated/api';
import { internalMutation, protectedAdminQuery } from '../functions';
import { v } from 'convex/values';
import { webhookEventValidator } from '../schema';

// Create workflow manager
export const workflow = new WorkflowManager(components.workflow);

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

    await step.runAction(
      internal.planetscale.internal.action.upsertUser,
      { id: workosId, convexId, email, createdAt, updatedAt },
      { retry: SYNC_RETRY_CONFIG, name: 'upsert-user-planetscale' },
    );
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

    await step.runAction(
      internal.planetscale.internal.action.upsertOrganization,
      { id: workosId, convexId, createdAt, updatedAt },
      { retry: SYNC_RETRY_CONFIG, name: 'upsert-organization-planetscale' },
    );
  },
});

// ============================================================
// WORKFLOW COMPLETION HANDLER
// ============================================================

export const handleSyncComplete = internalMutation({
  args: {
    workflowId: vWorkflowId,
    result: vResultValidator,
    context: v.object({
      entityType: v.union(v.literal('user'), v.literal('organization')),
      entityId: v.string(),
      startedAt: v.number(),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { startedAt } = args.context;
    const completedAt = Date.now();
    const durationMs = completedAt - startedAt;

    // Find by workflowId to update the correct record
    const syncRecord = await ctx.db
      .query('syncStatus')
      .withIndex('by_workflow', (q) => q.eq('workflowId', args.workflowId))
      .unique();

    const isSuccess = args.result.kind === 'success';
    const errorMessage = 'error' in args.result ? (args.result as { error?: string }).error : undefined;

    if (syncRecord) {
      await ctx.db.patch(syncRecord._id, {
        completedAt,
        durationMs,
        status: isSuccess ? ('success' as const) : ('failed' as const),
        error: errorMessage,
      });
    }

    return null;
  },
});

// ============================================================
// SYNC STATUS INITIALIZATION
// ============================================================

export const initSyncStatus = internalMutation({
  args: {
    entityType: v.union(v.literal('user'), v.literal('organization')),
    entityId: v.string(),
    webhookEvent: webhookEventValidator,
    workflowId: v.string(),
    startedAt: v.number(),
  },
  returns: v.id('syncStatus'),
  handler: async (ctx, args) => {
    const { entityType, entityId, webhookEvent, workflowId, startedAt } = args;

    // Always create a new record to keep history
    const syncId = await ctx.db.insert('syncStatus', {
      entityType,
      entityId,
      targetSystem: 'planetscale',
      status: 'pending',
      webhookEvent,
      workflowId,
      startedAt,
    });

    return syncId;
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
    webhookEvent: v.union(v.literal('user.created'), v.literal('user.updated')),
    createdAt: v.optional(v.number()),
    updatedAt: v.number(),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const startedAt = Date.now();
    const workflowId: WorkflowId = await workflow.start(
      ctx,
      internal.workflows.syncToPlanetScale.syncUser,
      {
        workosId: args.workosId,
        convexId: args.convexId,
        email: args.email,
        createdAt: args.createdAt,
        updatedAt: args.updatedAt,
      },
      {
        onComplete: internal.workflows.syncToPlanetScale.handleSyncComplete,
        context: {
          entityType: 'user' as const,
          entityId: args.workosId,
          startedAt,
        },
      },
    );

    await ctx.runMutation(internal.workflows.syncToPlanetScale.initSyncStatus, {
      entityType: 'user',
      entityId: args.workosId,
      webhookEvent: args.webhookEvent,
      workflowId,
      startedAt,
    });

    return workflowId;
  },
});

export const kickoffOrganizationSync = internalMutation({
  args: {
    workosId: v.string(),
    convexId: v.id('organizations'),
    webhookEvent: v.union(v.literal('organization.created'), v.literal('organization.updated')),
    createdAt: v.optional(v.number()),
    updatedAt: v.number(),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const startedAt = Date.now();
    const workflowId: WorkflowId = await workflow.start(
      ctx,
      internal.workflows.syncToPlanetScale.syncOrganization,
      {
        workosId: args.workosId,
        convexId: args.convexId,
        createdAt: args.createdAt,
        updatedAt: args.updatedAt,
      },
      {
        onComplete: internal.workflows.syncToPlanetScale.handleSyncComplete,
        context: {
          entityType: 'organization' as const,
          entityId: args.workosId,
          startedAt,
        },
      },
    );

    await ctx.runMutation(internal.workflows.syncToPlanetScale.initSyncStatus, {
      entityType: 'organization',
      entityId: args.workosId,
      webhookEvent: args.webhookEvent,
      workflowId,
      startedAt,
    });

    return workflowId;
  },
});

// ============================================================
// ADMIN QUERIES
// ============================================================

export const getWorkflowStatus = protectedAdminQuery({
  args: {
    workflowId: v.string(),
  },
  handler: async (ctx, args) => {
    return await workflow.status(ctx, args.workflowId as WorkflowId);
  },
});
