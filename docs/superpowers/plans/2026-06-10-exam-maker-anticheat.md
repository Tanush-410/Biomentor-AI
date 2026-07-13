# Exam Maker And Anticheat Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-class classroom exam system to VYDRA CORE with a document-style educator exam builder, scheduled and proctored exam delivery, mixed typed and image-based student responses, AI-first descriptive grading with teacher review fallback, and a dedicated `Anticheat Bot` review workspace that stores final debarred cases plus the last three major-warning evidence snapshots.

**Architecture:** Build exams as a sibling assessment system beside classroom quizzes. Reuse current classroom access control, scheduling patterns, proctoring escalation, and review language where possible. Add new SQLAlchemy exam and anti-cheat models, new classroom exam routes and grading helpers, and new educator/student surfaces that parallel the existing quiz workflow while supporting richer paper authoring and per-question response rules.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, existing classroom services, React/Next.js, existing shell components, browser camera APIs, current proctoring heuristics, Python unittest, Node contract tests.

---

### Task 1: Lock the new backend model and schema contract with failing tests

**Files:**
- Modify: `backend/tests/test_classroom_module.py`
- Create: `backend/tests/test_classroom_exams.py`
- Create: `backend/tests/test_exam_grading.py`
- Modify: `backend/tests/test_ai_proctor_review.py`

- [ ] **Step 1: Extend classroom model smoke tests for exam and anti-cheat entities**

Update `backend/tests/test_classroom_module.py` so it imports and asserts the existence of:
- `ClassroomExam`
- `ClassroomExamBlock`
- `ClassroomExamQuestion`
- `ClassroomExamAttempt`
- `ClassroomExamResponse`
- `AssessmentAnticheatCase`
- `AssessmentAnticheatEvidence`

- [ ] **Step 2: Add route existence tests for exam endpoints**

Create `backend/tests/test_classroom_exams.py` with route smoke tests for:
- `GET /api/classrooms/example-classroom/exams`
- `POST /api/classrooms/example-classroom/exams`
- `GET /api/classrooms/example-classroom/exams/example-exam`
- `POST /api/classrooms/example-classroom/exams/example-exam/start`
- `POST /api/classrooms/example-classroom/exams/example-exam/submit`
- `POST /api/classrooms/example-classroom/exams/example-exam/warning`
- `POST /api/classrooms/example-classroom/exams/example-exam/violation`
- `GET /api/classrooms/example-classroom/anticheat-bot`

- [ ] **Step 3: Add grading contract tests for mixed responses and teacher-review fallback**

Create `backend/tests/test_exam_grading.py` so the grading payload must include:
- `objective_score`
- `descriptive_score`
- `keyword_alignment`
- `teacher_review_required`
- `low_confidence_reasons`
- `question_breakdown`

Also require per-question grading metadata such as:

```python
self.assertIn("grading_keywords", breakdown_item)
self.assertIn("response_mode", breakdown_item)
self.assertIn("confidence", breakdown_item)
```

- [ ] **Step 4: Extend proctor review tests for exam-linked anti-cheat cases**

Update `backend/tests/test_ai_proctor_review.py` so the payload requires:
- `assessment_type`
- `final_case_reason`
- `evidence_snapshots`
- `teacher_review_required`

and ensure only the last three evidence snapshots are returned for a case.

- [ ] **Step 5: Run the backend tests to confirm failure**

Run:

```bash
cd /Users/tanush.s.vashisht/Desktop/Tanush/work && python3 -m unittest \
  backend.tests.test_classroom_module \
  backend.tests.test_classroom_exams \
  backend.tests.test_exam_grading \
  backend.tests.test_ai_proctor_review -v
```

Expected:
- FAIL because the exam models, schemas, and anti-cheat case payloads do not exist yet.

### Task 2: Add backend exam and anti-cheat persistence models

**Files:**
- Modify: `backend/app/database/models.py`
- Modify: `backend/app/schemas/__init__.py`

- [ ] **Step 1: Add SQLAlchemy exam entities**

Extend `backend/app/database/models.py` with:
- `ClassroomExam`
- `ClassroomExamBlock`
- `ClassroomExamQuestion`
- `ClassroomExamAttempt`
- `ClassroomExamResponse`

Support:
- document-style block ordering
- per-question marks
- `response_mode` values for typed, upload, or both
- per-question grading keywords
- published/scheduled availability windows
- proctoring and late-entry flags

