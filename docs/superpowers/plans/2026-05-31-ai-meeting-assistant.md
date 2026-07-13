# AI Meeting Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a teacher-only AI meeting copilot that captures transcript snippets and meeting events during live classroom sessions, generates live notes and follow-up suggestions for educators, and publishes a student-safe recap after meetings end.

**Architecture:** Extend the existing classroom live-meeting system instead of replacing it. Persist transcript snippets, structured meeting events, and generated AI summaries in the backend, expose teacher-only assistant APIs plus post-meeting recap APIs, and add a dedicated teacher assistant panel to the meeting room that streams transcript/event inputs and displays rolling notes, action items, doubts, and follow-up suggestions.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, existing Groq-backed text generation utilities, Next.js 14, React 18, classroom live meeting WebSocket/signaling stack, Node test runner, Python unittest.

---

## File Structure

### Backend
- Modify: `backend/app/database/models.py`
  - Add persistence models for meeting transcripts, meeting events, and AI summaries.
- Modify: `backend/app/database/__init__.py`
  - Extend lightweight schema bootstrap/migration logic so the new meeting-assistant tables exist in both PostgreSQL and SQLite fallback mode.
- Modify: `backend/app/schemas/__init__.py`
  - Add transcript/event request models, assistant response models, and recap payload models.
- Create: `backend/app/services/meeting_assistant.py`
  - Single responsibility: ingest transcript/event context, build rolling assistant state, call AI/fallback summarization, and produce teacher/student outputs.
- Modify: `backend/app/routers/classrooms.py`
  - Add transcript ingestion, event ingestion, teacher assistant state retrieval, recap retrieval, and end-meeting summary generation wiring.
- Test: `backend/tests/test_ai_meeting_assistant.py`
  - Cover transcript ingestion, teacher-only visibility, end-meeting recap generation, and fallback behavior.

### Frontend
- Create: `frontend/components/MeetingAssistantPanel.jsx`
  - Render teacher-only live notes, action items, doubts, and follow-up suggestions.
- Modify: `frontend/components/VideoMeetingRoom.jsx`
  - Capture browser transcript snippets when available, emit typed meeting events, and render the assistant panel for teachers.
- Modify: `frontend/lib/classroomApi.js`
  - Add transcript/event/assistant/recap API helpers.
- Create: `frontend/lib/meetingTranscriptClient.js`
  - Wrap browser speech-recognition lifecycle and transcript buffering for meeting rooms.
- Modify: `frontend/pages/classrooms/[id]/live/[meetingId]/room.jsx`
  - Feed role-aware props into the meeting room and surface assistant state/loaders.
- Modify: `frontend/pages/classrooms/[id]/live.jsx`
  - Show post-meeting recap cards to students and educators once meetings end.
- Test: `frontend/tests/meeting-assistant-contract.test.mjs`
  - Lock the assistant panel, transcript client wiring, and recap rendering contract.

### Docs
- Modify: `README.md`
  - Document AI Meeting Assistant behavior, transcript caveats, and new teacher/student live-session outputs.
- Modify: `backend/.env.example`
  - Add any assistant-related env placeholders if needed, while keeping defaults safe.

---

### Task 1: Persist meeting-assistant data models

**Files:**
- Modify: `backend/app/database/models.py`
- Modify: `backend/app/database/__init__.py`
- Test: `backend/tests/test_ai_meeting_assistant.py`

- [ ] **Step 1: Write the failing model/bootstrap test**

```python
import unittest

from backend.app.database import Base
from backend.app.database.models import (
    ClassroomMeetingAISummary,
    ClassroomMeetingEvent,
    ClassroomMeetingTranscript,
)


class MeetingAssistantModelTest(unittest.TestCase):
    def test_meeting_assistant_models_are_registered(self):
        table_names = set(Base.metadata.tables.keys())
        self.assertIn("classroom_meeting_transcripts", table_names)
        self.assertIn("classroom_meeting_events", table_names)
        self.assertIn("classroom_meeting_ai_summaries", table_names)

    def test_ai_summary_allows_teacher_and_student_summary_types(self):
        summary = ClassroomMeetingAISummary(summary_type="teacher_summary")
        self.assertEqual(summary.summary_type, "teacher_summary")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m unittest backend.tests.test_ai_meeting_assistant.MeetingAssistantModelTest -v`
