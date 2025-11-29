import { pgTable, serial, varchar, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: serial().primaryKey(),
    workosId: varchar({ length: 255 }).notNull(),
    convexId: varchar({ length: 255 }).notNull(),
    updatedAt: timestamp().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_users_workos_id').on(table.workosId),
    uniqueIndex('idx_users_convex_id').on(table.convexId),
  ],
);
