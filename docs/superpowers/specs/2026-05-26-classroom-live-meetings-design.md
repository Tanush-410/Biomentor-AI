# VYDRA CORE Classroom Live Meetings Design

## Goal
Replace the current classroom `Live` feature, which only schedules external meeting links, with an in-product video meeting system for small classroom sessions.

The new design should allow:
- educators to schedule and start classroom meetings inside VYDRA CORE
- students to see upcoming/live sessions and join them in-browser
- audio/video transport through browser WebRTC peer connections
- FastAPI to handle signaling only through WebSockets
- strong classroom membership and role-based access control

At the same time, the implementation should harden:
- classroom join code behavior
- proctored classroom quiz stability
- classroom/live/security bugs closely related to this new meeting flow

## Scope

### In scope
- new classroom live meeting persistence model
- classroom live meeting scheduling and lifecycle APIs
- WebSocket signaling endpoint for meeting rooms
- classroom live page redesign
- in-browser WebRTC meeting room UI
- classroom membership checks for meeting join
- teacher-only controls for schedule/start/end
- small-call mesh WebRTC MVP
- TURN configuration placeholders for production readiness
- classroom join-code reliability pass
- proctored quiz reliability pass
- security hardening around classroom membership, signaling, and proctored actions

### Out of scope
- SFU/media server for large classes
- cloud recording
- transcription
- screen sharing
- breakout rooms
- chat inside the live meeting room
- email notifications

## Product Principles

### 1. Live sessions should feel native to the classroom
The `Live` tab should no longer feel like a list of external meeting URLs. It should feel like a classroom-native meeting system with scheduling, status, and in-app join behavior.

### 2. Keep the existing classroom architecture intact
This feature should extend the current classroom routes and role-aware shell, not redesign the rest of the classroom module.

### 3. Security before convenience
Only authenticated classroom members should be able to join a meeting room, and only educators should be able to schedule, start, or end meetings.

### 4. Small-class MVP first
The first version should optimize for reliability in small classrooms. Mesh WebRTC is acceptable now; scaling beyond that should be deferred to a later SFU-backed architecture.

### 5. Tight integration with classroom state
Meeting creation, stream announcements, notifications, and attendance presence should all be tied to classroom context rather than feeling like a separate feature bolted onto the app.

## User Flows

## Educator flow

### Schedule a meeting
1. Educator opens `/classrooms/[id]/live`
2. Educator fills:
   - title
   - description
   - start date/time
   - duration
3. Educator saves the meeting
4. VYDRA CORE stores the meeting as `scheduled`
5. Students in the classroom see it in the live page and receive in-app notifications
6. A classroom stream post may reference the scheduled meeting

### Start a scheduled meeting
1. Educator opens the live page
2. Educator clicks `Start Meeting`
3. Meeting status changes to `live`
4. Students see `Join` become active
5. Educator enters the in-app meeting room

### End a meeting
1. Educator clicks `End Meeting`
2. Meeting status changes to `ended`
3. A signaling event broadcasts meeting termination
4. All connected participants leave the room gracefully

## Student flow

### View upcoming meeting
1. Student opens `/classrooms/[id]/live`
2. Student sees scheduled or live meetings
3. Student can inspect title, description, schedule, and status

### Join live meeting
1. Student clicks `Join`
2. Browser requests mic/camera permission
3. Student connects to the signaling WebSocket
4. Student enters the WebRTC mesh room
5. Student sees local preview and remote participant tiles

## Technical Architecture

## High-level model
The live meeting system should use:
- `Postgres/SQLite` for durable meeting metadata
- `FastAPI WebSocket` for signaling only
- `WebRTC` for direct browser media transport
- `STUN` with Google public STUN for local candidate discovery
- `TURN placeholders` in environment/config for future NAT traversal hardening

FastAPI must never proxy or relay audio/video media streams in this MVP.

## Room identity
Each meeting room is identified by:
- `classroom_id`
- `meeting_id`

The signaling layer should validate:
- the meeting exists
- the meeting belongs to the classroom
- the connecting user is a current classroom member

## WebRTC topology
Initial topology:
- full mesh
- one peer connection per remote participant

Why:
- simplest path for small classrooms
- no media infra dependency
- works with current product scope

Future upgrade path:
- replace the mesh layer with SFU-backed media
- candidates include LiveKit, Jitsi, or mediasoup

## Backend Design

## Data model
Add a new entity: `classroom_live_meetings`

Fields:
- `id`
- `classroom_id`
- `title`
- `description`
- `scheduled_start`
- `scheduled_end`
- `created_by_teacher_id`
- `meeting_token`
- `status`
  - `scheduled`
  - `live`
  - `ended`
  - `cancelled`
