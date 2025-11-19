# Existing Foundation for Certificate Manager

This document outlines what's already implemented in the codebase that the certificate manager will build upon.

## ✅ Already Implemented

### 1. Convex Backend Foundation

**Location:** `convex/`

#### Schema (`schema.ts`)

- ✅ **users** table
  - `externalId` (WorkOS user ID)
  - `email`, `firstName`, `lastName`
  - `role` (admin/user) - will be replaced by WorkOS RBAC
  - `preferredLocale` (DE, FR, IT, RM, EN)
  - Indexed by `externalId` and `email`

- ✅ **organisations** table
  - `externalId` (WorkOS organization ID)
  - `name`
  - `metadata` (flexible key-value storage)
  - Indexed by `externalId`

- ✅ **organisationDomains** table
  - `organisationId` (Convex reference)
  - `externalId` (WorkOS domain ID)
  - `domain` (e.g., "company.com")
  - `status` (verified/pending/failed)
  - Indexed by `organisationId`, `externalId`, and `domain`

#### Functions

- ✅ **users/internal/query.ts**
  - `findByExternalId` - Look up user by WorkOS ID
  - `findByEmail` - Look up user by email

- ✅ **organisations/internal/query.ts**
  - `findByEmail` - Find organization by email domain
  - Uses `organisationDomains` table for domain-based lookup

- ✅ **users/internal/mutation.ts** and **organisations/internal/mutation.ts**
  - CRUD operations for users and organizations

### 2. WorkOS Integration

**Location:** `convex/workos/`

- ✅ WorkOS AuthKit configured (`convex/auth.config.ts`)
- ✅ WorkOS webhook handlers (`convex/workos/webhooks/`)
- ✅ Users automatically synced from WorkOS to Convex
- ✅ Organizations automatically synced from WorkOS to Convex
- ✅ Organization domains tracked and verified

### 3. Existing Infrastructure

- ✅ Convex client (`components/ConvexClientProvider.tsx`)
- ✅ Authentication flow with WorkOS
- ✅ User and organization context available in application
- ✅ Real-time subscriptions infrastructure (Convex)

## 🔨 What Needs to Be Added

### 1. PlanetScale User and Organization Tables (Synced from Convex)

**Add to `lib/database/schema/`:**

```typescript
// Users synced from WorkOS via Convex
export const users = mysqlTable('users', {
  workosExternalId: varchar('workos_external_id', { length: 255 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  firstName: varchar('first_name', { length: 255 }),
  lastName: varchar('last_name', { length: 255 }),
  emailVerified: boolean('email_verified').default(false),
  profilePictureUrl: varchar('profile_picture_url', { length: 500 }),
  syncedAt: timestamp('synced_at').defaultNow(),
});

// Organizations synced from WorkOS via Convex
export const organisations = mysqlTable('organisations', {
  workosExternalId: varchar('workos_external_id', { length: 255 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  metadata: json('metadata'),
  syncedAt: timestamp('synced_at').defaultNow(),
});
```

**Sync Pattern: WorkOS → Convex → PlanetScale**

1. WorkOS webhook received → User/Org created/updated in Convex (immediate)
2. Convex workflow triggered → User/Org synced to PlanetScale (async, within minutes)
3. Retry logic with exponential backoff for failures
4. Admin dashboard for monitoring sync status

### 2. Convex Schema Extensions

**Add to `convex/schema.ts`:**

```typescript
export const certificateLayoutDrafts = defineTable({
  organizationId: v.id('organisations'), // Link to existing org
  templateId: v.string(), // Reference to PlanetScale template
  layout: v.any(), // JSON layout data
  updatedAt: v.number(),
  updatedBy: v.string(), // WorkOS userId
});

export const certificatePresence = defineTable({
  layoutDraftId: v.id('certificateLayoutDrafts'),
  userId: v.string(), // WorkOS externalId
  displayName: v.string(),
  color: v.string(),
  cursorX: v.number(),
  cursorY: v.number(),
  selectedElementId: v.optional(v.string()),
  updatedAt: v.number(),
});

export const certificateComments = defineTable({
  layoutDraftId: v.id('certificateLayoutDrafts'),
  userId: v.string(), // WorkOS externalId
  content: v.string(),
  positionX: v.optional(v.number()),
  positionY: v.optional(v.number()),
  elementId: v.optional(v.string()),
  status: v.union(v.literal('open'), v.literal('resolved')),
  parentId: v.optional(v.id('certificateComments')),
  createdAt: v.number(),
});

export const certificateActivities = defineTable({
  organizationId: v.id('organisations'),
  templateId: v.string(),
  userId: v.string(), // WorkOS externalId
  activityType: v.string(), // "created", "edited", "commented", "approved", "published"
  metadata: v.optional(v.any()),
  timestamp: v.number(),
});
```

### 3. Convex Workflows for PlanetScale Sync

**Create `convex/workflows/` directory:**

