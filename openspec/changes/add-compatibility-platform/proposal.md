# Change: Add Compatibility Platform

## Why

Flickerify is a **multi-tenant compatibility checker SaaS**. The platform allows organizations to create custom compatibility pages where end-users can check if products/items are compatible with their requirements.

**MVP Domain: LLM Compatibility** — The initial use case is "Website/Software ↔ LLM" compatibility checking. Organizations can create pages where users check which LLM models (GPT-4.1, Claude 3.7, Llama 3.3, etc.) are compatible with their AI-powered applications, websites, or tools.

This addresses a gap in the market: while vertical solutions exist, there's no horizontal platform that lets any business create schema-driven compatibility checkers with:

- Custom data schemas (sources and targets)
- Configurable compatibility rules
- Multi-state verdicts (compatible, partial, incompatible)
- Public-facing compatibility pages with subdomain routing
- **Matrix-based visualization** for cross-referencing many sources against many targets

## What Changes

### New Capabilities

1. **Multi-Tenancy** (`multi-tenancy`)
   - WorkOS organizations serve as tenants
   - Subdomain routing for paid organizations (`company.flickerify.com`)
   - Personal organizations have usage limits
   - Data isolation per organization

2. **Source Management** (`source-management`)
   - Dynamic schema definitions (JSON-based)
   - Sources = AI clients/websites/software (e.g., t3.chat, custom apps)
   - Fields: clientType, needsStreaming, needsToolCalling, needsStructuredOutputs, region, maxLatencyMs
   - CSV/JSON/API imports with column mapping
   - Versioned datasets (revisions)

3. **Target Management** (`target-management`)
   - Targets = LLM models/providers (e.g., GPT-4.1, Claude 3.7 Sonnet, Llama 3.3)
   - Fields: provider, supportsStreaming, supportsToolCalling, supportsStructuredOutputs, maxTokens, costPer1kTokens
   - Schema definitions, imports, versioning

4. **Compatibility Engine** (`compatibility-engine`)
   - JSONLogic-based feature rules
   - Example rules: "Streaming Support", "Tool Calling Required", "OpenAI Provider Only"
   - Device policies (per-target verdict calculation)
   - Selection policies (aggregate across targets)
   - Manual overrides
   - Multi-state verdicts: 0 (incompatible), 1 (partial), 2 (fully compatible)

5. **Public Pages** (`public-pages`)
   - **Two templates**:
     - **Finder**: Dropdown-based selection (single source → multiple targets)
     - **Matrix**: Grid-based display (many sources × many targets)
   - Subdomain-based routing using [vercel/platforms](https://github.com/vercel/platforms) pattern
   - Compatibility result matrix display with ✅ / ⚠️ / ❌ indicators
   - Embeddable widgets

### **BREAKING** Changes

- Existing `(app)` routes will be repurposed for the compatibility admin dashboard
- Database schema changes (new tables, modified tables)

### Preserved

- WorkOS AuthKit authentication
- UI component library (shadcn/ui)
- User/organization management (WorkOS → Convex sync)

### Architecture Split

- **PlanetScale** = System of record (all business data, computation)
- **Convex** = Visualization cache (read-optimized data for frontend)
- **Next.js API Routes** = Business logic (CRUD, imports, evaluation)

## Impact

### Affected Specs

- None yet (no existing specs)

### Affected Code

**Routes to Add:**

- `app/(app)/sources/` — Source schema and data management
- `app/(app)/targets/` — Target schema and data management
- `app/(app)/rules/` — Compatibility rules builder
- `app/(app)/pages/` — Public page configuration
- `app/[domain]/` — Multi-tenant public pages
- `app/api/sources/*` — Source management APIs
- `app/api/targets/*` — Target management APIs
- `app/api/rules/*` — Rule management APIs
- `app/api/pages/*` — Page management APIs

**PlanetScale Changes (System of Record):**

- New tables: `source_definitions`, `source_datasets`, `source_rows`, `source_dimension_values`, `source_imports`, `target_definitions`, `target_datasets`, `target_rows`, `feature_rules`, `overrides`, `public_pages`, `compat_results`, `option_index`
- Modified tables: `organizations` (add `plan_tier`, `custom_subdomain`)

**Convex Changes (Visualization Cache):**

- New tables: `optionShards` (dropdown cache), `resultCache` (compatibility results), `pageDisplays` (page metadata)
- Modified tables: `organizations` (add `planTier`, `customSubdomain`)
- New queries: `pages.query.getBySlug`, `pages.query.getOptions`, `pages.query.getResult`
- New internal mutations: sync helpers called by API routes

### Dependencies

- [vercel/platforms](https://github.com/vercel/platforms) — Multi-tenant subdomain routing pattern
- `json-logic-js` — Rule evaluation engine
- Existing: Convex, WorkOS, Drizzle/PlanetScale

## Success Criteria

1. A user can create a source schema (AI Clients) and import data (t3.chat, custom apps)
2. A user can create a target schema (LLM Models) and import data (GPT-4.1, Claude 3.7, Llama 3.3)
3. A user can define compatibility rules between sources and targets (streaming, tool calling, provider restrictions)
4. A public page displays either:
   - **Finder**: Dropdowns for client selection → compatible LLM list
   - **Matrix**: Grid showing all clients × all LLMs with ✅ / ⚠️ / ❌
5. Paid organizations can access via custom subdomains
6. Personal organizations have enforced usage limits

## MVP Example: LLM Compatibility Page

**Source schema** (AI Client):
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

**Target schema** (LLM Model):
```json
{
  "id": "gpt-4.1",
  "displayName": "GPT-4.1",
  "provider": "openai",
  "supportsStreaming": true,
  "supportsToolCalling": true,
  "supportsStructuredOutputs": true,
  "primaryRegion": "global",
  "maxTokens": 128000
}
```

**Feature rule** (Streaming Support):
```json
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
```

**Matrix Display**:
```
| Client / LLM | GPT-4.1 | GPT-4.1 mini | Claude 3.7 | Llama 3.3 |
|--------------|---------|--------------|------------|-----------|
| t3.chat      | ✅      | ✅           | ✅         | ⚠️        |
| MyApp        | ✅      | ✅           | ❌         | ❌        |
| Customer X   | ✅      | ✅           | ✅ (⚠️)    | ❌        |
```

## Risks & Mitigations

| Risk                                            | Mitigation                                           |
| ----------------------------------------------- | ---------------------------------------------------- |
| Large cartesian computation (sources × targets) | Lazy evaluation + caching; precompute only hot paths |
| Convex 1MB document limit                       | Shard results into pages; use dictionary encoding    |
| Complex rule configurations                     | Provide templates; limit rule complexity             |

## Timeline

- **Phase 1**: Multi-tenancy foundation + source management (2-3 weeks)
- **Phase 2**: Target management + compatibility engine (2-3 weeks)
- **Phase 3**: Public pages + subdomain routing (1-2 weeks)
- **Phase 4**: Polish, analytics, embeddable widgets (ongoing)

## References

- [vercel/platforms](https://github.com/vercel/platforms) — Next.js multi-tenant example
- [JSONLogic](https://jsonlogic.com/) — Rule evaluation library
- ChatGPT architecture discussion (see conversation history)
