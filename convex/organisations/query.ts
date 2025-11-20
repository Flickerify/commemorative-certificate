import { protectedQuery } from '../functions';

export const getOrganisationsByUserId = protectedQuery({
  args: {},
  async handler(ctx) {
    const organisationMemberships = await ctx.db
      .query('organizationMemberships')
      .withIndex('by_user', (q) => q.eq('userId', ctx.user.externalId))
      .collect();

    if (!organisationMemberships) {
      return null;
    }

    const organisations = await Promise.all(
      organisationMemberships.map(async (membership) => {
        const organisation = await ctx.db
          .query('organisations')
          .withIndex('externalId', (q) => q.eq('externalId', membership.organizationId))
          .first();

        if (organisation) {
          return { ...organisation, role: membership.role };
        }
      }),
    );

    return organisations.filter((organisation) => organisation !== null && organisation !== undefined);
  },
});
