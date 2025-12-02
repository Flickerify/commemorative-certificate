# Capability: Public Pages

Public-facing compatibility checker pages supporting both dropdown-based selection (Finder template) and matrix-based display (Matrix template) with subdomain access.

**Storage**: Page configuration is stored in PlanetScale. Convex caches dropdown options (`optionShards`), results (`resultCache`), and page display metadata (`pageDisplays`) for fast frontend reads. API routes handle writes and sync to Convex.

## ADDED Requirements

### Requirement: Public Page Configuration

The system SHALL allow organizations to configure public compatibility pages.

#### Scenario: Create public page

- **GIVEN** a source dataset and target dataset in `ready` status
- **WHEN** the user creates a public page:
  ```json
  {
    "slug": "llm-compatibility",
    "name": "LLM Compatibility Checker",
    "template": "matrix",
    "sourceDatasetId": "source_123",
    "targetDatasetId": "target_456"
  }
  ```
- **THEN** the system MUST create a page record with:
  - `status: 'draft'`
  - Default device and selection policies
  - Generated `revisionId`

#### Scenario: Page slug uniqueness

- **GIVEN** an organization with a page `slug: llm-compatibility`
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

### Requirement: Page Templates

The system SHALL support multiple page templates for different compatibility visualization patterns.

#### Scenario: Finder template (dropdown-based)

- **GIVEN** a page with `template: 'finder'`
- **WHEN** the page is rendered
- **THEN** the UI MUST display:
  - Cascading dropdowns for source dimension selection
  - Result list showing compatible targets after selection
  - Feature breakdown per target

#### Scenario: Matrix template (grid-based)

- **GIVEN** a page with `template: 'matrix'`
- **WHEN** the page is rendered
- **THEN** the UI MUST display:
  - Rows representing sources (clients/websites)
  - Columns representing targets (LLM models)
  - Cells showing compatibility status (✅ / ⚠️ / ❌)
  - Optional grouping by target provider

#### Scenario: Matrix with filters

- **GIVEN** a matrix template page
- **WHEN** the page loads
- **THEN** the UI MUST provide filter controls:
  - Filter by source client type (web, desktop, mobile, backend)
  - Filter by target provider (OpenAI, Anthropic, Meta, etc.)
  - Filter by feature support (streaming, tool calling, etc.)

---

### Requirement: Cascading Dropdowns (Finder Template)

The system SHALL generate cascading dropdown options from source dimension values.

#### Scenario: Load root dimension options

- **GIVEN** a published page with source dataset (AI clients)
- **WHEN** the public page loads
- **THEN** the system MUST return all unique values for the first dimension (e.g., client types)
- **AND** subsequent dropdowns are disabled until selection is made

#### Scenario: Load child dimension options

- **GIVEN** a selection of `clientType: web`
- **WHEN** the next dropdown is activated
- **THEN** the system MUST return only sources that match the parent selection
- **AND** NOT return items from other client types

#### Scenario: Complete selection

- **GIVEN** all dimensions have been selected
- **WHEN** the final dropdown value is chosen
- **THEN** the system MUST automatically trigger compatibility evaluation
- **AND** display loading state while evaluating

#### Scenario: Reset cascade on change

- **GIVEN** selections: `clientType: web, id: t3-chat`
- **WHEN** the user changes `clientType` to `desktop`
- **THEN** the `id` dropdown MUST reset to empty
- **AND** reload source options for `clientType: desktop`

---

### Requirement: Compatibility Matrix Display

The system SHALL display compatibility results in a matrix format for the Matrix template.

#### Scenario: Display matrix grid

- **GIVEN** a matrix template page with sources and targets
- **WHEN** the page loads
- **THEN** the UI MUST show:
  - Column headers: LLM model names with provider logos
  - Row headers: client/website names
  - Cell values: verdict indicators (✅ = 2, ⚠️ = 1, ❌ = 0)

#### Scenario: Matrix cell interaction

- **GIVEN** a rendered matrix
- **WHEN** the user hovers over a cell
- **THEN** the UI MUST show a tooltip with:
  - Source name and target name
  - Verdict (fully compatible / partial / incompatible)
  - Feature breakdown (which features pass/fail)

#### Scenario: Matrix cell click for details

- **GIVEN** a rendered matrix
- **WHEN** the user clicks a cell
- **THEN** the UI MUST open a detail panel showing:
  - Full feature compatibility breakdown
  - Override status (if any)
  - Links to source and target documentation

#### Scenario: Matrix grouping by provider

