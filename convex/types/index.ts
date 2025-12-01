import type { CustomCtx } from 'convex-helpers/server/customFunctions';
import type { Env, ValidationTargets } from 'hono';
import type Stripe from 'stripe';

import type { Doc } from '../_generated/dataModel';
import type { ActionCtx } from '../_generated/server';
import {
  internalAction,
  internalMutation,
  internalQuery,
  protectedAction,
  protectedMutation,
  protectedQuery,
  publicMutation,
  publicQuery,
} from '../functions';
import type { Event as WorkosEvent } from '@workos-inc/node';

export type PublicQueryCtx = CustomCtx<typeof publicQuery>;
export type PublicMutationCtx = CustomCtx<typeof publicMutation>;
export type InternalMutationCtx = CustomCtx<typeof internalMutation>;
export type InternalActionCtx = CustomCtx<typeof internalAction>;
export type InternalQueryCtx = CustomCtx<typeof internalQuery>;
export type ProtectedQueryCtx = CustomCtx<typeof protectedQuery>;
export type ProtectedMutationCtx = CustomCtx<typeof protectedMutation>;
export type ProtectedActionCtx = CustomCtx<typeof protectedAction>;

export type ActionContext = {
  Bindings: ActionCtx & Env;
  Variables: {
    user: Doc<'users'>;
  };
  ValidationTargets: ValidationTargets;
};

/**
 * Hono environment for WorkOS webhooks.
 */
export type WorkosHonoEnv = {
  Variables: {
    workosEvent: WorkosEvent;
  };
  Bindings: ActionCtx;
};

/**
 * Hono environment for Stripe webhooks.
 */
export type StripeHonoEnv = {
  Variables: {
    stripeEvent: Stripe.Event;
  };
  Bindings: ActionCtx;
};
