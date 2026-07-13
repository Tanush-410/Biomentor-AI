# VYDRA CORE Exam Maker And Anticheat Bot Design

Date: 2026-06-10

## Goal

Add a first-class classroom exam system to VYDRA CORE that lets educators build rich mixed-format papers, schedule and proctor them like classroom quizzes, use AI-assisted grading for descriptive answers, and review final debarred cheating cases inside a dedicated `Anticheat Bot` workspace.

The new system should allow:
- educators to author exams in a mini document-editor experience
- mixed papers with objective, short-answer, long-answer, and image-based responses
- manual paper creation and AI-assisted exam generation from multiple uploaded materials
- per-question grading keywords to guide AI grading for descriptive answers
- student typed and handwritten/photo responses in the same exam
- auto-ending of quiz or exam attempts after repeated major proctoring warnings
- capture of major-warning evidence snapshots for teacher review
- a dedicated teacher tab that stores final anti-cheat cases and evidence

## Scope

### In scope
- new classroom exam persistence models
- mixed-format exam authoring for educators
- document-style exam editor with fixed response boxes
- AI-assisted question suggestion and full exam draft generation
- scheduled classroom exam publishing and availability windows
- student exam runtime with typed and photo-answer support
- shared anti-cheat escalation patterns across quizzes and exams
- major-warning evidence capture
- AI-first descriptive grading with teacher review fallback
- dedicated educator `Anticheat Bot` tab
- teacher review flow for auto-ended assessments

### Out of scope
- drag-to-annotate answers on diagrams
- live collaborative exam authoring
- OCR-perfect grading of arbitrary handwritten math or drawings
- auto-finalized punitive zero scoring after cheating
- downloadable DOCX export in phase 1
- external invigilator dashboards
- audio recording as anti-cheat evidence

## Product Principles

### 1. Exams should be richer than quizzes, not just larger quizzes
The current quiz system is optimized for short objective assessment. Exams should become a separate first-class assessment type with richer authoring, richer answers, and richer review flows.

### 2. The paper should feel like the workspace
Teachers should not feel trapped in a rigid form builder. The authoring experience should feel closer to a mini document editor where prompts, diagrams, marks, and fixed answer boxes live together in one paper.

### 3. Structured metadata must exist under the document surface
Even though the editor feels freeform, each question still needs structured metadata underneath for scheduling, grading, proctoring, autosave, and teacher review.

### 4. AI should accelerate assessment, not bypass teacher trust
AI should suggest questions, suggest descriptive scores, and explain reasoning. Final low-confidence or suspicious cases must route to teacher review instead of being silently finalized.

### 5. Anti-cheat review should be focused, not noisy
Teachers should not have to sift through every warning. The dedicated anti-cheat workspace should surface only final debarred or auto-ended cases plus the last 3 evidence snapshots that justify the review.

### 6. Reuse proven classroom patterns where possible
Scheduling, attempt lifecycle, warning escalation, notifications, and classroom access control should follow existing classroom quiz and meeting patterns wherever they are already working.

## User Flows

## Educator flow

### Create a manual exam
1. Educator opens a new `Exam Maker` surface.
2. Educator writes section headings and instructions in a document-style editor.
3. Educator inserts:
   - rich text blocks
   - images or diagrams
   - question blocks
   - fixed answer boxes
4. For each question, educator chooses:
   - question type
   - marks
   - answer mode
   - grading keywords
   - whether proctoring-related restrictions apply
5. Educator sets:
   - title
   - classroom
   - duration
   - schedule window
   - proctoring enabled or disabled
6. Educator publishes the exam to classwork.

### Generate an AI exam draft
1. Educator opens `Exam Maker`.
2. Educator chooses:
   - exact source materials manually
   - or classroom-linked materials
3. Educator chooses either:
   - full exam draft generation
   - or question suggestions only
4. AI generates a mixed-format draft or a suggestion set.
5. Educator edits the paper before publishing.

### Review a flagged exam or quiz attempt
1. Student crosses repeated major warning thresholds.
2. Attempt ends automatically.
3. Case appears in `Anticheat Bot`.
4. Educator sees:
   - assessment type
   - student name
   - final reason
   - last 3 evidence snapshots
5. Educator chooses:
   - uphold the auto-end outcome
   - reopen or excuse the case
   - or move the attempt into manual scoring review

