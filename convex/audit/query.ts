import { v } from 'convex/values';
import { paginationOptsValidator } from 'convex/server';
import { protectedQuery } from '../functions';
import { auditCategoryValidator, auditStatusValidator, DEFAULT_AUDIT_RETENTION_DAYS } from '../schema';
import type { Id } from '../_generated/dataModel';

/**
 * List audit logs for an organization with pagination and filtering.
 * Uses Convex's built-in pagination with paginationOptsValidator.
 *
 * For search queries, we use the search index with .take() since search
 * doesn't support cursor-based pagination.
 */
export const listAuditLogs = protectedQuery({
  args: {
    organizationId: v.string(),
    paginationOpts: paginationOptsValidator,
    // Filters
    category: v.optional(auditCategoryValidator),
    status: v.optional(auditStatusValidator),
    actorId: v.optional(v.id('users')),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    searchQuery: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get the organization by external ID
    const organization = await ctx.db
      .query('organizations')
      .withIndex('externalId', (q) => q.eq('externalId', args.organizationId))
      .first();

    if (!organization) {
      throw new Error('Organization not found');
    }

    // Check if organization is enterprise
    const subscription = await ctx.db
      .query('organizationSubscriptions')
      .withIndex('by_organization_and_status', (q) => q.eq('organizationId', organization._id).eq('status', 'active'))
      .first();

    if (!subscription || subscription.tier !== 'enterprise') {
      // Return empty pagination result for non-enterprise
      return {
        page: [],
        isDone: true,
        continueCursor: '',
      };
    }

    // Verify user is a member of the organization with admin access
    const membership = await ctx.db
      .query('organizationMemberships')
      .withIndex('by_org_user', (q) => q.eq('organizationId', args.organizationId).eq('userId', ctx.user.externalId))
      .first();

    if (!membership || (membership.roleSlug !== 'admin' && membership.roleSlug !== 'owner')) {
      throw new Error('Only admins can view audit logs');
    }

    // Use full-text search when searchQuery is provided
    // Note: Search queries don't support cursor-based pagination, so we use .take()
    if (args.searchQuery && args.searchQuery.trim().length > 0) {
      const searchResults = await ctx.db
        .query('auditLogs')
        .withSearchIndex('search_description', (q) => {
          let search = q.search('description', args.searchQuery!).eq('organizationId', organization._id);
          if (args.category) {
            search = search.eq('category', args.category);
          }
          if (args.status) {
            search = search.eq('status', args.status);
          }
          if (args.actorId) {
            search = search.eq('actorId', args.actorId);
          }
          return search;
        })
        .take(args.paginationOpts.numItems + 1);

      // Apply date filters in memory (search doesn't support range queries)
      let filteredResults = searchResults;
      if (args.startDate) {
        filteredResults = filteredResults.filter((log) => log.timestamp >= args.startDate!);
      }
      if (args.endDate) {
        filteredResults = filteredResults.filter((log) => log.timestamp <= args.endDate!);
      }

      // Search doesn't support proper cursor pagination, return what we have
      const hasMore = filteredResults.length > args.paginationOpts.numItems;
      const page = filteredResults.slice(0, args.paginationOpts.numItems);

      return {
        page,
        isDone: !hasMore,
        continueCursor: '',
      };
    }

    // Build query based on filters using indexes and use .paginate()
    let queryBuilder;

    if (args.actorId) {
      queryBuilder = ctx.db
        .query('auditLogs')
        .withIndex('by_organization_and_actor', (q) =>
          q.eq('organizationId', organization._id).eq('actorId', args.actorId!),
        );
    } else if (args.status) {
      queryBuilder = ctx.db
        .query('auditLogs')
        .withIndex('by_organization_and_status', (q) =>
          q.eq('organizationId', organization._id).eq('status', args.status!),
        );
    } else if (args.category) {
      queryBuilder = ctx.db
        .query('auditLogs')
        .withIndex('by_organization_and_category', (q) =>
          q.eq('organizationId', organization._id).eq('category', args.category!),
        );
    } else {
      queryBuilder = ctx.db
        .query('auditLogs')
        .withIndex('by_organization_and_timestamp', (q) => q.eq('organizationId', organization._id));
    }

    // Paginate with descending order (newest first)
    const paginatedResult = await queryBuilder.order('desc').paginate(args.paginationOpts);

    // Apply additional filters to the page (may result in smaller page sizes)
    let filteredPage = paginatedResult.page;

    // Apply category filter if we're using a different primary index
    if (args.category && (args.actorId || args.status)) {
      filteredPage = filteredPage.filter((log) => log.category === args.category);
    }

    // Apply status filter if using actor index
    if (args.status && args.actorId) {
      filteredPage = filteredPage.filter((log) => log.status === args.status);
    }

    // Apply date filters
    if (args.startDate) {
      filteredPage = filteredPage.filter((log) => log.timestamp >= args.startDate!);
    }
    if (args.endDate) {
      filteredPage = filteredPage.filter((log) => log.timestamp <= args.endDate!);
    }

    return {
      ...paginatedResult,
      page: filteredPage,
    };
  },
});

