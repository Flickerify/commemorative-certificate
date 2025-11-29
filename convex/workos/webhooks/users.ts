import { ConvexError } from 'convex/values';
import { Context } from 'hono';
import { Id } from '../../_generated/dataModel';

import { internal } from '../../_generated/api';
import type { HttpHonoEnv } from '../../types';
import type { Metadata } from '../../schema';

// Transform WorkOS metadata to Convex-compatible format
function transformMetadata(
  workosMetadata: Record<string, unknown> | undefined,
): Metadata | undefined {
  if (!workosMetadata) return undefined;

  const result: Metadata = {};
  for (const [key, value] of Object.entries(workosMetadata)) {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null
    ) {
      result[key] = value;
    }
    // Skip unsupported types (objects, arrays, etc.)
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

export async function handleUserWebhooks(ctx: Context<HttpHonoEnv>) {
  const event = ctx.var.workosEvent;

  let convexId: Id<'users'>;

  try {
    switch (event.event) {
      case 'user.created': {
        const metadata = transformMetadata(event.data.metadata);
        convexId = await ctx.env.runMutation(internal.users.internal.mutation.upsertFromWorkos, {
          externalId: event.data.id,
          email: event.data.email,
          emailVerified: event.data.emailVerified,
          firstName: event.data.firstName,
          lastName: event.data.lastName,
          profilePictureUrl: event.data.profilePictureUrl,
          metadata,
          updatedAt: new Date().getTime(),
        });

        // Kick off PlanetScale sync workflow (with retry)
        await ctx.env.runMutation(internal.workflows.syncToPlanetScale.kickoffUserSync, {
          workosId: event.data.id,
          convexId: convexId,
          email: event.data.email,
          webhookEvent: 'user.created',
          createdAt: new Date().getTime(),
          updatedAt: new Date().getTime(),
        });

        await ctx.env.runAction(internal.organizations.internal.action.createPersonalOrganizationWorkos, {
          externalId: event.data.id,
        });
        break;
      }

      case 'user.updated': {
        const metadata = transformMetadata(event.data.metadata);
        convexId = await ctx.env.runMutation(internal.users.internal.mutation.upsertFromWorkos, {
          externalId: event.data.id,
          email: event.data.email,
          emailVerified: event.data.emailVerified,
          firstName: event.data.firstName,
          lastName: event.data.lastName,
          profilePictureUrl: event.data.profilePictureUrl,
          metadata,
          updatedAt: new Date().getTime(),
        });

        // Kick off PlanetScale sync workflow (with retry)
        await ctx.env.runMutation(internal.workflows.syncToPlanetScale.kickoffUserSync, {
          workosId: event.data.id,
          convexId: convexId,
          email: event.data.email,
          webhookEvent: 'user.updated',
          updatedAt: new Date().getTime(),
        });
        break;
      }

      case 'user.deleted': {
        // Kick off deletion workflow (deletes from PlanetScale first, then Convex with cascade)
        await ctx.env.runMutation(internal.workflows.syncToPlanetScale.kickoffUserDeletion, {
          workosId: event.data.id,
        });
        break;
      }

      default:
        throw new ConvexError('Unsupported WorkOS user webhook event');
    }

    return new Response(null, { status: 200 });
  } catch (error) {
    console.error('Error occurred', error);
    return new Response('Auth Webhook Error', {
      status: 400,
    });
  }
}
