import { pgTable, serial, varchar, timestamp } from 'drizzle-orm/pg-core';

export const organizations = pgTable('organizations', {
  id: serial().primaryKey(),
  workosId: varchar({ length: 255 }).notNull().unique(),
  convexId: varchar({ length: 255 }).notNull().unique(),
  updatedAt: timestamp().notNull(),
  createdAt: timestamp().notNull().defaultNow(),
});
