# VYDRA CORE Classroom Module Design

## Goal
Transform the existing `Classroom` feature into a Google Classroom-style module inside the current VYDRA CORE website, without disrupting the already-built global features such as `Dashboard`, `Materials`, `Learning Chat`, `Quiz Generator`, `Progress`, and `Collaboration`.

The new classroom module should:
- show a classroom list/grid when the user clicks `Classroom`
- open a dedicated classroom workspace when a classroom is selected
- support classroom-scoped public announcements, private teacher-student messaging, shared materials, classwork, and live/video session workflows
- preserve message history across logins
- notify students in-app when teachers post announcements or schedule/start live sessions
- remain future-ready for email notification delivery without requiring email implementation now

## Scope

### In scope
- redesign of the classroom entry point for both student and educator roles
- classroom list page
- classroom detail workspace
- classroom tabs/pages:
  - `Stream`
  - `Classwork`
  - `People`
  - `Messages`
  - `Live`
- educator public classroom posts
- educator private messaging to students
- student private messaging to teachers only
- persistent classroom message history
- classroom-scoped material sharing
- classroom-scoped live session scheduling and join flow
- classroom-scoped in-app notifications
- backend routes, schemas, and storage required to make these workflows functional

### Out of scope
- email sending implementation
- native video call engine inside VYDRA CORE
- parent accounts
- student-to-student chat
- major rewrites of global pages outside the classroom module

## Product Principles

### 1. Classroom-first inside the classroom feature
The classroom experience should feel like a self-contained academic workspace. Clicking `Classroom` should no longer feel like opening a small utility page. It should feel like entering a class management system.

### 2. Preserve existing global features
The global app structure should remain intact. `Dashboard`, `Materials`, `Learning Chat`, `Quiz Generator`, `Progress`, and other existing flows should continue to work. The new classroom module should complement those flows, not replace them.

### 3. Google Classroom mental model, extended
The architecture should stay familiar to users who know Google Classroom:
- classroom list first
- class detail second
- core tabs inside the selected class

VYDRA CORE then extends that model with:
- private messaging
- live/video session management
- tighter AI integration later

### 4. Role-based simplicity
Students and educators see the same classroom shell, but with different actions:
- educators create announcements, share materials, send messages, schedule sessions
- students consume announcements, access materials, message teachers, join sessions

### 5. Notification pipeline should be future-ready
All classroom events should produce durable in-app notifications now, while being modeled in a way that can later add email delivery with minimal redesign.

## User Flows

## Student Flow

### Classroom list
When a student clicks `Classroom`, they should see:
- enrolled classrooms in a Google Classroom-style list or card grid
- classroom title
- subject
- educator name
- quick unread indicators
- next live session status if available

From there the student chooses one classroom.

### Classroom detail
Once a student opens a classroom, they see:
- classroom banner/header
- tabs:
  - `Stream`
  - `Classwork`
  - `People`
  - `Messages`
  - `Live`

#### Stream
- public announcements from the teacher
- scheduled/live session notices
- pinned updates
- class-wide material or quiz announcements

#### Classwork
- teacher-posted materials
- classroom quizzes
- assignments/tasks
- due dates
- optional calendar-style visibility for task timing

#### People
- teacher list
- enrolled students list
- no direct student-to-student messaging actions

#### Messages
- persistent private threads with classroom teachers only
- if the student has initiated or received a teacher thread before, it remains visible after login
- students do not see other students in contacts
- student can also raise difficulty/help concerns through the same teacher-contact area or linked complaint path

#### Live
- upcoming scheduled sessions
- join-now session state
- external meeting link join flow
- attendance/join state
- session notices

## Educator Flow

### Classroom list
When an educator clicks `Classroom`, they should see:
- classrooms they own
- ability to create a new classroom
- invite code visibility
- quick counts such as number of students and active notices

### Classroom detail
The educator opens a classroom and sees the same shell:
- `Stream`
- `Classwork`
- `People`
- `Messages`
- `Live`

#### Stream
- create public announcements
- pin announcements
- post material/share notices
- publish live session notices

#### Classwork
- upload/share classroom materials
- attach classroom-scoped quizzes
- create assignments/tasks
- set due dates
- optionally group classwork by topic or due date

#### People
- enrolled students
- invite code
- add/remove membership workflows later
- quick student contact entry points

#### Messages
- educator sees classroom teacher-student private threads
- can start a one-to-one conversation with any enrolled student
- thread history persists across sessions
- classroom complaint/help items can remain visible or linked from the same messaging context

#### Live
- schedule future session
- start session now
- attach external meeting link
- notify all enrolled students
- track live/scheduled/completed status

