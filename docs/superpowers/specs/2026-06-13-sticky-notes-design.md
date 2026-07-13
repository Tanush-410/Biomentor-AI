# VYDRA CORE Sticky Notes Design

Date: 2026-06-13

## Goal

Add a private `Sticky Notes` system to VYDRA CORE that lets both students and educators right-click anywhere in the app and create colorful draggable notes that:

- stay tied to the exact user-facing page route where they were created
- persist across logout and login
- remain private to the creator
- feel lightweight and fast enough to use as an everyday thinking layer across the platform

The feature should feel embedded into the product rather than like an external widget.

## Product Decisions

- Primary model: `Private page-scoped sticky notes`
- Notes are tied to the exact normalized user-facing route the user is on when the note is created
- Notes are private and only visible to the creator
- Notes are created from a custom right-click menu inside the app shell
- Notes are draggable after creation
- Notes support colorful themes instead of a single default style
- Placement is stable:
  - placement is stored as document-relative pixel coordinates
  - notes never auto-rearrange after creation, reload, or resize
  - notes remain attached to their document location while the user scrolls
  - overlapping notes are allowed
  - legacy viewport-ratio notes migrate once to document coordinates when loaded
- Notes persist until the user deletes them

## Scope

### In scope

- right-click to create note
- page-specific note loading
- private note persistence in backend
- draggable notes
- colorful note themes
- title and body editing
- delete note
- resize-safe layout behavior
- support for both educator and student surfaces
- app-wide integration through shared shell

### Out of scope

- shared or collaborative sticky notes
- classroom-wide annotation boards
- note mentions or notifications
- attachment uploads inside sticky notes
- version history
- offline-only local note storage as the primary source of truth

## Product Principles

### 1. Notes should live where thinking happens

Users should not have to open a separate notes page. The note should belong to the page they are actively using.

### 2. Private means private

Sticky notes are personal working memory, not classroom content. No other student or educator should be able to see them.

### 3. The interaction should feel instant

Creating a note should feel as lightweight as placing a real sticky note on a desk.

### 4. Placement should remain trustworthy

Users should find each note where they placed it. The application must not move notes to avoid overlap. If a smaller viewport would place part of a note off-screen, the rendered position may be temporarily clamped for usability, while the stored position remains unchanged.

### 5. It should respect core product flows

The sticky note layer should not interfere with quizzes, exams, rich text entry, or other critical interactions.

## User Flows

## Student flow

### Create a note on a page

1. Student opens any page in the product.
2. Student right-clicks in the main content area.
3. A small custom menu appears with `Add Sticky Note`.
4. Student clicks `Add Sticky Note`.
5. A colorful note appears near the click location in edit mode.
6. Student enters:
   - optional title
   - note text
7. The note auto-saves and stays tied to that exact page URL.

### Revisit a page later

1. Student logs out and comes back later.
2. Student returns to the same page URL.
3. The previously created private notes reload automatically.

### Move or delete a note

1. Student drags the note to a new position.
2. System stores the updated document placement.
3. The note remains in that position across reload, logout, and login.
4. Student can delete the note permanently when it is no longer needed.

## Educator flow

### Use notes across teaching workflows

1. Educator opens classroom, materials, classwork, certification, exam, or dashboard pages.
2. Educator creates sticky notes to track reminders, observations, or personal planning context.
3. Notes remain visible only to that educator on those exact pages.

## UX Placement

## Primary mounting point

The feature should mount inside the shared application shell so it can work across:

- student dashboard pages
- educator dashboard pages
- classroom surfaces
- materials and study pages
- assessment and certification pages

## Interaction model

### Right-click behavior

- Right-click in eligible empty page space opens the sticky note context menu
- Right-click should not override native context behavior inside:
  - input fields
  - textareas
  - contenteditable surfaces
  - rich document builders
  - native browser PDF text selection contexts when doing so would break usability

### Visual style

Notes should feel like premium VYDRA CORE-native stationery rather than generic browser widgets.

Recommended note palette:

- warm amber
- soft coral
- dusty sage
- pale sky
- lavender sand
- blush cream

### Note content model

Each note should support:

- short title
- message body
- color theme

## Technical Architecture

## High-level model

Sticky notes should be a lightweight personal productivity layer with three parts:

- `Frontend note layer`
- `Sticky note API`
- `Persistent per-user note storage`

## Reuse strategy

Reuse existing systems for:

- auth token handling
- current user identity
- shared shell mounting
- backend routing conventions
- SQLAlchemy models and schema patterns

Keep separate:

- note storage
- note placement rules
- sticky note CRUD endpoints

## Backend Design

## Data model

### `sticky_notes`

Fields:

- `id`
- `user_id`
- `page_url`
- `title`
- `content`
- `color`
- `x_ratio`
- `y_ratio`
- `x_position`
- `y_position`
- `width`
- `height`
- `z_index`
- `created_at`
- `updated_at`

## Field behavior

- `user_id`
  - owner of the note
- `page_url`
  - exact normalized page URL this note belongs to
- `title`
  - optional short heading
- `content`
  - required message body
- `color`
  - selected note theme token
- `x_ratio`
  - legacy horizontal viewport placement retained for backward compatibility
