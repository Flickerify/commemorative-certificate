import { internalMutation } from '../functions';
import { internal } from '../_generated/api';

export const backfillUsers = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query('users').collect();
    let count = 0;
    for (const user of users) {
      await ctx.scheduler.runAfter(0, internal.workflows.syncUserToPlanetScale.run, {
        id: user.externalId,
        email: user.email,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        profilePictureUrl: user.profilePictureUrl || undefined,
      });
      count++;
    }
    return `Scheduled sync for ${count} users`;
  },
});

export const backfillOrganisations = internalMutation({
  args: {},
  handler: async (ctx) => {
    const orgs = await ctx.db.query('organisations').collect();
    let count = 0;
    for (const org of orgs) {
      await ctx.scheduler.runAfter(0, internal.workflows.syncOrganisationToPlanetScale.run, {
        id: org.externalId,
        name: org.name,
        metadata: org.metadata,
      });
      count++;
    }
    return `Scheduled sync for ${count} organisations`;
  },
});
