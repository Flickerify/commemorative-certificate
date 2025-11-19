## ADDED Requirements

### Requirement: Certificate Issuance Workflow

The system SHALL allow users to issue certificates to recipients using certificate templates.

#### Scenario: Issue single certificate

- **WHEN** a user selects a template and provides recipient information (name, email)
- **THEN** the system creates an issued certificate record with a unique public ID
- **AND** the certificate is rendered as a PDF with recipient-specific data filled in
- **AND** a QR code linking to the verification page is embedded in the PDF
- **AND** the PDF is stored in object storage

#### Scenario: Bulk certificate issuance

- **WHEN** a user uploads a CSV file with multiple recipients or enters multiple recipients manually
- **THEN** the system processes each recipient and creates an issued certificate record
- **AND** certificates are generated asynchronously for bulk operations
- **AND** the user receives a notification when bulk issuance is complete
- **AND** any errors during bulk processing are reported

#### Scenario: Certificate email delivery

- **WHEN** a certificate is issued
- **THEN** an email is sent to the recipient with the certificate PDF attached
- **AND** the email includes a link to view and verify the certificate online
- **AND** the email uses the organization's branding if configured

### Requirement: Certificate Data Storage

The system SHALL store issued certificate records with all necessary metadata for verification and tracking.

#### Scenario: Certificate record creation

- **WHEN** a certificate is issued
- **THEN** a record is created in the database with unique ID, public ID, organization ID, template ID, subject name, subject email, metadata JSON, status (issued), issued date, and optional expiry date
- **AND** the public ID is cryptographically random and unguessable (32+ characters)

#### Scenario: Certificate metadata

- **WHEN** a certificate is issued
- **THEN** metadata includes achievement title, language, optional grade, and any custom fields from the template
- **AND** metadata is stored as JSON for flexibility

### Requirement: Certificate Status Management

The system SHALL support certificate revocation and expiry management.

#### Scenario: Revoke certificate

- **WHEN** an organization revokes a certificate
- **THEN** the certificate status is updated to "revoked" in the database
- **AND** a revocation reason and timestamp are recorded
- **AND** verification requests for the certificate show it as revoked

#### Scenario: Certificate expiry

- **WHEN** a certificate has an expiry date
- **THEN** verification requests check if the current date is past the expiry date
- **AND** expired certificates show as "expired" in verification results
- **AND** organizations can optionally send expiry reminders before the certificate expires

### Requirement: PDF Generation

The system SHALL generate PDF files from certificate layouts with recipient-specific data.

#### Scenario: PDF generation from layout

- **WHEN** a certificate is issued
- **THEN** the certificate layout is rendered as a PDF with recipient data filled into placeholders
- **AND** the PDF matches the template dimensions (e.g., A4, Letter)
- **AND** all elements (text, images, QR codes) are positioned correctly
- **AND** the PDF quality is suitable for printing

#### Scenario: QR code embedding

- **WHEN** a certificate PDF is generated
- **THEN** a QR code element is rendered linking to the verification URL
- **AND** the QR code is scannable and links to the correct verification page
- **AND** the QR code is positioned according to the template layout

### Requirement: LMS and HRIS Integration

The system SHALL integrate with Learning Management Systems and HR Information Systems for automated certificate issuance.

#### Scenario: LMS course completion trigger

- **WHEN** a student completes a course in an integrated LMS (Moodle, Canvas, Teachable)
- **THEN** the system automatically receives completion data via webhook or API
- **AND** a certificate is issued to the student based on the configured template
- **AND** the certificate is delivered via email and recorded in both systems

#### Scenario: HRIS training completion

- **WHEN** an employee completes required training in an HR system (Workday, BambooHR)
- **THEN** the system receives the completion event
- **AND** issues a certificate automatically with employee data from the HR system
- **AND** certificate records are synced back to the HR system

#### Scenario: Integration data validation

- **WHEN** certificates are issued via LMS or HRIS integration
- **THEN** the system validates that only eligible recipients receive certificates based on completion criteria
- **AND** data consistency checks ensure accurate certificate information

### Requirement: Webhook Support

The system SHALL support outgoing webhooks to notify external systems of certificate events.

#### Scenario: Certificate issued webhook

- **WHEN** a certificate is issued
- **THEN** the system sends a webhook to configured endpoints with certificate details
- **AND** webhook payload includes recipient, template, issue date, and verification URL

#### Scenario: Certificate verified webhook

- **WHEN** a certificate is verified by a third party
- **THEN** a webhook is sent with verification timestamp and verifier information if available
- **AND** organizations can track when and where their certificates are being verified

#### Scenario: Certificate expiring webhook

- **WHEN** a certificate is approaching expiration (configurable threshold)
- **THEN** a webhook is sent to alert the organization
- **AND** the organization can trigger renewal or reminder workflows

### Requirement: Badge Sharing and LinkedIn Integration

The system SHALL enable certificate recipients to share digital badges to social profiles and professional networks.

#### Scenario: Share certificate to LinkedIn

- **WHEN** a recipient views their issued certificate
- **THEN** they see a "Share to LinkedIn" button
- **AND** clicking it opens LinkedIn with pre-filled certificate details and verification link
- **AND** the certificate image or badge is attached to the post

#### Scenario: Generate shareable badge

- **WHEN** a certificate is issued
- **THEN** the system generates a shareable digital badge image optimized for social media
- **AND** the badge includes QR code for verification
- **AND** recipients can download and share the badge independently

#### Scenario: Track badge sharing

- **WHEN** recipients share certificates to social platforms
- **THEN** the system tracks sharing activity if recipient consents
- **AND** organizations can view badge sharing analytics in the dashboard

### Requirement: Automation Platform Integration

The system SHALL integrate with automation platforms like Zapier and Make for workflow automation.

#### Scenario: Zapier trigger setup

- **WHEN** an organization connects via Zapier
- **THEN** they can set up triggers for certificate issued, verified, and expiring events
- **AND** they can use actions to issue certificates from other app workflows

#### Scenario: Make integration

- **WHEN** an organization uses Make (Integromat)
- **THEN** they can create scenarios that include certificate issuance and verification actions
- **AND** certificate data can be passed to other systems in multi-step workflows
