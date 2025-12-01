# Project Context

## Purpose

Flickerify is a full-stack application that provides user and organization management with WorkOS AuthKit authentication and Stripe billing. It synchronizes identity and subscription data between WorkOS, Convex (real-time database), and Planetscale PostgreSQL (relational database) to support a multi-database architecture where Convex handles real-time features and Planetscale handles relational queries.

## Tech Stack

### Frontend

- **Next.js 16** – App Router with route groups `(app)`, `(onboarding)`, `admin`
- **React 19** – UI framework
- **Tailwind CSS 4** – Styling (using `tw-animate-css`)
- **shadcn/ui** – Component library built on Radix UI
- **Radix UI** – Accessible primitives (`@radix-ui/themes`)
- **Lucide React** – Primary icon library
- **Tabler Icons** – Secondary icon library (`@tabler/icons-react`)
- **Recharts** – Charting library
- **TanStack Table** – Data tables
- **TanStack Form** – Form management with Zod adapter
- **dnd-kit** – Drag and drop (`@dnd-kit/core`, `@dnd-kit/sortable`)

### Backend

- **Convex** – Real-time database, serverless functions, and file storage
- **Convex Workflows** – Durable multi-step workflows with `@convex-dev/workflow`
- **Hono** – HTTP routing for Convex endpoints (via `convex-helpers`)
- **Planetscale PostgreSQL** – Serverless relational database (`@neondatabase/serverless`)
- **Drizzle ORM** – Type-safe SQL queries for Planetscale (`drizzle-orm`, `drizzle-kit`)
- **WorkOS AuthKit** – Authentication, SSO, and organization management
- **Stripe** – Subscription billing with webhooks for payment lifecycle

### Tooling

- **TypeScript 5.9** – Strict type checking
- **Bun** – Package manager and runtime
- **ESLint + Prettier** – Code quality and formatting
- **OpenSpec** – Spec-driven development and change management
- **t3-oss/env-nextjs** – Type-safe environment variables with Zod

## Project Conventions

### Code Style

- **TypeScript strict mode** enabled throughout
- **American English spelling** for domain terms: `organizations`, `organizationDomains`
- **Readonly props** for React components: `{ readonly children: ReactNode }`
- **Single quotes** for strings, **trailing commas** enabled
- **Explicit return validators** on all Convex functions
- **Kebab-case** for file/folder names, **PascalCase** for components, **camelCase** for functions/variables

### Architecture Patterns

#### Directory Structure

