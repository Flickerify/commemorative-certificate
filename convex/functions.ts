import {
  customAction as customActionBuilder,
  customCtx,
  customMutation as customMutationBuilder,
  customQuery as customQueryBuilder,
} from 'convex-helpers/server/customFunctions';
import {
  action as baseAction,
  internalAction as baseInternalAction,
  internalMutation as baseInternalMutation,
  internalQuery as baseInternalQuery,
  mutation as baseMutation,
  query as baseQuery,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server';

import { getCurrentUserOrThrow } from './users/utils';
import { internal } from './_generated/api';

import { ConvexError } from 'convex/values';
import { Doc } from './_generated/dataModel';

export const publicQuery = customQueryBuilder(
  baseQuery,
  customCtx(async (ctx) => ctx),
);

export const protectedAdminQuery = customQueryBuilder(
  baseQuery,
  customCtx(async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);
    if (user.role !== 'admin') {
      throw new ConvexError('Only admins can access this resource');
    }
    return {
      ...ctx,
      user,
    };
  }),
);

export const protectedQuery = customQueryBuilder(
  baseQuery,
  customCtx(async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);
    return {
      ...ctx,
      user,
    };
  }),
);

export const internalQuery = customQueryBuilder(
  baseInternalQuery,
  customCtx(async (ctx) => ({ ...ctx })),
);

export const publicMutation = customMutationBuilder(
  baseMutation,
  customCtx(async (ctx) => ctx),
);

export const protectedAdminMutation = customMutationBuilder(
  baseMutation,
  customCtx(async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);
    if (user.role !== 'admin') throw new ConvexError('Only admins can access this resource');
    return {
      ...ctx,
      user,
    };
  }),
);

export const protectedMutation = customMutationBuilder(
  baseMutation,
  customCtx(async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);
    return {
      ...ctx,
      user,
    };
  }),
);

export const internalMutation = customMutationBuilder(
  baseInternalMutation,
  customCtx(async (ctx) => {
    return {
      ...ctx,
    };
  }),
);

export const publicAction = customActionBuilder(
  baseAction,
  customCtx(async (ctx) => ctx),
);

export const internalAction = customActionBuilder(
  baseInternalAction,
  customCtx(async (ctx) => ctx),
);

export const protectedAdminAction = customActionBuilder(
  baseAction,
  customCtx(async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError('Authentication required');
    const user = await ctx.runQuery(internal.users.internal.query.findByExternalId, {
      externalId: identity.subject,
    });
    if (!user) throw new ConvexError('User not found');
    if (user.role !== 'admin') throw new ConvexError('Only admins can access this resource');
    const finalUser = user as Doc<'users'>;
    return {
      ...ctx,
      user: finalUser,
    };
  }),
);

export const protectedAction = customActionBuilder(
  baseAction,
  customCtx(async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError('Authentication required');
    const user = await ctx.runQuery(internal.users.internal.query.findByExternalId, {
      externalId: identity.subject,
    });
    if (!user) throw new ConvexError('User not found');
    const finalUser = user as Doc<'users'>;
    return {
      ...ctx,
      user: finalUser,
    };
  }),
);

// ============================================================
// RBAC PERMISSION-AWARE FUNCTION BUILDERS
// ============================================================

import { hasPermission } from './rbac/utils';

/**
 * Helper to check user permissions in an organization.
 * Uses the organizationId from the function args.
 */
async function checkUserOrgPermission(
  ctx: QueryCtx | MutationCtx,
  userExternalId: string,
  orgExternalId: string,
  permission: string,
): Promise<{ hasPermission: boolean; permissions: string[] }> {
  const membership = await ctx.db
    .query('organizationMemberships')
    .withIndex('by_org_user', (q) => q.eq('organizationId', orgExternalId).eq('userId', userExternalId))
    .first();

  if (!membership) {
    return { hasPermission: false, permissions: [] };
  }

  // Get permissions from membership or role
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

  return {
    hasPermission: hasPermission(permissions, permission),
    permissions,
  };
}

/**
 * Create a protected query builder that requires a specific permission.
 * The handler must receive `organizationId` in args to check permissions.
 *
 * @example
 * export const getSchemas = protectedQueryWithPermission('schemas:read')({
 *   args: { organizationId: v.string() },
 *   handler: async (ctx, args) => { ... }
 * });
 */
export function protectedQueryWithPermission(permission: string) {
  return customQueryBuilder(
    baseQuery,
    customCtx(async (ctx) => {
      const user = await getCurrentUserOrThrow(ctx);

      // Platform admin bypass (global admin role)
      if (user.role === 'admin') {
        return {
          ...ctx,
          user,
          permissions: ['organization:administration:manage'], // Grant full access
          checkPermission: () => true,
        };
      }

      return {
        ...ctx,
        user,
        // Permission will be checked in the handler using organizationId from args
        requiredPermission: permission,
        async checkPermission(orgExternalId: string): Promise<boolean> {
          const result = await checkUserOrgPermission(ctx, user.externalId, orgExternalId, permission);
          return result.hasPermission;
        },
        async requirePermission(orgExternalId: string): Promise<void> {
          const result = await checkUserOrgPermission(ctx, user.externalId, orgExternalId, permission);
          if (!result.hasPermission) {
            throw new ConvexError(`Missing permission: ${permission}`);
          }
        },
      };
    }),
  );
}

