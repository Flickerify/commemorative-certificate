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
// USER DELETION WORKFLOW
// ============================================================

export const deleteUser = workflow.define({
  args: {
    workosId: v.string(),
  },
  handler: async (step, args): Promise<void> => {
    const { workosId } = args;

    // Step 1: Delete from PlanetScale
    await step.runAction(
      internal.planetscale.internal.action.deleteUser,
      { workosId },
      { retry: SYNC_RETRY_CONFIG, name: 'delete-user-planetscale' },
    );

    // Step 2: Delete from Convex (with cascade to memberships)
    await step.runMutation(
      internal.users.internal.mutation.deleteFromWorkos,
      { externalId: workosId },
      { name: 'delete-user-convex' },
    );
  },
});

// ============================================================
// SUBSCRIPTION SYNC WORKFLOW
// ============================================================

export const syncSubscription = workflow.define({
  args: {
    workosId: v.string(),
    tier: v.union(v.literal('personal'), v.literal('pro'), v.literal('enterprise')),
    status: v.union(
      v.literal('active'),
      v.literal('canceled'),
      v.literal('incomplete'),
      v.literal('incomplete_expired'),
      v.literal('past_due'),
      v.literal('paused'),
      v.literal('trialing'),
      v.literal('unpaid'),
      v.literal('none'),
    ),
  },
  handler: async (step, args): Promise<void> => {
    const { workosId, tier, status } = args;

    await step.runAction(
      internal.planetscale.internal.action.updateOrganizationSubscription,
      { workosId, tier, status },
      { retry: SYNC_RETRY_CONFIG, name: 'sync-subscription-planetscale' },
    );
  },
});

// ============================================================
// ORGANIZATION DELETION WORKFLOW
// ============================================================

