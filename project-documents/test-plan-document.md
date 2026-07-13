# VYDRA CORE Test Plan Document

## Document Control

- Project: VYDRA CORE
- Document Type: Test Plan
- Version: 1.0
- Date: 13 May 2026

## 1. Purpose

This test plan defines the strategy, scope, environments, responsibilities, and key test scenarios required to validate the VYDRA CORE web application across student, educator, admin, AI, document, and collaboration workflows.

## 2. Test Objectives

- Verify that core student and educator workflows behave as intended.
- Validate AI-assisted study, quiz generation, and Bloom's tooling behavior.
- Confirm secure role separation and protected data access.
- Validate real-time communication and complaint delivery.
- Confirm offline document access behavior for previously cached content.
- Ensure the application is deployable and operational across supported environments.

## 3. Scope

### 3.1 In Scope

- Authentication and role management
- Student dashboard and materials workflows
- Offline PDF viewer
- AI learning chat and source references
- Quiz generation and scoring
- Bloom's Question Studio
- Progress tracking and recommendations
- Educator dashboards and class insights
- Student-to-educator messaging and complaints
- Collaboration hub, polls, and quick checks
- Admin analytics
- API health and deployment smoke testing

### 3.2 Out of Scope

- Full browser compatibility certification across every legacy browser
- Third-party LMS integration testing not yet implemented
- Native mobile app testing

## 4. Test Strategy

Testing will combine:

- manual exploratory testing
- feature-based functional testing
- API verification
- regression testing
- negative and permission testing
- build and smoke validation

## 5. Test Levels

### 5.1 Unit Testing

Target logic-heavy areas such as:

- Bloom classifier behavior
- question conversion logic
- analytics helpers
- document chunking and retrieval helpers
- security validation utilities

### 5.2 Integration Testing

Validate:

- authentication with route guards
- upload to document processing flow
- quiz generation to quiz submission flow
- complaint creation to educator inbox flow
- websocket notification flows
- classroom join and enrollment flow

### 5.3 System Testing

Validate end-to-end user journeys across student, educator, and admin modes.

### 5.4 Smoke Testing

Run after deployment or restart:

- homepage loads
- login loads
- backend health returns healthy
- authenticated dashboard loads

## 6. Test Environments

### 6.1 Development Environment

- Frontend: Next.js dev server
- Backend: FastAPI with Uvicorn
- Database: local SQLite fallback or Supabase/PostgreSQL
- Vector store: optional Qdrant

### 6.2 Pre-Production Environment

- managed PostgreSQL
- managed Qdrant
- production-like environment variables
- HTTPS and real secret management

## 7. Entry and Exit Criteria

### 7.1 Entry Criteria

- Code merged for target build
- Required environment variables available
- Core services start successfully
- Test users and sample materials prepared

### 7.2 Exit Criteria

- Critical flows pass
- No unresolved severity-1 defects
- Major role-based permission flows validated
- Build succeeds
- Deployment smoke checks pass

## 8. Test Data

Prepare:

- at least one student user
- at least one educator user
- at least one admin user
- one short PDF
- one multi-page PDF
- one document with diagrams or mixed structure
- quiz attempt data
- classroom and session data

## 9. Functional Test Coverage

## 9.1 Authentication

- Register as student
- Register as educator
- Login with valid credentials
- Login with invalid credentials
- Role mismatch handling
- Logout behavior
- Forgot password page access

## 9.2 Materials and Uploads

- Upload valid PDF
- Upload text-only mode
- Upload selected page range
- Reject unsupported file or invalid input
- Delete uploaded material
- Open study viewer

## 9.3 Offline PDF Access

- Open a document online
- Save it for offline use
- Reload while offline or disconnected
- Confirm cached document still opens
- Confirm unsaved documents do not falsely appear offline-ready

## 9.4 Learning Chat

- Ask a question tied to uploaded material
- Verify answer renders
- Verify source references appear when available
- Verify error handling when backend or retrieval is unavailable

## 9.5 Quiz Generation

- Generate quiz from one document
- Generate quiz from multiple documents
- Generate quiz by Bloom level
- Submit answers and verify scoring
- Confirm progress updates after quiz submission

## 9.6 Bloom's Question Studio

