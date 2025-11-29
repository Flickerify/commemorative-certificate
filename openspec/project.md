# Project Context

## Purpose

Flickerify is a full-stack application that provides user and organization management with WorkOS AuthKit authentication. It synchronizes identity data between WorkOS, Convex (real-time database), and PlanetScale (relational database) to support a multi-database architecture where Convex handles real-time features and PlanetScale handles relational queries.

## Tech Stack

### Frontend

- **Next.js 16** – App Router with route groups
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
- **Hono** – HTTP routing for Convex endpoints (via `convex-helpers`)
- **PlanetScale** – MySQL-compatible relational database
- **Drizzle ORM** – Type-safe SQL queries for PlanetScale
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
- **British English spelling** for domain terms: `organizations`, `organizationDomains`
- **Readonly props** for React components: `{ readonly children: ReactNode }`
- **Single quotes** for strings, **trailing commas** enabled
- **Explicit return validators** on all Convex functions
- **Kebab-case** for file/folder names, **PascalCase** for components, **camelCase** for functions/variables

### Architecture Patterns

#### Directory Structure

```
app/                    # Next.js App Router
├── (app)/             # Authenticated routes (sidebar layout)
├── admin/             # Admin-only routes
├── callback/          # Auth callback handlers
├── sign-in/           # Auth routes (route handlers)
└── sign-up/

convex/                # Convex backend
├── controllers/       # HTTP endpoint controllers (Hono)
├── functions.ts       # Custom query/mutation builders
├── schema.ts          # Database schema
├── types/             # TypeScript type definitions
├── workflows/         # Multi-step sync workflows
├── workos/            # WorkOS webhook handlers
└── [domain]/          # Domain-specific modules
    ├── internal/      # Internal functions (mutations, queries, actions)
    └── query.ts       # Public queries

components/            # React components
├── ui/                # shadcn/ui primitives
└── *.tsx              # Feature components

db/                    # Drizzle/PlanetScale
├── schema/            # Table definitions
└── index.ts           # Database connection
```

#### Convex Function Organization

- **Public functions** in `convex/[domain]/query.ts` or `convex/[domain]/mutation.ts`
- **Internal functions** in `convex/[domain]/internal/query.ts`, `mutation.ts`, or `action.ts`
- Use custom builders from `convex/functions.ts`:
  - `protectedQuery` / `protectedMutation` – Requires authenticated user
  - `protectedAdminQuery` / `protectedAdminMutation` – Requires admin role
  - `publicQuery` / `publicMutation` – No auth required
  - `internalQuery` / `internalMutation` / `internalAction` – Internal only

#### Dual Database Pattern

1. **Convex** – Primary for real-time data, user sessions, and reactive queries
2. **PlanetScale** – Secondary for complex relational queries and legacy integrations
3. **Sync workflows** – Background actions that sync data from Convex → PlanetScale

### Testing Strategy

- Unit tests for utility functions
- Integration tests for Convex functions using Convex test framework
- E2E tests for critical user flows
- Manual testing via Convex dashboard and admin sync page

### Git Workflow

- **Main branch** – Production-ready code
- **Feature branches** – `feature/[change-id]` or `fix/[issue-id]`
- **Commit messages** – Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`
- **OpenSpec** for significant changes requiring specs

## Domain Context

### User Management

- Users are created/updated via WorkOS webhooks
- Each user has a `role` (admin/user) and `externalId` (WorkOS ID)
- Users can have metadata (`metadata`) and locale settings (`preferredLocale`)
- Supported languages: German (de), French (fr), Italian (it), Romansh (rm), English (en)

### Organization Management

- Organizations are synced from WorkOS
- Domains can be verified for SSO
- Memberships link users to organizations with roles

### Sync Status Tracking

- `syncStatus` table tracks sync operations to PlanetScale
- Status values: `pending`, `success`, `failed`
- Used for monitoring and retry logic

## Important Constraints

### Authentication

- All authenticated routes require WorkOS session via middleware
- Admin routes require `role: 'admin'` in Convex user record
- Use `<Authenticated>` wrapper for client-side auth gating

### Database Sync

- Convex is the source of truth for real-time data
- PlanetScale syncs are eventually consistent (background workflows)
- Never write directly to PlanetScale from frontend; always go through Convex

### Performance

- Mutations should complete in <500ms
- Use optimistic updates for better UX
- Virtualize large lists (use `virtua`)

### Accessibility

- Follow WAI-ARIA APG patterns
- Minimum hit target 24px (44px on mobile)
- Honor `prefers-reduced-motion`
- Never disable browser zoom

## External Dependencies

### WorkOS

- **AuthKit** – Redirect-based authentication
- **Webhooks** – `user.created`, `user.updated`, `user.deleted`, `organization.*`, `organization_membership.*`
- **SDK** – `@workos-inc/node` for server-side, `@workos-inc/authkit-nextjs` for Next.js

### Convex

- **Cloud** – Managed deployment at `convex.cloud`
- **Dev components** – `@convex-dev/workflow`, `@convex-dev/rate-limiter`, `@convex-dev/r2`

### PlanetScale

- **Serverless driver** – `@planetscale/database`
- **Connection** – Via Drizzle ORM with MySQL dialect

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