export const deleteOrganization = workflow.define({
  args: {
    workosId: v.string(),
  },
  handler: async (step, args): Promise<void> => {
    const { workosId } = args;

    // Step 1: Cancel any active Stripe subscriptions (safety net)
    // This ensures no orphaned subscriptions remain even if the deletion
    // check was bypassed or there was a race condition
    await step.runAction(
      internal.billing.action.cancelAllSubscriptionsForOrganization,
      { workosId },
      { retry: SYNC_RETRY_CONFIG, name: 'cancel-subscriptions' },
    );

    // Step 2: Delete from PlanetScale
    await step.runAction(
      internal.planetscale.internal.action.deleteOrganization,
      { workosId },
      { retry: SYNC_RETRY_CONFIG, name: 'delete-organization-planetscale' },
    );

    // Step 3: Delete from Convex (with cascade to domains and memberships)
    await step.runMutation(
      internal.organizations.internal.mutation.deleteFromWorkos,
      { externalId: workosId },
      { name: 'delete-organization-convex' },
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
    const { startedAt, entityType, entityId } = args.context;
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

    // Add to dead letter queue if the workflow failed after all retries
    if (!isSuccess && errorMessage) {
      await ctx.db.insert('deadLetterQueue', {
        workflowId: args.workflowId,
        entityType,
        entityId,
        error: errorMessage,
        context: {
          startedAt,
          completedAt,
          durationMs,
          syncRecordId: syncRecord?._id,
        },
        createdAt: completedAt,
        retryable: true,
        retryCount: 0,
      });

      console.error(
        `[DEAD LETTER] ${entityType} ${entityId} failed after all retries: ${errorMessage}. ` +
          `Workflow: ${args.workflowId}. Manual intervention may be required.`,
      );
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

export const kickoffUserDeletion = internalMutation({
  args: {
    workosId: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const startedAt = Date.now();
    const workflowId: WorkflowId = await workflow.start(
      ctx,
      internal.workflows.syncToPlanetScale.deleteUser,
      { workosId: args.workosId },
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
      webhookEvent: 'user.deleted',
      workflowId,
      startedAt,
    });

    return workflowId;
  },
});

export const kickoffOrganizationDeletion = internalMutation({
  args: {
    workosId: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const startedAt = Date.now();
    const workflowId: WorkflowId = await workflow.start(
      ctx,
      internal.workflows.syncToPlanetScale.deleteOrganization,
      { workosId: args.workosId },
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
      webhookEvent: 'organization.deleted',
      workflowId,
      startedAt,
    });

    return workflowId;
  },
});

export const kickoffSubscriptionSync = internalMutation({
  args: {
    workosId: v.string(),
    tier: v.union(v.literal('personal'), v.literal('pro'), v.literal('enterprise')),
    status: v.union(
      v.literal('active'),
      v.literal('canceled'),
      v.literal('incomplete'),
      v.literal('incomplete_expired'),
      v.literal('past_due'),
      v.literal('paused'),
      v.literal('trialing'),
      v.literal('unpaid'),
      v.literal('none'),
    ),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const startedAt = Date.now();
    const workflowId: WorkflowId = await workflow.start(
      ctx,
      internal.workflows.syncToPlanetScale.syncSubscription,
      {
        workosId: args.workosId,
        tier: args.tier,
        status: args.status,
      },
      {
        // Subscription syncs don't need the full completion handler since they're
        // triggered by Stripe webhooks which handle their own idempotency
        onComplete: internal.workflows.syncToPlanetScale.handleSubscriptionSyncComplete,
        context: {
          entityType: 'subscription' as const,
          entityId: args.workosId,
          startedAt,
        },
      },
    );

    console.log(
      `[Subscription Sync] Started workflow ${workflowId} for organization ${args.workosId}: tier=${args.tier}, status=${args.status}`,
    );

    return workflowId;
  },
});

/**
 * Lightweight completion handler for subscription syncs.
 * Only logs failures - doesn't add to dead letter queue since Stripe handles retries.
 */
export const handleSubscriptionSyncComplete = internalMutation({
  args: {
    workflowId: vWorkflowId,
    result: vResultValidator,
    context: v.object({
      entityType: v.literal('subscription'),
      entityId: v.string(),
      startedAt: v.number(),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const isSuccess = args.result.kind === 'success';
    const errorMessage = 'error' in args.result ? (args.result as { error?: string }).error : undefined;

    if (!isSuccess && errorMessage) {
      console.error(
        `[Subscription Sync] Failed for ${args.context.entityId}: ${errorMessage}. ` +
          `Workflow: ${args.workflowId}. Will retry on next Stripe webhook.`,
      );
    }

    return null;
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

// ============================================================
// DEAD LETTER QUEUE ADMIN
// ============================================================

/**
 * List unresolved items in the dead letter queue.
 */
export const listDeadLetterQueue = protectedAdminQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query('deadLetterQueue')
      .withIndex('by_status', (q) => q.eq('retryable', true).eq('resolvedAt', undefined))
      .order('desc')
      .take(limit);
  },
});

/**
 * Mark a dead letter queue item as resolved (manual intervention completed).
 */
export const resolveDeadLetterItem = internalMutation({
  args: {
    itemId: v.id('deadLetterQueue'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.itemId, {
      resolvedAt: Date.now(),
      retryable: false,
    });
    return null;
  },
});

type RetryResult = {
  success: boolean;
  newWorkflowId?: string;
  error?: string;
};

/**
 * Retry a dead letter queue item by re-running the sync workflow.
 * Looks up the entity in Convex and re-triggers the appropriate sync.
 */
export const retryDeadLetterItem = internalMutation({
  args: {
    itemId: v.id('deadLetterQueue'),
  },
  returns: v.object({
    success: v.boolean(),
    newWorkflowId: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<RetryResult> => {
    const item = await ctx.db.get(args.itemId);
    if (!item) {
      return { success: false, error: 'Item not found' };
    }

    if (!item.retryable) {
      return { success: false, error: 'Item is not retryable' };
    }

    // Update retry metadata
    await ctx.db.patch(args.itemId, {
      retryCount: item.retryCount + 1,
      lastRetryAt: Date.now(),
    });

    const entityId = item.entityId; // This is the WorkOS ID

    try {
      let newWorkflowId: string | undefined;

      if (item.entityType === 'user') {
        // Look up the user by WorkOS external ID
        const user = await ctx.db
          .query('users')
          .withIndex('by_external_id', (q) => q.eq('externalId', entityId))
          .first();

        if (!user) {
          return { success: false, error: `User ${entityId} not found in Convex` };
        }

        // Re-trigger user sync
        newWorkflowId = await ctx.runMutation(internal.workflows.syncToPlanetScale.kickoffUserSync, {
          workosId: entityId,
          convexId: user._id,
          email: user.email,
          webhookEvent: 'user.updated', // Use updated since this is a retry
          updatedAt: Date.now(),
        });
      } else if (item.entityType === 'organization') {
        // Look up the organization by WorkOS external ID
        const organization = await ctx.db
          .query('organizations')
          .withIndex('externalId', (q) => q.eq('externalId', entityId))
          .first();

        if (!organization) {
          return { success: false, error: `Organization ${entityId} not found in Convex` };
        }

        // Re-trigger organization sync
        newWorkflowId = await ctx.runMutation(internal.workflows.syncToPlanetScale.kickoffOrganizationSync, {
          workosId: entityId,
          convexId: organization._id,
          webhookEvent: 'organization.updated', // Use updated since this is a retry
          updatedAt: Date.now(),
        });
      } else {
        return { success: false, error: `Unknown entity type: ${item.entityType}` };
      }

      // Mark the old DLQ item as resolved since we started a new workflow
      await ctx.db.patch(args.itemId, {
        resolvedAt: Date.now(),
        retryable: false,
      });

      console.log(
        `[Dead Letter] Successfully retried ${item.entityType} ${entityId}. ` +
          `New workflow: ${newWorkflowId}. Previous attempts: ${item.retryCount}`,
      );

      return { success: true, newWorkflowId };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Dead Letter] Failed to retry ${item.entityType} ${entityId}: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  },
});

/**
 * Admin action to retry a dead letter queue item.
 * This is a public wrapper for the internal retry mutation.
 */
export const adminRetryDeadLetterItem = protectedAdminQuery({
  args: {
    itemId: v.id('deadLetterQueue'),
  },
  handler: async (ctx, args) => {
    // Get the item details for display
    const item = await ctx.db.get(args.itemId);
    if (!item) {
      return { success: false, error: 'Item not found', item: null };
    }
    return { item, canRetry: item.retryable && !item.resolvedAt };
  },
});

/**
 * Bulk retry all retryable items in the dead letter queue.
 * Note: This processes items sequentially. For large queues, consider pagination.
 */
export const retryAllDeadLetterItems = internalMutation({
  args: {},
  returns: v.object({
    total: v.number(),
    succeeded: v.number(),
    failed: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (ctx) => {
    const items = await ctx.db
      .query('deadLetterQueue')
      .withIndex('by_status', (q) => q.eq('retryable', true).eq('resolvedAt', undefined))
      .collect();

    let succeeded = 0;
    let failed = 0;
    const errors: Array<string> = [];

    for (const item of items) {
      // Process each item inline instead of calling the mutation recursively
      // to avoid TypeScript circular reference issues
      const entityId = item.entityId;

      try {
        let newWorkflowId: string | undefined;

        if (item.entityType === 'user') {
          const user = await ctx.db
            .query('users')
            .withIndex('by_external_id', (q) => q.eq('externalId', entityId))
            .first();

          if (!user) {
            failed++;
            errors.push(`${item.entityType} ${entityId}: User not found in Convex`);
            continue;
          }

          newWorkflowId = await ctx.runMutation(internal.workflows.syncToPlanetScale.kickoffUserSync, {
            workosId: entityId,
            convexId: user._id,
            email: user.email,
            webhookEvent: 'user.updated',
            updatedAt: Date.now(),
          });
        } else if (item.entityType === 'organization') {
          const organization = await ctx.db
            .query('organizations')
            .withIndex('externalId', (q) => q.eq('externalId', entityId))
            .first();

          if (!organization) {
            failed++;
            errors.push(`${item.entityType} ${entityId}: Organization not found in Convex`);
            continue;
          }

          newWorkflowId = await ctx.runMutation(internal.workflows.syncToPlanetScale.kickoffOrganizationSync, {
            workosId: entityId,
            convexId: organization._id,
            webhookEvent: 'organization.updated',
            updatedAt: Date.now(),
          });
        } else {
          failed++;
          errors.push(`${item.entityType} ${entityId}: Unknown entity type`);
          continue;
        }

        // Mark the old DLQ item as resolved
        await ctx.db.patch(item._id, {
          resolvedAt: Date.now(),
          retryable: false,
          retryCount: item.retryCount + 1,
          lastRetryAt: Date.now(),
        });

        succeeded++;
        console.log(`[Dead Letter] Retried ${item.entityType} ${entityId}. New workflow: ${newWorkflowId}`);
      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${item.entityType} ${entityId}: ${errorMsg}`);
      }
    }

    console.log(
      `[Dead Letter] Bulk retry complete. Total: ${items.length}, Succeeded: ${succeeded}, Failed: ${failed}`,
    );

    return { total: items.length, succeeded, failed, errors };
  },
});