### Review AI grading
1. Objective answers are scored automatically.
2. Descriptive answers receive AI-first grading.
3. Low-confidence or suspicious descriptive answers are marked `teacher review required`.
4. Educator reviews only the flagged subset rather than the whole paper.

## Student flow

### Start a scheduled exam
1. Student opens classroom classwork.
2. Student sees a scheduled or live exam card.
3. Student opens the exam launch screen and sees:
   - duration
   - instructions
   - answer modes
   - camera/fullscreen rules
   - warning policy
4. Student starts the protected attempt.

### Complete a mixed-format exam
1. Student answers objective questions inline.
2. Student types into fixed response boxes for descriptive questions when allowed.
3. Student uploads image or photo responses for handwriting-based questions when allowed.
4. Student can move through the paper while the app autosaves progress.

### Encounter anti-cheat enforcement
1. Student receives warning events on major suspicious signals.
2. Major-warning evidence snapshots are captured.
3. After repeated major warnings, the attempt ends automatically.
4. Student sees a `teacher review required` outcome, not a final zero or automatic fail.

## Technical Architecture

## High-level model
The exam system should be a sibling assessment system beside classroom quizzes.

Core layers:
- `Exam authoring`
- `Exam delivery`
- `AI grading`
- `Anticheat review`

This avoids stretching `ClassroomQuiz` into a bloated structure while still allowing reuse of shared classroom primitives.

## Core reuse strategy
The implementation should reuse current classroom foundations where practical:
- classroom access checks
- classroom scheduling and availability-state patterns
- attempt lifecycle patterns
- notification patterns
- proctoring warning escalation patterns
- review-panel style conventions

What should remain separate:
- rich document-style exam authoring
- per-question descriptive grading configuration
- per-response typed/image submission handling
- anti-cheat evidence case storage

## Backend Design

## Data model

### `classroom_exams`
Stores the durable identity and lifecycle of an exam.

Fields:
- `id`
- `classroom_id`
- `created_by_teacher_id`
- `title`
- `description`
- `instructions`
- `status`
  - `draft`
  - `scheduled`
  - `published`
  - `closed`
  - `under_review`
  - `finalized`
- `duration_minutes`
- `available_from`
- `available_until`
- `proctoring_enabled`
- `allow_late_entry`
- `ai_generation_mode`
  - `manual`
  - `ai_draft`
  - `ai_suggestions`
- `created_at`
- `updated_at`

### `classroom_exam_blocks`
Stores the ordered document-style blocks used to render the paper.

Fields:
- `id`
- `exam_id`
- `block_type`
  - `heading`
  - `rich_text`
  - `image`
  - `divider`
  - `instructions`
  - `question`
- `sort_order`
- `content`
- `metadata`
- `created_at`
- `updated_at`

Notes:
- `content` stores the rich editor payload for text-like blocks.
- image blocks should store stable document or upload references.
- question blocks should reference a structured exam-question row.

### `classroom_exam_questions`
Structured metadata for each question block.

Fields:
- `id`
- `exam_id`
- `block_id`
- `question_type`
  - `mcq`
  - `short_text`
  - `long_text`
  - `photo_response`
  - `hybrid`
- `prompt`
- `marks`
- `answer_mode`
  - `typed_only`
  - `photo_only`
  - `typed_or_photo`
- `options`
- `correct_answer`
- `grading_keywords`
- `ai_source_mode`
  - `manual`
  - `ai_suggested`
  - `ai_generated`
- `source_document_ids`
- `created_at`
- `updated_at`

### `classroom_exam_attempts`
Student-specific exam attempt lifecycle.

Fields:
- `id`
- `exam_id`
- `classroom_id`
- `student_id`
- `status`
  - `not_started`
  - `in_progress`
  - `submitted`
  - `auto_ended_review`
  - `teacher_finalized`
- `started_at`
- `submitted_at`
- `updated_at`
- `score`
- `objective_score`
- `descriptive_score`
- `violation_count`
- `termination_reason`
- `teacher_review_required`
- `review_outcome`

### `classroom_exam_responses`
Per-question answer storage.

Fields:
- `id`
- `attempt_id`
- `question_id`
- `response_type`
- `selected_option_id`
- `typed_answer`
- `uploaded_image_path`
- `uploaded_image_uri`
- `autosaved_at`
- `submitted_at`
- `ai_suggested_score`
- `ai_confidence`
- `ai_rationale`
- `matched_keywords`
- `missing_keywords`
- `review_status`
  - `pending_ai`
  - `auto_scored`
  - `teacher_review_required`
  - `teacher_finalized`

