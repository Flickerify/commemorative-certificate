import type { HonoWithConvex } from "convex-helpers/server/hono";
import type { ActionCtx } from "../_generated/server";
import { Hono } from "hono";
import { workosWebhookMiddleware } from "../workos/webhooks/middleware";
import { env } from "../env";
import { handleUserWebhooks } from "../workos/webhooks/users";
import { handleOrganisationWebhooks } from "../workos/webhooks/organisations";
import { handleMembershipWebhooks } from "../workos/webhooks/memberships";

const workosWebhooksController: HonoWithConvex<ActionCtx> = new Hono();

workosWebhooksController.post(
  "/users",
  workosWebhookMiddleware(env.WORKOS_WEBHOOK_USERS_SECRET),
  handleUserWebhooks
);

workosWebhooksController.post(
  "/organisations",
  workosWebhookMiddleware(env.WORKOS_WEBHOOK_ORGANISATIONS_SECRET),
  handleOrganisationWebhooks
);

workosWebhooksController.post(
  "/memberships",
  workosWebhookMiddleware(env.WORKOS_WEBHOOK_MEMBERSHIPS_SECRET),
  handleMembershipWebhooks
);

export { workosWebhooksController };