- `y_ratio`
  - legacy vertical viewport placement retained for backward compatibility
- `x_position`
  - horizontal document coordinate in pixels
- `y_position`
  - vertical document coordinate in pixels
- `width`
  - note width in UI-safe bounds
- `height`
  - optional stored height if resizing is later enabled
- `z_index`
  - lets the last interacted note stay above nearby notes

## URL normalization rules

Notes should be tied to the exact user-facing page route, but URL storage should avoid unnecessary fragmentation.

Recommended normalization in phase 1:

- keep pathname
- keep route parameters in pathname
- drop origin
- drop hash fragments
- ignore tracking query params
- allow an optional whitelist for meaningful query params later if some pages genuinely need note separation by query state

Example:

- `/classrooms/123/live`
- `/document/abc`
- `/educator/exam-maker`

## Permissions

- authenticated users only
- users can only read their own notes
- users can only create notes for themselves
- users can only edit their own notes
- users can only delete their own notes

## API

### `GET /api/sticky-notes`

Query params:

- `page_url`

Returns:

- all sticky notes for the authenticated user on that exact normalized page

### `POST /api/sticky-notes`

Creates a note.

Request body:

- `page_url`
- `title`
- `content`
- `color`
- `x_ratio`
- `y_ratio`
- `width`
- `height`

### `PATCH /api/sticky-notes/{note_id}`

Updates:

- title
- content
- color
- placement
- size
- z-order

### `DELETE /api/sticky-notes/{note_id}`

Deletes the note permanently.

## Frontend Design

## Shared components

### `StickyNotesProvider`

Responsibilities:

- mount app-wide sticky note behavior
- detect current route
- normalize page URL
- coordinate data loading and mutations

### `StickyNotesLayer`

Responsibilities:

- render notes for the current page
- manage drag interactions
- clamp note positions into visible content bounds
- preserve saved note positions without collision resolution
- update viewport dimensions without rewriting note coordinates

### `StickyNoteCard`

Responsibilities:

- render one colorful note
- support edit mode and view mode
- support delete action
- support title and content fields

### `StickyNoteContextMenu`

Responsibilities:

- appear at right-click location
- offer `Add Sticky Note`
- close cleanly on click-away or escape

## Placement strategy

Use normalized placement rather than raw pixels:

- note position is stored as ratios relative to the usable content area
- on load, ratios are converted back into on-screen coordinates
- on resize, rendered coordinates are recalculated from the same stored ratios
- notes are visually clamped within the current viewport only when necessary
- visual clamping must not update the persisted ratios
- notes may overlap and are never nudged away from their chosen position

## Stable-position rules

1. Creating a note stores the right-click position.
2. Reloading notes uses the stored ratios unchanged.
3. Resizing never mutates note placement.
4. Dragging is the only interaction that changes placement.
5. Overlap is allowed and z-order determines which note appears above another.
6. Temporary viewport clamping affects rendering only.

## Interaction Rules

### Creation

- note appears near click position
- note opens in edit mode immediately
- blank note should not persist if user closes without entering meaningful content

### Editing

- autosave after short debounce
- save again when title or body loses focus
- saving should not require a separate publish action
- saved text must reload after logout and login

### Dragging

- drag from a dedicated header zone
- update note z-order on interaction
- save new normalized position on drag end

### Delete

- permanent delete
- remove the note immediately from the page
- if the backend delete fails, restore the note and show an error
- lightweight confirmation only if needed by product polish

## Security and Privacy

### Privacy

- notes are private to the owner
- no classroom member should be able to read another user's notes
- no educator override in phase 1

### Validation

- sanitize text inputs
- enforce length limits on title and content
- validate `page_url`, `color`, and placement values

### Abuse prevention

- reject oversized content payloads
- cap note count per page per user at a reasonable limit to protect performance

## Testing Strategy

## Backend tests

- create note as authenticated user
- fail create without auth
- list only own notes
- prevent cross-user read/edit/delete
- validate page URL and placement constraints

## Frontend tests

- right-click opens custom note menu in eligible regions
- right-click does not hijack text inputs or rich editors
- create note on current page URL
- notes reload on revisit
- drag updates position
- creation does not run collision resolution
- reload does not run collision resolution
- resize does not mutate stored note coordinates
- overlapping notes remain where placed
- typing autosaves after a short pause
- delete removes the note permanently, with rollback on API failure
- notes remain private by auth identity

## Manual verification

- create notes on multiple pages and confirm route scoping
- log out and log back in to confirm persistence
- open same page on smaller screen width and verify visual clamping does not overwrite the saved position
- create overlapping notes and verify neither note moves automatically
- type a note, log out, log back in, and verify the content and position return
- delete a note, reload the page, and verify it does not return
- confirm educator and student each only see their own notes

## Rollout Notes

- phase 1 should prioritize reliability over advanced note editing
- if adoption is strong, phase 2 can add:
  - resizing
  - pinning
  - note search
  - note list view
  - optional classroom-shared notes

## Recommended Build Order

1. Add backend sticky note model and CRUD endpoints
2. Add frontend page-scoped note layer in the shared shell
3. Add right-click context menu and colorful draggable note cards
4. Add exact-position persistence, autosave, and reliable deletion
5. Run educator and student manual verification across core pages
