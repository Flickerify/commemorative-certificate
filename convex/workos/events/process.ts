'use node';

import { v } from 'convex/values';
import { internalAction } from '../../_generated/server';
import { internal } from '../../_generated/api';
import type { Id } from '../../_generated/dataModel';
import type { Metadata } from '../../schema';
import type { ActionCtx } from '../../_generated/server';
import {
  UserCreatedEvent,
  UserUpdatedEvent,
  UserDeletedEvent,
  OrganizationCreatedEvent,
  OrganizationUpdatedEvent,
  OrganizationDeletedEvent,
  OrganizationMembershipCreated,
  OrganizationMembershipUpdated,
  OrganizationMembershipDeleted,
  OrganizationDomainVerifiedEvent,
  OrganizationDomainVerificationFailedEvent,
  OrganizationDomainCreatedEvent,
  OrganizationDomainUpdatedEvent,
  OrganizationDomainDeletedEvent,
  RoleCreatedEvent,
  RoleUpdatedEvent,
  RoleDeletedEvent,
} from '@workos-inc/node';

// Cast WorkOS metadata to Convex Metadata type
function toMetadata(workosMetadata: Record<string, string> | undefined): Metadata | undefined {
  if (!workosMetadata || Object.keys(workosMetadata).length === 0) return undefined;
  return workosMetadata as Metadata;
}

// Helper to get field value with camelCase/snake_case fallback
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getField<T>(data: any, camelCase: string, snakeCase: string, defaultValue?: T): T {
  return data[camelCase] ?? data[snakeCase] ?? defaultValue;
}

/**
 * Process a single WorkOS event asynchronously.
 * Called by webhooks (scheduled) and Events API (polling).
 * Both use the same event ID for deduplication.
 */
