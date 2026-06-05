# AI Classroom Intelligence Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade AI Classroom Intelligence from a lightweight summary panel into a sharper classroom diagnosis and action system that clearly separates class-wide patterns from individual learner issues and gives both teachers and students more specific next steps.

**Architecture:** Extend the backend classroom intelligence service to build richer teacher and student payloads from quiz, material, complaint, and meeting signals, then expand the API contract and replace the current subtle classroom panel with more explicit teacher/student intelligence workspaces in Stream and Classwork. Keep the role-aware endpoint shape, but make the outputs more diagnostic, evidence-aware, and actionable.

**Tech Stack:** FastAPI, SQLAlchemy, shared AI confidence helpers, React/Next.js, existing classroom shell/panel patterns, Python unittest, Node contract tests.

---

### Task 1: Expand the classroom intelligence response contract

**Files:**
- Modify: `backend/app/schemas/__init__.py`
- Test: `backend/tests/test_ai_classroom_intelligence.py`

- [ ] **Step 1: Write the failing schema/service test**

Add expectations to `backend/tests/test_ai_classroom_intelligence.py` for new fields:

```python
        self.assertIn("class_pattern_summary", payload)
        self.assertIn("reteach_recommendations", payload)
        self.assertIn("student_focus_groups", payload)
        self.assertIn("teacher_brief", payload)
```

and for the student payload:

```python
        self.assertIn("class_focus_reason", payload)
        self.assertIn("personal_focus_reason", payload)
        self.assertIn("study_targets", payload)
        self.assertIn("ask_next", payload)
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd backend && python3 -m unittest backend.tests.test_ai_classroom_intelligence -v
```

Expected:
- FAIL because the current payload does not yet expose the richer fields

- [ ] **Step 3: Extend the response models**

Update `backend/app/schemas/__init__.py` with richer classroom intelligence models, for example:

```python
class ClassroomTeacherFocusGroup(BaseModel):
    label: str
    reason: str
    learner_count: int


class ClassroomTeacherReteachRecommendation(BaseModel):
    topic: str
    reason: str
    recommended_move: str


class ClassroomTeacherBrief(BaseModel):
    now: str
    next: str
    later: str


class ClassroomStudentStudyTarget(BaseModel):
    label: str
    reason: str
    target_url: Optional[str] = None
```

Then extend `ClassroomTeacherIntelligenceResponse` and `ClassroomStudentIntelligenceResponse` with:

```python
class_pattern_summary: List[str] = Field(default_factory=list)
reteach_recommendations: List[ClassroomTeacherReteachRecommendation] = Field(default_factory=list)
student_focus_groups: List[ClassroomTeacherFocusGroup] = Field(default_factory=list)
teacher_brief: Optional[ClassroomTeacherBrief] = None

class_focus_reason: Optional[str] = None
personal_focus_reason: Optional[str] = None
study_targets: List[ClassroomStudentStudyTarget] = Field(default_factory=list)
ask_next: List[str] = Field(default_factory=list)
```

- [ ] **Step 4: Run the backend schema test again**

Run:

```bash
cd backend && python3 -m unittest backend.tests.test_ai_classroom_intelligence -v
```

Expected:
- still FAIL, but now because the service logic does not yet build the new fields

### Task 2: Upgrade backend classroom intelligence logic

**Files:**
- Modify: `backend/app/services/classroom_intelligence.py`
- Test: `backend/tests/test_ai_classroom_intelligence.py`

- [ ] **Step 1: Write a failing teacher-behavior test**

Add a test that requires classroom diagnosis to separate patterns and actions:

```python
        self.assertGreaterEqual(len(payload["class_pattern_summary"]), 1)
        self.assertGreaterEqual(len(payload["reteach_recommendations"]), 1)
        self.assertGreaterEqual(len(payload["student_focus_groups"]), 1)
        self.assertEqual(payload["teacher_brief"]["now"], "...")
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd backend && python3 -m unittest backend.tests.test_ai_classroom_intelligence.ClassroomIntelligenceServiceTest.test_teacher_payload_prioritizes_focus_and_actions -v
```

Expected:
- FAIL because the current teacher payload does not produce those richer diagnosis fields

- [ ] **Step 3: Implement the teacher intelligence upgrade**

Update `backend/app/services/classroom_intelligence.py` so the teacher payload now builds:

```python
{
    "overview_summary": "...",
    "focus_topics": [...],
    "focus_topic_details": [...],
    "class_pattern_summary": [
        "Analyze-level questions are the strongest class-wide weak signal.",
    ],
    "student_focus_groups": [
        {
            "label": "High-risk reteach group",
            "reason": "These learners are weak on Analyze and have low recent scores.",
            "learner_count": 3,
        }
    ],
    "reteach_recommendations": [
        {
            "topic": "Analyze",
            "reason": "It appears in the most repeated weak-topic signals.",
            "recommended_move": "Post one worked example and one short practice task before the next quiz.",
        }
    ],
    "teacher_brief": {
        "now": "...",
        "next": "...",
        "later": "...",
    },
}
```

