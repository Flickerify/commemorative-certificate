import { ConvexError, v } from 'convex/values';
import { internalMutation } from '../../functions';
import { internal } from '../../_generated/api';

export const updateFromWorkos = internalMutation({
  args: {
    externalId: v.string(),
    status: v.union(v.literal('verified'), v.literal('pending'), v.literal('failed')),
  },
  async handler(ctx, { externalId, status }) {
    const domain = await ctx.db
      .query('organizationDomains')
      .withIndex('externalId', (q) => q.eq('externalId', externalId))
      .first();

    if (domain === null) {
      throw new ConvexError('Domain not found');
    }

    const previousStatus = domain.status;

    await ctx.db.patch(domain._id, {
      status,
    });

    // Log audit event for domain status changes
    if (previousStatus !== status && (status === 'verified' || status === 'failed')) {
      const action = status === 'verified' ? 'settings.domain_verified' : 'settings.domain_verified';
      const description =
        status === 'verified' ? `Domain ${domain.domain} was verified` : `Domain ${domain.domain} verification failed`;

      await ctx.scheduler.runAfter(0, internal.audit.internal.mutation.logAuditEvent, {
        organizationId: domain.organizationId,
        actorType: 'system' as const,
        actorName: 'WorkOS',
        category: 'settings' as const,
        action: action as any,
        status: status === 'verified' ? ('success' as const) : ('failure' as const),
        targetType: 'domain',
        targetId: domain.domain,
        targetName: domain.domain,
        description,
        metadata: { previousStatus, newStatus: status },
      });
    }

    return domain._id;
  },
});
