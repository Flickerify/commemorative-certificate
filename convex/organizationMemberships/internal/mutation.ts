import { internalMutation } from '../../functions';
import { v } from 'convex/values';
import { getPermissionsForRole, DEFAULT_ROLE_PERMISSIONS } from '../../rbac/utils';

export const upsertFromWorkos = internalMutation({
  args: {
    organizationId: v.string(),
    userId: v.string(),
    roleSlug: v.optional(v.string()), // Role slug for RBAC (e.g., 'owner', 'admin', 'member', 'finance')
    status: v.union(v.literal('active'), v.literal('pending'), v.literal('inactive')),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { roleSlug } = args;

    // Get permissions from the roles table or fall back to defaults
    let permissions: string[] = [];
    if (roleSlug) {
      const role = await ctx.db
        .query('roles')
        .withIndex('by_slug', (q) => q.eq('slug', roleSlug))
        .first();

      if (role) {
        permissions = role.permissions;
      } else {
        // Fall back to default role permissions mapping
        permissions = getPermissionsForRole(roleSlug, DEFAULT_ROLE_PERMISSIONS);
      }
    }

    const existing = await ctx.db
      .query('organizationMemberships')
      .withIndex('by_org_user', (q) => q.eq('organizationId', args.organizationId).eq('userId', args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        roleSlug,
        permissions,
        status: args.status,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert('organizationMemberships', {
        organizationId: args.organizationId,
        userId: args.userId,
        roleSlug,
        permissions,
        status: args.status,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return null;
  },
});

export const deleteFromWorkos = internalMutation({
  args: {
    organizationId: v.string(),
    userId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('organizationMemberships')
      .withIndex('by_org_user', (q) => q.eq('organizationId', args.organizationId).eq('userId', args.userId))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return null;
  },
});
