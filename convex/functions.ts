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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  userExternalId: string,
  orgExternalId: string,
  permission: string,
): Promise<{ hasPermission: boolean; permissions: string[] }> {
  const membership = await ctx.db
    .query('organizationMemberships')
    .withIndex('by_org_user', (q: { eq: (f: string, v: string) => { eq: (f: string, v: string) => unknown } }) =>
      q.eq('organizationId', orgExternalId).eq('userId', userExternalId),
    )
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
      .withIndex('by_slug', (q: { eq: (f: string, v: string) => unknown }) => q.eq('slug', membership.roleSlug))
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
          permissions: ['org:admin'], // Grant full access
          checkPermission: () => true,
        };
      }

      return {
        ...ctx,
        user,
        // Permission will be checked in the handler using organizationId from args
        requiredPermission: permission,
        async checkPermission(orgExternalId: string): Promise<boolean> {
          const result = await checkUserOrgPermission(ctx as any, user.externalId, orgExternalId, permission);
          return result.hasPermission;
        },
        async requirePermission(orgExternalId: string): Promise<void> {
          const result = await checkUserOrgPermission(ctx as any, user.externalId, orgExternalId, permission);
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
          permissions: ['org:admin'],
          checkPermission: () => true,
        };
      }

      return {
        ...ctx,
        user,
        requiredPermission: permission,
        async checkPermission(orgExternalId: string): Promise<boolean> {
          const result = await checkUserOrgPermission(ctx as any, user.externalId, orgExternalId, permission);
          return result.hasPermission;
        },
        async requirePermission(orgExternalId: string): Promise<void> {
          const result = await checkUserOrgPermission(ctx as any, user.externalId, orgExternalId, permission);
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
          permissions: ['org:admin'],
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

/**
 * Convenience builder for org admin permission.
 * Requires 'org:admin' permission for full organization access.
 */
export const protectedOrgAdminQuery = protectedQueryWithPermission('org:admin');
export const protectedOrgAdminMutation = protectedMutationWithPermission('org:admin');
export const protectedOrgAdminAction = protectedActionWithPermission('org:admin');
