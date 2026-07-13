# VYDRA CORE Certification Design

Date: 2026-06-12

## Goal

Add a first-class `Certification` feature to VYDRA CORE that lets educators:

- create classroom-linked certification tracks
- support both VYDRA CORE-native learning paths and external course links
- define completion rules for students
- issue branded certificates with the student's name after completion
- surface certification progress clearly to both teachers and students

The feature should feel like a natural extension of the existing classroom, classwork, exam, quiz, and progress systems rather than a detached certificate generator.

## Product Decisions

- Primary model: `Classroom Certification Tracks`
- Unlock model: both supported
  - `VYDRA CORE-native completion`
  - `External course + teacher confirmation`
- Certificates should carry:
  - student name
  - certification title
  - educator or classroom attribution
  - completion date
  - VYDRA CORE platform branding
- Teachers should be able to issue automatically by rule or manually after review
- Students should see both active tracks and earned certificates in a clear progress-oriented surface

## Scope

### In scope

- educator certification creation flow
- classroom-bound certification tracks
- support for external course links
- support for teacher-defined custom course structures
- completion rules tied to VYDRA CORE work
- teacher manual completion override for external certifications
- certificate generation and download
- student certification progress surface
- teacher certification oversight surface
- VYDRA CORE-themed certificate layout
- AI assistance for drafting certification milestones and completion criteria

### Out of scope

- third-party LMS deep integrations
- payment-gated certifications
- blockchain verification
- public certificate verification URLs in phase 1
- multi-issuer enterprise branding controls
- formal accreditation workflows

## Product Principles

### 1. Certification should represent real learning, not just reward clicks

Certificates should reflect meaningful completion signals such as finished coursework, successful assessments, required milestones, or explicit teacher signoff.

### 2. The feature should live where teachers already teach

Educators should manage certifications through classroom and educator flows they already understand, not through a disconnected admin system.

### 3. External courses should be supported without weakening trust

Teachers should be able to certify outside learning, but the app should preserve teacher control over when completion is accepted.

### 4. VYDRA CORE-native certifications should feel smarter than generic course badges

The system should take advantage of existing platform strengths:

- classwork structure
- quizzes
- exams
- progress data
- AI assistance

### 5. Certificates should feel premium

The generated certificate should match the VYDRA CORE visual language and feel polished enough to share or download confidently.

## User Flows

## Educator flow

### Create a VYDRA CORE-native certification track

1. Educator opens a new `Certification` surface.
2. Educator chooses a classroom.
3. Educator enters:
   - certification title
   - description
   - completion message
   - signatory name or issuer line
4. Educator chooses `VYDRA CORE track`.
5. Educator selects required completion items such as:
   - shared materials
   - classwork tasks
   - quizzes
   - exams
   - custom milestone blocks
6. Educator defines completion rules, for example:
   - all required items must be completed
   - minimum score required on selected assessment items
   - teacher review required before issue
7. Educator previews the certificate.
8. Educator publishes the certification to the classroom.

### Create an external course certification

1. Educator opens `Certification`.
2. Educator chooses a classroom.
3. Educator enters:
   - certification title
   - course provider name
   - external course link
   - optional description
   - optional required proof guidance
4. Educator chooses `External course`.
5. Educator chooses completion mode:
   - teacher manually confirms completion
   - teacher confirms after student proof upload
6. Educator previews the certificate.
7. Educator publishes the certification.

### Issue a certificate

1. Student reaches completion threshold or submits proof.
2. System marks the learner as:
   - ready for issue
   - or pending teacher review
3. Educator opens the certification roster.
4. Educator reviews:
   - completion state
   - linked evidence
   - scores or required milestones
5. Educator issues the certificate.
6. VYDRA CORE generates a certificate artifact for the student.

### Use AI help during setup

1. Educator opens certification builder.
2. Educator asks AI to suggest:
   - learning outcomes
   - milestone structure
   - recommended required items
   - certificate wording
3. AI suggests a draft track based on uploaded materials or classroom context.
4. Educator edits and publishes.

## Student flow

### Progress through a certification

