## 1. Dashboard Setup

- [x] 1.1 Initialize shadcn/ui in `components/ui` if not already done
- [x] 1.2 Add dashboard-01 preset: `npx shadcn@latest add dashboard-01`
- [x] 1.3 Create authenticated route group `(app)/` with layout wrapper
- [x] 1.4 Create navigation configuration with certificate-related menu items (including Analytics and Integrations)
- [x] 1.5 Wire dashboard shell into authenticated layout
- [x] 1.6 Create overview dashboard page with stats cards, recent activity, and role-specific views
- [x] 1.7 Create placeholder pages for certificates, templates, collaborators, billing, settings routes
- [x] 1.8 Create analytics dashboard page with metrics and charts
- [x] 1.9 Create integrations dashboard page for managing external connections
- [x] 1.10 Install WorkOS Widgets package (@workos-inc/widgets) using bun
- [x] 1.11 Install WorkOS Widgets peer dependencies (@radix-ui/themes, @tanstack/react-query)
- [x] 1.12 Create organization page with WorkOS UsersManagement and OrganizationSwitcher widgets
- [x] 1.13 Create API route for generating WorkOS widget tokens (/api/widgets/token/route.ts)

## 2. WorkOS RBAC Configuration

- [ ] 2.1 Configure environment roles in WorkOS Dashboard (`admin`, `designer`, `content_editor`, `approver`, `viewer`)
- [ ] 2.2 Define permissions in WorkOS with naming convention (`templates:create`, `templates:edit`, `templates:approve`, `certificates:issue`, `certificates:revoke`, `analytics:view`, `integrations:manage`, `billing:manage`)
- [ ] 2.3 Assign permissions to each role in WorkOS Dashboard based on access requirements
- [ ] 2.4 Set default role to `viewer` in WorkOS environment settings
- [ ] 2.5 Enable multiple roles feature in WorkOS environment settings for cross-functional collaboration
- [ ] 2.6 Create TypeScript types for role and permission slugs in `lib/auth`
- [ ] 2.7 Implement permission checking utilities that read from WorkOS JWT claims
- [ ] 2.8 Add role-based route protection middleware using WorkOS session data
- [ ] 2.9 Implement helper functions (hasPermission, hasRole, requirePermission) for permission checks
- [ ] 2.10 Subscribe to WorkOS `organization_membership.updated` webhook for role change events
- [ ] 2.11 Display role information from WorkOS in Collaborators page UI (read-only view)
- [ ] 2.12 Add permission-based UI rendering (conditionally show/hide based on JWT permissions)
- [ ] 2.13 Implement server-side permission validation for API routes
- [ ] 2.14 Implement audit trail viewer using WorkOS events (no custom schema needed)
- [ ] 2.15 Document WorkOS Admin Portal usage for organization admins to manage roles

## 2.5. WorkOS to PlanetScale Sync (via Convex Workflows)

- [ ] 2.5.1 Design PlanetScale schema for users table (workos_external_id as primary key, email, first_name, last_name, synced_at)
- [ ] 2.5.2 Design PlanetScale schema for organisations table (workos_external_id as primary key, name, metadata, synced_at)
- [ ] 2.5.3 Create Drizzle schema files for users and organisations in `lib/database/schema/`
- [ ] 2.5.4 Create Convex workflow `syncUserToPlanetScale` in `convex/workflows/syncUserToPlanetScale.ts`
  - [ ] 2.5.4.1 Input: WorkOS user data from webhook
  - [ ] 2.5.4.2 Step 1: Validate user exists in Convex
  - [ ] 2.5.4.3 Step 2: Upsert user to PlanetScale via API action
  - [ ] 2.5.4.4 Step 3: Handle retries and failures with exponential backoff
  - [ ] 2.5.4.5 Step 4: Log sync status to Convex for monitoring
- [ ] 2.5.5 Create Convex workflow `syncOrganisationToPlanetScale` in `convex/workflows/syncOrganisationToPlanetScale.ts`
  - [ ] 2.5.5.1 Input: WorkOS organization data from webhook
  - [ ] 2.5.5.2 Step 1: Validate organization exists in Convex
  - [ ] 2.5.5.3 Step 2: Upsert organization to PlanetScale via API action
  - [ ] 2.5.5.4 Step 3: Handle retries and failures with exponential backoff
  - [ ] 2.5.5.5 Step 4: Log sync status to Convex for monitoring
