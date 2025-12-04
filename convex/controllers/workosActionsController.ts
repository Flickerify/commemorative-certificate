import type { HonoWithConvex } from 'convex-helpers/server/hono';
import type { ActionCtx } from '../_generated/server';
import { Hono } from 'hono';
import { env } from '../env';
import { workosActionMiddleware } from '../workos/webhooks/middleware';
import { handleAuthenticationActions } from '../workos/actions/authorization';
import { handleRegistrationActions } from '../workos/actions/registration';

const workosActionsController: HonoWithConvex<ActionCtx> = new Hono();

workosActionsController.post(
  '/authentication',
  workosActionMiddleware(env.WORKOS_ACTION_SECRET),
  handleAuthenticationActions,
);

workosActionsController.post(
  '/registration',
  workosActionMiddleware(env.WORKOS_ACTION_SECRET),
  handleRegistrationActions,
);

export { workosActionsController };
