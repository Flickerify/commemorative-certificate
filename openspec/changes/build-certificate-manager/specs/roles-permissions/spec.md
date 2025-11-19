## ADDED Requirements

### Requirement: WorkOS RBAC Configuration

The system SHALL use WorkOS's built-in Role-Based Access Control for managing user roles and permissions.

#### Scenario: Configure environment roles in WorkOS Dashboard

- **WHEN** setting up the certificate management system
- **THEN** roles are configured in the WorkOS Dashboard Roles & Permissions section with immutable slugs: `admin`, `designer`, `content_editor`, `approver`, `viewer`
- **AND** each role is assigned appropriate permissions using the `resource:action` naming convention

#### Scenario: Define permissions in WorkOS

- **WHEN** configuring permissions in WorkOS Dashboard
- **THEN** permissions follow naming convention: `templates:create`, `templates:edit`, `templates:approve`, `certificates:issue`, `certificates:revoke`, `analytics:view`, `integrations:manage`, `billing:manage`
- **AND** permissions are assigned to roles based on access requirements
- **AND** permission slugs are kept concise to fit within 4KB JWT claim limit

#### Scenario: Default role assignment

- **WHEN** a user joins an organization
- **THEN** they are automatically assigned the default role (configured as `viewer` instead of WorkOS default `member`)
- **AND** the role can be changed by organization admins

### Requirement: Role Definitions with WorkOS Permissions

The system SHALL configure the following roles with specific WorkOS permissions.

#### Scenario: Admin role configuration

- **WHEN** the `admin` role is configured in WorkOS
- **THEN** it is assigned all permissions: `templates:create`, `templates:edit`, `templates:delete`, `templates:approve`, `certificates:issue`, `certificates:revoke`, `analytics:view`, `integrations:manage`, `billing:manage`, `users:manage`
- **AND** admins can perform all operations in the system

#### Scenario: Designer role configuration

- **WHEN** the `designer` role is configured in WorkOS
- **THEN** it is assigned permissions: `templates:create`, `templates:edit`, `templates:submit`, `templates:view`, `assets:upload`
- **AND** designers cannot approve templates or manage billing

#### Scenario: Content Editor role configuration

- **WHEN** the `content_editor` role is configured in WorkOS
- **THEN** it is assigned permissions: `templates:edit_content`, `templates:view`, `templates:comment`
- **AND** content editors can only modify text content, not visual design

#### Scenario: Approver role configuration

- **WHEN** the `approver` role is configured in WorkOS
- **THEN** it is assigned permissions: `templates:approve`, `templates:reject`, `templates:view`, `audit:view`
- **AND** approvers can review and approve/reject templates but not create or edit them

#### Scenario: Viewer role configuration

- **WHEN** the `viewer` role is configured in WorkOS
- **THEN** it is assigned permissions: `templates:view`, `certificates:view`, `analytics:view_basic`
- **AND** viewers have read-only access to approved content

### Requirement: Role Data in Sessions

The system SHALL retrieve role and permission data from WorkOS authentication sessions.

#### Scenario: Access role from JWT claims

- **WHEN** a user authenticates via WorkOS AuthKit
- **THEN** their access token (JWT) includes role claims for their organization membership
- **AND** the application reads the role slug and permissions from the JWT
- **AND** role data is available in both client and server components

#### Scenario: Check permissions in application code

- **WHEN** the application needs to verify user permissions
- **THEN** it reads the permissions array from the JWT claims
- **AND** checks if the required permission (e.g., `templates:approve`) is present
- **AND** grants or denies access based on the permission check

#### Scenario: Role changes reflected immediately

- **WHEN** an admin changes a user's role in WorkOS
- **THEN** the change is tracked via `organization_membership.updated` event
- **AND** the user's next authentication includes the updated role
- **AND** the application can subscribe to role change webhooks for immediate updates

### Requirement: Multiple Roles Support

The system SHALL support assigning multiple roles to users when needed for cross-functional collaboration.

#### Scenario: Enable multiple roles in WorkOS

- **WHEN** multiple roles feature is enabled in WorkOS environment settings
- **THEN** users can be assigned multiple roles per organization membership
- **AND** users receive the union of all permissions from their assigned roles
- **AND** each organization membership must have at least one role

#### Scenario: Assign multiple roles to user

- **WHEN** a user needs permissions from multiple roles (e.g., Designer + Approver)
- **THEN** an admin assigns both roles via WorkOS Dashboard or API
- **AND** the user's session includes permissions from both roles
- **AND** this avoids creating redundant hybrid roles like "designer-approver"

#### Scenario: Cross-department collaboration