1. Student opens classroom or progress surfaces.
2. Student sees active certification tracks.
3. Student opens one certification and sees:
   - title
   - course type
   - completion percentage
   - required milestones
   - locked vs completed items
   - certificate reward preview
4. Student completes linked course items.
5. If the certification is external:
   - student opens the course link
   - optional proof can be submitted if required

### Earn and download a certificate

1. Student satisfies the completion rules.
2. System marks the track as earned or awaiting teacher approval.
3. Once issued, student sees:
   - certificate status
   - issue date
   - download action
4. Student opens or downloads the VYDRA CORE certificate.

## UX Placement

## Educator surfaces

Primary entry points:

- new educator nav item: `Certification`
- classroom classwork surface: certification section or card rail
- optional classroom stream announcement when a certification is published

Recommended educator pages:

- `Certification Builder`
- `Certification Roster`
- `Certification Detail`

## Student surfaces

Primary entry points:

- classroom classwork: active certifications
- progress page: earned and in-progress certifications
- student dashboard: highlight active certification goal when relevant

Recommended student pages:

- `Certification Detail`
- `My Certificates`

## Technical Architecture

## High-level model

Certification should be its own classroom-linked system, but it should reuse existing classroom and progress primitives wherever possible.

Core layers:

- `Certification authoring`
- `Certification progress tracking`
- `Certificate issuance`
- `Certificate presentation`

## Reuse strategy

Reuse existing systems for:

- classroom access checks
- educator vs student permissioning
- linked materials and assessment references
- assignment-like publishing conventions
- progress-style student summaries
- AI draft assistance patterns already used in exams and study tools

Keep separate:

- certification definitions
- per-student certification completion states
- issued certificate artifacts
- external proof handling

## Backend Design

## Data model

### `classroom_certifications`

Stores the certification definition.

Fields:

- `id`
- `classroom_id`
- `educator_id`
- `title`
- `description`
- `course_mode`
  - `biomentor_track`
  - `external_course`
- `provider_name`
- `external_url`
- `issuer_name`
- `certificate_subtitle`
- `completion_message`
- `status`
  - `draft`
  - `published`
  - `archived`
- `manual_issue_only`
- `requires_teacher_approval`
- `certificate_template`
- `ai_notes`
- `created_at`
- `updated_at`

### `classroom_certification_steps`

Stores the ordered milestones inside a certification.

Fields:

- `id`
- `certification_id`
- `step_type`
  - `material`
  - `assignment`
  - `quiz`
  - `exam`
  - `external_link`
  - `custom_checkpoint`
- `title`
- `description`
- `linked_resource_id`
- `linked_resource_type`
- `sort_order`
- `required`
- `minimum_score`
- `step_metadata`
- `created_at`
- `updated_at`

### `classroom_certification_enrollments`

Stores each student’s progress against a certification.

Fields:

- `id`
- `certification_id`
- `classroom_id`
- `student_id`
- `status`
  - `not_started`
  - `in_progress`
  - `ready_for_review`
  - `issued`
  - `rejected`
- `completion_percentage`
- `teacher_notes`
- `proof_status`
  - `not_required`
  - `pending`
  - `submitted`
  - `approved`
  - `rejected`
- `completed_at`
- `issued_at`
- `created_at`
- `updated_at`

### `classroom_certification_step_progress`

Stores step-level completion for each learner.

Fields:

- `id`
- `enrollment_id`
- `step_id`
- `status`
  - `locked`
  - `available`
  - `completed`
  - `pending_review`
- `score_achieved`
- `completion_source`
  - `auto`
  - `teacher_override`
  - `student_proof`
- `evidence_payload`
- `completed_at`
- `updated_at`

### `issued_certificates`

Stores the final certificate record.

Fields:

- `id`
- `certification_id`
- `classroom_id`
- `student_id`
- `educator_id`
- `certificate_number`
- `student_name_snapshot`
- `course_title_snapshot`
- `issued_at`
- `file_url`
- `render_payload`
- `created_at`

### `certification_proof_submissions`

Optional proof upload records for external courses.

Fields:

- `id`
- `enrollment_id`
- `student_id`
- `proof_type`
  - `image`
  - `pdf`
  - `text`
  - `link`
