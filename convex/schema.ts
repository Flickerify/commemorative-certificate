import { defineSchema, defineTable } from 'convex/server';
import { v, Infer } from 'convex/values';

export const syncStatusValidator = v.union(v.literal('pending'), v.literal('success'), v.literal('failed'));

export const organizationDomainStatusValidator = v.union(
  v.literal('verified'),
  v.literal('pending'),
  v.literal('failed'),
);

export const organizationMembershipStatusValidator = v.union(
  v.literal('active'),
  v.literal('pending'),
  v.literal('inactive'),
);

export const roleValidator = v.union(v.literal('admin'), v.literal('user'));

export const languageValidator = v.union(
  v.literal('de'),
  v.literal('fr'),
  v.literal('it'),
  v.literal('rm'),
  v.literal('en'),
);

// ============================================================
// USERS & ALERTS
// ============================================================

export const users = defineTable({
  email: v.string(),
  externalId: v.string(),
  firstName: v.nullable(v.string()),
  lastName: v.nullable(v.string()),
  emailVerified: v.boolean(),
  profilePictureUrl: v.nullable(v.string()),
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

export const user = users.validator;
export type User = Infer<typeof user>;

export const userWithoutRole = user.omit('role');
export type UserWithoutRole = Infer<typeof userWithoutRole>;

export const organization = organisations.validator;
export type Organization = Infer<typeof organization>;

export const organizationDomain = organisationDomains.validator;
export type OrganizationDomain = Infer<typeof organizationDomain>;

export const organizationMembership = organizationMemberships.validator;
export type OrganizationMembership = Infer<typeof organizationMembership>;

export type Roles = Infer<typeof roleValidator>;
export type OrganizationDomainStatus = Infer<typeof organizationDomainStatusValidator>;
export type OrganizationMembershipStatus = Infer<typeof organizationMembershipStatusValidator>;
export type SyncStatus = Infer<typeof syncStatusValidator>;
export type Languages = Infer<typeof languageValidator>;