```
app/                    # Next.js App Router
├── (app)/             # Authenticated routes (sidebar layout + onboarding guard)
│   ├── layout.tsx     # Uses OnboardingGuard, UserProvider, Dashboard
│   ├── account/       # User account settings
│   │   ├── profile/   # Profile settings
│   │   ├── preferences/ # User preferences
│   │   └── notifications/ # Notification settings
│   ├── administration/ # Organization admin settings
│   │   ├── organization/ # Organization details
│   │   ├── team/      # Team member management
│   │   ├── roles/     # Role management
│   │   ├── billing/   # Billing settings
│   │   ├── apikeys/   # API key management
│   │   ├── security/  # Security settings
│   │   └── audit/     # Audit logs
│   ├── catalog/       # Data catalog features
│   │   ├── sources/   # Data sources
│   │   ├── targets/   # Data targets
│   │   ├── schemas/   # Schema definitions
│   │   └── imports/   # Import wizard
│   ├── compatibility/ # Compatibility management
│   │   ├── rules/     # Compatibility rules
│   │   ├── policies/  # Compatibility policies
│   │   ├── overrides/ # Override configurations
│   │   ├── playground/ # Testing playground
│   │   ├── revisions/ # Revision history
│   │   └── publish-logs/ # Publishing logs
│   └── organization/  # Organization selection
│       └── new/       # Create new organization
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
│   ├── stripeWebhooksController.ts  # Stripe webhook handler
│   └── workosWebhooksController.ts  # WorkOS webhook handler
├── functions.ts       # Custom query/mutation/action builders
├── schema.ts          # Database schema with validators
├── http.ts            # HTTP router configuration
├── types/             # TypeScript type definitions
├── workflows/         # Multi-step sync workflows (Convex Workflows)
│   └── syncToPlanetScale.ts
├── workos/            # WorkOS webhook handlers
│   ├── internal/      # Internal actions (verifyWebhook, updateUserMetadata)
│   └── webhooks/      # Webhook handlers by entity (users, organizations, memberships)
├── stripe/            # Stripe webhook handlers
│   ├── internal/      # Internal actions for Stripe operations
│   └── webhooks/      # Subscription webhook handlers
├── billing/           # Billing queries and actions
│   ├── action.ts      # Checkout, portal, subscription actions
│   ├── query.ts       # Subscription queries
│   └── stripe.ts      # Stripe client and helpers
├── planetscale/       # Planetscale PostgreSQL sync actions
│   └── internal/      # Internal sync operations
└── [domain]/          # Domain-specific modules (users, organizations, etc.)
    ├── internal/      # Internal functions (mutations, queries, actions)
    ├── action.ts      # Public actions
    └── query.ts       # Public queries

components/            # React components
├── ui/                # shadcn/ui primitives
├── onboarding-guard.tsx  # Redirects non-onboarded users
└── *.tsx              # Feature components

db/                    # Drizzle/Planetscale PostgreSQL
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

1. **Convex** – Primary for real-time data, user sessions, reactive queries, and billing state
2. **Planetscale PostgreSQL** – Secondary for relational queries, legacy integrations, and external system access
3. **Sync workflows** – Convex Workflows that sync data from Convex → Planetscale with retry logic and dead letter queue

#### Workflow Pattern

Sync operations use `@convex-dev/workflow` for durability:

- `kickoff*` mutations start workflows and initialize `syncStatus`
- Workflows run steps with retry configuration
- `onComplete` handler updates `syncStatus` with results
- `syncStatus` table tracks history per entity
- **Bidirectional ID sync**: When upserting to PlanetScale, the generated `id` is synced back to Convex as `planetscaleId` for cross-database association

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

- `syncStatus` table tracks sync operations to Planetscale PostgreSQL
- Status values: `pending`, `success`, `failed`
- Tracks `webhookEvent`, `workflowId`, `startedAt`, `completedAt`, `durationMs`
- History is kept per entity (new record per sync, not overwritten)
- Admin page at `/admin/sync` displays grouped sync history

### Billing & Subscriptions

- Organizations can have one of three tiers: `personal` (1 seat), `pro` (3 seats), `enterprise` (unlimited)
- Stripe is the source of truth for billing; webhooks sync state to Convex
- Subscription statuses: `active`, `canceled`, `incomplete`, `incomplete_expired`, `past_due`, `paused`, `trialing`, `unpaid`, `none`
- Personal tier includes 14-day free trial
- `stripeWebhookEvents` table ensures idempotent webhook processing
- Subscription info synced to Planetscale for external system access

### Hard Deletion (GDPR)

- User deletion cascades: memberships → user → Planetscale PostgreSQL
- Org deletion cascades: domains → memberships → subscription → org → Planetscale PostgreSQL
- Workflows handle deletion order: Planetscale first, then Convex

## Important Constraints

### Authentication

- All authenticated routes require WorkOS session via `authkitMiddleware`
- Admin routes require `role: 'admin'` in Convex user record
- Use `<Authenticated>` wrapper for client-side auth gating
- Use `<OnboardingGuard>` to enforce onboarding completion

### Database Sync

- Convex is the source of truth for real-time data and billing state
- WorkOS is the source of truth for user metadata and authentication
- Stripe is the source of truth for subscription billing
- Planetscale PostgreSQL syncs are eventually consistent (background workflows)
- Never write directly to Planetscale from frontend; always go through Convex
- Failed syncs are tracked in `deadLetterQueue` for retry/debugging

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

### Stripe Webhooks

- **Checkout** – `checkout.session.completed`
- **Subscriptions** – `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`, `customer.subscription.trial_will_end`
- **Invoices** – `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`, `invoice.upcoming`
- **Payments** – `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`

### Convex

- **Cloud** – Managed deployment at `convex.cloud`
- **Version** – `convex@1.29.3`
- **Dev components**:
  - `@convex-dev/workflow@0.3.2` – Durable workflows with retry
  - `@convex-dev/workpool@0.3.0` – Background job processing
  - `@convex-dev/rate-limiter@0.3.0` – Rate limiting
  - `@convex-dev/r2@0.8.1` – R2 storage integration
  - `@convex-dev/crons@0.2.0` – Scheduled jobs
  - `convex-helpers@0.1.106` – Custom function builders and utilities

### Planetscale PostgreSQL

- **Serverless driver** – `@neondatabase/serverless`
- **Connection** – Via Drizzle ORM with PostgreSQL dialect
- **Tables**: `users`, `organizations` (id mapping + subscription info: workosId, convexId, subscriptionTier, subscriptionStatus, timestamps)

### Stripe

- **SDK** – `stripe` for server-side API calls
- **Webhooks** – Subscription lifecycle events (checkout, subscription updates, payments)
- **Tiers** – `personal` (1 seat), `pro` (3 seats), `enterprise` (unlimited)
- **Trial** – 14-day free trial for personal tier
- **Billing intervals** – Monthly and yearly options

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

# Planetscale PostgreSQL (Drizzle)
DATABASE_URL=

# Stripe (in Convex environment)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PERSONAL_MONTHLY=
STRIPE_PRICE_PERSONAL_YEARLY=
STRIPE_PRICE_PRO_MONTHLY=
STRIPE_PRICE_PRO_YEARLY=
STRIPE_PRICE_ENTERPRISE_MONTHLY=
STRIPE_PRICE_ENTERPRISE_YEARLY=
```

