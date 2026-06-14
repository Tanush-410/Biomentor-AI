# Classroom Proctored Quiz Module Plan

Goal: Add an educator quiz maker in the existing dashboard, allow publishing quizzes into classrooms with scheduled availability windows, let students take those quizzes inside the classroom flow, and enforce browser-level proctoring with automatic termination and educator notification on suspicious behavior.

## Scope
- Keep the existing student and educator dashboards, classroom module, materials, chat, collaboration, and progress flows intact.
- Add classroom-scoped quiz authoring, publishing, attempt-taking, and proctoring.
- Use browser-safe proctoring signals now: camera permission, fullscreen, tab visibility, blur/focus loss, and heartbeat checks.
- Prepare notification flow so educator gets immediate alert through existing in-app/ws system.

## Product Decisions
- Educator authoring lives in a new dashboard action: `Quiz Maker`.
- Published quizzes appear inside classroom `Classwork` and optionally as stream posts.
- Scheduling uses `available_from` and `available_until`.
- Student attempts are only allowed inside the active window.
- Proctoring is browser-based, not native lockdown. We detect violations and auto-end the quiz on first hard violation.
- Students must grant camera access before starting a proctored classroom quiz.

## Backend Changes
1. Extend models with classroom quiz entities.
   - `ClassroomQuiz`
   - `ClassroomQuizAttempt`
   - `ClassroomQuizViolation`
2. Add schemas for quiz authoring, publishing, attempt start, attempt submit, proctor events.
3. Add classroom quiz routes in `classrooms.py` for:
   - create quiz
   - list quizzes for classroom classwork
   - get quiz detail
   - start attempt
   - submit attempt
   - post proctor violation
4. Reuse existing quiz generation pipeline to generate questions from linked material and Bloom settings when a student starts an attempt.
5. Notify educator immediately on proctor violation via notification rows and educator websocket payloads.
6. Add incremental DB column/table safety through `init_db()` path.

## Frontend Changes
1. Educator dashboard
   - Add `Quiz Maker` CTA.
2. New educator page
   - `/educator/quiz-maker`
   - build/publish classroom quiz form
3. Classroom classwork page
   - show published quizzes separately from generic tasks
   - educator can publish/schedule from classwork and dashboard-created quizzes
4. Student classroom quiz page
   - `/classrooms/[id]/quiz/[quizId]`
   - preflight camera/fullscreen gate
   - attempt UI
   - proctor status panel
5. Shared API helpers for classroom quizzes.

## Proctoring Signals
- Required before attempt starts:
  - camera permission granted
  - fullscreen entered
- Hard violations:
  - tab hidden
  - window blur while attempt active
  - fullscreen exit
  - camera stream ends or becomes unavailable
- On violation:
  - frontend posts violation event
  - backend marks attempt terminated
  - quiz ends locally
  - educator receives notification

## Verification
- backend unit tests for classroom quiz routes and violation handling
- backend syntax verification
- frontend build verification
