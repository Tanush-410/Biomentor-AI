# VYDRA CORE Certification Implementation Plan

Date: 2026-06-12

## Objective

Implement the new classroom-linked `Certification` feature described in `2026-06-12-certification-design.md` so educators can create VYDRA CORE-native and external-course certification tracks, monitor student completion, and issue branded certificates.

## Build Order

### 1. Backend foundations

- add certification models:
  - `classroom_certifications`
  - `classroom_certification_steps`
  - `classroom_certification_enrollments`
  - `classroom_certification_step_progress`
  - `issued_certificates`
- extend incremental database initialization for the new tables if needed
- add Pydantic schemas for:
  - certification creation and update
  - certification steps
  - roster responses
  - student progress responses
  - certificate artifact responses
- add backend helper logic for:
  - certification serialization
  - automatic student enrollment seeding from classroom members
  - completion-percentage calculation
  - issuance readiness evaluation

### 2. Certification API layer

- add classroom certification endpoints to the classroom router
- add certificate artifact endpoints for student access and download
- add classwork integration so certifications surface beside quizzes and exams
- add progress integration so earned and active certifications appear in student progress

### 3. Educator UI

- add a new educator nav item: `Certification`
- create an educator certification builder page
- support both:
  - `VYDRA CORE track`
  - `External course`
- support:
  - classroom selection
  - milestone creation
  - minimum-score rules
  - manual or approval-gated issuing
  - branded certificate preview

### 4. Classroom and student UI

- add certification cards to classroom classwork
- add student-facing certification detail page
- add certificate progress and earned-certificate sections to progress
- add download action for issued certificates

### 5. Certificate rendering

- build a branded HTML certificate surface in the VYDRA CORE theme
- expose a printable/downloadable certificate route
- include:
  - student name
  - course title
  - educator or issuer line
  - completion or issue date
  - VYDRA CORE branding

### 6. Verification

- add backend tests for:
  - creation
  - roster generation
  - completion logic
  - issuance
- add frontend contract tests for:
  - educator builder rendering
  - classwork certification presence
  - progress page certificate surfacing
- run targeted verification before claiming completion

## Assumptions

- phase 1 external-course completion will support teacher confirmation and optional descriptive proof notes before richer dedicated proof uploads
- certificate download will be implemented as a printable branded certificate page first, with stable artifact records in the database
- classroom students will be considered enrolled into published certifications automatically when they are visible members of the classroom
