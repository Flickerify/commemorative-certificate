# Change: Build Collaborative Certificate Manager

## Why

Build an enterprise-grade SaaS platform for collaborative certificate creation and management with multi-stakeholder workflows. The platform addresses the needs of universities, training companies, corporate academies, and certification bodies that require multi-role collaboration (Designer, Content, Compliance, Approver), approval workflows, audit trails, and centralized template governance. This transforms certificate management from scattered manual processes into an operational compliance and brand infrastructure with AI assistance, LMS/HRIS integrations, and verifiable digital credentials aligned with W3C standards.

## What Changes

- **Dashboard Infrastructure**: Set up authenticated dashboard shell using shadcn dashboard-01 preset with navigation for certificates, templates, collaborators, analytics, integrations, billing, and settings
- **Roles and Permissions**: Implement multi-role system (Admin, Designer, Content Editor, Approver, Viewer) with permission-based access control via WorkOS RBAC
- **Data Synchronization**: Implement Convex workflows to sync users and organizations from WorkOS/Convex to PlanetScale with monitoring, retries, and admin controls
- **Certificate Layout System**: Create a type-safe certificate layout model with W3C Verifiable Credentials alignment, version history, and template governance features
- **Collaborative Editor**: Build real-time drag-and-drop certificate editor with presence indicators, commenting system, approval workflows, and AI-suggested routing
- **Advanced AI Assistance**: Integrate AI for text rewriting, smart template generation from descriptions, bulk personalization, fraud detection, change log summaries, and approval routing suggestions
- **Certificate Issuance**: Implement certificate issuance with LMS/HRIS integrations (Moodle, Canvas, Workday, BambooHR), webhook support, LinkedIn badge sharing, and Zapier/Make automation
- **Certificate Verification**: Create public verification system with W3C VC format export, verification analytics, embeddable badges, and API endpoints
- **Analytics Dashboard**: Build analytics for certificate lifecycle metrics, verification tracking, download rates, and badge sharing activity
- **Integrations Dashboard**: Provide integration management for LMS, HR systems, and automation platforms with webhook configuration
- **Database Schema**: Design comprehensive schema for organizations, roles, certificate templates with versioning, issued certificates, audit trails, and integration records

## Impact

- **Affected specs**:
  - `dashboard` - New capability for authenticated dashboard with analytics and integrations (leverages existing Convex organizations)
  - `roles-permissions` - New capability for multi-role access control via WorkOS RBAC
  - `data-sync` - New capability for syncing users/organizations from Convex to PlanetScale via workflows with monitoring and admin controls
  - `convex-schema` - New capability extending existing Convex schema with certificate-specific tables for real-time collaboration
  - `certificate-layout` - New capability for certificate data model with W3C VC alignment and version history
  - `collaborative-editor` - New capability for real-time editing with commenting and approval workflows
  - `ai-assistance` - New capability for advanced AI features including fraud detection and bulk personalization
  - `certificate-issuance` - New capability for issuing certificates with LMS/HRIS integrations and badge sharing
  - `certificate-verification` - New capability for public verification with analytics and W3C VC format
- **Affected code**:
  - `app/` - Dashboard application routes and components
  - `lib/certificate-layout/` - Certificate types and W3C VC alignment
  - `convex/` - Convex functions for real-time collaboration and presence
  - `lib/database/` - Comprehensive database schema for multi-tenant certificate management
  - `lib/ai/` - AI integration (fraud detection, personalization, smart generation)
  - `lib/storage/` - Object storage abstraction (PDFs, images, badges)
  - `lib/integrations/` - LMS/HRIS/automation platform integrations
