'use node';

import { internalAction } from '../../functions';
import { v } from 'convex/values';
import db from '../../../db';
import { users } from '../../../db/schema/users';
import { organizations } from '../../../db/schema/organizations';
import { eq } from 'drizzle-orm';

export const upsertUser = internalAction({
  args: {
    id: v.string(),
    convexId: v.string(),
    email: v.string(),
    createdAt: v.optional(v.number()),
    updatedAt: v.number(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const { id, convexId, email, createdAt, updatedAt } = args;

    await db
      .insert(users)
      .values({
        workosId: id,
        convexId: convexId,
        createdAt: createdAt ? new Date(createdAt) : new Date(),
        updatedAt: new Date(updatedAt),
      })
      .onConflictDoUpdate({
        target: [users.workosId],
        set: {
          updatedAt: new Date(updatedAt),
        },
      });
    return { success: true };
  },
});

export const deleteUser = internalAction({
  args: {
    workosId: v.string(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const { workosId } = args;

    await db.delete(users).where(eq(users.workosId, workosId));
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
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const { id, convexId, createdAt, updatedAt } = args;

    await db
      .insert(organizations)
      .values({
        workosId: id,
        convexId: convexId,
        createdAt: createdAt ? new Date(createdAt) : new Date(),
        updatedAt: new Date(updatedAt),
      })
      .onConflictDoUpdate({
        target: [organizations.workosId],
        set: {
          updatedAt: new Date(updatedAt),
        },
      });
    return { success: true };
  },
});

export const deleteOrganization = internalAction({
  args: {
    workosId: v.string(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const { workosId } = args;

    await db.delete(organizations).where(eq(organizations.workosId, workosId));
    return { success: true };
  },
});
