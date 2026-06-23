# Sticky Note Position Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep every private sticky note exactly where its owner creates or drags it, persist text across sessions, and permanently remove notes only when Delete succeeds.

**Architecture:** Keep the existing backend-backed, page-scoped sticky-note model. Remove frontend collision resolution from loading, creation, and resize; retain rendering-only viewport clamping. Add debounced title/body persistence while keeping blur saves, and preserve optimistic delete rollback.

**Tech Stack:** Next.js 14, React 18, Node test runner, FastAPI sticky-note CRUD

---

### Task 1: Lock Stable Placement Into Frontend Contracts

**Files:**
- Modify: `frontend/tests/sticky-notes-contract.test.mjs`
- Test: `frontend/tests/sticky-notes-contract.test.mjs`

- [ ] **Step 1: Write failing stable-position assertions**

Add assertions that `StickyNotesLayer` does not import or call `resolveStickyNoteCollisions`, loads API notes directly, appends created notes directly, and only updates viewport dimensions during resize.

```js
assert.doesNotMatch(layerSource, /resolveStickyNoteCollisions/)
assert.match(layerSource, /setNotes\(payload \|\| \[\]\)/)
assert.match(layerSource, /setNotes\(\(current\) => \[\.\.\.current, created\]\)/)
assert.match(layerSource, /const handleResize = \(\) => setViewport\(getViewport\(\)\)/)
```

- [ ] **Step 2: Write failing persistence assertions**

Require a per-note debounce timer, delayed patch, blur flush, and optimistic delete rollback.

```js
assert.match(layerSource, /saveTimersRef = useRef\(new Map\(\)\)/)
assert.match(layerSource, /scheduleNoteSave/)
assert.match(layerSource, /window\.setTimeout/)
assert.match(layerSource, /flushNoteSave/)
assert.match(layerSource, /setNotes\(previousNotes\)/)
```

- [ ] **Step 3: Run the contract test and verify RED**

Run:

```bash
cd frontend
node --test tests/sticky-notes-contract.test.mjs
```

Expected: FAIL because collision resolution is still imported/called and debounced autosave does not exist.

### Task 2: Preserve Exact Positions

**Files:**
- Modify: `frontend/components/sticky-notes/StickyNotesLayer.jsx`
- Test: `frontend/tests/sticky-notes-contract.test.mjs`

- [ ] **Step 1: Remove collision layout dependency**

Replace:

```js
import { clamp, resolveStickyNoteCollisions } from '../../lib/stickyNotesLayout'
```

with:

```js
import { clamp } from '../../lib/stickyNotesLayout'
```

- [ ] **Step 2: Load notes without mutating coordinates**

Use:

```js
setViewport(getViewport())
setNotes(payload || [])
```

- [ ] **Step 3: Resize without mutating notes**

Use:

```js
const handleResize = () => setViewport(getViewport())
```

- [ ] **Step 4: Create notes without rearranging them**

Use:

```js
setNotes((current) => [...current, created])
```

- [ ] **Step 5: Run the sticky-note contract**

Run:

```bash
cd frontend
node --test tests/sticky-notes-contract.test.mjs
```

Expected: stable-position assertions pass; autosave assertions remain failing until Task 3.

### Task 3: Autosave Text Without Losing User Input

**Files:**
- Modify: `frontend/components/sticky-notes/StickyNotesLayer.jsx`
- Test: `frontend/tests/sticky-notes-contract.test.mjs`

- [ ] **Step 1: Add note-specific debounce timers**

Add:

```js
const saveTimersRef = useRef(new Map())
```

and clear all timers during component cleanup.

- [ ] **Step 2: Add delayed text persistence**

Implement `scheduleNoteSave(noteId, changes)` to clear the existing note timer and call `handlePatchNote` after approximately 650 ms.

- [ ] **Step 3: Add blur flushing**

Implement `flushNoteSave(noteId, changes)` to cancel the pending timer and immediately call `handlePatchNote`.

- [ ] **Step 4: Wire title and body fields**

On each change, update local state immediately and schedule the relevant field save. On blur, flush the current field value.

- [ ] **Step 5: Avoid post-delete saves**

Before deleting, clear any pending timer for that note. Keep the existing optimistic removal and restore `previousNotes` if the API request fails.

- [ ] **Step 6: Run the sticky-note contract and verify GREEN**

Run:

```bash
cd frontend
node --test tests/sticky-notes-contract.test.mjs
```

Expected: PASS.

### Task 4: Full Regression Verification

**Files:**
- Verify: `frontend/components/sticky-notes/StickyNotesLayer.jsx`
- Verify: `frontend/lib/stickyNotesApi.js`
- Verify: `backend/app/routers/sticky_notes.py`

- [ ] **Step 1: Run all frontend contracts**

```bash
cd frontend
node --test tests/*.test.mjs
```

Expected: all tests pass.

- [ ] **Step 2: Build production frontend**

```bash
cd frontend
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Run backend sticky-note tests**

```bash
cd backend
PYTHONPATH=/tmp/biomentor-test-deps:. /tmp/biomentor-test-deps/bin/pytest -q tests/test_sticky_notes.py
```

Expected: all sticky-note backend tests pass.

- [ ] **Step 4: Check the final diff**

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only the spec, plan, component, and sticky-note test changes are present.
