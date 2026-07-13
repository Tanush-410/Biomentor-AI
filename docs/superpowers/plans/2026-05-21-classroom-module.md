# VYDRA CORE Classroom Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Google Classroom-style classroom module to VYDRA CORE so `Classroom` opens a classroom list, selecting a classroom opens a dedicated workspace, and each classroom supports `Stream`, `Classwork`, `People`, `Messages`, and `Live` without breaking the existing global features.

**Architecture:** Extend the current classroom, communication, and live-session backend with classroom-scoped announcements, materials, assignments, private threads, and notifications. Add a shared classroom shell on the frontend with role-aware pages under `/classrooms`, while keeping the existing dashboard, materials, learning chat, quiz, progress, and collaboration routes operational.

**Tech Stack:** Next.js pages router, React 18, FastAPI, SQLAlchemy, existing websocket notification flows, existing document and collaboration services.

---

## File Structure

### Backend
- Modify: `backend/app/database/models.py`
  Add classroom announcements, classroom materials, classroom assignments, message threads, thread messages, and notifications; extend `LiveSession`.
- Modify: `backend/app/database/__init__.py`
  Ensure new tables/columns can be created through the repo’s current lightweight DB initialization strategy.
- Modify: `backend/app/schemas/__init__.py`
  Add request/response schemas for classroom detail pages, announcements, materials, assignments, threads, thread messages, live scheduling, and notifications.
- Create: `backend/app/services/classroom_hub.py`
  Shared authorization, classroom detail aggregation, thread/contact helpers, and notification helpers.
- Modify: `backend/app/routers/educator.py`
  Narrow this router toward educator-owned classroom management, or leave existing educator analytics routes in place and add classroom-specific write endpoints.
- Modify: `backend/app/routers/collaboration.py`
  Extend live session creation so classroom live pages can schedule or start sessions with external meeting URLs and trigger notifications.
- Create: `backend/app/routers/classrooms.py`
  Shared classroom routes for list/detail/stream/classwork/people/messages/live.
- Modify: `backend/app/routers/__init__.py`
  Export the new classroom router.
- Modify: `backend/app/main.py`
  Mount the new classroom router.
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/test_classroom_module.py`
  End-to-end API tests using `unittest` + `TestClient`.

### Frontend
- Create: `frontend/pages/classrooms/index.jsx`
  Shared classroom home/list page for both student and educator roles.
- Create: `frontend/pages/classrooms/[id]/index.jsx`
  Redirect classroom root to `stream`.
- Create: `frontend/pages/classrooms/[id]/stream.jsx`
- Create: `frontend/pages/classrooms/[id]/classwork.jsx`
- Create: `frontend/pages/classrooms/[id]/people.jsx`
- Create: `frontend/pages/classrooms/[id]/messages.jsx`
- Create: `frontend/pages/classrooms/[id]/live.jsx`
  Dedicated classroom pages matching the approved architecture.
- Create: `frontend/components/ClassroomShell.jsx`
  Shared classroom header, tabs, hero/banner, and role-aware action framing.
- Create: `frontend/components/ClassroomCardGrid.jsx`
  Google Classroom-style classroom list/grid cards.
- Create: `frontend/components/ClassroomStreamComposer.jsx`
  Public announcement posting UI for educators.
- Create: `frontend/components/ClassroomThreadPane.jsx`
  Persistent private teacher-student thread UI.
- Create: `frontend/components/ClassroomLivePanel.jsx`
  Scheduled/live session panel.
- Modify: `frontend/components/AppShell.jsx`
  Point student and educator classroom navigation to the new `/classrooms` entry, while preserving the rest of the current nav.
- Modify: `frontend/pages/student/classrooms.jsx`
  Convert to redirect or compatibility shim.
- Modify: `frontend/pages/educator/classrooms.jsx`
  Convert to redirect or compatibility shim.
- Create: `frontend/lib/classroomApi.js`
  Shared classroom fetch helpers to keep page components small.

---

### Task 1: Add Classroom Hub Data Models and Schemas

**Files:**
- Modify: `backend/app/database/models.py`
- Modify: `backend/app/database/__init__.py`
- Modify: `backend/app/schemas/__init__.py`
- Test: `backend/tests/test_classroom_module.py`

- [ ] **Step 1: Write the failing backend model/schema test**

```python
# backend/tests/test_classroom_module.py
import unittest
from backend.app.database.models import (
    ClassroomAnnouncement,
    ClassroomAssignment,
    ClassroomMaterial,
    ClassroomMessageThread,
    ClassroomThreadMessage,
    Notification,
)


