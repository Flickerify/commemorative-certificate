## ADDED Requirements

### Requirement: WorkOS to PlanetScale Data Synchronization

The system SHALL synchronize users and organizations from WorkOS/Convex to PlanetScale using Convex workflows to maintain data consistency across both databases.

#### Scenario: User sync workflow triggered

- **WHEN** a WorkOS user webhook event (user.created or user.updated) is received
- **THEN** the existing Convex user record is created/updated first
- **AND** a Convex workflow `syncUserToPlanetScale` is triggered asynchronously
- **AND** the workflow validates the user exists in Convex before syncing
- **AND** the workflow upserts the user to PlanetScale via Drizzle ORM

#### Scenario: Organization sync workflow triggered

- **WHEN** a WorkOS organization webhook event (organization.created or organization.updated) is received
- **THEN** the existing Convex organization record is created/updated first
- **AND** a Convex workflow `syncOrganisationToPlanetScale` is triggered asynchronously
- **AND** the workflow validates the organization exists in Convex before syncing
- **AND** the workflow upserts the organization to PlanetScale via Drizzle ORM

#### Scenario: Sync workflow with retries

- **WHEN** a sync workflow fails due to database connectivity or other transient errors
- **THEN** the workflow automatically retries with exponential backoff
- **AND** retry attempts are logged with error details
- **AND** after max retries, the workflow marks the sync as failed
- **AND** failed syncs are visible in the admin dashboard for manual intervention

#### Scenario: Sync status tracking

- **WHEN** a sync workflow runs
- **THEN** sync status is recorded in the `syncStatus` table in Convex
- **AND** status includes entityType (user/organisation), entityId, targetSystem (planetscale), status (pending/success/failed), lastSyncedAt timestamp, and error message if failed
- **AND** administrators can query sync status for monitoring

### Requirement: PlanetScale Schema for Users and Organizations

The system SHALL maintain user and organization tables in PlanetScale synchronized from WorkOS via Convex.

#### Scenario: PlanetScale users table structure

- **WHEN** the PlanetScale schema is deployed
- **THEN** a users table exists with workos_external_id (primary key), email, first_name, last_name, email_verified, profile_picture_url, synced_at timestamp
- **AND** workos_external_id matches the externalId stored in Convex users table
- **AND** synced_at timestamp indicates last successful sync from Convex

#### Scenario: PlanetScale organisations table structure

- **WHEN** the PlanetScale schema is deployed
- **THEN** an organisations table exists with workos_external_id (primary key), name, metadata (JSON), synced_at timestamp
- **AND** workos_external_id matches the externalId stored in Convex organisations table
- **AND** metadata is synchronized from Convex organisations.metadata field

#### Scenario: Certificate templates reference PlanetScale users

- **WHEN** a certificate template is created or modified
- **THEN** the createdBy and updatedBy fields reference users by workos_external_id
- **AND** user information is retrieved from PlanetScale users table
- **AND** foreign key constraints or application-level validation ensures user exists

#### Scenario: Certificate templates reference PlanetScale organisations

- **WHEN** a certificate template is created
- **THEN** the organizationId field references organisations by workos_external_id
- **AND** organization settings and branding are retrieved from PlanetScale
- **AND** organization isolation is enforced at the database level

### Requirement: Sync Monitoring and Administration

The system SHALL provide monitoring and manual intervention capabilities for data synchronization.

#### Scenario: Admin dashboard displays sync status

- **WHEN** an administrator views the sync monitoring dashboard
- **THEN** they see a list of recent sync operations with status and timestamps
- **AND** failed syncs are highlighted with error details
- **AND** they can filter by entity type (user/organisation) and status (success/failed/pending)
- **AND** they can see sync lag time (difference between Convex update and PlanetScale sync)

#### Scenario: Manual sync retry

- **WHEN** an administrator sees a failed sync
- **THEN** they can click a "Retry Sync" button for that entity
- **AND** the sync workflow is manually triggered for that specific user or organization
- **AND** the sync status updates in real-time as the workflow executes

