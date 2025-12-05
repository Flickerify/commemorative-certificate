/**
 * RBAC Internal Mutations - Sync handlers from WorkOS
 *
 * ARCHITECTURE NOTE:
 * ==================
 * WorkOS is the SOURCE OF TRUTH for all RBAC data (roles, permissions, memberships).
 * Convex serves as a READ CACHE for fast queries without hitting the WorkOS API.
 *
 * Data Flow:
 * 1. Admin configures roles/permissions in WorkOS Dashboard
 * 2. User roles are assigned via WorkOS SDK (e.g., workos.userManagement.updateOrganizationMembership)
 * 3. WorkOS sends webhooks → Convex syncs the data locally
 * 4. Frontend queries Convex for fast, reactive permission checks
 *
 * DO NOT call these mutations directly from client code.
 * They are INTERNAL and should only be invoked from:
 * - Webhook handlers (convex/workos/events/process.ts)
 * - Scheduled sync jobs (for reconciliation)
 */

import { v } from 'convex/values';
import { internalMutation } from '../../functions';
import { roleSourceValidator } from '../../schema';

// ============================================================
// ROLE SYNC (from WorkOS webhooks/API)
// ============================================================

/**
 * Sync a role from WorkOS to local cache.
 * Called by webhook handlers when role data is received from WorkOS.
 *
 * @internal Only call from webhook handlers or sync jobs
 */
