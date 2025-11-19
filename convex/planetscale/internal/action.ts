'use node';

import { internalAction } from '../../functions';
import { v } from 'convex/values';

export const upsertUser = internalAction({
  args: {
    id: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    profilePictureUrl: v.optional(v.string()),
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

export const upsertOrganisation = internalAction({
  args: {
    id: v.string(),
    name: v.string(),
    slug: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // await db
    //   .insert(organisations)
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