/**
 * Get a single audit log entry by ID.
 */
export const getAuditLog = protectedQuery({
  args: {
    organizationId: v.string(),
    auditLogId: v.id('auditLogs'),
  },
  handler: async (ctx, args) => {
    // Get the organization by external ID
    const organization = await ctx.db
      .query('organizations')
      .withIndex('externalId', (q) => q.eq('externalId', args.organizationId))
      .first();

    if (!organization) {
      throw new Error('Organization not found');
    }

    // Verify user is admin
    const membership = await ctx.db
      .query('organizationMemberships')
      .withIndex('by_org_user', (q) => q.eq('organizationId', args.organizationId).eq('userId', ctx.user.externalId))
      .first();

    if (!membership || (membership.roleSlug !== 'admin' && membership.roleSlug !== 'owner')) {
      throw new Error('Only admins can view audit logs');
    }

    const auditLog = await ctx.db.get(args.auditLogId);

    if (!auditLog || auditLog.organizationId !== organization._id) {
      return null;
    }

    return auditLog;
  },
});

/**
 * Get audit settings and statistics for an organization.
 */
export const getAuditOverview = protectedQuery({
  args: {
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get the organization by external ID
    const organization = await ctx.db
      .query('organizations')
      .withIndex('externalId', (q) => q.eq('externalId', args.organizationId))
      .first();

    if (!organization) {
      throw new Error('Organization not found');
    }

    // Check subscription tier
    const subscription = await ctx.db
      .query('organizationSubscriptions')
      .withIndex('by_organization_and_status', (q) => q.eq('organizationId', organization._id).eq('status', 'active'))
      .first();

    const isEnterprise = subscription?.tier === 'enterprise';

    // Verify user is admin
    const membership = await ctx.db
      .query('organizationMemberships')
      .withIndex('by_org_user', (q) => q.eq('organizationId', args.organizationId).eq('userId', ctx.user.externalId))
      .first();

    const isAdmin = membership?.roleSlug === 'admin' || membership?.roleSlug === 'owner';

    if (!isEnterprise) {
      return {
        isEnabled: false,
        isEnterprise: false,
        isAdmin,
        settings: null,
        stats: null,
      };
    }

    // Get audit settings
    const settings = await ctx.db
      .query('organizationAuditSettings')
      .withIndex('by_organization', (q) => q.eq('organizationId', organization._id))
      .first();

    // Calculate statistics
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const allLogs = await ctx.db
      .query('auditLogs')
      .withIndex('by_organization_and_timestamp', (q) => q.eq('organizationId', organization._id))
      .collect();

    const totalLogs = allLogs.length;
    const logsLast24h = allLogs.filter((log) => log.timestamp >= oneDayAgo).length;
    const logsLast7d = allLogs.filter((log) => log.timestamp >= sevenDaysAgo).length;
    const logsLast30d = allLogs.filter((log) => log.timestamp >= thirtyDaysAgo).length;

    // Category breakdown
    const categoryBreakdown: Record<string, number> = {};
    for (const log of allLogs.filter((log) => log.timestamp >= thirtyDaysAgo)) {
      categoryBreakdown[log.category] = (categoryBreakdown[log.category] || 0) + 1;
    }

    // Get oldest and newest log timestamps
    const timestamps = allLogs.map((log) => log.timestamp);
    const oldestLog = timestamps.length > 0 ? Math.min(...timestamps) : null;
    const newestLog = timestamps.length > 0 ? Math.max(...timestamps) : null;

    return {
      isEnabled: true,
      isEnterprise: true,
      isAdmin,
      settings: settings
        ? {
            retentionDays: settings.retentionDays,
            isRetentionUpgradable: settings.isRetentionUpgradable,
          }
        : {
            retentionDays: DEFAULT_AUDIT_RETENTION_DAYS,
            isRetentionUpgradable: false,
          },
      stats: {
        totalLogs,
        logsLast24h,
        logsLast7d,
        logsLast30d,
        categoryBreakdown,
        oldestLog,
        newestLog,
      },
    };
  },
});