export const processWebhookEvent = internalAction({
  args: {
    eventId: v.string(),
    event: v.any(),
    source: v.union(v.literal('webhook'), v.literal('events_api')),
  },
  returns: v.object({
    success: v.boolean(),
    skipped: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, { eventId, event, source }) => {
    const { event: eventType } = event;

    // Check if event was already processed (idempotency)
    const alreadyProcessed = await ctx.runQuery(internal.workos.events.query.isEventProcessed, {
      eventId,
    });

    if (alreadyProcessed) {
      console.log(`[${source}] Skipping already processed event: ${eventId} (${eventType})`);
      return { success: true, skipped: true };
    }

    try {
      // Process based on event type
      await processEvent(ctx, event);

      // Mark event as processed
      await ctx.runMutation(internal.workos.events.mutation.markEventProcessed, {
        eventId,
        eventType: event.event,
      });

      console.log(`[${source}] Successfully processed event: ${eventId} (${eventType})`);
      return { success: true, skipped: false };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[${source}] Error processing event ${eventId} (${eventType}):`, errorMsg);
      return { success: false, skipped: false, error: errorMsg };
    }
  },
});

/**
 * Process event based on type.
 */
async function processEvent(
  ctx: ActionCtx,
  event:
    | UserCreatedEvent
    | UserUpdatedEvent
    | UserDeletedEvent
    | OrganizationCreatedEvent
    | OrganizationUpdatedEvent
    | OrganizationDeletedEvent
    | OrganizationMembershipCreated
    | OrganizationMembershipUpdated
    | OrganizationMembershipDeleted
    | OrganizationDomainVerifiedEvent
    | OrganizationDomainVerificationFailedEvent
    | OrganizationDomainCreatedEvent
    | OrganizationDomainUpdatedEvent
    | OrganizationDomainDeletedEvent
    | RoleCreatedEvent
    | RoleUpdatedEvent
    | RoleDeletedEvent,
) {
  const { event: eventType, data } = event;
  switch (eventType) {
    // ============================================================
    // USER EVENTS
    // ============================================================
    case 'user.created': {
      const now = Date.now();
      const convexId: Id<'users'> = await ctx.runMutation(internal.users.internal.mutation.upsertFromWorkos, {
        externalId: data.id,
        email: data.email,
        emailVerified: getField(data, 'emailVerified', 'email_verified', false),
        firstName: getField(data, 'firstName', 'first_name', null),
        lastName: getField(data, 'lastName', 'last_name', null),
        profilePictureUrl: getField(data, 'profilePictureUrl', 'profile_picture_url', null),
        metadata: toMetadata(data.metadata),
        updatedAt: now,
      });

      await ctx.runMutation(internal.workflows.syncToPlanetScale.kickoffUserSync, {
        workosId: data.id,
        convexId: convexId,
        email: data.email,
        webhookEvent: 'user.created' as const,
        createdAt: now,
        updatedAt: now,
      });
      break;
    }

    case 'user.updated': {
      const now = Date.now();
      const convexId: Id<'users'> = await ctx.runMutation(internal.users.internal.mutation.upsertFromWorkos, {
        externalId: data.id,
        email: data.email,
        emailVerified: getField(data, 'emailVerified', 'email_verified', false),
        firstName: getField(data, 'firstName', 'first_name', null),
        lastName: getField(data, 'lastName', 'last_name', null),
        profilePictureUrl: getField(data, 'profilePictureUrl', 'profile_picture_url', null),
        metadata: toMetadata(data.metadata),
        updatedAt: now,
      });

      await ctx.runMutation(internal.workflows.syncToPlanetScale.kickoffUserSync, {
        workosId: data.id,
        convexId: convexId,
        email: data.email,
        webhookEvent: 'user.updated' as const,
        updatedAt: now,
      });
      break;
    }

    case 'user.deleted': {
      await ctx.runMutation(internal.workflows.syncToPlanetScale.kickoffUserDeletion, {
        workosId: data.id,
      });
      break;
    }

    // ============================================================
    // ORGANIZATION EVENTS
    // ============================================================
    case 'organization.created': {
      const now = Date.now();
      const convexId: Id<'organizations'> = await ctx.runMutation(
        internal.organizations.internal.mutation.upsertFromWorkos,
        {
          externalId: data.id,
          name: data.name,
          metadata: data.metadata,
          domains: (data.domains ?? []).map((domain: { domain: string; id: string; state: string }) => ({
            domain: domain.domain,
            externalId: domain.id,
            status: domain.state as 'verified' | 'pending' | 'failed',
          })),
        },
      );

      await ctx.runMutation(internal.workflows.syncToPlanetScale.kickoffOrganizationSync, {
        workosId: data.id,
        convexId: convexId,
        webhookEvent: 'organization.created' as const,
        createdAt: now,
        updatedAt: now,
      });
      break;
    }

    case 'organization.updated': {
      const now = Date.now();
      const convexId: Id<'organizations'> = await ctx.runMutation(
        internal.organizations.internal.mutation.upsertFromWorkos,
        {
          externalId: data.id,
          name: data.name,
          metadata: data.metadata,
          domains: (data.domains ?? []).map((domain: { domain: string; id: string; state: string }) => ({
            domain: domain.domain,
            externalId: domain.id,
            status: domain.state as 'verified' | 'pending' | 'failed',
          })),
        },
      );

      await ctx.runMutation(internal.workflows.syncToPlanetScale.kickoffOrganizationSync, {
        workosId: data.id,
        convexId: convexId,
        webhookEvent: 'organization.updated' as const,
        updatedAt: now,
      });
      break;
    }

    case 'organization.deleted': {
      await ctx.runMutation(internal.workflows.syncToPlanetScale.kickoffOrganizationDeletion, {
        workosId: data.id,
      });
      break;
    }

    // ============================================================
    // ORGANIZATION MEMBERSHIP EVENTS
    // ============================================================
    case 'organization_membership.created':
    case 'organization_membership.updated': {
      // Extract role slug from WorkOS role object
      // WorkOS sends role as: { slug: 'member', ... } or similar
      const roleSlug = data.role?.slug ?? undefined;

      await ctx.runMutation(internal.organizationMemberships.internal.mutation.upsertFromWorkos, {
        organizationId: getField(data, 'organizationId', 'organization_id', ''),
        userId: getField(data, 'userId', 'user_id', ''),
        role: roleSlug, // Legacy field for backward compatibility
        roleSlug, // New field for RBAC
        status: data.status,
      });
      break;
    }

    case 'organization_membership.deleted': {
      await ctx.runMutation(internal.organizationMemberships.internal.mutation.deleteFromWorkos, {
        organizationId: getField(data, 'organizationId', 'organization_id', ''),
        userId: getField(data, 'userId', 'user_id', ''),
      });
      break;
    }

    // ============================================================
    // ORGANIZATION DOMAIN EVENTS
    // ============================================================
    case 'organization_domain.verified': {
      await ctx.runMutation(internal.organizationDomains.internal.mutation.updateFromWorkos, {
        externalId: data.id,
        status: 'verified' as const,
      });
      break;
    }

    case 'organization_domain.verification_failed': {
      await ctx.runMutation(internal.organizationDomains.internal.mutation.updateFromWorkos, {
        externalId: data.id,
        status: 'failed' as const,
      });
      break;
    }
    // ============================================================
    // ROLES EVENTS
    // ============================================================
    case 'role.created': {
      await ctx.runMutation(internal.rbac.internal.mutation.syncRoleFromWorkos, {
        slug: data.slug,
        permissions: data.permissions,
        source: 'environment' as const,
      });
      break;
    }
    case 'role.updated': {
      await ctx.runMutation(internal.rbac.internal.mutation.syncRoleFromWorkos, {
        slug: data.slug,
        permissions: data.permissions,
        source: 'environment' as const,
      });
      break;
    }
    case 'role.deleted': {
      await ctx.runMutation(internal.rbac.internal.mutation.removeRoleFromCache, {
        slug: data.slug,
      });
    }

    default: {
      console.warn(`[WorkOS] Unknown event type: ${eventType}`);
    }
  }
}
