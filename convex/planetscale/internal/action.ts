'use node';

import { internalAction } from '../../functions';
import { v } from 'convex/values';

export const upsertUser = internalAction({
  args: {
    id: v.string(),
    convexId: v.string(),
    email: v.string(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    // await db
    //   .insert(users)
    //   .values({
    //     id: args.id,
    //     email: args.email,
    //     firstName: args.firstName || null,
    //     lastName: args.lastName || null,
    //     profilePictureUrl: args.profilePictureUrl || null,
    //   })
    //   .onDuplicateKeyUpdate({
    //     set: {
    //       email: args.email,
    //       firstName: args.firstName || null,
    //       lastName: args.lastName || null,
    //       profilePictureUrl: args.profilePictureUrl || null,
    //       updatedAt: new Date(),
    //     },
    //   });
    return { success: true };
  },
});

export const upsertOrganization = internalAction({
  args: {
    id: v.string(),
    convexId: v.id('organizations'),
    createdAt: v.optional(v.number()),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    // await db
    //   .insert(organizations)
    //   .values({
    //     id: args.id,
    //     name: args.name,
    //     slug: args.slug || null,
    //     metadata: args.metadata || null,
    //   })
    //   .onDuplicateKeyUpdate({
    //     set: {
    //       name: args.name,
    //       slug: args.slug || null,
    //       metadata: args.metadata || null,
    //       updatedAt: new Date(),
    //     },
    //   });
    return { success: true };
  },
});
