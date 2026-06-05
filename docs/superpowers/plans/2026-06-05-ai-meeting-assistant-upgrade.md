# AI Meeting Assistant Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade AI Meeting Assistant from a lightweight notes helper into a sharper classroom copilot that gives teachers specific live guidance and gives students stronger post-meeting recap and study follow-up.

**Architecture:** Extend the backend meeting assistant payload to distinguish class concepts, educator actions, unresolved doubts, and follow-up assets more clearly, then expand the assistant and recap API contracts and rebuild the meeting-room/live-lobby UI so the assistant is more visible and obviously useful. Preserve the current transcript + event ingestion path, but make its outputs more structured, evidence-aware, and classroom-specific.

**Tech Stack:** FastAPI, SQLAlchemy meeting transcript/event storage, Groq-backed optional summarization, shared AI confidence helpers, React/Next.js, existing live-room UI, Python unittest, Node contract tests.

---

### Task 1: Expand the meeting assistant response contract

**Files:**
- Modify: `backend/app/schemas/__init__.py`
- Test: `backend/tests/test_ai_meeting_assistant.py`

- [ ] **Step 1: Write the failing contract test**

Extend `backend/tests/test_ai_meeting_assistant.py` with assertions for richer teacher and student recap structure:

```python
        self.assertIn("concept_signals", snapshot)
        self.assertIn("teacher_moves", snapshot)
        self.assertIn("student_risk_flags", snapshot)
        self.assertIn("follow_up_assets", snapshot)
```

and:

```python
        self.assertIn("study_recap", payload)
        self.assertIn("unresolved_questions", payload)
        self.assertIn("next_class_moves", payload)
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
python3 -m unittest backend.tests.test_ai_meeting_assistant -v
```

Expected:
- FAIL because the current response models and service outputs do not expose these fields

- [ ] **Step 3: Extend the meeting assistant schemas**

Update `backend/app/schemas/__init__.py` with richer meeting assistant section models, for example:

```python
class MeetingAssistantTeacherMove(BaseModel):
    label: str
    reason: str


class MeetingAssistantFollowUpAsset(BaseModel):
    label: str
    reason: str


class MeetingAssistantSnapshotResponse(BaseModel):
    meeting_id: str
    live_notes: MeetingAssistantSection
    concept_signals: MeetingAssistantSection
    action_items: MeetingAssistantSection
    teacher_moves: List[MeetingAssistantTeacherMove] = Field(default_factory=list)
    student_risk_flags: MeetingAssistantSection
    unresolved_doubts: MeetingAssistantSection
    follow_up_assets: List[MeetingAssistantFollowUpAsset] = Field(default_factory=list)
    follow_up_suggestions: MeetingAssistantSection
    updated_at: Optional[datetime] = None
```

and:

```python
class MeetingRecapResponse(BaseModel):
    meeting_id: str
    summary: str
    study_recap: List[str] = Field(default_factory=list)
    action_items: List[str] = Field(default_factory=list)
    key_takeaways: List[str] = Field(default_factory=list)
    unresolved_questions: List[str] = Field(default_factory=list)
    next_class_moves: List[str] = Field(default_factory=list)
```

- [ ] **Step 4: Run the test again**

Run:

```bash
python3 -m unittest backend.tests.test_ai_meeting_assistant -v
```

Expected:
- still FAIL, but now because the backend service does not yet build the richer fields

### Task 2: Upgrade backend meeting assistant generation

**Files:**
- Modify: `backend/app/services/meeting_assistant.py`
- Modify: `backend/app/routers/classrooms.py`
- Test: `backend/tests/test_ai_meeting_assistant.py`

- [ ] **Step 1: Write the failing service assertions**

Add expectations in `backend/tests/test_ai_meeting_assistant.py` so the snapshot and summary must return sharper classroom outputs:

```python
        self.assertTrue(snapshot["concept_signals"]["items"])
        self.assertTrue(snapshot["teacher_moves"])
        self.assertTrue(snapshot["follow_up_assets"])
```

and:

```python
        self.assertIn("study_recap", payload)
        self.assertIn("unresolved_questions", payload)
        self.assertIn("next_class_moves", payload)
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
python3 -m unittest backend.tests.test_ai_meeting_assistant.MeetingAssistantServiceTest -v
```

Expected:
- FAIL because the current service still emits the lighter snapshot and recap payloads

- [ ] **Step 3: Upgrade the teacher snapshot logic**