export const syncRoleFromWorkos = internalMutation({
  args: {
    slug: v.string(),
    permissions: v.array(v.string()),
    source: roleSourceValidator,
    organizationId: v.optional(v.id('organizations')),
  },
  returns: v.id('roles'),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if role already exists
    const existing = await ctx.db
      .query('roles')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        permissions: args.permissions,
        source: args.source,
        organizationId: args.organizationId,
        isDefault: false,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert('roles', {
      slug: args.slug,
      permissions: args.permissions,
      source: args.source,
      organizationId: args.organizationId,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Remove a role from local cache.
 * Called when a role is deleted in WorkOS.
 *
 * @internal Only call from webhook handlers or sync jobs
 */
export const removeRoleFromCache = internalMutation({
  args: {
    slug: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('roles')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return true;
    }

    return false;
  },
});

// ============================================================
// PERMISSION SYNC (from WorkOS webhooks/API)
// ============================================================

/**
 * Sync a permission from WorkOS to local cache.
 * Called by webhook handlers when permission data is received from WorkOS.
 *
 * @internal Only call from webhook handlers or sync jobs
 */
export const syncPermissionFromWorkos = internalMutation({
  args: {
    slug: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    resource: v.string(),
    action: v.string(),
  },
  returns: v.id('permissions'),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if permission already exists
    const existing = await ctx.db
      .query('permissions')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        description: args.description,
        resource: args.resource,
        action: args.action,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert('permissions', {
      slug: args.slug,
      name: args.name,
      description: args.description,
      resource: args.resource,
      action: args.action,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Remove a permission from local cache.
 * Called when a permission is deleted in WorkOS.
 *
 * @internal Only call from webhook handlers or sync jobs
 */
export const removePermissionFromCache = internalMutation({
  args: {
    slug: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('permissions')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return true;
    }

    return false;
  },
});

// ============================================================
// MEMBERSHIP PERMISSION SYNC (from WorkOS webhooks)
// ============================================================

/**
 * Update cached permissions on a membership.
 * Called from membership webhook handler after receiving role update from WorkOS.
 *
 * @internal Only call from webhook handlers
 */
export const syncMembershipPermissions = internalMutation({
  args: {
    organizationId: v.string(),
    userId: v.string(),
    roleSlug: v.optional(v.string()),
    permissions: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('organizationMemberships')
      .withIndex('by_org_user', (q) => q.eq('organizationId', args.organizationId).eq('userId', args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        roleSlug: args.roleSlug,
        permissions: args.permissions,
        updatedAt: Date.now(),
      });
    }

    return null;
  },
});

/**
 * Bulk update permissions for all memberships with a specific role.
 * Called when WorkOS sends an event that a role's permissions have changed.
 *
 * @internal Only call from webhook handlers or sync jobs
 */
export const syncPermissionsForRole = internalMutation({
  args: {
    roleSlug: v.string(),
    newPermissions: v.array(v.string()),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    // Get all memberships with this role
    const memberships = await ctx.db.query('organizationMemberships').collect();

    let updatedCount = 0;

    for (const membership of memberships) {
      if (membership.roleSlug === args.roleSlug) {
        await ctx.db.patch(membership._id, {
          permissions: args.newPermissions,
          updatedAt: Date.now(),
        });
        updatedCount++;
      }
    }

    return updatedCount;
  },
});

// ============================================================
// CACHE INITIALIZATION (one-time setup to match WorkOS)
// ============================================================

/**
 * Initialize permission cache with default values.
 * This should be run ONCE during initial setup and the values
 * MUST match what is configured in WorkOS Dashboard.
 *
 * After initial setup, all changes should come through WorkOS webhooks.
 *
 * @internal One-time setup only
 */
export const initializePermissionCache = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();

    // These MUST match the permissions configured in WorkOS Dashboard
    // Format: {domain}:{resource}:{action}
    const permissions = [
      // Organization domain - Membership
      {
        slug: 'organization:membership:read-only',
        description: 'View team members',
        name: 'View Team Members',
        resource: 'membership',
        action: 'read-only',
      },
      {
        slug: 'organization:membership:invite',
        description: 'Invite members',
        name: 'Invite Members',
        resource: 'membership',
        action: 'invite',
      },
      {
        slug: 'organization:membership:update',
        description: 'Update member roles',
        name: 'Update Member Roles',
        resource: 'membership',
        action: 'update',
      },
      {
        slug: 'organization:membership:delete',
        description: 'Remove members',
        name: 'Remove Members',
        resource: 'membership',
        action: 'delete',
      },
      {
        slug: 'organization:membership:manage',
        description: 'Full membership access',
        name: 'Full Membership Access',
        resource: 'membership',
        action: 'manage',
      },

      // Organization domain - Settings
      {
        slug: 'organization:settings:read-only',
        description: 'View settings',
        name: 'View Settings',
        resource: 'settings',
        action: 'read-only',
      },
      {
        slug: 'organization:settings:update',
        description: 'Update settings',
        name: 'Update Settings',
        resource: 'settings',
        action: 'update',
      },
      {
        slug: 'organization:settings:manage',
        description: 'Full settings access',
        name: 'Full Settings Access',
        resource: 'settings',
        action: 'manage',
      },

      // Organization domain - Administration (super admin)
      {
        slug: 'organization:administration:manage',
        description: 'Full organization administration',
        name: 'Organization Administrator',
        resource: 'administration',
        action: 'manage',
      },

      // Content domain - Schemas
      {
        slug: 'content:schemas:read-only',
        description: 'View schemas',
        name: 'View Schemas',
        resource: 'schemas',
        action: 'read-only',
      },
      {
        slug: 'content:schemas:create',
        description: 'Create schemas',
        name: 'Create Schemas',
        resource: 'schemas',
        action: 'create',
      },
      {
        slug: 'content:schemas:update',
        description: 'Update schemas',
        name: 'Update Schemas',
        resource: 'schemas',
        action: 'update',
      },
      {
        slug: 'content:schemas:delete',
        description: 'Delete schemas',
        name: 'Delete Schemas',
        resource: 'schemas',
        action: 'delete',
      },
      {
        slug: 'content:schemas:manage',
        description: 'Full schema access',
        name: 'Full Schema Access',
        resource: 'schemas',
        action: 'manage',
      },

      // Content domain - Rules
      {
        slug: 'content:rules:read-only',
        description: 'View rules',
        name: 'View Rules',
        resource: 'rules',
        action: 'read-only',
      },
      {
        slug: 'content:rules:create',
        description: 'Create rules',
        name: 'Create Rules',
        resource: 'rules',
        action: 'create',
      },
      {
        slug: 'content:rules:update',
        description: 'Update rules',
        name: 'Update Rules',
        resource: 'rules',
        action: 'update',
      },
      {
        slug: 'content:rules:delete',
        description: 'Delete rules',
        name: 'Delete Rules',
        resource: 'rules',
        action: 'delete',
      },
      {
        slug: 'content:rules:manage',
        description: 'Full rules access',
        name: 'Full Rules Access',
        resource: 'rules',
        action: 'manage',
      },

      // Finance domain - Billing
      {
        slug: 'finance:billing:read-only',
        description: 'View billing',
        name: 'View Billing',
        resource: 'billing',
        action: 'read-only',
      },
      {
        slug: 'finance:billing:update',
        description: 'Update billing',
        name: 'Update Billing',
        resource: 'billing',
        action: 'update',
      },
      {
        slug: 'finance:billing:manage',
        description: 'Full billing access',
        name: 'Full Billing Access',
        resource: 'billing',
        action: 'manage',
      },

      // Finance domain - Invoices
      {
        slug: 'finance:invoices:read-only',
        description: 'View invoices',
        name: 'View Invoices',
        resource: 'invoices',
        action: 'read-only',
      },
      {
        slug: 'finance:invoices:export',
        description: 'Export invoices',
        name: 'Export Invoices',
        resource: 'invoices',
        action: 'export',
      },
      {
        slug: 'finance:invoices:manage',
        description: 'Full invoice access',
        name: 'Full Invoice Access',
        resource: 'invoices',
        action: 'manage',
      },

      // Finance domain - Reports
      {
        slug: 'finance:reports:read-only',
        description: 'View financial reports',
        name: 'View Financial Reports',
        resource: 'reports',
        action: 'read-only',
      },
      {
        slug: 'finance:reports:export',
        description: 'Export financial reports',
        name: 'Export Financial Reports',
        resource: 'reports',
        action: 'export',
      },
      {
        slug: 'finance:reports:manage',
        description: 'Full reports access',
        name: 'Full Reports Access',
        resource: 'reports',
        action: 'manage',
      },

      // Audit domain - Logs
      {
        slug: 'audit:logs:read-only',
        description: 'View audit logs',
        name: 'View Audit Logs',
        resource: 'logs',
        action: 'read-only',
      },
      {
        slug: 'audit:logs:export',
        description: 'Export audit logs',
        name: 'Export Audit Logs',
        resource: 'logs',
        action: 'export',
      },
      {
        slug: 'audit:logs:manage',
        description: 'Full audit access',
        name: 'Full Audit Access',
        resource: 'logs',
        action: 'manage',
      },
    ];

    let insertedCount = 0;

    for (const perm of permissions) {
      const existing = await ctx.db
        .query('permissions')
        .withIndex('by_slug', (q) => q.eq('slug', perm.slug))
        .first();

      if (!existing) {
        await ctx.db.insert('permissions', { ...perm, createdAt: now, updatedAt: now });
        insertedCount++;
      }
    }

    return insertedCount;
  },
});

/**
 * Initialize role cache with default values.
 * This should be run ONCE during initial setup and the values
 * MUST match what is configured in WorkOS Dashboard.
 *
 * After initial setup, all changes should come through WorkOS webhooks.
 *
 * @internal One-time setup only
 */
export const initializeRoleCache = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();

    // These MUST match the roles configured in WorkOS Dashboard
    // Permission format: {domain}:{resource}:{action}
    const roles = [
      {
        slug: 'owner',
        name: 'Owner',
        description: 'Full access to all organization features',
        permissions: ['organization:administration:manage'],
        isDefault: false,
      },
      {
        slug: 'admin',
        name: 'Admin',
        description: 'Administrative access to most organization features',
        permissions: [
          'content:schemas:manage',
          'content:rules:manage',
          'organization:membership:manage',
          'organization:settings:manage',
          'finance:billing:read-only',
        ],
        isDefault: false,
      },
      {
        slug: 'finance',
        name: 'Finance',
        description: 'Full access to billing, invoices, and financial reports',
        permissions: [
          'finance:billing:manage',
          'finance:invoices:manage',
          'finance:reports:manage',
          'audit:logs:read-only',
          'organization:settings:read-only',
        ],
        isDefault: false,
      },
      {
        slug: 'editor',
        name: 'Editor',
        description: 'Can create and edit schemas and rules',
        permissions: ['content:schemas:manage', 'content:rules:manage'],
        isDefault: false,
      },
      {
        slug: 'member',
        name: 'Member',
        description: 'Basic read access to schemas and rules',
        permissions: ['content:schemas:read-only', 'content:rules:read-only'],
        isDefault: true,
      },
    ];

    let insertedCount = 0;

    for (const role of roles) {
      const existing = await ctx.db
        .query('roles')
        .withIndex('by_slug', (q) => q.eq('slug', role.slug))
        .first();

      if (!existing) {
        await ctx.db.insert('roles', { ...role, source: 'environment', createdAt: now, updatedAt: now });
        insertedCount++;
      }
    }

    return insertedCount;
  },
});
