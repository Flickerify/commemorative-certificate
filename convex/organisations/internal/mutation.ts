import { ConvexError, v } from "convex/values";
import { internalMutation } from "../../functions";
import { organisations, organisationDomains } from "../../schema";

export const upsertFromWorkos = internalMutation({
  args: {
    externalId: v.string(),
    name: v.string(),
    metadata: v.optional(
      v.record(v.string(), v.union(v.string(), v.number(), v.null()))
    ),
    domains: v.optional(
      v.array(
        v.object({
          externalId: v.string(),
          domain: v.string(),
          status: v.union(
            v.literal("verified"),
            v.literal("pending"),
            v.literal("failed")
          ),
        })
      )
    ),
  },
  async handler(ctx, args) {
    const { domains, ...organisationArgs } = args;
    const organisation = await ctx.db
      .query("organisations")
      .withIndex("externalId", (q) =>
        q.eq("externalId", organisationArgs.externalId)
      )
      .first();

    if (organisation === null) {
      const organisationId = await ctx.db.insert("organisations", {
        ...organisationArgs,
        updatedAt: Date.now(),
      });
      for (const domain of domains ?? []) {
        await ctx.db.insert("organisationDomains", {
          ...domain,
          externalId: domain.externalId,
          status: domain.status,
          organisationId,
          updatedAt: Date.now(),
        });
      }

      return organisationId;
    }

    await ctx.db.patch(organisation._id, organisationArgs);

    const existingDomains = await ctx.db
      .query("organisationDomains")
      .withIndex("organisationId", (q) =>
        q.eq("organisationId", organisation._id)
      )
      .collect();

    for (const domain of existingDomains) {
      if (!domains?.some((d) => d.domain === domain.domain)) {
        await ctx.db.delete(domain._id);
      }
      if (domains?.some((d) => d.domain === domain.domain)) {
        await ctx.db.patch(domain._id, {
          ...domain,
          organisationId: organisation._id,
        });
      }
    }

    for (const domain of domains ?? []) {
      if (!existingDomains.some((d) => d.domain === domain.domain)) {
        await ctx.db.insert("organisationDomains", {
          ...domain,
          externalId: domain.externalId,
          status: domain.status,
          organisationId: organisation._id,
          updatedAt: Date.now(),
        });
      }
    }

    return organisation._id;
  },
});

export const deleteFromWorkos = internalMutation({
  args: {
    externalId: v.string(),
  },
  async handler(ctx, { externalId }) {
    const organisation = await ctx.db
      .query("organisations")
      .withIndex("externalId", (q) => q.eq("externalId", externalId))
      .first();

    if (!organisation) {
      throw new ConvexError("Organisation not found");
    }

    const domains = await ctx.db
      .query("organisationDomains")
      .withIndex("organisationId", (q) =>
        q.eq("organisationId", organisation._id)
      )
      .collect();

    for (const domain of domains) {
      await ctx.db.delete(domain._id);
    }

    // TODO: Delete all documents including users related to the organisation

    await ctx.db.delete(organisation._id);
  },
});