### `classroom_exam_violations`
Exam-specific proctoring incidents.

Fields:
- `id`
- `exam_id`
- `attempt_id`
- `student_id`
- `warning_type`
- `severity`
- `reason_code`
- `details`
- `action_taken`
  - `warning`
  - `auto_end`
- `created_at`

### `classroom_anticheat_cases`
Unified educator-facing review object for quiz and exam outcomes that require teacher review.

Fields:
- `id`
- `classroom_id`
- `assessment_type`
  - `quiz`
  - `exam`
- `assessment_id`
- `attempt_id`
- `student_id`
- `final_reason`
- `status`
  - `open_review`
  - `upheld`
  - `excused`
  - `reopened`
- `teacher_notes`
- `created_at`
- `updated_at`

### `classroom_anticheat_evidence`
Evidence snapshots linked to anti-cheat cases.

Fields:
- `id`
- `case_id`
- `attempt_id`
- `student_id`
- `warning_type`
- `reason_code`
- `warning_count`
- `snapshot_path`
- `snapshot_uri`
- `metadata`
- `created_at`

Notes:
- only the last 3 major-warning snapshots need to be shown in the teacher UI
- storage may keep more internally if useful, but the surfaced product rule should stay focused

## REST API

### Exam authoring and lifecycle
- `POST /api/classrooms/{classroom_id}/exams`
- `GET /api/classrooms/{classroom_id}/exams`
- `GET /api/classrooms/{classroom_id}/exams/{exam_id}`
- `PUT /api/classrooms/{classroom_id}/exams/{exam_id}`
- `POST /api/classrooms/{classroom_id}/exams/{exam_id}/publish`

Allowed roles:
- `educator`
- `admin`

### Student attempt lifecycle
- `POST /api/classrooms/{classroom_id}/exams/{exam_id}/start`
- `POST /api/classrooms/{classroom_id}/exams/{exam_id}/autosave`
- `POST /api/classrooms/{classroom_id}/exams/{exam_id}/submit`
- `POST /api/classrooms/{classroom_id}/exams/{exam_id}/warning`
- `POST /api/classrooms/{classroom_id}/exams/{exam_id}/heartbeat`

Allowed roles:
- authenticated classroom student for their own attempt
- teacher/admin may view but not impersonate student attempt submissions

### AI exam generation
- `POST /api/classrooms/{classroom_id}/exams/generate-draft`
- `POST /api/classrooms/{classroom_id}/exams/suggest-questions`

Purpose:
- generate full exam draft from multiple materials
- generate insertable question suggestions only

### Grading and review
- `POST /api/classrooms/{classroom_id}/exams/{exam_id}/auto-grade`
- `GET /api/classrooms/{classroom_id}/exams/{exam_id}/review`
- `POST /api/classrooms/{classroom_id}/exams/{exam_id}/review/finalize`

### Anti-cheat workspace
- `GET /api/classrooms/{classroom_id}/anticheat-bot`
- `GET /api/classrooms/{classroom_id}/anticheat-bot/{case_id}`
- `POST /api/classrooms/{classroom_id}/anticheat-bot/{case_id}/uphold`
- `POST /api/classrooms/{classroom_id}/anticheat-bot/{case_id}/excuse`
- `POST /api/classrooms/{classroom_id}/anticheat-bot/{case_id}/reopen`

## Frontend Design

## Educator surfaces

### 1. Exam Maker
Add a new educator-facing creation surface that behaves like a mini document editor rather than a rigid quiz form.

Required capabilities:
- title and instructions
- rich text sections
- image and diagram insertion
- fixed answer boxes
- per-question marks
- per-question grading keywords
- per-question answer mode
- manual question creation
- AI full draft generation
- AI suggestion insertion
- schedule and proctoring controls

The editor should preserve the premium VYDRA CORE visual language:
- paper-like canvas
- strong layout rhythm
- visibly distinct question blocks
- clear answer-mode chips
- visible scheduling and protection controls

### 2. Classroom classwork
Exams should appear alongside quizzes but remain visually distinct.

Each exam card should show:
- title
- schedule
- duration
- proctored badge
- mixed-format badge
- status
- teacher review count if flagged attempts exist

