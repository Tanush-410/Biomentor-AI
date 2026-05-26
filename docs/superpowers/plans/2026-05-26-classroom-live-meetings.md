# Classroom Live Meetings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace external classroom meeting links with in-product WebRTC live sessions, while hardening classroom join flow, live access control, and proctored classroom quiz reliability.

**Architecture:** Add a new `ClassroomLiveMeeting` persistence model and REST/WebSocket meeting layer on the backend, then replace the `/classrooms/[id]/live` external-link UI with a native scheduler, meeting list, and browser WebRTC room. Keep media peer-to-peer with FastAPI WebSockets used only for signaling, and finish with classroom join/proctoring/security regression fixes.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, FastAPI WebSockets, Next.js 14, React 18, browser WebRTC, Supabase/Postgres with SQLite fallback, existing classroom/auth infrastructure

---

### Task 1: Add meeting model, schema, and DB bootstrap support

**Files:**
- Modify: `backend/app/database/models.py`
- Modify: `backend/app/database/__init__.py`
- Modify: `backend/app/schemas/__init__.py`
- Test: `backend/tests/test_classroom_live_meetings.py`

- [ ] **Step 1: Write the failing backend model/schema smoke test**

```python
import os
import sys
import unittest

CURRENT_DIR = os.path.dirname(__file__)
BACKEND_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.database.models import ClassroomLiveMeeting  # noqa: E402
from app.schemas import ClassroomMeetingCreate, ClassroomMeetingResponse  # noqa: E402


class ClassroomLiveMeetingModelTest(unittest.TestCase):
    def test_live_meeting_model_and_schemas_exist(self):
        self.assertIsNotNone(ClassroomLiveMeeting)
        self.assertIsNotNone(ClassroomMeetingCreate)
        self.assertIsNotNone(ClassroomMeetingResponse)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m unittest backend.tests.test_classroom_live_meetings -v`
Expected: FAIL with missing imports or missing model/schema classes

- [ ] **Step 3: Add the minimal model and schema types**

```python
class ClassroomLiveMeeting(Base):
    __tablename__ = "classroom_live_meetings"

    id = Column(String, primary_key=True, default=new_id)
    classroom_id = Column(String, ForeignKey("classrooms.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    scheduled_start = Column(DateTime, nullable=False, index=True)
    scheduled_end = Column(DateTime, nullable=False)
    created_by_teacher_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    meeting_token = Column(String, nullable=False, unique=True, index=True)
    status = Column(String, default="scheduled", nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

```python
class ClassroomMeetingCreate(BaseModel):
    title: str
    description: Optional[str] = None
    scheduled_start: datetime
    scheduled_end: datetime


class ClassroomMeetingResponse(BaseModel):
    id: str
    classroom_id: str
    title: str
    description: Optional[str] = None
    scheduled_start: datetime
    scheduled_end: datetime
    created_by_teacher_id: str
    status: str
    created_at: datetime
```

- [ ] **Step 4: Add incremental DB bootstrap support**

```python
meeting_columns = table_columns.get("classroom_live_meetings", set())
if not meeting_columns:
    # Base.metadata.create_all handles new table creation; no ALTER needed
    pass
```

- [ ] **Step 5: Run test to verify it passes**

Run: `python3 -m unittest backend.tests.test_classroom_live_meetings -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/database/models.py backend/app/database/__init__.py backend/app/schemas/__init__.py backend/tests/test_classroom_live_meetings.py
git commit -m "feat: add classroom live meeting model"
```

### Task 2: Add classroom meeting REST APIs and serializer support

**Files:**
- Modify: `backend/app/routers/classrooms.py`
- Modify: `backend/app/services/classroom_hub.py`
- Test: `backend/tests/test_classroom_live_meetings.py`

- [ ] **Step 1: Write the failing route existence and role test**

```python
from fastapi.testclient import TestClient
from app.main import app


