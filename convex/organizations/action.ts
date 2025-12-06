'use node';

import { ConvexError, v } from 'convex/values';
import { protectedAction } from '../functions';
import { WorkOS } from '@workos-inc/node';
import { stripe, FREE_TRIAL_DAYS, getTierFromPriceId } from '../billing/stripe';
import { internal } from '../_generated/api';
import type { Id } from '../_generated/dataModel';
import { TIER_SEAT_LIMITS } from '../schema';

import type { AuditAction, AuditCategory, AuditStatus } from '../schema';
import type { FunctionReference } from 'convex/server';

// Helper to log audit events from actions
async function logAuditFromAction(
  ctx: { runMutation: <T>(fn: FunctionReference<'mutation', 'internal'>, args: T) => Promise<unknown> },
  params: {
    organizationId: Id<'organizations'>;
    actorId?: Id<'users'>;
    actorExternalId?: string;
    actorEmail?: string;
    actorName?: string;
    actorType: 'user' | 'system' | 'api';
    category: AuditCategory;
    action: AuditAction;
    status: AuditStatus;
    targetType?: string;
    targetId?: string;
    targetName?: string;
    description: string;
    metadata?: Record<string, unknown>;
  },
) {
  try {
    await ctx.runMutation(internal.audit.internal.mutation.logAuditEvent, {
      organizationId: params.organizationId,
      actorId: params.actorId,
      actorExternalId: params.actorExternalId,
      actorEmail: params.actorEmail,
      actorName: params.actorName,
      actorType: params.actorType,
      category: params.category,
      action: params.action,
      status: params.status,
      targetType: params.targetType,
      targetId: params.targetId,
      targetName: params.targetName,
      description: params.description,
      metadata: params.metadata,
    });
  } catch (error) {
    // Don't fail the main operation if audit logging fails
    console.error('[Audit] Failed to log audit event:', error);
  }
}

/**
 * Create a new organization in WorkOS with Stripe billing integration.
 * Organizations start with a free trial (no credit card required).
 * Following the WorkOS Stripe Connect pattern:
 * https://workos.com/docs/authkit/add-ons/stripe/connect-to-stripe
 *
 * Flow:
 * 1. Create organization in WorkOS
 * 2. Optimistically insert organization into Convex (webhooks will update later)
 * 3. Create Stripe customer for the organization
 * 4. Update WorkOS organization with stripeCustomerId (enables entitlements + seat sync)
 * 5. Store the Stripe customer binding in Convex
 * 6. Add the current user as owner in WorkOS
 * 7. Optimistically insert membership into Convex
 * 8. Create Stripe subscription with free trial (no payment required)
 *
 * Note: Tier is NOT stored in WorkOS metadata. It comes from organizationSubscriptions table.
 *
 * @param name - Organization name
 * @param priceId - Stripe price ID to subscribe to
 * @param tier - Subscription tier (personal/pro/enterprise)
 * @param successUrl - Redirect URL after successful trial start (not Stripe checkout)
 * @param cancelUrl - Redirect URL if creation fails
 */
