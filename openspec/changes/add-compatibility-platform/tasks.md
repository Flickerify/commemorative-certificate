# Tasks: Add Compatibility Platform

## Phase 1: Database Foundation (PlanetScale)

### 1.1 PlanetScale Schema Setup

- [ ] 1.1.1 Create `source_definitions` table with Drizzle
- [ ] 1.1.2 Create `source_datasets` table
- [ ] 1.1.3 Create `source_rows` table with JSON columns
- [ ] 1.1.4 Create `source_dimension_values` table for dropdown optimization
- [ ] 1.1.5 Create `source_imports` table for import job tracking
- [ ] 1.1.6 Create `target_definitions` table
- [ ] 1.1.7 Create `target_datasets` table
- [ ] 1.1.8 Create `target_rows` table
- [ ] 1.1.9 Create `feature_rules` table
- [ ] 1.1.10 Create `overrides` table
- [ ] 1.1.11 Create `public_pages` table with policy JSON columns and `template` field
- [ ] 1.1.12 Create `compat_results` table for result caching
- [ ] 1.1.13 Create `option_index` table for dropdown shards
- [ ] 1.1.14 Add `plan_tier`, `custom_subdomain` to `organizations` table
- [ ] 1.1.15 Run Drizzle migrations

### 1.2 Convex Visualization Schema

- [ ] 1.2.1 Create `optionShards` table in Convex (dropdown cache)
- [ ] 1.2.2 Create `resultCache` table in Convex (compatibility results)
- [ ] 1.2.3 Create `pageDisplays` table in Convex (page metadata for UI)
- [ ] 1.2.4 Add `planTier`, `customSubdomain` fields to existing `organizations` table

### 1.3 Multi-Tenant Middleware

