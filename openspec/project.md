# Project Context

## Purpose

Flickerify is a full-stack application that provides user and organization management with WorkOS AuthKit authentication. It synchronizes identity data between WorkOS, Convex (real-time database), and PlanetScale (relational database) to support a multi-database architecture where Convex handles real-time features and PlanetScale handles relational queries.

## Tech Stack

### Frontend

- **Next.js 16** – App Router with route groups `(app)`, `(onboarding)`, `admin`
- **React 19** – UI framework
- **Tailwind CSS 4** – Styling (using `tw-animate-css`)
- **shadcn/ui** – Component library built on Radix UI
- **Radix UI** – Accessible primitives (`@radix-ui/themes`)
- **Lucide React** – Icons
- **Recharts** – Charting library
- **TanStack Table** – Data tables
- **TanStack Form** – Form management with Zod adapter

### Backend

- **Convex** – Real-time database, serverless functions, and file storage
- **Convex Workflows** – Durable multi-step workflows with `@convex-dev/workflow`
- **Hono** – HTTP routing for Convex endpoints (via `convex-helpers`)
- **PlanetScale** – PostgreSQL-compatible relational database
- **Drizzle ORM** – Type-safe SQL queries for PlanetScale (`drizzle-orm`, `drizzle-kit`)
- **WorkOS AuthKit** – Authentication, SSO, and organization management

### Tooling

- **TypeScript 5.9** – Strict type checking
- **Bun** – Package manager and runtime
- **ESLint + Prettier** – Code quality and formatting
- **OpenSpec** – Spec-driven development and change management
- **t3-oss/env-nextjs** – Type-safe environment variables with Zod

## Project Conventions

### Code Style

- **TypeScript strict mode** enabled throughout
- **British English spelling** for domain terms: `organisations`, `organisationDomains`
- **Readonly props** for React components: `{ readonly children: ReactNode }`
- **Single quotes** for strings, **trailing commas** enabled
- **Explicit return validators** on all Convex functions
- **Kebab-case** for file/folder names, **PascalCase** for components, **camelCase** for functions/variables

### Architecture Patterns

#### Directory Structure

```
app/                    # Next.js App Router
├── (app)/             # Authenticated routes (sidebar layout + onboarding guard)
│   ├── layout.tsx     # Uses OnboardingGuard, AppSidebar, SiteHeader
│   ├── account/       # User account settings
│   ├── analytics/     # Analytics dashboard
│   ├── billing/       # Billing management
│   ├── certificates/  # Certificates page
│   ├── collaborators/ # Collaborators management
│   ├── integrations/  # Integrations settings
│   ├── organization/  # Organization settings
│   ├── settings/      # App settings
│   └── templates/     # Templates management
├── (onboarding)/      # Onboarding flow (minimal layout, no sidebar)
│   ├── layout.tsx     # Gradient background, no sidebar
│   └── onboarding/    # Onboarding wizard
├── admin/             # Admin-only routes
│   └── sync/          # Sync status monitoring
├── callback/          # Auth callback handlers
├── sign-in/           # Auth routes (route handlers)
└── sign-up/

convex/                # Convex backend
├── controllers/       # HTTP endpoint controllers (Hono)
├── functions.ts       # Custom query/mutation/action builders
├── schema.ts          # Database schema
├── types/             # TypeScript type definitions
├── workflows/         # Multi-step sync workflows (Convex Workflows)
│   └── syncToPlanetScale.ts
├── workos/            # WorkOS webhook handlers
│   ├── internal/      # Internal actions (verifyWebhook, updateUserMetadata)
│   └── webhooks/      # Webhook handlers by entity
└── [domain]/          # Domain-specific modules
    ├── internal/      # Internal functions (mutations, queries, actions)
    ├── action.ts      # Public actions
    └── query.ts       # Public queries

components/            # React components
├── ui/                # shadcn/ui primitives
├── onboarding-guard.tsx  # Redirects non-onboarded users
└── *.tsx              # Feature components

db/                    # Drizzle/PlanetScale
├── schema/            # Table definitions (users.ts, organizations.ts)
└── index.ts           # Database connection
```

#### Convex Function Organization

- **Public functions** in `convex/[domain]/query.ts`, `convex/[domain]/mutation.ts`, or `convex/[domain]/action.ts`
- **Internal functions** in `convex/[domain]/internal/query.ts`, `mutation.ts`, or `action.ts`
- Use custom builders from `convex/functions.ts`:
  - `protectedQuery` / `protectedMutation` / `protectedAction` – Requires authenticated user
  - `protectedAdminQuery` / `protectedAdminMutation` / `protectedAdminAction` – Requires admin role
  - `publicQuery` / `publicMutation` / `publicAction` – No auth required
  - `internalQuery` / `internalMutation` / `internalAction` – Internal only

#### Dual Database Pattern

1. **Convex** – Primary for real-time data, user sessions, and reactive queries
2. **PlanetScale** – Secondary for complex relational queries and legacy integrations
3. **Sync workflows** – Convex Workflows that sync data from Convex → PlanetScale with retry logic

#### Workflow Pattern

Sync operations use `@convex-dev/workflow` for durability:

- `kickoff*` mutations start workflows and initialize `syncStatus`
- Workflows run steps with retry configuration
- `onComplete` handler updates `syncStatus` with results
- `syncStatus` table tracks history per entity

### Testing Strategy

- Unit tests for utility functions
- Integration tests for Convex functions using Convex test framework
- E2E tests for critical user flows
- Manual testing via Convex dashboard and admin sync page (`/admin/sync`)