export const create = protectedAction({
  args: {
    name: v.string(),
    priceId: v.string(),
    tier: v.union(v.literal('personal'), v.literal('pro'), v.literal('enterprise')),
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  async handler(ctx, { name, priceId, tier, successUrl }) {
    const workos = new WorkOS(process.env.WORKOS_API_KEY);

    // 1. Create organization in WorkOS (metadata is stored locally in Convex only)
    const organization = await workos.organizations.createOrganization({
      name,
    });
    console.log(`[WorkOS] Created organization ${organization.id} (${name})`);

    // 2. Optimistically insert organization into Convex with tier metadata
    // This allows the organization switcher to work immediately
    const convexOrgId: Id<'organizations'> = await ctx.runMutation(
      internal.organizations.internal.mutation.upsertFromWorkos,
      {
        externalId: organization.id,
        name: organization.name,
        metadata: { tier },
        domains: [],
      },
    );
    console.log(`[Convex] Optimistically inserted organization ${convexOrgId}`);

    // 3. Create Stripe customer for this organization
    const stripeCustomer = await stripe.customers.create({
      email: ctx.user.email,
      name: organization.name,
      metadata: {
        workosOrganizationId: organization.id,
        organizationName: organization.name,
      },
    });
    console.log(`[Stripe] Created customer ${stripeCustomer.id} for organization ${organization.name}`);

    // 4. Update WorkOS organization with Stripe customer ID
    // This enables WorkOS Stripe features: entitlements + seat sync
    await workos.organizations.updateOrganization({
      organization: organization.id,
      stripeCustomerId: stripeCustomer.id,
    });
    console.log(
      `[WorkOS + Stripe] Connected stripeCustomerId ${stripeCustomer.id} to WorkOS organization ${organization.id}`,
    );

    // 5. Store Stripe customer binding in Convex immediately (org now exists)
    await ctx.runMutation(internal.billing.internal.mutation.upsertStripeCustomer, {
      organizationId: convexOrgId,
      stripeCustomerId: stripeCustomer.id,
    });
    console.log(`[Convex] Stored Stripe customer binding for organization ${convexOrgId}`);

    // 6. Add the current user as owner in WorkOS
    await workos.userManagement.createOrganizationMembership({
      organizationId: organization.id,
      userId: ctx.user.externalId,
      roleSlug: 'owner',
    });
    console.log(`[WorkOS] Added user ${ctx.user.externalId} as owner of organization ${organization.id}`);

    // 7. Optimistically insert membership into Convex
    // The webhook will arrive later and update any additional fields
    await ctx.runMutation(internal.organizationMemberships.internal.mutation.upsertFromWorkos, {
      organizationId: organization.id,
      userId: ctx.user.externalId,
      roleSlug: 'owner',
      status: 'active',
    });
    console.log(`[Convex] Optimistically inserted membership for user ${ctx.user.externalId}`);

    // 8. Create Stripe subscription with free trial (no payment required)
    // The subscription will be automatically canceled if no payment method is added
    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomer.id,
      items: [{ price: priceId }],
      trial_period_days: FREE_TRIAL_DAYS,
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      trial_settings: {
        end_behavior: {
          missing_payment_method: 'pause', // Pause if no payment method at trial end
        },
      },
      metadata: {
        workosOrganizationId: organization.id,
        organizationId: convexOrgId,
        tier: getTierFromPriceId(priceId),
      },
      // Expand price data to access recurring.interval
      expand: ['items.data.price'],
    });

    console.log(`[Stripe] Created trial subscription ${subscription.id} for organization ${organization.name}`);

    const trialEndsAt = subscription.trial_end
      ? subscription.trial_end * 1000
      : Date.now() + FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000;
    const trialStartedAt = Date.now();
    const derivedTier = getTierFromPriceId(priceId);
    const seatLimit = TIER_SEAT_LIMITS[derivedTier];

    // Extract billing interval from subscription item's price
    const subscriptionItem = subscription.items.data[0];
    const price = subscriptionItem.price;
    const billingInterval = (price.recurring?.interval ?? 'month') as 'month' | 'year';

    // Store subscription in Convex (with trial info)
    const now = Date.now();
    await ctx.runMutation(internal.billing.internal.mutation.upsertSubscriptionWithTrial, {
      organizationId: convexOrgId,
      stripeCustomerId: stripeCustomer.id,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      tier: derivedTier,
      status: 'trialing',
      billingInterval,
      currentPeriodStart: subscriptionItem.current_period_start * 1000,
      currentPeriodEnd: subscriptionItem.current_period_end * 1000,
      cancelAtPeriodEnd: false,
      seatLimit,
      trialStartedAt,
      trialEndsAt,
      hasUsedTrial: true,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`[Convex] Stored trial subscription for organization ${convexOrgId}`);

    // Log audit event for organization creation
    const actorName = [ctx.user.firstName, ctx.user.lastName].filter(Boolean).join(' ') || undefined;
    await logAuditFromAction(ctx, {
      organizationId: convexOrgId,
      actorId: ctx.user._id,
      actorExternalId: ctx.user.externalId,
      actorEmail: ctx.user.email,
      actorName,
      actorType: 'user',
      category: 'settings',
      action: 'settings.organization_updated',
      status: 'success',
      targetType: 'organization',
      targetId: organization.id,
      targetName: name,
      description: `${actorName || ctx.user.email} created organization "${name}" with ${FREE_TRIAL_DAYS}-day free trial`,
      metadata: { tier, workosOrganizationId: organization.id, trialEndsAt },
    });

    return {
      workosOrganizationId: organization.id,
      convexOrganizationId: convexOrgId,
      name: organization.name,
      stripeCustomerId: stripeCustomer.id,
      subscriptionId: subscription.id,
      trialEndsAt,
      // Redirect to success URL directly (no checkout needed)
      redirectUrl: successUrl,
    };
  },
});

/**
 * Update organization details in WorkOS.
 * This will trigger a webhook that syncs the changes to Convex.
 */