/**
 * Search organization members for the actor filter dropdown.
 * Returns members matching the search query (email or name).
 */
export const searchOrganizationMembers = protectedQuery({
  args: {
    organizationId: v.string(),
    searchQuery: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;

    // Get the organization by external ID
    const organization = await ctx.db
      .query('organizations')
      .withIndex('externalId', (q) => q.eq('externalId', args.organizationId))
      .first();

    if (!organization) {
      throw new Error('Organization not found');
    }

    // Verify user is admin
    const membership = await ctx.db
      .query('organizationMemberships')
      .withIndex('by_org_user', (q) => q.eq('organizationId', args.organizationId).eq('userId', ctx.user.externalId))
      .first();

    if (!membership || (membership.roleSlug !== 'admin' && membership.roleSlug !== 'owner')) {
      throw new Error('Only admins can search members');
    }

    // Get all memberships for this organization
    const memberships = await ctx.db
      .query('organizationMemberships')
      .withIndex('by_org', (q) => q.eq('organizationId', args.organizationId))
      .collect();

    // Get user details for each membership
    const members: Array<{
      id: Id<'users'>;
      externalId: string;
      email: string;
      name: string;
      firstName: string | null;
      lastName: string | null;
      role: string;
    }> = [];

    for (const m of memberships) {
      const user = await ctx.db
        .query('users')
        .withIndex('by_external_id', (q) => q.eq('externalId', m.userId))
        .first();

      if (user) {
        const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
        members.push({
          id: user._id,
          externalId: user.externalId,
          email: user.email,
          name: fullName,
          firstName: user.firstName,
          lastName: user.lastName,
          role: m.roleSlug ?? 'member',
        });
      }
    }

    // Filter by search query if provided
    let filteredMembers = members;
    if (args.searchQuery && args.searchQuery.trim().length > 0) {
      const query = args.searchQuery.toLowerCase();
      filteredMembers = members.filter(
        (member) =>
          member.email.toLowerCase().includes(query) ||
          member.name.toLowerCase().includes(query) ||
          member.firstName?.toLowerCase().includes(query) ||
          member.lastName?.toLowerCase().includes(query),
      );
    }

    // Sort by name and limit results
    return filteredMembers.sort((a, b) => a.name.localeCompare(b.name)).slice(0, limit);
  },
});

/**
 * Get available filter options for audit logs.
 */
export const getAuditFilterOptions = protectedQuery({
  args: {
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get the organization by external ID
    const organization = await ctx.db
      .query('organizations')
      .withIndex('externalId', (q) => q.eq('externalId', args.organizationId))
      .first();

    if (!organization) {
      throw new Error('Organization not found');
    }

    // Get distinct actors who have logged events
    const allLogs = await ctx.db
      .query('auditLogs')
      .withIndex('by_organization', (q) => q.eq('organizationId', organization._id))
      .collect();

    // Build unique actors list
    const actorMap = new Map<
      string,
      { id: string; email: string | undefined; name: string | undefined; type: string }
    >();

    for (const log of allLogs) {
      const key = log.actorId || log.actorExternalId || 'system';
      if (!actorMap.has(key)) {
        actorMap.set(key, {
          id: key,
          email: log.actorEmail,
          name: log.actorName,
          type: log.actorType,
        });
      }
    }

    // Build unique categories and actions
    const categories = [...new Set(allLogs.map((log) => log.category))];
    const actions = [...new Set(allLogs.map((log) => log.action))];

    return {
      actors: Array.from(actorMap.values()),
      categories,
      actions,
    };
  },
});
