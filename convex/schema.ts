import { defineSchema, defineTable } from 'convex/server';
import { v, Infer } from 'convex/values';

export const syncStatusValidator = v.union(v.literal('pending'), v.literal('success'), v.literal('failed'));

export const webhookEventValidator = v.union(
  v.literal('user.created'),
  v.literal('user.updated'),
  v.literal('user.deleted'),
  v.literal('organization.created'),
  v.literal('organization.updated'),
  v.literal('organization.deleted'),
  v.literal('organization_domain.verified'),
  v.literal('organization_domain.verification_failed'),
);

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
// STRIPE BILLING
// ============================================================

export const subscriptionStatusValidator = v.union(
  v.literal('active'),
  v.literal('canceled'),
  v.literal('incomplete'),
  v.literal('incomplete_expired'),
  v.literal('past_due'),
  v.literal('paused'),
  v.literal('trialing'),
  v.literal('unpaid'),
  v.literal('none'),
);
export type SubscriptionStatus = Infer<typeof subscriptionStatusValidator>;

export const subscriptionTierValidator = v.union(v.literal('personal'), v.literal('pro'), v.literal('enterprise'));
export type SubscriptionTier = Infer<typeof subscriptionTierValidator>;

export const billingIntervalValidator = v.union(v.literal('month'), v.literal('year'));
export type BillingInterval = Infer<typeof billingIntervalValidator>;

// Seat limits per tier
export const TIER_SEAT_LIMITS: Record<SubscriptionTier, number> = {
  personal: 1, // Personal workspace - 1 seat only
  pro: 3,
  enterprise: -1, // unlimited
};

// Money-back guarantee period (days)
export const MONEY_BACK_GUARANTEE_DAYS = 30;

// Stripe customer - links organizations to Stripe
export const stripeCustomers = defineTable({
  organizationId: v.id('organizations'),
  stripeCustomerId: v.string(),
  createdAt: v.number(),
});

// Organization subscriptions - synced from Stripe
export const organizationSubscriptions = defineTable({
  organizationId: v.id('organizations'),
  stripeCustomerId: v.string(),
  stripeSubscriptionId: v.optional(v.string()),
  stripePriceId: v.optional(v.string()),
  tier: subscriptionTierValidator,
  status: subscriptionStatusValidator,
  billingInterval: v.optional(billingIntervalValidator),
  currentPeriodStart: v.optional(v.number()),
  currentPeriodEnd: v.optional(v.number()),
  cancelAtPeriodEnd: v.boolean(),
  cancelAt: v.optional(v.number()), // Stripe's scheduled cancellation timestamp (ms)
  seatLimit: v.number(), // -1 for unlimited
  // Payment method info (optional)
  paymentMethodBrand: v.optional(v.string()),
  paymentMethodLast4: v.optional(v.string()),
  // Pending checkout tracking (for abandoned checkout recovery)
  pendingCheckoutSessionId: v.optional(v.string()),
  pendingPriceId: v.optional(v.string()),
  // Scheduled plan change (for downgrades scheduled at period end)
  scheduledTier: v.optional(subscriptionTierValidator),
  scheduledBillingInterval: v.optional(billingIntervalValidator),
  scheduledPriceId: v.optional(v.string()),
  stripeScheduleId: v.optional(v.string()), // Stripe subscription schedule ID
  // First subscription start date (for 30-day money-back guarantee - never resets)
  firstSubscriptionStart: v.optional(v.number()),
  // Track if user has already used their one-time downgrade during the 30-day guarantee
  // Prevents abuse of immediate refunds (Stripe fees are not returned on refunds)
  hasDowngradedDuringGuarantee: v.optional(v.boolean()),
  // Timestamps
  createdAt: v.number(),
  updatedAt: v.number(),
});

// ============================================================
// USERS & ORGANIZATIONS
// ============================================================

export const metadataValidator = v.record(v.string(), v.string());

export const users = defineTable({
  email: v.string(),
  externalId: v.string(),
  firstName: v.nullable(v.string()),
  lastName: v.nullable(v.string()),
  emailVerified: v.boolean(),
  profilePictureUrl: v.nullable(v.string()),
  role: roleValidator,
  metadata: v.optional(metadataValidator),
  expoPushToken: v.optional(v.string()),
  planetscaleId: v.optional(v.number()), // PlanetScale serial ID for cross-database association
  updatedAt: v.number(),
});