## Database Schema

### Convex Tables

- **users** – `email`, `externalId`, `firstName`, `lastName`, `emailVerified`, `profilePictureUrl`, `role`, `metadata`, `expoPushToken`, `planetscaleId?`, `updatedAt`
- **organizations** – `externalId`, `name`, `metadata`, `planetscaleId?`, `updatedAt`
- **organizationDomains** – `organizationId`, `externalId`, `domain`, `status`, `updatedAt`
- **organizationMemberships** – `organizationId`, `userId`, `role`, `status`, `updatedAt`
- **syncStatus** – `entityType`, `entityId`, `targetSystem`, `status`, `webhookEvent`, `workflowId`, `startedAt`, `completedAt`, `durationMs`, `error`
- **stripeCustomers** – `organizationId`, `stripeCustomerId`, `createdAt`
- **organizationSubscriptions** – `organizationId`, `stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId`, `tier`, `status`, `billingInterval`, `currentPeriodStart`, `currentPeriodEnd`, `cancelAtPeriodEnd`, `cancelAt`, `trialStart`, `trialEnd`, `seatLimit`, `paymentMethodBrand`, `paymentMethodLast4`, `pendingCheckoutSessionId`, `pendingPriceId`, `createdAt`, `updatedAt`
- **stripeWebhookEvents** – `eventId`, `eventType`, `customerId`, `processedAt` (idempotency)
- **deadLetterQueue** – `workflowId`, `entityType`, `entityId`, `error`, `context`, `createdAt`, `retryable`, `retryCount`, `lastRetryAt`, `resolvedAt`

### Planetscale PostgreSQL Tables

- **users** – `id`, `workosId`, `convexId`, `updatedAt`, `createdAt`
- **organizations** – `id`, `workosId`, `convexId`, `subscriptionTier`, `subscriptionStatus`, `updatedAt`, `createdAt`

## Supported Languages

- German (de)
- French (fr)
- Italian (it)
- Romansh (rm)
- English (en)
