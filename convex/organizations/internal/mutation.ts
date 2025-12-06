import { v } from 'convex/values';
import { internalMutation } from '../../functions';
import { metadataValidator } from '../../schema';

export const upsertFromWorkos = internalMutation({
  args: {
    externalId: v.string(),
    name: v.string(),
    metadata: v.optional(metadataValidator), // Still accepted but ignored - metadata is local-only
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
    const { domains, externalId, name } = args;
    // Note: args.metadata is ignored - metadata is stored locally only
    const organization = await ctx.db
      .query('organizations')
      .withIndex('externalId', (q) => q.eq('externalId', externalId))
      .first();

    if (organization === null) {
      // New organization: don't set metadata from WorkOS (it's local-only)
      const organizationId = await ctx.db.insert('organizations', {
        externalId,
        name,
        // metadata is intentionally not set from WorkOS - will be set locally if needed
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

    // Existing organization: update name but preserve local metadata
    await ctx.db.patch(organization._id, {
      externalId,
      name,
      // Keep existing metadata - don't overwrite with WorkOS data
      metadata: organization.metadata,
      updatedAt: Date.now(),
    });

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
