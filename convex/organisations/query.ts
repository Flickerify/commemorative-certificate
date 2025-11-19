import { v } from 'convex/values';
import { protectedQuery } from '../functions';
import { parse } from 'tldts';

export const getOrganisationByEmail = protectedQuery({
  args: {
    email: v.string(),
  },
  async handler(ctx, { email }) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const parsedUrl = parse(email);
    const domain = parsedUrl.domain;

    if (!domain) {
      return null;
    }

    const organisationDomain = await ctx.db
      .query('organisationDomains')
      .withIndex('domain', (q) => q.eq('domain', domain))
      .first();

    if (!organisationDomain) {
      return null;
    }

    const organisation = await ctx.db
      .query('organisations')
      .withIndex('by_id', (q) => q.eq('_id', organisationDomain.organisationId))
      .first();

    return organisation;
  },
});
