import { internalMutation } from '../../functions';
import { v } from 'convex/values';
import { getPermissionsForRole, DEFAULT_ROLE_PERMISSIONS } from '../../rbac/utils';

export const upsertFromWorkos = internalMutation({
  args: {
    organizationId: v.string(),
    userId: v.string(),
    role: v.optional(v.string()), // Legacy: full role object as string
    roleSlug: v.optional(v.string()), // New: role slug for RBAC
    status: v.union(v.literal('active'), v.literal('pending'), v.literal('inactive')),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Determine role slug from args or extract from role string
    const roleSlug = args.roleSlug ?? args.role ?? undefined;

    // Try to get permissions from the roles table first
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
        role: args.role,
        roleSlug,
        permissions,
        status: args.status,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert('organizationMemberships', {
        organizationId: args.organizationId,
        userId: args.userId,
        role: args.role,
        roleSlug,
        permissions,
        status: args.status,
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
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('organizationMemberships')
      .withIndex('by_org_user', (q) => q.eq('organizationId', args.organizationId).eq('userId', args.userId))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