- `created_at`
- `updated_at`

### Notes
- `meeting_token` should be random and opaque
- `meeting_token` is for join/session integrity, not primary authorization
- authorization must still come from authenticated classroom membership checks

## REST API

### POST `/api/classrooms/{classroom_id}/meetings`
Purpose:
- schedule a meeting

Allowed roles:
- `educator`
- `admin`

Validation:
- user must control the classroom
- `scheduled_end` must be after `scheduled_start`
- duration must be reasonable for MVP

Returns:
- created meeting object

### GET `/api/classrooms/{classroom_id}/meetings`
Purpose:
- list meetings for classroom members

Allowed roles:
- any authenticated classroom member

Returns:
- upcoming meetings
- currently live meetings
- recently ended meetings if useful for context

### GET `/api/classrooms/{classroom_id}/meetings/{meeting_id}`
Purpose:
- return a single meeting record plus join eligibility metadata

Allowed roles:
- any authenticated classroom member

### POST `/api/classrooms/{classroom_id}/meetings/{meeting_id}/start`
Purpose:
- mark meeting as `live`

Allowed roles:
- classroom teacher/admin only

Behavior:
- idempotent if already live
- creates/updates notification and optional stream reference

### POST `/api/classrooms/{classroom_id}/meetings/{meeting_id}/end`
Purpose:
- mark meeting as `ended`

Allowed roles:
- classroom teacher/admin only

Behavior:
- broadcasts a terminal signaling event
- future joins are rejected once ended

## WebSocket signaling

### Endpoint
- `/ws/meetings/{meeting_id}`

### Authentication
The client must provide a valid app auth token during WebSocket connection setup.

Accepted strategy:
- auth token passed in querystring for MVP or negotiated in the initial join payload

Required checks:
- token resolves to valid user
- meeting exists
- user is active classroom member or classroom educator/admin
- meeting status is `live` or a teacher is preparing to start it

### Room management
The signaling service should track:
- participants by `meeting_id`
- user identity and role
- current socket connections

### Event contract

Client-to-server:
- `join_meeting`
- `offer`
- `answer`
- `ice_candidate`
- `mute_status`
- `camera_status`
- `end_meeting`

Server-to-client:
- `user_joined`
- `user_left`
- `offer`
- `answer`
- `ice_candidate`
- `mute_status`
- `camera_status`
- `end_meeting`

### Event behavior

#### `join_meeting`
Client sends:
- user metadata
- classroom_id
- meeting_token if required

Server responds by:
- validating membership
- admitting user to meeting room
- notifying existing peers

#### `user_joined`
Broadcast to room when a participant enters.

#### `user_left`
Broadcast when a participant disconnects or leaves.

#### `offer` / `answer` / `ice_candidate`
Relayed peer-to-peer signaling messages addressed to the intended participant.

#### `mute_status` / `camera_status`
Presence/status events for UI state only.

#### `end_meeting`
Teacher-only event.
Broadcast to all peers and close room state.

## Frontend Design

## Classroom live page
Route remains:
- `/classrooms/[id]/live`

The current page should be refactored from external meeting links into a native meeting workflow.

### Teacher view
Show:
- schedule meeting form
- upcoming meetings list
- live meeting cards
- `Start Meeting` action
- `Join` action for meetings already live
- `End Meeting` action from the live room

Form fields:
- title
- date/time
- duration
- description

### Student view
Show:
- upcoming meetings list
- live meeting card
- `Join` button only when meeting is live or joinable
- status labels such as `Scheduled`, `Live`, `Ended`

## Video meeting room
Create a dedicated classroom meeting room component/page state that includes:
- local video preview
- remote participant tiles
- mute/unmute
- camera on/off
- leave call
- teacher-only end meeting
- join/connection status
- browser permission error states

This can be rendered:
- on a dedicated classroom live-room route, or
- in the same page with room-mode state

Recommended:
- dedicated route such as `/classrooms/[id]/live/[meetingId]`

Why:
- cleaner state separation
- easier reconnect behavior
- easier direct student join flow

## Reusable frontend units
Create:
- `MeetingScheduler`
- `MeetingList`
- `VideoMeetingRoom`
- `useWebRTCMeeting`
- `meetingSignalingClient`

### `MeetingScheduler`
Handles teacher scheduling UI and validation.

### `MeetingList`
Shared teacher/student rendering of scheduled/live meetings with role-aware actions.

### `VideoMeetingRoom`
Owns layout, local media preview, remote grid, and meeting controls.

### `useWebRTCMeeting`
Encapsulates:
- local media acquisition
- peer connection creation
- offer/answer flow
- ICE candidate exchange
- remote stream tracking
- cleanup on leave/end

