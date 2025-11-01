# Project Context

## Purpose

Flickerify is an event discovery and aggregation platform built with Convex + Next.js. The application aggregates events from multiple sources (web scraping, PDFs, HTML, ICS files, APIs) across multiple countries and languages, normalizes them into a unified event schema, and provides personalized alerts to users. The system includes an admin panel for managing sources, locations, and scraper configurations, with support for multi-language content extraction and geospatial filtering.

## Tech Stack

- **Next.js 16.0.1** (App Router) + **React 19.2.0**
- **TypeScript 5.9.3** (strict mode)
- **Convex 1.28.0** (database, queries/mutations/actions, workflows)
- **WorkOS AuthKit** (`@workos-inc/authkit-nextjs` 2.10.0) for authentication (redirect-based)
- **Tailwind CSS 4.1.16** with PostCSS and `tw-animate-css`
- **Shadcn UI** components built on Radix UI primitives
- **TanStack Form** (`@tanstack/react-form` 1.23.8) with Zod validation
- **Hono 4.10.4** for HTTP routes (via `convex-helpers/server/hono`)
- **Convex R2** (`@convex-dev/r2`) for document storage (HTML/PDF files, parsed JSONL)
- **Convex Workflows** (`@convex-dev/workflow`) for async processing pipelines
- **Convex Workpool** (`@convex-dev/workpool`) for parallel processing
- **Convex Rate Limiter** (`@convex-dev/rate-limiter`) for rate limiting
- **convex-helpers** for custom function wrappers and row-level security
- **class-variance-authority (CVA)**, Radix Slot, `clsx`, `tailwind-merge` for UI composition
- **ESLint 9.38.0** with `next/core-web-vitals` + TypeScript config
- **Prettier 3.6.2**
- **Bun 1.3.1** (preferred package manager for faster installs)

## Project Conventions

### Code Style

- TypeScript strict mode enabled; prefer explicit types for public APIs and Convex validators for args/returns.
- Formatting via Prettier (`singleQuote: true`, `semi: true`, `printWidth: 120`, `trailingComma: 'all'`).
- ESLint extends Next.js core web vitals + TypeScript; fix lints before commit.
- Path alias `@/*` → project root per `tsconfig.json`.

### Architecture Patterns

- **Next.js App Router** with `app/` directory structure; server components by default, client components use `'use client'`.
- **Convex backend organization** (`convex/`):
  - `schema.ts` defines all tables, validators, and indexes (e.g., `users` with `by_email`, `by_external_id`).
  - Functions use Convex function syntax with `args` and `returns` validators (required for all functions).
  - Custom function wrappers in `convex/functions.ts`:
    - `publicQuery`, `publicMutation`, `publicAction` - no auth required
    - `protectedQuery`, `protectedMutation`, `protectedAction` - requires authenticated user
    - `protectedAdminQuery`, `protectedAdminMutation`, `protectedAdminAction` - requires admin role
    - `internalQuery`, `internalMutation`, `internalAction` - internal-only functions
  - Domain-organized functions: `convex/{domain}/{query|mutation|action}.ts` with `internal/` subdirectories for private helpers.
  - Admin functions in `{domain}/admin/` subdirectories (e.g., `convex/users/admin/mutation.ts`).
  - HTTP routes defined in `convex/http.ts` using Hono; controllers in `convex/controllers/`.
  - Row-level security (RLS) framework via `convex-helpers/server/rowLevelSecurity` (currently placeholder implementation).
- **Authentication via WorkOS AuthKit**:
  - AuthKit middleware protects routes (configured via `@workos-inc/authkit-nextjs`).
  - Client auth context via `AuthKitProvider` and `ConvexProviderWithAuth` in `components/ConvexClientProvider.tsx`.
  - Convex auth configured in `convex/auth.config.ts` using WorkOS custom JWT providers (RS256, JWKS).
  - User synchronization via WorkOS webhooks (`convex/workos/webhooks/`).
- **Admin panel** (`app/admin/`):
  - Protected by `AdminGuard` component checking user role.
  - Routes: `/admin` (dashboard), `/admin/locations`, `/admin/sources`, `/admin/sources/[sourceId]`, `/admin/sources/new`.
- **Styling**: Tailwind CSS 4 with CSS variables in `app/globals.css`; theme supports light/dark modes via `:root`/`.dark` tokens.

### Testing Strategy

- Manual testing via `bun run dev` running Next and Convex in parallel.
- Add unit tests (TBD) for Convex functions and React components as the app grows; prefer lightweight testing (Vitest/React Testing Library) and Convex test helpers when introduced.

