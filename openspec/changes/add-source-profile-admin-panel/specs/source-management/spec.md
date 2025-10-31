## ADDED Requirements

### Requirement: Source List View
The system SHALL provide an admin interface to list all event sources with filtering and pagination.

#### Scenario: Admin views sources list
- **WHEN** an admin navigates to `/admin/sources`
- **THEN** a table displays all sources with columns: URL, Name, Location, Entity Type, Language, Profile, Enabled status, Last Fetch time
- **AND** sources are paginated or support infinite scroll

#### Scenario: Admin filters sources by enabled status
- **WHEN** an admin selects "Enabled" or "Disabled" filter
- **THEN** the list updates to show only sources matching the filter

#### Scenario: Admin filters sources by location
- **WHEN** an admin selects a location from the location dropdown filter
- **THEN** the list updates to show only sources for that location

### Requirement: Source Creation
The system SHALL allow admins to create new event sources via a form interface.

#### Scenario: Admin creates a new source
- **WHEN** an admin navigates to `/admin/sources/new` and fills in required fields (URL, Name, Entity Type, Location, Language)
- **AND** submits the form
- **THEN** a new source is created in the database
- **AND** the admin is redirected to the source detail page
- **AND** a success message is displayed

#### Scenario: Admin creates source with invalid URL
- **WHEN** an admin submits a source form with an invalid URL format
- **THEN** validation error is shown
- **AND** the source is not created

### Requirement: Source Update
The system SHALL allow admins to edit existing sources.

#### Scenario: Admin updates source details
- **WHEN** an admin navigates to `/admin/sources/[id]` and modifies source fields (URL, Name, Entity Type, Location, Language, Enabled, Notes)
- **AND** saves the changes
- **THEN** the source is updated in the database
- **AND** if URL changed, the hash is recalculated
- **AND** updatedAt timestamp is updated

#### Scenario: Admin assigns profile to source
- **WHEN** an admin selects a profile from the profile dropdown on a source detail page
- **AND** saves the assignment
- **THEN** the source's profileId field is updated
- **AND** the source is linked to the selected profile

### Requirement: Source Deletion
The system SHALL allow admins to delete sources with confirmation.

#### Scenario: Admin deletes a source
- **WHEN** an admin clicks delete on a source detail page
- **AND** confirms the deletion in a confirmation dialog
- **THEN** the source is removed from the database
- **AND** the admin is redirected to the sources list page

### Requirement: Source Bulk Import
The system SHALL allow admins to import multiple sources from CSV/TSV files.

#### Scenario: Admin imports sources from CSV
- **WHEN** an admin navigates to `/admin/sources` and clicks "Bulk Import"
- **AND** uploads a CSV/TSV file with source data (columns: URL, Name, Entity Type, Location, Language)
- **AND** submits the import
- **THEN** sources are created or updated (deduplicated by URL hash)
- **AND** import results are displayed (total, created, updated, errors)

#### Scenario: Admin imports sources with duplicates
- **WHEN** an admin imports a CSV containing URLs that already exist
- **THEN** existing sources are updated (not duplicated)
- **AND** import results show updated count

### Requirement: Source Detail View
The system SHALL display comprehensive source information including related data.

#### Scenario: Admin views source details
- **WHEN** an admin navigates to `/admin/sources/[id]`
- **THEN** source details are displayed including: URL, Name, Entity Type, Location, Language, Profile assignment, Enabled status, Hash, Last Fetch time, ETag, Last Modified
- **AND** related data sections show: document count, recent runs, associated events count

### Requirement: Source Enable/Disable Toggle
The system SHALL allow admins to enable or disable sources without deleting them.

#### Scenario: Admin disables a source
- **WHEN** an admin toggles the "Enabled" checkbox on a source to false
- **AND** saves the changes
- **THEN** the source's enabled field is set to false
- **AND** the source is excluded from active crawl workflows

