import { v } from 'convex/values';
import { internalQuery } from '../../functions';
import { auditCategoryValidator, auditActionValidator, DEFAULT_AUDIT_RETENTION_DAYS } from '../../schema';

/**
 * Get audit settings for an organization.
 */
export const getAuditSettings = internalQuery({
  args: {
    organizationId: v.id('organizations'),
  },
  returns: v.union(
    v.object({
      _id: v.id('organizationAuditSettings'),
      organizationId: v.id('organizations'),
      retentionDays: v.number(),
      isRetentionUpgradable: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query('organizationAuditSettings')
      .withIndex('by_organization', (q) => q.eq('organizationId', args.organizationId))
      .first();

    if (!settings) {
      return null;
    }

    return {
      _id: settings._id,
      organizationId: settings.organizationId,
      retentionDays: settings.retentionDays,
      isRetentionUpgradable: settings.isRetentionUpgradable,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  },
});

/**
 * Check if an organization has audit logging enabled (enterprise tier).
 */
export const isAuditEnabled = internalQuery({
  args: {
    organizationId: v.id('organizations'),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query('organizationSubscriptions')
      .withIndex('by_organization_and_status', (q) => q.eq('organizationId', args.organizationId).eq('status', 'active'))
      .first();

    return subscription?.tier === 'enterprise';
  },
});

/**
 * Get audit statistics for an organization.
 */
export const getAuditStats = internalQuery({
  args: {
    organizationId: v.id('organizations'),
  },
  returns: v.object({
    totalLogs: v.number(),
    logsLast24h: v.number(),
    logsLast7d: v.number(),
    logsLast30d: v.number(),
    oldestLogTimestamp: v.optional(v.number()),
    newestLogTimestamp: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    // Get all logs for this organization (for total count)
    const allLogs = await ctx.db
      .query('auditLogs')
      .withIndex('by_organization_and_timestamp', (q) => q.eq('organizationId', args.organizationId))
      .collect();

    const totalLogs = allLogs.length;
    const logsLast24h = allLogs.filter((log) => log.timestamp >= oneDayAgo).length;
    const logsLast7d = allLogs.filter((log) => log.timestamp >= sevenDaysAgo).length;
    const logsLast30d = allLogs.filter((log) => log.timestamp >= thirtyDaysAgo).length;

    // Get oldest and newest timestamps
    const timestamps = allLogs.map((log) => log.timestamp);
    const oldestLogTimestamp = timestamps.length > 0 ? Math.min(...timestamps) : undefined;
    const newestLogTimestamp = timestamps.length > 0 ? Math.max(...timestamps) : undefined;

    return {
      totalLogs,
      logsLast24h,
      logsLast7d,
      logsLast30d,
      oldestLogTimestamp,
      newestLogTimestamp,
    };
  },
});

