# AI Meeting Assistant Design

Date: 2026-05-31

## Goal

Add an `AI Meeting Assistant` to VYDRA CORE's built-in classroom meeting system so educators get a private live copilot during meetings, and students receive a clean post-meeting recap afterward.

The assistant should:

1. capture meeting context from transcript snippets and typed meeting events
2. generate teacher-only live notes during the session
3. identify action items and unresolved doubts
4. suggest follow-up quiz/material actions
5. publish a student-facing summary after the meeting ends

## Product Decisions

- Build this into the existing dedicated meeting room
- Use both transcript snippets and typed meeting events as source input
- Live assistant output is visible to teachers only during the session
- Students receive only the cleaned post-meeting recap
- The assistant is advisory, not an autonomous speaking participant

## User Experience

### Educator experience

Inside the dedicated meeting room:

- the educator sees an `AI Assistant` panel on the right side
- the panel updates during the meeting with:
  - live notes
  - key concepts discussed
  - action items
  - unanswered doubts
  - suggested follow-up quiz/material ideas

At the end of the meeting:

- the educator gets a polished session summary
- the educator can use the suggestions to:
  - post follow-up material
  - create or refine a quiz
  - plan intervention or review work

### Student experience

During the meeting:

- students stay in the focused video room with no live AI side panel
- the meeting UI remains uncluttered

After the meeting ends:

- students can view a clean recap containing:
  - summary
  - key takeaways
  - action items meant for the class
  - follow-up resource links if the educator chooses to share them

## Architecture

The assistant extends the existing meeting-room architecture instead of replacing any meeting behavior.

### Core layers

1. `Meeting Event Capture`
   - records typed meeting signals such as:
     - pinned concepts
     - teacher highlights
     - prompt markers
     - explicit doubt flags

2. `Transcript Capture`
   - receives transcript snippets from the browser during the live session
   - transcript capture is optional but preferred
   - meeting notes must still work with event-only input if transcript capture is weak

3. `Meeting Assistant Orchestrator`
   - combines transcript snippets and typed events
   - builds rolling context for the AI assistant
   - periodically generates structured live guidance

4. `Teacher Live Assistant Output`
   - private live notes and cues for the educator only

5. `Post-Meeting Summary Generator`
   - produces a class-safe summary after the meeting ends
   - excludes private educator-only intervention cues

6. `Follow-up Suggestion Engine`
   - recommends:
     - follow-up material
     - follow-up quiz topics
     - next-step teaching focus

## Data Model

Add meeting-assistant persistence linked to the existing live meeting records.

### Suggested tables / entities

#### `classroom_meeting_transcripts`
- id
- meeting_id
- classroom_id
- speaker_role
- speaker_name
- content
- created_at

#### `classroom_meeting_events`
- id
- meeting_id
- classroom_id
- actor_id
- event_type
- payload
- created_at

#### `classroom_meeting_ai_summaries`
- id
- meeting_id
- classroom_id
- summary_type
  - live_notes
  - teacher_summary
  - student_summary
  - action_items
  - unresolved_doubts
  - follow_up_suggestions
- content_json
- created_at
- updated_at

The exact storage shape can be simplified if the existing meeting models already provide a better integration point, but the product needs persistent transcript/event/summary layers.

## Backend Responsibilities

### Transcript ingestion

Add an authenticated API endpoint for transcript snippets, for example:

- `POST /api/classrooms/{classroom_id}/meetings/{meeting_id}/transcripts`

Only authenticated classroom members in the meeting should be able to submit snippets.

### Meeting event ingestion

Add a teacher-facing and system-facing way to record structured meeting events, for example:

- `POST /api/classrooms/{classroom_id}/meetings/{meeting_id}/events`

Event examples:
- teacher marked concept
- teacher flagged a doubt
- teacher pinned an instruction
- student asked unresolved question

### AI assistant generation

Add backend logic to:

- build a rolling assistant context window from:
  - recent transcripts
  - recent events
  - meeting title/description/classroom context
- generate:
  - live notes
  - action items
  - unresolved doubts
  - suggested follow-up quiz/material actions

### Summary generation at meeting end

When the teacher ends a meeting:

- generate a teacher summary
- generate a student-safe summary
- persist both
- optionally create a classroom announcement or recap entry

## Frontend Responsibilities

### Dedicated meeting room

Continue using the dedicated meeting room route:

- `/classrooms/[id]/live/[meetingId]/room`

Add an `AI Assistant` panel for teacher mode only.

#### Teacher panel sections
- Live Notes
- Action Items
- Unanswered Doubts
- Suggested Follow-up Quiz
- Suggested Follow-up Material

### Student room

Student meeting room remains focused on:

- video grid
- participant state
- join/leave/camera/mute controls

No live AI teacher panel should be visible here.

### Post-meeting recap surface

Expose the student-facing summary in:

- classroom live page
- or stream recap card

This should be readable after the meeting without reopening the meeting room.

## AI Behavior

### During meeting

The AI should:

- summarize key discussion points
- identify repeated confusion
- extract clear educator action items
- track unresolved student doubts
- recommend one or more follow-up moves

### After meeting

The AI should produce:

#### Teacher-facing summary
- concise session summary
- action items
- unresolved doubts
- suggested intervention focus
- suggested quiz topics
- suggested materials to post

#### Student-facing summary
- what was covered
- what students should revise
- what to do next
- educator-approved follow-up links or reminders

## Source of Truth

The assistant should be grounded in:

- transcript snippets
- typed meeting events
- meeting metadata
- classroom context
- optionally linked classroom materials

It should not invent recap content that is not supported by meeting evidence.

## Error Handling

### Transcript unavailable

If transcript capture is unavailable:

- continue with typed events only
- still generate a lightweight teacher summary if possible

### AI generation failure

If summary generation fails:

- preserve raw meeting transcript/event records
- show a teacher-facing fallback message
- allow regeneration later

### Weak meeting data

If the meeting had too little usable input:

- generate a minimal recap
- explicitly avoid overclaiming what was discussed

## Privacy and Role Boundaries

- live assistant panel is teacher-only
- student-facing recap must exclude private intervention cues
- only classroom members may submit or access meeting-linked data
- only teacher/admin may view teacher summaries and follow-up recommendations

## Testing

### Backend tests

Add tests for:

- transcript ingestion route
- meeting event ingestion route
- teacher-only access to live assistant summary endpoint
- student-safe recap generation
- meeting-end summary generation trigger

### Frontend tests

Add tests for:

- teacher room includes assistant panel
- student room does not
- post-meeting recap card renders on classroom live page

### Manual validation

Validate:

- teacher joins a meeting and sees the assistant panel
- student joins and does not see teacher-only AI
- transcript/event submission works during the meeting
- ending the meeting produces summaries
- student sees the clean recap after the meeting

## Rollout Plan

### Phase 1

- transcript and event capture
- teacher-only assistant panel shell
- basic live notes

### Phase 2

- action items
- unresolved doubts
- follow-up quiz/material suggestions

### Phase 3

- post-meeting teacher summary
- post-meeting student recap
- recap publishing into classroom surfaces

## Non-Goals

This phase does not include:

- AI speaking as a live meeting participant
- automatic grading from meeting content
- full attendance analytics
- recording export
- real-time voice moderation
- autonomous publishing of quizzes without educator confirmation

## Success Criteria

This feature is successful when:

- teachers can use the meeting room as a live teaching workspace with AI support
- students are not distracted by private live AI notes
- educators receive useful summaries and follow-up suggestions
- students receive a clean summary after class
- the meeting product feels more premium and more integrated with the rest of VYDRA CORE
