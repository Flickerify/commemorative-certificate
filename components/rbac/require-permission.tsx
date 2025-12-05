'use client';

import type { ReactNode } from 'react';
import { usePermissions } from './permission-context';

interface RequirePermissionProps {
  /** The permission required to render children */
  readonly permission: string;
  /** Content to render when user has permission */
  readonly children: ReactNode;
  /** Optional fallback to render when user lacks permission */
  readonly fallback?: ReactNode;
  /** If true, show nothing while loading (default: true) */
  readonly hideWhileLoading?: boolean;
}

/**
 * Component that conditionally renders children based on user permissions.
 *
 * @example
 * <RequirePermission permission="billing:update">
 *   <ChangePlanButton />
 * </RequirePermission>
 *
 * @example
 * <RequirePermission permission="audit:read" fallback={<UpgradePrompt />}>
 *   <AuditLogs />
 * </RequirePermission>
 */
export function RequirePermission({
  permission,
  children,
  fallback = null,
  hideWhileLoading = true,
}: RequirePermissionProps) {
  const { hasPermission, isLoading } = usePermissions();

  // Show nothing while loading if configured
  if (isLoading && hideWhileLoading) {
    return null;
  }

  // Check permission and render accordingly
  if (hasPermission(permission)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

interface RequireAnyPermissionProps {
  /** Array of permissions - user needs at least one to see children */
  readonly permissions: string[];
  /** Content to render when user has at least one permission */
  readonly children: ReactNode;
  /** Optional fallback to render when user lacks all permissions */
  readonly fallback?: ReactNode;
  /** If true, show nothing while loading (default: true) */
  readonly hideWhileLoading?: boolean;
}

/**
 * Component that renders children if user has ANY of the specified permissions.
 *
 * @example
 * <RequireAnyPermission permissions={['schemas:read', 'schemas:create']}>
 *   <SchemaPanel />
 * </RequireAnyPermission>
 */
export function RequireAnyPermission({
  permissions,
  children,
  fallback = null,
  hideWhileLoading = true,
}: RequireAnyPermissionProps) {
  const { hasAnyPermission, isLoading } = usePermissions();

  if (isLoading && hideWhileLoading) {
    return null;
  }

  if (hasAnyPermission(permissions)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

interface RequireAllPermissionsProps {
  /** Array of permissions - user needs all to see children */
  readonly permissions: string[];
  /** Content to render when user has all permissions */
  readonly children: ReactNode;
  /** Optional fallback to render when user lacks any permission */
  readonly fallback?: ReactNode;
  /** If true, show nothing while loading (default: true) */
  readonly hideWhileLoading?: boolean;
}

/**
 * Component that renders children if user has ALL of the specified permissions.
 *
 * @example
 * <RequireAllPermissions permissions={['schemas:create', 'schemas:update']}>
 *   <SchemaEditor />
 * </RequireAllPermissions>
 */
export function RequireAllPermissions({
  permissions,
  children,
  fallback = null,
  hideWhileLoading = true,
}: RequireAllPermissionsProps) {
  const { hasAllPermissions, isLoading } = usePermissions();

  if (isLoading && hideWhileLoading) {
    return null;
  }

  if (hasAllPermissions(permissions)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

interface RequireOrgAdminProps {
  /** Content to render when user is org admin */
  readonly children: ReactNode;
  /** Optional fallback to render when user is not org admin */
  readonly fallback?: ReactNode;
  /** If true, show nothing while loading (default: true) */
  readonly hideWhileLoading?: boolean;
}

/**
 * Component that renders children only for organization admins.
 * Shorthand for <RequirePermission permission="org:admin">
 *
 * @example
 * <RequireOrgAdmin>
 *   <DeleteOrganizationButton />
 * </RequireOrgAdmin>
 */
export function RequireOrgAdmin({ children, fallback = null, hideWhileLoading = true }: RequireOrgAdminProps) {
  const { isOrgAdmin, isLoading } = usePermissions();

  if (isLoading && hideWhileLoading) {
    return null;
  }

  if (isOrgAdmin) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

