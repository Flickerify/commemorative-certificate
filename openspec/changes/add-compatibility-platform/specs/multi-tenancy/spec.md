# Capability: Multi-Tenancy

Multi-tenant architecture where WorkOS organizations serve as tenants with data isolation, subdomain routing, and usage limits.

## ADDED Requirements

### Requirement: Organization as Tenant

The system SHALL treat each WorkOS organization as a tenant with isolated data.

#### Scenario: Data isolation by organization
- **GIVEN** an organization with ID `org_123`
- **WHEN** any data is created (sources, targets, rules, pages)
- **THEN** the data MUST include `organizationId: org_123`
- **AND** queries for that data MUST filter by `organizationId`

#### Scenario: Cross-tenant data access prevention
- **GIVEN** user A is a member of organization `org_A`
- **AND** user B is a member of organization `org_B`
- **WHEN** user A queries for sources
- **THEN** only sources with `organizationId: org_A` are returned
- **AND** sources from `org_B` are NOT accessible

---

### Requirement: Organization Plan Tiers

The system SHALL support multiple plan tiers with different capabilities.

#### Scenario: Plan tier storage
- **GIVEN** an organization
- **WHEN** the organization is created or updated
- **THEN** the `planTier` field MUST be one of: `personal`, `team`, `enterprise`
- **AND** `personal` is the default for new organizations

#### Scenario: Plan tier determines features
- **GIVEN** an organization with `planTier: personal`
- **WHEN** the user attempts to configure a custom subdomain
- **THEN** the system MUST reject the request with "Custom subdomains require a paid plan"

---

### Requirement: Usage Limits

The system SHALL enforce usage limits based on organization plan tier.

#### Scenario: Personal organization limits
- **GIVEN** an organization with `planTier: personal`
- **THEN** the following limits apply:
  - Maximum 2 source schemas
  - Maximum 2 target schemas
  - Maximum 1,000 source rows per dataset
  - Maximum 100 target rows per dataset
  - Maximum 4 dimensions per schema
  - Maximum 10 rules per page
  - Custom subdomain: disabled

#### Scenario: Limit enforcement on create
- **GIVEN** an organization with `planTier: personal`
- **AND** the organization has 2 source schemas
- **WHEN** the user attempts to create a 3rd source schema
- **THEN** the system MUST reject with "Source schema limit reached (2/2)"

#### Scenario: Limit check returns current usage
- **GIVEN** an organization with usage data
- **WHEN** the `organizationLimits` query is called
- **THEN** the response MUST include:
  - Current count for each limited resource
  - Maximum allowed for each limited resource
  - Percentage utilization

---

### Requirement: Subdomain Routing

The system SHALL route requests based on subdomain to the appropriate tenant.

#### Scenario: Subdomain detection in production
- **GIVEN** the production domain is `flickerify.com`
- **WHEN** a request arrives at `acme.flickerify.com/vehicle-compat`
- **THEN** the middleware MUST extract subdomain `acme`
- **AND** lookup the organization with `customSubdomain: acme`
- **AND** rewrite the request to `/[domain]/vehicle-compat` with organization context

#### Scenario: Subdomain detection in development
- **GIVEN** the development server runs on `localhost:3000`
- **WHEN** a request arrives at `acme.localhost:3000/vehicle-compat`
- **THEN** the middleware MUST extract subdomain `acme`
- **AND** route to the tenant page

#### Scenario: Invalid subdomain handling
- **GIVEN** a request to `unknown.flickerify.com`
- **WHEN** no organization has `customSubdomain: unknown`
- **THEN** the system MUST return a 404 page with "Organization not found"

#### Scenario: Main domain access
- **GIVEN** a request to `flickerify.com` (no subdomain)
- **WHEN** the request is processed
- **THEN** the middleware MUST route to the main marketing/app pages
- **AND** NOT attempt tenant lookup

---

### Requirement: Custom Subdomain Registration

Paid organizations SHALL be able to register a custom subdomain.

#### Scenario: Subdomain registration for paid org
- **GIVEN** an organization with `planTier: team` or `enterprise`
- **WHEN** the admin sets `customSubdomain: acme`
- **THEN** the system MUST validate the subdomain is:
  - Lowercase alphanumeric with hyphens
  - Between 3-63 characters
  - Not a reserved word (admin, api, www, app, etc.)
  - Unique across all organizations
- **AND** store the subdomain on the organization record

#### Scenario: Subdomain registration for personal org
- **GIVEN** an organization with `planTier: personal`
- **WHEN** the admin attempts to set a custom subdomain
- **THEN** the system MUST reject with "Custom subdomains require a paid plan"

#### Scenario: Subdomain uniqueness
- **GIVEN** organization A has `customSubdomain: acme`
- **WHEN** organization B attempts to set `customSubdomain: acme`
- **THEN** the system MUST reject with "Subdomain already taken"

---

### Requirement: Tenant Context Propagation

The system SHALL propagate tenant context through the request lifecycle.

#### Scenario: Organization ID in Convex context
- **GIVEN** a user authenticated via WorkOS
- **AND** the user has selected an organization
- **WHEN** the user calls a Convex function
- **THEN** the `ctx.user` MUST include the active `organizationId`
- **AND** all data operations MUST scope to that organization

#### Scenario: Organization context in public pages
- **GIVEN** a public page request via subdomain
- **WHEN** the middleware resolves the organization
- **THEN** the organization ID MUST be available in:
  - Server components via headers
  - Client components via context provider
  - Convex queries via function arguments

