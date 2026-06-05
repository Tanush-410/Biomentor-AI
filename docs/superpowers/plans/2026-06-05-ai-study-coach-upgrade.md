# AI Study Coach Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade AI Study Coach from a light recommendation layer into an adaptive study planner with explicit learning modes, daily and weekly goals, stronger next-step sequencing, and much more visible student-facing coaching surfaces.

**Architecture:** Expand the backend coach payloads to include study mode, goals, recovery paths, and more specific reasoned actions derived from quiz gaps, document availability, and current learning context. Then redesign the dashboard, progress, materials, and learning-chat coach surfaces so the coach appears as a primary workflow driver instead of a subtle support card.

**Tech Stack:** FastAPI, existing analytics helpers, Pydantic response models, React/Next.js, shared coach UI components, Python unittest, Node contract tests.

---

### Task 1: Expand the Study Coach backend response contract

**Files:**
- Modify: `backend/app/schemas/__init__.py`
- Test: `backend/tests/test_ai_study_coach.py`

- [ ] **Step 1: Write failing tests for the richer coach payload**

Extend `backend/tests/test_ai_study_coach.py` so it requires these new fields:

```python
        self.assertIn("study_mode", payload)
        self.assertIn("daily_goal", payload)
        self.assertIn("weekly_plan", payload)
        self.assertIn("recovery_path", payload)
```

and for progress/chat payloads:

```python
        self.assertIn("mode_reason", payload)
        self.assertIn("checkpoint_goal", payload)
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd /Users/tanush.s.vashisht/Desktop/Tanush/work && python3 -m unittest backend.tests.test_ai_study_coach -v
```

Expected:
- FAIL because the current response shape is too small

- [ ] **Step 3: Expand the Study Coach response models**

Update `backend/app/schemas/__init__.py` to introduce explicit models such as:

```python
class StudyCoachGoal(BaseModel):
    label: str
    reason: str


class StudyCoachWeeklyStep(BaseModel):
    label: str
    reason: str
    target_url: Optional[str] = None
```

and expand the response models so they include:
- `study_mode`
- `mode_reason`
- `daily_goal`
- `weekly_plan`
- `recovery_path`
- `checkpoint_goal`

- [ ] **Step 4: Re-run the Study Coach backend tests**

Run:

```bash
cd /Users/tanush.s.vashisht/Desktop/Tanush/work && python3 -m unittest backend.tests.test_ai_study_coach -v
```

Expected:
- still FAIL, but now because the service builders do not yet produce the fields

### Task 2: Deepen backend Study Coach logic

**Files:**
- Modify: `backend/app/services/study_coach.py`
- Test: `backend/tests/test_ai_study_coach.py`

- [ ] **Step 1: Add failing tests for adaptive coach behavior**

Add tests for:
- low-score learners enter `reinforcement` mode
- stronger learners can enter `challenge` mode
- empty history stays conservative
- materials recommendations explain why one document comes next

Example:

```python
    def test_overview_assigns_reinforcement_mode_for_low_mastery(self):
        payload = build_study_coach_overview(...)
        self.assertEqual(payload["study_mode"], "reinforcement")
        self.assertTrue(payload["daily_goal"]["label"])
```

- [ ] **Step 2: Run the targeted test to watch it fail**

Run:

```bash
cd /Users/tanush.s.vashisht/Desktop/Tanush/work && python3 -m unittest backend.tests.test_ai_study_coach.StudyCoachServiceTest -v
```

Expected:
- FAIL because mode/goal/recovery logic does not exist yet

- [ ] **Step 3: Implement richer coach builders**

Update `backend/app/services/study_coach.py` so:
- `build_study_coach_overview()` returns:
  - `study_mode`
  - `mode_reason`
  - `daily_goal`
  - `weekly_plan`
  - `recovery_path`
  - stronger `next_action`
- `build_study_coach_progress_payload()` returns:
  - `study_mode`
  - `mode_reason`
  - `checkpoint_goal`
  - specific practice sequence
- `build_study_coach_materials_payload()` returns:
  - more than one recommendation when possible
  - clearer sequencing reason
- `build_study_coach_chat_payload()` returns:
  - smarter follow-up prompts
  - `checkpoint_goal`
  - explicit quick-check timing guidance

Use clear modes:

```python
"revision"
"reinforcement"
"challenge"
```

- [ ] **Step 4: Re-run the Study Coach backend suite**

Run:

```bash
cd /Users/tanush.s.vashisht/Desktop/Tanush/work && python3 -m unittest backend.tests.test_ai_study_coach -v
```

Expected:
- PASS

### Task 3: Make the shared Study Coach panel more like a primary AI module