- [ ] **Step 2: Add anti-cheat review entities**

Add:
- `AssessmentAnticheatCase`
- `AssessmentAnticheatEvidence`

These should support:
- `assessment_type` of `quiz` or `exam`
- classroom, student, and attempt linkage
- final case reason
- case status of `teacher_review_required`, `upheld`, `excused`, `reopened`
- per-warning evidence image paths and timestamps

- [ ] **Step 3: Add Pydantic request and response models**

Extend `backend/app/schemas/__init__.py` with models for:
- exam create/update payloads
- exam block payloads
- question config payloads
- response submission payloads
- grading result payloads
- anti-cheat case list/detail payloads

Be explicit about typed-answer fields versus uploaded-answer fields so the frontend contract stays stable.

- [ ] **Step 4: Re-run the backend contract tests**

Run:

```bash
cd /Users/tanush.s.vashisht/Desktop/Tanush/work && python3 -m unittest \
  backend.tests.test_classroom_module \
  backend.tests.test_classroom_exams \
  backend.tests.test_exam_grading \
  backend.tests.test_ai_proctor_review -v
```

Expected:
- Some tests should still fail because services and routes are not wired yet.

### Task 3: Build backend exam authoring, delivery, grading, and anti-cheat services

**Files:**
- Create: `backend/app/services/exam_authoring.py`
- Create: `backend/app/services/exam_grading.py`
- Create: `backend/app/services/anticheat_bot.py`
- Modify: `backend/app/services/proctor_review.py`
- Modify: `backend/app/services/document_context.py`
- Modify: `backend/app/services/document_storage.py`

- [ ] **Step 1: Add exam-authoring normalization helpers**

Create `backend/app/services/exam_authoring.py` to normalize:
- rich exam blocks
- question metadata
- manual authoring payloads
- AI-generated draft payloads
- classroom-linked and exact-material source references

- [ ] **Step 2: Add AI grading helpers for mixed-format answers**

Create `backend/app/services/exam_grading.py` to:
- autograde objective responses
- score descriptive typed/image answers using grading keywords
- return confidence and review reasons
- mark low-confidence answers for teacher review
- compute final attempt posture without auto-failing debarrment cases

- [ ] **Step 3: Add anti-cheat case assembly helpers**

Create `backend/app/services/anticheat_bot.py` to:
- create or update final anti-cheat cases
- append evidence snapshots at each major warning
- limit teacher-facing evidence to the last three snapshots
- serialize educator review summaries for both quizzes and exams

- [ ] **Step 4: Extend existing proctor review utilities**

Update `backend/app/services/proctor_review.py` so the shared review language works for:
- quizzes
- exams
- final debarred cases
- teacher-review-required outcomes

- [ ] **Step 5: Reuse document helpers for uploaded answer images**

Update `backend/app/services/document_storage.py` and any necessary document-context helpers to store:
- uploaded handwritten answer images
- anti-cheat snapshot evidence

without mixing them into the regular document library list.

### Task 4: Add classroom exam and anticheat API endpoints

**Files:**
- Modify: `backend/app/routers/classrooms.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Add educator exam authoring endpoints**

Extend `backend/app/routers/classrooms.py` with:
- `POST /api/classrooms/{classroom_id}/exams`
- `GET /api/classrooms/{classroom_id}/exams`
- `GET /api/classrooms/{classroom_id}/exams/{exam_id}`
- `POST /api/classrooms/{classroom_id}/exams/{exam_id}/publish`
- `POST /api/classrooms/{classroom_id}/exams/{exam_id}/grade`

- [ ] **Step 2: Add student attempt lifecycle endpoints**

Add:
- `POST /api/classrooms/{classroom_id}/exams/{exam_id}/start`
- `POST /api/classrooms/{classroom_id}/exams/{exam_id}/warning`
- `POST /api/classrooms/{classroom_id}/exams/{exam_id}/violation`
- `POST /api/classrooms/{classroom_id}/exams/{exam_id}/heartbeat`
- `POST /api/classrooms/{classroom_id}/exams/{exam_id}/submit`

- [ ] **Step 3: Add anti-cheat educator review endpoints**

Add:
- `GET /api/classrooms/{classroom_id}/anticheat-bot`
- `GET /api/classrooms/{classroom_id}/anticheat-bot/{case_id}`
- `POST /api/classrooms/{classroom_id}/anticheat-bot/{case_id}/decision`

- [ ] **Step 4: Reuse classwork and notification publication**

When an exam is published, ensure it appears in classroom classwork and optionally classroom stream using the same general announcement/task patterns already used by quizzes.

- [ ] **Step 5: Run backend tests again**

Run:

```bash
cd /Users/tanush.s.vashisht/Desktop/Tanush/work && python3 -m unittest \
  backend.tests.test_classroom_module \
  backend.tests.test_classroom_exams \
  backend.tests.test_exam_grading \
  backend.tests.test_ai_proctor_review -v