export const organizations = defineTable({
  externalId: v.string(),
  name: v.string(),
  metadata: v.optional(metadataValidator),
  planetscaleId: v.optional(v.number()), // PlanetScale serial ID for cross-database association
  updatedAt: v.number(),
});

export const organizationDomains = defineTable({
  organizationId: v.id('organizations'),
  externalId: v.string(),
  domain: v.string(),
  status: organizationDomainStatusValidator,
  updatedAt: v.number(),
});

export const organizationMemberships = defineTable({
  organizationId: v.string(), // WorkOS organization externalId
  userId: v.string(), // WorkOS user externalId
  roleSlug: v.optional(v.string()), // Role slug from WorkOS (e.g., 'owner', 'admin', 'member', 'finance')
  permissions: v.optional(v.array(v.string())), // Denormalized permissions from JWT for fast lookups
  status: organizationMembershipStatusValidator,
  createdAt: v.optional(v.number()),
  updatedAt: v.number(),
});

export const syncStatus = defineTable({
  entityType: v.union(v.literal('user'), v.literal('organization')),
  entityId: v.string(),
  targetSystem: v.literal('planetscale'),
  status: syncStatusValidator,
  webhookEvent: webhookEventValidator,
  workflowId: v.string(),
  startedAt: v.number(),
  completedAt: v.optional(v.number()),
  durationMs: v.optional(v.number()),
  error: v.optional(v.string()),
});

// ============================================================
// STRIPE WEBHOOK IDEMPOTENCY
// ============================================================

export const stripeWebhookEvents = defineTable({
  eventId: v.string(),
  eventType: v.string(),
  customerId: v.optional(v.string()),
  processedAt: v.number(),
});

// ============================================================
// WORKOS EVENTS API CURSOR
// ============================================================

export const workosEventsCursor = defineTable({
  // Singleton identifier - always 'main'
  key: v.literal('main'),
  // The cursor (event ID) to resume from
  cursor: v.optional(v.string()),
  // Last successful poll timestamp
  lastPolledAt: v.number(),
  // Last processed event ID for idempotency
  lastProcessedEventId: v.optional(v.string()),
  updatedAt: v.number(),
});

// ============================================================
// WORKOS PROCESSED EVENTS (for idempotency/deduplication)
// ============================================================

export const workosProcessedEvents = defineTable({
  eventId: v.string(),
  eventType: v.string(),
  processedAt: v.number(),
});

// ============================================================
// AUDIT LOGS (Enterprise Organizations Only)
// ============================================================

// Default retention period in days (1 year)
export const DEFAULT_AUDIT_RETENTION_DAYS = 365;

// Audit action categories for organizing events
export const auditCategoryValidator = v.union(
  v.literal('authentication'), // Login, logout, session events
  v.literal('member'), // Member added, removed, role changed
  v.literal('billing'), // Subscription, payment, plan changes
  v.literal('settings'), // Organization settings changed
  v.literal('security'), // Security settings, API keys, 2FA
  v.literal('data'), // Data export, import, deletion
  v.literal('integration'), // External integrations, webhooks
);
export type AuditCategory = Infer<typeof auditCategoryValidator>;