- [ ] 2.5.6 Update existing WorkOS webhook handlers in `convex/workos/webhooks/`:
  - [ ] 2.5.6.1 On user.created or user.updated → trigger syncUserToPlanetScale workflow
  - [ ] 2.5.6.2 On organization.created or organization.updated → trigger syncOrganisationToPlanetScale workflow
  - [ ] 2.5.6.3 Ensure Convex updates happen first, then workflow triggers
- [ ] 2.5.7 Create PlanetScale API actions in `convex/actions/planetscale.ts`:
  - [ ] 2.5.7.1 `upsertUser` - Insert or update user in PlanetScale
  - [ ] 2.5.7.2 `upsertOrganisation` - Insert or update organization in PlanetScale
  - [ ] 2.5.7.3 Use Drizzle ORM for database operations
  - [ ] 2.5.7.4 Handle database connection errors gracefully
- [ ] 2.5.8 Add sync status tracking table in Convex schema:
  - [ ] 2.5.8.1 `syncStatus` table with entityType, entityId, targetSystem, status, lastSyncedAt, error
  - [ ] 2.5.8.2 Index by entityType and entityId for quick lookups
- [ ] 2.5.9 Create admin dashboard page for monitoring sync status
  - [ ] 2.5.9.1 Display failed syncs with retry buttons
  - [ ] 2.5.9.2 Show sync lag time between Convex and PlanetScale
  - [ ] 2.5.9.3 Manual sync trigger for individual users/orgs
- [ ] 2.5.10 Implement backfill script for existing users/orgs:
  - [ ] 2.5.10.1 Query all users from Convex
  - [ ] 2.5.10.2 Trigger syncUserToPlanetScale workflow for each
  - [ ] 2.5.10.3 Same for organizations
  - [ ] 2.5.10.4 Run via Convex CLI or admin endpoint

## 3. Certificate Layout Library

- [ ] 3.1 Create `lib/certificate-layout/` structure
- [ ] 3.2 Define TypeScript types for certificate elements (text, image, QR, signature, shape)
- [ ] 3.3 Define CertificateLayout interface with elements array
- [ ] 3.4 Add W3C Verifiable Credentials data model alignment
- [ ] 3.5 Create helper functions (createEmptyLayout, validateLayout)
- [ ] 3.6 Export types and utilities

## 4. Database Schema (PlanetScale)

- [x] 4.1 Organizations foundation already exists (users, organisations, organisationDomains in Convex)
- [ ] 4.2 Design schema for organizations_settings table in PlanetScale (brand guidelines, billing, integrations) - uses WorkOS organizationId as foreign key
- [ ] 4.3 Design schema for certificate_templates table with version tracking (include createdBy userId from WorkOS)
- [ ] 4.4 Design schema for template_versions table (for version history with author WorkOS userId)
- [ ] 4.5 Design schema for issued_certificates table with W3C VC fields
- [ ] 4.6 Design schema for certificate_events table (for audit logs, includes WorkOS role change events)
- [ ] 4.7 Design schema for integrations table (LMS/HRIS connections per organization)
- [ ] 4.8 Design schema for webhooks table (outgoing webhook configs)
- [ ] 4.9 Design schema for verification_logs table (analytics)
- [ ] 4.10 Create Drizzle schema files in `lib/database/schema/`
- [ ] 4.11 Generate and run database migrations
- [ ] 4.12 Note: No custom roles/permissions tables needed (fully managed by WorkOS RBAC)
- [ ] 4.13 Note: Users and organizations core data in Convex, certificate-specific data in PlanetScale

## 5. Collaborative Editor Foundation

- [ ] 5.1 Create certificate editor page route: `(app)/templates/[id]/edit`
- [ ] 5.2 Build CertificateEditor component shell (sidebar, canvas, properties panel layout)
- [ ] 5.3 Implement CertificateCanvas component with basic element rendering
- [ ] 5.4 Implement element selection and basic positioning
- [ ] 5.5 Add drag functionality for elements (using dnd-kit or custom implementation)
- [ ] 5.6 Add resize handles for elements
- [ ] 5.7 Create properties panel component for selected element editing
- [ ] 5.8 Implement commenting system UI and data model
- [ ] 5.9 Add comment threads and replies functionality
- [ ] 5.10 Implement approval workflow UI (submit, approve, request changes)

