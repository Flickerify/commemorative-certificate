import { protectedQuery } from '../functions';

export const getOrganizationsByUserId = protectedQuery({
  args: {},
  async handler(ctx) {
    const organizationMemberships = await ctx.db
      .query('organizationMemberships')
      .withIndex('by_user', (q) => q.eq('userId', ctx.user.externalId))
      .collect();

    if (!organizationMemberships) {
      return null;
    }

    const organizations = await Promise.all(
      organizationMemberships.map(async (membership) => {
        const organization = await ctx.db
          .query('organizations')
          .withIndex('externalId', (q) => q.eq('externalId', membership.organizationId))
          .first();

        if (organization) {
          return { ...organization, role: membership.role };
        }
      }),
    );

    return organizations.filter((organization) => organization !== null && organization !== undefined);
  },
});
