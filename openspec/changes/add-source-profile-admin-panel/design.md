## Context

The events aggregation platform needs an admin interface to manage sources (municipal websites, PDFs, APIs) and crawler profiles (site-specific extraction configurations). Sources and profiles are already defined in the Convex schema (`sources` and `profiles` tables) but lack admin UI for CRUD operations and configuration management.

## Goals / Non-Goals

### Goals
- Provide admin UI for managing sources (create, read, update, delete, import)
- Provide admin UI for managing crawler profiles (create, edit JSON config, version tracking)
- Enable assignment of profiles to sources
- Support bulk import of sources from CSV/TSV files
- Follow existing admin patterns (similar to locations admin page)

### Non-Goals
- Automated profile generation (LLM-assisted config creation) - future enhancement
- Profile testing against live URLs - future enhancement
- Source crawl scheduling/triggering from UI - handled by workflows
- Real-time monitoring dashboards - future enhancement

## Decisions

### Decision: Separate admin pages for sources and profiles
- **What**: Create `/admin/sources` for sources list and `/admin/sources/profiles` for profiles list
- **Why**: Clear separation of concerns, allows independent management
- **Alternatives considered**: Single combined page (too cluttered), tabs on one page (less flexible)

### Decision: Profile config stored as JSON (not YAML)
- **What**: Store profile config as `v.any()` JSON in Convex, edit as JSON in UI
- **Why**: Convex doesn't have native YAML support, JSON is easier to validate/parse
- **Alternatives considered**: Store as string YAML (requires parsing), separate config fields (too rigid)

### Decision: Version tracking via incrementing version number
- **What**: Profiles have `version: v.number()` field, increment on update
- **Why**: Simple versioning without complex history table for MVP
- **Alternatives considered**: Full version history table (overkill for MVP), git-like versioning (too complex)

### Decision: Source hash computed from URL
- **What**: Use `hash` field on sources table as dedupe key (computed from URL)
- **Why**: Prevents duplicate sources with same URL, enables efficient import deduplication
- **Alternatives considered**: Use URL as unique key (URLs may change), composite key (more complex)

### Decision: Profile assignment optional (nullable profileId)
- **What**: Sources can exist without profiles (profileId optional)
- **Why**: Allows sources to be created first, profile configured later
- **Alternatives considered**: Require profile on creation (too rigid for onboarding flow)

## Risks / Trade-offs

### Risk: JSON config editor UX
- **Mitigation**: Use textarea with basic formatting, consider Monaco editor if needed
- **Trade-off**: JSON editing is less user-friendly than YAML, but more practical for Convex

### Risk: Profile deletion breaking sources
- **Mitigation**: Check for sources using profile before deletion, show warning
- **Trade-off**: Soft delete vs hard delete - use hard delete for MVP, add soft delete later if needed

### Risk: Import performance with large CSV files
- **Mitigation**: Process in batches, show progress, handle errors gracefully
- **Trade-off**: Synchronous import vs async job - use action for MVP, consider workflow later

## Migration Plan

No migration needed - this is a new feature adding UI for existing schema. Existing sources/profiles in database will be accessible via new admin interface.

## Open Questions

- Should profile config editor support schema validation (JSON Schema)? → MVP: basic JSON syntax check, add schema validation later
- Should we allow bulk profile assignment? → Future enhancement
- Should source deletion cascade to docs/events? → Future enhancement, MVP: allow deletion, handle orphans in cleanup job

