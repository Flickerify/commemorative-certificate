# Design: Collaborative Certificate Manager

## Context

Building a multi-tenant SaaS platform for collaborative certificate creation and issuance. The system needs to support real-time collaboration, AI assistance, certificate issuance at scale, and public verification. The existing stack provides Convex for real-time data, PlanetScale for durable storage, WorkOS for authentication, and Next.js for the frontend.

## Goals / Non-Goals

### Goals

- **Multi-stakeholder workflows**: Support Designer, Content Editor, Approver, Compliance roles with approval workflows and audit trails
- **Real-time collaborative editing**: Presence indicators, cursor tracking, and commenting like Figma/Notion
- **Drag-and-drop certificate editor**: Visual canvas with AI assistance for design and content
- **Enterprise integrations**: LMS (Moodle, Canvas), HRIS (Workday, BambooHR), automation (Zapier, Make)
- **Scalable certificate issuance**: Bulk operations with AI personalization and fraud detection
- **Compliance and verifiability**: W3C VC alignment, audit trails, badge sharing to LinkedIn
- **Analytics and lifecycle**: Track verification, downloads, badge sharing, and engagement
- **Multi-tenant architecture**: Organization isolation with centralized template governance

### Non-Goals

- Blockchain/web3 integration (keeping it simple and safe; W3C VC without blockchain)
- Advanced conflict resolution (starting with last-writer-wins, can add OT/CRDT later)
- PDF editing capabilities (certificates are generated from layouts, not edited as PDFs)
- Building our own LMS or HR system (focus on integration, not replacement)

## Decisions

### Decision: Dual Storage Architecture

**What**: Use Convex for real-time collaborative editing state and PlanetScale for durable certificate records.

**Why**:

- Convex provides excellent real-time subscriptions and low-latency updates needed for collaborative editing UX
- PlanetScale provides relational query capabilities, durability, and audit trails needed for certificate issuance and verification
- Separation allows optimizing each system for its use case

**Alternatives Considered**:

- Convex only: Would work but lacks relational query power and may be more expensive at scale
- PlanetScale only: Would require polling or websockets for real-time, adding complexity

### Decision: Certificate Layout as JSON DSL

**What**: Represent certificates as structured JSON with typed elements (text, image, QR, signature) positioned on a canvas.

**Why**:

- Flexible and extensible without database schema changes
- Easy to serialize/deserialize for Convex storage
- Can be validated with TypeScript and Zod
- Enables versioning and template reuse

**Alternatives Considered**:

- HTML/CSS storage: Harder to validate and manipulate programmatically
- PDF as source: Not editable, would require conversion layers

### Decision: Opaque Public IDs for Verification

**What**: Use cryptographically random public IDs (nanoid 32+ chars) for certificate verification URLs instead of sequential IDs or blockchain hashes.

**Why**:

- Prevents enumeration attacks
- Simple to implement and verify
- No external dependencies
- Sufficient security for most use cases

**Alternatives Considered**:

- Sequential IDs: Vulnerable to enumeration
- Blockchain hashes: Adds complexity without clear benefit for MVP
- Signed tokens: More complex, opaque IDs are sufficient

### Decision: AI as Optional Enhancement

**What**: AI features are additive enhancements to the editor, not required for core functionality.

**Why**:

- Allows product to work without AI provider configured
- Users can still create certificates manually
- AI can be feature-flagged or tier-gated later

**Alternatives Considered**:

- AI-required: Would create dependency and cost concerns
- No AI: User explicitly requested AI assistance features

### Decision: Single-User Editor First, Then Collaboration

**What**: Build drag-and-drop editor with local state first, then add Convex real-time collaboration.

**Why**:

- Reduces complexity of initial implementation
- Allows validating editor UX before adding collaboration overhead
- Easier to debug and test incrementally

**Alternatives Considered**:

- Collaboration from day one: Higher risk, harder to debug
- No collaboration: User explicitly requested collaborative features

### Decision: Use WorkOS RBAC Instead of Custom Implementation

**What**: Leverage WorkOS's built-in Role-Based Access Control system for all role and permission management.

**Why**:

- WorkOS provides enterprise-grade RBAC out of the box (roles, permissions, JWT claims, audit events)
- Eliminates need to build custom roles/permissions database tables and UI
- Provides IdP integration (SSO/Directory Sync) for automatic role assignment from corporate directories
- Supports multiple roles per user and organization-level custom roles
- Includes audit trail via `organization_membership.updated` events
- Role data automatically included in JWT claims for both client and server
- WorkOS Admin Portal provides self-service role management for organization admins
- Reduces implementation complexity and maintenance burden significantly

**How it works**:

- Roles configured in WorkOS Dashboard with immutable slugs (`admin`, `designer`, `content_editor`, `approver`, `viewer`)
- Permissions follow `resource:action` naming convention (`templates:create`, `templates:approve`, etc.)
- Permissions assigned to roles in WorkOS Dashboard
- Role and permission data included in JWT access tokens after authentication
- Application reads permissions from JWT claims for authorization checks
- No custom database tables or UI needed for role management

**Alternatives Considered**:

- Custom RBAC implementation: Would require building roles, permissions, user_roles tables, assignment UI, audit logging, and API - significant effort for features WorkOS already provides
- Other auth providers without RBAC: Would still require custom implementation

