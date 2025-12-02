# Design: Compatibility Platform Architecture

## Context

Flickerify is pivoting to a multi-tenant compatibility checker platform. Organizations create schemas for "sources" (what's being checked, e.g., AI clients/websites) and "targets" (what to check against, e.g., LLM models), define compatibility rules, and publish public-facing pages where end-users can check compatibility.

**MVP Domain**: Website/Software ↔ LLM compatibility. Users check which LLM models are compatible with their AI-powered applications.

### Stakeholders

- **Organization admins**: Create schemas, import data, configure rules
- **End-users**: Use public pages to check compatibility
- **Platform operators**: Monitor usage, manage billing tiers

### Constraints

- Must work with existing WorkOS authentication
- PlanetScale is the system of record (all data, computation)
- Convex handles frontend visualization only (read cache)
- Convex documents limited to 1MB
- No monorepo structure (single Next.js project)

## Goals / Non-Goals

### Goals

- Multi-tenant data isolation using WorkOS organizations
- Dynamic schema definitions without code changes
- Flexible rule engine supporting any compatibility domain
- Public pages with subdomain routing for paid organizations
- Usage limits for personal/free organizations
- **PlanetScale as source of truth for all business data**
- **Convex as optimized read layer for UI**
- **Matrix template for grid-based compatibility visualization**

### Non-Goals

- Custom branding beyond basic theming (future)
- Real-time collaboration on rule editing
- Complex workflow automation (n8n integration deferred)
- Mobile app (web-first)

## Decisions

### Decision 1: PlanetScale as System of Record

**What**: All business data (sources, targets, rules, computations) is stored and processed in PlanetScale. Convex is only used for frontend visualization.

**Why**:

- PlanetScale handles complex relational queries efficiently
- Drizzle ORM provides type-safe SQL
- Avoids Convex document size limits for large datasets
- Clear separation: PlanetScale = backend, Convex = frontend cache

**Data Flow**:

```
┌─────────────────────────────────────────────────────────────┐
│                      WRITE PATH                              │
│                                                              │
│  Admin UI → Next.js API Routes → PlanetScale (Drizzle)      │
│                                        │                     │
│                                        ▼                     │
│                              (Sync to Convex for display)    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      READ PATH                               │
│                                                              │
│  Public Page → Convex Queries → Cached display data          │
│       │                                                      │
│       └─→ (Cache miss) → API Route → PlanetScale → Convex    │
└─────────────────────────────────────────────────────────────┘
```

**What goes where**:

| Data                  | PlanetScale   | Convex              |
| --------------------- | ------------- | ------------------- |
| Source definitions    | ✅ Primary    | Display metadata    |
| Source datasets       | ✅ Primary    | Stats for UI        |
| Source rows           | ✅ Primary    | ❌ Not stored       |
| Target definitions    | ✅ Primary    | Display metadata    |
| Target rows           | ✅ Primary    | ❌ Not stored       |
| Feature rules         | ✅ Primary    | ❌ Not stored       |
| Policies              | ✅ Primary    | ❌ Not stored       |
| Overrides             | ✅ Primary    | ❌ Not stored       |
| Dropdown options      | ✅ Primary    | ✅ Cached shards    |
| Compatibility results | ✅ Primary    | ✅ Cached pages     |
| Organizations         | Existing sync | ✅ Primary (WorkOS) |
| Users                 | Existing sync | ✅ Primary (WorkOS) |

### Decision 2: WorkOS Organizations as Tenants

**What**: Each WorkOS organization is a tenant. All data is scoped by `organizationId`.

**Why**:

- WorkOS already manages organization membership and SSO
- Natural fit with existing authentication flow
- Organizations can have multiple users with different roles

**Implementation**:

- PlanetScale tables include `organization_id` column
- All queries filter by organization context
- Convex caches are namespaced by organization

### Decision 3: Next.js API Routes for Business Logic

**What**: Use Next.js API routes (`app/api/`) for all write operations and complex reads.

**Why**:

- Direct access to PlanetScale via Drizzle
- Shares auth context with pages
- Server-side validation and computation
- Convex remains a thin visualization layer

**API Route Structure**:

```
app/api/
├── sources/
│   ├── definitions/
│   │   ├── route.ts          # GET (list), POST (create)
│   │   └── [id]/route.ts     # GET, PATCH, DELETE
│   ├── datasets/
│   │   ├── route.ts
│   │   └── [id]/
│   │       ├── route.ts
│   │       ├── import/route.ts   # POST (upload + process)
│   │       └── rows/route.ts     # GET (paginated)
│   └── dimensions/route.ts       # GET (cascading options)
├── targets/
│   └── ... (mirrors sources)
├── rules/
│   ├── route.ts
│   └── [id]/route.ts
├── pages/
│   ├── route.ts
│   ├── [id]/
│   │   ├── route.ts
│   │   └── publish/route.ts
│   └── evaluate/route.ts         # POST (compute compatibility)
└── sync/
    └── convex/route.ts           # Trigger Convex cache sync
```

### Decision 4: Convex for Visualization Only

**What**: Convex stores only pre-computed data optimized for frontend display.

**Tables in Convex** (visualization cache):

```
# Dropdown option cache (sharded for <1MB docs)
optionShards
├── organizationId
├── pageId
├── level (dimension index)
├── parentHash
├── shard (0, 1, 2...)
├── values: string[]
└── syncedAt

# Compatibility result cache (paginated)
resultCache
├── organizationId
├── pageId
├── selectionHash
├── page (1, 2, 3...)
├── payload: { verdict, targets[], features[] }
└── syncedAt

# Page metadata for UI
pageDisplays
├── organizationId
├── slug
├── name
├── status
├── template ("finder" | "matrix")
├── dimensions: { name, label }[]
├── messaging: { headline2, headline1, headline0 }
└── syncedAt

# Existing tables (unchanged)
users, organizations, organizationMemberships, syncStatus
```

**Convex Functions**:

```typescript
// Read-only queries for UI
pages.query.getBySlug; // Get page display config
pages.query.getOptions; // Get dropdown options (from shards)
pages.query.getResult; // Get cached result (or trigger compute)
pages.query.getMatrixData; // Get matrix grid data

// Internal mutations (called by API routes after PlanetScale write)
internal.pages.mutation.syncPageDisplay;
internal.pages.mutation.syncOptionShards;
internal.pages.mutation.syncResultCache;
```

### Decision 5: Subdomain Routing via Middleware

**What**: Use Next.js middleware to route `{org}.flickerify.com` to tenant-specific pages, following the [vercel/platforms](https://github.com/vercel/platforms) pattern.

**Why**:

- Proven pattern from Vercel
- Works with Vercel preview deployments
- Supports local development (`{org}.localhost:3000`)

**Implementation**:

```
middleware.ts
├── Detect subdomain from request
├── Lookup organization by subdomain (PlanetScale via edge-compatible query OR Redis cache)
├── Rewrite to /[domain]/[...slug]
└── Add org context to headers
```

### Decision 6: Dynamic Schemas with JSON

**What**: Store schema definitions as JSON in `source_definitions.schema_json`.

**Why**:

- No database migrations when tenants create new schemas
- Supports unlimited dimensions
- Can validate at runtime with Zod

**Example Source Schema** (AI Client):

```json
{
  "dimensions": ["clientType"],
  "fields": [
    { "name": "id", "type": "string", "required": true },
    { "name": "name", "type": "string", "required": true },
    { "name": "clientType", "type": "enum", "required": true, "options": ["web", "desktop", "mobile", "backend"] },
    { "name": "needsStreaming", "type": "boolean", "required": false },
    { "name": "needsToolCalling", "type": "boolean", "required": false },
    { "name": "needsStructuredOutputs", "type": "boolean", "required": false },
    { "name": "region", "type": "string", "required": false },
    { "name": "maxLatencyMs", "type": "number", "required": false }
  ]
}
```

**Example Target Schema** (LLM Model):

```json
{
  "fields": [
    { "name": "id", "type": "string", "required": true },
    { "name": "displayName", "type": "string", "required": true },
    { "name": "provider", "type": "string", "required": true },
    { "name": "supportsStreaming", "type": "boolean", "required": true },
    { "name": "supportsToolCalling", "type": "boolean", "required": true },
    { "name": "supportsStructuredOutputs", "type": "boolean", "required": false },
    { "name": "primaryRegion", "type": "string", "required": false },
    { "name": "maxTokens", "type": "number", "required": false }
  ]
}
```

**PlanetScale Schema**:

```sql
CREATE TABLE source_definitions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  organization_id VARCHAR(255) NOT NULL,
  slug VARCHAR(128) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  schema_json JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_org_slug (organization_id, slug)
);
```

### Decision 7: Dimension Storage Strategy

**What**: Store dimensions as JSON (`dims_json`) per row in PlanetScale, with a materialized dimension index table.

**PlanetScale Tables**:

```sql
CREATE TABLE source_rows (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  organization_id VARCHAR(255) NOT NULL,
  dataset_id BIGINT NOT NULL,
  key_text VARCHAR(512) NOT NULL,
  key_hash CHAR(64) NOT NULL,
  dims_json JSON NOT NULL,
  attrs_json JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_dataset_key (dataset_id, key_hash),
  INDEX idx_org_dataset (organization_id, dataset_id)
);

CREATE TABLE source_dimension_values (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  organization_id VARCHAR(255) NOT NULL,
  dataset_id BIGINT NOT NULL,
  level INT NOT NULL,
  parent_key_hash CHAR(64) NOT NULL,
  value VARCHAR(255) NOT NULL,
  value_count INT DEFAULT 1,
  UNIQUE KEY uniq_dim (dataset_id, level, parent_key_hash, value),
  INDEX idx_parent (dataset_id, level, parent_key_hash)
);
```

### Decision 8: JSONLogic for Rules

**What**: Use [json-logic-js](https://jsonlogic.com/) for feature rules, stored in PlanetScale.

**Example Rules for LLM Compatibility**:

```json
// Streaming Support (required)
{
  "name": "Streaming Support",
  "required": true,
  "logic": {
    "or": [
      { "==": [{ "var": "source.needsStreaming" }, false] },
      {
        "and": [
          { "==": [{ "var": "source.needsStreaming" }, true] },
          { "==": [{ "var": "target.supportsStreaming" }, true] }
        ]
      }
    ]
  }
}

// Tool Calling Support (optional, weighted)
{
  "name": "Tool Calling Support",
  "required": false,
  "weight": 2,
  "logic": {
    "or": [
      { "==": [{ "var": "source.needsToolCalling" }, false] },
      {
        "and": [
          { "==": [{ "var": "source.needsToolCalling" }, true] },
          { "==": [{ "var": "target.supportsToolCalling" }, true] }
        ]
      }
    ]
  }
}

// Provider Restriction
{
  "name": "OpenAI Provider Required",
  "required": true,
  "logic": {
    "==": [{ "var": "target.provider" }, "openai"]
  }
}
```

**PlanetScale Table**:

```sql
CREATE TABLE feature_rules (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  organization_id VARCHAR(255) NOT NULL,
  page_id BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  required BOOLEAN DEFAULT FALSE,
  weight FLOAT DEFAULT 1.0,
  category VARCHAR(128),
  logic_json JSON NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_page (organization_id, page_id)
);
```

### Decision 9: Three-Level Verdict System

**What**: Compatibility verdicts are 0 (incompatible), 1 (partial), 2 (fully compatible).

**Policies stored in PlanetScale** (on `public_pages` table as JSON columns):

```sql
ALTER TABLE public_pages ADD COLUMN device_policy_json JSON;
ALTER TABLE public_pages ADD COLUMN selection_policy_json JSON;
```

### Decision 10: Usage Limits by Organization Type

**What**: Personal organizations have hard limits; paid organizations have higher/no limits.

| Limit                   | Personal | Paid      |
| ----------------------- | -------- | --------- |
| Source schemas          | 2        | Unlimited |
| Target schemas          | 2        | Unlimited |
| Source rows per dataset | 1,000    | 100,000+  |
| Target rows per dataset | 100      | 10,000+   |
| Dimensions per schema   | 4        | 10        |
| Rules per page          | 10       | 100       |
| Custom subdomain        | ❌       | ✅        |

**Implementation**:

- Check limits in API routes before write
- Store `plan_tier` on organizations (synced from WorkOS or managed locally)

### Decision 11: Page Templates

**What**: Support multiple visualization templates for public pages.

**Templates**:

| Template | Use Case                     | UI Pattern                 |
| -------- | ---------------------------- | -------------------------- |
| Finder   | Single source → many targets | Cascading dropdowns → list |
| Matrix   | Many sources × many targets  | Grid with ✅/⚠️/❌ cells   |

**Matrix Template Layout**:

```
| Client / LLM | OpenAI        | Anthropic      | Meta           |
|              | GPT-4.1 | mini | Claude 3.7 | ... | Llama 3.3 | ... |
|--------------|---------|------|------------|-----|-----------|-----|
| t3.chat      | ✅      | ✅   | ✅         | ... | ⚠️        | ... |
| MyApp        | ✅      | ✅   | ❌         | ... | ❌        | ... |
| Customer X   | ✅      | ✅   | ✅         | ... | ❌        | ... |
```

**Implementation**:

- Store `template` field on `public_pages`
- Matrix template groups columns by `target.provider`
- Cell tooltips show feature breakdown

### Decision 12: Sync Strategy (PlanetScale → Convex)

**What**: After writes to PlanetScale, sync relevant visualization data to Convex.

**Sync Triggers**:

1. **Page publish**: Sync page display metadata + generate option shards
2. **Import complete**: Regenerate dimension values → sync option shards
3. **Evaluation request (cache miss)**: Compute in API route → sync result to Convex

**Sync Implementation**:

```typescript
// API route after PlanetScale write
await syncToConvex({
  type: 'page-display',
  organizationId,
  pageId,
  data: { name, slug, template, dimensions, messaging },
});

// Uses existing Convex internal mutations
// Similar pattern to existing WorkOS → Convex sync
```

## Data Model

### PlanetScale Tables (System of Record)

```sql
-- Organizations (extends existing)
ALTER TABLE organizations ADD COLUMN plan_tier ENUM('personal', 'team', 'enterprise') DEFAULT 'personal';
ALTER TABLE organizations ADD COLUMN custom_subdomain VARCHAR(63);
ALTER TABLE organizations ADD COLUMN usage_limits JSON;

-- Source Management
source_definitions (id, organization_id, slug, name, schema_json, ...)
source_datasets (id, organization_id, definition_id, name, status, row_count, ...)
source_rows (id, organization_id, dataset_id, key_text, key_hash, dims_json, attrs_json, ...)
source_dimension_values (id, organization_id, dataset_id, level, parent_key_hash, value, ...)
source_imports (id, organization_id, dataset_id, status, mapping_json, stats_json, error, ...)

-- Target Management (mirrors source pattern)
target_definitions (id, organization_id, slug, name, schema_json, ...)
target_datasets (id, organization_id, definition_id, name, status, row_count, ...)
target_rows (id, organization_id, dataset_id, key_text, key_hash, attrs_json, ...)

-- Compatibility Engine
feature_rules (id, organization_id, page_id, name, required, weight, logic_json, ...)
overrides (id, organization_id, page_id, source_key_hash, target_key_hash, value, note, ...)

-- Public Pages
public_pages (id, organization_id, slug, name, template, source_dataset_id, target_dataset_id,
              device_policy_json, selection_policy_json, status, revision_id, ...)

-- Cached Results (can be in PlanetScale for persistence, synced to Convex)
compat_results (id, organization_id, page_id, revision_id, selection_hash, page_num, payload_json, ...)
option_index (id, organization_id, page_id, level, parent_hash, shard, values_json, ...)
```

### Convex Tables (Visualization Cache)

```
optionShards      -- Dropdown options for public pages
resultCache       -- Compatibility results for display
pageDisplays      -- Page metadata for UI rendering

-- Existing (unchanged)
users, organizations, organizationMemberships,
organizationDomains, syncStatus
```

## API Design

### Next.js API Routes (Write + Compute)

| Route                               | Method             | Purpose                    |
| ----------------------------------- | ------------------ | -------------------------- |
| `/api/sources/definitions`          | GET, POST          | List/create source schemas |
| `/api/sources/definitions/[id]`     | GET, PATCH, DELETE | Manage schema              |
| `/api/sources/datasets`             | GET, POST          | List/create datasets       |
| `/api/sources/datasets/[id]/import` | POST               | Upload + process CSV       |
| `/api/sources/datasets/[id]/rows`   | GET                | Paginated rows             |
| `/api/sources/dimensions`           | GET                | Cascading dropdown options |
| `/api/targets/*`                    | \*                 | Mirror of sources          |
| `/api/rules`                        | GET, POST          | List/create rules          |
| `/api/pages`                        | GET, POST          | List/create pages          |
| `/api/pages/[id]/publish`           | POST               | Publish page               |
| `/api/pages/[id]/evaluate`          | POST               | Compute compatibility      |
| `/api/pages/[id]/matrix`            | GET                | Get matrix data            |

### Convex Functions (Read for UI)

| Function                                  | Type     | Purpose                |
| ----------------------------------------- | -------- | ---------------------- |
| `pages.query.getBySlug`                   | Query    | Page display config    |
| `pages.query.getOptions`                  | Query    | Dropdown option shards |
| `pages.query.getResult`                   | Query    | Cached result pages    |
| `pages.query.getMatrixData`               | Query    | Matrix grid data       |
| `internal.pages.mutation.syncPageDisplay` | Internal | Sync from API route    |
| `internal.pages.mutation.syncOptions`     | Internal | Sync dropdown shards   |
| `internal.pages.mutation.syncResult`      | Internal | Sync result cache      |

## Migration Plan

### Phase 1: Database Foundation

1. Create PlanetScale tables (Drizzle schema)
2. Add organization fields (planTier, customSubdomain)
3. Set up Drizzle migrations

### Phase 2: API Routes + Admin UI

1. Implement source management API routes
2. Build source management UI (uses API routes)
3. Implement target management (same pattern)

### Phase 3: Compatibility Engine

1. Implement rule management API routes
2. Implement evaluation logic (PlanetScale-side)
3. Build rule builder UI

### Phase 4: Public Pages + Convex Cache

1. Implement page management API routes
2. Build sync to Convex (option shards, results)
3. Build public page UI (Finder + Matrix templates)
4. Implement subdomain routing

### Rollback

- Feature flags per capability
- Old routes can coexist during transition
- Convex cache is disposable (can rebuild from PlanetScale)

## Open Questions

1. **Redis for middleware**: Should subdomain lookup use Redis for edge performance?
2. **Pricing model**: What are the exact limits per tier?
3. **Analytics storage**: PlanetScale or separate analytics service?

## References

- [vercel/platforms](https://github.com/vercel/platforms) — Multi-tenant Next.js example
- [JSONLogic](https://jsonlogic.com/) — Rule engine
- [Drizzle ORM](https://orm.drizzle.team/) — Type-safe SQL
