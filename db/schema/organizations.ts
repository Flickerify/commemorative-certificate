import { pgTable, serial, varchar, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const organizations = pgTable(
  'organizations',
  {
    id: serial().primaryKey(),
    workosId: varchar({ length: 255 }).notNull(),
    convexId: varchar({ length: 255 }).notNull(),
    updatedAt: timestamp().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (table) => [uniqueIndex('idx_workos_id').on(table.workosId), uniqueIndex('idx_convex_id').on(table.convexId)],
);