- **GIVEN** a matrix template with `groupByField: "provider"`
- **WHEN** the matrix is rendered
- **THEN** columns MUST be grouped by provider:
  ```
  | Client   | OpenAI        | Anthropic      | Meta           |
  |          | GPT-4.1 | mini | Claude 3.7 | ... | Llama 3.3 | ... |
  |----------|---------|------|------------|-----|-----------|-----|
  | t3.chat  | ✅      | ✅   | ✅         | ... | ⚠️        | ... |
  | MyApp    | ✅      | ✅   | ❌         | ... | ❌        | ... |
  ```

---

### Requirement: Result Display (Finder Template)

The system SHALL display compatibility results in a clear, actionable format for the Finder template.

#### Scenario: Display compatible result

- **GIVEN** a selection verdict of `2` (fully compatible)
- **AND** a recommended target
- **WHEN** results are displayed
- **THEN** the UI MUST show:
  - Success message: "Great news! The following LLMs are fully compatible with {source.name}."
  - Highlighted recommended LLM
  - Full compatibility list for all LLMs

#### Scenario: Display partial result

- **GIVEN** a selection verdict of `1` (partial)
- **WHEN** results are displayed
- **THEN** the UI MUST show:
  - Warning message: "Some LLMs have partial compatibility with {source.name}."
  - List of partially compatible LLMs with feature breakdown

#### Scenario: Display incompatible result

- **GIVEN** a selection verdict of `0` (incompatible)
- **WHEN** results are displayed
- **THEN** the UI MUST show:
  - Error message: "No compatible LLMs found for {source.name}."
  - Optional: closest matches or suggestions

#### Scenario: Feature matrix display

- **GIVEN** evaluation results with feature breakdown
- **WHEN** the matrix is rendered
- **THEN** the UI MUST show:
  - Rows: feature rules (grouped by category if configured)
  - Columns: LLM models
  - Cells: checkmark (✓) for pass, X for fail
  - Column header: LLM name, provider logo if available

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
    "headlineWhen2": "Great news! The following LLMs are fully compatible with {source.name}.",
    "headlineWhen1": "Some LLMs have partial compatibility with {source.name}.",
    "headlineWhen0": "No compatible LLMs found for {source.name}."
  }
  ```
- **THEN** the public page MUST use these templates with variable substitution

#### Scenario: Configure dropdown labels (Finder template)

- **GIVEN** a source schema with dimensions `[clientType]`
- **WHEN** the user configures labels:
  ```json
  {
    "clientType": "Select Client Type"
  }
  ```
- **THEN** the dropdowns MUST use these labels as placeholders

#### Scenario: Configure matrix headers (Matrix template)

- **GIVEN** a matrix template page
- **WHEN** the user configures display:
  ```json
  {
    "sourceColumnHeader": "Client / Application",
    "showProviderGroups": true,
    "showFeatureTooltips": true
  }
  ```
- **THEN** the matrix MUST use these settings for rendering

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
  - Template type (finder/matrix)

#### Scenario: Track selection query

- **GIVEN** a visitor completes a selection and views results
- **WHEN** evaluation completes
- **THEN** the system MUST record:
  - Selection key
  - Selection verdict
  - Recommended target (if any)
  - Timestamp

#### Scenario: Track matrix cell clicks

- **GIVEN** a visitor clicks a cell in the matrix
- **WHEN** the detail panel opens
- **THEN** the system MUST record:
  - Source and target IDs
  - Verdict shown
  - Timestamp

#### Scenario: Query analytics

- **GIVEN** recorded analytics data
- **WHEN** the organization admin views analytics
- **THEN** the system MUST show:
  - Total page views over time
  - Most common selections / most viewed cells
  - Verdict distribution (compatible/partial/incompatible)
  - Popular LLMs (targets)

---

### Requirement: Embeddable Widget

The system SHALL support embedding compatibility checkers on external sites.

#### Scenario: Generate embed code

- **GIVEN** a published page
- **WHEN** the admin requests embed code
- **THEN** the system MUST provide:
  ```html
  <iframe src="https://flickerify.com/embed/{orgSlug}/{pageSlug}" width="100%" height="600" frameborder="0"></iframe>
  ```
  OR JavaScript snippet for more control

#### Scenario: Embed API endpoint

- **GIVEN** an embed request to `/api/embed/{pageSlug}`
- **WHEN** the request includes valid organization context
- **THEN** the system MUST return:
  - Dropdown options data (finder) or matrix data (matrix)
  - Page configuration
  - CORS headers allowing external access

#### Scenario: Embed rate limiting

- **GIVEN** an embed endpoint
- **WHEN** requests exceed rate limit (e.g., 100/minute per page)
- **THEN** the system MUST return 429 Too Many Requests