- **WHEN** a designer also needs to approve templates
- **THEN** they are assigned both `designer` and `approver` roles
- **AND** they can both create/edit templates and approve them
- **AND** their permissions stack additively

### Requirement: Organization-Level Custom Roles

The system SHALL support organization-specific custom roles via WorkOS organization roles feature.

#### Scenario: Create organization role

- **WHEN** an organization needs a custom role not available in environment roles
- **THEN** a custom role can be created for that organization in the WorkOS Dashboard
- **AND** the role slug is automatically prefixed with `org_`
- **AND** the organization role inherits available environment permissions

#### Scenario: Organization default role

- **WHEN** an organization creates its first custom role
- **THEN** the organization can set its own default role independent from the environment default
- **AND** new members of that organization are assigned the organization's default role
- **AND** the organization's role priority order is independent from environment settings

#### Scenario: Custom permissions for organization

- **WHEN** an organization requires restricted permissions
- **THEN** a custom role with a subset of environment permissions can be created
- **AND** the organization's members are limited to the custom role's permissions
- **AND** this doesn't affect other organizations' access control

### Requirement: IdP Role Assignment Integration

The system SHALL support automatic role assignment via Identity Provider groups through WorkOS.

#### Scenario: Directory Sync role assignment

- **WHEN** an organization uses Directory Sync (SCIM)
- **THEN** organization admins can map directory groups to roles in the WorkOS Admin Portal
- **AND** users provisioned via Directory Sync are automatically assigned roles based on their group memberships
- **AND** role assignments are updated during each sync

#### Scenario: SSO group role assignment

- **WHEN** an organization uses SSO with JIT provisioning enabled
- **THEN** SSO groups returned in the authentication profile can be mapped to roles
- **AND** users authenticating via SSO are assigned roles based on their SSO group memberships
- **AND** SSO role assignments can be configured per organization

#### Scenario: Role assignment priority

- **WHEN** a user is provisioned from multiple sources with conflicting roles
- **THEN** directory group role assignments take highest priority
- **THEN** SSO group role assignments take second priority
- **THEN** manual API assignments take lowest priority
- **AND** explicit IdP assignments override manual assignments on next sync/authentication

### Requirement: Permission-Based UI Rendering

The system SHALL render UI elements based on permissions retrieved from WorkOS sessions.

#### Scenario: Hide unauthorized actions

- **WHEN** a user views the dashboard or editor
- **THEN** the application checks their permissions from the JWT claims
- **AND** actions requiring permissions they lack are hidden or disabled
- **AND** tooltips explain why certain actions are unavailable

#### Scenario: Server-side permission checks

- **WHEN** a user attempts an API action
- **THEN** the server validates their permissions from the WorkOS access token
- **AND** returns 403 Forbidden if the required permission is not present
- **AND** logs unauthorized access attempts for security monitoring

#### Scenario: Client-side permission checks

- **WHEN** rendering React components
- **THEN** components read permissions from the WorkOS auth context
- **AND** conditionally render UI elements based on permission checks
- **AND** use helper functions like `hasPermission(user, 'templates:approve')`

### Requirement: Audit Trail via WorkOS Events

The system SHALL leverage WorkOS events for role change audit trails without custom implementation.

#### Scenario: Subscribe to role change events

- **WHEN** the system needs to track role changes
- **THEN** it subscribes to WorkOS `organization_membership.updated` webhook events
- **AND** events include details about role changes (previous role, new role, timestamp, actor)
- **AND** the system logs these events for compliance and audit purposes

#### Scenario: View audit logs

- **WHEN** an admin views audit logs in the dashboard
- **THEN** they see role changes from WorkOS events
- **AND** can filter by user, role, action type, and date range
- **AND** can export audit logs for compliance reporting

#### Scenario: Real-time role change notifications

- **WHEN** a role change occurs
- **THEN** affected users receive notifications via the application
- **AND** their active sessions are invalidated to force re-authentication
- **AND** new permissions take effect immediately upon next login

### Requirement: WorkOS Admin Portal Integration

The system SHALL leverage WorkOS Admin Portal for organization admin self-service role management.

#### Scenario: Organization admins manage roles

- **WHEN** an organization admin accesses the WorkOS Admin Portal
- **THEN** they can view all organization members and their assigned roles
- **AND** they can assign or modify roles for organization members
- **AND** changes are reflected immediately in the application

#### Scenario: IdP group mapping in Admin Portal

- **WHEN** an organization sets up SSO or Directory Sync
- **THEN** admins can map IdP groups to application roles in the Admin Portal
- **AND** the mappings are stored by WorkOS and applied automatically
- **AND** the application doesn't need custom UI for group mapping
