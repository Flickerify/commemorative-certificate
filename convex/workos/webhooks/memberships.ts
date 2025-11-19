import { ConvexError } from "convex/values";
import { Context } from "hono";
import { internal } from "../../_generated/api";
import type { HttpHonoEnv } from "../../types";

export async function handleMembershipWebhooks(ctx: Context<HttpHonoEnv>) {
  const event = ctx.var.workosEvent;

  try {
    switch (event.event) {
      case "organization_membership.created":
      case "organization_membership.updated":
        await ctx.env.runMutation(
          internal.memberships.internal.mutation.upsertFromWorkos,
          {
            organizationId: event.data.organizationId,
            userId: event.data.userId,
            role: event.data.role ? event.data.role.slug : undefined,
            status: event.data.status,
          }
        );
        break;
      case "organization_membership.deleted":
        await ctx.env.runMutation(
          internal.memberships.internal.mutation.deleteFromWorkos,
          {
            organizationId: event.data.organizationId,
            userId: event.data.userId,
          }
        );
        break;
      default:
        throw new ConvexError("Unsupported webhook event");
    }

    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("Error occured", error);
    return new Response("Webhook Error", {
      status: 400,
    });
  }
}