#### Scenario: Bulk sync monitoring

- **WHEN** an administrator views aggregate sync metrics
- **THEN** they see total syncs attempted, success rate, average sync time, and number of pending/failed syncs
- **AND** they can see a time-series chart of sync operations
- **AND** they receive alerts if sync failure rate exceeds threshold

### Requirement: Initial Data Backfill

The system SHALL provide a backfill mechanism to sync existing users and organizations from Convex to PlanetScale.

#### Scenario: Backfill all users

- **WHEN** a backfill operation is initiated for users
- **THEN** all users are queried from Convex users table
- **AND** a sync workflow is triggered for each user
- **AND** workflows are queued to avoid overwhelming PlanetScale
- **AND** progress is tracked and displayed (e.g., "127/500 users synced")

#### Scenario: Backfill all organizations

- **WHEN** a backfill operation is initiated for organizations
- **THEN** all organizations are queried from Convex organisations table
- **AND** a sync workflow is triggered for each organization
- **AND** workflows are queued to avoid overwhelming PlanetScale
- **AND** progress is tracked and displayed

#### Scenario: Backfill via CLI or admin endpoint

- **WHEN** an administrator needs to run a backfill
- **THEN** they can execute a Convex CLI command (e.g., `npx convex run workflows:backfillUsers`)
- **OR** they can trigger backfill via an admin-only HTTP endpoint
- **AND** the operation runs asynchronously in the background
- **AND** status and progress are visible in the admin dashboard

### Requirement: Data Consistency Guarantees

The system SHALL maintain eventual consistency between Convex and PlanetScale with conflict resolution strategies.

#### Scenario: Convex as source of truth

- **WHEN** there is a data discrepancy between Convex and PlanetScale
- **THEN** Convex is treated as the source of truth
- **AND** PlanetScale data can be resynced from Convex
- **AND** manual edits to PlanetScale users/orgs are discouraged (should go through WorkOS webhooks → Convex → PlanetScale)

#### Scenario: Eventual consistency model

- **WHEN** a user or organization is updated in WorkOS
- **THEN** Convex is updated immediately (within seconds via webhook)
- **AND** PlanetScale is updated asynchronously (within minutes via workflow)
- **AND** applications reading from PlanetScale accept slight lag
- **AND** sync lag is monitored and alerted if exceeds acceptable threshold (e.g., 5 minutes)

#### Scenario: Handle deleted entities

- **WHEN** a user or organization is deleted in WorkOS
- **THEN** the entity is marked as deleted or removed from Convex
- **AND** the sync workflow propagates deletion to PlanetScale
- **AND** soft delete is used to maintain referential integrity for historical certificate data
- **AND** deleted entities are archived rather than hard-deleted from PlanetScale

### Requirement: Workflow Error Handling

The system SHALL handle errors gracefully in sync workflows with appropriate retry and alerting logic.

#### Scenario: Database connection error

- **WHEN** a sync workflow cannot connect to PlanetScale
- **THEN** the workflow retries with exponential backoff (e.g., 1s, 2s, 4s, 8s, 16s)
- **AND** connection errors are logged with full error details
- **AND** after 5 failed attempts, the workflow marks sync as permanently failed
- **AND** administrators are notified via dashboard alert

#### Scenario: Schema mismatch error

- **WHEN** a sync workflow encounters a schema mismatch (e.g., new field not in PlanetScale)
- **THEN** the workflow logs the error with field details
- **AND** the sync is marked as failed with actionable error message
- **AND** administrators are alerted to update PlanetScale schema
- **AND** sync can be retried after schema migration

#### Scenario: Validation error

- **WHEN** data validation fails during sync (e.g., invalid email format)
- **THEN** the workflow logs validation error details
- **AND** the sync is marked as failed
- **AND** the error indicates which field failed validation
- **AND** administrators can correct data in Convex and retry sync