- `syncUserToPlanetScale.ts` - Workflow to sync user from Convex to PlanetScale
- `syncOrganisationToPlanetScale.ts` - Workflow to sync organization from Convex to PlanetScale

**Update `convex/workos/webhooks/`:**

- Trigger sync workflows after Convex updates complete
- Handle workflow failures and retries

**Create `convex/actions/planetscale.ts`:**

- `upsertUser` - Insert/update user in PlanetScale using Drizzle
- `upsertOrganisation` - Insert/update organization in PlanetScale

**Add to Convex schema:**

```typescript
export const syncStatus = defineTable({
  entityType: v.union(v.literal('user'), v.literal('organisation')),
  entityId: v.string(), // WorkOS externalId
  targetSystem: v.literal('planetscale'),
  status: v.union(v.literal('pending'), v.literal('success'), v.literal('failed')),
  lastSyncedAt: v.number(),
  error: v.optional(v.string()),
});
```

### 4. Convex Functions

**Create `convex/certificates/` directory:**

- `internal/query.ts` - Query functions for drafts, presence, comments
- `internal/mutation.ts` - Mutations for editing, commenting, presence updates
- `internal/action.ts` - Actions for publishing to PlanetScale

### 5. PlanetScale Certificate Schema (New)

**Create in `lib/database/schema/`:**

- `users` - Synced from Convex (workos_external_id as PK)
- `organisations` - Synced from Convex (workos_external_id as PK)
- `organizations_settings` - Brand guidelines, billing (references organisations.workos_external_id)
- `certificate_templates` - Published templates (references users.workos_external_id for createdBy)
- `template_versions` - Version history
- `issued_certificates` - Issued certificates with W3C VC fields
- `certificate_events` - Audit trail
- `integrations` - LMS/HRIS connections
- `webhooks` - Outgoing webhook configs
- `verification_logs` - Analytics

### 6. New Libraries

- `lib/certificate-layout/` - Certificate types and helpers
- `lib/ai/` - AI integration
- `lib/storage/` - Object storage (S3/R2) for PDFs and images
- `lib/integrations/` - LMS/HRIS adapters

### 7. Application Routes

**In `app/(app)/`:**

- Dashboard pages (overview, certificates, templates, analytics, integrations)
- Certificate editor (`templates/[id]/edit`)
- Verification page (public route for certificate verification)

## 🔄 Integration Pattern

### User & Organization Lookup

```typescript
// Existing pattern (already works)
import { api } from '@/convex/_generated/api';

// In React components
const user = useQuery(api.users.internal.query.findByExternalId, {
  externalId: session.user.id, // from WorkOS
});

const org = useQuery(api.organisations.internal.query.findByEmail, {
  email: session.user.email,
});

// In Convex functions
const user = await ctx.db
  .query('users')
  .withIndex('by_external_id', (q) => q.eq('externalId', userId))
  .first();
```

### New Certificate Pattern

```typescript
// New pattern to implement
import { api } from '@/convex/_generated/api';

// In editor component
const draft = useQuery(api.certificates.internal.query.getDraftById, {
  draftId: id,
});

const presence = useQuery(api.certificates.internal.query.getPresenceByDraftId, {
  draftId: id,
});

const updateLayout = useMutation(api.certificates.internal.mutation.createOrUpdateDraft);
```

## 📋 Migration Notes

### WorkOS RBAC vs Existing Role Field

- **Current:** `users.role` field with "admin"/"user" values in Convex
- **Future:** Use WorkOS RBAC with `admin`, `designer`, `content_editor`, `approver`, `viewer` roles
- **Migration:**
  - Keep existing `users.role` field for backward compatibility
  - Add WorkOS RBAC roles via WorkOS Dashboard
  - Read permissions from JWT claims instead of Convex `users.role`
  - Eventually deprecate Convex `users.role` field

### Organization Settings

- **Current:** `organisations.metadata` for flexible storage
- **Future:** Dedicated `organizations_settings` table in PlanetScale for certificate-specific settings (brand guidelines, templates, etc.)
- **Pattern:** Link via WorkOS `externalId` between Convex and PlanetScale

## 🎯 Next Steps

1. ✅ Review existing Convex structure (DONE)
2. ⬜ **Implement WorkOS to PlanetScale sync workflows** (PRIORITY - ensures data consistency)
   - Create PlanetScale users and organisations tables
   - Implement Convex workflows with retry logic
   - Add sync status tracking
   - Build admin monitoring dashboard
   - Run backfill for existing data
3. ⬜ Configure WorkOS RBAC roles and permissions in WorkOS Dashboard
4. ⬜ Extend Convex schema with certificate tables
5. ⬜ Create certificate Convex functions (queries, mutations)
6. ⬜ Design PlanetScale schema for certificate templates and issuance
7. ⬜ Build certificate editor using existing Convex real-time infrastructure
8. ⬜ Implement certificate issuance and verification
