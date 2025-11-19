import type { HttpHonoEnv } from "../../types";

import { ConvexError } from "convex/values";
import { Context } from "hono";

import { internal } from "../../_generated/api";

export async function handleOrganisationWebhooks(ctx: Context<HttpHonoEnv>) {
  const event = ctx.var.workosEvent;

  try {
    switch (event.event) {
      case "organization.created":
      case "organization.updated":
        console.log("organization.updated", event.data);
        await ctx.env.runMutation(
          internal.organisations.internal.mutation.upsertFromWorkos,
          {
            externalId: event.data.id,
            name: event.data.name,
            metadata: event.data.metadata,
            domains: event.data.domains.map((domain) => {
              return {
                domain: domain.domain,
                externalId: domain.id,
                status: domain.state as "verified" | "pending" | "failed",
              };
            }),
          }
        );

        // Trigger PlanetScale sync
        await ctx.env.runAction(
          internal.workflows.syncOrganisationToPlanetScale.run,
          {
            id: event.data.id,
            name: event.data.name,
            metadata: event.data.metadata,
          }
        );
        break;
      case "organization.deleted": {
        await ctx.env.runMutation(
          internal.organisations.internal.mutation.deleteFromWorkos,
          {
            externalId: event.data.id,
          }
        );
        break;
      }
      case "organization_domain.verified":
        await ctx.env.runMutation(
          internal.organisationDomains.internal.mutation.updateFromWorkos,
          {
            externalId: event.data.id,
            status: "verified",
          }
        );
        break;
      case "organization_domain.verification_failed":
        await ctx.env.runMutation(
          internal.organisationDomains.internal.mutation.updateFromWorkos,
          {
            externalId: event.data.id,
            status: "failed",
          }
        );
        break;
      default:
        throw new ConvexError("Unsupported webhook event");
    }

    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("Error occured", error);
    return new Response("Auth Webhook Error", {
      status: 400,
    });
  }
}
