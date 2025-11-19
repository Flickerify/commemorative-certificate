## ADDED Requirements

### Requirement: Public Certificate Verification Page

The system SHALL provide a public web page for viewing and verifying certificates.

#### Scenario: View certificate by public ID

- **WHEN** a user visits the verification URL with a certificate public ID
- **THEN** they see a page displaying the certificate details including recipient name, achievement title, issuing organization, issue date, and status
- **AND** if the certificate is valid, it displays prominently
- **AND** if the certificate is revoked or expired, the status is clearly indicated

#### Scenario: Invalid certificate ID

- **WHEN** a user visits a verification URL with an invalid or non-existent public ID
- **THEN** they see a clear error message indicating the certificate was not found
- **AND** no certificate details are displayed

### Requirement: Certificate Verification API

The system SHALL provide a machine-readable API endpoint for certificate verification.

#### Scenario: Verify valid certificate

- **WHEN** a GET request is made to `/v1/certificates/:publicId/verify`
- **THEN** the API returns a JSON response with status "valid" and certificate details (subject name, achievement title, organization name, issued date, optional expiry date)
- **AND** the response includes appropriate HTTP status code (200)

#### Scenario: Verify revoked certificate

- **WHEN** a verification request is made for a revoked certificate
- **THEN** the API returns status "revoked" with revocation date and optional reason
- **AND** certificate details are still included for reference

#### Scenario: Verify expired certificate

- **WHEN** a verification request is made for an expired certificate
- **THEN** the API returns status "expired" with the expiry date
- **AND** certificate details are still included for reference

#### Scenario: Verify non-existent certificate

- **WHEN** a verification request is made with an invalid public ID
- **THEN** the API returns status "not_found"
- **AND** no certificate details are included
- **AND** appropriate HTTP status code is returned (404)

### Requirement: QR Code Generation

The system SHALL generate QR codes that link to certificate verification pages.

#### Scenario: QR code generation

- **WHEN** a QR code is generated for a certificate
- **THEN** it encodes the verification URL (e.g., `https://app.yourdomain.com/certificates/{publicId}`)
- **AND** the QR code is scannable by standard QR code readers
- **AND** scanning the QR code opens the verification page in a browser

#### Scenario: QR code rendering

- **WHEN** a QR code is rendered in a certificate PDF or on the verification page
- **THEN** it displays as a square image with appropriate size and error correction level
- **AND** it is clearly visible and scannable

### Requirement: Verification Security

The system SHALL ensure verification is secure and prevents certificate forgery.

#### Scenario: Opaque public IDs

- **WHEN** certificates are issued
- **THEN** public IDs are cryptographically random and unguessable (32+ characters, base62 or base64)
- **AND** sequential or predictable IDs are not used

#### Scenario: Server-side verification

- **WHEN** a verification request is made
- **THEN** all verification logic runs server-side
- **AND** certificate data is retrieved from the database, not from client-provided data
- **AND** no sensitive information is exposed in URLs or client-side code

#### Scenario: Verification rate limiting

- **WHEN** verification API endpoints are accessed
- **THEN** rate limiting is applied to prevent abuse
- **AND** legitimate verification requests are not blocked
- **AND** rate limit headers are included in responses

### Requirement: Verification Analytics

The system SHALL track and report verification activity for certificates.

#### Scenario: Log verification requests

- **WHEN** a certificate is verified via the public page or API
- **THEN** the system logs the verification timestamp, IP address (anonymized), and user agent
- **AND** certificates with high verification volume are flagged for review

#### Scenario: Verification reports

- **WHEN** an organization views certificate analytics
- **THEN** they see how many times each certificate was verified
- **AND** they see verification trends over time
- **AND** they can identify certificates that are frequently verified by employers or institutions

#### Scenario: Download tracking

- **WHEN** a recipient downloads their certificate PDF
- **THEN** the download is tracked and counted
- **AND** organizations can see download rates in analytics

### Requirement: W3C Verifiable Credentials Format Support

The system SHALL support exporting certificates in W3C Verifiable Credentials format for interoperability.

#### Scenario: Export as W3C VC

- **WHEN** a user requests a certificate in W3C VC format
- **THEN** the system exports the certificate as a JSON-LD document following W3C VC 2.0 specification
- **AND** the credential includes cryptographic proof (signature) from the issuing organization
- **AND** the credential can be verified independently using W3C VC verification libraries

#### Scenario: VC metadata included

- **WHEN** a certificate is exported as a W3C VC
- **THEN** it includes credential type, issuer DID or URL, subject identifier, issuance date, and optional expiration date
- **AND** credential schema references are included for data validation

### Requirement: Public Verification Badge

The system SHALL provide embeddable verification badges for display on external websites and profiles.

#### Scenario: Generate embed code

- **WHEN** a recipient wants to display their certificate on a website
- **THEN** they can generate an embed code (iframe or script tag)
- **AND** the embedded badge shows certificate status and links to the verification page
- **AND** the badge updates automatically if the certificate is revoked or expires

#### Scenario: Widget customization

- **WHEN** a recipient embeds a verification badge
- **THEN** they can customize badge appearance (theme, size, layout)
- **AND** the badge is responsive and works on mobile and desktop
