# Capability: Target Management

Management of target schemas, datasets, and rows. Targets represent items to check compatibility against (e.g., OBD devices, cartridges, lenses).

**Storage**: All target data is stored in PlanetScale (system of record). Convex only caches display metadata for frontend.

## ADDED Requirements

### Requirement: Target Schema Definition

The system SHALL allow organizations to define custom target schemas with typed fields.

#### Scenario: Create target schema

- **GIVEN** a user with write access to an organization
- **WHEN** the user creates a target definition with:
  ```json
  {
    "slug": "obd-devices",
    "name": "OBD Devices",
    "schema": {
      "fields": [
        { "name": "id", "type": "string", "required": true },
        { "name": "name", "type": "string", "required": true },
        { "name": "manufacturer", "type": "string", "required": true },
        { "name": "model", "type": "string", "required": true },
        { "name": "firmware", "type": "string", "required": false },
        { "name": "supportsFuel", "type": "boolean", "required": false },
        { "name": "supportsBattery", "type": "boolean", "required": false },
        { "name": "supportsOdometer", "type": "boolean", "required": false },
        { "name": "price", "type": "number", "required": false },
        { "name": "shopUrl", "type": "string", "required": false },
        { "name": "imageUrl", "type": "string", "required": false }
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
- **WHEN** the user creates a dataset with name "Q4 2025 Devices"
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
- **WHEN** the user uploads a JSON array of targets
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

- **GIVEN** a target dataset with OBD devices
- **WHEN** the user searches for "SyncUP"
- **THEN** the system MUST return targets where name or model contains "SyncUP"

#### Scenario: Update target attributes

- **GIVEN** an existing target row
- **WHEN** the user updates `price` or `shopUrl`
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
    "primaryField": "name",
    "secondaryField": "manufacturer",
    "imageField": "imageUrl",
    "linkField": "shopUrl",
    "sortField": "price",
    "sortOrder": "asc"
  }
  ```
- **THEN** the public page MUST use these settings to render target cards

#### Scenario: Default display configuration

- **GIVEN** a target definition without display configuration
- **WHEN** targets are displayed
- **THEN** the system MUST use defaults:
  - Primary field: first string field marked required
  - No image, no link
  - Sort by insertion order