Expected: FAIL with import or missing table/model assertion errors.

- [ ] **Step 3: Write minimal persistence models and schema bootstrap**

```python
class ClassroomMeetingTranscript(Base):
    __tablename__ = "classroom_meeting_transcripts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    meeting_id = Column(String, ForeignKey("classroom_live_meetings.id"), nullable=False, index=True)
    classroom_id = Column(String, ForeignKey("classrooms.id"), nullable=False, index=True)
    speaker_role = Column(String, nullable=False, default="participant")
    speaker_name = Column(String, nullable=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class ClassroomMeetingEvent(Base):
    __tablename__ = "classroom_meeting_events"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    meeting_id = Column(String, ForeignKey("classroom_live_meetings.id"), nullable=False, index=True)
    classroom_id = Column(String, ForeignKey("classrooms.id"), nullable=False, index=True)
    actor_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    event_type = Column(String, nullable=False, index=True)
    payload = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class ClassroomMeetingAISummary(Base):
    __tablename__ = "classroom_meeting_ai_summaries"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    meeting_id = Column(String, ForeignKey("classroom_live_meetings.id"), nullable=False, index=True)
    classroom_id = Column(String, ForeignKey("classrooms.id"), nullable=False, index=True)
    summary_type = Column(String, nullable=False, index=True)
    content_json = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
```

```python
def ensure_optional_tables(engine):
    for table in (
        ClassroomMeetingTranscript.__table__,
        ClassroomMeetingEvent.__table__,
        ClassroomMeetingAISummary.__table__,
    ):
        table.create(bind=engine, checkfirst=True)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m unittest backend.tests.test_ai_meeting_assistant.MeetingAssistantModelTest -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/database/models.py backend/app/database/__init__.py backend/tests/test_ai_meeting_assistant.py
git commit -m "feat: add meeting assistant persistence models"
```

### Task 2: Add backend schemas and assistant service

**Files:**
- Modify: `backend/app/schemas/__init__.py`
- Create: `backend/app/services/meeting_assistant.py`
- Test: `backend/tests/test_ai_meeting_assistant.py`

- [ ] **Step 1: Write the failing service/schema test**

```python
import unittest

from backend.app.services.meeting_assistant import build_teacher_assistant_snapshot


class MeetingAssistantServiceTest(unittest.TestCase):
    def test_snapshot_extracts_notes_actions_doubts_and_followups(self):
        snapshot = build_teacher_assistant_snapshot(
            transcript_items=[{"speaker_name": "Tan", "content": "Need to revise mitosis next class."}],
            meeting_events=[{"event_type": "doubt_flag", "payload": {"question": "What is metaphase?"}}],
            meeting_title="Cell Division Review",
        )

        self.assertIn("live_notes", snapshot)
        self.assertIn("action_items", snapshot)
        self.assertIn("unresolved_doubts", snapshot)
        self.assertIn("follow_up_suggestions", snapshot)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m unittest backend.tests.test_ai_meeting_assistant.MeetingAssistantServiceTest -v`
Expected: FAIL with missing service/function errors.

- [ ] **Step 3: Add minimal request/response schemas and assistant service**

```python
class MeetingTranscriptCreateRequest(BaseModel):
    speaker_role: str = "participant"
    speaker_name: str | None = None
    content: str


class MeetingEventCreateRequest(BaseModel):
    event_type: str
    payload: dict[str, Any] = Field(default_factory=dict)


class MeetingAssistantSection(BaseModel):
    items: list[str] = Field(default_factory=list)


class MeetingAssistantSnapshotResponse(BaseModel):
    meeting_id: str
    live_notes: MeetingAssistantSection
    action_items: MeetingAssistantSection
    unresolved_doubts: MeetingAssistantSection
    follow_up_suggestions: MeetingAssistantSection
    updated_at: datetime | None = None
```

