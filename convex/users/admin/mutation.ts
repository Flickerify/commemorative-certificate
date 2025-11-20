import { ConvexError, v } from 'convex/values';
import { protectedAdminMutation } from '../../functions';
import { roleValidator } from '../../schema';

/**
 * Set a user as admin by email (admin only)
 * Useful for initial admin setup
 */
export const setAdminByEmail = protectedAdminMutation({
  args: {
    email: v.string(),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .first();

    if (!user) {
      throw new ConvexError('User not found');
    }

    await ctx.db.patch(user._id, {
      role: 'admin',
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Update user role (admin only)
 */
export const updateUserRole = protectedAdminMutation({
  args: {
    userId: v.id('users'),
    role: roleValidator,
  },
  async handler(ctx, args) {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new ConvexError('User not found');
    }

    await ctx.db.patch(args.userId, {
      role: args.role,
      updatedAt: Date.now(),
    });

    return null;
  },
});
