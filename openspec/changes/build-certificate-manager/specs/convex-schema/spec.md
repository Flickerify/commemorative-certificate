## ADDED Requirements

### Requirement: Convex Schema for Certificate Management

The system SHALL extend the existing Convex schema to include certificate-specific tables for collaborative editing and real-time features.

#### Scenario: Existing foundation tables

- **WHEN** the Convex schema is deployed
- **THEN** it includes existing tables: `users` (with WorkOS externalId), `organisations` (with WorkOS externalId), and `organisationDomains`
- **AND** these tables are already indexed and functional for user and organization management

#### Scenario: Certificate layout drafts table

- **WHEN** users create or edit certificate templates
- **THEN** draft state is stored in `certificateLayoutDrafts` table in Convex
- **AND** each draft includes organizationId (reference to Convex organisations.\_id), templateId (reference to PlanetScale template), layout (JSON), updatedAt, and updatedBy (WorkOS userId)
- **AND** drafts are indexed by organizationId and templateId for efficient querying

#### Scenario: Certificate presence table

- **WHEN** users collaborate on certificate templates
- **THEN** active editing sessions are tracked in `certificatePresence` table
- **AND** each presence record includes layoutDraftId, userId (WorkOS externalId), displayName, color, cursorX, cursorY, selectedElementId, and updatedAt
- **AND** presence records are indexed by layoutDraftId for real-time updates

#### Scenario: Comments table

- **WHEN** users comment on certificate templates
- **THEN** comments are stored in `certificateComments` table
- **AND** each comment includes layoutDraftId, userId (WorkOS externalId), content, position (x, y coordinates or elementId), status (open/resolved), parentId (for replies), and createdAt
- **AND** comments are indexed by layoutDraftId and parentId for threaded discussions

#### Scenario: Activity feed table

- **WHEN** actions occur on certificate templates
- **THEN** activities are logged in `certificateActivities` table
- **AND** each activity includes organizationId, templateId, userId, activityType (created/edited/commented/approved/published), metadata (JSON), and timestamp
- **AND** activities are indexed by organizationId and templateId for efficient querying

### Requirement: Integration with Existing Convex Structure

The system SHALL leverage existing Convex users and organisations tables for certificate management.

#### Scenario: User lookup by WorkOS externalId

- **WHEN** certificate operations require user information
- **THEN** users are retrieved from existing `users` table using WorkOS externalId
- **AND** existing `users/internal/query.findByExternalId` function is used
- **AND** user role, email, and preferences are available from existing schema

#### Scenario: Organization lookup by WorkOS externalId

- **WHEN** certificate operations require organization information
- **THEN** organizations are retrieved from existing `organisations` table using WorkOS externalId
- **AND** organization metadata and settings are available from existing schema
- **AND** organization domain validation uses existing `organisationDomains` table

#### Scenario: Organization discovery by email domain

- **WHEN** a user signs up with an email address
- **THEN** the existing `organisations/internal/query.findByEmail` function is used to find their organization by domain
- **AND** the organization is automatically associated with the user based on verified domain

### Requirement: Real-time Subscriptions

The system SHALL provide Convex query functions for real-time certificate editing subscriptions.

#### Scenario: Subscribe to draft changes

- **WHEN** a user opens the certificate editor
- **THEN** they subscribe to the certificate draft using Convex useQuery
- **AND** updates from other collaborators appear in real-time
- **AND** local changes are optimistically updated before server confirmation

#### Scenario: Subscribe to presence updates

- **WHEN** multiple users edit the same template
- **THEN** each user subscribes to presence updates for that draft
- **AND** cursor positions and selections update in real-time (throttled to reasonable rate)
- **AND** inactive users are automatically removed after timeout

#### Scenario: Subscribe to comments

- **WHEN** a user views a certificate template
- **THEN** they subscribe to comments for that draft
- **AND** new comments and replies appear in real-time
- **AND** resolved comments can be filtered from the view

### Requirement: Convex Mutations for Certificate Operations

The system SHALL provide Convex mutation functions for certificate editing operations.

#### Scenario: Update draft layout

- **WHEN** a user modifies a certificate element
- **THEN** a Convex mutation updates the layout JSON in certificateLayoutDrafts
- **AND** the updatedAt timestamp and updatedBy userId are recorded
- **AND** all subscribed users receive the update in real-time

#### Scenario: Update presence

- **WHEN** a user moves their cursor or selects an element
- **THEN** a Convex mutation updates their presence record (throttled)
- **AND** cursor position and selected element are updated
- **AND** updatedAt timestamp prevents stale presence data

#### Scenario: Add comment

- **WHEN** a user adds a comment to a template
- **THEN** a Convex mutation creates a new comment record
- **AND** the comment is anchored to position or element
- **AND** other users receive real-time notification of the new comment

#### Scenario: Resolve comment

- **WHEN** a user marks a comment as resolved
- **THEN** a Convex mutation updates the comment status
- **AND** resolved comments are hidden by default but can be viewed

### Requirement: Draft Lifecycle Management

The system SHALL manage the lifecycle of certificate drafts from creation to publication.

#### Scenario: Create draft from template

- **WHEN** a user opens a published template for editing
- **THEN** a draft is created in certificateLayoutDrafts if one doesn't exist
- **AND** the draft is initialized with the published template's layout
- **AND** draft is associated with the template ID in PlanetScale

#### Scenario: Auto-save draft

- **WHEN** a user makes changes in the editor
- **THEN** changes are automatically saved to the draft (debounced)
- **AND** no explicit save button is required for draft state
- **AND** users can see "Saving..." and "All changes saved" status

#### Scenario: Publish draft to PlanetScale

- **WHEN** a user publishes a certificate template
- **THEN** the draft layout is copied to PlanetScale as a new version
- **AND** the draft in Convex is marked as synced or deleted
- **AND** the published version becomes the source of truth

#### Scenario: Discard draft

- **WHEN** a user discards changes to a template
- **THEN** the draft is deleted from certificateLayoutDrafts
- **AND** presence and comments associated with the draft are cleaned up
- **AND** the user sees the last published version
