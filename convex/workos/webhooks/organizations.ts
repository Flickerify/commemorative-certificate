import type { HttpHonoEnv } from '../../types';

import { ConvexError } from 'convex/values';
import { Context } from 'hono';

import { internal } from '../../_generated/api';
import { Id } from '../../_generated/dataModel';

export async function handleOrganizationWebhooks(ctx: Context<HttpHonoEnv>) {
  const event = ctx.var.workosEvent;
  let convexId: Id<'organizations'> ;

  try {
    switch (event.event) {
      case 'organization.created':
        convexId = await ctx.env.runMutation(internal.organizations.internal.mutation.upsertFromWorkos, {
          externalId: event.data.id,
          name: event.data.name,
          metadata: event.data.metadata,
          domains: event.data.domains.map((domain) => {
            return {
              domain: domain.domain,
              externalId: domain.id,
              status: domain.state as 'verified' | 'pending' | 'failed',
            };
          }),
        });

        // Trigger PlanetScale sync
        await ctx.env.runAction(internal.workflows.syncOrganizationToPlanetScale.run, {
          id: event.data.id,
          convexId: convexId,
          createdAt: new Date().getTime(),
          updatedAt: new Date().getTime(),
        });
        break;
      case 'organization.updated':
        convexId = await ctx.env.runMutation(internal.organizations.internal.mutation.upsertFromWorkos, {
          externalId: event.data.id,
          name: event.data.name,
          metadata: event.data.metadata,
          domains: event.data.domains.map((domain) => {
            return {
              domain: domain.domain,
              externalId: domain.id,
              status: domain.state as 'verified' | 'pending' | 'failed',
            };
          }),
        });

        // Trigger PlanetScale sync
        await ctx.env.runAction(internal.workflows.syncOrganizationToPlanetScale.run, {
          id: event.data.id,
          convexId: convexId,
          updatedAt: new Date().getTime(),
        });
        break;
      case 'organization.deleted': {
        await ctx.env.runMutation(internal.organizations.internal.mutation.deleteFromWorkos, {
          externalId: event.data.id,
        });
        break;
      }
      case 'organization_domain.verified':
        await ctx.env.runMutation(internal.organizationDomains.internal.mutation.updateFromWorkos, {
          externalId: event.data.id,
          status: 'verified',
        });
        break;
      case 'organization_domain.verification_failed':
        await ctx.env.runMutation(internal.organizationDomains.internal.mutation.updateFromWorkos, {
          externalId: event.data.id,
          status: 'failed',
        });
        break;
      default:
        throw new ConvexError('Unsupported webhook event');
    }

    return new Response(null, { status: 200 });
  } catch (error) {
    console.error('Error occured', error);
    return new Response('Auth Webhook Error', {
      status: 400,
    });
  }
}