**References**:

- [WorkOS RBAC Overview](https://workos.com/rbac)
- [WorkOS AuthKit Roles and Permissions](https://workos.com/docs/authkit/roles-and-permissions)
- [WorkOS RBAC Configuration](https://workos.com/docs/rbac/configuration)

## Risks / Trade-offs

### Risk: Convex and PlanetScale Data Sync

**Mitigation**:

- Use Convex for transient editing state
- On "Publish" or "Save", snapshot to PlanetScale
- Keep Convex draft for "in progress" work
- Clear Convex draft when template is finalized

### Risk: Real-time Conflict Resolution

**Mitigation**:

- Start with last-writer-wins for MVP
- Element-level updates reduce conflicts
- Consider element locking (lockedByUserId) if conflicts become problematic
- Can add operational transforms later if needed

### Risk: PDF Generation Performance

**Mitigation**:

- Use async job queue for bulk issuance
- Cache rendered templates
- Consider using React PDF or similar for consistent rendering
- Store generated PDFs in object storage (S3/R2)

### Risk: AI Provider Costs

**Mitigation**:

- Rate limit AI requests
- Cache AI suggestions
- Can be tier-gated in billing

## Migration Plan

### Phase 1: Dashboard and Layout System (Week 1)

- Set up dashboard shell
- Create certificate layout types in `lib/certificate-layout`
- Define database schema

### Phase 2: Single-User Editor (Week 2)

- Build editor UI
- Implement drag-and-drop
- Add properties panel

### Phase 3: Collaboration (Week 3)

- Add Convex real-time sync
- Implement presence indicators
- Add cursor tracking

### Phase 4: AI and Issuance (Week 4)

- Integrate AI assistance
- Build issuance workflow
- Implement verification

### Rollback Strategy

- Database schema changes are additive (no breaking changes)
- Can disable collaboration or AI features without affecting core editor

### Decision: Multi-Role Permission System

**What**: Implement predefined roles (Admin, Designer, Content Editor, Approver, Viewer) with role-based access control.

**Why**:

- Universities and corporate training programs have multi-stakeholder workflows
- Compliance and quality control require approval gates
- Audit trails are essential for regulated industries

**Alternatives Considered**:

- Custom permissions per user: Too complex for MVP, predefined roles cover 90% of use cases
- No roles: Would not differentiate from simple design tools like Canva

### Decision: LMS/HRIS Integrations as First-Class Feature

**What**: Build direct integrations with major LMS (Moodle, Canvas, Teachable) and HRIS (Workday, BambooHR) platforms.

**Why**:

- "Certificate system that just happens" when someone completes a course is real value
- Automatic eligibility validation ensures only qualified recipients get certificates
- Bidirectional sync maintains data consistency across systems

**Alternatives Considered**:

- Zapier/Make only: Adds friction and doesn't validate eligibility automatically
- Build our own LMS: Out of scope, integration is the wedge

### Decision: W3C Verifiable Credentials Without Blockchain

**What**: Align data model with W3C VC 2.0 standard but use opaque IDs and database verification instead of blockchain.

**Why**:

- W3C VC is the emerging standard for digital credentials
- Future-proofs for wallet integration without data migration
- Blockchain adds complexity and cost without clear MVP benefit
- Can add optional blockchain anchoring later as premium feature

**Alternatives Considered**:

- Blockchain-first: Too complex, scares off conservative institutions
- Proprietary format: Locks us in, W3C VC is the industry direction

### Decision: AI for Operational Value, Not Just Design

**What**: Use AI for fraud detection, bulk personalization, change summaries, and approval routing in addition to design assistance.

**Why**:

- Fraud detection (duplicate names, anomalous patterns) provides real risk mitigation
- Bulk personalization (name validation, gendered language) saves time at scale
- Change summaries and approval routing reduce workflow friction

**Alternatives Considered**:

- AI for design only: Misses opportunity to differentiate on operational value
- No AI: User explicitly requested AI as differentiator

### Decision: Badge Sharing and LinkedIn Integration

**What**: Generate shareable badge images and provide one-click LinkedIn sharing.

**Why**:

- Recipients want to showcase achievements on professional networks
- Badge sharing drives organic visibility and credibility for the platform
- Tracking badge sharing provides engagement metrics

**Alternatives Considered**:

- PDF-only: Misses social media use case, badges are more shareable
- Build our own social network: Out of scope, integrate with existing platforms

## Open Questions

- Which AI provider to use initially? (OpenAI, Anthropic, etc.)
- PDF generation library preference? (React PDF, Puppeteer, etc.)
- Object storage provider? (S3, Cloudflare R2, etc.)
- Should certificate templates be versioned in database or just in Convex drafts? **Decision: Both - drafts in Convex, published versions in PlanetScale**
- What's the maximum canvas size for certificates? (A4, Letter, custom?) **Recommendation: Start with A4 (1123x794 @ 96dpi) and Letter, add custom later**
- Which LMS integrations to prioritize? (Moodle, Canvas, Teachable) **Recommendation: Start with Moodle (open source, self-hosted market) and Canvas (edu market leader)**
- Should we support multi-step approval workflows? (e.g., Design → Compliance → Marketing) **Yes, via configurable approval routing**
