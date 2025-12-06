# Project Context

## ⚠️ Development Phase Notice

**This project is in active development (building phase).** When implementing features:

- **DO NOT** maintain backward compatibility with previous implementations
- **DO NOT** keep legacy fields or code "just in case"
- **DO** remove deprecated code immediately when refactoring
- **DO** clean up unused fields from schemas and data models
- **DO** prioritize clean architecture over migration paths

This policy applies to all code, schemas, and data structures. We can always add migration logic later if needed before production release.

---

## Purpose

Flickerify is a **multi-tenant compatibility checker SaaS platform**. Organizations create custom compatibility pages where end-users can check if products/items are compatible with their requirements (e.g., "Is this OBD device compatible with my vehicle?").

The platform provides:

- **Dynamic schemas** for sources (what's being checked, e.g., vehicles) and targets (what to check against, e.g., devices)
- **Configurable compatibility rules** using JSONLogic
- **Multi-state verdicts**: compatible (2), partial (1), incompatible (0)
- **Public-facing pages** with subdomain routing (`company.flickerify.com`)
- **Multi-tenancy** via WorkOS organizations with usage limits per tier
- **Enterprise audit logs** with configurable retention policies
- **14-day free trial** without requiring a credit card

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
- **dnd-kit** – Drag and drop (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/modifiers`)

### Backend (Dual Database Architecture)

- **PlanetScale PostgreSQL** – System of record for identity sync and future business data
  - Serverless driver: `@neondatabase/serverless`
  - Type-safe queries: Drizzle ORM (`drizzle-orm`, `drizzle-kit`)
- **Convex** – Primary backend for identity, billing, audit logs, and real-time features
  - Managed deployment at `convex.cloud`
  - Version: `convex@1.30.0`
- **Next.js API Routes** – Business logic layer (organization limits)
- **Hono** – HTTP routing for Convex webhook endpoints (via `convex-helpers`)

### Auth & Billing

- **WorkOS AuthKit** – Authentication, SSO, and organization management
- **WorkOS Events API** – Safeguard polling for missed webhooks (60-second intervals)
- **Stripe** – Subscription billing with webhooks for payment lifecycle
- **Resend** – Transactional email service (`@convex-dev/resend`)

### Tooling

- **TypeScript 5.9** – Strict type checking
- **Bun** – Package manager and runtime
- **ESLint + Prettier** – Code quality and formatting
- **OpenSpec** – Spec-driven development and change management
- **t3-oss/env-nextjs** – Type-safe environment variables with Zod
- **tldts** – Domain parsing for multi-tenant routing
- **slugify** – Slug generation for URL-safe identifiers

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
│                      IDENTITY FLOW                           │
│                                                              │
│  WorkOS Webhooks → Convex (Primary) → Sync to PlanetScale   │
│       +                                                      │
│  WorkOS Events API (Polling Safeguard - 60s intervals)      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      BILLING FLOW                            │
│                                                              │
│  Stripe Webhooks → Convex (Primary) → Sync to PlanetScale   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   FUTURE: BUSINESS DATA                      │
│                                                              │
│  Admin UI → Next.js API Routes → PlanetScale (Drizzle)      │
│                                        │                     │
│                                        ▼                     │
│                              (Sync to Convex for display)    │
└─────────────────────────────────────────────────────────────┘
```

**What goes where**:

| Data                 | PlanetScale   | Convex                  |
| -------------------- | ------------- | ----------------------- |
| Users                | ✅ Synced     | ✅ Primary (WorkOS)     |
| Organizations        | ✅ Synced     | ✅ Primary (WorkOS)     |
| Memberships          | ❌ Not stored | ✅ Primary (WorkOS)     |
| Subscriptions        | ✅ Synced     | ✅ Primary (Stripe)     |
| Audit logs           | ❌ Not stored | ✅ Primary (Enterprise) |
| Enterprise inquiries | ❌ Not stored | ✅ Primary              |
| Source definitions   | 🔮 Future     | 🔮 Future               |
| Source datasets      | 🔮 Future     | 🔮 Future               |
| Target definitions   | 🔮 Future     | 🔮 Future               |
| Feature rules        | 🔮 Future     | 🔮 Future               |
| Public pages         | 🔮 Future     | 🔮 Future               |

#### Directory Structure

```
app/                    # Next.js App Router
├── (app)/             # Authenticated routes (sidebar layout + onboarding guard)
│   ├── layout.tsx     # Uses OnboardingGuard, UserProvider, Dashboard
│   ├── page.tsx       # Dashboard home page
│   ├── account/       # User account settings
│   │   ├── page.tsx   # Account overview
│   │   ├── profile/   # Profile settings
│   │   ├── preferences/ # User preferences
│   │   └── notifications/ # Notification settings
│   ├── administration/ # Organization admin settings
│   │   ├── organization/ # Organization details
│   │   ├── team/      # Team member management
│   │   ├── roles/     # Role management
│   │   ├── billing/   # Billing settings & plan management
│   │   │   └── request/new/ # Enterprise inquiry form
│   │   ├── apikeys/   # API key management
│   │   ├── security/  # Security settings
│   │   └── audit/     # Audit logs (enterprise only)
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
│   └── [pageSlug]/    # Dynamic public page routes
├── api/               # Next.js API Routes (business logic)
│   └── organization/  # Organization APIs
│       └── limits/    # Usage limits API
├── admin/             # Admin-only routes
│   ├── sync/          # Sync status monitoring
│   └── enterprise/    # Enterprise inquiry management
├── callback/          # Auth callback handlers
├── sign-in/           # Auth routes (route handlers)
└── sign-up/

convex/                # Convex backend (primary for identity, billing, audit)
├── controllers/       # HTTP endpoint controllers (Hono)
│   ├── stripeWebhooksController.ts  # Stripe webhook handler
│   ├── workosWebhooksController.ts  # WorkOS webhook handler
│   ├── workosActionsController.ts   # WorkOS action endpoints
│   └── resendWebhooksController.ts  # Resend email webhook handler
├── functions.ts       # Custom query/mutation/action builders
├── schema.ts          # Database schema with validators
├── http.ts            # HTTP router configuration (Hono)
├── crons.ts           # Scheduled jobs (Events API polling, cleanup)
├── env.ts             # Environment variable validation (Zod)
├── types/             # TypeScript type definitions
│   ├── hono.d.ts      # Hono type definitions
│   └── index.ts       # Common type exports
├── workflows/         # Multi-step sync workflows (Convex Workflows)
│   └── syncToPlanetScale.ts
├── workos/            # WorkOS integration
│   ├── actions/       # WorkOS SDK actions
│   ├── events/        # Events API polling & processing
│   │   ├── action.ts  # Poll events action
│   │   ├── mutation.ts # Event cursor management
│   │   ├── process.ts # Event processing logic
│   │   └── query.ts   # Event queries
│   ├── internal/      # Internal actions (verifyWebhook, updateUserMetadata)
│   └── webhooks/      # Webhook handlers by entity
├── stripe/            # Stripe integration
│   ├── internal/      # Internal actions for Stripe operations
│   └── webhooks/      # Subscription webhook handlers
├── billing/           # Billing queries and actions
│   ├── action.ts      # Checkout, portal, subscription actions
│   ├── query.ts       # Subscription queries
│   ├── stripe.ts      # Stripe client and helpers
│   └── internal/      # Internal billing mutations
├── audit/             # Audit logging (enterprise only)
│   ├── query.ts       # Audit log queries
│   ├── utils.ts       # Audit helper functions
│   └── internal/      # Internal audit mutations
├── enterpriseInquiry/ # Enterprise sales inquiries
│   ├── action.ts      # Submit inquiry action
│   ├── email.ts       # Email templates
│   ├── mutation.ts    # Public mutation
│   ├── query.ts       # Query inquiries
│   └── internal/      # Internal mutations
├── users/             # User management
│   ├── action.ts      # User actions
│   ├── query.ts       # User queries
│   ├── utils.ts       # User helper functions
│   ├── admin/         # Admin-only user functions
│   └── internal/      # Internal mutations/queries
├── organizations/     # Organization management
│   ├── action.ts      # Organization actions
│   ├── query.ts       # Organization queries
│   └── internal/      # Internal mutations/queries
├── organizationDomains/ # Domain verification
│   └── internal/      # Internal domain operations
├── organizationMemberships/ # Team memberships
│   └── internal/      # Internal membership operations
├── planetscale/       # Planetscale sync operations
│   └── internal/      # Internal sync actions
└── sync/              # Sync utilities
    ├── mutation.ts    # Sync mutations
    └── query.ts       # Sync queries

db/                    # Drizzle/Planetscale PostgreSQL (identity sync)
├── schema/            # Table definitions
│   ├── users.ts       # User identity sync
│   └── organizations.ts # Organization identity + subscription sync
└── index.ts           # Database connection

components/            # React components
├── ui/                # shadcn/ui primitives (60+ components)
├── billing/           # Billing components
│   ├── billing-portal-button.tsx
│   ├── checkout-button.tsx
│   ├── pricing-table.tsx
│   └── subscription-card.tsx
├── dashboard/         # Dashboard layout components
│   ├── dashboard.tsx  # Main dashboard with space switcher
│   ├── dashboard-context.tsx # Dashboard state context
│   ├── icon-sidebar.tsx
│   ├── navigation-sidebar.tsx
│   ├── page-shell.tsx # Page wrapper component
│   ├── right-sidebar.tsx
│   └── dropdowns/     # Dropdown menus
│       ├── organization-switcher.tsx
│       └── user-account-dropdown.tsx
├── features/          # Feature-specific components
│   ├── import-wizard.tsx    # CSV/JSON import wizard
│   ├── schema-builder.tsx   # Dynamic schema editor
│   ├── rule-builder.tsx     # JSONLogic rule builder
│   ├── revision-history.tsx # Revision history viewer
│   └── public-page-preview.tsx
├── ConvexClientProvider.tsx  # Convex provider wrapper
├── onboarding-guard.tsx      # Redirects non-onboarded users
├── theme-provider.tsx        # Theme context provider
└── mode-toggle.tsx           # Light/dark mode toggle
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

#### Cron Jobs

Scheduled jobs defined in `convex/crons.ts`:

- **WorkOS Events API polling** – Every 60 seconds, polls WorkOS Events API as a safeguard for missed webhooks
- **WorkOS processed events cleanup** – Daily, removes events older than 30 days from idempotency table
- **Audit log cleanup** – Daily, removes expired audit logs based on organization TTL settings

#### HTTP Routing

HTTP endpoints use Hono via `convex-helpers/server/hono`:

- `/workos-webhooks/*` – WorkOS webhook endpoints (users, organizations, memberships, domains)
- `/workos-actions/*` – WorkOS action endpoints (metadata updates)
- `/stripe-webhooks/*` – Stripe webhook endpoints (subscriptions, payments)
- `/resend-webhooks/*` – Resend email webhook endpoints

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
  - `onboardingComplete` – `true` or `false` (string)
  - `preferredLocale` – Language code (`de`, `fr`, `it`, `rm`, `en`)
  - Any other custom string fields from WorkOS
- WorkOS is the source of truth for metadata; updates go to WorkOS first, then webhook syncs to Convex
- Optional `expoPushToken` for mobile push notifications

### Onboarding Flow

- New users have `metadata.onboardingComplete = false`
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
- Personal tier is the free base tier (no Stripe subscription required)
- Stripe is the source of truth for paid billing; webhooks sync state to Convex
- Subscription statuses: `active`, `canceled`, `incomplete`, `incomplete_expired`, `past_due`, `paused`, `trialing`, `unpaid`, `none`
- **14-day free trial** for new subscriptions:
  - No credit card required to start trial
  - `trialStartedAt` and `trialEndsAt` track trial period
  - `hasUsedTrial` prevents multiple free trials per organization
  - Subscription auto-cancels if no payment method added by trial end
- **Scheduled plan changes** for downgrades:
  - `scheduledTier`, `scheduledBillingInterval`, `scheduledPriceId` track pending changes
  - `stripeScheduleId` links to Stripe subscription schedule
  - Changes take effect at period end
- `stripeWebhookEvents` table ensures idempotent webhook processing
- Subscription info synced to Planetscale for external system access

### Enterprise Inquiries

- Sales contact form for enterprise leads at `/administration/billing/request/new`
- `enterpriseInquiries` table stores inquiry details:
  - Contact info: `firstName`, `lastName`, `email`, `phone`, `jobTitle`
  - Company info: `companyName`, `companyWebsite`, `companySize`, `industry`
  - Requirements: `expectedUsers`, `useCase`, `currentSolution`, `timeline`, `budget`
  - `interestedFeatures` array for feature selection
  - Status tracking: `pending` → `contacted` → `approved/rejected` → `converted`
- Email notifications via Resend (`@convex-dev/resend`)
- Admin management at `/admin/enterprise`

### Audit Logs (Enterprise Only)

- Comprehensive audit trail for enterprise organizations
- Categories: `authentication`, `member`, `billing`, `settings`, `security`, `data`, `integration`
- Each log entry includes:
  - Actor information (user, system, or API)
  - Action details with status (success/failure/pending)
  - Target resource information
  - Request context (IP address, user agent)
  - TTL-based expiration (`expiresAt`)
- Default retention: 365 days (configurable per organization)
- Full-text search on description field
- Daily cleanup cron removes expired logs

### Usage Limits by Tier

| Limit                   | Personal | Pro    | Enterprise    |
| ----------------------- | -------- | ------ | ------------- |
| Team members            | 1        | 3      | Unlimited     |
| Audit logs              | ❌       | ❌     | ✅ (365 days) |
| Custom subdomain        | ❌       | ✅     | ✅            |
| Dedicated support       | ❌       | ❌     | ✅            |
| Source schemas          | 2        | 10     | Unlimited     |
| Target schemas          | 2        | 10     | Unlimited     |
| Source rows per dataset | 1,000    | 50,000 | 100,000+      |
| Target rows per dataset | 100      | 5,000  | 10,000+       |
| Dimensions per schema   | 4        | 8      | 10            |
| Rules per page          | 10       | 50     | 100           |

_Note: Source, target, and rule limits are planned features._

### Hard Deletion (GDPR)

- User deletion cascades: memberships → user → Planetscale PostgreSQL
- Org deletion cascades: domains → memberships → subscription → org → Planetscale PostgreSQL
- Workflows handle deletion order: Planetscale first, then Convex
- Audit log entries have TTL-based expiration (`expiresAt` field)

## Important Constraints

### Authentication

- All authenticated routes require WorkOS session via `authkitMiddleware`
- Admin routes require `role: 'admin'` in Convex user record
- Use `<Authenticated>` wrapper for client-side auth gating
- Use `<OnboardingGuard>` to enforce onboarding completion
- WorkOS Actions endpoint uses `WORKOS_ACTION_SECRET` for authentication

### Database Responsibilities

- **WorkOS** is the source of truth for user identity and authentication
- **Stripe** is the source of truth for subscription billing
- **Convex** is the primary backend for:
  - Identity storage (synced from WorkOS)
  - Billing state (synced from Stripe)
  - Audit logs (enterprise organizations)
  - Enterprise inquiries
  - Real-time reactive queries
- **PlanetScale** is the secondary sync target for:
  - User identity (for external system access)
  - Organization identity with subscription info
  - Future: business data (sources, targets, rules)
- WorkOS webhooks + Events API polling ensure reliable event delivery
- Event deduplication via `workosProcessedEvents` table

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

- **AuthKit** – Redirect-based authentication (`@workos-inc/authkit-nextjs@2.12.0`)
- **Webhooks** – `user.created`, `user.updated`, `user.deleted`, `organization.*`, `organization_membership.*`, `organization_domain.*`
- **Events API** – Polling safeguard for missed webhooks (60-second intervals)
- **SDK** – `@workos-inc/node@7.77.0` for server-side API calls
- **Widgets** – `@workos-inc/widgets@1.5.1` for UI components
- **Metadata** – All values stored as strings in WorkOS
- **Deduplication** – `workosProcessedEvents` table ensures idempotent event handling across webhooks and Events API

### Stripe

- **SDK** – `stripe@20.0.0` for server-side API calls
- **Webhooks** – Subscription lifecycle events (checkout, subscription updates, payments)
- **Subscription Schedules** – For scheduled plan changes (downgrades at period end)
- **Tiers** – `personal` (free), `pro` (3 seats), `enterprise` (unlimited)
- **Free trial** – 14-day trial without credit card requirement
- **Billing intervals** – Monthly and yearly options

### Stripe Webhooks

- **Checkout** – `checkout.session.completed`
- **Subscriptions** – `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`, `customer.subscription.trial_will_end`
- **Invoices** – `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`, `invoice.upcoming`
- **Payments** – `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`

### Convex

- **Cloud** – Managed deployment at `convex.cloud`
- **Version** – `convex@1.30.0`
- **Dev components**:
  - `@convex-dev/workflow@0.3.3` – Durable workflows with retry
  - `@convex-dev/workpool@0.3.0` – Background job processing
  - `@convex-dev/rate-limiter@0.3.0` – Rate limiting
  - `@convex-dev/r2@0.8.1` – R2 storage integration
  - `@convex-dev/crons@0.2.0` – Scheduled jobs
  - `@convex-dev/resend@0.2.0` – Resend email integration
  - `convex-helpers@0.1.106` – Custom function builders and utilities

### Planetscale PostgreSQL

- **Serverless driver** – `@neondatabase/serverless@1.0.2`
- **Connection** – Via Drizzle ORM with PostgreSQL dialect (`drizzle-orm@0.45.0`)
- **Role**: Identity sync for users and organizations with subscription info

### Resend

- **Integration** – `@convex-dev/resend@0.2.0` for transactional emails
- **Use cases**:
  - Enterprise inquiry confirmation emails
  - Admin notification emails
- **Webhooks** – Email delivery status tracking

### JSONLogic

- **Library** – `json-logic-js` for rule evaluation (future feature)
- **Purpose** – Dynamic compatibility rules without code changes

### Environment Variables

Required in `.env.local` (Next.js):

```
# Convex
CONVEX_DEPLOYMENT=
NEXT_PUBLIC_CONVEX_URL=

# Planetscale PostgreSQL (Drizzle)
DATABASE_URL=
```

Required in Convex environment (dashboard or `convex env set`):

```
# WorkOS
WORKOS_API_KEY=
WORKOS_CLIENT_ID=
WORKOS_COOKIE_PASSWORD=
WORKOS_WEBHOOK_USERS_SECRET=           # Separate secret per webhook type
WORKOS_WEBHOOK_ORGANIZATIONS_SECRET=
WORKOS_WEBHOOK_MEMBERSHIPS_SECRET=
WORKOS_ACTION_SECRET=                  # For authenticated action endpoints

# Stripe (optional in development)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PRO_MONTHLY=              # Personal tier is free (no price)
STRIPE_PRICE_PRO_YEARLY=
STRIPE_PRICE_ENTERPRISE_MONTHLY=
STRIPE_PRICE_ENTERPRISE_YEARLY=
```

## Database Schema

### Convex Tables (Primary for Identity, Billing, Audit)

**Identity (synced from WorkOS)**:

- **users** – `email`, `externalId`, `firstName`, `lastName`, `emailVerified`, `profilePictureUrl`, `role`, `metadata`, `expoPushToken`, `planetscaleId?`, `updatedAt`
- **organizations** – `externalId`, `name`, `metadata`, `planetscaleId?`, `updatedAt`
- **organizationDomains** – `organizationId`, `externalId`, `domain`, `status`, `updatedAt`
- **organizationMemberships** – `organizationId`, `userId`, `role?`, `status`, `updatedAt`

**Billing (synced from Stripe)**:

- **stripeCustomers** – `organizationId`, `stripeCustomerId`, `createdAt`
- **organizationSubscriptions** – `organizationId`, `stripeCustomerId`, `stripeSubscriptionId?`, `stripePriceId?`, `tier`, `status`, `billingInterval?`, `currentPeriodStart?`, `currentPeriodEnd?`, `cancelAtPeriodEnd`, `cancelAt?`, `seatLimit`, `paymentMethodBrand?`, `paymentMethodLast4?`, `pendingCheckoutSessionId?`, `pendingPriceId?`, `scheduledTier?`, `scheduledBillingInterval?`, `scheduledPriceId?`, `stripeScheduleId?`, `trialStartedAt?`, `trialEndsAt?`, `hasUsedTrial?`, `createdAt`, `updatedAt`
- **stripeWebhookEvents** – `eventId`, `eventType`, `customerId?`, `processedAt` (idempotency)

**WorkOS Events API**:

- **workosEventsCursor** – `key` (singleton), `cursor?`, `lastPolledAt`, `lastProcessedEventId?`, `updatedAt`
- **workosProcessedEvents** – `eventId`, `eventType`, `processedAt` (idempotency/deduplication)

**Sync Status**:

- **syncStatus** – `entityType` (`user`|`organization`), `entityId`, `targetSystem` (`planetscale`), `status`, `webhookEvent`, `workflowId`, `startedAt`, `completedAt?`, `durationMs?`, `error?`
- **deadLetterQueue** – `workflowId`, `entityType` (`user`|`organization`|`subscription`), `entityId`, `error`, `context?`, `createdAt`, `retryable`, `retryCount`, `lastRetryAt?`, `resolvedAt?`

**Audit Logs (Enterprise)**:

- **auditLogs** – `organizationId`, `actorId?`, `actorExternalId?`, `actorEmail?`, `actorName?`, `actorType` (`user`|`system`|`api`), `category`, `action`, `status`, `targetType?`, `targetId?`, `targetName?`, `metadata?`, `description`, `ipAddress?`, `userAgent?`, `timestamp`, `expiresAt`
- **organizationAuditSettings** – `organizationId`, `retentionDays`, `isRetentionUpgradable`, `createdAt`, `updatedAt`

**Enterprise Inquiries**:

- **enterpriseInquiries** – `firstName`, `lastName`, `email`, `phone?`, `jobTitle`, `companyName`, `companyWebsite?`, `companySize`, `industry`, `expectedUsers`, `useCase`, `currentSolution?`, `timeline`, `budget?`, `additionalRequirements?`, `interestedFeatures`, `status`, `adminNotes?`, `respondedAt?`, `respondedBy?`, `userId?`, `organizationId?`, `confirmationEmailSent`, `adminNotificationSent`, `createdAt`, `updatedAt`

**Visualization Cache (future, synced from PlanetScale)**:

- **optionShards** – (future) Dropdown option shards
- **resultCache** – (future) Compatibility result cache
- **pageDisplays** – (future) Public page display metadata

### Planetscale PostgreSQL Tables (Identity Sync)

**Identity Sync**:

- **users** – `id` (serial), `workosId`, `convexId`, `updatedAt`, `createdAt`
- **organizations** – `id` (serial), `workosId`, `convexId`, `subscriptionTier`, `subscriptionStatus`, `updatedAt`, `createdAt`

**Future: Business Data** (not yet implemented):

- Source definitions, datasets, rows
- Target definitions, datasets, rows
- Feature rules, overrides
- Public pages, compatibility results

## Supported Languages

- German (de)
- French (fr)
- Italian (it)
- Romansh (rm)
- English (en)
