import { v } from 'convex/values';
import { internalMutation } from '../../functions';
import { users } from '../../schema';

export const upsertFromWorkos = internalMutation({
  args: users.validator.fields,
  async handler(ctx, args) {
    const user = await ctx.db
      .query('users')
      .withIndex('by_external_id', (q) => q.eq('externalId', args.externalId))
      .first();

    if (!user) {
      return await ctx.db.insert('users', args);
    }
    // Preserve existing role when updating
    await ctx.db.patch(user._id, {
      ...args,
      role: args.role || user.role,
    });

    return user._id;
  },
});

export const deleteFromWorkos = internalMutation({
  args: { externalId: v.string() },
  async handler(ctx, { externalId }) {
    const user = await ctx.db
      .query('users')
      .withIndex('by_external_id', (q) => q.eq('externalId', externalId))
      .first();

    if (user !== null) {
      await ctx.db.delete(user._id);
    } else {
      console.warn(`Can't delete user, there is none for user ID: ${externalId}`);
    }
  },
});
