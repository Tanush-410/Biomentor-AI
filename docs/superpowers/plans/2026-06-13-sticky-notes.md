# Sticky Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build private, colorful, page-scoped sticky notes that students and educators can create with right-click, drag around, and keep tied to the exact page route even after logout.

**Architecture:** Add a new FastAPI sticky-notes router backed by a SQLAlchemy `StickyNote` model and auth-protected CRUD endpoints. Mount a shell-level React sticky-notes provider in `AppShell.jsx`, use the existing backend proxy/fallback patterns for hosted deployments, and store note placement in normalized ratios so notes reflow safely on resize.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, Next.js 14, React 18, node:test, Python unittest/TestClient

---

## File Map

### Backend

- Create: `backend/app/routers/sticky_notes.py`
- Modify: `backend/app/database/models.py`
- Modify: `backend/app/schemas/__init__.py`
- Modify: `backend/app/routers/__init__.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_sticky_notes.py`

### Frontend

- Create: `frontend/lib/stickyNotesApi.js`
- Create: `frontend/components/sticky-notes/StickyNotesProvider.jsx`
- Create: `frontend/components/sticky-notes/StickyNotesLayer.jsx`
- Create: `frontend/components/sticky-notes/StickyNoteCard.jsx`
- Create: `frontend/components/sticky-notes/StickyNoteContextMenu.jsx`
- Modify: `frontend/components/AppShell.jsx`
- Test: `frontend/tests/sticky-notes-contract.test.mjs`

### Verification

- Verify: shell-mounted student flow
- Verify: shell-mounted educator flow
- Verify: route-scoped persistence across refresh and logout

---

### Task 1: Add the backend sticky-note model and schemas

**Files:**
- Modify: `backend/app/database/models.py`
- Modify: `backend/app/schemas/__init__.py`
- Test: `backend/tests/test_sticky_notes.py`

- [ ] **Step 1: Write the failing backend model/schema test**

```python
import os
import sys
import unittest


CURRENT_DIR = os.path.dirname(__file__)
BACKEND_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.database import models  # noqa: E402
from app.schemas import StickyNoteCreate, StickyNoteResponse  # noqa: E402


class StickyNoteModelSchemaTests(unittest.TestCase):
    def test_sticky_note_model_exists(self):
        self.assertTrue(hasattr(models, "StickyNote"))

    def test_sticky_note_schema_supports_ratio_fields(self):
        payload = StickyNoteCreate(
            page_url="/documents",
            title="Review later",
            content="Turn this into flashcards",
            color="amber",
            x_ratio=0.42,
            y_ratio=0.28,
            width=320,
            height=220,
        )
        response = StickyNoteResponse(
            id="note-1",
            user_id="student-1",
            page_url=payload.page_url,
            title=payload.title,
            content=payload.content,
            color=payload.color,
            x_ratio=payload.x_ratio,
            y_ratio=payload.y_ratio,
            width=payload.width,
            height=payload.height,
            z_index=1,
            created_at="2026-06-13T10:00:00Z",
            updated_at="2026-06-13T10:00:00Z",
        )
        self.assertEqual(response.color, "amber")
        self.assertEqual(response.page_url, "/documents")
```

- [ ] **Step 2: Run the backend test to verify it fails**

Run: `cd backend && python3 -m pytest tests/test_sticky_notes.py -k "model or schema" -v`

Expected: FAIL with import or attribute errors for `StickyNote`, `StickyNoteCreate`, or `StickyNoteResponse`.

- [ ] **Step 3: Add the minimal model and schema definitions**

```python
# backend/app/database/models.py
class StickyNote(Base):
    __tablename__ = "sticky_notes"

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    page_url = Column(String, nullable=False, index=True)
    title = Column(String, nullable=True)
    content = Column(Text, nullable=False)
    color = Column(String, default="amber", nullable=False)
    x_ratio = Column(Float, default=0.5, nullable=False)
    y_ratio = Column(Float, default=0.25, nullable=False)
    width = Column(Integer, default=320, nullable=False)
    height = Column(Integer, default=220, nullable=False)
    z_index = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

```python
# backend/app/schemas/__init__.py
class StickyNoteBase(BaseModel):
    page_url: str
    title: Optional[str] = None
    content: str = Field(..., min_length=1, max_length=4000)
    color: str = Field(default="amber")
    x_ratio: float = Field(default=0.5, ge=0, le=1)
    y_ratio: float = Field(default=0.25, ge=0, le=1)
    width: int = Field(default=320, ge=220, le=420)
    height: int = Field(default=220, ge=160, le=420)