- `file_url`
- `text_note`
- `submitted_at`
- `review_status`
- `reviewed_at`
- `reviewed_by`

## API design

Suggested endpoints:

### Certification definitions

- `GET /api/classrooms/{classroom_id}/certifications`
- `POST /api/classrooms/{classroom_id}/certifications`
- `GET /api/classrooms/{classroom_id}/certifications/{certification_id}`
- `PUT /api/classrooms/{classroom_id}/certifications/{certification_id}`
- `POST /api/classrooms/{classroom_id}/certifications/{certification_id}/publish`

### Progress and issuance

- `GET /api/classrooms/{classroom_id}/certifications/{certification_id}/roster`
- `GET /api/classrooms/{classroom_id}/certifications/{certification_id}/me`
- `POST /api/classrooms/{classroom_id}/certifications/{certification_id}/proof`
- `POST /api/classrooms/{classroom_id}/certifications/{certification_id}/issue/{student_id}`
- `POST /api/classrooms/{classroom_id}/certifications/{certification_id}/override-step`

### Certificate artifacts

- `GET /api/certificates/me`
- `GET /api/certificates/{certificate_id}`
- `GET /api/certificates/{certificate_id}/download`

### AI assistance

- `POST /api/classrooms/{classroom_id}/certifications/draft`

## Completion logic

### VYDRA CORE-native certifications

Completion should be calculated from linked steps:

- material opened or explicitly completed
- assignment completed
- quiz submitted, with optional score threshold
- exam submitted, with optional score threshold
- custom step teacher-marked or student-submitted

### External course certifications

Completion can be based on:

- teacher manual confirmation
- student proof submission followed by teacher approval

### Issuance policy

Support:

- auto-ready for issue after requirements are met
- teacher approval before final issue
- manual-only issue for premium control

## Certificate generation

The certificate should be visually premium and VYDRA CORE-branded.

Certificate content:

- student full name
- certification title
- completion line
- educator or issuer name
- classroom name where applicable
- completion or issue date
- VYDRA CORE branding

Rendering options for phase 1:

- server-generated HTML certificate page
- printable or downloadable PDF-style output

## Frontend Design

## Educator experience

### New nav item

- `Certification`

### Certification Builder

Sections:

- track details
- classroom selector
- mode selector
  - `VYDRA CORE track`
  - `External course`
- milestone builder
- completion policy
- issuer and certificate wording
- AI draft helper
- certificate preview

### Certification Roster

Shows:

- enrolled students
- progress percentage
- unmet milestones
- ready-for-review state
- issue certificate button

## Student experience

### Classroom classwork

Add a certification card rail with:

- title
- progress state
- remaining requirements
- open details action

### Progress page

Add:

- active certifications
- earned certificates
- download actions

## AI layer

### AI Certification Builder

Input:

- classroom context
- selected materials
- selected assessments

Output:

- suggested certification title
- suggested learning outcomes
- milestone suggestions
- recommended thresholds
- certificate wording draft

### AI Completion Advisor

Input:

- student completion evidence
- linked assessments and scores
- teacher settings

Output:

- ready to issue
- requires teacher review
- missing requirements summary

## Risks

### 1. Certification can become too administrative

Mitigation:
- anchor it to classrooms and classwork
- reuse familiar educator flows

### 2. External course completion can be weakly verified

Mitigation:
- require teacher approval by default for external tracks
- support optional proof submission

### 3. Too many rule combinations can confuse educators

Mitigation:
- provide presets:
  - all steps required
  - minimum assessment threshold
  - manual teacher issue

### 4. Certificate output can feel generic

Mitigation:
- build a branded certificate layout from day one
- match VYDRA CORE’s premium tone and typography

## Phase 1 Recommendation

Build the first release in this order:

1. certification data model and APIs
2. educator certification builder
3. classroom classwork and student progress integration
4. certificate generation and download
5. AI draft helper for certification setup

## Success Criteria

The feature is successful when:

- educators can create both VYDRA CORE and external certifications
- students can clearly see progress toward a certificate
- certificates can be issued and downloaded without manual file editing
- the certificate looks native to VYDRA CORE
- the system uses existing classroom evidence instead of requiring duplicate tracking work
