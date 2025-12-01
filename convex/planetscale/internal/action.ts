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
  returns: v.object({ success: v.boolean(), planetscaleId: v.number() }),
  handler: async (ctx, args) => {
    const { id, convexId, email, createdAt, updatedAt } = args;

    // First try to find existing record to get its ID
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.workosId, id)).limit(1);

    if (existing.length > 0) {
      // Update existing record
      await db
        .update(users)
        .set({ updatedAt: new Date(updatedAt) })
        .where(eq(users.workosId, id));
      return { success: true, planetscaleId: existing[0].id };
    }

    // Insert new record and get the ID
    const result = await db
      .insert(users)
      .values({
        workosId: id,
        convexId: convexId,
        createdAt: createdAt ? new Date(createdAt) : new Date(),
        updatedAt: new Date(updatedAt),
      })
      .returning({ id: users.id });

    return { success: true, planetscaleId: result[0].id };
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
  returns: v.object({ success: v.boolean(), planetscaleId: v.number() }),
  handler: async (ctx, args) => {
    const { id, convexId, createdAt, updatedAt } = args;

    // First try to find existing record to get its ID
    const existing = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.workosId, id))
      .limit(1);

    if (existing.length > 0) {
      // Update existing record
      await db
        .update(organizations)
        .set({ updatedAt: new Date(updatedAt) })
        .where(eq(organizations.workosId, id));
      return { success: true, planetscaleId: existing[0].id };
    }

    // Insert new record and get the ID
    const result = await db
      .insert(organizations)
      .values({
        workosId: id,
        convexId: convexId,
        createdAt: createdAt ? new Date(createdAt) : new Date(),
        updatedAt: new Date(updatedAt),
      })
      .returning({ id: organizations.id });

    return { success: true, planetscaleId: result[0].id };
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

/**
 * Update organization subscription tier in PlanetScale.
 * Called when subscription data is synced from Stripe.
 */
export const updateOrganizationSubscription = internalAction({
  args: {
    workosId: v.string(),
    tier: v.union(v.literal('personal'), v.literal('pro'), v.literal('enterprise')),
    status: v.union(
      v.literal('active'),
      v.literal('canceled'),
      v.literal('incomplete'),
      v.literal('incomplete_expired'),
      v.literal('past_due'),
      v.literal('paused'),
      v.literal('trialing'),
      v.literal('unpaid'),
      v.literal('none'),
    ),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const { workosId, tier, status } = args;

    await db
      .update(organizations)
      .set({
        subscriptionTier: tier,
        subscriptionStatus: status,
        updatedAt: new Date(),
      })
      .where(eq(organizations.workosId, workosId));

    console.log(`[PlanetScale] Updated subscription for organization ${workosId}: tier=${tier}, status=${status}`);

    return { success: true };
  },
});
