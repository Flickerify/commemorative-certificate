import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export const SYNC_STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
} as const;

export const syncStatusValidator = v.union(...Object.values(SYNC_STATUS).map(v.literal));

export const ORGANIZATION_DOMAIN_STATUS = {
  VERIFIED: 'verified',
  PENDING: 'pending',
  FAILED: 'failed',
} as const;

export const organizationDomainStatusValidator = v.union(...Object.values(ORGANIZATION_DOMAIN_STATUS).map(v.literal));

export const ORGANIZATION_MEMBERSHIP_STATUS = {
  ACTIVE: 'active',
  PENDING: 'pending',
  INACTIVE: 'inactive',
} as const;

export const organizationMembershipStatusValidator = v.union(
  ...Object.values(ORGANIZATION_MEMBERSHIP_STATUS).map(v.literal),
);

export const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
} as const;

export const roleValidator = v.optional(v.union(...Object.values(ROLES).map(v.literal)));

export const LANGUAGES = {
  DE: 'de',
  FR: 'fr',
  IT: 'it',
  RM: 'rm',
  EN: 'en',
} as const;

export const languageValidator = v.union(...Object.values(LANGUAGES).map(v.literal));

// ============================================================
// USERS & ALERTS
// ============================================================

export const users = defineTable({
  email: v.string(),
  externalId: v.string(),
  firstName: v.union(v.string(), v.null()),
  lastName: v.union(v.string(), v.null()),
  emailVerified: v.boolean(),
  profilePictureUrl: v.union(v.string(), v.null()),
  role: roleValidator, // User role: USER or ADMIN
  // Preferences
  preferredLocale: v.optional(languageValidator),
  prefs: v.optional(v.any()),
  // Mobile
  expoPushToken: v.optional(v.string()),
  updatedAt: v.number(),
});

export const organisations = defineTable({
  externalId: v.string(),
  name: v.string(),
  metadata: v.optional(v.record(v.string(), v.union(v.string(), v.number(), v.null()))),
  updatedAt: v.number(),
});

export const organisationDomains = defineTable({
  organisationId: v.id('organisations'),
  externalId: v.string(),
  domain: v.string(),
  status: organizationDomainStatusValidator,
  updatedAt: v.number(),
});

export const organizationMemberships = defineTable({
  organizationId: v.string(), // WorkOS Org ID
  userId: v.string(), // WorkOS User ID
  role: v.optional(v.string()), // Role slug
  status: organizationMembershipStatusValidator,
  updatedAt: v.number(),
});

export const syncStatus = defineTable({
  entityType: v.union(v.literal('user'), v.literal('organisation')),
  entityId: v.string(), // WorkOS External ID
  targetSystem: v.literal('planetscale'),
  status: syncStatusValidator,
  lastSyncedAt: v.number(),
  error: v.optional(v.string()),
});

export default defineSchema({
  users: users.index('by_external_id', ['externalId']).index('by_email', ['email']),
  organisations: organisations.index('externalId', ['externalId']),
  organisationDomains: organisationDomains
    .index('organisationId', ['organisationId'])
    .index('externalId', ['externalId'])
    .index('domain', ['domain']),
  organizationMemberships: organizationMemberships
    .index('by_org', ['organizationId'])
    .index('by_user', ['userId'])
    .index('by_org_user', ['organizationId', 'userId']),
  syncStatus: syncStatus.index('by_entity', ['entityType', 'entityId']).index('by_status', ['status']),
});
