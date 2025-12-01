import { v } from 'convex/values';
import { protectedAdminMutation } from '../functions';
import { internal } from '../_generated/api';
import type { Id } from '../_generated/dataModel';

// ============================================================
// DEAD LETTER QUEUE MUTATIONS
// ============================================================

type RetryResult = {
  success: boolean;
  newWorkflowId?: string;
  error?: string;
};

type BulkRetryResult = {
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<string>;
};

type ResolveResult = {
  success: boolean;
  error?: string;
};

/**
 * Retry a single dead letter queue item.
 * Looks up the entity and re-triggers the sync workflow.
 */
export const retryDeadLetterItem = protectedAdminMutation({
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
          webhookEvent: 'user.updated',
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
          webhookEvent: 'organization.updated',
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
 * Retry all items in the dead letter queue.
 */
export const retryAllDeadLetterItems = protectedAdminMutation({
  args: {},
  returns: v.object({
    total: v.number(),
    succeeded: v.number(),
    failed: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (ctx): Promise<BulkRetryResult> => {
    const items = await ctx.db
      .query('deadLetterQueue')
      .withIndex('by_status', (q) => q.eq('retryable', true).eq('resolvedAt', undefined))
      .collect();

    let succeeded = 0;
    let failed = 0;
    const errors: Array<string> = [];

    for (const item of items) {
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

/**
 * Mark a dead letter queue item as resolved without retrying.
 */
export const resolveDeadLetterItem = protectedAdminMutation({
  args: {
    itemId: v.id('deadLetterQueue'),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<ResolveResult> => {
    const item = await ctx.db.get(args.itemId);
    if (!item) {
      return { success: false, error: 'Item not found' };
    }

    await ctx.db.patch(args.itemId, {
      resolvedAt: Date.now(),
      retryable: false,
    });

    return { success: true };
  },
});