## Information Architecture

## Route model
Recommended frontend route structure:

- `/classrooms`
- `/classrooms/[id]`
- `/classrooms/[id]/stream`
- `/classrooms/[id]/classwork`
- `/classrooms/[id]/people`
- `/classrooms/[id]/messages`
- `/classrooms/[id]/live`

### Why this structure
- closely matches Google Classroom mental model
- clean role-aware rendering in one shell
- each classroom feature becomes its own page, making state and testing easier
- avoids overloading existing `student/classrooms` or `educator/classrooms` screens with too many responsibilities

### Compatibility with current pages
Existing role-specific classroom entry pages can be retained as thin wrappers or redirects:
- student classroom page becomes the student-facing classroom list
- educator classroom page becomes the educator-facing classroom list

Over time, the app should converge toward shared classroom routes with role-aware content.

## Data Model Changes

The current data model already includes:
- `Classroom`
- `ClassroomEnrollment`
- `CommunicationMessage`
- `SupportComplaint`
- `LiveSession`
- `LiveSessionParticipant`
- `Document`

To support the new architecture cleanly, the classroom module should add or formalize the following entities.

### 1. Classroom Announcement
Purpose:
- durable public post for a classroom stream

Fields:
- `id`
- `classroom_id`
- `author_id`
- `title` nullable
- `content`
- `post_type` such as `announcement`, `material_share`, `live_notice`
- `linked_document_id` nullable
- `linked_live_session_id` nullable
- `is_pinned`
- `created_at`
- `updated_at`

Why separate from messages:
- public stream posts should not be mixed with private threads

### 2. Classroom Material Link
Purpose:
- attach uploaded documents to a classroom without moving them out of the user’s general library

Fields:
- `id`
- `classroom_id`
- `document_id`
- `shared_by_user_id`
- `title_override` nullable
- `description` nullable
- `visibility` default classroom
- `created_at`

Why separate:
- one document can appear in multiple contexts
- classroom materials need their own list and metadata

### 3. Classroom Assignment
Purpose:
- represent classwork items, tasks, and due-date structure

Fields:
- `id`
- `classroom_id`
- `educator_id`
- `title`
- `description`
- `assignment_type` such as `material`, `quiz`, `task`
- `document_id` nullable
- `quiz_reference` nullable
- `due_at` nullable
- `created_at`
- `updated_at`

### 4. Classroom Message Thread
Purpose:
- persistent private teacher-student conversations

Fields:
- `id`
- `classroom_id`
- `teacher_id`
- `student_id`
- `last_message_at`
- `created_at`

### 5. Classroom Message
Purpose:
- actual messages in the thread

Fields:
- `id`
- `thread_id`
- `sender_id`
- `content`
- `message_type` default `text`
- `created_at`

Why not reuse `CommunicationMessage` directly:
- current `CommunicationMessage` works better as a broadcast or generic communication artifact
- thread-based chat needs durable relationship and ordered message history

### 6. Notification
Purpose:
- in-app event delivery now, email-ready later

Fields:
- `id`
- `user_id`
- `classroom_id` nullable
- `type` such as `announcement`, `private_message`, `live_scheduled`, `live_started`, `material_shared`
- `title`
- `body`
- `action_url`
- `read_at` nullable
- `delivery_channels` JSON, default `["in_app"]`
- `created_at`

Why this matters:
- later, adding email becomes a delivery concern, not a model redesign

### 7. Live session meeting metadata
The current `LiveSession` model should be extended to include:
- `meeting_provider` nullable, e.g. `external`
- `meeting_url` nullable
- `scheduled_for` nullable
- `notification_sent_at` nullable

## Backend API Design

## Classroom list and detail
- `GET /api/classrooms`
  - role-aware list for current user
- `GET /api/classrooms/{id}`
  - classroom summary header
- `GET /api/classrooms/{id}/stream`
- `GET /api/classrooms/{id}/classwork`
- `GET /api/classrooms/{id}/people`
- `GET /api/classrooms/{id}/messages`
- `GET /api/classrooms/{id}/live`

## Announcements
- `POST /api/classrooms/{id}/announcements`
- `GET /api/classrooms/{id}/announcements`
- `POST /api/classrooms/{id}/announcements/{announcement_id}/pin`

## Classroom materials and classwork
- `POST /api/classrooms/{id}/materials/share`
- `GET /api/classrooms/{id}/materials`
- `POST /api/classrooms/{id}/assignments`
- `GET /api/classrooms/{id}/assignments`

## Private messaging
- `GET /api/classrooms/{id}/threads`
  - students only see threads with teachers
  - educators see classroom student threads
