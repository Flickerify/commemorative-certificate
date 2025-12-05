## ADDED Requirements

### Requirement: RBAC Configuration Sync

The system SHALL synchronize role and permission definitions from WorkOS to Convex database for local querying.

#### Scenario: Initial RBAC sync on deployment

- **GIVEN** WorkOS Dashboard has roles and permissions configured
- **WHEN** the scheduled sync job runs
- **THEN** all roles are stored in the `roles` table with their permission mappings
- **AND** all permissions are stored in the `permissions` table

#### Scenario: Role update via webhook

- **GIVEN** an admin updates a role's permissions in WorkOS Dashboard
- **WHEN** the webhook or Events API delivers the event
- **THEN** the `roles` table is updated with new permission mappings
- **AND** all memberships with that role have their cached permissions updated

#### Scenario: New role created

- **GIVEN** an admin creates a new role in WorkOS Dashboard
- **WHEN** the sync job or webhook processes the event
- **THEN** the role is inserted into the `roles` table
- **AND** the role is available for assignment

---

### Requirement: Membership Permission Caching

The system SHALL store denormalized permissions on organization memberships for efficient access checks.

#### Scenario: Membership created with role

- **GIVEN** a user is added to an organization with role `admin`
- **WHEN** the membership webhook is processed
- **THEN** the `organizationMemberships` record stores `roleSlug: 'admin'`
- **AND** the `permissions` array contains all permissions assigned to the `admin` role

#### Scenario: Membership role changed

- **GIVEN** a membership exists with role `member`
- **WHEN** an admin changes the role to `admin` via WorkOS
- **THEN** the `organizationMemberships` record is updated with new `roleSlug`
- **AND** the `permissions` array is updated with the admin role's permissions

#### Scenario: Role permissions updated

- **GIVEN** multiple memberships have role `admin`
- **WHEN** the `admin` role's permissions are modified in WorkOS
- **THEN** all memberships with `roleSlug: 'admin'` have their `permissions` array updated

---

### Requirement: Backend Permission Enforcement

The system SHALL provide function builders that enforce permission checks before executing protected operations.

#### Scenario: Query with required permission succeeds

- **GIVEN** a user has `billing:read` permission for organization X
- **WHEN** the user calls a `protectedWithPermission('billing:read')` query for organization X
- **THEN** the query executes successfully
- **AND** the handler receives the authenticated user context

#### Scenario: Query with missing permission fails

- **GIVEN** a user does NOT have `billing:update` permission for organization X
- **WHEN** the user calls a `protectedWithPermission('billing:update')` query for organization X
- **THEN** the query throws a `ConvexError` with message "Missing permission: billing:update"
- **AND** the handler is not executed

#### Scenario: Wildcard permission grants access

- **GIVEN** a user has `schemas:*` permission (wildcard)
- **WHEN** the user calls a `protectedWithPermission('schemas:delete')` mutation
- **THEN** the mutation executes successfully (wildcard matches specific action)

#### Scenario: Mutation with CRUD permission check

- **GIVEN** a user has `schemas:create` and `schemas:update` permissions
- **WHEN** the user calls a `protectedWithPermission('schemas:create')` mutation
- **THEN** the mutation executes with user context available

#### Scenario: Action with permission check

- **GIVEN** a user has `team:invite` permission
- **WHEN** the user calls a `protectedWithPermissionAction('team:invite')` action
- **THEN** the action executes with user context available

#### Scenario: Multiple permissions required

- **GIVEN** a user has `schemas:read` but NOT `schemas:delete`
- **WHEN** the user calls a function requiring both permissions
- **THEN** the function throws a `ConvexError` indicating missing permission

---

### Requirement: Organization Admin Shortcut

The system SHALL provide a convenience builder for checking organization admin access.

#### Scenario: Org admin check with owner role

- **GIVEN** a user has the `owner` role (which includes `org:admin` permission)
- **WHEN** the user calls a `protectedOrgAdmin()` query
- **THEN** the query executes successfully

#### Scenario: Org admin check with admin role

- **GIVEN** a user has the `admin` role (which includes `org:admin` permission)
- **WHEN** the user calls a `protectedOrgAdmin()` mutation
- **THEN** the mutation executes successfully

#### Scenario: Org admin check with member role

- **GIVEN** a user has only the `member` role (no `org:admin` permission)
- **WHEN** the user calls a `protectedOrgAdmin()` query
- **THEN** the query throws a `ConvexError` indicating insufficient permissions

---

### Requirement: Permission Checking Utilities

The system SHALL provide utility functions for checking permissions within handlers, supporting exact match, wildcard resolution, and admin bypass.

#### Scenario: Check exact permission match

- **GIVEN** a user with `schemas:read` and `schemas:create` permissions
- **WHEN** `hasPermission(permissions, 'schemas:read')` is called
- **THEN** the function returns `true`

#### Scenario: Check wildcard permission grants specific action

- **GIVEN** a user with `schemas:*` permission (wildcard)
- **WHEN** `hasPermission(permissions, 'schemas:delete')` is called
- **THEN** the function returns `true`
- **AND** `hasPermission(permissions, 'schemas:read')` also returns `true`

#### Scenario: Org admin bypasses all permission checks

- **GIVEN** a user with `org:admin` permission
- **WHEN** `hasPermission(permissions, 'billing:update')` is called
- **THEN** the function returns `true` even without explicit billing permission