```

Expected:
- Backend exam route and payload tests should pass or be close to passing before frontend work begins.

### Task 5: Add frontend API helpers and contract tests for new exam surfaces

**Files:**
- Modify: `frontend/lib/classroomApi.js`
- Create: `frontend/tests/exam-maker-contract.test.mjs`
- Create: `frontend/tests/anticheat-bot-contract.test.mjs`

- [ ] **Step 1: Extend the classroom API client**

Add helpers for:
- `listClassroomExams`
- `getClassroomExam`
- `createClassroomExam`
- `publishClassroomExam`
- `startClassroomExamAttempt`
- `heartbeatClassroomExamAttempt`
- `submitClassroomExamAttempt`
- `reportClassroomExamWarning`
- `reportClassroomExamViolation`
- `listAnticheatCases`
- `getAnticheatCase`
- `decideAnticheatCase`

- [ ] **Step 2: Add contract tests for the educator exam builder surface**

Create `frontend/tests/exam-maker-contract.test.mjs` to assert that the educator page includes:
- `Exam Maker`
- `Manual Draft`
- `AI Draft`
- `Question Suggestions`
- `Fixed Response Box`
- `Grading Keywords`
- `Teacher Review`

- [ ] **Step 3: Add contract tests for the anti-cheat educator workspace**

Create `frontend/tests/anticheat-bot-contract.test.mjs` to assert presence of:
- `Anticheat Bot`
- `Final Debarred Cases`
- `Last 3 Evidence`
- `Teacher Review Required`

- [ ] **Step 4: Run the frontend contract tests to confirm failure**

Run:

```bash
cd /Users/tanush.s.vashisht/Desktop/Tanush/work/frontend && node --test tests/exam-maker-contract.test.mjs tests/anticheat-bot-contract.test.mjs
```

Expected:
- FAIL because those surfaces do not exist yet.

### Task 6: Build the educator Exam Maker and Anticheat Bot surfaces

**Files:**
- Create: `frontend/pages/educator/exam-maker.jsx`
- Create: `frontend/pages/educator/anticheat-bot.jsx`
- Create: `frontend/components/ExamBuilderCanvas.jsx`
- Create: `frontend/components/ExamQuestionEditor.jsx`
- Create: `frontend/components/ExamAIDraftPanel.jsx`
- Create: `frontend/components/AnticheatCaseReviewPanel.jsx`
- Modify: `frontend/components/AppShell.jsx`
- Modify: `frontend/pages/dashboard.jsx`
- Modify: `frontend/pages/classrooms/[id]/classwork.jsx`
- Modify: `frontend/pages/educator/class-insights.jsx`

- [ ] **Step 1: Add educator navigation entry points**

Update `frontend/components/AppShell.jsx` so educator navigation includes:
- `Exam Maker`
- `Anticheat Bot`

and make their route matching explicit.

- [ ] **Step 2: Create the document-style exam authoring page**

Build `frontend/pages/educator/exam-maker.jsx` as a sibling to `quiz-maker.jsx` with:
- manual authoring mode
- AI draft mode
- AI question suggestion mode
- classroom selector
- schedule window fields
- proctoring flags
- publish controls

- [ ] **Step 3: Add reusable exam builder components**

Create a small set of focused components so the paper feels like a mini document editor:
- `ExamBuilderCanvas.jsx` for ordered block rendering
- `ExamQuestionEditor.jsx` for structured question metadata
- `ExamAIDraftPanel.jsx` for AI-generation inputs and insertion workflows

- [ ] **Step 4: Add the educator anti-cheat review workspace**

Create `frontend/pages/educator/anticheat-bot.jsx` and `AnticheatCaseReviewPanel.jsx` to show:
- final debarred cases only
- last three evidence snapshots
- final reason and review posture
- teacher decision actions

- [ ] **Step 5: Surface the new educator workflows**

Update `frontend/pages/dashboard.jsx`, `frontend/pages/classrooms/[id]/classwork.jsx`, and `frontend/pages/educator/class-insights.jsx` so the new exam and anti-cheat flows are discoverable instead of hidden.

- [ ] **Step 6: Re-run the frontend contract tests**

Run:

```bash
cd /Users/tanush.s.vashisht/Desktop/Tanush/work/frontend && node --test tests/exam-maker-contract.test.mjs tests/anticheat-bot-contract.test.mjs
```

Expected:
- PASS once the educator-facing surfaces exist.

### Task 7: Build the student exam runtime with proctoring, autosave, and mixed responses

**Files:**
- Create: `frontend/pages/classrooms/[id]/exam/[examId].jsx`
- Create: `frontend/components/ExamAttemptCanvas.jsx`
- Create: `frontend/components/ExamAnswerBox.jsx`
- Modify: `frontend/components/ClassroomShell.jsx`
- Modify: `frontend/pages/classrooms/[id]/classwork.jsx`
- Create: `frontend/tests/exam-attempt-contract.test.mjs`

- [ ] **Step 1: Add classwork links into exam delivery**

Update `frontend/pages/classrooms/[id]/classwork.jsx` to render scheduled exam cards beside quizzes and materials, including:
- availability window
- proctoring status
- `Open Exam` entry action

- [ ] **Step 2: Create the student exam runtime page**

Build `frontend/pages/classrooms/[id]/exam/[examId].jsx` by adapting the current proctored quiz runtime to support:
- fullscreen and camera enforcement
- typed answers
- uploaded handwritten/photo responses
- autosave and heartbeat
- teacher-review-required outcomes after auto-end

- [ ] **Step 3: Add exam-specific answer rendering components**

Create:
- `ExamAttemptCanvas.jsx` to render the mixed document paper
- `ExamAnswerBox.jsx` for fixed response boxes and per-question mode handling

- [ ] **Step 4: Capture major-warning evidence on the client**

Ensure the runtime captures snapshots at each major warning event and submits them with the warning/violation payload.

- [ ] **Step 5: Add a runtime contract test**

Create `frontend/tests/exam-attempt-contract.test.mjs` to assert the page contains:
- `Teacher review required`
- `Fixed response box`
- `Upload handwritten response`
- `Proctoring active`

- [ ] **Step 6: Run the student runtime contract test**

Run:

```bash
cd /Users/tanush.s.vashisht/Desktop/Tanush/work/frontend && node --test tests/exam-attempt-contract.test.mjs
```

Expected:
- PASS after the runtime is implemented.

### Task 8: Final integration, regression checks, and build verification

**Files:**
- Verify across modified backend and frontend files from Tasks 1-7

- [ ] **Step 1: Run the targeted backend suite**

Run:

```bash
cd /Users/tanush.s.vashisht/Desktop/Tanush/work && python3 -m unittest \
  backend.tests.test_classroom_module \
  backend.tests.test_classroom_exams \
  backend.tests.test_exam_grading \
  backend.tests.test_ai_proctor_review \
  backend.tests.test_document_storage -v