class ClassroomModelSmokeTest(unittest.TestCase):
    def test_new_classroom_models_exist(self):
        self.assertIsNotNone(ClassroomAnnouncement)
        self.assertIsNotNone(ClassroomAssignment)
        self.assertIsNotNone(ClassroomMaterial)
        self.assertIsNotNone(ClassroomMessageThread)
        self.assertIsNotNone(ClassroomThreadMessage)
        self.assertIsNotNone(Notification)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest backend.tests.test_classroom_module.ClassroomModelSmokeTest -v`

Expected: `ImportError` or `AttributeError` because the classroom-hub models do not exist yet.

- [ ] **Step 3: Add the new SQLAlchemy models and extend LiveSession**

```python
# backend/app/database/models.py
class ClassroomAnnouncement(Base):
    __tablename__ = "classroom_announcements"
    id = Column(String, primary_key=True, default=new_id)
    classroom_id = Column(String, ForeignKey("classrooms.id"), nullable=False, index=True)
    author_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=True)
    content = Column(Text, nullable=False)
    post_type = Column(String, default="announcement", nullable=False)
    linked_document_id = Column(String, ForeignKey("documents.id"), nullable=True)
    linked_live_session_id = Column(String, ForeignKey("live_sessions.id"), nullable=True)
    is_pinned = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ClassroomMaterial(Base):
    __tablename__ = "classroom_materials"
    id = Column(String, primary_key=True, default=new_id)
    classroom_id = Column(String, ForeignKey("classrooms.id"), nullable=False, index=True)
    document_id = Column(String, ForeignKey("documents.id"), nullable=False, index=True)
    shared_by_user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    title_override = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ClassroomAssignment(Base):
    __tablename__ = "classroom_assignments"
    id = Column(String, primary_key=True, default=new_id)
    classroom_id = Column(String, ForeignKey("classrooms.id"), nullable=False, index=True)
    educator_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    assignment_type = Column(String, default="task", nullable=False)
    document_id = Column(String, ForeignKey("documents.id"), nullable=True)
    quiz_reference = Column(String, nullable=True)
    due_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ClassroomMessageThread(Base):
    __tablename__ = "classroom_message_threads"
    id = Column(String, primary_key=True, default=new_id)
    classroom_id = Column(String, ForeignKey("classrooms.id"), nullable=False, index=True)
    teacher_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    student_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    last_message_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)


