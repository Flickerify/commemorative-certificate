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
 * Shorthand for <RequirePermission permission="organization:administration:manage">
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

// ============================================================
// PAGE GUARD COMPONENTS
// ============================================================

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { AlertTriangle } from 'lucide-react';

interface PermissionPageGuardProps {
  /** The permission required to access this page */
  readonly permission: string;
  /** Content to render when user has permission */
  readonly children: ReactNode;
  /** URL to redirect to when user lacks permission (optional) */
  readonly redirectTo?: string;
  /** Custom message to show when access is denied (if not redirecting) */
  readonly deniedMessage?: string;
}

/**
 * Page-level guard that protects entire pages based on permissions.
 * Can either redirect unauthorized users or show an access denied message.
 *
 * @example
 * // Redirect to billing page if no permission
 * <PermissionPageGuard permission="audit:logs:read-only" redirectTo="/administration/billing">
 *   <AuditLogsPage />
 * </PermissionPageGuard>
 *
 * @example
 * // Show access denied message
 * <PermissionPageGuard permission="organization:membership:manage">
 *   <TeamManagementPage />
 * </PermissionPageGuard>
 */
export function PermissionPageGuard({
  permission,
  children,
  redirectTo,
  deniedMessage = "You don't have permission to access this page.",
}: PermissionPageGuardProps) {
  const { hasPermission, isLoading } = usePermissions();
  const router = useRouter();

  const hasAccess = hasPermission(permission);

  useEffect(() => {
    if (!isLoading && !hasAccess && redirectTo) {
      router.replace(redirectTo);
    }
  }, [isLoading, hasAccess, redirectTo, router]);

  // Show loading spinner while checking permissions
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  // User has permission - render children
  if (hasAccess) {
    return <>{children}</>;
  }

  // If redirecting, show loading state
  if (redirectTo) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  // Show access denied message
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
      <AlertTriangle className="h-12 w-12 text-amber-500" />
      <h2 className="text-xl font-semibold">Access Denied</h2>
      <p className="text-muted-foreground max-w-md">{deniedMessage}</p>
    </div>
  );
}

interface AnyPermissionPageGuardProps {
  /** Array of permissions - user needs at least one to access the page */
  readonly permissions: string[];
  /** Content to render when user has at least one permission */
  readonly children: ReactNode;
  /** URL to redirect to when user lacks all permissions (optional) */
  readonly redirectTo?: string;
  /** Custom message to show when access is denied */
  readonly deniedMessage?: string;
}

/**
 * Page-level guard that allows access if user has ANY of the specified permissions.
 */
export function AnyPermissionPageGuard({
  permissions,
  children,
  redirectTo,
  deniedMessage = "You don't have permission to access this page.",
}: AnyPermissionPageGuardProps) {
  const { hasAnyPermission, isLoading } = usePermissions();
  const router = useRouter();

  const hasAccess = hasAnyPermission(permissions);

  useEffect(() => {
    if (!isLoading && !hasAccess && redirectTo) {
      router.replace(redirectTo);
    }
  }, [isLoading, hasAccess, redirectTo, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  if (redirectTo) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
      <AlertTriangle className="h-12 w-12 text-amber-500" />
      <h2 className="text-xl font-semibold">Access Denied</h2>
      <p className="text-muted-foreground max-w-md">{deniedMessage}</p>
    </div>
  );
}