export const update = protectedAction({
  args: {
    organizationId: v.string(),
    name: v.optional(v.string()),
  },
  async handler(ctx, { organizationId, name }) {
    const workos = new WorkOS(process.env.WORKOS_API_KEY);

    const organization = await workos.organizations.updateOrganization({
      organization: organizationId,
      name,
    });

    const convexOrgId = await ctx.runMutation(internal.organizations.internal.mutation.upsertFromWorkos, {
      externalId: organization.id,
      name: organization.name,
    });

    // Log audit event for organization update
    const actorName = [ctx.user.firstName, ctx.user.lastName].filter(Boolean).join(' ') || undefined;
    await logAuditFromAction(ctx, {
      organizationId: convexOrgId,
      actorId: ctx.user._id,
      actorExternalId: ctx.user.externalId,
      actorEmail: ctx.user.email,
      actorName,
      actorType: 'user',
      category: 'settings',
      action: 'settings.organization_updated',
      status: 'success',
      targetType: 'organization',
      targetId: organization.id,
      targetName: organization.name,
      description: `${actorName || ctx.user.email} updated organization settings`,
      metadata: name ? { newName: name } : undefined,
    });

    return {
      id: organization.id,
      name: organization.name,
    };
  },
});

/**
 * Delete an organization from WorkOS.
 * This will trigger a webhook that removes it from Convex.
 *
 * IMPORTANT: Organizations with active subscriptions cannot be deleted.
 * The user must first cancel their subscription via the billing portal.
 */
export const remove = protectedAction({
  args: {
    organizationId: v.string(),
  },
  async handler(ctx, { organizationId }) {
    // First, find the Convex organization by its WorkOS external ID
    const organization = await ctx.runQuery(internal.organizations.internal.query.getByExternalId, {
      externalId: organizationId,
    });

    if (!organization) {
      throw new ConvexError('Organization not found');
    }

    // Check if the organization can be deleted (no active subscription)
    const deletionCheck = await ctx.runQuery(internal.billing.query.canDeleteOrganizationInternal, {
      organizationId: organization._id,
    });

    if (!deletionCheck.canDelete) {
      throw new ConvexError(
        deletionCheck.reason ||
          'Cannot delete organization with an active subscription. Please cancel your subscription first.',
      );
    }

    // Log audit event before deletion (while org still exists)
    const actorName = [ctx.user.firstName, ctx.user.lastName].filter(Boolean).join(' ') || undefined;
    await logAuditFromAction(ctx, {
      organizationId: organization._id,
      actorId: ctx.user._id,
      actorExternalId: ctx.user.externalId,
      actorEmail: ctx.user.email,
      actorName,
      actorType: 'user',
      category: 'settings',
      action: 'settings.organization_updated',
      status: 'success',
      targetType: 'organization',
      targetId: organizationId,
      targetName: organization.name,
      description: `${actorName || ctx.user.email} deleted organization "${organization.name}"`,
      metadata: { action: 'deleted' },
    });

    // Safe to delete - proceed with WorkOS deletion
    const workos = new WorkOS(process.env.WORKOS_API_KEY);
    await workos.organizations.deleteOrganization(organizationId);

    console.log(`[WorkOS] Deleted organization ${organizationId}`);

    return { success: true };
  },
});

/**
 * Invite a user to an organization via email.
 * Only owners can invite other users as owners.
 */
export const inviteMember = protectedAction({
  args: {
    organizationId: v.string(),
    email: v.string(),
    roleSlug: v.optional(v.string()),
  },
  async handler(ctx, { organizationId, email, roleSlug }) {
    const workos = new WorkOS(process.env.WORKOS_API_KEY);

    // Check if inviting as owner - only owners can do this
    if (roleSlug === 'owner') {
      const currentMembership = await workos.userManagement.listOrganizationMemberships({
        organizationId,
        userId: ctx.user.externalId,
      });

      const membership = currentMembership.data[0];
      if (!membership || membership.role?.slug !== 'owner') {
        throw new ConvexError('Only owners can invite other users as owners');
      }
    }

    const invitation = await workos.userManagement.sendInvitation({
      email,
      organizationId,
      roleSlug: roleSlug || 'member',
    });

    // Get Convex organization ID for audit logging
    const convexOrg = await ctx.runQuery(internal.organizations.internal.query.getByExternalId, {
      externalId: organizationId,
    });

    if (convexOrg) {
      const actorName = [ctx.user.firstName, ctx.user.lastName].filter(Boolean).join(' ') || undefined;
      await logAuditFromAction(ctx, {
        organizationId: convexOrg._id,
        actorId: ctx.user._id,
        actorExternalId: ctx.user.externalId,
        actorEmail: ctx.user.email,
        actorName,
        actorType: 'user',
        category: 'member',
        action: 'member.invited',
        status: 'success',
        targetType: 'user',
        targetId: email,
        targetName: email,
        description: `${actorName || ctx.user.email} invited ${email} to the organization`,
        metadata: { role: roleSlug || 'member', invitationId: invitation.id },
      });
    }

    return {
      id: invitation.id,
      email: invitation.email,
      state: invitation.state,
      expiresAt: invitation.expiresAt,
    };
  },
});

