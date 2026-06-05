# AI UI Surfacing Batch 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the upgraded AI systems feel unmistakably central on the highest-traffic workflows by adding stronger page-level AI spotlight surfaces across Dashboard, Materials, Learning Chat, Classroom Stream, and Communication Hub.

**Architecture:** Add one reusable cross-page AI spotlight component, then wire it into the first five workflow pages with stronger names, clearer AI value framing, and more obvious call-to-action pathways into the existing AI panels. Keep the underlying AI systems intact; this is a frontend hierarchy and product-surfacing pass.

**Tech Stack:** Next.js/React, existing design system classes, Node contract tests, production build verification.

---

### Task 1: Lock the new AI surfacing contract with failing tests

**Files:**
- Create: `frontend/tests/ai-surfacing-batch-1-contract.test.mjs`

- [ ] **Step 1: Add page-level expectations for stronger AI surfacing**

Write a contract test that checks for these page-level markers:
- `AI Mission Control` on `dashboard.jsx`
- `Material Intelligence Studio` on `documents.jsx`
- `AI Reasoning Mode` on `learning-chat.jsx`
- `Classroom AI Board` on `classrooms/[id]/stream.jsx`
- `Copilot Response Center` on `communication-hub.jsx`

- [ ] **Step 2: Run the contract test to verify it fails**

Run:

```bash
cd frontend && node --test tests/ai-surfacing-batch-1-contract.test.mjs
```

Expected: FAIL because those stronger AI surfacing markers do not exist yet.

### Task 2: Add a reusable AI spotlight surface

**Files:**
- Create: `frontend/components/AISpotlightBanner.jsx`

- [ ] **Step 1: Build a reusable spotlight component**

Create a component that supports:
- eyebrow
- title
- description
- capability chips
- primary and secondary actions

This should feel stronger than a normal card and work as the visible AI gateway on a page.

### Task 3: Wire the spotlight into the first five workflows

**Files:**
- Modify: `frontend/pages/dashboard.jsx`
- Modify: `frontend/pages/documents.jsx`
- Modify: `frontend/pages/learning-chat.jsx`
- Modify: `frontend/pages/classrooms/[id]/stream.jsx`
- Modify: `frontend/pages/communication-hub.jsx`

- [ ] **Step 1: Dashboard surfacing**

Add an `AI Mission Control` spotlight that makes Study Coach or Educator Copilot feel like the main AI entry point on the dashboard.

- [ ] **Step 2: Materials surfacing**

Add a `Material Intelligence Studio` spotlight that frames the materials page as an AI-powered study engine, not just a file library.

- [ ] **Step 3: Learning Chat surfacing**

Add an `AI Reasoning Mode` spotlight that makes PDF-first + trusted-web fallback + quick-check behavior obvious.

- [ ] **Step 4: Classroom stream surfacing**

Add a `Classroom AI Board` spotlight that frames classroom intelligence as a central class signal surface rather than a side panel.

- [ ] **Step 5: Communication Hub surfacing**

Add a `Copilot Response Center` spotlight that makes Educator Copilot feel like the default communication strategy layer.

### Task 4: Verify the slice

**Files:**
- Verify only

- [ ] **Step 1: Run the surfacing contract test**

```bash
cd frontend && node --test tests/ai-surfacing-batch-1-contract.test.mjs
```

Expected: PASS

- [ ] **Step 2: Run the existing AI surface contract tests**

```bash
cd frontend && node --test tests/material-intelligence-contract.test.mjs tests/study-coach-contract.test.mjs tests/classroom-intelligence-contract.test.mjs tests/educator-copilot-contract.test.mjs
```

Expected: PASS

- [ ] **Step 3: Run the production build**

```bash
cd frontend && npm run build -- --no-lint
```

Expected: PASS
