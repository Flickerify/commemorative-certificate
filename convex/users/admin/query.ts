import { protectedAdminQuery } from '../../functions';
import { Roles } from '../../schema';

/**
 * Check if current user is an admin
 * Returns false if user is not authenticated
 */
export const isAdmin = protectedAdminQuery({
  async handler(ctx) {
    return ctx.user.role === 'admin';
  },
});
