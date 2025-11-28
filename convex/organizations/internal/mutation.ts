import { ConvexError, v } from 'convex/values';
import { internalMutation } from '../../functions';

export const upsertFromWorkos = internalMutation({
  args: {
    externalId: v.string(),
    name: v.string(),
    metadata: v.optional(v.record(v.string(), v.union(v.string(), v.number(), v.null()))),
    domains: v.optional(
      v.array(
        v.object({
          externalId: v.string(),
          domain: v.string(),
          status: v.union(v.literal('verified'), v.literal('pending'), v.literal('failed')),
        }),
      ),
    ),
  },
  async handler(ctx, args) {
    const { domains, ...organizationArgs } = args;
    const organization = await ctx.db
      .query('organizations')
      .withIndex('externalId', (q) => q.eq('externalId', organizationArgs.externalId))
      .first();

    if (organization === null) {
      const organizationId = await ctx.db.insert('organizations', {
        ...organizationArgs,
        updatedAt: Date.now(),
      });
      for (const domain of domains ?? []) {
        await ctx.db.insert('organizationDomains', {
          ...domain,
          externalId: domain.externalId,
          status: domain.status,
          organizationId,
          updatedAt: Date.now(),
        });
      }

      return organizationId;
    }

    await ctx.db.patch(organization._id, organizationArgs);

    const existingDomains = await ctx.db
      .query('organizationDomains')
      .withIndex('organizationId', (q) => q.eq('organizationId', organization._id))
      .collect();

    for (const domain of existingDomains) {
      if (!domains?.some((d) => d.domain === domain.domain)) {
        await ctx.db.delete(domain._id);
      }
      if (domains?.some((d) => d.domain === domain.domain)) {
        await ctx.db.patch(domain._id, {
          ...domain,
          organizationId: organization._id,
        });
      }
    }

    for (const domain of domains ?? []) {
      if (!existingDomains.some((d) => d.domain === domain.domain)) {
        await ctx.db.insert('organizationDomains', {
          ...domain,
          externalId: domain.externalId,
          status: domain.status,
          organizationId: organization._id,
          updatedAt: Date.now(),
        });
      }
    }

    return organization._id;
  },
});

export const deleteFromWorkos = internalMutation({
  args: {
    externalId: v.string(),
  },
  async handler(ctx, { externalId }) {
    const organization = await ctx.db
      .query('organizations')
      .withIndex('externalId', (q) => q.eq('externalId', externalId))
      .first();

    if (!organization) {
      throw new ConvexError('Organization not found');
    }

    const domains = await ctx.db
      .query('organizationDomains')
      .withIndex('organizationId', (q) => q.eq('organizationId', organization._id))
      .collect();

    for (const domain of domains) {
      await ctx.db.delete(domain._id);
    }

    // TODO: Delete all documents including users related to the organization

    await ctx.db.delete(organization._id);
  },
});