#### Scenario: Get all user permissions

- **GIVEN** a user with `schemas:*` and `rules:read` permissions in organization X
- **WHEN** `getUserPermissions(ctx, orgId)` is called
- **THEN** the function returns `['schemas:*', 'rules:read']`

#### Scenario: Check any of multiple permissions

- **GIVEN** a user with only `schemas:read` permission
- **WHEN** `hasAnyPermission(permissions, ['schemas:read', 'schemas:update'])` is called
- **THEN** the function returns `true`

#### Scenario: Check all of multiple permissions

- **GIVEN** a user with `schemas:read` but NOT `schemas:update`
- **WHEN** `hasAllPermissions(permissions, ['schemas:read', 'schemas:update'])` is called
- **THEN** the function returns `false`

#### Scenario: Wildcard does not cross resource boundaries

- **GIVEN** a user with `schemas:*` permission
- **WHEN** `hasPermission(permissions, 'rules:read')` is called
- **THEN** the function returns `false` (wildcard is resource-scoped)

---

### Requirement: Frontend Permission Context

The system SHALL provide React context and hooks for accessing user permissions in the frontend.

#### Scenario: Permission context provides current org permissions

- **GIVEN** a user is authenticated and has selected organization X
- **WHEN** a component renders inside `<PermissionProvider>`
- **THEN** `usePermissions()` returns the user's permissions for organization X
- **AND** loading state is handled while permissions are being fetched

#### Scenario: usePermission hook returns boolean

- **GIVEN** a user has `org:billing` permission
- **WHEN** `usePermission('org:billing')` is called
- **THEN** the hook returns `true`

#### Scenario: usePermission for missing permission

- **GIVEN** a user does NOT have `org:audit` permission
- **WHEN** `usePermission('org:audit')` is called
- **THEN** the hook returns `false`

---

### Requirement: Frontend Permission Guards

The system SHALL provide components for conditional rendering based on permissions.

#### Scenario: RequirePermission renders children when authorized

- **GIVEN** a user has `org:team` permission
- **WHEN** `<RequirePermission permission="org:team"><Button/></RequirePermission>` renders
- **THEN** the `<Button/>` is rendered

#### Scenario: RequirePermission hides children when unauthorized

- **GIVEN** a user does NOT have `org:audit` permission
- **WHEN** `<RequirePermission permission="org:audit"><AuditLogs/></RequirePermission>` renders
- **THEN** the `<AuditLogs/>` component is NOT rendered
- **AND** optionally a fallback or nothing is shown

#### Scenario: RequirePermission with fallback

- **GIVEN** a user does NOT have `org:billing` permission
- **WHEN** `<RequirePermission permission="org:billing" fallback={<UpgradePrompt/>}><BillingPanel/></RequirePermission>` renders
- **THEN** the `<UpgradePrompt/>` is rendered instead of `<BillingPanel/>`

---

### Requirement: Navigation Permission Integration

The system SHALL hide or disable navigation items based on user permissions.

#### Scenario: Admin menu items hidden for read-only users

- **GIVEN** a user has only `schemas:read` and `rules:read` permissions
- **WHEN** the navigation sidebar renders
- **THEN** administration menu items (billing, team, settings) are hidden or disabled
- **AND** catalog and compatibility items are visible (read access)

#### Scenario: All admin items visible for org admin

- **GIVEN** a user has `org:admin` permission
- **WHEN** the navigation sidebar renders
- **THEN** all administration menu items are visible and enabled
- **AND** all catalog and compatibility items are visible and enabled

#### Scenario: Partial admin access shows relevant items

- **GIVEN** a user has `billing:read` and `billing:update` permissions
- **WHEN** the navigation sidebar renders
- **THEN** the billing menu item is visible
- **AND** other admin items (team, settings) are hidden or disabled

#### Scenario: Wildcard permission shows all resource actions

- **GIVEN** a user has `schemas:*` permission
- **WHEN** the navigation sidebar renders
- **THEN** all schema-related menu items are visible and enabled
- **AND** create, edit, and delete actions are available

---

### Requirement: Global Admin Role Preservation

The system SHALL maintain the existing global `admin` role for platform superadmin access.

#### Scenario: Platform admin retains full access

- **GIVEN** a user has `role: 'admin'` in the users table (global admin)
- **WHEN** the user accesses any organization
- **THEN** the user has full access regardless of organization membership

#### Scenario: Platform admin can access admin routes

- **GIVEN** a user is a platform admin (`role: 'admin'`)
- **WHEN** the user accesses `/admin/*` routes
- **THEN** access is granted
- **AND** `protectedAdminQuery/Mutation/Action` continue to work unchanged

---

### Requirement: Default Role Assignment

The system SHALL assign a default role to new organization members.

#### Scenario: New member gets default role

- **GIVEN** a user joins an organization without explicit role assignment
- **WHEN** the membership is created via WorkOS
- **THEN** the membership is assigned the default role (`member`)
- **AND** the permissions array reflects the default role's permissions

#### Scenario: Invited member with specific role

- **GIVEN** an admin invites a user with role `admin`
- **WHEN** the invitation is accepted and membership created
- **THEN** the membership has `roleSlug: 'admin'`
- **AND** the permissions array reflects the admin role's permissions