/**
 * Remove a member from an organization.
 */
export const removeMember = protectedAction({
  args: {
    organizationId: v.string(),
    userId: v.string(),
  },
  async handler(ctx, { organizationId, userId }) {
    const workos = new WorkOS(process.env.WORKOS_API_KEY);

    // Find the membership
    const memberships = await workos.userManagement.listOrganizationMemberships({
      organizationId,
      userId,
    });

    const membership = memberships.data[0];
    if (!membership) {
      throw new ConvexError('Membership not found');
    }

    // Get user details for audit log
    let targetUserEmail: string | undefined;
    let targetUserName: string | undefined;
    try {
      const targetUser = await workos.userManagement.getUser(userId);
      targetUserEmail = targetUser.email;
      targetUserName = [targetUser.firstName, targetUser.lastName].filter(Boolean).join(' ') || undefined;
    } catch {
      // User might not exist anymore
    }

    await workos.userManagement.deleteOrganizationMembership(membership.id);

    // Get Convex organization ID for audit logging
    const convexOrg = await ctx.runQuery(internal.organizations.internal.query.getByExternalId, {
      externalId: organizationId,
    });

    if (convexOrg) {
      const actorName = [ctx.user.firstName, ctx.user.lastName].filter(Boolean).join(' ') || undefined;
      await logAuditFromAction(ctx, {
        organizationId: convexOrg._id,
        actorId: ctx.user._id,
        actorExternalId: ctx.user.externalId,
        actorEmail: ctx.user.email,
        actorName,
        actorType: 'user',
        category: 'member',
        action: 'member.removed',
        status: 'success',
        targetType: 'user',
        targetId: userId,
        targetName: targetUserName || targetUserEmail || userId,
        description: `${actorName || ctx.user.email} removed ${targetUserName || targetUserEmail || 'a member'} from the organization`,
        metadata: { membershipId: membership.id, previousRole: membership.role?.slug },
      });
    }

    return { success: true };
  },
});

/**
 * Update a member's role in an organization.
 */
export const updateMemberRole = protectedAction({
  args: {
    organizationId: v.string(),
    userId: v.string(),
    roleSlug: v.string(),
  },
  async handler(ctx, { organizationId, userId, roleSlug }) {
    const workos = new WorkOS(process.env.WORKOS_API_KEY);

    // Find the membership
    const memberships = await workos.userManagement.listOrganizationMemberships({
      organizationId,
      userId,
    });

    const membership = memberships.data[0];
    if (!membership) {
      throw new ConvexError('Membership not found');
    }

    const previousRole = membership.role?.slug;

    // Get user details for audit log
    let targetUserEmail: string | undefined;
    let targetUserName: string | undefined;
    try {
      const targetUser = await workos.userManagement.getUser(userId);
      targetUserEmail = targetUser.email;
      targetUserName = [targetUser.firstName, targetUser.lastName].filter(Boolean).join(' ') || undefined;
    } catch {
      // User might not exist anymore
    }

    await workos.userManagement.updateOrganizationMembership(membership.id, {
      roleSlug,
    });

    // Get Convex organization ID for audit logging
    const convexOrg = await ctx.runQuery(internal.organizations.internal.query.getByExternalId, {
      externalId: organizationId,
    });

    if (convexOrg) {
      const actorName = [ctx.user.firstName, ctx.user.lastName].filter(Boolean).join(' ') || undefined;
      await logAuditFromAction(ctx, {
        organizationId: convexOrg._id,
        actorId: ctx.user._id,
        actorExternalId: ctx.user.externalId,
        actorEmail: ctx.user.email,
        actorName,
        actorType: 'user',
        category: 'member',
        action: 'member.role_changed',
        status: 'success',
        targetType: 'user',
        targetId: userId,
        targetName: targetUserName || targetUserEmail || userId,
        description: `${actorName || ctx.user.email} changed ${targetUserName || targetUserEmail || 'a member'}'s role from ${previousRole || 'unknown'} to ${roleSlug}`,
        metadata: { previousRole, newRole: roleSlug, membershipId: membership.id },
      });
    }

    return { success: true };
  },
});
