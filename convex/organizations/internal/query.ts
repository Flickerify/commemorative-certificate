import { ConvexError, v } from 'convex/values';
import { internalQuery } from '../../functions';
import { parse } from 'tldts';

export const findByEmail = internalQuery({
  args: {
    email: v.string(),
  },
  async handler(ctx, { email }) {
    console.log('email', email);
    const parsedUrl = parse(email);
    const domain = parsedUrl.domain;
    console.log('domain', domain);

    if (!domain) {
      throw new ConvexError('Invalid email');
    }

    const organizationDomain = await ctx.db
      .query('organizationDomains')
      .withIndex('domain', (q) => q.eq('domain', domain))
      .first();

    if (!organizationDomain) {
      throw new ConvexError('No Domain not found');
    }

    console.log('organizationDomain', organizationDomain);

    const organization = await ctx.db
      .query('organizations')
      .withIndex('by_id', (q) => q.eq('_id', organizationDomain.organizationId))
      .first();

    console.log('organization', organization);
    if (!organization) {
      throw new ConvexError('Organization not found');
    }

    return organization;
  },
});
