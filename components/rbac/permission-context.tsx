'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useAuth } from '@workos-inc/authkit-nextjs/components';

/** The super admin permission that grants full access to everything */
const SUPER_ADMIN_PERMISSION = 'organization:administration:manage';

/**
 * Permission context value type.
 */
interface PermissionContextValue {
  /** Array of permission strings the user has for the current organization */
  permissions: string[];
  /** User's role slug in the current organization */
  roleSlug: string | undefined;
  /** Whether permissions are still loading */
  isLoading: boolean;
  /** Check if user has a specific permission */
  hasPermission: (permission: string) => boolean;
  /** Check if user has any of the specified permissions */
  hasAnyPermission: (permissions: string[]) => boolean;
  /** Check if user has all of the specified permissions */
  hasAllPermissions: (permissions: string[]) => boolean;
  /** Whether user is organization admin (has organization:administration:manage permission) */
  isOrgAdmin: boolean;
}

const PermissionContext = createContext<PermissionContextValue | null>(null);

/**
 * Check if a user has a specific permission.
 *
 * Permission resolution (format: {domain}:{resource}:{action}):
 * 1. Super admin bypass: 'organization:administration:manage' grants all permissions
 * 2. Exact match: e.g., 'content:schemas:read-only'
 * 3. Manage wildcard: e.g., 'content:schemas:manage' grants all 'content:schemas:*' actions
 */
function checkPermission(userPermissions: string[], required: string): boolean {
  // 1. Check for super admin (full access bypass)
  if (userPermissions.includes(SUPER_ADMIN_PERMISSION)) return true;

  // 2. Check exact match
  if (userPermissions.includes(required)) return true;

  // 3. Check 'manage' wildcard (e.g., 'content:schemas:manage' grants 'content:schemas:read-only')
  const parts = required.split(':');
  if (parts.length === 3) {
    const [domain, resource] = parts;
    if (userPermissions.includes(`${domain}:${resource}:manage`)) return true;
  }

  return false;
}

interface PermissionProviderProps {
  readonly children: ReactNode;
}

/**
 * Provider component that provides permission context from WorkOS JWT.
 *
 * ARCHITECTURE NOTE:
 * ==================
 * Permissions come directly from the WorkOS JWT access token.
 * This is the most efficient approach because:
 * 1. No database queries needed
 * 2. Permissions are always fresh (reflect current WorkOS state)
 * 3. No round-trip latency
 *
 * The JWT includes:
 * - `role`: the role of the selected organization membership
 * - `permissions`: the permissions assigned to the role
 *
 * WorkOS is the SOURCE OF TRUTH for all RBAC data.
 */
export function PermissionProvider({ children }: PermissionProviderProps) {
  // Get permissions directly from WorkOS JWT via useAuth
  const { permissions: jwtPermissions, role, loading } = useAuth();

  const value = useMemo<PermissionContextValue>(() => {
    // Permissions come directly from the JWT
    const permissions = jwtPermissions ?? [];
    const roleSlug = role;
    const isLoading = loading;

    return {
      permissions,
      roleSlug,
      isLoading,
      hasPermission: (permission: string) => checkPermission(permissions, permission),
      hasAnyPermission: (perms: string[]) => perms.some((p) => checkPermission(permissions, p)),
      hasAllPermissions: (perms: string[]) => perms.every((p) => checkPermission(permissions, p)),
      isOrgAdmin: permissions.includes(SUPER_ADMIN_PERMISSION),
    };
  }, [jwtPermissions, role, loading]);

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

/**
 * Hook to access the permission context.
 * Must be used within a PermissionProvider.
 */
export function usePermissions(): PermissionContextValue {
  const context = useContext(PermissionContext);

  if (!context) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }

  return context;
}

/**
 * Hook to check if user has a specific permission.
 * Convenience wrapper around usePermissions().hasPermission().
 *
 * @param permission - The permission to check
 * @returns true if user has the permission, false otherwise
 */
export function usePermission(permission: string): boolean {
  const { hasPermission, isLoading } = usePermissions();

  // Return false while loading to prevent flashing
  if (isLoading) return false;

  return hasPermission(permission);
}

/**
 * Hook to check if user has any of the specified permissions.
 *
 * @param permissions - Array of permissions to check
 * @returns true if user has at least one of the permissions
 */
export function useAnyPermission(permissions: string[]): boolean {
  const { hasAnyPermission, isLoading } = usePermissions();

  if (isLoading) return false;

  return hasAnyPermission(permissions);
}

/**
 * Hook to check if user has all of the specified permissions.
 *
 * @param permissions - Array of permissions to check
 * @returns true if user has all of the permissions
 */
export function useAllPermissions(permissions: string[]): boolean {
  const { hasAllPermissions, isLoading } = usePermissions();

  if (isLoading) return false;

  return hasAllPermissions(permissions);
}

/**
 * Hook to check if user is organization admin.
 *
 * @returns true if user has organization:administration:manage permission
 */
export function useIsOrgAdmin(): boolean {
  const { isOrgAdmin, isLoading } = usePermissions();

  if (isLoading) return false;

  return isOrgAdmin;
}