### Git Workflow

- Main branch tracks deployable state.
- Conventional commits are recommended (e.g., `feat:`, `fix:`). Small PRs with focused scope.

## Domain Context

### Core Entities

- **Users**: Managed via WorkOS; Convex `users` table stores `email`, `externalId`, `firstName`, `lastName`, `emailVerified`, `role` (USER/ADMIN), `homeLat/Lng`, `kidsAges`, `preferredLocale`, `expoPushToken`. Indexed by `email` and `externalId`.
- **Locations**: Normalized administrative regions (countries, regions, sub-regions) with geocoding (lat/lng, geohash), timezone, language, and external IDs (e.g., BFS codes for Switzerland). Supports CSV import with country-specific configurations.
- **Sources**: Event source URLs (PDFs, HTML, ICS, APIs, manual) linked to locations and profiles, with fetch metadata (etag, lastModified) and deduplication via URL hash.
- **Profiles**: Scraper configurations (YAML-like JSON) per site/domain with selectors, pagination rules, and detail page extraction patterns.
- **Events**: Language-neutral event facts (time, place, category, price, geolocation) with content hash for deduplication. Separated from localized text (`event_i18n` table).
- **Alerts**: User-defined event filters (radius, categories, age range, days ahead) with notification cadence (hourly/daily/weekly).

### Data Pipeline

1. **Ingestion**: Sources → `docs` table (raw HTML/PDF stored in R2) → `parsed` table (extracted text blocks in JSONL format in R2).
2. **Extraction**: Parsed content → `details_queue` → event extraction → `events` + `event_i18n` tables.
3. **Verification**: Low-confidence events → `reviews` table for human review.
4. **Observability**: `runs` table tracks pipeline execution (crawl, parse, extract, notify, repair workflows).

### Multi-language Support

- Events stored as language-neutral facts (`events`) with localized text in `event_i18n` (DE, FR, IT, RM, EN).
- Text origin tracking (`source`, `machine`, `human`) for quality assessment.
- Language detection and OCR support for PDF extraction.

## Important Constraints

- **Environment variables**: Secrets and config via `.env.local` (e.g., `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, `WORKOS_COOKIE_PASSWORD`, `NEXT_PUBLIC_CONVEX_URL`, R2 credentials).
- **Authentication**: WorkOS-hosted redirects and JWT validation; cookies and sessions managed by AuthKit middleware. Convex functions receive auth context via `ctx.auth.getUserIdentity()`.
- **Convex function validators**: ALL functions MUST define `args` and `returns` validators using `v.*` validators. Functions without returns must use `returns: v.null()`.
- **Database queries**: Always query via indexes; avoid `filter()` scans in production paths. Use search indexes for full-text search (e.g., `locations.search_city`).
- **Function references**: Use `api.{domain}.{function}` for public functions, `internal.{domain}.{function}` for internal functions. File-based routing matches directory structure.
- **Storage**: Large documents (HTML/PDF) and parsed content stored in Convex R2, referenced by `r2Key` in `docs` and `parsed` tables.
- **Admin access**: Routes under `/admin/*` require `role: 'admin'` checked via `AdminGuard` component and `protectedAdmin*` function wrappers.
- **Geospatial queries**: Use geohash indexes (`geohash5` for regional buckets, `geohash7` for radius prefilters) for efficient location-based queries.

## External Dependencies

### Core Platform

- **WorkOS AuthKit** (`@workos-inc/authkit-nextjs`, `@workos-inc/node`) for authentication, user management, and session handling.
- **Convex Cloud** for database, serverless function execution, R2 storage, and workflows.
- **Vercel/Next.js** (implied) for frontend hosting and deployment.

### UI & Forms

- **Radix UI** primitives (accordion, alert-dialog, avatar, checkbox, dialog, dropdown-menu, label, popover, select, tabs, tooltip, etc.) for accessible components.
- **Shadcn UI** component library built on Radix.
- **TanStack Form** (`@tanstack/react-form`) with Zod (`zod`) for form validation.
- **class-variance-authority (CVA)**, Radix Slot, `clsx`, `tailwind-merge` for UI composition and styling utilities.

### Utilities

- **date-fns** for date manipulation and formatting.
- **slugify** for URL-friendly strings.
- **sonner** for toast notifications.
- **lucide-react** for icons.
- **next-themes** for theme management (light/dark mode).
- **recharts** for data visualization.
- **cmdk** for command palette UI.
- **input-otp** for OTP input components.
