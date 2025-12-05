# Design: WorkOS RBAC Integration

## Context

Flickerify uses WorkOS AuthKit for authentication and organization management. The current authorization model relies on a global `role: 'admin' | 'user'` field on the users table, which is insufficient for multi-tenant SaaS where different users need different permissions within different organizations.

WorkOS RBAC provides:

- **Roles**: Logical groupings of permissions (e.g., `owner`, `admin`, `member`)
- **Permissions**: Granular access controls (e.g., `org:billing`, `org:schemas`)
- **Organization Roles**: Custom roles scoped to specific organizations
- **IdP Role Assignment**: Automatic role mapping from SSO/Directory groups

## Critical Architecture Principle

**WorkOS is the SOURCE OF TRUTH for all RBAC data.**

```
┌─────────────────────────────────────────────────────────────┐
│                    RBAC DATA FLOW                           │
│                                                             │
│   WorkOS Dashboard ──► Configure roles & permissions        │
│         │                                                   │
│         ▼                                                   │
│   WorkOS SDK ──► Assign roles to users                      │
│   (workos.userManagement.updateOrganizationMembership)      │
│         │                                                   │
│         ▼                                                   │
│   WorkOS Webhooks ──► Sync to Convex (read cache)          │
│         │                                                   │
│         ▼                                                   │
│   Convex Queries ──► Fast, reactive permission checks       │
│         │                                                   │
│         ▼                                                   │
│   Frontend ──► Permission-based UI rendering                │
└─────────────────────────────────────────────────────────────┘
```

**Key points:**
- Convex stores a **read-only cache** of RBAC data
- All RBAC modifications happen through **WorkOS SDK/Dashboard**
- Convex syncs changes via **webhooks** (with Events API as safeguard)
- **No public mutations** in Convex modify RBAC state directly

## Goals / Non-Goals

### Goals

- Enable organization-scoped authorization (user X can manage billing in Org A but not Org B)
- Support permission-based access checks in both frontend and backend
- Cache RBAC data in Convex for real-time reactive queries
- Maintain backward compatibility with existing `protectedAdmin*` patterns
- Enable enterprise customers to use IdP role assignment

### Non-Goals

- Replace all authorization logic immediately (gradual migration)
- Build custom RBAC admin UI (use WorkOS Dashboard and Admin Portal widgets)
- Implement resource-level permissions (e.g., "user X can edit schema Y")—organization-level is sufficient for MVP

## Decisions

### Decision 1: WorkOS as Source of Truth, Convex as Read Cache

**Chosen**: WorkOS is the **single source of truth**; Convex caches RBAC data via webhook-based sync

**Rationale**:

- WorkOS provides managed RBAC with Dashboard UI, SSO integration, and IdP role assignment
- Convex queries need synchronous access to permissions for real-time reactivity
- WorkOS API calls add latency (action required, can't use in queries)
- Webhooks provide near real-time updates with Events API as safeguard
- Already have the webhook infrastructure pattern for users/orgs/memberships

**Data modification flow**:
1. Admin configures roles/permissions in **WorkOS Dashboard**
2. Role assignments via **WorkOS SDK** (e.g., `workos.userManagement.updateOrganizationMembership`)
3. WorkOS sends **webhooks** → Convex internal mutations sync the cache
4. Frontend reads from **Convex queries** for fast permission checks

**What Convex stores (read-only cache)**:
- `roles` table: Cached role definitions with permission arrays
- `permissions` table: Cached permission definitions
- `organizationMemberships.permissions`: Denormalized permissions per user-org

**Alternatives considered**:

- Check WorkOS API per request → High latency, can't use in queries
- Store in session JWT only → Limited to AuthKit integration, not available in Convex queries
- Make Convex the source of truth → Loses WorkOS Dashboard, SSO integration, IdP role mapping

### Decision 2: Permission granularity

**Chosen**: Resource-action permissions with wildcard support

Permission format: `{resource}:{action}` where:

- `resource` = `schemas`, `rules`, `team`, `billing`, `audit`, `settings`
- `action` = `read`, `create`, `update`, `delete`, `*` (wildcard for all)

**Full permission set**:

```
# Schema management
schemas:read       – View source/target schemas
schemas:create     – Create new schemas
schemas:update     – Modify existing schemas
schemas:delete     – Delete schemas
schemas:*          – All schema operations

# Compatibility rules
rules:read         – View rules and policies
rules:create       – Create new rules
rules:update       – Modify existing rules
rules:delete       – Delete rules
rules:*            – All rule operations

# Team management
team:read          – View team members
team:invite        – Invite new members
team:update        – Change member roles
team:remove        – Remove members
team:*             – All team operations

# Billing
billing:read       – View subscription/invoices
billing:update     – Change plans, update payment
billing:*          – All billing operations

# Audit logs (enterprise)
audit:read         – View audit logs
audit:export       – Export audit data
audit:*            – All audit operations

# Organization settings
settings:read      – View org settings
settings:update    – Modify org settings
settings:*         – All settings operations

# Special
org:admin          – Bypass all permission checks (owner only)
```

**Default role mappings**:

- `owner` → `org:admin` (full access)
- `admin` → `schemas:*`, `rules:*`, `team:*`, `billing:read`, `settings:*`
- `editor` → `schemas:*`, `rules:*`
- `member` → `schemas:read`, `rules:read`

**Rationale**:

- CRUD granularity supports real-world access patterns (view-only users, editors without delete)
- Wildcard (`*`) simplifies role definitions while preserving flexibility
- Explicit actions are self-documenting
- Matches WorkOS recommended pattern (`resource:action` with delimiters)

**Alternatives considered**:

- Coarse-grained (`org:schemas`) → Too inflexible for view-only access
- Hierarchical (`schemas:manage` implies all) → Harder to reason about

### Decision 3: Permission resolution logic

**Chosen**: Utility functions that check for exact match OR wildcard match OR org:admin

```typescript
// Permission checking utility
function hasPermission(userPermissions: string[], required: string): boolean {
  // 1. Check for org:admin (full access)
  if (userPermissions.includes('org:admin')) return true;

  // 2. Check exact match
  if (userPermissions.includes(required)) return true;

  // 3. Check wildcard (e.g., 'schemas:*' grants 'schemas:read')
  const [resource] = required.split(':');
  if (userPermissions.includes(`${resource}:*`)) return true;

  return false;
}

// Check multiple permissions (any of them)
function hasAnyPermission(userPermissions: string[], required: string[]): boolean {
  return required.some((p) => hasPermission(userPermissions, p));
}

// Check multiple permissions (all of them)
function hasAllPermissions(userPermissions: string[], required: string[]): boolean {
  return required.every((p) => hasPermission(userPermissions, p));
}
```

**Usage examples**:

```typescript
// User with ['schemas:*', 'rules:read']

hasPermission(perms, 'schemas:read'); // true (wildcard match)
hasPermission(perms, 'schemas:delete'); // true (wildcard match)
hasPermission(perms, 'rules:read'); // true (exact match)
hasPermission(perms, 'rules:delete'); // false (no match)
hasPermission(perms, 'billing:read'); // false (no match)

// User with ['org:admin']
hasPermission(perms, 'anything:here'); // true (admin bypass)
```

**Rationale**:

- Simple resolution order: admin → exact → wildcard
- No complex inheritance trees to traverse
- Easy to debug and reason about

### Decision 4: Convex function builder approach

**Chosen**: Create new permission-aware builders alongside existing ones

```typescript
// New builders
export const protectedWithPermission = (permission: Permission) =>
  customQueryBuilder(baseQuery, customCtx(async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);
    const hasPermission = await checkOrgPermission(ctx, permission);
    if (!hasPermission) throw new ConvexError(`Missing permission: ${permission}`);
    return { ...ctx, user };
  }));

// Usage
export const updateSchema = protectedWithPermission('org:schemas')({
  args: { ... },
  handler: async (ctx, args) => { ... }
});
```

**Alternatives considered**:

- Single builder with permission arg → Less type-safe, harder to read
- Middleware pattern → Convex doesn't have native middleware

### Decision 5: Frontend permission checking

**Chosen**: Permission context + hooks + guard components

```tsx
// Context provides permissions for current org
const { permissions, hasPermission } = usePermissions();

// Hook for conditional logic
const canManageBilling = usePermission('org:billing');

// Guard component for rendering
<RequirePermission permission="org:team">
  <InviteMemberButton />
</RequirePermission>;
```

**Rationale**:

- Declarative, React-idiomatic patterns
- Permissions fetched once per org, cached reactively
- Graceful handling of loading states

### Decision 6: Handling membership role sync

**Chosen**: Store role slug + permissions array on `organizationMemberships`

```typescript
organizationMemberships: {
  // ... existing fields
  roleSlug: v.optional(v.string()),        // 'owner', 'admin', 'member'
  permissions: v.optional(v.array(v.string())), // ['org:admin', 'org:billing', ...]
}
```

**Rationale**:

- Single query to check permissions (no join to roles table)
- Permissions are denormalized but updated via webhook when role changes
- Roles table still maintained for reference/display

## Risks / Trade-offs

### Risk: Stale permissions due to missed webhooks

**Mitigation**: Events API polling (already implemented) serves as safeguard; add reconciliation cron for bulk sync

### Risk: Permission explosion as features grow

**Mitigation**: Start with coarse-grained permissions; refine only when specific access patterns emerge

### Risk: Breaking existing admin checks

**Mitigation**: Keep global `user.role` for backward compatibility; new checks use org-scoped permissions in parallel

### Trade-off: Denormalized permissions on memberships

**Accepted**: Slightly larger documents, but enables fast permission checks in queries without additional lookups

## Migration Plan

### Phase 1: Infrastructure (this proposal)

1. Add schema tables (`roles`, `permissions`)
2. Implement webhook handlers for RBAC events
3. Add function builders and utilities
4. Configure WorkOS Dashboard with roles/permissions

### Phase 2: Backend migration (future)

1. Migrate `protectedAdmin*` functions to use `protectedWithPermission`
2. Add permission checks to existing sensitive operations

### Phase 3: Frontend integration (future)

1. Add permission context provider
2. Update navigation and page guards
3. Add permission-based UI conditionals

### Rollback

- Remove webhook handlers
- Revert to existing `protectedAdmin*` checks
- Keep cached RBAC data (inert if not queried)

## Open Questions

1. **Should we sync all WorkOS roles or only configured ones?**
   - Propose: Sync all, filter in UI

2. **How to handle org without RBAC configured (legacy/personal)?**
   - Propose: Default to owner = full access, member = read access

3. **Should permission checks fail open or closed on sync delay?**
   - Propose: Fail closed (deny access if permission data unavailable)