```python
def build_teacher_assistant_snapshot(transcript_items, meeting_events, meeting_title):
    notes = [item["content"] for item in transcript_items[-5:] if item.get("content")]
    doubts = [
        event["payload"].get("question")
        for event in meeting_events
        if event.get("event_type") == "doubt_flag" and event.get("payload", {}).get("question")
    ]
    actions = [
        f"Revisit {meeting_title}" if meeting_title else "Review the session topic",
    ]
    followups = [
        "Prepare a short follow-up quiz",
        "Share one revision resource in classwork",
    ]
    return {
        "live_notes": {"items": notes},
        "action_items": {"items": actions},
        "unresolved_doubts": {"items": doubts},
        "follow_up_suggestions": {"items": followups},
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m unittest backend.tests.test_ai_meeting_assistant.MeetingAssistantServiceTest -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/__init__.py backend/app/services/meeting_assistant.py backend/tests/test_ai_meeting_assistant.py
git commit -m "feat: add meeting assistant schemas and service"
```

### Task 3: Add transcript/event ingestion and teacher assistant APIs

**Files:**
- Modify: `backend/app/routers/classrooms.py`
- Modify: `backend/app/services/meeting_assistant.py`
- Test: `backend/tests/test_ai_meeting_assistant.py`

- [ ] **Step 1: Write the failing API test**

```python
def test_teacher_can_post_transcript_and_fetch_assistant_snapshot(self):
    transcript_response = self.client.post(
        f"/api/classrooms/{self.classroom_id}/meetings/{self.meeting_id}/transcripts",
        json={"speaker_role": "teacher", "speaker_name": "Dr. Bio", "content": "Revise osmosis for tomorrow."},
        headers=self.teacher_headers,
    )
    self.assertEqual(transcript_response.status_code, 200)

    event_response = self.client.post(
        f"/api/classrooms/{self.classroom_id}/meetings/{self.meeting_id}/events",
        json={"event_type": "doubt_flag", "payload": {"question": "What is diffusion?"}},
        headers=self.teacher_headers,
    )
    self.assertEqual(event_response.status_code, 200)

    snapshot_response = self.client.get(
        f"/api/classrooms/{self.classroom_id}/meetings/{self.meeting_id}/assistant",
        headers=self.teacher_headers,
    )
    self.assertEqual(snapshot_response.status_code, 200)
    payload = snapshot_response.json()
    self.assertIn("Revise osmosis", " ".join(payload["live_notes"]["items"]))
    self.assertIn("diffusion", " ".join(payload["unresolved_doubts"]["items"]).lower())
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m unittest backend.tests.test_ai_meeting_assistant.MeetingAssistantApiTest.test_teacher_can_post_transcript_and_fetch_assistant_snapshot -v`
Expected: FAIL with 404 or missing route assertions.

- [ ] **Step 3: Add router endpoints and membership/teacher guards**

```python
@router.post("/api/classrooms/{classroom_id}/meetings/{meeting_id}/transcripts")
def create_meeting_transcript(...):
    meeting = require_classroom_meeting(...)
    require_classroom_membership(...)
    transcript = persist_meeting_transcript(...)
    refresh_meeting_assistant_snapshot(...)
    return {"status": "ok", "transcript_id": transcript.id}


@router.post("/api/classrooms/{classroom_id}/meetings/{meeting_id}/events")
def create_meeting_event(...):
    meeting = require_classroom_meeting(...)
    membership = require_classroom_membership(...)
    require_teacher_role(membership)
    event = persist_meeting_event(...)
    refresh_meeting_assistant_snapshot(...)
    return {"status": "ok", "event_id": event.id}


@router.get("/api/classrooms/{classroom_id}/meetings/{meeting_id}/assistant", response_model=MeetingAssistantSnapshotResponse)
def get_meeting_assistant_snapshot(...):
    meeting = require_classroom_meeting(...)
    membership = require_classroom_membership(...)
    require_teacher_role(membership)
    return load_or_build_meeting_assistant_snapshot(...)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m unittest backend.tests.test_ai_meeting_assistant.MeetingAssistantApiTest.test_teacher_can_post_transcript_and_fetch_assistant_snapshot -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/classrooms.py backend/app/services/meeting_assistant.py backend/tests/test_ai_meeting_assistant.py
git commit -m "feat: add meeting assistant ingestion and teacher APIs"
```

### Task 4: Generate end-of-meeting teacher and student summaries

**Files:**
- Modify: `backend/app/routers/classrooms.py`
- Modify: `backend/app/services/meeting_assistant.py`
- Test: `backend/tests/test_ai_meeting_assistant.py`