// Specific audit action types
export const auditActionValidator = v.union(
  // Authentication actions
  v.literal('user.login'),
  v.literal('user.logout'),
  v.literal('user.login_failed'),
  v.literal('user.password_changed'),
  v.literal('user.password_reset_requested'),
  v.literal('user.mfa_enabled'),
  v.literal('user.mfa_disabled'),
  v.literal('user.session_revoked'),
  // Member actions
  v.literal('member.invited'),
  v.literal('member.joined'),
  v.literal('member.removed'),
  v.literal('member.role_changed'),
  v.literal('member.suspended'),
  v.literal('member.reactivated'),
  // Billing actions
  v.literal('billing.subscription_created'),
  v.literal('billing.subscription_updated'),
  v.literal('billing.subscription_canceled'),
  v.literal('billing.subscription_reactivated'),
  v.literal('billing.plan_upgraded'),
  v.literal('billing.plan_downgraded'),
  v.literal('billing.payment_succeeded'),
  v.literal('billing.payment_failed'),
  v.literal('billing.invoice_generated'),
  v.literal('billing.refund_issued'),
  // Settings actions
  v.literal('settings.organization_updated'),
  v.literal('settings.domain_added'),
  v.literal('settings.domain_removed'),
  v.literal('settings.domain_verified'),
  v.literal('settings.audit_retention_updated'),
  // Security actions
  v.literal('security.api_key_created'),
  v.literal('security.api_key_revoked'),
  v.literal('security.api_key_rotated'),
  v.literal('security.sso_enabled'),
  v.literal('security.sso_disabled'),
  v.literal('security.ip_allowlist_updated'),
  // Data actions
  v.literal('data.exported'),
  v.literal('data.imported'),
  v.literal('data.deleted'),
  v.literal('data.schema_created'),
  v.literal('data.schema_updated'),
  v.literal('data.schema_deleted'),
  // Integration actions
  v.literal('integration.webhook_created'),
  v.literal('integration.webhook_updated'),
  v.literal('integration.webhook_deleted'),
  v.literal('integration.connected'),
  v.literal('integration.disconnected'),
);
export type AuditAction = Infer<typeof auditActionValidator>;

// Audit event status
export const auditStatusValidator = v.union(v.literal('success'), v.literal('failure'), v.literal('pending'));
export type AuditStatus = Infer<typeof auditStatusValidator>;

// Audit logs table
export const auditLogs = defineTable({
  organizationId: v.id('organizations'),
  // Actor information (who performed the action)
  actorId: v.optional(v.id('users')), // Can be null for system actions
  actorExternalId: v.optional(v.string()), // WorkOS user ID for reference
  actorEmail: v.optional(v.string()), // Denormalized for fast display
  actorName: v.optional(v.string()), // Denormalized for fast display
  actorType: v.union(v.literal('user'), v.literal('system'), v.literal('api')),
  // Action details
  category: auditCategoryValidator,
  action: auditActionValidator,
  status: auditStatusValidator,
  // Target information (what was affected)
  targetType: v.optional(v.string()), // e.g., 'user', 'subscription', 'api_key'
  targetId: v.optional(v.string()), // ID of the affected resource
  targetName: v.optional(v.string()), // Human-readable name of the target
  // Metadata for additional context
  metadata: v.optional(v.record(v.string(), v.any())),
  // Description for human-readable summary
  description: v.string(),
  // Request context (for security audit trail)
  ipAddress: v.optional(v.string()),
  userAgent: v.optional(v.string()),
  // Timestamps
  timestamp: v.number(), // When the event occurred
  expiresAt: v.number(), // When this log should be deleted (TTL)
});

// Organization audit settings
export const organizationAuditSettings = defineTable({
  organizationId: v.id('organizations'),
  // Retention period in days (default 365, future: upgradeable)
  retentionDays: v.number(),
  // Feature flags for future
  isRetentionUpgradable: v.boolean(), // Can upgrade retention (paid feature)
  // Timestamps
  createdAt: v.number(),
  updatedAt: v.number(),
});

// ============================================================
// ENTERPRISE INQUIRY REQUESTS
// ============================================================

export const enterpriseInquiryStatusValidator = v.union(
  v.literal('pending'),
  v.literal('contacted'),
  v.literal('approved'),
  v.literal('rejected'),
  v.literal('converted'),
);
export type EnterpriseInquiryStatus = Infer<typeof enterpriseInquiryStatusValidator>;

export const companySizeValidator = v.union(
  v.literal('1-10'),
  v.literal('11-50'),
  v.literal('51-200'),
  v.literal('201-500'),
  v.literal('501-1000'),
  v.literal('1000+'),
);
export type CompanySize = Infer<typeof companySizeValidator>;

