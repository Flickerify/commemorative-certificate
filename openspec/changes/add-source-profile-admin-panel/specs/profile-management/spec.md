## ADDED Requirements

### Requirement: Profile List View
The system SHALL provide an admin interface to list all crawler profiles with filtering.

#### Scenario: Admin views profiles list
- **WHEN** an admin navigates to `/admin/sources/profiles`
- **THEN** a table displays all profiles with columns: Site ID, Domain, Language, Timezone, Version, Enabled status, Sources Count
- **AND** profiles are paginated or support infinite scroll

#### Scenario: Admin filters profiles by enabled status
- **WHEN** an admin selects "Enabled" or "Disabled" filter
- **THEN** the list updates to show only profiles matching the filter

#### Scenario: Admin filters profiles by domain
- **WHEN** an admin enters a domain in the domain filter
- **THEN** the list updates to show only profiles for that domain

### Requirement: Profile Creation
The system SHALL allow admins to create new crawler profiles via a form interface.

#### Scenario: Admin creates a new profile
- **WHEN** an admin navigates to `/admin/sources/profiles/new` and fills in required fields (Site ID, Domain, Language, Timezone)
- **AND** provides a valid JSON config in the config editor
- **AND** submits the form
- **THEN** a new profile is created with version 1
- **AND** the admin is redirected to the profile detail page
- **AND** a success message is displayed

#### Scenario: Admin creates profile with invalid JSON config
- **WHEN** an admin submits a profile form with invalid JSON syntax in the config field
- **THEN** validation error is shown
- **AND** the profile is not created

### Requirement: Profile Update
The system SHALL allow admins to edit existing profiles with version tracking.

#### Scenario: Admin updates profile details
- **WHEN** an admin navigates to `/admin/sources/profiles/[id]` and modifies profile fields (Site ID, Domain, Language, Timezone, Enabled, Notes, Config JSON)
- **AND** saves the changes
- **THEN** the profile is updated in the database
- **AND** the version number is incremented
- **AND** updatedAt timestamp is updated

#### Scenario: Admin updates profile config
- **WHEN** an admin edits the JSON config field in a profile
- **AND** saves the changes
- **THEN** the config is validated for JSON syntax
- **AND** if valid, the profile is updated with new config and incremented version

### Requirement: Profile Deletion
The system SHALL allow admins to delete profiles with safety checks.

#### Scenario: Admin deletes unused profile
- **WHEN** an admin clicks delete on a profile detail page
- **AND** no sources are using the profile
- **AND** confirms the deletion
- **THEN** the profile is removed from the database
- **AND** the admin is redirected to the profiles list page

#### Scenario: Admin attempts to delete profile in use
- **WHEN** an admin attempts to delete a profile that is assigned to one or more sources
- **THEN** a warning message is displayed listing the sources using the profile
- **AND** deletion is prevented until profile is unassigned from all sources

### Requirement: Profile Detail View
The system SHALL display comprehensive profile information including related sources.

#### Scenario: Admin views profile details
- **WHEN** an admin navigates to `/admin/sources/profiles/[id]`
- **THEN** profile details are displayed including: Site ID, Domain, Language, Timezone, Version, Enabled status, Config JSON (formatted/readable), Created/Updated timestamps
- **AND** related sources section lists all sources using this profile

### Requirement: Profile Enable/Disable Toggle
The system SHALL allow admins to enable or disable profiles without deleting them.

#### Scenario: Admin disables a profile
- **WHEN** an admin toggles the "Enabled" checkbox on a profile to false
- **AND** saves the changes
- **THEN** the profile's enabled field is set to false
- **AND** sources using this profile are excluded from active crawl workflows

### Requirement: Profile Assignment to Sources
The system SHALL allow admins to assign profiles to sources from both source and profile pages.

#### Scenario: Admin assigns profile from source page
- **WHEN** an admin is on a source detail page
- **AND** selects a profile from the profile dropdown
- **AND** saves the assignment
- **THEN** the source's profileId field is updated
- **AND** the source is linked to the selected profile

#### Scenario: Admin views sources using a profile
- **WHEN** an admin views a profile detail page
- **THEN** a "Related Sources" section displays all sources assigned to this profile
- **AND** each source is linked to its detail page