## 6. Convex Real-time Collaboration

- [x] 6.1 Convex foundation already exists (users, organisations, organisationDomains tables and queries)
- [ ] 6.2 Extend Convex schema in `convex/schema.ts` with certificate tables:
  - [ ] 6.2.1 Add `certificateLayoutDrafts` table
  - [ ] 6.2.2 Add `certificatePresence` table
  - [ ] 6.2.3 Add `certificateComments` table
  - [ ] 6.2.4 Add `certificateActivities` table
  - [ ] 6.2.5 Add appropriate indexes for each table
- [ ] 6.3 Create `convex/certificates/` directory structure
- [ ] 6.4 Create Convex query functions in `certificates/internal/query.ts`:
  - [ ] 6.4.1 `getDraftById` - get draft layout by ID
  - [ ] 6.4.2 `getPresenceByDraftId` - get all active users editing a draft
  - [ ] 6.4.3 `getCommentsByDraftId` - get comments for a draft
  - [ ] 6.4.4 `getActivitiesByTemplateId` - get activity feed
- [ ] 6.5 Create Convex mutation functions in `certificates/internal/mutation.ts`:
  - [ ] 6.5.1 `createOrUpdateDraft` - save draft layout changes
  - [ ] 6.5.2 `updatePresence` - update user cursor/selection
  - [ ] 6.5.3 `createComment` - add new comment
  - [ ] 6.5.4 `replyToComment` - add reply to existing comment
  - [ ] 6.5.5 `resolveComment` - mark comment as resolved
  - [ ] 6.5.6 `logActivity` - record template activity
  - [ ] 6.5.7 `publishDraft` - mark draft as published (before PlanetScale sync)
  - [ ] 6.5.8 `discardDraft` - delete draft and associated data
- [ ] 6.6 Wire Convex queries/mutations into CertificateEditor component
- [ ] 6.7 Implement presence indicators showing active collaborators (using existing user data)
- [ ] 6.8 Add cursor tracking and display for other users
- [ ] 6.9 Implement activity feed with real-time updates

## 7. Template Version History and Governance

- [ ] 7.1 Implement version creation on template publish
- [ ] 7.2 Create version history viewer component
- [ ] 7.3 Implement visual diff viewer for version comparison
- [ ] 7.4 Add revert to previous version functionality
- [ ] 7.5 Implement brand guidelines configuration UI
- [ ] 7.6 Add brand guidelines validation in editor

## 8. AI Assistance Library

- [ ] 8.1 Create `lib/ai/` structure
- [ ] 8.2 Define AI service interface and environment variable validation
- [ ] 8.3 Implement text rewriting function (rewriteCertificateText)
- [ ] 8.4 Implement smart template generation from description
- [ ] 8.5 Implement bulk personalization (name validation, gendered language handling)
- [ ] 8.6 Implement fraud detection (duplicate detection, anomaly detection)
- [ ] 8.7 Implement AI change log summaries
- [ ] 8.8 Implement AI approval routing suggestions
- [ ] 8.9 Create AI client wrapper (OpenAI/Anthropic/etc.)
- [ ] 8.10 Add AI actions to text element properties panel
- [ ] 8.11 Add loading states and error handling for AI operations

## 9. Object Storage Library

- [ ] 9.1 Create `lib/storage/` structure
- [ ] 9.2 Implement S3/R2 client wrapper
- [ ] 9.3 Add PDF upload and storage functions
- [ ] 9.4 Add image upload and storage functions
- [ ] 9.5 Add badge image storage functions
- [ ] 9.6 Implement signed URL generation for secure access

## 10. Certificate Issuance

