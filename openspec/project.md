# Project Context

## Purpose

Flickerify is a **multi-tenant compatibility checker SaaS platform**. Organizations create custom compatibility pages where end-users can check if products/items are compatible with their requirements (e.g., "Is this OBD device compatible with my vehicle?").

The platform provides:

- **Dynamic schemas** for sources (what's being checked, e.g., vehicles) and targets (what to check against, e.g., devices)
- **Configurable compatibility rules** using JSONLogic
- **Multi-state verdicts**: compatible (2), partial (1), incompatible (0)
- **Public-facing pages** with subdomain routing (`company.flickerify.com`)
- **Multi-tenancy** via WorkOS organizations with usage limits per tier

## Tech Stack

### Frontend

- **Next.js 16** – App Router with route groups `(app)`, `(onboarding)`, `admin`, `[domain]`
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

### Backend (Dual Database Architecture)

- **PlanetScale PostgreSQL** – System of record for all business data and computation
  - Serverless driver: `@neondatabase/serverless`
  - Type-safe queries: Drizzle ORM (`drizzle-orm`, `drizzle-kit`)
- **Convex** – Visualization cache for frontend (real-time reactive queries)
  - Managed deployment at `convex.cloud`
  - Version: `convex@1.29.3`
- **Next.js API Routes** – Business logic layer (CRUD, imports, evaluation)
- **Hono** – HTTP routing for Convex webhook endpoints (via `convex-helpers`)

### Auth & Billing

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

#### Dual Database Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                      WRITE PATH                              │
│                                                              │
│  Admin UI → Next.js API Routes → PlanetScale (Drizzle)      │
│                                        │                     │
│                                        ▼                     │
│                              (Sync to Convex for display)    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      READ PATH                               │
│                                                              │
│  Public Page → Convex Queries → Cached display data          │
│       │                                                      │
│       └─→ (Cache miss) → API Route → PlanetScale → Convex    │
└─────────────────────────────────────────────────────────────┘
```

**What goes where**:

| Data                  | PlanetScale   | Convex              |
| --------------------- | ------------- | ------------------- |
| Source definitions    | ✅ Primary    | Display metadata    |
| Source datasets       | ✅ Primary    | Stats for UI        |
| Source rows           | ✅ Primary    | ❌ Not stored       |
| Target definitions    | ✅ Primary    | Display metadata    |
| Target rows           | ✅ Primary    | ❌ Not stored       |
| Feature rules         | ✅ Primary    | ❌ Not stored       |
| Policies              | ✅ Primary    | ❌ Not stored       |
| Overrides             | ✅ Primary    | ❌ Not stored       |
| Dropdown options      | ✅ Primary    | ✅ Cached shards    |
| Compatibility results | ✅ Primary    | ✅ Cached pages     |
| Organizations         | Existing sync | ✅ Primary (WorkOS) |
| Users                 | Existing sync | ✅ Primary (WorkOS) |

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
│   ├── catalog/       # Data catalog (sources & targets)
│   │   ├── sources/   # Source data management
│   │   ├── targets/   # Target data management
│   │   ├── schemas/   # Schema definitions
│   │   └── imports/   # Import wizard
│   ├── compatibility/ # Compatibility configuration
│   │   ├── rules/     # JSONLogic rule builder
│   │   ├── policies/  # Device & selection policies
│   │   ├── overrides/ # Manual override configurations
│   │   ├── playground/ # Testing playground
│   │   ├── revisions/ # Revision history
│   │   └── publish-logs/ # Publishing logs
│   └── organization/  # Organization selection
│       └── new/       # Create new organization
├── (onboarding)/      # Onboarding flow (minimal layout, no sidebar)
│   ├── layout.tsx     # Gradient background, no sidebar
│   └── onboarding/    # Onboarding wizard
├── [domain]/          # Multi-tenant public pages (subdomain routing)
│   └── [...slug]/     # Dynamic public page routes
├── api/               # Next.js API Routes (business logic)
│   ├── sources/       # Source management APIs
│   ├── targets/       # Target management APIs
│   ├── rules/         # Rule management APIs
│   ├── pages/         # Public page APIs
│   └── sync/          # Convex cache sync triggers
├── admin/             # Admin-only routes
│   └── sync/          # Sync status monitoring
├── callback/          # Auth callback handlers
├── sign-in/           # Auth routes (route handlers)
└── sign-up/

convex/                # Convex backend (visualization cache + identity sync)
├── controllers/       # HTTP endpoint controllers (Hono)
│   ├── stripeWebhooksController.ts  # Stripe webhook handler
│   └── workosWebhooksController.ts  # WorkOS webhook handler
├── functions.ts       # Custom query/mutation/action builders
├── schema.ts          # Database schema with validators
├── http.ts            # HTTP router configuration
├── types/             # TypeScript type definitions
├── workflows/         # Multi-step sync workflows (Convex Workflows)
│   └── syncToPlanetScale.ts
├── pages/             # Public page visualization cache
│   ├── query.ts       # getBySlug, getOptions, getResult
│   └── internal/      # Cache sync mutations
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

db/                    # Drizzle/Planetscale PostgreSQL (system of record)
├── schema/            # Table definitions
│   ├── users.ts
│   ├── organizations.ts
│   ├── sources.ts     # source_definitions, source_datasets, source_rows
│   ├── targets.ts     # target_definitions, target_datasets, target_rows
│   ├── rules.ts       # feature_rules, overrides
│   └── pages.ts       # public_pages, compat_results, option_index
└── index.ts           # Database connection

components/            # React components
├── ui/                # shadcn/ui primitives
├── dashboard/         # Dashboard layout components
│   ├── dashboard.tsx  # Main dashboard with space switcher
│   ├── icon-sidebar.tsx
│   ├── navigation-sidebar.tsx
│   └── right-sidebar.tsx
├── features/          # Feature-specific components
│   ├── import-wizard.tsx    # CSV/JSON import wizard
│   ├── schema-builder.tsx   # Dynamic schema editor
│   ├── rule-builder.tsx     # JSONLogic rule builder
│   ├── revision-history.tsx # Revision history viewer
│   └── public-page-preview.tsx
├── onboarding-guard.tsx  # Redirects non-onboarded users
└── *.tsx              # Other feature components
```

#### Dashboard Spaces

The admin dashboard is organized into four spaces:

1. **Catalog Space** – Source and target data management
2. **Compatibility Space** – Rules, policies, overrides, and publishing
3. **Administration Space** – Organization, team, billing, security
4. **Account Space** – User profile and preferences

#### Convex Function Organization

- **Public functions** in `convex/[domain]/query.ts`, `convex/[domain]/mutation.ts`, or `convex/[domain]/action.ts`
- **Internal functions** in `convex/[domain]/internal/query.ts`, `mutation.ts`, or `action.ts`
- Use custom builders from `convex/functions.ts`:
  - `protectedQuery` / `protectedMutation` / `protectedAction` – Requires authenticated user
  - `protectedAdminQuery` / `protectedAdminMutation` / `protectedAdminAction` – Requires admin role
  - `publicQuery` / `publicMutation` / `publicAction` – No auth required
  - `internalQuery` / `internalMutation` / `internalAction` – Internal only

#### Sync Workflows

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

### Multi-Tenancy

- WorkOS organizations serve as tenants
- All data scoped by `organizationId`
- Personal organizations have usage limits; paid organizations unlock full features
- Subdomain routing for paid organizations (`company.flickerify.com`)

### Source Management

Sources represent what is being checked (e.g., vehicles with Year/Make/Model/Engine):

- **Source definitions**: JSON schema with unlimited dimensions
- **Source datasets**: Versioned collections of source rows
- **Source rows**: Stored as `dims_json` (dimensions) + `attrs_json` (attributes)
- **Dimension values**: Materialized index for cascading dropdowns
- **Import wizard**: CSV/JSON upload with column mapping

### Target Management

Targets represent what to check against (e.g., OBD devices with features):

- Same pattern as sources (definitions, datasets, rows)
- Features stored as key-value pairs in `attrs_json`

### Compatibility Engine

- **Feature rules**: JSONLogic expressions evaluating source/target pairs
- **Device policies**: How to calculate verdict per target (all required rules, weighted scoring)
- **Selection policies**: How to aggregate across targets
- **Manual overrides**: Force specific verdicts for source-target pairs
- **Three-level verdicts**: 0 (incompatible), 1 (partial), 2 (fully compatible)

### Public Pages

- Subdomain routing via Next.js middleware (`[domain]/[...slug]`)
- Cascading dropdown UI from source dimensions
- Compatibility result matrix display
- Embeddable widgets (future)

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
- `metadata.tier` indicates plan: `personal`, `pro`, `enterprise`
- Domains can be verified for SSO (`organizationDomains` table)
- Memberships link users to organizations with roles (`organizationMemberships` table)

### Billing & Subscriptions

- Organizations can have one of three tiers: `personal` (1 seat), `pro` (3 seats), `enterprise` (unlimited)
- Stripe is the source of truth for billing; webhooks sync state to Convex
- Subscription statuses: `active`, `canceled`, `incomplete`, `incomplete_expired`, `past_due`, `paused`, `trialing`, `unpaid`, `none`
- Personal tier includes 14-day free trial
- `stripeWebhookEvents` table ensures idempotent webhook processing
- Subscription info synced to Planetscale for external system access

### Usage Limits by Tier

| Limit                   | Personal | Pro    | Enterprise |
| ----------------------- | -------- | ------ | ---------- |
| Source schemas          | 2        | 10     | Unlimited  |
| Target schemas          | 2        | 10     | Unlimited  |
| Source rows per dataset | 1,000    | 50,000 | 100,000+   |
| Target rows per dataset | 100      | 5,000  | 10,000+    |
| Dimensions per schema   | 4        | 8      | 10         |
| Rules per page          | 10       | 50     | 100        |
| Custom subdomain        | ❌       | ✅     | ✅         |
| Team members            | 1        | 3      | Unlimited  |

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

### Database Responsibilities

- **PlanetScale** is the system of record for all business data (sources, targets, rules, results)
- **Convex** is the visualization cache for frontend (dropdown options, cached results)
- **WorkOS** is the source of truth for user metadata and authentication
- **Stripe** is the source of truth for subscription billing
- Never write directly to Convex for business data; always go through API routes → PlanetScale
- Convex cache is disposable (can rebuild from PlanetScale)

### Performance

- Mutations should complete in <500ms
- Use optimistic updates for better UX (e.g., update Convex immediately, sync to WorkOS async)
- Virtualize large lists (use `virtua`)
- Convex documents limited to 1MB (shard large data)

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
- **Role**: System of record for all business data

### Stripe

- **SDK** – `stripe` for server-side API calls
- **Webhooks** – Subscription lifecycle events (checkout, subscription updates, payments)
- **Tiers** – `personal` (1 seat), `pro` (3 seats), `enterprise` (unlimited)
- **Trial** – 14-day free trial for personal tier
- **Billing intervals** – Monthly and yearly options

### JSONLogic

- **Library** – `json-logic-js` for rule evaluation
- **Purpose** – Dynamic compatibility rules without code changes

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

### Convex Tables (Visualization Cache + Identity)

**Identity (synced from WorkOS)**:

- **users** – `email`, `externalId`, `firstName`, `lastName`, `emailVerified`, `profilePictureUrl`, `role`, `metadata`, `expoPushToken`, `planetscaleId?`, `updatedAt`
- **organizations** – `externalId`, `name`, `metadata`, `planetscaleId?`, `updatedAt`
- **organizationDomains** – `organizationId`, `externalId`, `domain`, `status`, `updatedAt`
- **organizationMemberships** – `organizationId`, `userId`, `role`, `status`, `updatedAt`

**Billing (synced from Stripe)**:

- **stripeCustomers** – `organizationId`, `stripeCustomerId`, `createdAt`
- **organizationSubscriptions** – `organizationId`, `stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId`, `tier`, `status`, `billingInterval`, `currentPeriodStart`, `currentPeriodEnd`, `cancelAtPeriodEnd`, `cancelAt`, `trialStart`, `trialEnd`, `seatLimit`, `paymentMethodBrand`, `paymentMethodLast4`, `pendingCheckoutSessionId`, `pendingPriceId`, `createdAt`, `updatedAt`
- **stripeWebhookEvents** – `eventId`, `eventType`, `customerId`, `processedAt` (idempotency)

**Sync Status**:

- **syncStatus** – `entityType`, `entityId`, `targetSystem`, `status`, `webhookEvent`, `workflowId`, `startedAt`, `completedAt`, `durationMs`, `error`
- **deadLetterQueue** – `workflowId`, `entityType`, `entityId`, `error`, `context`, `createdAt`, `retryable`, `retryCount`, `lastRetryAt`, `resolvedAt`

**Visualization Cache (synced from PlanetScale)**:

- **optionShards** – `organizationId`, `pageId`, `level`, `parentHash`, `shard`, `values`, `syncedAt`
- **resultCache** – `organizationId`, `pageId`, `selectionHash`, `page`, `payload`, `syncedAt`
- **pageDisplays** – `organizationId`, `slug`, `name`, `status`, `dimensions`, `messaging`, `syncedAt`

### Planetscale PostgreSQL Tables (System of Record)

**Identity Sync**:

- **users** – `id`, `workosId`, `convexId`, `updatedAt`, `createdAt`
- **organizations** – `id`, `workosId`, `convexId`, `subscriptionTier`, `subscriptionStatus`, `planTier`, `customSubdomain`, `usageLimits`, `updatedAt`, `createdAt`

**Source Management**:

- **source_definitions** – `id`, `organizationId`, `slug`, `name`, `description`, `schemaJson`, `createdAt`, `updatedAt`
- **source_datasets** – `id`, `organizationId`, `definitionId`, `name`, `status`, `rowCount`, `revisionId`, `createdAt`, `updatedAt`
- **source_rows** – `id`, `organizationId`, `datasetId`, `keyText`, `keyHash`, `dimsJson`, `attrsJson`, `createdAt`
- **source_dimension_values** – `id`, `organizationId`, `datasetId`, `level`, `parentKeyHash`, `value`, `valueCount`
- **source_imports** – `id`, `organizationId`, `datasetId`, `status`, `mappingJson`, `statsJson`, `error`, `createdAt`

**Target Management**:

- **target_definitions** – `id`, `organizationId`, `slug`, `name`, `description`, `schemaJson`, `createdAt`, `updatedAt`
- **target_datasets** – `id`, `organizationId`, `definitionId`, `name`, `status`, `rowCount`, `revisionId`, `createdAt`, `updatedAt`
- **target_rows** – `id`, `organizationId`, `datasetId`, `keyText`, `keyHash`, `attrsJson`, `createdAt`

**Compatibility Engine**:

- **feature_rules** – `id`, `organizationId`, `pageId`, `name`, `required`, `weight`, `category`, `logicJson`, `sortOrder`, `createdAt`
- **overrides** – `id`, `organizationId`, `pageId`, `sourceKeyHash`, `targetKeyHash`, `value`, `note`, `createdAt`

**Public Pages**:

- **public_pages** – `id`, `organizationId`, `slug`, `name`, `sourceDatasetId`, `targetDatasetId`, `devicePolicyJson`, `selectionPolicyJson`, `status`, `revisionId`, `createdAt`, `updatedAt`
- **compat_results** – `id`, `organizationId`, `pageId`, `revisionId`, `selectionHash`, `pageNum`, `payloadJson`, `createdAt`
- **option_index** – `id`, `organizationId`, `pageId`, `level`, `parentHash`, `shard`, `valuesJson`

## Supported Languages

- German (de)
- French (fr)
- Italian (it)
- Romansh (rm)
- English (en)