export const enterpriseInquiries = defineTable({
  // Contact information
  firstName: v.string(),
  lastName: v.string(),
  email: v.string(),
  phone: v.optional(v.string()),
  jobTitle: v.string(),
  // Company information
  companyName: v.string(),
  companyWebsite: v.optional(v.string()),
  companySize: companySizeValidator,
  industry: v.string(),
  // Requirements
  expectedUsers: v.number(),
  useCase: v.string(),
  currentSolution: v.optional(v.string()),
  timeline: v.string(),
  budget: v.optional(v.string()),
  additionalRequirements: v.optional(v.string()),
  // Features of interest
  interestedFeatures: v.array(v.string()),
  // Status tracking
  status: enterpriseInquiryStatusValidator,
  // Admin response
  adminNotes: v.optional(v.string()),
  respondedAt: v.optional(v.number()),
  respondedBy: v.optional(v.id('users')),
  // Optional: Link to organization if user is logged in
  userId: v.optional(v.id('users')),
  organizationId: v.optional(v.id('organizations')),
  // Email tracking
  confirmationEmailSent: v.boolean(),
  adminNotificationSent: v.boolean(),
  // Timestamps
  createdAt: v.number(),
  updatedAt: v.number(),
});

// ============================================================
// RBAC - ROLES & PERMISSIONS (Synced from WorkOS)
// ============================================================

/**
 * Source of the role definition.
 * - 'environment': Default roles defined at the WorkOS environment level
 * - 'organization': Custom roles defined at the organization level
 */
export const roleSourceValidator = v.union(v.literal('environment'), v.literal('organization'));
export type RoleSource = Infer<typeof roleSourceValidator>;

/**
 * Roles table - caches WorkOS role definitions locally.
 * Roles are logical groupings of permissions.
 */
export const roles = defineTable({
  slug: v.string(), // Unique identifier (e.g., 'owner', 'admin', 'member')
  name: v.optional(v.string()), // Display name
  description: v.optional(v.string()), // Optional description
  permissions: v.array(v.string()), // Array of permission slugs
  isDefault: v.boolean(), // Whether this is the default role for new members
  source: roleSourceValidator, // Where the role was defined
  organizationId: v.optional(v.id('organizations')), // For organization-scoped roles
  createdAt: v.number(),
  updatedAt: v.number(),
});

/**
 * Permissions table - caches WorkOS permission definitions locally.
 * Permissions are granular access controls (e.g., 'schemas:read').
 */
export const permissions = defineTable({
  slug: v.string(), // Unique identifier (e.g., 'schemas:read', 'billing:update')
  name: v.string(), // Display name
  description: v.optional(v.string()), // Optional description
  resource: v.string(), // Resource category (e.g., 'schemas', 'billing')
  action: v.string(), // Action type (e.g., 'read', 'create', 'update', 'delete', '*')
  createdAt: v.number(),
  updatedAt: v.number(),
});

// ============================================================
// DEAD LETTER QUEUE FOR FAILED SYNCS
// ============================================================

export const deadLetterQueueEntityTypeValidator = v.union(
  v.literal('user'),
  v.literal('organization'),
  v.literal('subscription'),
);
export type DeadLetterQueueEntityType = Infer<typeof deadLetterQueueEntityTypeValidator>;

export const deadLetterQueue = defineTable({
  workflowId: v.string(),
  entityType: deadLetterQueueEntityTypeValidator,
  entityId: v.string(),
  error: v.string(),
  context: v.optional(v.any()), // Store additional context for debugging
  createdAt: v.number(),
  retryable: v.boolean(),
  retryCount: v.number(),
  lastRetryAt: v.optional(v.number()),
  resolvedAt: v.optional(v.number()),
});

