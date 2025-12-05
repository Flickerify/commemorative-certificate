import { internal } from '../_generated/api';
import type { Id, Doc } from '../_generated/dataModel';
import type { AuditAction, AuditCategory, AuditStatus } from '../schema';
import type { MutationCtx } from '../_generated/server';

// Type for user context passed to audit functions
export interface AuditActor {
  id?: Id<'users'>;
  externalId?: string;
  email?: string;
  name?: string;
  type: 'user' | 'system' | 'api';
}

// Type for target entity
export interface AuditTarget {
  type?: string;
  id?: string;
  name?: string;
}

// Type for request context
export interface AuditRequestContext {
  ipAddress?: string;
  userAgent?: string;
}

// Type for the full audit log parameters
export interface AuditLogParams {
  organizationId: Id<'organizations'>;
  actor: AuditActor;
  category: AuditCategory;
  action: AuditAction;
  status: AuditStatus;
  target?: AuditTarget;
  description: string;
  metadata?: Record<string, unknown>;
  requestContext?: AuditRequestContext;
}

/**
 * Creates an audit actor from a user document.
 */
export function createActorFromUser(user: Doc<'users'>): AuditActor {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined;
  return {
    id: user._id,
    externalId: user.externalId,
    email: user.email,
    name: fullName,
    type: 'user' as const,
  };
}

/**
 * Creates a system actor for automated processes.
 */
export function createSystemActor(name?: string): AuditActor {
  return {
    type: 'system' as const,
    name: name || 'System',
  };
}

/**
 * Creates an API actor for external API calls.
 */
export function createApiActor(name?: string): AuditActor {
  return {
    type: 'api' as const,
    name: name || 'API',
  };
}

/**
 * Log an audit event from within a mutation.
 * This is the main helper function to use when logging audit events.
 *
 * @example
 * ```ts
 * await logAudit(ctx, {
 *   organizationId: org._id,
 *   actor: createActorFromUser(ctx.user),
 *   category: 'member',
 *   action: 'member.invited',
 *   status: 'success',
 *   target: { type: 'user', id: invitedEmail, name: invitedEmail },
 *   description: `Invited ${invitedEmail} to the organization`,
 *   metadata: { role: 'member' },
 * });
 * ```
 */
export async function logAudit(ctx: { scheduler: MutationCtx['scheduler'] }, params: AuditLogParams): Promise<void> {
  // Schedule the audit log to be written asynchronously
  // This ensures audit logging doesn't block the main mutation
  await ctx.scheduler.runAfter(0, internal.audit.internal.mutation.logAuditEvent, {
    organizationId: params.organizationId,
    actorId: params.actor.id,
    actorExternalId: params.actor.externalId,
    actorEmail: params.actor.email,
    actorName: params.actor.name,
    actorType: params.actor.type,
    category: params.category,
    action: params.action,
    status: params.status,
    targetType: params.target?.type,
    targetId: params.target?.id,
    targetName: params.target?.name,
    description: params.description,
    metadata: params.metadata as Record<string, unknown> | undefined,
    ipAddress: params.requestContext?.ipAddress,
    userAgent: params.requestContext?.userAgent,
  });
}

/**
 * Generate a human-readable description for common audit actions.
 */
export function generateAuditDescription(action: AuditAction, actorName: string, targetName?: string): string {
  const descriptions: Record<AuditAction, string> = {
    // Authentication
    'user.login': `${actorName} signed in`,
    'user.logout': `${actorName} signed out`,
    'user.login_failed': `Failed sign-in attempt for ${actorName}`,
    'user.password_changed': `${actorName} changed their password`,
    'user.password_reset_requested': `${actorName} requested a password reset`,
    'user.mfa_enabled': `${actorName} enabled two-factor authentication`,
    'user.mfa_disabled': `${actorName} disabled two-factor authentication`,
    'user.session_revoked': `${actorName} revoked a session`,
    // Member
    'member.invited': `${actorName} invited ${targetName || 'a user'} to the organization`,
    'member.joined': `${targetName || 'A user'} joined the organization`,
    'member.removed': `${actorName} removed ${targetName || 'a user'} from the organization`,
    'member.role_changed': `${actorName} changed the role of ${targetName || 'a user'}`,
    'member.suspended': `${actorName} suspended ${targetName || 'a user'}`,
    'member.reactivated': `${actorName} reactivated ${targetName || 'a user'}`,
    // Billing
    'billing.subscription_created': `${actorName} created a subscription`,
    'billing.subscription_updated': `${actorName} updated the subscription`,
    'billing.subscription_canceled': `${actorName} canceled the subscription`,
    'billing.subscription_reactivated': `${actorName} reactivated the subscription`,
    'billing.plan_upgraded': `${actorName} upgraded the subscription plan`,
    'billing.plan_downgraded': `${actorName} downgraded the subscription plan`,
    'billing.payment_succeeded': `Payment succeeded`,
    'billing.payment_failed': `Payment failed`,
    'billing.invoice_generated': `Invoice generated`,
    'billing.refund_issued': `Refund issued`,
    // Settings
    'settings.organization_updated': `${actorName} updated organization settings`,
    'settings.domain_added': `${actorName} added domain ${targetName || ''}`,
    'settings.domain_removed': `${actorName} removed domain ${targetName || ''}`,
    'settings.domain_verified': `Domain ${targetName || ''} was verified`,
    'settings.audit_retention_updated': `${actorName} updated audit retention settings`,
    // Security
    'security.api_key_created': `${actorName} created an API key`,
    'security.api_key_revoked': `${actorName} revoked an API key`,
    'security.api_key_rotated': `${actorName} rotated an API key`,
    'security.sso_enabled': `${actorName} enabled SSO`,
    'security.sso_disabled': `${actorName} disabled SSO`,
    'security.ip_allowlist_updated': `${actorName} updated IP allowlist`,
    // Data
    'data.exported': `${actorName} exported data`,
    'data.imported': `${actorName} imported data`,
    'data.deleted': `${actorName} deleted data`,
    'data.schema_created': `${actorName} created schema ${targetName || ''}`,
    'data.schema_updated': `${actorName} updated schema ${targetName || ''}`,
    'data.schema_deleted': `${actorName} deleted schema ${targetName || ''}`,
    // Integration
    'integration.webhook_created': `${actorName} created a webhook`,
    'integration.webhook_updated': `${actorName} updated a webhook`,
    'integration.webhook_deleted': `${actorName} deleted a webhook`,
    'integration.connected': `${actorName} connected integration ${targetName || ''}`,
    'integration.disconnected': `${actorName} disconnected integration ${targetName || ''}`,
  };

  return descriptions[action] || `${actorName} performed ${action}`;
}

/**
 * Map action to category for convenience.
 */
export function getCategoryForAction(action: AuditAction): AuditCategory {
  const actionPrefix = action.split('.')[0];
  const categoryMap: Record<string, AuditCategory> = {
    user: 'authentication',
    member: 'member',
    billing: 'billing',
    settings: 'settings',
    security: 'security',
    data: 'data',
    integration: 'integration',
  };
  return categoryMap[actionPrefix] || 'settings';
}
