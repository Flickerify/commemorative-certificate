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

// Trial configuration
export const TRIAL_PERIOD_DAYS = 14;

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
  // Trial info
  trialStart: v.optional(v.number()), // Trial start timestamp (ms)
  trialEnd: v.optional(v.number()), // Trial end timestamp (ms)
  seatLimit: v.number(), // -1 for unlimited
  // Payment method info (optional)
  paymentMethodBrand: v.optional(v.string()),
  paymentMethodLast4: v.optional(v.string()),
  // Pending checkout tracking (for abandoned checkout recovery)
  pendingCheckoutSessionId: v.optional(v.string()),
  pendingPriceId: v.optional(v.string()),
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
  updatedAt: v.number(),
});

export const organizations = defineTable({
  externalId: v.string(),
  name: v.string(),
  metadata: v.optional(metadataValidator),
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
  organizationId: v.string(),
  userId: v.string(),
  role: v.optional(v.string()),
  status: organizationMembershipStatusValidator,
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
  users: users.index('by_external_id', ['externalId']).index('by_email', ['email']),
  organizations: organizations.index('externalId', ['externalId']),
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
    .index('by_stripe_customer', ['stripeCustomerId'])
    .index('by_stripe_subscription', ['stripeSubscriptionId']),
  // Stripe webhook idempotency
  stripeWebhookEvents: stripeWebhookEvents.index('by_event_id', ['eventId']),
  // Dead letter queue for failed syncs
  deadLetterQueue: deadLetterQueue
    .index('by_workflow', ['workflowId'])
    .index('by_entity', ['entityType', 'entityId'])
    .index('by_status', ['retryable', 'resolvedAt']),
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
