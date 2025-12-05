/**
 * RBAC Utility Functions - Permission checking helpers
 *
 * ARCHITECTURE NOTE:
 * ==================
 * These utilities help check permissions from the local Convex cache.
 * WorkOS is the SOURCE OF TRUTH for all RBAC data.
 *
 * Permission format: {domain}:{resource}:{action}
 * Example: organization:membership:read-only
 *
 * Special permission:
 * - organization:administration:manage = Full access to everything
 *
 * To MODIFY roles/permissions:
 * - Use WorkOS Dashboard or WorkOS SDK
 * - Changes sync to Convex automatically via webhooks
 */

import { ConvexError } from 'convex/values';
import { DEFAULT_ROLE_PERMISSIONS } from '../types';

// Re-export for convenience
export { DEFAULT_ROLE_PERMISSIONS };

/** The super admin permission that grants full access to everything */
export const SUPER_ADMIN_PERMISSION = 'organization:administration:manage';

/**
 * Check if a user has a specific permission.
 *
 * Permission resolution order:
 * 1. Super admin bypass: 'organization:administration:manage' grants all permissions
 * 2. Exact match: e.g., 'content:schemas:read-only'
 * 3. Manage wildcard: e.g., 'content:schemas:manage' grants all 'content:schemas:*' actions
 *
 * @param userPermissions - Array of permission strings the user has
 * @param required - The permission to check for (format: domain:resource:action)
 * @returns true if the user has the permission, false otherwise
 */
export function hasPermission(userPermissions: string[], required: string): boolean {
  // 1. Check for super admin (full access bypass)
  if (userPermissions.includes(SUPER_ADMIN_PERMISSION)) return true;

  // 2. Check exact match
  if (userPermissions.includes(required)) return true;

  // 3. Check 'manage' wildcard (e.g., 'content:schemas:manage' grants 'content:schemas:read-only')
  const parts = required.split(':');
  if (parts.length === 3) {
    const [domain, resource] = parts;
    const managePermission = `${domain}:${resource}:manage`;
    if (userPermissions.includes(managePermission)) return true;
  }

  return false;
}

/**
 * Check if a user has any of the specified permissions.
 *
 * @param userPermissions - Array of permission strings the user has
 * @param required - Array of permissions to check for (at least one must match)
 * @returns true if the user has at least one of the permissions
 */
export function hasAnyPermission(userPermissions: string[], required: string[]): boolean {
  return required.some((p) => hasPermission(userPermissions, p));
}

/**
 * Check if a user has all of the specified permissions.
 *
 * @param userPermissions - Array of permission strings the user has
 * @param required - Array of permissions to check for (all must match)
 * @returns true if the user has all of the permissions
 */
export function hasAllPermissions(userPermissions: string[], required: string[]): boolean {
  return required.every((p) => hasPermission(userPermissions, p));
}

/**
 * Get permissions for a role slug using default mappings.
 * Falls back to empty array if role is not recognized.
 *
 * @param roleSlug - The role slug (e.g., 'owner', 'admin', 'member')
 * @param customMappings - Optional custom role → permissions mappings (overrides defaults)
 * @returns Array of permission strings for the role
 */
export function getPermissionsForRole(
  roleSlug: string | undefined | null,
  customMappings?: Record<string, string[]>,
): string[] {
  if (!roleSlug) return [];

  // Use custom mappings if provided, otherwise use defaults
  const mappings = customMappings ?? DEFAULT_ROLE_PERMISSIONS;
  return mappings[roleSlug] ?? [];
}

/**
 * Membership type for permission lookups.
 */
interface MembershipWithPermissions {
  permissions?: string[];
  roleSlug?: string;
}

/**
 * Context type for permission checking functions.
 * Must have access to db for querying memberships.
 */
interface PermissionCheckContext {
  db: {
    query: (table: 'organizationMemberships') => {
      withIndex: (
        indexName: string,
        fn: (q: { eq: (field: string, value: string) => { eq: (field: string, value: string) => unknown } }) => unknown,
      ) => { first: () => Promise<MembershipWithPermissions | null> };
    };
  };
}

