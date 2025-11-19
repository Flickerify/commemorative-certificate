import {
  customAction as customActionBuilder,
  customCtx,
  customMutation as customMutationBuilder,
  customQuery as customQueryBuilder,
} from "convex-helpers/server/customFunctions";
import {
  action as baseAction,
  internalAction as baseInternalAction,
  internalMutation as baseInternalMutation,
  internalQuery as baseInternalQuery,
  mutation as baseMutation,
  query as baseQuery,
} from "./_generated/server";

import { getCurrentUserOrThrow } from "./users/utils";
import { internal } from "./_generated/api";
import { ROLES } from "./schema";

import { ConvexError } from "convex/values";
import { Doc } from "./_generated/dataModel";

export const publicQuery = customQueryBuilder(
  baseQuery,
  customCtx(async (ctx) => ctx)
);

export const protectedAdminQuery = customQueryBuilder(
  baseQuery,
  customCtx(async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);
    if (user.role !== ROLES.ADMIN) {
      throw new ConvexError("Only admins can access this resource");
    }
    return {
      ...ctx,
      user,
    };
  })
);

export const protectedQuery = customQueryBuilder(
  baseQuery,
  customCtx(async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);
    return {
      ...ctx,
      user,
    };
  })
);

export const internalQuery = customQueryBuilder(
  baseInternalQuery,
  customCtx(async (ctx) => ({ ...ctx }))
);

export const publicMutation = customMutationBuilder(
  baseMutation,
  customCtx(async (ctx) => ctx)
);

export const protectedAdminMutation = customMutationBuilder(
  baseMutation,
  customCtx(async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);
    if (user.role !== ROLES.ADMIN)
      throw new ConvexError("Only admins can access this resource");
    return {
      ...ctx,
      user,
    };
  })
);

export const protectedMutation = customMutationBuilder(
  baseMutation,
  customCtx(async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);
    return {
      ...ctx,
      user,
    };
  })
);

export const internalMutation = customMutationBuilder(
  baseInternalMutation,
  customCtx(async (ctx) => {
    return {
      ...ctx,
    };
  })
);

export const publicAction = customActionBuilder(
  baseAction,
  customCtx(async (ctx) => ctx)
);

export const internalAction = customActionBuilder(
  baseInternalAction,
  customCtx(async (ctx) => ctx)
);

export const protectedAdminAction = customActionBuilder(
  baseAction,
  customCtx(async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Authentication required");
    const user = await ctx.runQuery(
      internal.users.internal.query.findByExternalId,
      {
        externalId: identity.subject,
      }
    );
    if (!user) throw new ConvexError("User not found");
    if (user.role !== ROLES.ADMIN)
      throw new ConvexError("Only admins can access this resource");
    const finalUser = user as Doc<"users">;
    return {
      ...ctx,
      user: finalUser,
    };
  })
);

export const protectedAction = customActionBuilder(
  baseAction,
  customCtx(async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Authentication required");
    const user = await ctx.runQuery(
      internal.users.internal.query.findByExternalId,
      {
        externalId: identity.subject,
      }
    );
    if (!user) throw new ConvexError("User not found");
    const finalUser = user as Doc<"users">;
    return {
      ...ctx,
      user: finalUser,
    };
  })
);
