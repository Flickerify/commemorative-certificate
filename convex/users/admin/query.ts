import { protectedAdminQuery } from "../../functions";
import { ROLES } from "../../schema";

/**
 * Check if current user is an admin
 * Returns false if user is not authenticated
 */
export const isAdmin = protectedAdminQuery({
  async handler(ctx) {
    return ctx.user.role === ROLES.ADMIN;
  },
});