/**
 * Get all permissions for a user in a specific organization.
 *
 * @param ctx - Convex context with db access
 * @param userExternalId - WorkOS user ID (externalId)
 * @param orgExternalId - WorkOS organization ID (externalId)
 * @returns Array of permission strings, or empty array if no membership found
 */
export async function getUserPermissions(
  ctx: PermissionCheckContext,
  userExternalId: string,
  orgExternalId: string,
): Promise<string[]> {
  const membership = await ctx.db
    .query('organizationMemberships')
    .withIndex(
      'by_org_user',
      (q: { eq: (field: string, value: string) => { eq: (field: string, value: string) => unknown } }) =>
        q.eq('organizationId', orgExternalId).eq('userId', userExternalId),
    )
    .first();

  if (!membership) return [];

  // Return cached permissions if available
  if (membership.permissions && membership.permissions.length > 0) {
    return membership.permissions;
  }

  // Fall back to role-based permissions lookup would require async import
  // For now, return empty array - permissions should be denormalized on membership
  return [];
}

/**
 * Check if a user has a specific permission in an organization.
 * Throws ConvexError if permission is missing.
 *
 * @param ctx - Convex context with db access
 * @param userExternalId - WorkOS user ID (externalId)
 * @param orgExternalId - WorkOS organization ID (externalId)
 * @param permission - The permission to check for
 * @throws ConvexError if user doesn't have the permission
 */
export async function requirePermission(
  ctx: PermissionCheckContext,
  userExternalId: string,
  orgExternalId: string,
  permission: string,
): Promise<void> {
  const permissions = await getUserPermissions(ctx, userExternalId, orgExternalId);

  if (!hasPermission(permissions, permission)) {
    throw new ConvexError(`Missing permission: ${permission}`);
  }
}

/**
 * Check if a user has a specific permission in an organization.
 * Returns boolean instead of throwing.
 *
 * @param ctx - Convex context with db access
 * @param userExternalId - WorkOS user ID (externalId)
 * @param orgExternalId - WorkOS organization ID (externalId)
 * @param permission - The permission to check for
 * @returns true if user has the permission, false otherwise
 */
export async function checkPermission(
  ctx: PermissionCheckContext,
  userExternalId: string,
  orgExternalId: string,
  permission: string,
): Promise<boolean> {
  const permissions = await getUserPermissions(ctx, userExternalId, orgExternalId);
  return hasPermission(permissions, permission);
}

/**
 * Valid domains for the three-level permission format.
 */
export const VALID_DOMAINS = ['organization', 'content', 'finance', 'audit'] as const;

/**
 * Valid resources within each domain.
 */
export const VALID_RESOURCES: Record<string, string[]> = {
  organization: ['membership', 'settings', 'administration'],
  content: ['schemas', 'rules'],
  finance: ['billing', 'invoices', 'reports'],
  audit: ['logs'],
};

/**
 * Valid actions for permissions.
 */
export const VALID_ACTIONS = ['read-only', 'create', 'update', 'delete', 'invite', 'export', 'manage'] as const;

/**
 * Validate that a string is a valid permission format.
 * Valid format: '{domain}:{resource}:{action}'
 *
 * @param permission - String to validate
 * @returns true if valid permission format
 */
export function isValidPermission(permission: string): boolean {
  const parts = permission.split(':');
  if (parts.length !== 3) return false;

  const [domain, resource, action] = parts;

  // Check domain
  if (!VALID_DOMAINS.includes(domain as (typeof VALID_DOMAINS)[number])) return false;

  // Check resource within domain
  const validResources = VALID_RESOURCES[domain];
  if (!validResources || !validResources.includes(resource)) return false;

  // Check action
  if (!VALID_ACTIONS.includes(action as (typeof VALID_ACTIONS)[number])) return false;

  return true;
}

/**
 * Parse a permission string into domain, resource, and action components.
 *
 * @param permission - Permission string (e.g., 'content:schemas:read-only')
 * @returns Object with domain, resource, and action, or null if invalid
 */
export function parsePermission(permission: string): { domain: string; resource: string; action: string } | null {
  const parts = permission.split(':');
  if (parts.length !== 3) return null;

  const [domain, resource, action] = parts;
  return { domain, resource, action };
}
