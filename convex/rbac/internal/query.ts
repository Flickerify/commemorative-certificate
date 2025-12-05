import { v } from 'convex/values';
import { internalQuery } from '../../functions';

/**
 * Get a role by slug.
 */
export const getRoleBySlug = internalQuery({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('roles')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .first();
  },
});

/**
 * Get all roles.
 */
export const getAllRoles = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('roles').collect();
  },
});

/**
 * Get the default role.
 */
export const getDefaultRole = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('roles')
      .withIndex('by_default', (q) => q.eq('isDefault', true))
      .first();
  },
});

/**
 * Get permissions for a role slug.
 * Returns the permissions array from the role, or empty array if not found.
 */
export const getPermissionsForRole = internalQuery({
  args: {
    roleSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const role = await ctx.db
      .query('roles')
      .withIndex('by_slug', (q) => q.eq('slug', args.roleSlug))
      .first();

    return role?.permissions ?? [];
  },
});

/**
 * Get a permission by slug.
 */
export const getPermissionBySlug = internalQuery({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('permissions')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .first();
  },
});

/**
 * Get all permissions.
 */
export const getAllPermissions = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('permissions').collect();
  },
});

/**
 * Get permissions by resource.
 */
export const getPermissionsByResource = internalQuery({
  args: {
    resource: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('permissions')
      .withIndex('by_resource', (q) => q.eq('resource', args.resource))
      .collect();
  },
});

/**
 * Get user permissions for an organization.
 * Looks up the membership and returns the cached permissions array.
 */
export const getUserOrgPermissions = internalQuery({
  args: {
    userExternalId: v.string(),
    orgExternalId: v.string(),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query('organizationMemberships')
      .withIndex('by_org_user', (q) => q.eq('organizationId', args.orgExternalId).eq('userId', args.userExternalId))
      .first();

    if (!membership) return [];

    // Return cached permissions if available
    if (membership.permissions && membership.permissions.length > 0) {
      return membership.permissions;
    }

    // Fall back to looking up role permissions if roleSlug is set
    if (membership.roleSlug) {
      const role = await ctx.db
        .query('roles')
        .withIndex('by_slug', (q) => q.eq('slug', membership.roleSlug!))
        .first();

      return role?.permissions ?? [];
    }

    return [];
  },
});
