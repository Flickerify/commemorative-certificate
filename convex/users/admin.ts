import { ConvexError, v } from 'convex/values';
import { protectedAdminQuery, protectedAdminMutation, publicQuery } from '../functions';
import { ROLES, roleValidator } from '../schema';
import { getCurrentUser } from './utils';

/**
 * Check if current user is an admin
 * Returns false if user is not authenticated
 */
export const isAdmin = publicQuery({
  args: {},
  returns: v.boolean(),
  async handler(ctx) {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return false;
    }
    return user.role === ROLES.ADMIN;
  },
});

/**
 * Require admin role or throw error
 */
export async function requireAdmin(ctx: { user: { role: string } }) {
  if (ctx.user.role !== ROLES.ADMIN) {
    throw new ConvexError('Admin access required');
  }
}

/**
 * Update user role (admin only)
 */
export const updateUserRole = protectedAdminMutation({
  args: {
    userId: v.id('users'),
    role: roleValidator,
  },
  returns: v.null(),
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

/**
 * List all users (admin only)
 */
export const listUsers = protectedAdminQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id('users'),
      email: v.string(),
      firstName: v.union(v.string(), v.null()),
      lastName: v.union(v.string(), v.null()),
      role: roleValidator,
      emailVerified: v.boolean(),
      updatedAt: v.number(),
    }),
  ),
  async handler(ctx) {
    const users = await ctx.db.query('users').collect();
    return users.map((user) => ({
      _id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      emailVerified: user.emailVerified,
      updatedAt: user.updatedAt,
    }));
  },
});