class StickyNoteCreate(StickyNoteBase):
    pass


class StickyNoteUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=120)
    content: Optional[str] = Field(default=None, min_length=1, max_length=4000)
    color: Optional[str] = None
    x_ratio: Optional[float] = Field(default=None, ge=0, le=1)
    y_ratio: Optional[float] = Field(default=None, ge=0, le=1)
    width: Optional[int] = Field(default=None, ge=220, le=420)
    height: Optional[int] = Field(default=None, ge=160, le=420)
    z_index: Optional[int] = Field(default=None, ge=1, le=9999)


class StickyNoteResponse(StickyNoteBase):
    id: str
    user_id: str
    z_index: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
```

- [ ] **Step 4: Run the backend test to verify it passes**

Run: `cd backend && python3 -m pytest tests/test_sticky_notes.py -k "model or schema" -v`

Expected: PASS for both tests.

- [ ] **Step 5: Commit**

```bash
git add backend/app/database/models.py backend/app/schemas/__init__.py backend/tests/test_sticky_notes.py
git commit -m "feat: add sticky note model and schemas"
```

---

### Task 2: Add authenticated sticky-note CRUD endpoints

**Files:**
- Create: `backend/app/routers/sticky_notes.py`
- Modify: `backend/app/routers/__init__.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_sticky_notes.py`

- [ ] **Step 1: Write the failing API ownership test**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.main import app
from app.database import get_db
from app.database.models import Base, User
from app.routers.auth import create_access_token, hash_password


class StickyNoteApiTests(unittest.TestCase):
    def setUp(self):
        engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=engine)
        self.session = sessionmaker(bind=engine)()

        def override_get_db():
            try:
                yield self.session
            finally:
                pass

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

        self.student = User(
            id="student-1",
            email="student@example.com",
            hashed_password=hash_password("password123"),
            full_name="Student One",
            role="student",
        )
        self.other_student = User(
            id="student-2",
            email="other@example.com",
            hashed_password=hash_password("password123"),
            full_name="Student Two",
            role="student",
        )
        self.session.add_all([self.student, self.other_student])
        self.session.commit()

    def auth_headers(self, user_id):
        token = create_access_token({"sub": user_id, "role": "student"})
        return {"Authorization": f"Bearer {token}"}

    def tearDown(self):
        app.dependency_overrides.clear()
        self.session.close()

    def test_create_and_list_only_returns_notes_for_current_user_on_page(self):
        create_response = self.client.post(
            "/api/sticky-notes",
            json={
                "page_url": "/documents",
                "title": "Review",
                "content": "Open this after class",
                "color": "amber",
                "x_ratio": 0.4,
                "y_ratio": 0.3,
                "width": 320,
                "height": 220,
            },
            headers=self.auth_headers("student-1"),
        )
        self.assertEqual(create_response.status_code, 200)

        mine = self.client.get(
            "/api/sticky-notes?page_url=/documents",
            headers=self.auth_headers("student-1"),
        )
        other = self.client.get(
            "/api/sticky-notes?page_url=/documents",
            headers=self.auth_headers("student-2"),
        )

        self.assertEqual(len(mine.json()), 1)
        self.assertEqual(other.json(), [])
```

- [ ] **Step 2: Run the API test to verify it fails**

Run: `cd backend && python3 -m pytest tests/test_sticky_notes.py -k "create_and_list_only_returns_notes_for_current_user_on_page" -v`

Expected: FAIL with `404` on `/api/sticky-notes` or missing router imports.

- [ ] **Step 3: Implement the sticky-note router and wire it into the app**

