import { pgTable, serial, varchar, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * Organizations table for PlanetScale.
 * Subscription tier and status are synced from Convex when Stripe webhooks fire.
 *
 * Note: Using varchar instead of enum for PlanetScale compatibility.
 * Valid tiers: 'personal' | 'pro' | 'enterprise'
 * Valid statuses: 'active' | 'canceled' | 'incomplete' | 'incomplete_expired' |
 *                 'past_due' | 'paused' | 'trialing' | 'unpaid' | 'none'
 */
export const organizations = pgTable(
  'organizations',
  {
    id: serial().primaryKey(),
    workosId: varchar({ length: 255 }).notNull(),
    convexId: varchar({ length: 255 }).notNull(),
    // Subscription info synced from Convex (using varchar for PlanetScale compatibility)
    subscriptionTier: varchar({ length: 32 }).default('personal').notNull(),
    subscriptionStatus: varchar({ length: 32 }).default('none').notNull(),
    updatedAt: timestamp().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_organizations_workos_id').on(table.workosId),
    uniqueIndex('idx_organizations_convex_id').on(table.convexId),
  ],
);