- [ ] **Step 1: Write the failing end-meeting summary test**

```python
def test_ending_meeting_persists_teacher_and_student_summaries(self):
    self.client.post(
        f"/api/classrooms/{self.classroom_id}/meetings/{self.meeting_id}/transcripts",
        json={"speaker_role": "teacher", "speaker_name": "Dr. Bio", "content": "Students must revise osmosis and bring notes."},
        headers=self.teacher_headers,
    )

    end_response = self.client.post(
        f"/api/classrooms/{self.classroom_id}/meetings/{self.meeting_id}/end",
        headers=self.teacher_headers,
    )
    self.assertEqual(end_response.status_code, 200)

    recap_response = self.client.get(
        f"/api/classrooms/{self.classroom_id}/meetings/{self.meeting_id}/recap",
        headers=self.student_headers,
    )
    self.assertEqual(recap_response.status_code, 200)
    payload = recap_response.json()
    self.assertIn("summary", payload)
    self.assertIn("action_items", payload)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m unittest backend.tests.test_ai_meeting_assistant.MeetingAssistantApiTest.test_ending_meeting_persists_teacher_and_student_summaries -v`
Expected: FAIL with missing recap route or missing summary assertions.

- [ ] **Step 3: Add end-meeting assistant generation and recap route**

```python
def finalize_meeting_assistant_outputs(session, meeting, classroom):
    transcript_items = list_recent_transcripts(session, meeting.id)
    meeting_events = list_recent_events(session, meeting.id)
    teacher_summary = build_teacher_summary_payload(transcript_items, meeting_events, meeting.title)
    student_summary = build_student_summary_payload(transcript_items, meeting_events, meeting.title)
    upsert_meeting_summary(session, meeting.id, classroom.id, "teacher_summary", teacher_summary)
    upsert_meeting_summary(session, meeting.id, classroom.id, "student_summary", student_summary)
    return teacher_summary, student_summary


@router.get("/api/classrooms/{classroom_id}/meetings/{meeting_id}/recap", response_model=MeetingRecapResponse)
def get_meeting_recap(...):
    meeting = require_classroom_meeting(...)
    require_classroom_membership(...)
    return load_student_safe_recap(...)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m unittest backend.tests.test_ai_meeting_assistant.MeetingAssistantApiTest.test_ending_meeting_persists_teacher_and_student_summaries -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/classrooms.py backend/app/services/meeting_assistant.py backend/tests/test_ai_meeting_assistant.py
git commit -m "feat: generate meeting recaps on meeting end"
```

### Task 5: Add browser transcript capture helper

**Files:**
- Create: `frontend/lib/meetingTranscriptClient.js`
- Test: `frontend/tests/meeting-assistant-contract.test.mjs`

- [ ] **Step 1: Write the failing transcript-client contract test**

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { createMeetingTranscriptClient } from "../lib/meetingTranscriptClient.js";

