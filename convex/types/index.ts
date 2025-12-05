import type { CustomCtx } from 'convex-helpers/server/customFunctions';
import type { Env, ValidationTargets } from 'hono';
import type Stripe from 'stripe';

import type { Doc } from '../_generated/dataModel';
import type { ActionCtx } from '../_generated/server';
import {
  internalAction,
  internalMutation,
  internalQuery,
  protectedAction,
  protectedMutation,
  protectedQuery,
  publicMutation,
  publicQuery,
} from '../functions';
import type { Event as WorkosEvent } from '@workos-inc/node';

export type PublicQueryCtx = CustomCtx<typeof publicQuery>;
export type PublicMutationCtx = CustomCtx<typeof publicMutation>;
export type InternalMutationCtx = CustomCtx<typeof internalMutation>;
export type InternalActionCtx = CustomCtx<typeof internalAction>;
export type InternalQueryCtx = CustomCtx<typeof internalQuery>;
export type ProtectedQueryCtx = CustomCtx<typeof protectedQuery>;
export type ProtectedMutationCtx = CustomCtx<typeof protectedMutation>;
export type ProtectedActionCtx = CustomCtx<typeof protectedAction>;

export type ActionContext = {
  Bindings: ActionCtx & Env;
  Variables: {
    user: Doc<'users'>;
  };
  ValidationTargets: ValidationTargets;
};

// ============================================================
// RBAC TYPES - Three-level permission format
// Format: {domain}:{resource}:{action}
// ============================================================

/**
 * Permission domains - top-level grouping of related features.
 */
export type PermissionDomain = 'organization' | 'content' | 'finance' | 'audit';

/**
 * Resources within each domain.
 */
export type OrganizationResource = 'membership' | 'settings' | 'administration';
export type ContentResource = 'schemas' | 'rules';
export type FinanceResource = 'billing' | 'invoices' | 'reports';
export type AuditResource = 'logs';

/**
 * Actions available for permissions.
 * - 'read-only': View access
 * - 'create': Create new items
 * - 'update': Modify existing items
 * - 'delete': Remove items
 * - 'invite': Invite new members (membership only)
 * - 'export': Export data (audit, finance)
 * - 'manage': Full access to the resource (wildcard)
 */
export type PermissionAction = 'read-only' | 'create' | 'update' | 'delete' | 'invite' | 'export' | 'manage';

/**
 * All valid permission strings.
 * Format: `{domain}:{resource}:{action}`
 *
 * Special permission:
 * - `organization:administration:manage` = Full access to everything
 */
export type Permission =
  // Organization domain
  | 'organization:membership:read-only'
  | 'organization:membership:invite'
  | 'organization:membership:update'
  | 'organization:membership:delete'
  | 'organization:membership:manage'
  | 'organization:settings:read-only'
  | 'organization:settings:update'
  | 'organization:settings:manage'
  | 'organization:administration:manage' // Super admin - full access to everything

  // Content domain
  | 'content:schemas:read-only'
  | 'content:schemas:create'
  | 'content:schemas:update'
  | 'content:schemas:delete'
  | 'content:schemas:manage'
  | 'content:rules:read-only'
  | 'content:rules:create'
  | 'content:rules:update'
  | 'content:rules:delete'
  | 'content:rules:manage'

  // Finance domain
  | 'finance:billing:read-only'
  | 'finance:billing:update'
  | 'finance:billing:manage'
  | 'finance:invoices:read-only'
  | 'finance:invoices:export'
  | 'finance:invoices:manage'
  | 'finance:reports:read-only'
  | 'finance:reports:export'
  | 'finance:reports:manage'

  // Audit domain
  | 'audit:logs:read-only'
  | 'audit:logs:export'
  | 'audit:logs:manage';

/**
 * Default role slugs from WorkOS.
 */
export type RoleSlug = 'owner' | 'admin' | 'editor' | 'finance' | 'member' | string;

/**
 * Default role → permission mappings.
 * Used when denormalizing permissions from role slug.
 *
 * Permission hierarchy:
 * - 'manage' grants all actions for that resource
 * - 'organization:administration:manage' grants full access to everything
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  // Owner: Full organization administration
  owner: ['organization:administration:manage'],

  // Admin: Full content + membership + settings, read-only finance
  admin: [
    'content:schemas:manage',
    'content:rules:manage',
    'organization:membership:manage',
    'organization:settings:manage',
    'finance:billing:read-only',
  ],

  // Editor: Full content access only
  editor: ['content:schemas:manage', 'content:rules:manage'],

  // Finance: Full finance access + audit read + settings read
  finance: [
    'finance:billing:manage',
    'finance:invoices:manage',
    'finance:reports:manage',
    'audit:logs:read-only',
    'organization:settings:read-only',
  ],

  // Member: Read-only content access
  member: ['content:schemas:read-only', 'content:rules:read-only'],
};

/**
 * Hono environment for WorkOS webhooks.
 */
export type WorkosHonoEnv = {
  Variables: {
    workosEvent: WorkosEvent;
  };
  Bindings: ActionCtx;
};

/**
 * Hono environment for Stripe webhooks.
 */
export type StripeHonoEnv = {
  Variables: {
    stripeEvent: Stripe.Event;
  };
  Bindings: ActionCtx;
};
