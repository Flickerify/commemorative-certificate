import { ConvexError, v } from 'convex/values';
import { internalQuery } from '../../functions';
import { parse } from 'tldts';

/**
 * Get an organization by its WorkOS external ID.
 * Used internally for checking subscription status before deletion.
 */
export const getByExternalId = internalQuery({
  args: {
    externalId: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id('organizations'),
      externalId: v.string(),
      name: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const organization = await ctx.db
      .query('organizations')
      .withIndex('externalId', (q) => q.eq('externalId', args.externalId))
      .first();

    if (!organization) return null;

    return {
      _id: organization._id,
      externalId: organization.externalId,
      name: organization.name,
    };
  },
});

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
