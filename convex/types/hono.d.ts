import type { Event as WorkosEvent, ActionContext } from '@workos-inc/node';
import type Stripe from 'stripe';

import { Doc } from '../_generated/dataModel';

declare module 'hono' {
  interface ContextVariableMap {
    user: Doc<'users'>;
    workosEvent: WorkosEvent;
    stripeEvent: Stripe.Event;
    workosActionContext: ActionContext;
  }
}
