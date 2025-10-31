## 1. Convex Functions - Sources

- [ ] 1.1 Create `convex/sources/query.ts` with admin-protected queries:
  - `listSources` - List all sources with optional filters (enabled, locationId, entityType)
  - `getSource` - Get single source by ID with related profile and location data
  - `getSourceStats` - Get source statistics (doc count, last fetch, run history)

- [ ] 1.2 Create `convex/sources/mutation.ts` with admin-protected mutations:
  - `createSource` - Create new source (url, name, entityType, locationId, lang, enabled, notes)
  - `updateSource` - Update source fields (validate URL, update hash on URL change)
  - `deleteSource` - Delete source (with cascade check for docs/events if needed)
  - `toggleSourceEnabled` - Enable/disable source
  - `assignProfileToSource` - Link profile to source

- [ ] 1.3 Create `convex/sources/action.ts` with admin-protected action:
  - `importSourcesFromText` - Parse CSV/TSV (similar to locations import), create/update sources, handle duplicates by URL hash

## 2. Convex Functions - Profiles

- [ ] 2.1 Create `convex/profiles/query.ts` with admin-protected queries:
  - `listProfiles` - List all profiles with optional filters (enabled, domain, lang)
  - `getProfile` - Get single profile by ID with version history
  - `getSourcesByProfile` - List all sources using a specific profile

- [ ] 2.2 Create `convex/profiles/mutation.ts` with admin-protected mutations:
  - `createProfile` - Create new profile (siteId, domain, lang, timezone, config JSON, enabled, notes)
  - `updateProfile` - Update profile (increment version, validate config structure)
  - `deleteProfile` - Delete profile (check for sources using it)
  - `toggleProfileEnabled` - Enable/disable profile

## 3. Admin UI - Sources List Page

- [ ] 3.1 Create `app/admin/sources/page.tsx`:
  - Table/list view of sources with columns: URL, Name, Location, Entity Type, Language, Profile, Enabled, Last Fetch
  - Filters: enabled status, location (dropdown), entity type, language
  - Actions: Create Source button, Bulk Import button, Edit/Delete per row
  - Pagination or infinite scroll

- [ ] 3.2 Add source list components:
  - `components/admin/sources/SourceList.tsx` - Main table component
  - `components/admin/sources/SourceFilters.tsx` - Filter controls
  - `components/admin/sources/SourceRow.tsx` - Individual row with actions

## 4. Admin UI - Source Detail/Create Page

- [ ] 4.1 Create `app/admin/sources/new/page.tsx` - Create source form:
  - Form fields: URL (required), Name, Entity Type (dropdown), Location (search/select), Language (dropdown), Enabled (checkbox), Notes (textarea)
  - Validation: URL format, required fields
  - Submit creates source via mutation

- [ ] 4.2 Create `app/admin/sources/[id]/page.tsx` - Source detail/edit page:
  - Display source details (read-only sections: hash, lastFetchAt, etag, lastModified)
  - Editable form for: URL, Name, Entity Type, Location, Language, Enabled, Notes
  - Profile assignment section (dropdown to select profile, or link to create profile)
  - Related data: Recent docs count, recent runs, associated events count
  - Actions: Save changes, Delete source (with confirmation), Test crawl (future)

## 5. Admin UI - Profiles List Page

- [ ] 5.1 Create `app/admin/sources/profiles/page.tsx`:
  - Table/list view of profiles with columns: Site ID, Domain, Language, Timezone, Version, Enabled, Sources Count
  - Filters: enabled status, domain, language
  - Actions: Create Profile button, Edit/Delete per row

- [ ] 5.2 Add profile list components:
  - `components/admin/sources/ProfileList.tsx` - Main table component
  - `components/admin/sources/ProfileFilters.tsx` - Filter controls
  - `components/admin/sources/ProfileRow.tsx` - Individual row with actions

## 6. Admin UI - Profile Detail/Create Page

- [ ] 6.1 Create `app/admin/sources/profiles/new/page.tsx` - Create profile form:
  - Form fields: Site ID (required), Domain (required), Language (dropdown), Timezone (default: Europe/Zurich), Enabled (checkbox), Notes
  - JSON config editor (textarea or Monaco editor) with basic validation
  - Default config template with placeholders
  - Submit creates profile via mutation

- [ ] 6.2 Create `app/admin/sources/profiles/[id]/page.tsx` - Profile detail/edit page:
  - Display profile details (read-only: version, createdAt, updatedAt)
  - Editable form for: Site ID, Domain, Language, Timezone, Enabled, Notes
  - JSON config editor with syntax highlighting and validation
  - Related sources section (list sources using this profile)
  - Actions: Save changes (creates new version), Delete profile (with confirmation), Test profile (future)

## 7. Integration & Navigation

- [ ] 7.1 Update `app/admin/page.tsx`:
  - Add "Sources & Profiles" admin card linking to `/admin/sources`

- [ ] 7.2 Update `app/admin/layout.tsx`:
  - Add "Sources" navigation link in header

- [ ] 7.3 Add loading states and error handling:
  - Loading spinners for queries
  - Error messages for failed mutations
  - Success toasts for successful operations

## 8. Validation & Testing

- [ ] 8.1 Manual testing:
  - Create source with valid URL
  - Create profile and assign to source
  - Import sources from CSV/TSV
  - Edit source and profile
  - Delete source and profile (verify cascades)
  - Test admin guard (non-admin users redirected)

- [ ] 8.2 Validate Convex functions:
  - Test queries with filters
  - Test mutations with validation errors
  - Test import action with malformed CSV

