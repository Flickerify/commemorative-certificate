import { ConvexError } from 'convex/values';
import { Context } from 'hono';
import { Id } from '../../_generated/dataModel';

import { internal } from '../../_generated/api';
import type { HttpHonoEnv } from '../../types';

export async function handleUserWebhooks(ctx: Context<HttpHonoEnv>) {
  const event = ctx.var.workosEvent;
  
  let convexId: Id<'users'> ;

  try {
    switch (event.event) {
      case 'user.created':
        convexId = await ctx.env.runMutation(internal.users.internal.mutation.upsertFromWorkos, {
          externalId: event.data.id,
          email: event.data.email,
          emailVerified: event.data.emailVerified,
          firstName: event.data.firstName,
          lastName: event.data.lastName,
          profilePictureUrl: event.data.profilePictureUrl,
          updatedAt: new Date().getTime(),
        });

        // Trigger PlanetScale sync
        await ctx.env.runAction(internal.workflows.syncUserToPlanetScale.run, {
          id: event.data.id,
          convexId: convexId,
          email: event.data.email,
          createdAt: new Date().getTime(),
          updatedAt: new Date().getTime(),
        });

        await ctx.env.runAction(internal.organisations.internal.action.createPersonalOrganizationWorkos, {
          externalId: event.data.id,
        });
        break;
      case 'user.updated':
        convexId = await ctx.env.runMutation(internal.users.internal.mutation.upsertFromWorkos, {
          externalId: event.data.id,
          email: event.data.email,
          emailVerified: event.data.emailVerified,
          firstName: event.data.firstName,
          lastName: event.data.lastName,
          profilePictureUrl: event.data.profilePictureUrl,
          updatedAt: new Date().getTime(),
        });

        // Trigger PlanetScale sync
        await ctx.env.runAction(internal.workflows.syncUserToPlanetScale.run, {
          id: event.data.id,
          email: event.data.email,
          convexId: convexId,
          updatedAt: new Date().getTime(),
        });
        break;
      case 'user.deleted': {
        await ctx.env.runMutation(internal.users.internal.mutation.deleteFromWorkos, {
          externalId: event.data.id,
        });
        break;
      }
      default:
        throw new ConvexError('Unsupported Clerk webhook event');
    }

    return new Response(null, { status: 200 });
  } catch (error) {
    console.error('Error occured', error);
    return new Response('Auth Webhook Error', {
      status: 400,
    });
  }
}
