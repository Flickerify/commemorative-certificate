## Why

As the events aggregation platform scales, administrators need a centralized interface to manage event sources (municipal websites, PDFs, APIs) and their associated crawler profiles (site-specific extraction configurations). Currently, sources and profiles exist in the Convex schema but lack admin UI for CRUD operations, configuration editing, and monitoring. This admin panel will enable admins to onboard new sources, configure crawler profiles, test extraction rules, and monitor source health without requiring database access.

## What Changes

- **ADDED**: Source management admin interface (`/admin/sources`)
  - List all sources with filtering by enabled status, location, entity type
  - Create new sources with URL, name, location, language, entity type
  - Edit existing sources (update URL, enable/disable, assign profile, notes)
  - Delete sources (with confirmation)
  - View source details (last fetch time, ETag, doc counts, run history)
  - Bulk import sources from CSV/TSV files

- **ADDED**: Profile management admin interface (`/admin/sources/profiles`)
  - List all crawler profiles with filtering by enabled status, domain, language
  - Create new profiles with site ID, domain, language, timezone, and JSON config
  - Edit profile configurations (YAML-style JSON editor with validation)
  - Version profiles (track changes, rollback)
  - Test profile against live URL (preview extraction results)
  - Assign profiles to sources

- **ADDED**: Integrated source-profile relationship management
  - Assign/unassign profiles to sources from source detail page
  - Create profile from source (pre-fill domain, language from source)
  - View all sources using a specific profile

- **ADDED**: Convex functions for source and profile CRUD operations
  - Admin-protected queries: `listSources`, `getSource`, `listProfiles`, `getProfile`
  - Admin-protected mutations: `createSource`, `updateSource`, `deleteSource`, `createProfile`, `updateProfile`, `deleteProfile`, `assignProfileToSource`
  - Admin action: `importSourcesFromText` (CSV/TSV import similar to locations)

## Impact

- **Affected specs**: New capabilities (`source-management`, `profile-management`)
- **Affected code**:
  - New admin pages: `app/admin/sources/page.tsx`, `app/admin/sources/profiles/page.tsx`, `app/admin/sources/[id]/page.tsx`
  - New Convex functions: `convex/sources/` (queries, mutations, actions)
  - New Convex functions: `convex/profiles/` (queries, mutations)
  - Updated admin dashboard: `app/admin/page.tsx` (add Sources card)
  - Updated admin layout: `app/admin/layout.tsx` (add Sources navigation link)

