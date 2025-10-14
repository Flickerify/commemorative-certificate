import { defineSchema, defineTable } from 'convex/server';

import { v } from 'convex/values';

export const users = defineTable({
  email: v.string(),
  externalId: v.string(),
  firstName: v.union(v.string(), v.null()),
  lastName: v.union(v.string(), v.null()),
  emailVerified: v.boolean(),
});

export default defineSchema({
  users: users.index('by_email', ['email']).index('by_external_id', ['externalId']),
});