class ClassroomLiveMeetingRouteTest(unittest.TestCase):
    def test_meeting_routes_exist(self):
        client = TestClient(app)
        create_response = client.post("/api/classrooms/example/meetings", json={})
        list_response = client.get("/api/classrooms/example/meetings")
        detail_response = client.get("/api/classrooms/example/meetings/example-meeting")
        start_response = client.post("/api/classrooms/example/meetings/example-meeting/start", json={})
        end_response = client.post("/api/classrooms/example/meetings/example-meeting/end", json={})
        self.assertNotEqual(create_response.status_code, 404)
        self.assertNotEqual(list_response.status_code, 404)
        self.assertNotEqual(detail_response.status_code, 404)
        self.assertNotEqual(start_response.status_code, 404)
        self.assertNotEqual(end_response.status_code, 404)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m unittest backend.tests.test_classroom_live_meetings.ClassroomLiveMeetingRouteTest -v`
Expected: FAIL with 404 responses

- [ ] **Step 3: Implement the serializer and endpoints**

```python
@router.post("/{classroom_id}/meetings")
async def create_classroom_meeting(...):
    classroom = get_accessible_classroom(db, classroom_id, current_user)
    meeting = ClassroomLiveMeeting(
        classroom_id=classroom.id,
        title=payload.title,
        description=payload.description,
        scheduled_start=payload.scheduled_start,
        scheduled_end=payload.scheduled_end,
        created_by_teacher_id=current_user.id,
        meeting_token=secrets.token_urlsafe(16),
        status="scheduled",
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return {"meeting": serialize_classroom_meeting(meeting)}
```

```python
@router.get("/{classroom_id}/meetings")
async def list_classroom_meetings(...):
    ...
```

```python
@router.get("/{classroom_id}/meetings/{meeting_id}")
async def get_classroom_meeting(...):
    ...
```

```python
@router.post("/{classroom_id}/meetings/{meeting_id}/start")
async def start_classroom_meeting(...):
    meeting.status = "live"
    db.commit()
    ...
```

```python
@router.post("/{classroom_id}/meetings/{meeting_id}/end")
async def end_classroom_meeting(...):
    meeting.status = "ended"
    db.commit()
    ...
```

- [ ] **Step 4: Integrate notifications/stream hooks**

```python
create_notifications(
    db,
    student_ids,
    classroom.id,
    "classroom_meeting_scheduled",
    meeting.title,
    meeting.description or "A class meeting has been scheduled.",
    f"/classrooms/{classroom.id}/live",
)
```

- [ ] **Step 5: Run test to verify routes now exist**

Run: `python3 -m unittest backend.tests.test_classroom_live_meetings.ClassroomLiveMeetingRouteTest -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/classrooms.py backend/app/services/classroom_hub.py backend/tests/test_classroom_live_meetings.py
git commit -m "feat: add classroom live meeting APIs"
```

### Task 3: Add signaling service and WebSocket meeting room

**Files:**
- Create: `backend/app/services/meeting_signaling.py`
- Modify: `backend/app/routers/classrooms.py`
- Test: `backend/tests/test_classroom_live_meetings.py`

- [ ] **Step 1: Write the failing signaling smoke test**

```python
from app.services.meeting_signaling import MeetingSignalingManager


class MeetingSignalingSmokeTest(unittest.TestCase):
    def test_signaling_manager_exists(self):
        self.assertIsNotNone(MeetingSignalingManager)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m unittest backend.tests.test_classroom_live_meetings.MeetingSignalingSmokeTest -v`
Expected: FAIL with import error

- [ ] **Step 3: Create the signaling manager**

```python
class MeetingSignalingManager:
    def __init__(self):
        self.rooms: dict[str, dict[str, WebSocket]] = {}

    async def connect(self, meeting_id: str, user_id: str, websocket: WebSocket):
        await websocket.accept()
        self.rooms.setdefault(meeting_id, {})[user_id] = websocket

    def disconnect(self, meeting_id: str, user_id: str):
        self.rooms.get(meeting_id, {}).pop(user_id, None)

    async def broadcast(self, meeting_id: str, payload: dict, exclude_user_id: str | None = None):
        ...

    async def send_to(self, meeting_id: str, user_id: str, payload: dict):
        ...
```

- [ ] **Step 4: Add the WebSocket endpoint**

```python
@router.websocket("/ws/meetings/{meeting_id}")
async def classroom_meeting_socket(websocket: WebSocket, meeting_id: str, token: str | None = Query(default=None)):
    ...
```

- [ ] **Step 5: Support event relay**

```python
if event_type == "offer":
    await signaling_manager.send_to(meeting_id, target_user_id, event_payload)
elif event_type == "answer":
    await signaling_manager.send_to(meeting_id, target_user_id, event_payload)
elif event_type == "ice_candidate":
    await signaling_manager.send_to(meeting_id, target_user_id, event_payload)
```

- [ ] **Step 6: Run test to verify it passes**

Run: `python3 -m unittest backend.tests.test_classroom_live_meetings.MeetingSignalingSmokeTest -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/meeting_signaling.py backend/app/routers/classrooms.py backend/tests/test_classroom_live_meetings.py
git commit -m "feat: add classroom meeting signaling"
```

### Task 4: Replace classroom live frontend with scheduler, meeting list, and native room

**Files:**
- Modify: `frontend/lib/classroomApi.js`
- Modify: `frontend/pages/classrooms/[id]/live.jsx`
- Create: `frontend/pages/classrooms/[id]/live/[meetingId].jsx`
- Create: `frontend/components/MeetingScheduler.jsx`
- Create: `frontend/components/MeetingList.jsx`
- Create: `frontend/components/VideoMeetingRoom.jsx`
- Create: `frontend/hooks/useWebRTCMeeting.js`
- Create: `frontend/lib/meetingSignalingClient.js`
- Test: `frontend/tests/classroom-live-contract.test.mjs`

- [ ] **Step 1: Write the failing live page contract test**

```javascript
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('classroom live page uses meeting scheduler and native meeting room', () => {
  const source = fs.readFileSync('frontend/pages/classrooms/[id]/live.jsx', 'utf8')
  assert.match(source, /MeetingScheduler/)
  assert.match(source, /MeetingList/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test frontend/tests/classroom-live-contract.test.mjs`
Expected: FAIL because current file still uses `ClassroomLivePanel`

- [ ] **Step 3: Add API client helpers**

```javascript
export function listClassroomMeetings(token, classroomId) {
  return classroomRequest(`/api/classrooms/${classroomId}/meetings`, token)
}

export function createClassroomMeeting(token, classroomId, payload) {
  return classroomRequest(`/api/classrooms/${classroomId}/meetings`, token, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}
```

- [ ] **Step 4: Build the scheduler and list components**

```javascript
export default function MeetingScheduler({ onSubmit, submitting }) {
  const [form, setForm] = useState({ title: '', description: '', scheduled_start: '', duration_minutes: 60 })
  ...
}
```

```javascript
export default function MeetingList({ meetings, role, classroomId }) {
  ...
}
```

- [ ] **Step 5: Build the meeting room hook and component**

```javascript
const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
}
```

```javascript
export default function VideoMeetingRoom({ classroomId, meetingId, token, role }) {
  ...
}
```

- [ ] **Step 6: Replace the current page**

```javascript
import MeetingScheduler from '../../../components/MeetingScheduler'
import MeetingList from '../../../components/MeetingList'
```

- [ ] **Step 7: Run test to verify it passes**

Run: `node --test frontend/tests/classroom-live-contract.test.mjs`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add frontend/lib/classroomApi.js frontend/pages/classrooms/[id]/live.jsx frontend/pages/classrooms/[id]/live/[meetingId].jsx frontend/components/MeetingScheduler.jsx frontend/components/MeetingList.jsx frontend/components/VideoMeetingRoom.jsx frontend/hooks/useWebRTCMeeting.js frontend/lib/meetingSignalingClient.js frontend/tests/classroom-live-contract.test.mjs
git commit -m "feat: add native classroom meeting UI"
```

### Task 5: Harden classroom join and meeting access security

**Files:**
- Modify: `backend/app/routers/classrooms.py`
- Modify: `backend/app/services/classroom_hub.py`
- Modify: `frontend/pages/classrooms/index.jsx`
- Test: `backend/tests/test_classroom_live_meetings.py`

- [ ] **Step 1: Write the failing membership/authorization regression tests**

```python
class ClassroomMeetingSecuritySmokeTest(unittest.TestCase):
    def test_classroom_join_and_meeting_security_routes_exist(self):
        client = TestClient(app)
        join_response = client.post("/api/classrooms/join", json={"invite_code": "ABC123"})
        self.assertNotEqual(join_response.status_code, 404)
```

- [ ] **Step 2: Run test to verify the current gap**

Run: `python3 -m unittest backend.tests.test_classroom_live_meetings.ClassroomMeetingSecuritySmokeTest -v`
Expected: fail or expose missing edge coverage

- [ ] **Step 3: Tighten backend checks**

```python
if current_user.role == "student" and classroom.educator_id == current_user.id:
    raise HTTPException(status_code=403, detail="Students cannot administer meetings.")
```

```python
enrollment = db.query(ClassroomEnrollment)...first()
if not enrollment or enrollment.status != "active":
    raise HTTPException(status_code=403, detail="You are not an active classroom member.")
```

- [ ] **Step 4: Tighten classroom join UX**

```javascript
if (!inviteCode.trim()) {
  setJoinError('Enter a valid classroom code.')
  return
}
```

- [ ] **Step 5: Run tests**

Run: `python3 -m unittest backend.tests.test_classroom_live_meetings -v`
Expected: PASS for new security smoke coverage

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/classrooms.py backend/app/services/classroom_hub.py frontend/pages/classrooms/index.jsx backend/tests/test_classroom_live_meetings.py
git commit -m "fix: harden classroom join and meeting access"
```

### Task 6: Verify proctored classroom quiz reliability against the new live flow

**Files:**
- Modify: `frontend/pages/classrooms/[id]/quiz/[quizId].jsx`
- Modify: `backend/app/routers/classrooms.py`
- Test: `frontend/tests/classroom-quiz-proctoring.test.mjs`
- Test: `backend/tests/test_classroom_live_meetings.py`

- [ ] **Step 1: Write the failing frontend proctoring contract test**

```javascript
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('classroom quiz still guards fullscreen and camera violations', () => {
  const source = fs.readFileSync('frontend/pages/classrooms/[id]/quiz/[quizId].jsx', 'utf8')
  assert.match(source, /handleViolation\\('tab_hidden'/)
  assert.match(source, /handleViolation\\('fullscreen_exit'/)
  assert.match(source, /Camera access is required/)
})
```

- [ ] **Step 2: Run test to verify existing guardrails**

Run: `node --test frontend/tests/classroom-quiz-proctoring.test.mjs`
Expected: PASS or reveal missing guard regression after meeting changes

- [ ] **Step 3: Add isolation guard between meeting and quiz flows**

```javascript
useEffect(() => () => {
  stopCamera()
}, [])
```

```python
if attempt.status != "in_progress":
    raise HTTPException(status_code=409, detail="This classroom quiz attempt is not active.")
```

- [ ] **Step 4: Run tests**

Run: `node --test frontend/tests/classroom-quiz-proctoring.test.mjs`
Expected: PASS

- [ ] **Step 5: Run backend and frontend regression suite**

Run: `python3 -m unittest backend.tests.test_classroom_live_meetings backend.tests.test_classroom_module backend.tests.test_classroom_quiz_authoring backend.tests.test_hybrid_retrieval backend.tests.test_sqlite_engine_config -v`
Expected: PASS

Run: `node --test frontend/tests/classroom-live-contract.test.mjs frontend/tests/classroom-quiz-proctoring.test.mjs frontend/tests/landing-page-content.test.mjs frontend/tests/quiz-session-contract.test.mjs`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/pages/classrooms/[id]/quiz/[quizId].jsx backend/app/routers/classrooms.py frontend/tests/classroom-quiz-proctoring.test.mjs backend/tests/test_classroom_live_meetings.py
git commit -m "fix: preserve proctored classroom quiz reliability"
```

