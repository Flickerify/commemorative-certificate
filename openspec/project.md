# Project Context

## Purpose

Commemorative Certificate is a Convex + Next.js application scaffolded from the WorkOS AuthKit template. It demonstrates authenticated, full‑stack development using Convex as the backend (database and server functions) and Next.js App Router on the frontend, with WorkOS AuthKit providing authentication.

## Tech Stack

- Next.js 15 (App Router) + React 19
- TypeScript 5
- Convex 1.x (database, queries/mutations/actions)
- WorkOS AuthKit (Next.js) for auth (redirect-based, middleware-protected)
- Tailwind CSS 4 with PostCSS and `tw-animate-css`
- class-variance-authority (CVA), Radix Slot, and a minimal UI kit (e.g., `components/ui/button`)
- ESLint 9 with `next/core-web-vitals` + TypeScript config
- Shadcn UI 3.5.0 with TanStack Form
- Prettier 3
- Bun 1.3.1 (preferred over npm for faster install times and smaller bundle sizes)

## Project Conventions

### Code Style

- TypeScript strict mode enabled; prefer explicit types for public APIs and Convex validators for args/returns.
- Formatting via Prettier (`singleQuote: true`, `semi: true`, `printWidth: 120`, `trailingComma: 'all'`).
- ESLint extends Next.js core web vitals + TypeScript; fix lints before commit.
- Path alias `@/*` → project root per `tsconfig.json`.

### Architecture Patterns

- Next.js App Router with `app/` layout and server components by default; client components use `'use client'`.
- Convex organizes server logic under `convex/`:
  - `schema.ts` defines tables and indexes (e.g., `users` with `by_email`, `by_external_id`).
  - Functions use the new Convex function syntax with validators. Public vs internal functions are separated (`query/mutation/action` vs `internal*`).
  - Helpers in `convex/functions.ts` provide `public*`, `protected*`, and `internal*` wrappers, adding auth context and (placeholder) row‑level security via `convex-helpers`.
- Authentication via WorkOS AuthKit:
  - `middleware.ts` protects routes; unauthenticated access allowed for `/`, `/sign-in`, `/sign-up`.
  - Client auth context via `AuthKitProvider` and `ConvexProviderWithAuth` in `components/ConvexClientProvider.tsx`.
  - Convex auth configured in `convex/auth.config.ts` using WorkOS custom JWT providers.
- Styling with Tailwind CSS 4 using CSS variables in `app/globals.css`; theme supports light/dark with `:root`/`.dark` tokens.

### Testing Strategy

- Manual testing via `bun run dev` running Next and Convex in parallel.
- Add unit tests (TBD) for Convex functions and React components as the app grows; prefer lightweight testing (Vitest/React Testing Library) and Convex test helpers when introduced.

### Git Workflow

- Main branch tracks deployable state.
- Conventional commits are recommended (e.g., `feat:`, `fix:`). Small PRs with focused scope.

## Domain Context

- User accounts managed via WorkOS; Convex `users` table stores `email`, `externalId`, `firstName`, `lastName`, `emailVerified` with indexes by email and externalId.
- App shell includes authenticated/unauthenticated home page flows and basic sign‑in/up routes.

## Important Constraints

- Secrets and config via `.env.local` (e.g., `WORKOS_CLIENT_ID`, `NEXT_PUBLIC_CONVEX_URL`).
- Auth relies on WorkOS-hosted redirects and JWT validation; cookies and sessions are managed by AuthKit middleware.
- Convex functions MUST define argument and return validators; functions without returns should use `returns: v.null()`.
- Follow Convex indexing rules (query via indexes, avoid `filter` scans in production paths).

## External Dependencies

- WorkOS AuthKit (`@workos-inc/authkit-nextjs`, `@workos-inc/node`) for authentication and session handling.
- Convex Cloud for database and serverless execution.
- Radix UI Slot, CVA, `clsx`, `tailwind-merge` for UI composition.