- `POST /api/classrooms/{id}/threads`
  - create thread if it does not exist
- `GET /api/classrooms/{id}/threads/{thread_id}/messages`
- `POST /api/classrooms/{id}/threads/{thread_id}/messages`

## Live sessions
- `POST /api/classrooms/{id}/live/schedule`
- `POST /api/classrooms/{id}/live/start`
- `GET /api/classrooms/{id}/live`
- `POST /api/classrooms/{id}/live/{session_id}/join`

## Notifications
- `GET /api/notifications`
- `POST /api/notifications/{id}/read`

## Authorization Rules

### Students
- can view only classrooms they are enrolled in
- can message only teachers associated with that classroom
- cannot message other students
- can read stream/classwork/people/live pages for enrolled classrooms

### Educators
- can manage only classrooms they own unless admin
- can post announcements
- can share materials
- can create assignments
- can message enrolled students
- can schedule/start live sessions

### Admin
- may inspect across classrooms if current role model already allows it

## Notifications Design

Notifications should be event-based.

Trigger examples:
- educator posts announcement
- educator shares material
- educator creates assignment
- educator schedules live session
- educator starts live session
- new private message arrives

Delivery now:
- in-app notification records
- optional websocket update where applicable

Delivery later:
- the same event can fan out to email by adding a notification delivery worker or adapter

This preserves backward compatibility and keeps the current system extensible.

## Frontend Design Direction

The classroom module should follow a Google Classroom-like architecture, but remain visually aligned to VYDRA CORE’s current beige/brown/cream identity.

### Classroom list page
- more Google Classroom-like grid/list of classroom cards
- educator and student both start here
- left rail can show enrolled/owned classrooms and quick filters
- top area can keep current VYDRA CORE shell identity

### Classroom detail page
- banner/header area with classroom title, subject, educator
- horizontal top tabs:
  - `Stream`
  - `Classwork`
  - `People`
  - `Messages`
  - `Live`
- each tab is its own page, not one giant page with sections

### Stream page
- teacher posts visually resemble classroom announcements
- cards may include linked materials, linked live sessions, or linked quizzes
- student can comment later if that is added, but not required now

### Classwork page
- grouped sections for materials, quizzes, assignments
- due dates shown clearly
- documents open in current VYDRA CORE study/document viewer flows

### Messages page
- two-pane layout:
  - contacts/threads list
  - active thread panel
- students only see teacher contacts
- thread history survives login because it is server-backed

### Live page
- upcoming session card
- scheduled session list
- active session join CTA
- external meeting link and status

## Error Handling

### Missing classroom access
- if user tries to open a classroom they do not belong to, return `403` and route back to classroom list

### Missing live link
- scheduled session without join link should render a clear “link pending” state

### No messages yet
- empty thread state should encourage teacher-student contact

### No classwork yet
- empty state should show “No materials or tasks have been posted yet”

## Testing Strategy

### Backend
- classroom list visibility by role
- classroom detail access permissions
- announcement creation and retrieval
- classroom material sharing and retrieval
- thread creation and persistence
- student cannot message students
- message history remains across subsequent reads/logins
- live session scheduling/start/join flows
- notification creation for announcements/messages/live events

### Frontend
- classroom list renders correctly for student and educator
- selecting classroom navigates to detail workspace
- tab navigation works
- message threads persist when page reloads
- live page shows scheduled and active states
- existing global pages still route and render correctly

### Regression checks
- dashboard still works
- materials still work
- learning chat still works
- progress still works
- existing collaboration hub still works

## Migration / Integration Strategy

This should be introduced as a contained module:

1. keep existing app shell intact
2. enhance `Classroom` entry routes first
3. add new classroom data model and API routes
4. wire student and educator classroom lists to the new detail routes
5. migrate old classroom-specific message/complaint workflows into classroom pages without deleting the old primitives until stable

This avoids breaking current features while moving toward the richer classroom architecture.

## Recommended Implementation Order

1. backend data model and schema additions
2. classroom list/detail API foundation
3. classroom shell and tabbed routing
4. stream and classwork
5. private messaging threads
6. live session scheduling + notifications
7. notifications panel integration

## Final Recommendation

Implement the new classroom experience as a **Google-Classroom-style module nested inside the current website**, not as a global redesign. This gives the user the architecture they want while preserving all previously built features.

The key structural decisions are:
- `Classroom` becomes the entry to a real classroom system
- each classroom has dedicated pages
- private and public communication are separated
- live sessions are classroom-native but use external meeting links first
- notifications are built as in-app events now, email-ready later