export default defineSchema({
  users: users
    .index('by_external_id', ['externalId'])
    .index('by_email', ['email'])
    .index('by_planetscale_id', ['planetscaleId']),
  organizations: organizations.index('externalId', ['externalId']).index('by_planetscale_id', ['planetscaleId']),
  organizationDomains: organizationDomains
    .index('organizationId', ['organizationId'])
    .index('externalId', ['externalId'])
    .index('domain', ['domain']),
  organizationMemberships: organizationMemberships
    .index('by_org', ['organizationId'])
    .index('by_user', ['userId'])
    .index('by_org_user', ['organizationId', 'userId']),
  syncStatus: syncStatus
    .index('by_entity', ['entityType', 'entityId'])
    .index('by_status', ['status'])
    .index('by_workflow', ['workflowId']),
  // Stripe billing
  stripeCustomers: stripeCustomers
    .index('by_organization', ['organizationId'])
    .index('by_stripe_customer', ['stripeCustomerId']),
  organizationSubscriptions: organizationSubscriptions
    .index('by_organization', ['organizationId'])
    .index('by_organization_and_status', ['organizationId', 'status'])
    .index('by_stripe_customer', ['stripeCustomerId'])
    .index('by_stripe_subscription', ['stripeSubscriptionId']),
  // Stripe webhook idempotency
  stripeWebhookEvents: stripeWebhookEvents.index('by_event_id', ['eventId']),
  // Dead letter queue for failed syncs
  deadLetterQueue: deadLetterQueue
    .index('by_workflow', ['workflowId'])
    .index('by_entity', ['entityType', 'entityId'])
    .index('by_status', ['retryable', 'resolvedAt']),
  // WorkOS Events API cursor (singleton)
  workosEventsCursor: workosEventsCursor.index('by_key', ['key']),
  // WorkOS processed events for idempotency
  workosProcessedEvents: workosProcessedEvents.index('by_event_id', ['eventId']),
  // Audit logs (enterprise organizations only)
  auditLogs: auditLogs
    .index('by_organization', ['organizationId'])
    .index('by_organization_and_timestamp', ['organizationId', 'timestamp'])
    .index('by_organization_and_category', ['organizationId', 'category'])
    .index('by_organization_and_action', ['organizationId', 'action'])
    .index('by_organization_and_actor', ['organizationId', 'actorId'])
    .index('by_organization_and_status', ['organizationId', 'status'])
    .index('by_expires_at', ['expiresAt'])
    .searchIndex('search_description', {
      searchField: 'description',
      filterFields: ['organizationId', 'category', 'status', 'actorId'],
    }),
  // Organization audit settings
  organizationAuditSettings: organizationAuditSettings.index('by_organization', ['organizationId']),
  // Enterprise inquiry requests
  enterpriseInquiries: enterpriseInquiries
    .index('by_status', ['status'])
    .index('by_email', ['email'])
    .index('by_organization', ['organizationId'])
    .index('by_created_at', ['createdAt']),
  // RBAC - Roles and permissions (synced from WorkOS)
  roles: roles
    .index('by_slug', ['slug'])
    .index('by_organization', ['organizationId'])
    .index('by_source', ['source'])
    .index('by_default', ['isDefault']),
  permissions: permissions.index('by_slug', ['slug']).index('by_resource', ['resource']),
});

export const user = users.validator;
export type User = Infer<typeof user>;

export const userWithoutRole = user.omit('role');
export type UserWithoutRole = Infer<typeof userWithoutRole>;

export const organization = organizations.validator;
export type Organization = Infer<typeof organization>;

export const organizationDomain = organizationDomains.validator;
export type OrganizationDomain = Infer<typeof organizationDomain>;

export const organizationMembership = organizationMemberships.validator;
export type OrganizationMembership = Infer<typeof organizationMembership>;

export type Roles = Infer<typeof roleValidator>;
export type OrganizationDomainStatus = Infer<typeof organizationDomainStatusValidator>;
export type OrganizationMembershipStatus = Infer<typeof organizationMembershipStatusValidator>;
export type SyncStatus = Infer<typeof syncStatusValidator>;
export type WebhookEvent = Infer<typeof webhookEventValidator>;
export type Languages = Infer<typeof languageValidator>;
export type Metadata = Infer<typeof metadataValidator>;

// Audit log types
export const auditLog = auditLogs.validator;
export type AuditLog = Infer<typeof auditLog>;

export const organizationAuditSetting = organizationAuditSettings.validator;
export type OrganizationAuditSetting = Infer<typeof organizationAuditSetting>;

// Enterprise inquiry types
export const enterpriseInquiry = enterpriseInquiries.validator;
export type EnterpriseInquiry = Infer<typeof enterpriseInquiry>;

// RBAC types
export const role = roles.validator;
export type Role = Infer<typeof role>;

export const permission = permissions.validator;
export type PermissionDoc = Infer<typeof permission>;
