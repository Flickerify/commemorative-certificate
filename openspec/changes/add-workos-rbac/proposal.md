# Change: Integrate WorkOS RBAC for Fine-Grained Access Control

## Why

The current authorization model is limited to a global `admin | user` role, which doesn't support organization-scoped permissions. As Flickerify scales to multi-tenant enterprise customers, we need fine-grained access control that:

- Allows organizations to define who can manage billing, team members, schemas, and compatibility rules
- Supports enterprise customers' IdP role assignment via SSO/Directory Sync
- Enables feature gating based on user permissions within an organization

WorkOS RBAC provides a fully managed authorization system that integrates with AuthKit, SSO, and Directory Sync—eliminating the need to build and maintain custom authorization logic.

## What Changes

### Backend (`convex/`)

- **Schema changes**: Add `roles` and `permissions` tables to cache WorkOS RBAC configuration locally; add `permissions` array to `organizationMemberships`
- **Sync infrastructure**: New webhook handlers for `role.created`, `role.updated`, `role.deleted` events; scheduled sync job for bulk reconciliation
- **New function builders in `convex/functions.ts`**:
  - `protectedWithPermission(permission)` – validates user has specific permission in current org
  - `protectedWithRole(role)` – validates user has specific role slug in current org
  - `protectedOrgAdmin()` – validates user has `org:admin` or higher permission
- **Migrate existing `protectedAdmin*` checks** to use WorkOS RBAC permissions instead of global user role
- **Helper utilities** for checking permissions/roles in existing functions

### Frontend (`app/`, `components/`)

- **Permission context provider**: React context exposing user's roles/permissions for current organization
- **`<RequirePermission>` component**: Conditional rendering based on permission
- **`usePermission(permission)` hook**: Check if current user has a permission
- **Navigation updates**: Hide/show menu items based on permissions
- **Page-level guards**: Redirect unauthorized users

### WorkOS Dashboard Configuration

- Define default roles: `owner`, `admin`, `editor`, `member`
- Define CRUD permissions per resource:
  - `schemas:{read|create|update|delete|*}`
  - `rules:{read|create|update|delete|*}`
  - `team:{read|invite|update|remove|*}`
  - `billing:{read|update|*}`
  - `audit:{read|export|*}`
  - `settings:{read|update|*}`
  - `org:admin` (full bypass)
- Configure role → permission mappings with wildcard support

## Impact

- **Affected specs**: New `rbac` capability
- **Affected code**:
  - `convex/functions.ts` – new builders
  - `convex/schema.ts` – new tables
  - `convex/workos/` – webhook handlers
  - `components/` – permission context/guards
  - `app/(app)/` – page-level authorization
- **Breaking changes**: None (existing `protectedAdmin*` continue working, gradually migrated)
- **External dependencies**: WorkOS RBAC (already using AuthKit)
