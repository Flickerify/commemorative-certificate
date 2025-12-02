# Capability: Source Management

Management of source schemas, datasets, and rows. Sources represent the items being checked for compatibility (e.g., AI clients, websites, software applications).

**Storage**: All source data is stored in PlanetScale (system of record). Convex only caches dropdown options for frontend display.

## ADDED Requirements

### Requirement: Source Schema Definition

The system SHALL allow organizations to define custom source schemas with typed fields.

#### Scenario: Create source schema

- **GIVEN** a user with write access to an organization
- **WHEN** the user creates a source definition with:
  ```json
  {
    "slug": "ai-clients",
    "name": "AI Clients (Type/Platform)",
    "schema": {
      "dimensions": ["clientType"],
      "fields": [
        { "name": "id", "type": "string", "required": true, "role": "identifier" },
        { "name": "name", "type": "string", "required": true, "role": "display" },
        {
          "name": "clientType",
          "type": "enum",
          "required": true,
          "role": "dimension",
          "options": ["web", "desktop", "mobile", "backend"]
        },
        { "name": "needsStreaming", "type": "boolean", "required": false, "role": "attribute" },
        { "name": "needsToolCalling", "type": "boolean", "required": false, "role": "attribute" },
        { "name": "needsStructuredOutputs", "type": "boolean", "required": false, "role": "attribute" },
        { "name": "region", "type": "string", "required": false, "role": "attribute" },
        { "name": "maxLatencyMs", "type": "number", "required": false, "role": "attribute" }
      ]
    }
  }
  ```
- **THEN** the system MUST validate the schema structure
- **AND** store the definition with `organizationId` scope
- **AND** return the created definition ID

#### Scenario: Schema validation errors

- **GIVEN** an invalid schema definition
- **WHEN** the user attempts to create it
- **THEN** the system MUST reject with specific validation errors:
  - "Dimension 'clientType' must have a corresponding field"
  - "Field type must be one of: string, number, boolean, enum"
  - "Enum fields must have options array"

#### Scenario: Schema slug uniqueness

- **GIVEN** an organization with a source definition `slug: ai-clients`
- **WHEN** the user attempts to create another with the same slug
- **THEN** the system MUST reject with "Source definition slug already exists"

---

### Requirement: Dynamic Dimensions

The system SHALL support unlimited dimensions stored as JSON, not fixed columns.

#### Scenario: Store dimensions as JSON

- **GIVEN** a source row with dimensions `{clientType: "web"}`
- **AND** attributes `{id: "t3-chat", name: "t3.chat", needsStreaming: true, needsToolCalling: false}`
- **WHEN** the row is stored
- **THEN** the `dimsJson` field MUST contain the dimension key-value pairs
- **AND** the `keyText` MUST be `clientType=web|id=t3-chat`
- **AND** the `keyHash` MUST be SHA-256 of the `keyText`

#### Scenario: Dimension count limit by tier

- **GIVEN** an organization with `planTier: personal`
- **WHEN** the user creates a schema with 5 dimensions
- **THEN** the system MUST reject with "Personal plan allows maximum 4 dimensions"

---

### Requirement: Source Dataset Versioning

The system SHALL support versioned datasets for each source definition.

#### Scenario: Create dataset

- **GIVEN** a source definition
- **WHEN** the user creates a dataset with name "December 2025 Clients"
- **THEN** the system MUST create a dataset record with:
  - `status: 'draft'`
  - `rowCount: 0`
  - `createdAt: <timestamp>`
- **AND** return the dataset ID

#### Scenario: Dataset status transitions

- **GIVEN** a dataset with `status: 'draft'`
- **WHEN** import begins
- **THEN** status MUST transition to `'importing'`
- **WHEN** import completes successfully
- **THEN** status MUST transition to `'ready'` with `readyAt` timestamp
- **WHEN** import fails
- **THEN** status MUST transition to `'failed'` with error message

---

### Requirement: CSV Import

The system SHALL support importing source data from CSV files.

#### Scenario: CSV upload and preview

- **GIVEN** a dataset in `draft` status
- **WHEN** the user uploads a CSV file
- **THEN** the system MUST:
  - Store the file temporarily
  - Parse the first 50 rows for preview
  - Return column names and sample data
  - NOT yet insert rows into the dataset

#### Scenario: Column mapping