- [ ] 1.3.1 Install subdomain detection middleware (follow [vercel/platforms](https://github.com/vercel/platforms))
- [ ] 1.3.2 Add organization lookup by subdomain (PlanetScale query)
- [ ] 1.3.3 Create `app/[domain]/` route group for tenant pages
- [ ] 1.3.4 Add subdomain context to request headers
- [ ] 1.3.5 Handle localhost development subdomains
- [ ] 1.3.6 Add subdomain validation for paid organizations only

### 1.4 Usage Limits Infrastructure

- [ ] 1.4.1 Create `UsageLimits` type definition with tier-based limits
- [ ] 1.4.2 Create `checkLimit` helper function for API routes
- [ ] 1.4.3 Create `/api/organization/limits` endpoint to expose limits to UI

### 1.5 Admin UI Setup

- [ ] 1.5.1 Update sidebar navigation for compatibility platform
- [ ] 1.5.2 Create `/sources` route placeholder
- [ ] 1.5.3 Create `/targets` route placeholder
- [ ] 1.5.4 Create `/rules` route placeholder
- [ ] 1.5.5 Create `/pages` route placeholder

---

## Phase 2: Source Management

### 2.1 Schema Definition API

- [ ] 2.1.1 Create `app/api/sources/definitions/route.ts` (GET list, POST create)
- [ ] 2.1.2 Create `app/api/sources/definitions/[id]/route.ts` (GET, PATCH, DELETE)
- [ ] 2.1.3 Create Drizzle query helpers for source definitions
- [ ] 2.1.4 Add Zod validation for schema JSON structure
- [ ] 2.1.5 Implement usage limit check on create

### 2.2 Schema Definition UI

- [ ] 2.2.1 Create schema builder UI component (field editor)
- [ ] 2.2.2 Add dimension ordering UI (drag-and-drop)
- [ ] 2.2.3 Create schema templates selector (AI Client, Software Application, Hardware Device, Generic)
- [ ] 2.2.4 Create `/sources` page with definition list
- [ ] 2.2.5 Create `/sources/new` page with schema builder

### 2.3 Dataset Management API

- [ ] 2.3.1 Create `app/api/sources/datasets/route.ts` (GET, POST)
- [ ] 2.3.2 Create `app/api/sources/datasets/[id]/route.ts` (GET, PATCH, DELETE)
- [ ] 2.3.3 Create Drizzle query helpers for datasets
- [ ] 2.3.4 Implement dataset status transitions

### 2.4 Dataset Management UI

- [ ] 2.4.1 Create dataset list UI with status indicators
- [ ] 2.4.2 Create `/sources/[definitionId]` page showing datasets
- [ ] 2.4.3 Create dataset detail page with row preview

### 2.5 Data Import API

- [ ] 2.5.1 Create `app/api/sources/datasets/[id]/import/route.ts` (POST)
- [ ] 2.5.2 Implement CSV parsing with streaming
- [ ] 2.5.3 Create preview endpoint (first 50 rows)
- [ ] 2.5.4 Implement column mapping validation
- [ ] 2.5.5 Implement batch row insertion with transaction
- [ ] 2.5.6 Implement dimension value extraction
- [ ] 2.5.7 Add import progress tracking
- [ ] 2.5.8 Implement row limit enforcement

### 2.6 Data Import UI

- [ ] 2.6.1 Create file upload component
- [ ] 2.6.2 Create column mapping UI (source column → schema field)
- [ ] 2.6.3 Create import preview with sample data
- [ ] 2.6.4 Add import progress indicator
- [ ] 2.6.5 Create import error reporting UI

### 2.7 Row Management

- [ ] 2.7.1 Create `app/api/sources/datasets/[id]/rows/route.ts` (GET paginated)
- [ ] 2.7.2 Create row data table UI with pagination
- [ ] 2.7.3 Add row filtering by dimensions
- [ ] 2.7.4 Add row edit modal (optional for v1)

---

## Phase 3: Target Management

### 3.1 Target API (mirrors source pattern)

- [ ] 3.1.1 Create `app/api/targets/definitions/route.ts`
- [ ] 3.1.2 Create `app/api/targets/definitions/[id]/route.ts`
- [ ] 3.1.3 Create `app/api/targets/datasets/route.ts`
- [ ] 3.1.4 Create `app/api/targets/datasets/[id]/route.ts`
- [ ] 3.1.5 Create `app/api/targets/datasets/[id]/import/route.ts`
- [ ] 3.1.6 Create `app/api/targets/datasets/[id]/rows/route.ts`

### 3.2 Target UI

- [ ] 3.2.1 Create `/targets` page with definition list
- [ ] 3.2.2 Create `/targets/new` page with schema builder (LLM Models template)
- [ ] 3.2.3 Create target import UI (reuse source import components)
- [ ] 3.2.4 Create target row list UI

---

## Phase 4: Compatibility Engine

### 4.1 Rule Management API

- [ ] 4.1.1 Create `app/api/rules/route.ts` (GET by page, POST)
- [ ] 4.1.2 Create `app/api/rules/[id]/route.ts` (GET, PATCH, DELETE)
- [ ] 4.1.3 Install `json-logic-js` package
- [ ] 4.1.4 Create JSONLogic validation helper
- [ ] 4.1.5 Implement rule limit enforcement

### 4.2 Rule Builder UI

- [ ] 4.2.1 Create rule builder UI (field picker + operator + value)
- [ ] 4.2.2 Add required/optional toggle and weight input
- [ ] 4.2.3 Create rule list with drag-and-drop reordering
- [ ] 4.2.4 Create rule preview with sample data
- [ ] 4.2.5 Add rule templates for common patterns (Streaming Support, Tool Calling, Provider Restriction)

### 4.3 Policy Configuration

- [ ] 4.3.1 Create device policy editor UI (thresholds, required mode)
- [ ] 4.3.2 Create selection policy editor UI (aggregate mode, recommendation)
- [ ] 4.3.3 Add policy preview with sample evaluation

### 4.4 Override Management

- [ ] 4.4.1 Create `app/api/overrides/route.ts` (GET, POST, DELETE)
- [ ] 4.4.2 Create override UI (source × target grid with toggle)

### 4.5 Evaluation Engine

- [ ] 4.5.1 Implement `evaluateFeatures` function (JSONLogic per rule)
- [ ] 4.5.2 Implement `deviceVerdict` function (rules → 0/1/2)
- [ ] 4.5.3 Implement `selectionVerdict` function (aggregate devices)
- [ ] 4.5.4 Create `app/api/pages/[id]/evaluate/route.ts` (POST)
- [ ] 4.5.5 Implement result caching in `compat_results` table
- [ ] 4.5.6 Add result pagination for large target sets

---

## Phase 5: Public Pages

### 5.1 Page Management API

- [ ] 5.1.1 Create `app/api/pages/route.ts` (GET, POST)
- [ ] 5.1.2 Create `app/api/pages/[id]/route.ts` (GET, PATCH, DELETE)
- [ ] 5.1.3 Create `app/api/pages/[id]/publish/route.ts` (POST)
- [ ] 5.1.4 Implement page revision tracking
- [ ] 5.1.5 Create `app/api/pages/[id]/matrix/route.ts` (GET matrix data)

### 5.2 Page Management UI

- [ ] 5.2.1 Create `/pages` admin page with page list
- [ ] 5.2.2 Create page configuration form (source/target selection, template choice)
- [ ] 5.2.3 Create page preview functionality
- [ ] 5.2.4 Add publish button with confirmation

### 5.3 Sync to Convex (Visualization Layer)

- [ ] 5.3.1 Create Convex internal mutation `pages.internal.mutation.syncPageDisplay`
- [ ] 5.3.2 Create Convex internal mutation `pages.internal.mutation.syncOptionShards`
- [ ] 5.3.3 Create Convex internal mutation `pages.internal.mutation.syncResultCache`
- [ ] 5.3.4 Call sync from API routes after PlanetScale writes

### 5.4 Convex Queries (Read Layer)

- [ ] 5.4.1 Create `pages.query.getBySlug` (page display config)
- [ ] 5.4.2 Create `pages.query.getOptions` (dropdown options from shards)
- [ ] 5.4.3 Create `pages.query.getResult` (cached results)
- [ ] 5.4.4 Create `pages.query.getMatrixData` (matrix grid data)

### 5.5 Dropdown Generation (Finder Template)

- [ ] 5.5.1 Create `app/api/sources/dimensions/route.ts` for cascading options
- [ ] 5.5.2 Implement dimension tree builder from `source_dimension_values`
- [ ] 5.5.3 Create option shard generator for Convex sync

### 5.6 Public Page UI - Finder Template

- [ ] 5.6.1 Create `app/[domain]/[pageSlug]/page.tsx` route
- [ ] 5.6.2 Create cascading dropdown component (reads from Convex)
- [ ] 5.6.3 Create compatibility result list component
- [ ] 5.6.4 Add feature breakdown table (checkmarks per LLM)
- [ ] 5.6.5 Implement recommended LLM highlighting
- [ ] 5.6.6 Add verdict messaging (compatible/partial/incompatible)

### 5.7 Public Page UI - Matrix Template

- [ ] 5.7.1 Create matrix grid component (sources as rows, targets as columns)
- [ ] 5.7.2 Implement cell rendering with ✅/⚠️/❌ indicators
- [ ] 5.7.3 Add column grouping by provider (OpenAI, Anthropic, Meta, etc.)
- [ ] 5.7.4 Implement cell hover tooltips with feature breakdown
- [ ] 5.7.5 Add cell click detail panel
- [ ] 5.7.6 Create filter controls (by client type, provider, feature)

### 5.8 Subdomain Access

- [ ] 5.8.1 Add subdomain registration UI for paid orgs
- [ ] 5.8.2 Implement subdomain uniqueness validation
- [ ] 5.8.3 Update middleware to enforce paid-only subdomains
- [ ] 5.8.4 Create fallback page for non-existent subdomains

---

## Phase 6: Polish & Analytics

### 6.1 Analytics

- [ ] 6.1.1 Track page views in PlanetScale
- [ ] 6.1.2 Track selection queries (popular combinations)
- [ ] 6.1.3 Track matrix cell clicks
- [ ] 6.1.4 Create analytics dashboard in admin UI

### 6.2 Export

- [ ] 6.2.1 Implement CSV export for source/target data
- [ ] 6.2.2 Implement JSON export for compatibility results
- [ ] 6.2.3 Add export UI buttons

### 6.3 Embeddable Widgets

- [ ] 6.3.1 Create `/api/embed/[pageSlug]` API route
- [ ] 6.3.2 Create embeddable widget script
- [ ] 6.3.3 Add embed code generator in admin UI

### 6.4 Documentation

- [ ] 6.4.1 Update README with platform overview
- [ ] 6.4.2 Document schema definition format
- [ ] 6.4.3 Document rule syntax and examples (Streaming, Tool Calling, Provider rules)

---

## Dependencies

```
Phase 1 ──► Phase 2 ──► Phase 4 ──► Phase 5
              │              │
              └──► Phase 3 ──┘
                                    ──► Phase 6
```

- **Phase 1** (Foundation) must complete before any other phase
- **Phase 2** (Sources) and **Phase 3** (Targets) can partially parallelize
- **Phase 4** (Engine) requires Phase 2 + 3
- **Phase 5** (Public Pages) requires Phase 4
- **Phase 6** (Polish) can start incrementally after Phase 5

## Validation Checkpoints

After each phase, verify:

1. **Phase 1**: PlanetScale tables exist; middleware routes `test.localhost:3000` correctly
2. **Phase 2**: Can create AI Client schema via API, import CSV, view rows in UI
3. **Phase 3**: Can create LLM Models schema and import target data
4. **Phase 4**: Can create rules (Streaming, Tool Calling), evaluate via API, see 0/1/2 verdicts
5. **Phase 5**: Convex syncs from API; Finder shows dropdowns + results; Matrix shows grid with ✅/⚠️/❌
6. **Phase 6**: Analytics populate, exports work, embeds render