```python
# backend/app/routers/sticky_notes.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.database.models import StickyNote, User
from app.routers.auth import get_current_user
from app.schemas import StickyNoteCreate, StickyNoteResponse, StickyNoteUpdate

router = APIRouter(prefix="/api/sticky-notes", tags=["sticky-notes"])


def normalize_page_url(page_url: str) -> str:
    normalized = (page_url or "").strip() or "/"
    if not normalized.startswith("/"):
        normalized = f"/{normalized}"
    return normalized.split("#", 1)[0]


@router.get("", response_model=list[StickyNoteResponse])
def list_sticky_notes(
    page_url: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    normalized = normalize_page_url(page_url)
    return (
        db.query(StickyNote)
        .filter(StickyNote.user_id == current_user.id, StickyNote.page_url == normalized)
        .order_by(StickyNote.z_index.asc(), StickyNote.updated_at.asc())
        .all()
    )
```

```python
# backend/app/routers/sticky_notes.py
@router.post("", response_model=StickyNoteResponse)
def create_sticky_note(
    payload: StickyNoteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    note = StickyNote(user_id=current_user.id, page_url=normalize_page_url(payload.page_url), **payload.model_dump(exclude={"page_url"}))
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.patch("/{note_id}", response_model=StickyNoteResponse)
def update_sticky_note(note_id: str, payload: StickyNoteUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    note = db.query(StickyNote).filter(StickyNote.id == note_id, StickyNote.user_id == current_user.id).first()
    if note is None:
        raise HTTPException(status_code=404, detail="Sticky note not found.")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(note, key, value)
    db.commit()
    db.refresh(note)
    return note


@router.delete("/{note_id}")
def delete_sticky_note(note_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    note = db.query(StickyNote).filter(StickyNote.id == note_id, StickyNote.user_id == current_user.id).first()
    if note is None:
        raise HTTPException(status_code=404, detail="Sticky note not found.")
    db.delete(note)
    db.commit()
    return {"ok": True}
```

```python
# backend/app/routers/__init__.py
from .sticky_notes import router as sticky_notes_router

__all__ = [
    "auth_router",
    "certificates_router",
    "classrooms_router",
    "collaboration_router",
    "documents_router",
    "educator_router",
    "quiz_router",
    "qa_router",
    "sticky_notes_router",
]
```

```python
# backend/app/main.py
from app.routers import auth_router, certificates_router, classrooms_router, collaboration_router, documents_router, educator_router, quiz_router, qa_router, sticky_notes_router

app.include_router(sticky_notes_router)
```

- [ ] **Step 4: Run the API tests to verify they pass**

Run: `cd backend && python3 -m pytest tests/test_sticky_notes.py -k "StickyNoteApiTests" -v`

Expected: PASS for create, list, update, delete, and ownership checks.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/sticky_notes.py backend/app/routers/__init__.py backend/app/main.py backend/tests/test_sticky_notes.py
git commit -m "feat: add sticky note api endpoints"
```

---

### Task 3: Add a frontend sticky-notes API helper and hosted-proxy contract tests

**Files:**
- Create: `frontend/lib/stickyNotesApi.js`
- Test: `frontend/tests/sticky-notes-contract.test.mjs`

- [ ] **Step 1: Write the failing frontend helper contract test**

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (relativePath) => fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("sticky notes api helper uses hosted backend fallback", () => {
  const source = read("lib/stickyNotesApi.js");
  assert.match(source, /fetchBackendWithFallback/);
  assert.match(source, /export async function listStickyNotes/);
  assert.match(source, /export async function createStickyNote/);
  assert.match(source, /export async function updateStickyNote/);
  assert.match(source, /export async function deleteStickyNote/);
  assert.match(source, /\\/sticky-notes\\?page_url=/);
});
```

- [ ] **Step 2: Run the frontend contract test to verify it fails**

Run: `node --test frontend/tests/sticky-notes-contract.test.mjs`

Expected: FAIL because `frontend/lib/stickyNotesApi.js` does not exist yet.

- [ ] **Step 3: Implement the helper with the existing backend fallback pattern**