/**
 * Create a protected mutation builder that requires a specific permission.
 * The handler must receive `organizationId` in args to check permissions.
 */
export function protectedMutationWithPermission(permission: string) {
  return customMutationBuilder(
    baseMutation,
    customCtx(async (ctx) => {
      const user = await getCurrentUserOrThrow(ctx);

      // Platform admin bypass (global admin role)
      if (user.role === 'admin') {
        return {
          ...ctx,
          user,
          permissions: ['organization:administration:manage'],
          checkPermission: () => true,
        };
      }

      return {
        ...ctx,
        user,
        requiredPermission: permission,
        async checkPermission(orgExternalId: string): Promise<boolean> {
          const result = await checkUserOrgPermission(ctx, user.externalId, orgExternalId, permission);
          return result.hasPermission;
        },
        async requirePermission(orgExternalId: string): Promise<void> {
          const result = await checkUserOrgPermission(ctx, user.externalId, orgExternalId, permission);
          if (!result.hasPermission) {
            throw new ConvexError(`Missing permission: ${permission}`);
          }
        },
      };
    }),
  );
}

/**
 * Create a protected action builder that requires a specific permission.
 * The handler must receive `organizationId` in args to check permissions.
 */
export function protectedActionWithPermission(permission: string) {
  return customActionBuilder(
    baseAction,
    customCtx(async (ctx) => {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) throw new ConvexError('Authentication required');

      const user = await ctx.runQuery(internal.users.internal.query.findByExternalId, {
        externalId: identity.subject,
      });
      if (!user) throw new ConvexError('User not found');

      const finalUser = user as Doc<'users'>;

      // Platform admin bypass (global admin role)
      if (finalUser.role === 'admin') {
        return {
          ...ctx,
          user: finalUser,
          permissions: ['organization:administration:manage'],
          checkPermission: () => Promise.resolve(true),
        };
      }

      return {
        ...ctx,
        user: finalUser,
        requiredPermission: permission,
        async checkPermission(orgExternalId: string): Promise<boolean> {
          const permissions = await ctx.runQuery(internal.rbac.internal.query.getUserOrgPermissions, {
            userExternalId: finalUser.externalId,
            orgExternalId,
          });
          return hasPermission(permissions, permission);
        },
        async requirePermission(orgExternalId: string): Promise<void> {
          const permissions = await ctx.runQuery(internal.rbac.internal.query.getUserOrgPermissions, {
            userExternalId: finalUser.externalId,
            orgExternalId,
          });
          if (!hasPermission(permissions, permission)) {
            throw new ConvexError(`Missing permission: ${permission}`);
          }
        },
      };
    }),
  );
}

// ============================================================
// CONVENIENCE BUILDERS FOR COMMON PERMISSION PATTERNS
// ============================================================

/**
 * Super admin: Requires 'organization:administration:manage' permission.
 * Grants full access to everything in the organization.
 */
export const protectedOrgAdminQuery = protectedQueryWithPermission('organization:administration:manage');
export const protectedOrgAdminMutation = protectedMutationWithPermission('organization:administration:manage');
export const protectedOrgAdminAction = protectedActionWithPermission('organization:administration:manage');

// -- Content domain --
export const protectedSchemasReadQuery = protectedQueryWithPermission('content:schemas:read-only');
export const protectedSchemasManageQuery = protectedQueryWithPermission('content:schemas:manage');
export const protectedSchemasManageMutation = protectedMutationWithPermission('content:schemas:manage');

export const protectedRulesReadQuery = protectedQueryWithPermission('content:rules:read-only');
export const protectedRulesManageQuery = protectedQueryWithPermission('content:rules:manage');
export const protectedRulesManageMutation = protectedMutationWithPermission('content:rules:manage');

// -- Organization domain --
export const protectedMembershipReadQuery = protectedQueryWithPermission('organization:membership:read-only');
export const protectedMembershipManageQuery = protectedQueryWithPermission('organization:membership:manage');
export const protectedMembershipManageMutation = protectedMutationWithPermission('organization:membership:manage');
export const protectedMembershipInviteMutation = protectedMutationWithPermission('organization:membership:invite');

export const protectedSettingsReadQuery = protectedQueryWithPermission('organization:settings:read-only');
export const protectedSettingsManageQuery = protectedQueryWithPermission('organization:settings:manage');
export const protectedSettingsManageMutation = protectedMutationWithPermission('organization:settings:manage');

// -- Finance domain --
export const protectedBillingReadQuery = protectedQueryWithPermission('finance:billing:read-only');
export const protectedBillingManageQuery = protectedQueryWithPermission('finance:billing:manage');
export const protectedBillingManageMutation = protectedMutationWithPermission('finance:billing:manage');
export const protectedBillingManageAction = protectedActionWithPermission('finance:billing:manage');

export const protectedInvoicesReadQuery = protectedQueryWithPermission('finance:invoices:read-only');
export const protectedInvoicesExportAction = protectedActionWithPermission('finance:invoices:export');

export const protectedReportsReadQuery = protectedQueryWithPermission('finance:reports:read-only');
export const protectedReportsExportAction = protectedActionWithPermission('finance:reports:export');

// -- Audit domain --
export const protectedAuditReadQuery = protectedQueryWithPermission('audit:logs:read-only');
export const protectedAuditExportAction = protectedActionWithPermission('audit:logs:export');