### `meetingSignalingClient`
Encapsulates:
- WebSocket connection
- auth bootstrap
- event send/receive helpers
- reconnect/error behavior for MVP

## Classroom Join Reliability Pass

The classroom join-code flow must be hardened while this work is underway because live meeting access depends on classroom membership.

Required outcomes:
- invite code join should consistently create/activate enrollment
- stale classroom membership state should not cause false `Classroom not found`
- classroom list/detail should reflect new membership immediately
- invalid or expired invite flows should fail clearly

## Proctored Quiz Reliability Pass

Live meetings introduce additional browser media usage, so quiz proctoring must remain robust and isolated.

Required outcomes:
- proctored quiz flow still requires fullscreen when configured
- camera-required quizzes still detect camera loss
- tab switch / blur / fullscreen exit still terminate attempts when appropriate
- educator notification still fires on violation
- quiz camera usage and meeting camera usage should not share active state accidentally

The meeting system and quiz proctoring must remain logically separate browser flows.

## Security Design

## Access control
Enforce on both REST and WebSocket layers:
- authenticated users only
- classroom membership required for meeting read/join
- teacher/admin role required for schedule/start/end

## Token handling
- avoid anonymous meeting join
- do not trust meeting ID alone
- validate classroom membership on every sensitive action

## WebSocket hardening
- reject unknown meeting IDs
- reject users from other classrooms
- reject joins to ended/cancelled meetings
- restrict `end_meeting` to teacher/admin
- clean up participant state on disconnect

## Input validation
- meeting time validation
- title/description length checks
- duration bounds

## Abuse reduction
For MVP, add:
- duplicate join guard per user/meeting
- simple room participant cap for mesh safety
- graceful rejection message when room is too large for mesh mode

## Notifications and Stream Integration

When a meeting is scheduled:
- create an in-app notification for classroom students
- optionally create a stream entry referencing the meeting

When a meeting starts:
- create an in-app notification
- live page should immediately reflect status `live`

When a meeting ends:
- meeting list should reflect final state without showing stale join actions

## Error Handling

## Scheduling errors
- invalid times
- unauthorized teacher actions
- classroom not found

## Join errors
- not a classroom member
- meeting not live
- camera/microphone permission denied
- WebSocket/signaling failure
- peer connection failure

## Runtime meeting errors
- participant disconnects
- peer leaves unexpectedly
- teacher ends session
- room exceeds mesh-safe size

UI should show clear, non-technical feedback in all these cases.

## Testing Strategy

## Backend
- model creation and serialization tests
- role/authorization tests for schedule/start/end
- classroom member access tests for list/detail/join
- WebSocket signaling permission tests
- join/leave state cleanup tests

## Frontend
- classroom live page render tests by role
- meeting scheduler form validation tests
- meeting list status/action tests
- signaling client behavior tests where practical
- hook-level tests for connection state transitions

## Integration
- teacher schedules meeting
- student sees it in live list
- teacher starts meeting
- student joins
- teacher ends meeting
- student is removed from session

## Regression checks
- classroom join code still works
- classroom tabs still load reliably
- proctored classroom quiz still enforces rules

## Phased Implementation

### Phase 1: Meeting data + REST APIs
- add model
- add schema support
- add schedule/list/detail/start/end endpoints
- integrate notifications and stream references

### Phase 2: Signaling layer
- add WebSocket route
- implement meeting room manager
- enforce membership and role checks
- support signaling event relay

### Phase 3: Frontend live page + room UI
- replace external-link scheduling UX
- add meeting scheduler and list
- add in-app meeting room
- wire WebRTC mesh flow

### Phase 4: Hardening pass
- classroom join code fixes
- proctored exam stability fixes
- access-control and security pass
- regression tests

## File Impact Summary

Expected backend touchpoints:
- `backend/app/database/models.py`
- `backend/app/database/__init__.py`
- `backend/app/schemas/__init__.py`
- `backend/app/routers/classrooms.py`
- new meeting signaling/service modules under `backend/app/services/`
- possibly `backend/app/main.py` if websocket/router registration needs adjustment

Expected frontend touchpoints:
- `frontend/pages/classrooms/[id]/live.jsx`
- possible new route `frontend/pages/classrooms/[id]/live/[meetingId].jsx`
- `frontend/components/ClassroomLivePanel.jsx` replacement or major refactor
- new components/hooks/clients for WebRTC meetings
- `frontend/lib/classroomApi.js`

## Recommendation
Implement this as a phased replacement of the current classroom live-link system, not as a second parallel live feature.

That keeps:
- classroom UX coherent
- routing simple
- membership checks centralized
- future SFU migration cleaner