Update `backend/app/services/meeting_assistant.py` so `build_teacher_assistant_snapshot()` now produces:

```python
{
    "live_notes": {"items": [...]},
    "concept_signals": {"items": [...]},
    "action_items": {"items": [...]},
    "teacher_moves": [
        {"label": "Reteach osmosis with one worked comparison", "reason": "..."}
    ],
    "student_risk_flags": {"items": [...]},
    "unresolved_doubts": {"items": [...]},
    "follow_up_assets": [
        {"label": "Share one osmosis comparison sheet", "reason": "..."}
    ],
    "follow_up_suggestions": {"items": [...]},
}
```

Use transcript/event cues to:
- extract recurring concepts
- infer teacher moves from repeated doubts
- flag weak-stability classroom moments like missing clarity or repeated confusion

- [ ] **Step 4: Upgrade the teacher/student recap builders**

Update the summary generation path so teacher and student outputs include:

```python
teacher_summary = {
    "summary": "...",
    "action_items": [...],
    "unresolved_doubts": [...],
    "follow_up_suggestions": [...],
    "teacher_moves": [...],
    "follow_up_assets": [...],
}

student_summary = {
    "summary": "...",
    "study_recap": [...],
    "action_items": [...],
    "key_takeaways": [...],
    "unresolved_questions": [...],
    "next_class_moves": [...],
}
```

Ensure the fallback path also fills those fields even when Groq is unavailable.

- [ ] **Step 5: Update the route serialization**

Adjust `backend/app/routers/classrooms.py` so:
- `/assistant` returns the richer teacher snapshot shape
- `/recap` returns the richer student-safe recap shape

- [ ] **Step 6: Run the backend suite**

Run:

```bash
python3 -m unittest backend.tests.test_ai_meeting_assistant -v
```

Expected:
- PASS

### Task 3: Upgrade the meeting assistant UI surfaces

**Files:**
- Modify: `frontend/components/MeetingAssistantPanel.jsx`
- Modify: `frontend/components/VideoMeetingRoom.jsx`
- Modify: `frontend/pages/classrooms/[id]/live.jsx`
- Test: `frontend/tests/meeting-assistant-contract.test.mjs`

- [ ] **Step 1: Write the failing frontend contract test**

Extend `frontend/tests/meeting-assistant-contract.test.mjs` to require the richer assistant headings:

```js
  assert.match(source, /Concept Signals/)
  assert.match(source, /Teacher Moves/)
  assert.match(source, /Student Risk Flags/)
  assert.match(source, /Follow-up Assets/)
  assert.match(source, /Study recap/)
  assert.match(source, /Next class moves/)
```

- [ ] **Step 2: Run the contract test to verify it fails**

Run:

```bash
cd frontend && node --test tests/meeting-assistant-contract.test.mjs
```

Expected:
- FAIL because the current UI still exposes the smaller meeting assistant surface

- [ ] **Step 3: Rebuild the teacher meeting assistant panel**

Update `frontend/components/MeetingAssistantPanel.jsx` so it becomes a stronger named teacher copilot surface with sections for:
- `Live Notes`
- `Concept Signals`
- `Teacher Moves`
- `Student Risk Flags`
- `Unanswered Doubts`
- `Follow-up Assets`

- [ ] **Step 4: Strengthen the dedicated meeting-room integration**

Update `frontend/components/VideoMeetingRoom.jsx` so:
- the meeting room frames the panel more explicitly as a teacher copilot
- the room can display the richer assistant payload cleanly
- the teacher sees a clearer AI-driven intervention surface instead of a subtle sidebar

- [ ] **Step 5: Upgrade the student recap surfacing**

Update `frontend/pages/classrooms/[id]/live.jsx` so ended meetings now show:
- `Study recap`
- `Unresolved questions`
- `Next class moves`

instead of only a light summary block.

- [ ] **Step 6: Run the frontend contract test**

Run:

```bash
cd frontend && node --test tests/meeting-assistant-contract.test.mjs
```

Expected:
- PASS

### Task 4: Run final verification for the slice

**Files:**
- No code changes expected

- [ ] **Step 1: Run backend verification**

Run:

```bash
python3 -m unittest backend.tests.test_ai_meeting_assistant -v
```

Expected:
- PASS

- [ ] **Step 2: Run frontend verification**

Run:

```bash
cd frontend && node --test tests/meeting-assistant-contract.test.mjs
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
