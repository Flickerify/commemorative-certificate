import { internalMutation } from '../../functions';
import { v } from 'convex/values';

export const upsertFromWorkos = internalMutation({
  args: {
    organizationId: v.string(),
    userId: v.string(),
    role: v.optional(v.string()),
    status: v.union(v.literal('active'), v.literal('pending'), v.literal('inactive')),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('organizationMemberships')
      .withIndex('by_org_user', (q) => q.eq('organizationId', args.organizationId).eq('userId', args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        role: args.role,
        status: args.status,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert('organizationMemberships', {
        organizationId: args.organizationId,
        userId: args.userId,
        role: args.role,
        status: args.status,
        updatedAt: Date.now(),
      });
    }
  },
});

export const deleteFromWorkos = internalMutation({
  args: {
    organizationId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('organizationMemberships')
      .withIndex('by_org_user', (q) => q.eq('organizationId', args.organizationId).eq('userId', args.userId))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
