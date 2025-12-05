/**
 * RBAC Queries - Read-only access to cached WorkOS RBAC data
 *
 * ARCHITECTURE NOTE:
 * ==================
 * WorkOS is the SOURCE OF TRUTH for all RBAC data.
 * These queries read from the local Convex cache for fast, reactive access.
 *
 * To MODIFY roles/permissions:
 * - Use WorkOS Dashboard to configure roles and permissions
 * - Use WorkOS SDK to assign roles to users (e.g., workos.userManagement.updateOrganizationMembership)
 * - Changes sync to Convex automatically via webhooks
 *
 * DO NOT create mutations to modify RBAC data directly in Convex.
 */

import { v } from 'convex/values';
import { protectedQuery } from '../functions';

/**
 * Get all available roles from local cache.
 * Data is synced from WorkOS.
 */
export const listRoles = protectedQuery({
  args: {},

  handler: async (ctx) => {
    const roles = await ctx.db.query('roles').collect();

    return roles.map((role) => ({
      slug: role.slug,
      name: role.name,
      description: role.description,
      permissions: role.permissions,
      isDefault: role.isDefault,
    }));
  },
});

/**
 * Get all available permissions for display.
 */
export const listPermissions = protectedQuery({
  args: {},
  returns: v.array(
    v.object({
      slug: v.string(),
      name: v.string(),
      description: v.optional(v.string()),
      resource: v.string(),
      action: v.string(),
    }),
  ),
  handler: async (ctx) => {
    const permissions = await ctx.db.query('permissions').collect();

    return permissions.map((perm) => ({
      slug: perm.slug,
      name: perm.name,
      description: perm.description,
      resource: perm.resource,
      action: perm.action,
    }));
  },
});

/**
 * Get current user's permissions for a specific organization.
 */
export const getMyPermissions = protectedQuery({
  args: {
    organizationId: v.string(), // WorkOS organization external ID
  },
  returns: v.object({
    permissions: v.array(v.string()),
    roleSlug: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query('organizationMemberships')
      .withIndex('by_org_user', (q) => q.eq('organizationId', args.organizationId).eq('userId', ctx.user.externalId))
      .first();

    if (!membership) {
      return { permissions: [], roleSlug: undefined };
    }

    // Return cached permissions if available
    if (membership.permissions && membership.permissions.length > 0) {
      return {
        permissions: membership.permissions,
        roleSlug: membership.roleSlug ?? undefined,
      };
    }

    // Fall back to looking up role permissions if roleSlug is set
    if (membership.roleSlug) {
      const role = await ctx.db
        .query('roles')
        .withIndex('by_slug', (q) => q.eq('slug', membership.roleSlug!))
        .first();

      return {
        permissions: role?.permissions ?? [],
        roleSlug: membership.roleSlug,
      };
    }

    return { permissions: [], roleSlug: undefined };
  },
});

/**
 * Check if current user has a specific permission in an organization.
 */
export const hasPermission = protectedQuery({
  args: {
    organizationId: v.string(), // WorkOS organization external ID
    permission: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query('organizationMemberships')
      .withIndex('by_org_user', (q) => q.eq('organizationId', args.organizationId).eq('userId', ctx.user.externalId))
      .first();

    if (!membership) return false;

    // Get permissions (cached or from role)
    let permissions: string[] = [];

    if (membership.permissions && membership.permissions.length > 0) {
      permissions = membership.permissions;
    } else if (membership.roleSlug) {
      const role = await ctx.db
        .query('roles')
        .withIndex('by_slug', (q) => q.eq('slug', membership.roleSlug!))
        .first();
      permissions = role?.permissions ?? [];
    }

    // Check for super admin (full access bypass)
    if (permissions.includes('organization:administration:manage')) return true;

    // Check exact match
    if (permissions.includes(args.permission)) return true;

    // Check 'manage' wildcard (e.g., 'content:schemas:manage' grants 'content:schemas:read-only')
    const parts = args.permission.split(':');
    if (parts.length === 3) {
      const [domain, resource] = parts;
      if (permissions.includes(`${domain}:${resource}:manage`)) return true;
    }

    return false;
  },
});