### 3. Anticheat Bot
Add a dedicated classroom teacher tab named `Anticheat Bot`.

The tab should show only final debarred or auto-ended review cases.

Per case, show:
- student
- assessment type
- final reason
- warning timeline summary
- last 3 evidence snapshots
- action buttons:
  - uphold
  - excuse
  - reopen

## Student surfaces

### 1. Exam launch screen
Before the attempt begins, students should see:
- exam title
- timing
- answer-mode instructions
- proctoring requirements
- warning behavior
- start button

### 2. Protected exam workspace
The student exam interface should render like a paper, not a quiz pager.

Behavior:
- question prompt and fixed answer box live together
- objective questions render inline options
- typed descriptive questions render fixed text input areas
- photo-response questions render upload areas in the fixed response box
- hybrid questions allow either typed or image response
- autosave runs while attempt is active
- side rail can provide progress and question navigation

### 3. Attempt end state
If the attempt is auto-ended:
- lock the paper immediately
- preserve answers and evidence
- show `teacher review required`
- do not assign automatic fail or zero

## AI Grading Design

## Objective grading
MCQs and similar objective responses should score immediately on submit.

## Descriptive grading
Each descriptive response should be evaluated using:
- prompt
- marks
- teacher keywords
- expected response mode
- source material context when linked

Output per question:
- suggested score
- confidence score
- matched keywords
- missing keywords
- short rationale
- review routing status

## Review routing rules
Route to `teacher review required` when:
- confidence is low
- answer is contradictory or malformed
- uploaded image exists without interpretable answer content
- answer is blank but suspiciously submitted
- anti-cheat case is linked to the attempt

Only high-confidence descriptive responses should auto-score without teacher action.

## Anti-Cheat Logic

## Shared escalation philosophy
Quizzes and exams should use the same broad rule structure:
- major suspicious signals create warnings
- each major warning captures evidence
- repeated major warnings trigger auto-end
- final state routes to teacher review rather than auto-fail

## Major warning evidence
For each major warning capture:
- student snapshot image
- timestamp
- assessment id and type
- warning count
- reason code
- optional metadata:
  - fullscreen state
  - visibility state
  - face-detection related context

## Final teacher-facing rule
Teachers should see:
- only final debarred or auto-ended cases
- only the last 3 evidence snapshots per case
- the final reason the attempt ended

This keeps the anti-cheat workspace focused and usable.

## Security And Permissions

- only authenticated classroom members can view classroom exams
- only students enrolled in the classroom can start an exam attempt
- only the creator teacher, classroom educator, or admin can create, publish, or review exams
- only authorized teacher/admin roles can view anti-cheat evidence
- exam response uploads must remain scoped to the owning attempt and question
- anti-cheat evidence should never be publicly addressable without authorization

## Rollout Plan

### Phase 1
- backend schema for exams and anti-cheat cases
- exam APIs
- manual educator exam builder
- classroom exam cards
- student exam runtime
- shared anti-cheat evidence capture and auto-end review state

### Phase 2
- AI full draft generation
- AI question suggestions
- AI descriptive grading
- teacher review routing and grading finalize flow
- dedicated Anticheat Bot tab polish

### Phase 3
- stronger grading confidence heuristics
- richer teacher review filters
- exam analytics and follow-up recommendations

## Testing Strategy

Backend tests should cover:
- exam creation and update permissions
- mixed question persistence
- typed and photo response submission
- autosave behavior
- grading keyword storage
- AI review routing logic
- anti-cheat case creation
- evidence snapshot retention and surface limits

Frontend tests should cover:
- exam builder block editing
- fixed answer box rendering
- per-question answer-mode enforcement
- exam launch and runtime transitions
- teacher anti-cheat review rendering
- status handling for `teacher review required`

End-to-end validation should cover:
- educator creates manual exam
- educator creates AI draft exam
- student takes typed + image mixed-format exam
- proctoring warning escalation auto-ends attempt
- teacher reviews final case in Anticheat Bot
- descriptive grading routes low-confidence answers into review

## Success Criteria

VYDRA CORE should ship an exam system that feels meaningfully more premium than the current quiz flow:
- educators can build rich scheduled papers in-product
- students can take mixed-format proctored exams in one workspace
- AI helps with question generation and grading without undermining teacher trust
- cheating evidence is preserved and reviewed cleanly
- quiz and exam anti-cheat handling become more consistent across the platform
