## ADDED Requirements

### Requirement: Authenticated Dashboard Shell

The system SHALL provide an authenticated dashboard interface with navigation, header, and content area for certificate management operations.

#### Scenario: User accesses dashboard

- **WHEN** an authenticated user navigates to the dashboard
- **THEN** they see a sidebar navigation, header with user menu, and main content area
- **AND** the sidebar includes links for Overview, Certificates, Templates, Collaborators, Analytics, Integrations, Billing, and Settings

#### Scenario: Unauthenticated user redirected

- **WHEN** an unauthenticated user attempts to access dashboard routes
- **THEN** they are redirected to the sign-in page
- **AND** after successful authentication, they are redirected back to the originally requested page

#### Scenario: Organization context loaded

- **WHEN** a user accesses the dashboard
- **THEN** their organization data is retrieved from Convex `organisations` table by WorkOS externalId
- **AND** organization metadata and settings are available throughout the application
- **AND** organization domains are validated against the `organisationDomains` table

### Requirement: Dashboard Overview Page

The system SHALL display an overview dashboard with key metrics and recent activity.

#### Scenario: Overview page displays statistics

- **WHEN** a user views the dashboard overview page
- **THEN** they see stat cards showing certificates issued (last 30 days), active templates, active collaborators, and plan usage
- **AND** they see a list of recent certificates issued
- **AND** they see collaboration activity showing who is working on which templates
- **AND** they see pending approvals count if they have approver role

#### Scenario: Quick actions available

- **WHEN** a user views the overview page
- **THEN** they see action buttons to create a certificate and invite a collaborator
- **AND** clicking these buttons navigates to the appropriate page

#### Scenario: Role-based dashboard views

- **WHEN** a user with Designer role views the dashboard
- **THEN** they see metrics focused on templates and design activity
- **WHEN** a user with Approver role views the dashboard
- **THEN** they see pending approvals and audit trail highlights

### Requirement: Dashboard Navigation Structure

The system SHALL provide navigation to all major certificate management sections.

#### Scenario: Navigation items accessible

- **WHEN** a user is on any dashboard page
- **THEN** they can navigate to Overview, Certificates, Templates, Collaborators, Analytics, Integrations, Billing, and Settings via the sidebar
- **AND** the current page is highlighted in the navigation
- **AND** navigation items are filtered based on user role and permissions

### Requirement: Analytics Dashboard

The system SHALL provide an analytics dashboard showing certificate lifecycle metrics and engagement data.

#### Scenario: View certificate analytics

- **WHEN** a user navigates to the Analytics page
- **THEN** they see metrics for certificate issuance trends, verification requests, download rates, and badge sharing activity
- **AND** they can filter metrics by date range, template, and organization

#### Scenario: View engagement metrics

- **WHEN** a user views analytics for issued certificates
- **THEN** they see data on how many times each certificate was viewed, downloaded, and shared to LinkedIn or other platforms
- **AND** they can export analytics data as CSV

### Requirement: Integrations Dashboard

The system SHALL provide an integrations dashboard for managing external system connections.

#### Scenario: View available integrations

- **WHEN** a user navigates to the Integrations page
- **THEN** they see available LMS integrations (Moodle, Canvas, Teachable), HR systems (Workday, BambooHR), and automation platforms (Zapier, Make)
- **AND** they can configure and enable integrations with OAuth or API keys

#### Scenario: Manage webhooks

- **WHEN** a user configures webhooks on the Integrations page
- **THEN** they can set up webhook endpoints to receive notifications for certificate issuance, verification, and expiry events
- **AND** they can test webhook delivery and view webhook logs