```

- [ ] **Step 2: Run the targeted frontend contract suite**

Run:

```bash
cd /Users/tanush.s.vashisht/Desktop/Tanush/work/frontend && node --test \
  tests/exam-maker-contract.test.mjs \
  tests/anticheat-bot-contract.test.mjs \
  tests/exam-attempt-contract.test.mjs
```

- [ ] **Step 3: Run a production frontend build**

Run:

```bash
cd /Users/tanush.s.vashisht/Desktop/Tanush/work/frontend && npm run build -- --no-lint
```

- [ ] **Step 4: Run a focused backend import/startup check**

Run:

```bash
cd /Users/tanush.s.vashisht/Desktop/Tanush/work && python3 -m unittest backend.tests.test_classroom_module -v
```

and, if needed for manual sanity:

```bash
cd /Users/tanush.s.vashisht/Desktop/Tanush/work/backend && DATABASE_URL=sqlite:///./app.db python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

- [ ] **Step 5: Commit in stable slices**

Recommended commit boundaries:
1. `feat: add classroom exam and anticheat backend models`
2. `feat: add classroom exam routes and grading services`
3. `feat: add educator exam maker and anticheat bot surfaces`
4. `feat: add proctored student exam runtime`
5. `test: cover exam maker and anticheat workflows`
