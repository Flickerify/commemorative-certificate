import { v } from 'convex/values';
import { internalMutation } from '../../functions';
import {
  auditCategoryValidator,
  auditActionValidator,
  auditStatusValidator,
  DEFAULT_AUDIT_RETENTION_DAYS,
} from '../../schema';
import type { Id } from '../../_generated/dataModel';

/**
 * Log an audit event (internal use only).
 * This is the core function for recording audit trail events.
 */
export const logAuditEvent = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    // Actor
    actorId: v.optional(v.id('users')),
    actorExternalId: v.optional(v.string()),
    actorEmail: v.optional(v.string()),
    actorName: v.optional(v.string()),
    actorType: v.union(v.literal('user'), v.literal('system'), v.literal('api')),
    // Action
    category: auditCategoryValidator,
    action: auditActionValidator,
    status: auditStatusValidator,
    // Target
    targetType: v.optional(v.string()),
    targetId: v.optional(v.string()),
    targetName: v.optional(v.string()),
    // Additional data
    metadata: v.optional(v.record(v.string(), v.any())),
    description: v.string(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  returns: v.union(v.id('auditLogs'), v.null()),
  handler: async (ctx, args) => {
    // Check if organization is enterprise tier
    const subscription = await ctx.db
      .query('organizationSubscriptions')
      .withIndex('by_organization_and_status', (q) => q.eq('organizationId', args.organizationId).eq('status', 'active'))
      .first();

    // Only log for enterprise organizations - silently skip for others
    if (!subscription || subscription.tier !== 'enterprise') {
      return null;
    }

    // Get organization audit settings for retention period
    const auditSettings = await ctx.db
      .query('organizationAuditSettings')
      .withIndex('by_organization', (q) => q.eq('organizationId', args.organizationId))
      .first();

    const retentionDays = auditSettings?.retentionDays ?? DEFAULT_AUDIT_RETENTION_DAYS;
    const now = Date.now();
    const expiresAt = now + retentionDays * 24 * 60 * 60 * 1000;

    const auditLogId = await ctx.db.insert('auditLogs', {
      organizationId: args.organizationId,
      actorId: args.actorId,
      actorExternalId: args.actorExternalId,
      actorEmail: args.actorEmail,
      actorName: args.actorName,
      actorType: args.actorType,
      category: args.category,
      action: args.action,
      status: args.status,
      targetType: args.targetType,
      targetId: args.targetId,
      targetName: args.targetName,
      metadata: args.metadata,
      description: args.description,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      timestamp: now,
      expiresAt,
    });

    return auditLogId;
  },
});

/**
 * Clean up expired audit logs.
 * Called by cron job to enforce TTL.
 */
export const cleanupExpiredAuditLogs = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    deleted: v.number(),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 500;
    const now = Date.now();

    // Find expired audit logs
    const expiredLogs = await ctx.db
      .query('auditLogs')
      .withIndex('by_expires_at', (q) => q.lt('expiresAt', now))
      .take(batchSize);

    // Delete each expired log
    for (const log of expiredLogs) {
      await ctx.db.delete(log._id);
    }

    return {
      deleted: expiredLogs.length,
      hasMore: expiredLogs.length === batchSize,
    };
  },
});

/**
 * Initialize audit settings for an organization.
 * Called when an organization upgrades to enterprise.
 */
export const initializeAuditSettings = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    retentionDays: v.optional(v.number()),
  },
  returns: v.id('organizationAuditSettings'),
  handler: async (ctx, args) => {
    // Check if settings already exist
    const existing = await ctx.db
      .query('organizationAuditSettings')
      .withIndex('by_organization', (q) => q.eq('organizationId', args.organizationId))
      .first();

    if (existing) {
      return existing._id;
    }

    const now = Date.now();
    const settingsId = await ctx.db.insert('organizationAuditSettings', {
      organizationId: args.organizationId,
      retentionDays: args.retentionDays ?? DEFAULT_AUDIT_RETENTION_DAYS,
      isRetentionUpgradable: false, // Future paid feature
      createdAt: now,
      updatedAt: now,
    });

    return settingsId;
  },
});

/**
 * Update audit settings for an organization.
 */
export const updateAuditSettings = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    retentionDays: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query('organizationAuditSettings')
      .withIndex('by_organization', (q) => q.eq('organizationId', args.organizationId))
      .first();

    if (!settings) {
      throw new Error('Audit settings not found for organization');
    }

    await ctx.db.patch(settings._id, {
      retentionDays: args.retentionDays ?? settings.retentionDays,
      updatedAt: Date.now(),
    });

    return null;
  },
});

