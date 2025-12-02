# Capability: Target Management

Management of target schemas, datasets, and rows. Targets represent items to check compatibility against (e.g., LLM models, API providers, AI services).

**Storage**: All target data is stored in PlanetScale (system of record). Convex only caches display metadata for frontend.

## ADDED Requirements

### Requirement: Target Schema Definition

The system SHALL allow organizations to define custom target schemas with typed fields.

#### Scenario: Create target schema

- **GIVEN** a user with write access to an organization
- **WHEN** the user creates a target definition with:
  ```json
  {
    "slug": "llm-models",
    "name": "LLM Models",
    "schema": {
      "fields": [
        { "name": "id", "type": "string", "required": true },
        { "name": "displayName", "type": "string", "required": true },
        { "name": "provider", "type": "string", "required": true },
        { "name": "supportsStreaming", "type": "boolean", "required": true },
        { "name": "supportsToolCalling", "type": "boolean", "required": true },
        { "name": "supportsStructuredOutputs", "type": "boolean", "required": false },
        { "name": "primaryRegion", "type": "string", "required": false },
        { "name": "maxTokens", "type": "number", "required": false },
        { "name": "costPer1kTokens", "type": "number", "required": false },
        { "name": "docsUrl", "type": "string", "required": false },
        { "name": "logoUrl", "type": "string", "required": false }
      ]
    }
  }
  ```
- **THEN** the system MUST validate the schema structure
- **AND** store the definition with `organizationId` scope
- **AND** return the created definition ID

#### Scenario: Target schema validation

- **GIVEN** a target schema definition
- **WHEN** validation is performed
- **THEN** the system MUST ensure:
  - At least one field is marked as the identifier
  - Field types are valid (string, number, boolean, enum)
  - Required fields have no default value dependency

---

### Requirement: Target Dataset Management

The system SHALL support versioned datasets for target definitions.

#### Scenario: Create target dataset

- **GIVEN** a target definition
- **WHEN** the user creates a dataset with name "Q4 2025 LLM Models"
- **THEN** the system MUST create a dataset record with:
  - `status: 'draft'`
  - `rowCount: 0`
  - `createdAt: <timestamp>`

#### Scenario: Target row limit by tier

- **GIVEN** an organization with `planTier: personal` (100 target row limit)
- **WHEN** the user attempts to import 150 target rows
- **THEN** the system MUST stop after 100 rows
- **AND** return warning "Target row limit reached (100/150)"

---

### Requirement: Target Data Import

The system SHALL support importing target data from CSV and JSON files.

#### Scenario: Import targets from CSV

- **GIVEN** a target dataset in draft status
- **WHEN** the user uploads a CSV with target data
- **THEN** the system MUST:
  - Parse and preview the data
  - Allow column mapping to schema fields
  - Validate data against schema
  - Insert rows with upsert semantics

#### Scenario: Import targets from JSON

- **GIVEN** a target dataset in draft status
- **WHEN** the user uploads a JSON array of targets:
  ```json
  [
    {
      "id": "gpt-4.1",
      "displayName": "GPT-4.1",
      "provider": "openai",
      "supportsStreaming": true,
      "supportsToolCalling": true,
      "supportsStructuredOutputs": true,
      "primaryRegion": "global",
      "maxTokens": 128000
    },
    {
      "id": "claude-3.7-sonnet",
      "displayName": "Claude 3.7 Sonnet",
      "provider": "anthropic",
      "supportsStreaming": true,
      "supportsToolCalling": true,
      "supportsStructuredOutputs": true,
      "primaryRegion": "global",
      "maxTokens": 200000
    }
  ]
  ```
- **THEN** the system MUST:
  - Validate each object against the schema
  - Insert rows with generated `keyText` and `keyHash`
  - Report validation errors per row

---

### Requirement: Target Row Management

The system SHALL support CRUD operations on target rows.

#### Scenario: List targets with pagination

- **GIVEN** a target dataset with 200 rows
- **WHEN** the user queries with `limit: 50`
- **THEN** the system MUST return first 50 targets with total count

#### Scenario: Search targets

- **GIVEN** a target dataset with LLM models
- **WHEN** the user searches for "claude"
- **THEN** the system MUST return targets where displayName or provider contains "claude"

#### Scenario: Filter by provider

- **GIVEN** a target dataset with LLM models from multiple providers
- **WHEN** the user filters by `{provider: "openai"}`
- **THEN** the system MUST return only OpenAI models

#### Scenario: Update target attributes

- **GIVEN** an existing target row
- **WHEN** the user updates `costPer1kTokens` or `docsUrl`
- **THEN** the system MUST:
  - Validate the update against schema
  - Update the row
  - Preserve `keyHash` (attributes don't affect key)

---

### Requirement: Target Display Configuration

The system SHALL allow configuration of how targets are displayed on public pages.

#### Scenario: Configure display fields

- **GIVEN** a target definition
- **WHEN** the user configures display settings:
  ```json
  {
    "primaryField": "displayName",
    "secondaryField": "provider",
    "imageField": "logoUrl",
    "linkField": "docsUrl",
    "sortField": "displayName",
    "sortOrder": "asc",
    "groupByField": "provider"
  }
  ```
- **THEN** the public page MUST use these settings to render target cards/columns

#### Scenario: Default display configuration

- **GIVEN** a target definition without display configuration
- **WHEN** targets are displayed
- **THEN** the system MUST use defaults:
  - Primary field: first string field marked required
  - No image, no link
  - Sort by insertion order