test("createMeetingTranscriptClient exposes start stop and support flags", () => {
  const client = createMeetingTranscriptClient({ onSnippet() {} });
  assert.equal(typeof client.start, "function");
  assert.equal(typeof client.stop, "function");
  assert.equal(typeof client.isSupported, "boolean");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test frontend/tests/meeting-assistant-contract.test.mjs`
Expected: FAIL with module not found.

- [ ] **Step 3: Add the minimal transcript client**

```javascript
export function createMeetingTranscriptClient({ onSnippet }) {
  const SpeechRecognition =
    typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

  let recognition = null;

  function start() {
    if (!SpeechRecognition) return;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      const transcript = last?.[0]?.transcript?.trim();
      if (transcript) onSnippet(transcript);
    };
    recognition.start();
  }

  function stop() {
    recognition?.stop?.();
    recognition = null;
  }

  return {
    isSupported: Boolean(SpeechRecognition),
    start,
    stop,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test frontend/tests/meeting-assistant-contract.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/meetingTranscriptClient.js frontend/tests/meeting-assistant-contract.test.mjs
git commit -m "feat: add meeting transcript client"
```

### Task 6: Add teacher assistant panel component

**Files:**
- Create: `frontend/components/MeetingAssistantPanel.jsx`
- Test: `frontend/tests/meeting-assistant-contract.test.mjs`

- [ ] **Step 1: Write the failing component contract test**

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("MeetingAssistantPanel renders the expected sections", () => {
  const source = fs.readFileSync("frontend/components/MeetingAssistantPanel.jsx", "utf8");
  assert.match(source, /Live Notes/);
  assert.match(source, /Action Items/);
  assert.match(source, /Unanswered Doubts/);
  assert.match(source, /Suggested Follow-up/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test frontend/tests/meeting-assistant-contract.test.mjs`
Expected: FAIL because the component file does not exist yet.

- [ ] **Step 3: Add the minimal panel component**

```jsx
export default function MeetingAssistantPanel({ snapshot, isLoading }) {
  const sections = [
    ["Live Notes", snapshot?.live_notes?.items ?? []],
    ["Action Items", snapshot?.action_items?.items ?? []],
    ["Unanswered Doubts", snapshot?.unresolved_doubts?.items ?? []],
    ["Suggested Follow-up", snapshot?.follow_up_suggestions?.items ?? []],
  ];

  return (
    <aside className="rounded-[28px] border border-[rgba(135,94,60,0.18)] bg-white/90 p-5 shadow-[0_18px_50px_rgba(90,60,35,0.08)]">
      <p className="eyebrow mb-3">AI Meeting Assistant</p>
      {isLoading ? <p className="text-sm text-slate-500">Refreshing meeting notes...</p> : null}
      <div className="space-y-4">
        {sections.map(([title, items]) => (
          <section key={title} className="rounded-2xl border border-[rgba(135,94,60,0.12)] bg-[#fffaf4] p-4">
            <h3 className="text-sm font-semibold text-[#4a2f1e]">{title}</h3>
            <ul className="mt-2 space-y-2 text-sm text-slate-700">
              {items.length ? items.map((item) => <li key={item}>{item}</li>) : <li>No updates yet.</li>}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test frontend/tests/meeting-assistant-contract.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/components/MeetingAssistantPanel.jsx frontend/tests/meeting-assistant-contract.test.mjs
git commit -m "feat: add meeting assistant panel"
```

### Task 7: Wire transcript/events and assistant panel into the meeting room

**Files:**
- Modify: `frontend/components/VideoMeetingRoom.jsx`
- Modify: `frontend/pages/classrooms/[id]/live/[meetingId]/room.jsx`
- Modify: `frontend/lib/classroomApi.js`
- Modify: `frontend/lib/meetingSignalingClient.js`
- Test: `frontend/tests/meeting-assistant-contract.test.mjs`

- [ ] **Step 1: Write the failing room integration contract test**

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("VideoMeetingRoom references transcript client and MeetingAssistantPanel", () => {
  const source = fs.readFileSync("frontend/components/VideoMeetingRoom.jsx", "utf8");
  assert.match(source, /createMeetingTranscriptClient/);
  assert.match(source, /MeetingAssistantPanel/);
  assert.match(source, /postMeetingTranscript/);
  assert.match(source, /getMeetingAssistantSnapshot/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test frontend/tests/meeting-assistant-contract.test.mjs`
Expected: FAIL because the meeting room is not wired yet.

- [ ] **Step 3: Add API helpers and room integration**

```javascript
export async function postMeetingTranscript(classroomId, meetingId, payload, token) {
  return apiRequest(`/api/classrooms/${classroomId}/meetings/${meetingId}/transcripts`, {
    method: "POST",
    body: JSON.stringify(payload),
    token,
  });
}

export async function postMeetingEvent(classroomId, meetingId, payload, token) {
  return apiRequest(`/api/classrooms/${classroomId}/meetings/${meetingId}/events`, {
    method: "POST",
    body: JSON.stringify(payload),
    token,
  });
}

export async function getMeetingAssistantSnapshot(classroomId, meetingId, token) {
  return apiRequest(`/api/classrooms/${classroomId}/meetings/${meetingId}/assistant`, { token });
}
```

```jsx
const transcriptClientRef = useRef(null);

useEffect(() => {
  if (!isTeacher) return undefined;
  transcriptClientRef.current = createMeetingTranscriptClient({
    onSnippet: async (content) => {
      await postMeetingTranscript(classroomId, meetingId, {
        speaker_role: "teacher",
        speaker_name: currentUser?.name ?? "Teacher",
        content,
      }, token);
      await refreshAssistantSnapshot();
    },
  });
  transcriptClientRef.current.start();
  return () => transcriptClientRef.current?.stop();
}, [classroomId, meetingId, isTeacher, token, refreshAssistantSnapshot, currentUser]);
```

```jsx
{isTeacher ? (
  <MeetingAssistantPanel snapshot={assistantSnapshot} isLoading={assistantLoading} />
) : null}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test frontend/tests/meeting-assistant-contract.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/components/VideoMeetingRoom.jsx frontend/pages/classrooms/[id]/live/[meetingId]/room.jsx frontend/lib/classroomApi.js frontend/lib/meetingSignalingClient.js frontend/tests/meeting-assistant-contract.test.mjs
git commit -m "feat: wire ai meeting assistant into room UI"
```

### Task 8: Show post-meeting recap on the classroom live page

**Files:**
- Modify: `frontend/pages/classrooms/[id]/live.jsx`
- Modify: `frontend/lib/classroomApi.js`
- Test: `frontend/tests/meeting-assistant-contract.test.mjs`

- [ ] **Step 1: Write the failing recap contract test**

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("classroom live page renders post-meeting recap content", () => {
  const source = fs.readFileSync("frontend/pages/classrooms/[id]/live.jsx", "utf8");
  assert.match(source, /Meeting recap/);
  assert.match(source, /getMeetingRecap/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test frontend/tests/meeting-assistant-contract.test.mjs`
Expected: FAIL because recap rendering is missing.

- [ ] **Step 3: Add recap helper and live-page recap card**

```javascript
export async function getMeetingRecap(classroomId, meetingId, token) {
  return apiRequest(`/api/classrooms/${classroomId}/meetings/${meetingId}/recap`, { token });
}
```

```jsx
{endedMeetings.map((meeting) => (
  <section key={meeting.id} className="rounded-[28px] border border-[rgba(135,94,60,0.18)] bg-white/90 p-6">
    <p className="eyebrow mb-3">Meeting recap</p>
    <h3 className="text-2xl font-semibold text-[#2f241e]">{meeting.title}</h3>
    <p className="mt-3 text-sm text-slate-600">{meeting.recap?.summary ?? "Summary will appear after the meeting wrap-up."}</p>
    <ul className="mt-4 space-y-2 text-sm text-slate-700">
      {(meeting.recap?.action_items ?? []).map((item) => <li key={item}>{item}</li>)}
    </ul>
  </section>
))}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test frontend/tests/meeting-assistant-contract.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/pages/classrooms/[id]/live.jsx frontend/lib/classroomApi.js frontend/tests/meeting-assistant-contract.test.mjs
git commit -m "feat: show post-meeting recap in classroom live page"
```

### Task 9: Update docs and run final verification

**Files:**
- Modify: `README.md`
- Modify: `backend/.env.example`

- [ ] **Step 1: Update docs with the new assistant behavior**

```md
## AI Meeting Assistant

- Teachers get a private live assistant panel inside classroom meetings
- Transcript snippets and typed meeting events feed rolling notes
- When a meeting ends, VYDRA CORE saves:
  - summary
  - action items
  - unresolved doubts
  - suggested follow-up quiz/material ideas
- Students see the cleaned recap after the meeting instead of the live teacher panel
```

```env
# Optional future override for transcript-assisted summaries
MEETING_ASSISTANT_MODEL=
```

- [ ] **Step 2: Run backend tests**

Run: `python3 -m unittest backend.tests.test_ai_meeting_assistant backend.tests.test_classroom_live_meetings backend.tests.test_classroom_module -v`
Expected: PASS

- [ ] **Step 3: Run frontend contract tests**

Run: `node --test frontend/tests/meeting-assistant-contract.test.mjs frontend/tests/classroom-live-contract.test.mjs frontend/tests/learning-chat-agentic-contract.test.mjs`
Expected: PASS

- [ ] **Step 4: Run production build**

Run: `cd frontend && npm run build`
Expected: PASS with only the known non-blocking warnings about missing `eslint` and offline Google Fonts optimization.

- [ ] **Step 5: Commit**

```bash
git add README.md backend/.env.example
git commit -m "docs: document ai meeting assistant"
```