```javascript
import { fetchBackendWithFallback, readErrorDetail } from "./backendApi";

async function parseOrThrow(response) {
  if (!response.ok) {
    throw new Error((await readErrorDetail(response)) || "Sticky notes request failed.");
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

export async function listStickyNotes(pageUrl, token) {
  const response = await fetchBackendWithFallback(`/sticky-notes?page_url=${encodeURIComponent(pageUrl)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseOrThrow(response);
}
```

```javascript
export async function createStickyNote(payload, token) {
  const response = await fetchBackendWithFallback("/sticky-notes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return parseOrThrow(response);
}

export async function updateStickyNote(noteId, payload, token) {
  const response = await fetchBackendWithFallback(`/sticky-notes/${noteId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return parseOrThrow(response);
}

export async function deleteStickyNote(noteId, token) {
  const response = await fetchBackendWithFallback(`/sticky-notes/${noteId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseOrThrow(response);
}
```

- [ ] **Step 4: Run the frontend contract test to verify it passes**

Run: `node --test frontend/tests/sticky-notes-contract.test.mjs`

Expected: PASS with all helper exports present.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/stickyNotesApi.js frontend/tests/sticky-notes-contract.test.mjs
git commit -m "feat: add sticky notes api helper"
```

---

### Task 4: Mount the sticky-notes layer in the shared shell and support right-click creation

**Files:**
- Create: `frontend/components/sticky-notes/StickyNotesProvider.jsx`
- Create: `frontend/components/sticky-notes/StickyNotesLayer.jsx`
- Create: `frontend/components/sticky-notes/StickyNoteContextMenu.jsx`
- Create: `frontend/components/sticky-notes/StickyNoteCard.jsx`
- Modify: `frontend/components/AppShell.jsx`
- Test: `frontend/tests/sticky-notes-contract.test.mjs`

- [ ] **Step 1: Extend the frontend contract test to require shell mounting and note components**

```javascript
test("app shell mounts the sticky notes provider and layer", () => {
  const shellSource = read("components/AppShell.jsx");
  const providerSource = read("components/sticky-notes/StickyNotesProvider.jsx");
  assert.match(shellSource, /StickyNotesProvider/);
  assert.match(shellSource, /StickyNotesLayer/);
  assert.match(providerSource, /onContextMenu/);
  assert.match(providerSource, /Add Sticky Note/);
  assert.match(providerSource, /useRouter/);
});
```

- [ ] **Step 2: Run the frontend contract test to verify it fails**

Run: `node --test frontend/tests/sticky-notes-contract.test.mjs`

Expected: FAIL because the provider and shell integration do not exist yet.

- [ ] **Step 3: Add the provider, context menu, and shell mount**

```javascript
// frontend/components/AppShell.jsx
import StickyNotesProvider from './sticky-notes/StickyNotesProvider'

export default function AppShell(...) {
  ...
  return (
    <StickyNotesProvider>
      <div className={`min-h-screen ...`}>
        ...
      </div>
    </StickyNotesProvider>
  )
}
```

```javascript
// frontend/components/sticky-notes/StickyNotesProvider.jsx
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../../context/AuthContext";
import { createStickyNote, listStickyNotes, updateStickyNote, deleteStickyNote } from "../../lib/stickyNotesApi";
import StickyNotesLayer from "./StickyNotesLayer";
import StickyNoteContextMenu from "./StickyNoteContextMenu";

const StickyNotesContext = createContext(null);

export default function StickyNotesProvider({ children }) {
  const router = useRouter();
  const { token, user } = useAuth();
  const [notes, setNotes] = useState([]);
  const [menu, setMenu] = useState(null);
  const pageUrl = useMemo(() => router.asPath.split("#", 1)[0] || "/", [router.asPath]);
  ...
}
```

```javascript
// frontend/components/sticky-notes/StickyNoteContextMenu.jsx
export default function StickyNoteContextMenu({ x, y, onAdd, onClose }) {
  return (
    <div className="fixed z-[80] min-w-[190px] rounded-2xl border border-stone-200 bg-white/95 p-2 shadow-2xl" style={{ left: x, top: y }}>
      <button onClick={onAdd} className="flex w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-stone-800 hover:bg-stone-100">
        Add Sticky Note
      </button>
      <button onClick={onClose} className="mt-1 flex w-full rounded-xl px-3 py-2 text-left text-sm text-stone-500 hover:bg-stone-100">
        Cancel
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run the frontend contract test to verify it passes**

Run: `node --test frontend/tests/sticky-notes-contract.test.mjs`

Expected: PASS with shell/provider/context-menu assertions satisfied.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/AppShell.jsx frontend/components/sticky-notes/StickyNotesProvider.jsx frontend/components/sticky-notes/StickyNotesLayer.jsx frontend/components/sticky-notes/StickyNoteContextMenu.jsx frontend/components/sticky-notes/StickyNoteCard.jsx frontend/tests/sticky-notes-contract.test.mjs
git commit -m "feat: mount sticky notes in app shell"
```

---

### Task 5: Add drag, auto-save, delete controls, color themes, and responsive reflow

**Files:**
- Modify: `frontend/components/sticky-notes/StickyNotesProvider.jsx`
- Modify: `frontend/components/sticky-notes/StickyNotesLayer.jsx`
- Modify: `frontend/components/sticky-notes/StickyNoteCard.jsx`
- Test: `frontend/tests/sticky-notes-contract.test.mjs`

- [ ] **Step 1: Add failing contract tests for drag, resize reflow, and interactive-element opt-out**

```javascript
test("sticky notes keep normalized ratios and skip hijacking form controls", () => {
  const providerSource = read("components/sticky-notes/StickyNotesProvider.jsx");
  const layerSource = read("components/sticky-notes/StickyNotesLayer.jsx");
  const cardSource = read("components/sticky-notes/StickyNoteCard.jsx");
  assert.match(providerSource, /split\\("#", 1\\)/);
  assert.match(providerSource, /input|textarea|contenteditable/i);
  assert.match(layerSource, /PointerEvent|pointerdown|mousemove|mouseup/);
  assert.match(layerSource, /x_ratio/);
  assert.match(layerSource, /y_ratio/);
  assert.match(cardSource, /amber|coral|sage|sky|lavender|blush/);
  assert.match(cardSource, /textarea/);
  assert.match(cardSource, /Delete|Trash/);
  assert.match(providerSource, /setTimeout|clearTimeout/);
  assert.match(layerSource, /collides|overlap|nudge/i);
});
```

- [ ] **Step 2: Run the frontend contract test to verify it fails**

Run: `node --test frontend/tests/sticky-notes-contract.test.mjs`

Expected: FAIL because drag/reflow/color-specific logic is still missing.

- [ ] **Step 3: Implement the normalized layout and drag behavior**

```javascript
// frontend/components/sticky-notes/StickyNotesLayer.jsx
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toPixels(note, bounds) {
  return {
    left: clamp(note.x_ratio * bounds.width, 12, Math.max(12, bounds.width - note.width - 12)),
    top: clamp(note.y_ratio * bounds.height, 12, Math.max(12, bounds.height - note.height - 12)),
  };
}

function collides(a, b) {
  return !(
    a.left + a.width < b.left
    || b.left + b.width < a.left
    || a.top + a.height < b.top
    || b.top + b.height < a.top
  );
}

function nudgeIntoOpenSpace(layout, placed, bounds) {
  let next = { ...layout };
  while (placed.some((item) => collides({ ...next, width: layout.width, height: layout.height }, item))) {
    next.top = clamp(next.top + 24, 12, Math.max(12, bounds.height - layout.height - 12));
    if (next.top >= bounds.height - layout.height - 12) {
      next.left = clamp(next.left + 24, 12, Math.max(12, bounds.width - layout.width - 12));
      next.top = 12;
    }
  }
  return next;
}

function toRatios(left, top, bounds, note) {
  return {
    x_ratio: clamp(left / Math.max(bounds.width - note.width, 1), 0, 1),
    y_ratio: clamp(top / Math.max(bounds.height - note.height, 1), 0, 1),
  };
}
```

```javascript
// frontend/components/sticky-notes/StickyNotesProvider.jsx
function shouldIgnoreContextTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest("input, textarea, select, button, a, [contenteditable='true'], [data-sticky-notes-ignore='true']")
  );
}
```

```javascript
// frontend/components/sticky-notes/StickyNotesProvider.jsx
useEffect(() => {
  if (!token || !user) return undefined;
  const pending = notes.filter((note) => note._dirty);
  if (!pending.length) return undefined;
  const timeoutId = window.setTimeout(async () => {
    for (const note of pending) {
      const payload = {
        title: note.title,
        content: note.content,
        color: note.color,
        x_ratio: note.x_ratio,
        y_ratio: note.y_ratio,
        width: note.width,
        height: note.height,
        z_index: note.z_index,
      };
      const saved = note._isNew
        ? await createStickyNote({ ...payload, page_url: pageUrl }, token)
        : await updateStickyNote(note.id, payload, token);
      setNotes((current) => current.map((item) => (item.id === note.id ? { ...saved, _dirty: false, _isNew: false } : item)));
    }
  }, 250);
  return () => window.clearTimeout(timeoutId);
}, [notes, pageUrl, token, user]);
```

```javascript
// frontend/components/sticky-notes/StickyNoteCard.jsx
const NOTE_THEMES = {
  amber: "bg-[#fff1cf] border-[#e4c26d]",
  coral: "bg-[#ffdcd4] border-[#ec9b86]",
  sage: "bg-[#ddebd7] border-[#9fbc93]",
  sky: "bg-[#dbeafe] border-[#8ab7e8]",
  lavender: "bg-[#ece3ff] border-[#bea5ec]",
  blush: "bg-[#ffe5ed] border-[#e6a2ba]",
};
```

```javascript
// frontend/components/sticky-notes/StickyNoteCard.jsx
<button
  type="button"
  onClick={() => onDelete(note.id)}
  className="rounded-lg px-2 py-1 text-xs font-semibold text-stone-500 hover:bg-white/70 hover:text-rose-700"
>
  Delete
</button>
```

- [ ] **Step 4: Run the frontend contract test to verify it passes**

Run: `node --test frontend/tests/sticky-notes-contract.test.mjs`

Expected: PASS with normalized positioning, form-control opt-out, and note theme coverage.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/sticky-notes/StickyNotesProvider.jsx frontend/components/sticky-notes/StickyNotesLayer.jsx frontend/components/sticky-notes/StickyNoteCard.jsx frontend/tests/sticky-notes-contract.test.mjs
git commit -m "feat: add draggable responsive sticky notes"
```

---

### Task 6: Verify student and educator flows end-to-end

**Files:**
- Verify: `frontend/components/AppShell.jsx`
- Verify: `frontend/components/sticky-notes/StickyNotesProvider.jsx`
- Verify: `backend/app/routers/sticky_notes.py`
- Verify: `backend/tests/test_sticky_notes.py`
- Verify: `frontend/tests/sticky-notes-contract.test.mjs`

- [ ] **Step 1: Run the backend sticky-notes test suite**

Run: `cd backend && python3 -m pytest tests/test_sticky_notes.py -v`

Expected: PASS for model/schema coverage and API ownership coverage.

- [ ] **Step 2: Run the frontend sticky-notes contract suite**

Run: `node --test frontend/tests/sticky-notes-contract.test.mjs`

Expected: PASS for helper, shell mounting, drag, route scoping, and theme assertions.

- [ ] **Step 3: Run one existing shared-shell contract check to catch accidental regressions**

Run: `node --test frontend/tests/dashboard-production-guard.test.mjs`

Expected: PASS so the shell changes did not break the dashboard surface expectations.

- [ ] **Step 4: Manual click-through verification**

```text
1. Log in as a student.
2. Open /documents and create two notes in different colors.
3. Refresh and confirm both notes return on /documents.
4. Open /progress and confirm /documents notes do not appear there.
5. Log out, log back in, return to /documents, confirm notes persist.
6. Log in as an educator and confirm the educator cannot see the student's notes.
7. Create an educator note on /educator/exam-maker and drag it near the bottom-right corner.
8. Resize the browser narrower and confirm the note stays visible instead of overflowing off-screen.
```

- [ ] **Step 5: Final commit**

```bash
git add backend/app/database/models.py backend/app/schemas/__init__.py backend/app/routers/sticky_notes.py backend/app/routers/__init__.py backend/app/main.py backend/tests/test_sticky_notes.py frontend/lib/stickyNotesApi.js frontend/components/AppShell.jsx frontend/components/sticky-notes/StickyNotesProvider.jsx frontend/components/sticky-notes/StickyNotesLayer.jsx frontend/components/sticky-notes/StickyNoteCard.jsx frontend/components/sticky-notes/StickyNoteContextMenu.jsx frontend/tests/sticky-notes-contract.test.mjs
git commit -m "feat: add private page sticky notes"
```