- Access page as educator
- Confirm students cannot access page
- Identify current Bloom level for a question
- Generate all six Bloom variants
- Generate one target-level rewrite
- Verify question text is meaningfully transformed across levels

## 9.7 Progress Tracking

- Confirm progress page loads after quiz history exists
- Confirm weak levels and recommendations are calculated
- Confirm empty-state behavior when no quiz data exists

## 9.8 Educator Dashboards

- Create classroom
- View classroom list
- View classroom students
- Open student analytics
- Review class insights
- Assign reinforcement lesson

## 9.9 Communication and Complaints

- Student sends direct educator message
- Student raises complaint
- Educator receives complaint in dashboard
- Educator receives message in communication hub
- Educator resolves complaint
- Student sees educator-issued announcements

## 9.10 Collaboration Hub

- Educator creates live session
- Student joins session
- Educator launches poll
- Student responds to poll
- Educator launches quick check
- Student submits response
- Session summary is generated or displayed

## 9.11 Admin Analytics

- Admin accesses analytics page
- Metrics render successfully
- Class comparison data loads
- complaint summary displays correctly

## 10. Non-Functional Test Coverage

### 10.1 Security Testing

- Verify student cannot access educator-only routes
- Verify educator cannot access admin-only features without admin role
- Verify document access is limited to owner or allowed role
- Verify invalid tokens are rejected
- Verify login lockout or rate-limiting behavior

### 10.2 Performance Testing

- Measure page-load time for dashboard and materials pages
- Measure quiz generation response time for sample files
- Measure retrieval latency for chat requests
- Measure websocket responsiveness for complaint delivery

### 10.3 Reliability Testing

- Restart frontend and backend independently
- Verify graceful behavior when vector search is unavailable
- Verify graceful behavior when remote database is unavailable and fallback is used in development

### 10.4 Usability Testing

- Confirm role-specific navigation is easy to follow
- Confirm educator finds Bloom's tools without student clutter
- Confirm complaint and message flows are understandable to students

## 11. Suggested Detailed Test Cases

### TC-01 Student Registration

- Precondition: no existing account for the chosen email
- Steps: open register, choose student mode, enter valid data, submit
- Expected result: account is created and user can log in

### TC-02 Educator Registration

- Precondition: no existing account for the chosen email
- Steps: open register, choose educator mode, enter valid data, submit
- Expected result: educator account is created and educator dashboard becomes available after login

### TC-03 Student Complaint Delivery

- Precondition: student joined a classroom and educator is logged in
- Steps: student opens classroom page, fills complaint form, submits
- Expected result: complaint appears immediately in educator dashboard or communication hub

### TC-04 Student Message Delivery

- Precondition: student joined a classroom and educator is logged in
- Steps: student sends direct message to educator
- Expected result: message appears in educator communication hub in near real time

### TC-05 Educator Bloom Studio

- Precondition: educator logged in
- Steps: open Bloom's Question Studio, paste question, click identify, click generate all
- Expected result: identified level appears and all Bloom variants are shown

### TC-06 Student Access Restriction

- Precondition: student logged in
- Steps: attempt to open educator Bloom page
- Expected result: student is redirected away or denied access

### TC-07 Offline Viewer

- Precondition: uploaded PDF exists
- Steps: open document, save offline, disconnect, reopen page
- Expected result: document still loads from offline cache

## 12. Regression Areas

Each release should recheck:

- login and logout
- upload and delete
- quiz generation and scoring
- dashboard loading
- educator message and complaint flow
- Bloom's Question Studio
- collaboration hub entry

## 13. Defect Management

- Severity 1: application unavailable, role bypass, data exposure, broken login
- Severity 2: major workflow broken, quiz not scoring, messages not delivered
- Severity 3: non-critical feature issue, UI inconsistency, chart error
- Severity 4: minor polish issue

Defects should include:

- title
- environment
- steps to reproduce
- expected result
- actual result
- screenshots or logs
- severity

## 14. Deliverables

- completed test execution checklist
- defect log
- smoke test evidence
- final test summary report

## 15. Risks

- AI output variability may affect expected wording
- external service failures may affect Supabase or Qdrant-backed flows
- browser caching may create false positives or false negatives in offline workflows

## 16. Approval Readiness

The release is ready when all critical scenarios pass, deployment smoke tests are green, and educator/student communication plus role-based workflows are confirmed stable.

