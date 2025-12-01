import { v } from 'convex/values';
import { internalMutation } from '../../functions';
import { Metadata, metadataValidator } from '../../schema';

// Cast WorkOS metadata to Convex Metadata type
// WorkOS stores metadata as string values
function toMetadata(workosMetadata: Record<string, string> | undefined): Metadata | undefined {
  if (!workosMetadata || Object.keys(workosMetadata).length === 0) return undefined;
  return workosMetadata as Metadata;
}

export const upsertFromWorkos = internalMutation({
  args: {
    externalId: v.string(),
    name: v.string(),
    metadata: v.optional(metadataValidator),
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
        metadata: toMetadata(organizationArgs.metadata),
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

export const setPlanetscaleId = internalMutation({
  args: {
    convexId: v.id('organizations'),
    planetscaleId: v.number(),
  },
  returns: v.null(),
  async handler(ctx, { convexId, planetscaleId }) {
    const organization = await ctx.db.get(convexId);
    if (!organization) {
      console.warn(`Can't set planetscaleId, organization not found: ${convexId}`);
      return null;
    }

    await ctx.db.patch(convexId, { planetscaleId });
    return null;
  },
});

export const deleteFromWorkos = internalMutation({
  args: {
    externalId: v.string(),
  },
  returns: v.null(),
  async handler(ctx, { externalId }) {
    const organization = await ctx.db
      .query('organizations')
      .withIndex('externalId', (q) => q.eq('externalId', externalId))
      .first();

    if (!organization) {
      console.warn(`Can't delete organization, there is none for org ID: ${externalId}`);
      return null;
    }

    // Cascade: Delete all domains
    const domains = await ctx.db
      .query('organizationDomains')
      .withIndex('organizationId', (q) => q.eq('organizationId', organization._id))
      .collect();

    for (const domain of domains) {
      await ctx.db.delete(domain._id);
    }

    // Cascade: Delete all memberships for this organization
    const memberships = await ctx.db
      .query('organizationMemberships')
      .withIndex('by_org', (q) => q.eq('organizationId', externalId))
      .collect();

    for (const membership of memberships) {
      await ctx.db.delete(membership._id);
    }

    // Delete the organization
    await ctx.db.delete(organization._id);

    return null;
  },
});
