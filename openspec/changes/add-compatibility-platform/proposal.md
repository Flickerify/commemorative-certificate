# Change: Add Compatibility Platform

## Why

Flickerify is pivoting from a certificate platform to a **multi-tenant compatibility checker SaaS**. The platform allows organizations to create custom compatibility pages where end-users can check if products/items are compatible with their requirements (e.g., "Is this OBD device compatible with my vehicle?").

This addresses a gap in the market: while vertical solutions exist (vehicle fitment tools, printer/cartridge finders), there's no horizontal platform that lets any business create schema-driven compatibility checkers with:

- Custom data schemas (sources and targets)
- Configurable compatibility rules
- Multi-state verdicts (compatible, partial, incompatible)
- Public-facing compatibility pages with subdomain routing

## What Changes

### New Capabilities

1. **Multi-Tenancy** (`multi-tenancy`)
   - WorkOS organizations serve as tenants
   - Subdomain routing for paid organizations (`company.flickerify.com`)
   - Personal organizations have usage limits
   - Data isolation per organization

2. **Source Management** (`source-management`)
   - Dynamic schema definitions (JSON-based)
   - Unlimited dimensions for cascading dropdowns
   - CSV/JSON/API imports with column mapping
   - Versioned datasets (revisions)

3. **Target Management** (`target-management`)
   - Same pattern as sources (products being checked for compatibility)
   - Schema definitions, imports, versioning

4. **Compatibility Engine** (`compatibility-engine`)
   - JSONLogic-based feature rules
   - Device policies (per-target verdict calculation)
   - Selection policies (aggregate across targets)
   - Manual overrides
   - Multi-state verdicts: 0 (incompatible), 1 (partial), 2 (fully compatible)

5. **Public Pages** (`public-pages`)
   - Subdomain-based routing using [vercel/platforms](https://github.com/vercel/platforms) pattern
   - Cascading dropdown UI from source dimensions
   - Compatibility result matrix display
   - Embeddable widgets

### **BREAKING** Changes

- Certificate-related routes and components will be removed
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

**Routes to Remove:**

- `app/(app)/certificates/`
- `app/(app)/templates/`
- `app/(app)/analytics/` (repurpose for compatibility analytics)

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

1. A user can create a source schema (e.g., Vehicle YMME) and import data
2. A user can create a target schema (e.g., OBD devices) and import data
3. A user can define compatibility rules between sources and targets
4. A public page displays cascading dropdowns and compatibility results
5. Paid organizations can access via custom subdomains
6. Personal organizations have enforced usage limits

## Risks & Mitigations

| Risk                                            | Mitigation                                           |
| ----------------------------------------------- | ---------------------------------------------------- |
| Large cartesian computation (sources × targets) | Lazy evaluation + caching; precompute only hot paths |
| Convex 1MB document limit                       | Shard results into pages; use dictionary encoding    |
| Complex rule configurations                     | Provide templates; limit rule complexity             |
| Data migration from certificate platform        | Clean break; no data migration needed                |

## Timeline

- **Phase 1**: Multi-tenancy foundation + source management (2-3 weeks)
- **Phase 2**: Target management + compatibility engine (2-3 weeks)
- **Phase 3**: Public pages + subdomain routing (1-2 weeks)
- **Phase 4**: Polish, analytics, embeddable widgets (ongoing)

## References

- [vercel/platforms](https://github.com/vercel/platforms) — Next.js multi-tenant example
- [JSONLogic](https://jsonlogic.com/) — Rule evaluation library
- ChatGPT architecture discussion (see conversation history)
