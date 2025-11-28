import { int, mysqlTable, serial, varchar, json, boolean, timestamp } from 'drizzle-orm/mysql-core';

export const users = mysqlTable('users', {
  id: serial().primaryKey(),
  workosId: varchar({ length: 255 }).notNull().unique(),
  convexId: varchar({ length: 255 }).notNull().unique(),
  updatedAt: timestamp().notNull(),
  createdAt: timestamp().notNull().defaultNow(),
});