- [ ] 10.1 Create certificate issuance page/component
- [ ] 10.2 Implement bulk recipient input (CSV upload or form)
- [ ] 10.3 Integrate AI bulk personalization into issuance workflow
- [ ] 10.4 Create Convex mutation or API endpoint for certificate issuance
- [ ] 10.5 Generate unique publicId for each certificate
- [ ] 10.6 Store issued certificates in database with W3C VC fields
- [ ] 10.7 Implement PDF generation from certificate layout
- [ ] 10.8 Generate shareable badge images for social media
- [ ] 10.9 Embed QR code with verification URL in PDF
- [ ] 10.10 Implement email delivery for issued certificates
- [ ] 10.11 Add LinkedIn share button and integration
- [ ] 10.12 Implement outgoing webhooks for certificate issued events

## 11. LMS and HRIS Integrations Library

- [ ] 11.1 Create `lib/integrations/` structure
- [ ] 11.2 Implement Moodle integration adapter
- [ ] 11.3 Implement Canvas LMS integration adapter
- [ ] 11.4 Implement Teachable integration adapter
- [ ] 11.5 Implement Workday integration adapter
- [ ] 11.6 Implement BambooHR integration adapter
- [ ] 11.7 Create integration configuration UI
- [ ] 11.8 Implement webhook receiver for LMS/HRIS events
- [ ] 11.9 Add data validation for integration payloads

## 12. Automation Platform Integrations

- [ ] 12.1 Design Zapier integration API
- [ ] 12.2 Implement Zapier triggers (certificate issued, verified, expiring)
- [ ] 12.3 Implement Zapier actions (issue certificate)
- [ ] 12.4 Design Make (Integromat) integration API
- [ ] 12.5 Implement Make triggers and actions
- [ ] 12.6 Create integration documentation for Zapier and Make

## 13. Webhooks System

- [ ] 13.1 Implement webhook configuration UI
- [ ] 13.2 Create webhook delivery queue system
- [ ] 13.3 Implement webhook signing for security
- [ ] 13.4 Add webhook retry logic with exponential backoff
- [ ] 13.5 Create webhook logs and monitoring UI
- [ ] 13.6 Implement webhook test endpoint

## 14. Certificate Verification

- [ ] 14.1 Create public verification page route: `/certificates/[publicId]`
- [ ] 14.2 Create API endpoint: `GET /api/v1/certificates/:publicId/verify`
- [ ] 14.3 Implement verification logic (check status, expiry, revocation)
- [ ] 14.4 Create verification response format (valid/revoked/expired/not_found)
- [ ] 14.5 Add QR code generation utility
- [ ] 14.6 Style verification page with certificate details display
- [ ] 14.7 Implement W3C VC format export endpoint
- [ ] 14.8 Log verification requests for analytics
- [ ] 14.9 Create embeddable verification badge widget
- [ ] 14.10 Add badge customization options

## 15. Analytics System

- [ ] 15.1 Implement verification event logging
- [ ] 15.2 Implement download tracking
- [ ] 15.3 Implement badge sharing tracking
- [ ] 15.4 Create analytics aggregation queries
- [ ] 15.5 Build analytics dashboard UI with charts
- [ ] 15.6 Add date range filtering
- [ ] 15.7 Implement analytics export (CSV)
- [ ] 15.8 Add real-time metrics updates

## 16. Testing

- [ ] 16.1 Write unit tests for certificate layout types and helpers
- [ ] 16.2 Write unit tests for role and permission utilities
- [ ] 16.3 Write unit tests for AI service functions
- [ ] 16.4 Write unit tests for integration adapters
- [ ] 16.5 Write integration tests for Convex collaboration functions
- [ ] 16.6 Write integration tests for verification API endpoint
- [ ] 16.7 Write integration tests for webhook delivery
- [ ] 16.8 Write component tests for CertificateEditor
- [ ] 16.9 Write component tests for dashboard pages
- [ ] 16.10 Write component tests for approval workflows
- [ ] 16.11 Write E2E tests for complete certificate issuance flow

## 17. Documentation

- [ ] 17.1 Document certificate layout data model and W3C VC alignment
- [ ] 17.2 Document roles and permissions system
- [ ] 17.3 Document Convex collaboration API
- [ ] 17.4 Document verification API endpoint
- [ ] 17.5 Document webhook API and event formats
- [ ] 17.6 Document LMS/HRIS integration setup
- [ ] 17.7 Add README for certificate-layout library
- [ ] 17.8 Add README for ai library
- [ ] 17.9 Add README for integrations library
- [ ] 17.10 Create user guide for multi-stakeholder workflows
