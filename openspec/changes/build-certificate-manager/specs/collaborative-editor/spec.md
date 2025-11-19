## ADDED Requirements

### Requirement: Certificate Editor Interface

The system SHALL provide a visual editor for creating and editing certificate layouts with drag-and-drop functionality.

#### Scenario: Editor loads certificate template

- **WHEN** a user opens the certificate editor for a template
- **THEN** they see a canvas displaying the certificate layout with all elements positioned correctly
- **AND** they see a sidebar with element list and add buttons
- **AND** they see a properties panel on the right side

#### Scenario: Element selection

- **WHEN** a user clicks on an element in the canvas
- **THEN** the element becomes selected with visual indicators (border, handles)
- **AND** the properties panel displays the selected element's properties for editing

#### Scenario: Element dragging

- **WHEN** a user drags a selected element
- **THEN** the element moves to the new position in real-time
- **AND** the element's x and y coordinates are updated
- **AND** other collaborators see the element move in real-time

#### Scenario: Element resizing

- **WHEN** a user drags a resize handle on a selected element
- **THEN** the element's width and/or height updates in real-time
- **AND** the element maintains its aspect ratio if shift is held (for images)
- **AND** other collaborators see the resize in real-time

### Requirement: Real-time Collaboration

The system SHALL enable multiple users to edit the same certificate template simultaneously with presence indicators.

#### Scenario: Multiple users editing

- **WHEN** multiple users open the same certificate template for editing
- **THEN** each user sees presence indicators showing who else is currently editing
- **AND** each user sees cursors or selection indicators for other active collaborators
- **AND** changes made by one user appear in real-time for all other users

#### Scenario: Presence tracking

- **WHEN** a user opens the editor
- **THEN** their presence is recorded in the system
- **AND** when they close the editor or become inactive, their presence is removed after a timeout

#### Scenario: Real-time updates

- **WHEN** a user makes a change to the certificate layout (moves element, edits text, etc.)
- **THEN** the change is immediately synced to Convex
- **AND** all other active collaborators receive the update within seconds
- **AND** the local UI updates to reflect the change

### Requirement: Element Management

The system SHALL allow users to add, remove, duplicate, and reorder elements in the certificate layout.

#### Scenario: Adding elements

- **WHEN** a user clicks "Add Text" or "Add Image" in the sidebar
- **THEN** a new element of that type is created with default properties
- **AND** the element is positioned at a default location on the canvas
- **AND** the element is automatically selected

#### Scenario: Removing elements

- **WHEN** a user selects an element and presses Delete or clicks Remove
- **THEN** the element is removed from the layout
- **AND** the change is synced to all collaborators

#### Scenario: Duplicating elements

- **WHEN** a user duplicates a selected element
- **THEN** a copy of the element is created with a new ID
- **AND** the copy is offset slightly from the original
- **AND** the copy is automatically selected

#### Scenario: Element ordering

- **WHEN** a user changes an element's z-index or uses "Bring to Front" / "Send to Back"
- **THEN** the element's visual stacking order updates
- **AND** the change is synced to all collaborators

### Requirement: Properties Panel

The system SHALL provide a properties panel for editing selected element properties.

#### Scenario: Text element properties

- **WHEN** a text element is selected
- **THEN** the properties panel shows fields for content, font family, font size, font weight, color, and alignment
- **AND** changes to these properties update the element in real-time on the canvas

#### Scenario: Image element properties

- **WHEN** an image element is selected
- **THEN** the properties panel shows fields for image source URL and object fit mode
- **AND** users can upload or select an image from their organization's assets

#### Scenario: Element locking

- **WHEN** a user locks an element
- **THEN** the element cannot be moved or edited by other collaborators
- **AND** the locked element displays a lock icon indicator

### Requirement: Commenting and Annotations

The system SHALL provide commenting capabilities for collaborative feedback and discussion on certificate templates.

#### Scenario: Add comment to template

- **WHEN** a user clicks on the canvas or an element and selects "Add Comment"
- **THEN** they can write a comment that is anchored to that position or element
- **AND** the comment is visible to all collaborators with a visual indicator

#### Scenario: Reply to comments

- **WHEN** a user views a comment
- **THEN** they can reply to create a threaded discussion
- **AND** comment authors are notified of replies

#### Scenario: Resolve comments

- **WHEN** a comment discussion is complete
- **THEN** users can mark the comment as resolved
- **AND** resolved comments are hidden by default but can be viewed in a filter

### Requirement: Approval Workflow

The system SHALL support approval workflows for certificate templates with role-based routing.

#### Scenario: Submit template for approval

- **WHEN** a designer completes a template and submits for approval
- **THEN** the template status changes to "Pending Approval"
- **AND** designated approvers are notified
- **AND** the template cannot be edited while in approval

#### Scenario: Approve template

- **WHEN** an approver reviews and approves a template
- **THEN** the template status changes to "Approved"
- **AND** the template can be used for certificate issuance
- **AND** the approval is recorded in the audit trail with approver name and timestamp

#### Scenario: Request changes

- **WHEN** an approver requests changes to a template
- **THEN** they can leave comments explaining required changes
- **AND** the template is returned to the designer
- **AND** the designer receives a notification

#### Scenario: AI-suggested approval routing

- **WHEN** a user prepares to submit a template for approval
- **THEN** the system analyzes the template and suggests appropriate approvers (e.g., "This public-facing certificate requires Marketing + Compliance approval")
- **AND** the user can accept or modify the suggested routing

### Requirement: Activity Feed and Change Log

The system SHALL provide an activity feed showing all changes and actions on certificate templates.

#### Scenario: View activity feed

- **WHEN** a user views a template's activity feed
- **THEN** they see a chronological list of all changes, comments, approvals, and version updates
- **AND** each activity shows the actor, timestamp, and description

#### Scenario: AI-generated change summaries

- **WHEN** a user views the activity feed for a period with multiple changes
- **THEN** the system can generate an AI summary like "Here are the three changes made to the Sales Bootcamp certificate this week"
- **AND** the summary highlights significant changes and key collaborators