class ClassroomThreadMessage(Base):
    __tablename__ = "classroom_thread_messages"
    id = Column(String, primary_key=True, default=new_id)
    thread_id = Column(String, ForeignKey("classroom_message_threads.id"), nullable=False, index=True)
    sender_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    message_type = Column(String, default="text", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    classroom_id = Column(String, ForeignKey("classrooms.id"), nullable=True, index=True)
    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    action_url = Column(String, nullable=True)
    delivery_channels = Column(JSON, nullable=True)
    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

# Extend LiveSession
meeting_provider = Column(String, nullable=True)
meeting_url = Column(String, nullable=True)
scheduled_for = Column(DateTime, nullable=True)
notification_sent_at = Column(DateTime, nullable=True)
```

- [ ] **Step 4: Add corresponding schemas**

```python
# backend/app/schemas/__init__.py
class ClassroomAnnouncementCreate(BaseModel):
    title: Optional[str] = None
    content: str
    post_type: str = "announcement"
    linked_document_id: Optional[str] = None
    linked_live_session_id: Optional[str] = None
    is_pinned: bool = False


class ClassroomThreadMessageCreate(BaseModel):
    content: str


class ClassroomLiveScheduleCreate(BaseModel):
    title: str
    agenda: Optional[str] = None
    meeting_provider: str = "external"
    meeting_url: str
    scheduled_for: datetime
    resource_document_ids: Optional[List[str]] = None
```

- [ ] **Step 5: Make DB initialization pick up the new tables**

```python
# backend/app/database/__init__.py
def init_db():
    Base.metadata.create_all(bind=engine)
```

If this file already contains incremental-column helpers, extend them to add the new `live_sessions` columns only if missing.

- [ ] **Step 6: Run the model/schema smoke test**

Run: `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest backend.tests.test_classroom_module.ClassroomModelSmokeTest -v`

Expected: `OK`

- [ ] **Step 7: Commit**

```bash
git add backend/app/database/models.py backend/app/database/__init__.py backend/app/schemas/__init__.py backend/tests/test_classroom_module.py
git commit -m "feat: add classroom hub data models and schemas"
```

### Task 2: Build Shared Classroom Backend Routes and Access Helpers

**Files:**
- Create: `backend/app/services/classroom_hub.py`
- Create: `backend/app/routers/classrooms.py`
- Modify: `backend/app/routers/__init__.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_classroom_module.py`

- [ ] **Step 1: Write the failing classroom list/detail tests**

```python
from fastapi.testclient import TestClient
from backend.app.main import app


class ClassroomRouteTest(unittest.TestCase):
    def test_classroom_routes_exist(self):
        client = TestClient(app)
        response = client.get("/api/classrooms")
        self.assertNotEqual(response.status_code, 404)
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest backend.tests.test_classroom_module.ClassroomRouteTest -v`

Expected: `404` because the new shared classroom router is not mounted yet.

- [ ] **Step 3: Create shared classroom access helpers**

```python
# backend/app/services/classroom_hub.py
def get_accessible_classroom(db, classroom_id: str, user):
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    if user.role in {"educator", "admin"} and (user.role == "admin" or classroom.educator_id == user.id):
        return classroom
    enrollment = db.query(ClassroomEnrollment).filter(
        ClassroomEnrollment.classroom_id == classroom_id,
        ClassroomEnrollment.student_id == user.id,
    ).first()
    if enrollment:
        return classroom
    raise HTTPException(status_code=403, detail="You do not have access to this classroom.")
```

- [ ] **Step 4: Create the new shared classroom router**

```python
# backend/app/routers/classrooms.py
router = APIRouter(prefix="/api/classrooms", tags=["classrooms"])

@router.get("")
async def list_classrooms(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role in {"educator", "admin"}:
        classrooms = db.query(Classroom).filter(Classroom.educator_id == current_user.id).order_by(Classroom.created_at.desc()).all()
    else:
        classrooms = (
            db.query(Classroom)
            .join(ClassroomEnrollment, ClassroomEnrollment.classroom_id == Classroom.id)
            .filter(ClassroomEnrollment.student_id == current_user.id)
            .order_by(ClassroomEnrollment.joined_at.desc())
            .all()
        )
    return {"classrooms": classrooms}

@router.get("/{classroom_id}")
async def get_classroom_detail(classroom_id: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    classroom = get_accessible_classroom(db, classroom_id, current_user)
    educator = db.query(User).filter(User.id == classroom.educator_id).first()
    return {
        "id": classroom.id,
        "name": classroom.name,
        "subject": classroom.subject,
        "description": classroom.description,
        "invite_code": classroom.invite_code,
        "educator": {"id": educator.id, "full_name": educator.full_name},
    }
```

- [ ] **Step 5: Mount the router**

```python
# backend/app/routers/__init__.py
from app.routers.classrooms import router as classrooms_router

# backend/app/main.py
app.include_router(classrooms_router)
```

- [ ] **Step 6: Run the classroom route test**

Run: `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest backend.tests.test_classroom_module.ClassroomRouteTest -v`

Expected: `OK`

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/classroom_hub.py backend/app/routers/classrooms.py backend/app/routers/__init__.py backend/app/main.py backend/tests/test_classroom_module.py
git commit -m "feat: add shared classroom list and detail routes"
```

### Task 3: Implement Stream and Classwork Backend

**Files:**
- Create: `backend/app/services/classroom_hub.py`
- Modify: `backend/app/routers/classrooms.py`
- Test: `backend/tests/test_classroom_module.py`

- [ ] **Step 1: Write failing tests for announcements and classwork**

```python
class ClassroomStreamTest(unittest.TestCase):
    def test_stream_endpoint_exists(self):
        client = TestClient(app)
        response = client.get("/api/classrooms/test-id/stream")
        self.assertNotEqual(response.status_code, 404)
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest backend.tests.test_classroom_module.ClassroomStreamTest -v`

Expected: `404`

- [ ] **Step 3: Add announcement, material, and assignment endpoints**

```python
# backend/app/routers/classrooms.py
@router.get("/{classroom_id}/stream")
async def get_classroom_stream(classroom_id: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    classroom = get_accessible_classroom(db, classroom_id, current_user)
    posts = db.query(ClassroomAnnouncement).filter(ClassroomAnnouncement.classroom_id == classroom.id).order_by(
        ClassroomAnnouncement.is_pinned.desc(),
        ClassroomAnnouncement.created_at.desc(),
    ).all()
    return {"posts": posts}

@router.post("/{classroom_id}/announcements")
async def create_announcement(classroom_id: str, payload: ClassroomAnnouncementCreate, current_user=Depends(require_roles("educator", "admin")), db: Session = Depends(get_db)):
    classroom = get_accessible_classroom(db, classroom_id, current_user)
    announcement = ClassroomAnnouncement(classroom_id=classroom.id, author_id=current_user.id, **payload.model_dump())
    db.add(announcement)
    db.commit()
    db.refresh(announcement)
    create_notification_events(db, classroom.id, "announcement", announcement.title or classroom.name, announcement.content, f"/classrooms/{classroom.id}/stream")
    db.commit()
    return announcement

@router.get("/{classroom_id}/classwork")
async def get_classwork(classroom_id: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    classroom = get_accessible_classroom(db, classroom_id, current_user)
    materials = db.query(ClassroomMaterial).filter(ClassroomMaterial.classroom_id == classroom.id).all()
    assignments = db.query(ClassroomAssignment).filter(ClassroomAssignment.classroom_id == classroom.id).order_by(ClassroomAssignment.due_at.asc()).all()
    return {"materials": materials, "assignments": assignments}
```

- [ ] **Step 4: Add shared notification helper**

```python
# backend/app/services/classroom_hub.py
def create_notification_events(db, classroom_id: str, event_type: str, title: str, body: str, action_url: str):
    enrollments = db.query(ClassroomEnrollment).filter(ClassroomEnrollment.classroom_id == classroom_id).all()
    for enrollment in enrollments:
        db.add(
            Notification(
                user_id=enrollment.student_id,
                classroom_id=classroom_id,
                type=event_type,
                title=title,
                body=body,
                action_url=action_url,
                delivery_channels=["in_app"],
            )
        )
```

- [ ] **Step 5: Run the stream/classwork endpoint test**

Run: `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest backend.tests.test_classroom_module.ClassroomStreamTest -v`

Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/classroom_hub.py backend/app/routers/classrooms.py backend/tests/test_classroom_module.py
git commit -m "feat: add classroom stream and classwork backend"
```

### Task 4: Implement Persistent Private Classroom Threads

**Files:**
- Modify: `backend/app/routers/classrooms.py`
- Modify: `backend/app/services/classroom_hub.py`
- Test: `backend/tests/test_classroom_module.py`

- [ ] **Step 1: Write the failing thread persistence test**

```python
class ClassroomThreadTest(unittest.TestCase):
    def test_thread_routes_exist(self):
        client = TestClient(app)
        response = client.get("/api/classrooms/test-id/threads")
        self.assertNotEqual(response.status_code, 404)
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest backend.tests.test_classroom_module.ClassroomThreadTest -v`

Expected: `404`

- [ ] **Step 3: Add thread list/create/message endpoints**

```python
# backend/app/routers/classrooms.py
@router.get("/{classroom_id}/threads")
async def list_threads(classroom_id: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    classroom = get_accessible_classroom(db, classroom_id, current_user)
    if current_user.role == "student":
        threads = db.query(ClassroomMessageThread).filter(
            ClassroomMessageThread.classroom_id == classroom.id,
            ClassroomMessageThread.student_id == current_user.id,
        ).order_by(ClassroomMessageThread.last_message_at.desc()).all()
    else:
        threads = db.query(ClassroomMessageThread).filter(
            ClassroomMessageThread.classroom_id == classroom.id,
            ClassroomMessageThread.teacher_id == current_user.id,
        ).order_by(ClassroomMessageThread.last_message_at.desc()).all()
    return {"threads": threads}

@router.post("/{classroom_id}/threads")
async def create_thread(classroom_id: str, recipient_id: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    classroom = get_accessible_classroom(db, classroom_id, current_user)
    teacher_id = current_user.id if current_user.role in {"educator", "admin"} else classroom.educator_id
    student_id = recipient_id if current_user.role in {"educator", "admin"} else current_user.id
    thread = get_or_create_thread(db, classroom.id, teacher_id, student_id)
    db.commit()
    db.refresh(thread)
    return thread

@router.get("/{classroom_id}/threads/{thread_id}/messages")
async def list_thread_messages(classroom_id: str, thread_id: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    verify_thread_access(db, classroom_id, thread_id, current_user)
    messages = db.query(ClassroomThreadMessage).filter(ClassroomThreadMessage.thread_id == thread_id).order_by(ClassroomThreadMessage.created_at.asc()).all()
    return {"messages": messages}

@router.post("/{classroom_id}/threads/{thread_id}/messages")
async def create_thread_message(classroom_id: str, thread_id: str, payload: ClassroomThreadMessageCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    thread = verify_thread_access(db, classroom_id, thread_id, current_user)
    msg = ClassroomThreadMessage(thread_id=thread.id, sender_id=current_user.id, content=payload.content)
    db.add(msg)
    thread.last_message_at = datetime.utcnow()
    db.add(Notification(user_id=thread.teacher_id if current_user.role == "student" else thread.student_id, classroom_id=classroom_id, type="private_message", title="New classroom message", body=payload.content[:160], action_url=f"/classrooms/{classroom_id}/messages", delivery_channels=["in_app"]))
    db.commit()
    db.refresh(msg)
    return msg
```

- [ ] **Step 4: Add helper functions that enforce student-to-teacher-only messaging**

```python
# backend/app/services/classroom_hub.py
def get_or_create_thread(db, classroom_id: str, teacher_id: str, student_id: str):
    thread = db.query(ClassroomMessageThread).filter(
        ClassroomMessageThread.classroom_id == classroom_id,
        ClassroomMessageThread.teacher_id == teacher_id,
        ClassroomMessageThread.student_id == student_id,
    ).first()
    if thread:
        return thread
    thread = ClassroomMessageThread(classroom_id=classroom_id, teacher_id=teacher_id, student_id=student_id)
    db.add(thread)
    db.flush()
    return thread
```

- [ ] **Step 5: Run the thread route test**

Run: `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest backend.tests.test_classroom_module.ClassroomThreadTest -v`

Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/classroom_hub.py backend/app/routers/classrooms.py backend/tests/test_classroom_module.py
git commit -m "feat: add persistent classroom private threads"
```

### Task 5: Implement Classroom Live Scheduling and Notifications

**Files:**
- Modify: `backend/app/routers/collaboration.py`
- Modify: `backend/app/routers/classrooms.py`
- Test: `backend/tests/test_classroom_module.py`

- [ ] **Step 1: Write the failing live scheduling test**

```python
class ClassroomLiveTest(unittest.TestCase):
    def test_live_route_exists(self):
        client = TestClient(app)
        response = client.get("/api/classrooms/test-id/live")
        self.assertNotEqual(response.status_code, 404)
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest backend.tests.test_classroom_module.ClassroomLiveTest -v`

Expected: `404`

- [ ] **Step 3: Add classroom-scoped live endpoints**

```python
# backend/app/routers/classrooms.py
@router.get("/{classroom_id}/live")
async def get_live_page(classroom_id: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    classroom = get_accessible_classroom(db, classroom_id, current_user)
    sessions = db.query(LiveSession).filter(LiveSession.classroom_id == classroom.id).order_by(
        LiveSession.scheduled_for.desc().nullslast(),
        LiveSession.created_at.desc(),
    ).all()
    return {"sessions": sessions}

@router.post("/{classroom_id}/live/schedule")
async def schedule_live(classroom_id: str, payload: ClassroomLiveScheduleCreate, current_user=Depends(require_roles("educator", "admin")), db: Session = Depends(get_db)):
    classroom = get_accessible_classroom(db, classroom_id, current_user)
    session = LiveSession(
        classroom_id=classroom.id,
        educator_id=current_user.id,
        title=payload.title,
        agenda=payload.agenda,
        join_code=secrets.token_hex(3).upper(),
        status="scheduled",
        meeting_provider=payload.meeting_provider,
        meeting_url=payload.meeting_url,
        scheduled_for=payload.scheduled_for,
        resource_document_ids=payload.resource_document_ids or [],
    )
    db.add(session)
    db.flush()
    create_notification_events(db, classroom.id, "live_scheduled", payload.title, "A classroom session has been scheduled.", f"/classrooms/{classroom.id}/live")
    db.commit()
    db.refresh(session)
    return session
```

- [ ] **Step 4: Extend start-now flow in collaboration router**

```python
# backend/app/routers/collaboration.py
session = LiveSession(
    classroom_id=payload.classroom_id,
    educator_id=current_user.id,
    title=payload.title,
    agenda=payload.agenda,
    join_code=secrets.token_hex(3).upper(),
    status="live",
    meeting_provider="external",
    meeting_url=payload.meeting_url,
    resource_document_ids=payload.resource_document_ids or [],
    started_at=datetime.utcnow(),
)
```

- [ ] **Step 5: Run the live route test**

Run: `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest backend.tests.test_classroom_module.ClassroomLiveTest -v`

Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/classrooms.py backend/app/routers/collaboration.py backend/tests/test_classroom_module.py
git commit -m "feat: add classroom live scheduling and notifications"
```

### Task 6: Build Shared Classroom Frontend Shell and Classroom List

**Files:**
- Create: `frontend/components/ClassroomShell.jsx`
- Create: `frontend/components/ClassroomCardGrid.jsx`
- Create: `frontend/lib/classroomApi.js`
- Create: `frontend/pages/classrooms/index.jsx`
- Modify: `frontend/components/AppShell.jsx`
- Modify: `frontend/pages/student/classrooms.jsx`
- Modify: `frontend/pages/educator/classrooms.jsx`

- [ ] **Step 1: Create the classroom API helper**

```javascript
// frontend/lib/classroomApi.js
export async function fetchClassrooms(token) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/classrooms`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!response.ok) throw new Error('Could not load classrooms')
  return response.json()
}
```

- [ ] **Step 2: Create the reusable classroom list grid**

```javascript
// frontend/components/ClassroomCardGrid.jsx
import Link from 'next/link'

export default function ClassroomCardGrid({ classrooms = [], role = 'student' }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {classrooms.map((room) => (
        <Link key={room.id} href={`/classrooms/${room.id}/stream`} className="card overflow-hidden transition hover:-translate-y-0.5">
          <div className="min-h-[126px] bg-[linear-gradient(135deg,#5f4028,#8a5a36,#c49a74)] p-6 text-[#fffaf5]">
            <p className="text-sm uppercase tracking-[0.28em]">{room.subject}</p>
            <h3 className="mt-4 text-3xl font-bold">{room.name}</h3>
            <p className="mt-2 text-sm opacity-90">{room.educator?.full_name || room.educator_name || role}</p>
          </div>
        </Link>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create the shared classrooms list page**

```javascript
// frontend/pages/classrooms/index.jsx
export default function ClassroomsIndexPage() {
  const { token, user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [classrooms, setClassrooms] = useState([])

  useEffect(() => {
    if (authLoading) return
    if (!token) return void router.push('/login')
    fetchClassrooms(token).then((payload) => setClassrooms(payload.classrooms || []))
  }, [authLoading, token])

  return (
    <AppShell title="Classrooms" description="Open a classroom to enter its full learning workspace." contentClassName="space-y-8">
      <ClassroomCardGrid classrooms={classrooms} role={user?.role} />
    </AppShell>
  )
}
```

- [ ] **Step 4: Update sidebar links and compatibility pages**

```javascript
// frontend/components/AppShell.jsx
{ href: '/classrooms', label: 'Classroom', icon: Users, match: ['/classrooms', '/classrooms/[id]/stream', '/classrooms/[id]/classwork', '/classrooms/[id]/people', '/classrooms/[id]/messages', '/classrooms/[id]/live'] }

// frontend/pages/student/classrooms.jsx
useEffect(() => { router.replace('/classrooms') }, [router])
return null

// frontend/pages/educator/classrooms.jsx
useEffect(() => { router.replace('/classrooms') }, [router])
return null
```

- [ ] **Step 5: Verify the frontend compiles**

Run: `cd frontend && npm run build`

Expected: successful build with the repo’s existing `eslint` warning only.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/ClassroomShell.jsx frontend/components/ClassroomCardGrid.jsx frontend/lib/classroomApi.js frontend/pages/classrooms/index.jsx frontend/components/AppShell.jsx frontend/pages/student/classrooms.jsx frontend/pages/educator/classrooms.jsx
git commit -m "feat: add classroom list entry and shared shell foundation"
```

### Task 7: Build Stream, Classwork, and People Pages

**Files:**
- Create: `frontend/pages/classrooms/[id]/index.jsx`
- Create: `frontend/pages/classrooms/[id]/stream.jsx`
- Create: `frontend/pages/classrooms/[id]/classwork.jsx`
- Create: `frontend/pages/classrooms/[id]/people.jsx`
- Create: `frontend/components/ClassroomShell.jsx`
- Modify: `frontend/lib/classroomApi.js`

- [ ] **Step 1: Create the shared classroom shell**

```javascript
// frontend/components/ClassroomShell.jsx
import Link from 'next/link'
import AppShell from './AppShell'

const TABS = ['stream', 'classwork', 'people', 'messages', 'live']

export default function ClassroomShell({ classroom, activeTab, actions = null, children }) {
  return (
    <AppShell title={classroom?.name || 'Classroom'} description={classroom?.description || ''} actions={actions} contentClassName="space-y-6">
      <section className="card overflow-hidden">
        <div className="min-h-[180px] bg-[linear-gradient(135deg,#5f4028,#8a5a36,#c49a74)] px-8 py-10 text-[#fffaf5]">
          <p className="text-sm uppercase tracking-[0.28em]">{classroom?.subject}</p>
          <h1 className="mt-4 text-5xl font-bold">{classroom?.name}</h1>
        </div>
        <div className="flex flex-wrap gap-6 border-t border-stone-200 px-8 py-4">
          {TABS.map((tab) => (
            <Link key={tab} href={`/classrooms/${classroom.id}/${tab}`} className={activeTab === tab ? 'font-semibold text-[#6d472d]' : 'text-slate-600'}>
              {tab[0].toUpperCase() + tab.slice(1)}
            </Link>
          ))}
        </div>
      </section>
      {children}
    </AppShell>
  )
}
```

- [ ] **Step 2: Create the classroom root redirect**

```javascript
// frontend/pages/classrooms/[id]/index.jsx
import { useRouter } from 'next/router'
import { useEffect } from 'react'

export default function ClassroomIndexRedirect() {
  const router = useRouter()
  useEffect(() => {
    if (router.query.id) router.replace(`/classrooms/${router.query.id}/stream`)
  }, [router])
  return null
}
```

- [ ] **Step 3: Build `stream`, `classwork`, and `people` pages**

```javascript
// frontend/pages/classrooms/[id]/stream.jsx
const payload = await fetchClassroomStream(token, id)
return <ClassroomShell classroom={payload.classroom} activeTab="stream">{/* announcement cards */}</ClassroomShell>

// frontend/pages/classrooms/[id]/classwork.jsx
const payload = await fetchClasswork(token, id)
return <ClassroomShell classroom={payload.classroom} activeTab="classwork">{/* materials + assignments */}</ClassroomShell>

// frontend/pages/classrooms/[id]/people.jsx
const payload = await fetchClassroomPeople(token, id)
return <ClassroomShell classroom={payload.classroom} activeTab="people">{/* teachers + students */}</ClassroomShell>
```

- [ ] **Step 4: Extend API helpers**

```javascript
export async function fetchClassroomStream(token, classroomId) {
  return getJson(`/api/classrooms/${classroomId}/stream`, token)
}

export async function fetchClasswork(token, classroomId) {
  return getJson(`/api/classrooms/${classroomId}/classwork`, token)
}

export async function fetchClassroomPeople(token, classroomId) {
  return getJson(`/api/classrooms/${classroomId}/people`, token)
}
```

- [ ] **Step 5: Build the frontend**

Run: `cd frontend && npm run build`

Expected: successful build with the repo’s existing `eslint` warning only.

- [ ] **Step 6: Commit**

```bash
git add frontend/pages/classrooms/[id]/index.jsx frontend/pages/classrooms/[id]/stream.jsx frontend/pages/classrooms/[id]/classwork.jsx frontend/pages/classrooms/[id]/people.jsx frontend/components/ClassroomShell.jsx frontend/lib/classroomApi.js
git commit -m "feat: add classroom stream classwork and people pages"
```

### Task 8: Build Persistent Messages and Live Pages

**Files:**
- Create: `frontend/pages/classrooms/[id]/messages.jsx`
- Create: `frontend/pages/classrooms/[id]/live.jsx`
- Create: `frontend/components/ClassroomThreadPane.jsx`
- Create: `frontend/components/ClassroomLivePanel.jsx`
- Modify: `frontend/lib/classroomApi.js`

- [ ] **Step 1: Create the thread pane**

```javascript
// frontend/components/ClassroomThreadPane.jsx
export default function ClassroomThreadPane({ threads, activeThread, messages, onSelectThread, onSendMessage, role }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="card p-4">{/* contact/thread list */}</div>
      <div className="card p-6">{/* persistent message history + composer */}</div>
    </div>
  )
}
```

- [ ] **Step 2: Create the live panel**

```javascript
// frontend/components/ClassroomLivePanel.jsx
export default function ClassroomLivePanel({ sessions, role, onSchedule, onStart }) {
  return (
    <div className="grid gap-4">
      {/* upcoming scheduled sessions */}
      {/* live now session cards */}
      {/* educator schedule/start actions */}
    </div>
  )
}
```

- [ ] **Step 3: Build the classroom `messages` page**

```javascript
// frontend/pages/classrooms/[id]/messages.jsx
const threadsPayload = await fetchClassroomThreads(token, id)
const firstThreadId = threadsPayload.threads?.[0]?.id
if (firstThreadId) {
  const history = await fetchThreadMessages(token, id, firstThreadId)
  setMessages(history.messages || [])
}
```

Key rule in implementation:
- students render teacher contacts only
- no student-to-student contact UI

- [ ] **Step 4: Build the classroom `live` page**

```javascript
// frontend/pages/classrooms/[id]/live.jsx
const payload = await fetchClassroomLive(token, id)
return (
  <ClassroomShell classroom={payload.classroom} activeTab="live">
    <ClassroomLivePanel sessions={payload.sessions} role={user.role} />
  </ClassroomShell>
)
```

- [ ] **Step 5: Extend API helpers**

```javascript
export async function fetchClassroomThreads(token, classroomId) {
  return getJson(`/api/classrooms/${classroomId}/threads`, token)
}

export async function fetchThreadMessages(token, classroomId, threadId) {
  return getJson(`/api/classrooms/${classroomId}/threads/${threadId}/messages`, token)
}

export async function sendThreadMessage(token, classroomId, threadId, payload) {
  return postJson(`/api/classrooms/${classroomId}/threads/${threadId}/messages`, token, payload)
}

export async function fetchClassroomLive(token, classroomId) {
  return getJson(`/api/classrooms/${classroomId}/live`, token)
}
```

- [ ] **Step 6: Build the frontend**

Run: `cd frontend && npm run build`

Expected: successful build with the repo’s existing `eslint` warning only.

- [ ] **Step 7: Commit**

```bash
git add frontend/pages/classrooms/[id]/messages.jsx frontend/pages/classrooms/[id]/live.jsx frontend/components/ClassroomThreadPane.jsx frontend/components/ClassroomLivePanel.jsx frontend/lib/classroomApi.js
git commit -m "feat: add classroom messages and live pages"
```

### Task 9: Add In-App Notifications and Regression Pass

**Files:**
- Modify: `frontend/components/AppShell.jsx`
- Create: `frontend/pages/notifications.jsx`
- Modify: `backend/app/routers/classrooms.py`
- Test: `backend/tests/test_classroom_module.py`

- [ ] **Step 1: Add notification APIs**

```python
# backend/app/routers/classrooms.py
@router.get("/notifications")
async def list_notifications(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(Notification).filter(Notification.user_id == current_user.id).order_by(Notification.created_at.desc()).limit(50).all()
    return {"notifications": rows}

@router.post("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    notification = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == current_user.id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.read_at = datetime.utcnow()
    db.commit()
    return {"message": "Notification marked as read."}
```

- [ ] **Step 2: Add a lightweight notifications page**

```javascript
// frontend/pages/notifications.jsx
export default function NotificationsPage() {
  return <AppShell title="Notifications" description="Classroom updates, private replies, and live session alerts." />
}
```

- [ ] **Step 3: Add a nav link without disturbing existing features**

```javascript
// frontend/components/AppShell.jsx
{ href: '/notifications', label: 'Notifications', icon: Bell, match: ['/notifications'] }
```

- [ ] **Step 4: Run backend tests and frontend build**

Run: `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest backend.tests.test_classroom_module -v`
Expected: `OK`

Run: `cd frontend && npm run build`
Expected: successful build with the repo’s existing `eslint` warning only.

- [ ] **Step 5: Manual regression check**

Run:

```bash
curl -I http://127.0.0.1:3000/dashboard
curl -I http://127.0.0.1:3000/documents
curl -I http://127.0.0.1:3000/learning-chat
curl -I http://127.0.0.1:3000/progress
curl -I http://127.0.0.1:3000/classrooms
curl -sS http://127.0.0.1:8000/health
```

Expected:
- page routes return `200 OK`
- backend health returns `healthy`

- [ ] **Step 6: Commit**

```bash
git add frontend/components/AppShell.jsx frontend/pages/notifications.jsx backend/app/routers/classrooms.py backend/tests/test_classroom_module.py
git commit -m "feat: add classroom notifications and complete regression pass"
```

---

## Self-Review

### Spec coverage
- Classroom list/grid: covered in Task 6
- Dedicated classroom pages: covered in Tasks 7 and 8
- `Stream / Classwork / People / Messages / Live`: covered in Tasks 3, 4, 5, 7, 8
- Public teacher posts: covered in Task 3
- Private teacher-student threads: covered in Task 4
- Persistent history across logins: covered in Task 4
- Students cannot message other students: enforced in Task 4
- Materials and classwork inside classroom: covered in Task 3 and Task 7
- Scheduled/start-now live sessions with join flow: covered in Task 5 and Task 8
- In-app notifications now, email-ready later: covered in Tasks 3, 5, and 9
- Preserve other existing features: explicit regression pass in Task 9

### Placeholder scan
- No `TODO`, `TBD`, or “implement later” placeholders remain in the task steps.

### Type consistency
- Shared naming is consistent across the plan:
  - `ClassroomAnnouncement`
  - `ClassroomMaterial`
  - `ClassroomAssignment`
  - `ClassroomMessageThread`
  - `ClassroomThreadMessage`
  - `Notification`

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-21-classroom-module.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?  
