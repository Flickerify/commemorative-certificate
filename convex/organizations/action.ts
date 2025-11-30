'use node';

import { ConvexError, v } from 'convex/values';
import { protectedAction } from '../functions';
import { WorkOS } from '@workos-inc/node';

/**
 * Create a new organization in WorkOS.
 * This will trigger a webhook that syncs the organization to Convex.
 */
export const create = protectedAction({
  args: {
    name: v.string(),
  },
  async handler(ctx, { name }) {
    const workos = new WorkOS(process.env.WORKOS_API_KEY);

    // Create organization in WorkOS
    const organization = await workos.organizations.createOrganization({
      name,
      metadata: {
        tier: 'free',
      },
    });

    // Add the current user as owner
    await workos.userManagement.createOrganizationMembership({
      organizationId: organization.id,
      userId: ctx.user.externalId,
      roleSlug: 'owner',
    });

    return {
      id: organization.id,
      name: organization.name,
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

    return {
      id: organization.id,
      name: organization.name,
    };
  },
});

/**
 * Delete an organization from WorkOS.
 * This will trigger a webhook that removes it from Convex.
 */
export const remove = protectedAction({
  args: {
    organizationId: v.string(),
  },
  async handler(ctx, { organizationId }) {
    const workos = new WorkOS(process.env.WORKOS_API_KEY);

    await workos.organizations.deleteOrganization(organizationId);

    return { success: true };
  },
});

/**
 * Invite a user to an organization via email.
 */
export const inviteMember = protectedAction({
  args: {
    organizationId: v.string(),
    email: v.string(),
    roleSlug: v.optional(v.string()),
  },
  async handler(ctx, { organizationId, email, roleSlug }) {
    const workos = new WorkOS(process.env.WORKOS_API_KEY);

    const invitation = await workos.userManagement.sendInvitation({
      email,
      organizationId,
      roleSlug: roleSlug || 'member',
    });

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

    await workos.userManagement.deleteOrganizationMembership(membership.id);

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

    await workos.userManagement.updateOrganizationMembership(membership.id, {
      roleSlug,
    });

    return { success: true };
  },
});