### Git Workflow

- **Main branch** – Production-ready code
- **Feature branches** – `feature/[change-id]` or `fix/[issue-id]`
- **Commit messages** – Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`
- **OpenSpec** for significant changes requiring specs

## Domain Context

### User Management

- Users are created/updated via WorkOS webhooks
- Each user has a `role` (admin/user) and `externalId` (WorkOS ID)
- **Metadata** stored in `metadata: Record<string, string>`:
  - `onboardingComplete` – `'true'` or `'false'` (string)
  - `preferredLocale` – Language code (`de`, `fr`, `it`, `rm`, `en`)
  - Any other custom string fields from WorkOS
- WorkOS is the source of truth for metadata; updates go to WorkOS first, then webhook syncs to Convex
- Optional `expoPushToken` for mobile push notifications

### Onboarding Flow

- New users have `metadata.onboardingComplete = 'false'`
- `OnboardingGuard` component wraps authenticated routes
- Non-onboarded users are redirected to `/onboarding`
- Onboarding wizard allows language selection
- `completeOnboarding` action:
  1. Updates Convex immediately (fast UX)
  2. Syncs to WorkOS (webhook confirms)

### Organization Management

- Organizations are synced from WorkOS
- Each org has `externalId`, `name`, and optional `metadata`
- Domains can be verified for SSO (`organizationDomains` table)
- Memberships link users to organizations with roles (`organizationMemberships` table)

### Sync Status Tracking

- `syncStatus` table tracks sync operations to PlanetScale
- Status values: `pending`, `success`, `failed`
- Tracks `webhookEvent`, `workflowId`, `startedAt`, `completedAt`, `durationMs`
- History is kept per entity (new record per sync, not overwritten)
- Admin page at `/admin/sync` displays grouped sync history

### Hard Deletion (GDPR)

- User deletion cascades: memberships → user → PlanetScale
- Org deletion cascades: domains → memberships → org → PlanetScale
- Workflows handle deletion order: PlanetScale first, then Convex

## Important Constraints

### Authentication

- All authenticated routes require WorkOS session via `authkitMiddleware`
- Admin routes require `role: 'admin'` in Convex user record
- Use `<Authenticated>` wrapper for client-side auth gating
- Use `<OnboardingGuard>` to enforce onboarding completion

### Database Sync

- Convex is the source of truth for real-time data
- WorkOS is the source of truth for user metadata
- PlanetScale syncs are eventually consistent (background workflows)
- Never write directly to PlanetScale from frontend; always go through Convex

### Performance

- Mutations should complete in <500ms
- Use optimistic updates for better UX (e.g., update Convex immediately, sync to WorkOS async)
- Virtualize large lists (use `virtua`)

### Accessibility

- Follow WAI-ARIA APG patterns
- Minimum hit target 24px (44px on mobile)
- Honor `prefers-reduced-motion`
- Never disable browser zoom

## External Dependencies

### WorkOS

- **AuthKit** – Redirect-based authentication (`@workos-inc/authkit-nextjs`)
- **Webhooks** – `user.created`, `user.updated`, `user.deleted`, `organization.*`, `organization_membership.*`, `organization_domain.*`
- **SDK** – `@workos-inc/node` for server-side API calls
- **Widgets** – `@workos-inc/widgets` for UI components
- **Metadata** – All values stored as strings in WorkOS

### Convex

- **Cloud** – Managed deployment at `convex.cloud`
- **Dev components**:
  - `@convex-dev/workflow` – Durable workflows with retry
  - `@convex-dev/workpool` – Background job processing
  - `@convex-dev/rate-limiter` – Rate limiting
  - `@convex-dev/r2` – R2 storage integration
  - `@convex-dev/crons` – Scheduled jobs

### PlanetScale

- **Serverless driver** – `@planetscale/database`
- **Connection** – Via Drizzle ORM with PostgreSQL dialect
- **Tables**: `users`, `organizations` (id mapping only: workosId, convexId, timestamps)

### Environment Variables

Required in `.env.local`:

```
# Convex
CONVEX_DEPLOYMENT=
NEXT_PUBLIC_CONVEX_URL=

# WorkOS
WORKOS_CLIENT_ID=
WORKOS_API_KEY=
WORKOS_COOKIE_PASSWORD=
WORKOS_WEBHOOK_SECRET=

# PlanetScale (Drizzle)
DATABASE_HOST=
DATABASE_USER=
DATABASE_PASSWORD=
DATABASE_NAME=
```

## Database Schema

### Convex Tables

- **users** – `email`, `externalId`, `firstName`, `lastName`, `emailVerified`, `profilePictureUrl`, `role`, `metadata`, `expoPushToken`, `updatedAt`
- **organizations** – `externalId`, `name`, `metadata`, `updatedAt`
- **organizationDomains** – `organizationId`, `externalId`, `domain`, `status`, `updatedAt`
- **organizationMemberships** – `organizationId`, `userId`, `role`, `status`, `updatedAt`
- **syncStatus** – `entityType`, `entityId`, `targetSystem`, `status`, `webhookEvent`, `workflowId`, `startedAt`, `completedAt`, `durationMs`, `error`

### PlanetScale Tables

- **users** – `id`, `workosId`, `convexId`, `updatedAt`, `createdAt`
- **organizations** – `id`, `workosId`, `convexId`, `updatedAt`, `createdAt`

## Supported Languages

- German (de)
- French (fr)
- Italian (it)
- Romansh (rm)
- English (en)