- **GIVEN** a CSV with columns `["ID", "Name", "ClientType", "NeedsStreaming", "Region"]`
- **AND** a schema with fields `["id", "name", "clientType", "needsStreaming", "region"]`
- **WHEN** the user provides mapping:
  ```json
  {
    "columns": {
      "ID": "id",
      "Name": "name",
      "ClientType": "clientType",
      "NeedsStreaming": "needsStreaming",
      "Region": "region"
    },
    "defaults": {
      "needsToolCalling": false,
      "needsStructuredOutputs": false
    }
  }
  ```
- **THEN** the system MUST validate all required fields are mapped
- **AND** store the mapping configuration

#### Scenario: Import execution

- **GIVEN** a valid mapping configuration
- **WHEN** the user triggers import
- **THEN** the system MUST:
  - Process rows in batches of 1,000
  - Apply type coercion based on schema field types
  - Validate each row against the schema
  - Generate `keyText` and `keyHash` for each row
  - Insert valid rows with `ON DUPLICATE KEY UPDATE` semantics
  - Track invalid rows with error reasons
  - Update dataset `rowCount` and `status`

#### Scenario: Import with row limit

- **GIVEN** an organization with `planTier: personal` (1,000 row limit)
- **AND** a CSV with 1,500 rows
- **WHEN** import is executed
- **THEN** the system MUST stop after 1,000 rows
- **AND** set status to `'ready'` with warning "Row limit reached (1,000/1,500)"

---

### Requirement: Dimension Value Index

The system SHALL maintain an index of unique dimension values for dropdown generation.

#### Scenario: Extract dimension values on import

- **GIVEN** source rows being imported
- **WHEN** rows are inserted
- **THEN** the system MUST extract unique values per dimension level:
  - Level 0 (clientType): all unique client types (web, desktop, mobile, backend)
- **AND** store in `sourceDimensionValues` table with `parentKeyHash`

#### Scenario: Query cascading options

- **GIVEN** source dimension values are indexed
- **WHEN** the user selects `clientType=web`
- **THEN** the query for sources MUST return only web clients
- **AND** the filter dropdown options are generated from the dimension index

---

### Requirement: Source Row Management

The system SHALL support CRUD operations on source rows.

#### Scenario: List rows with pagination

- **GIVEN** a dataset with 5,000 rows
- **WHEN** the user queries rows with `limit: 100, offset: 0`
- **THEN** the system MUST return:
  - First 100 rows
  - Total count (5,000)
  - Pagination metadata

#### Scenario: Filter rows by dimensions

- **GIVEN** a dataset with AI client data
- **WHEN** the user filters by `{clientType: "web", needsStreaming: true}`
- **THEN** the system MUST return only rows matching those dimension/attribute values

#### Scenario: Create single row

- **GIVEN** a dataset in `ready` status
- **WHEN** the user creates a row with valid data:
  ```json
  {
    "id": "t3-chat",
    "name": "t3.chat",
    "clientType": "web",
    "needsStreaming": true,
    "needsToolCalling": false,
    "needsStructuredOutputs": false,
    "region": "global",
    "maxLatencyMs": 3000
  }
  ```
- **THEN** the system MUST:
  - Validate against schema
  - Generate `keyText` and `keyHash`
  - Insert with upsert semantics (update if key exists)
  - Update dimension value index

#### Scenario: Delete rows

- **GIVEN** a dataset with rows
- **WHEN** the user deletes rows by ID or filter
- **THEN** the system MUST:
  - Remove the rows
  - Update dataset `rowCount`
  - Recalculate dimension value index (or mark for rebuild)

---

### Requirement: Schema Templates

The system SHALL provide pre-built schema templates for common use cases.

#### Scenario: List available templates

- **WHEN** the user views the schema creation UI
- **THEN** the system MUST offer templates:
  - AI Client (Type/Platform/Features)
  - Software Application (Platform/OS/Version)
  - Hardware Device (Brand/Model/Generation)
  - Generic (customizable)

#### Scenario: Create from template

- **GIVEN** the user selects "AI Client" template
- **WHEN** the user confirms creation
- **THEN** the system MUST create a source definition with:
  - Pre-filled schema with standard fields (id, name, clientType, needsStreaming, needsToolCalling, etc.)
  - Dimension hierarchy configured
  - User can modify before saving