Use the existing signals to distinguish:
- class-wide repeated gaps
- individual high-risk learners
- missing material/assignment structure
- meeting follow-up carryover

- [ ] **Step 4: Write a failing student-behavior test**

Add a test that requires clearer student focus cues:

```python
        self.assertTrue(payload["class_focus_reason"])
        self.assertTrue(payload["personal_focus_reason"])
        self.assertGreaterEqual(len(payload["study_targets"]), 1)
        self.assertGreaterEqual(len(payload["ask_next"]), 1)
```

- [ ] **Step 5: Run the student test to verify it fails**

Run:

```bash
cd backend && python3 -m unittest backend.tests.test_ai_classroom_intelligence.ClassroomIntelligenceServiceTest.test_student_payload_surfaces_personal_focus_and_next_steps -v
```

Expected:
- FAIL because the student payload does not yet produce those richer guidance fields

- [ ] **Step 6: Implement the student intelligence upgrade**

Update `build_student_classroom_intelligence()` so it now returns:

```python
{
    "overview_summary": "...",
    "focus_topics": [...],
    "personalized_focus": "Analyze",
    "class_focus_reason": "...",
    "personal_focus_reason": "...",
    "study_targets": [
        {"label": "Open Cell Biology Notes", "reason": "...", "target_url": "/document/doc-1"}
    ],
    "ask_next": [
        "Ask Learning Chat to compare Analyze vs Apply questions from this classroom topic."
    ],
}
```

Make these outputs:
- explain why the class focus matters
- explain why the student’s personal focus differs when it does
- suggest sharper classroom-specific next questions

- [ ] **Step 7: Run the backend suite**

Run:

```bash
cd backend && python3 -m unittest backend.tests.test_ai_classroom_intelligence -v
```

Expected:
- PASS

### Task 3: Upgrade the classroom intelligence UI surfaces

**Files:**
- Modify: `frontend/components/ClassroomIntelligencePanel.jsx`
- Modify: `frontend/pages/classrooms/[id]/stream.jsx`
- Modify: `frontend/pages/classrooms/[id]/classwork.jsx`
- Test: `frontend/tests/classroom-intelligence-contract.test.mjs`

- [ ] **Step 1: Write the failing frontend contract test**

Extend `frontend/tests/classroom-intelligence-contract.test.mjs` to require stronger surfacing cues:

```js
  assert.match(source, /Classroom Command Center/)
  assert.match(source, /Class patterns/)
  assert.match(source, /Reteach recommendations/)
  assert.match(source, /Study targets/)
  assert.match(source, /Ask next/)
```

- [ ] **Step 2: Run the contract test to verify it fails**

Run:

```bash
cd frontend && node --test tests/classroom-intelligence-contract.test.mjs
```

Expected:
- FAIL because the current panel still uses the older lighter layout

- [ ] **Step 3: Rebuild the panel for stronger teacher and student views**

Update `frontend/components/ClassroomIntelligencePanel.jsx` so:
- teacher mode becomes a stronger named workspace such as `Classroom Command Center`
- it renders sections for:
  - `Class patterns`
  - `Reteach recommendations`
  - `Student focus groups`
  - `Teacher brief`
- student mode becomes a stronger study-oriented workspace rendering:
  - `Class focus`
  - `Personal focus`
  - `Study targets`
  - `Ask next`

- [ ] **Step 4: Strengthen Stream and Classwork page surfacing**

Update the classroom pages so the intelligence panel is more prominent:

```jsx
<ClassroomIntelligencePanel
  intelligence={intelligence}
  role={user?.role}
  variant="stream"
  headline="Classroom Command Center"
/>
```

and place it higher in the page rhythm so it feels like a primary AI surface instead of a subtle insert.

- [ ] **Step 5: Run the frontend contract test again**

Run:

```bash
cd frontend && node --test tests/classroom-intelligence-contract.test.mjs
```

Expected:
- PASS

### Task 4: Run final verification for the slice

**Files:**
- No code changes expected

- [ ] **Step 1: Run backend verification**

Run:

```bash
cd backend && python3 -m unittest backend.tests.test_ai_classroom_intelligence -v
```

Expected:
- PASS

- [ ] **Step 2: Run frontend verification**

Run:

```bash
cd frontend && node --test tests/classroom-intelligence-contract.test.mjs
```

Expected:
- PASS

- [ ] **Step 3: Run the production build**

Run:

```bash
cd frontend && npm run build -- --no-lint
```

Expected:
- PASS
