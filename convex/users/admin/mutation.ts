import { ConvexError, v } from 'convex/values';
import { protectedAdminMutation } from '../../functions';
import { roleValidator } from '../../schema';
import { internal } from '../../_generated/api';

/**
 * Set a user as admin by email (admin only)
 * Useful for initial admin setup
 */
export const setAdminByEmail = protectedAdminMutation({
  args: {
    email: v.string(),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const targetUser = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .first();

    if (!targetUser) {
      throw new ConvexError('User not found');
    }

    const previousRole = targetUser.role;

    await ctx.db.patch(targetUser._id, {
      role: 'admin',
      updatedAt: Date.now(),
    });

    // Log audit event - find an organization the admin belongs to for logging
    const membership = await ctx.db
      .query('organizationMemberships')
      .withIndex('by_user', (q) => q.eq('userId', ctx.user.externalId))
      .first();

    if (membership) {
      const org = await ctx.db
        .query('organizations')
        .withIndex('externalId', (q) => q.eq('externalId', membership.organizationId))
        .first();

      if (org) {
        const actorName = [ctx.user.firstName, ctx.user.lastName].filter(Boolean).join(' ') || undefined;
        const targetName = [targetUser.firstName, targetUser.lastName].filter(Boolean).join(' ') || undefined;

        await ctx.scheduler.runAfter(0, internal.audit.internal.mutation.logAuditEvent, {
          organizationId: org._id,
          actorId: ctx.user._id,
          actorExternalId: ctx.user.externalId,
          actorEmail: ctx.user.email,
          actorName,
          actorType: 'user' as const,
          category: 'security' as const,
          action: 'member.role_changed' as const,
          status: 'success' as const,
          targetType: 'user',
          targetId: targetUser._id,
          targetName: targetName || args.email,
          description: `${actorName || ctx.user.email} promoted ${targetName || args.email} to admin`,
          metadata: { previousRole, newRole: 'admin' },
        });
      }
    }

    return null;
  },
});

/**
 * Update user role (admin only)
 */
export const updateUserRole = protectedAdminMutation({
  args: {
    userId: v.id('users'),
    role: roleValidator,
  },
  async handler(ctx, args) {
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new ConvexError('User not found');
    }

    const previousRole = targetUser.role;

    await ctx.db.patch(args.userId, {
      role: args.role,
      updatedAt: Date.now(),
    });

    // Log audit event - find an organization the admin belongs to for logging
    const membership = await ctx.db
      .query('organizationMemberships')
      .withIndex('by_user', (q) => q.eq('userId', ctx.user.externalId))
      .first();

    if (membership) {
      const org = await ctx.db
        .query('organizations')
        .withIndex('externalId', (q) => q.eq('externalId', membership.organizationId))
        .first();

      if (org) {
        const actorName = [ctx.user.firstName, ctx.user.lastName].filter(Boolean).join(' ') || undefined;
        const targetName = [targetUser.firstName, targetUser.lastName].filter(Boolean).join(' ') || undefined;

        await ctx.scheduler.runAfter(0, internal.audit.internal.mutation.logAuditEvent, {
          organizationId: org._id,
          actorId: ctx.user._id,
          actorExternalId: ctx.user.externalId,
          actorEmail: ctx.user.email,
          actorName,
          actorType: 'user' as const,
          category: 'security' as const,
          action: 'member.role_changed' as const,
          status: 'success' as const,
          targetType: 'user',
          targetId: targetUser._id,
          targetName: targetName || targetUser.email,
          description: `${actorName || ctx.user.email} changed ${targetName || targetUser.email}'s role from ${previousRole} to ${args.role}`,
          metadata: { previousRole, newRole: args.role },
        });
      }
    }

    return null;
  },
});