**Files:**
- Modify: `frontend/components/StudyCoachPanel.jsx`
- Test: `frontend/tests/study-coach-contract.test.mjs`

- [ ] **Step 1: Add failing frontend contract expectations**

Extend `frontend/tests/study-coach-contract.test.mjs` to check for:
- `Study mode`
- `Daily goal`
- `Weekly plan`
- `Recovery path`

- [ ] **Step 2: Run the contract test to verify it fails**

Run:

```bash
cd /Users/tanush.s.vashisht/Desktop/Tanush/work/frontend && node --test tests/study-coach-contract.test.mjs
```

Expected:
- FAIL because the current coach panel is still generic

- [ ] **Step 3: Expand the reusable Study Coach UI**

Refactor `frontend/components/StudyCoachPanel.jsx` to support:
- a stronger title area
- visible mode badge
- larger primary goal area
- richer action list or step list

Keep it reusable across dashboard, progress, materials, and chat.

- [ ] **Step 4: Re-run the contract test**

Run:

```bash
cd /Users/tanush.s.vashisht/Desktop/Tanush/work/frontend && node --test tests/study-coach-contract.test.mjs
```

Expected:
- PASS

### Task 4: Rebuild the dashboard Study Coach surface

**Files:**
- Modify: `frontend/pages/dashboard.jsx`
- Test: `frontend/tests/study-coach-contract.test.mjs`

- [ ] **Step 1: Add a failing dashboard contract**

Require stronger dashboard surfacing text such as:
- `Study Coach Command`
- `Current mode`
- `Today’s goal`

- [ ] **Step 2: Run the contract test to verify failure**

Run:

```bash
cd /Users/tanush.s.vashisht/Desktop/Tanush/work/frontend && node --test tests/study-coach-contract.test.mjs
```

Expected:
- FAIL because the dashboard still uses a lighter coach card

- [ ] **Step 3: Upgrade the dashboard module**

Update `frontend/pages/dashboard.jsx` so the coach becomes a primary student command section with:
- current mode
- next best move
- today’s goal
- weekly plan preview
- weak focus areas

- [ ] **Step 4: Re-run the contract test**

Run:

```bash
cd /Users/tanush.s.vashisht/Desktop/Tanush/work/frontend && node --test tests/study-coach-contract.test.mjs
```

Expected:
- PASS

### Task 5: Rebuild the progress, materials, and chat coach surfaces

**Files:**
- Modify: `frontend/pages/progress.jsx`
- Modify: `frontend/pages/documents.jsx`
- Modify: `frontend/pages/learning-chat.jsx`
- Test: `frontend/tests/study-coach-contract.test.mjs`

- [ ] **Step 1: Add failing page-level contract expectations**

Require stronger visible cues on each page:
- `Progress`: `Checkpoint goal`, `Recommended practice order`
- `Documents`: `Coach Recommended Review Path`
- `Learning Chat`: `Coach next question`, `Quick Check timing`

- [ ] **Step 2: Run the contract test to verify failure**

Run:

```bash
cd /Users/tanush.s.vashisht/Desktop/Tanush/work/frontend && node --test tests/study-coach-contract.test.mjs
```

Expected:
- FAIL because these stronger surfaces do not yet exist

- [ ] **Step 3: Upgrade the page surfaces**

Update:
- `frontend/pages/progress.jsx` to show checkpoint and clearer order logic
- `frontend/pages/documents.jsx` to make coach guidance about what to open next more prominent and sequenced
- `frontend/pages/learning-chat.jsx` to frame coach suggestions as what to ask next and when to test

- [ ] **Step 4: Re-run the contract test**

Run:

```bash
cd /Users/tanush.s.vashisht/Desktop/Tanush/work/frontend && node --test tests/study-coach-contract.test.mjs
```

Expected:
- PASS

### Task 6: Verify the complete Study Coach upgrade slice

**Files:**
- Test: `backend/tests/test_ai_study_coach.py`
- Test: `frontend/tests/study-coach-contract.test.mjs`

- [ ] **Step 1: Run backend verification**

Run:

```bash
cd /Users/tanush.s.vashisht/Desktop/Tanush/work && python3 -m unittest backend.tests.test_ai_study_coach -v
```

Expected:
- PASS

- [ ] **Step 2: Run frontend contract verification**

Run:

```bash
cd /Users/tanush.s.vashisht/Desktop/Tanush/work/frontend && node --test tests/study-coach-contract.test.mjs
```

Expected:
- PASS

- [ ] **Step 3: Run a production build**

Run:

```bash
cd /Users/tanush.s.vashisht/Desktop/Tanush/work/frontend && npm run build -- --no-lint
```

Expected:
- PASS
