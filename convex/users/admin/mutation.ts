import { ConvexError, v } from 'convex/values';
import { protectedAdminMutation } from '../../functions';
import { requireAdmin } from '../admin';
import { ROLES } from '../../schema';
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
      role: ROLES.ADMIN,
      updatedAt: Date.now(),
    });

    return null;
  },
});
