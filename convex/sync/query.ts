import { protectedAdminQuery } from "../functions";
import { v } from "convex/values";

export const getSyncStatus = protectedAdminQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    const statuses = await ctx.db.query("syncStatus").order("desc").take(limit);
    return statuses;
  },
});

export const getFailedSyncs = protectedAdminQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    return await ctx.db
      .query("syncStatus")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .order("desc")
      .take(limit);
  },
});
