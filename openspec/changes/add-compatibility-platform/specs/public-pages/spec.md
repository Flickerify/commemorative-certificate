# Capability: Public Pages

Public-facing compatibility checker pages with cascading dropdowns, result display, and subdomain access.

**Storage**: Page configuration is stored in PlanetScale. Convex caches dropdown options (`optionShards`), results (`resultCache`), and page display metadata (`pageDisplays`) for fast frontend reads. API routes handle writes and sync to Convex.

## ADDED Requirements

### Requirement: Public Page Configuration

The system SHALL allow organizations to configure public compatibility pages.

#### Scenario: Create public page

- **GIVEN** a source dataset and target dataset in `ready` status
- **WHEN** the user creates a public page:
  ```json
  {
    "slug": "vehicle-compatibility",
    "name": "Vehicle Compatibility Checker",
    "sourceDatasetId": "source_123",
    "targetDatasetId": "target_456"
  }
  ```
- **THEN** the system MUST create a page record with:
  - `status: 'draft'`
  - Default device and selection policies
  - Generated `revisionId`

#### Scenario: Page slug uniqueness

- **GIVEN** an organization with a page `slug: vehicle-compatibility`
- **WHEN** the user creates another page with the same slug
- **THEN** the system MUST reject with "Page slug already exists"

#### Scenario: Publish page

- **GIVEN** a page in `draft` status with at least one rule
- **WHEN** the user publishes the page
- **THEN** the system MUST:
  - Set `status: 'published'`
  - Set `publishedAt` timestamp
  - Make the page accessible at the public URL

---

### Requirement: Cascading Dropdowns

The system SHALL generate cascading dropdown options from source dimension values.

#### Scenario: Load root dimension options

- **GIVEN** a published page with source dataset
- **WHEN** the public page loads
- **THEN** the system MUST return all unique values for the first dimension (e.g., years)
- **AND** subsequent dropdowns are disabled until selection is made

#### Scenario: Load child dimension options

- **GIVEN** a selection of `year: 2025`
- **WHEN** the make dropdown is activated
- **THEN** the system MUST return only makes that exist for year 2025
- **AND** NOT return makes from other years

#### Scenario: Complete selection

- **GIVEN** all dimensions have been selected
- **WHEN** the final dropdown value is chosen
- **THEN** the system MUST automatically trigger compatibility evaluation
- **AND** display loading state while evaluating

#### Scenario: Reset cascade on change

- **GIVEN** selections: `year: 2025, make: AUDI, model: Q8`
- **WHEN** the user changes `make` to `BMW`
- **THEN** the `model` dropdown MUST reset to empty
- **AND** reload model options for `year: 2025, make: BMW`

---

### Requirement: Result Display

The system SHALL display compatibility results in a clear, actionable format.

#### Scenario: Display compatible result

- **GIVEN** a selection verdict of `2` (fully compatible)
- **AND** a recommended target
- **WHEN** results are displayed
- **THEN** the UI MUST show:
  - Success message: "Congratulations! The {target.name} is compatible with your {selection}."
  - Highlighted recommended product
  - Full compatibility matrix for all targets

#### Scenario: Display partial result

- **GIVEN** a selection verdict of `1` (partial)
- **WHEN** results are displayed
- **THEN** the UI MUST show:
  - Warning message: "Partial compatibility available for your {selection}."
  - List of partially compatible targets with feature breakdown

#### Scenario: Display incompatible result

- **GIVEN** a selection verdict of `0` (incompatible)
- **WHEN** results are displayed
- **THEN** the UI MUST show:
  - Error message: "No compatible {target type} found for your {selection}."
  - Optional: closest matches or suggestions

#### Scenario: Feature matrix display

- **GIVEN** evaluation results with feature breakdown
- **WHEN** the matrix is rendered
- **THEN** the UI MUST show:
  - Rows: feature rules (grouped by category if configured)
  - Columns: target products
  - Cells: checkmark (✓) for pass, X for fail
  - Column header: target name, image if available

---

### Requirement: Public Page URL Structure

The system SHALL serve public pages at predictable URLs.

#### Scenario: Main domain access (without subdomain)

- **GIVEN** an organization WITHOUT custom subdomain
- **WHEN** accessing `flickerify.com/{orgSlug}/{pageSlug}`
- **THEN** the system MUST:
  - Lookup organization by `orgSlug`
  - Lookup page by `pageSlug` within that organization
  - Render the public page

#### Scenario: Subdomain access (paid organizations)

- **GIVEN** an organization with `customSubdomain: acme`
- **WHEN** accessing `acme.flickerify.com/{pageSlug}`
- **THEN** the system MUST:
  - Lookup organization by subdomain
  - Lookup page by `pageSlug`
  - Render the public page

#### Scenario: Unpublished page access

- **GIVEN** a page with `status: 'draft'`
- **WHEN** accessed via public URL
- **THEN** the system MUST return 404 "Page not found"

---

### Requirement: Page Customization

The system SHALL allow basic customization of public page appearance.

#### Scenario: Configure page messaging

- **GIVEN** a public page
- **WHEN** the user configures messages:
  ```json
  {
    "headlineWhen2": "Congratulations! The {target} below is compatible with your {make} {model}.",
    "headlineWhen1": "Partial compatibility available for your {make} {model}.",
    "headlineWhen0": "No compatible device found for your {make} {model}."
  }
  ```
- **THEN** the public page MUST use these templates with variable substitution

#### Scenario: Configure dropdown labels

- **GIVEN** a source schema with dimensions `[year, make, model, engine]`
- **WHEN** the user configures labels:
  ```json
  {
    "year": "Select Year",
    "make": "Select Make",
    "model": "Select Model",
    "engine": "Select Engine"
  }
  ```
- **THEN** the dropdowns MUST use these labels as placeholders

---

### Requirement: Page Analytics

The system SHALL track basic analytics for public pages.

#### Scenario: Track page view

- **GIVEN** a visitor loads a public page
- **WHEN** the page renders
- **THEN** the system MUST record:
  - Page ID
  - Timestamp
  - Visitor identifier (anonymized)

#### Scenario: Track selection query

- **GIVEN** a visitor completes a selection and views results
- **WHEN** evaluation completes
- **THEN** the system MUST record:
  - Selection key
  - Selection verdict
  - Recommended target (if any)
  - Timestamp

#### Scenario: Query analytics

- **GIVEN** recorded analytics data
- **WHEN** the organization admin views analytics
- **THEN** the system MUST show:
  - Total page views over time
  - Most common selections
  - Verdict distribution (compatible/partial/incompatible)
  - Popular targets

---

### Requirement: Embeddable Widget

The system SHALL support embedding compatibility checkers on external sites.

#### Scenario: Generate embed code

- **GIVEN** a published page
- **WHEN** the admin requests embed code
- **THEN** the system MUST provide:
  ```html
  <iframe src="https://flickerify.com/embed/{orgSlug}/{pageSlug}" width="100%" height="600" frameborder="0"> </iframe>
  ```
  OR JavaScript snippet for more control

#### Scenario: Embed API endpoint

- **GIVEN** an embed request to `/api/embed/{pageSlug}`
- **WHEN** the request includes valid organization context
- **THEN** the system MUST return:
  - Dropdown options data
  - Page configuration
  - CORS headers allowing external access

#### Scenario: Embed rate limiting

- **GIVEN** an embed endpoint
- **WHEN** requests exceed rate limit (e.g., 100/minute per page)
- **THEN** the system MUST return 429 Too Many Requests
