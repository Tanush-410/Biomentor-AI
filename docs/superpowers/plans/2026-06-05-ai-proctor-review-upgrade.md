# AI Proctor Review Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade AI Proctor Review from a generic incident summary into a clearer educator decision-support layer that distinguishes suspicion strength, evidence quality, escalation priority, and next actions while surfacing those insights prominently in the quiz and student-analytics flows.

**Architecture:** Extend the existing `build_proctor_review_payload()` service to emit richer structured review fields without changing the route entry points. Then rebuild the shared review panel so it reads like a misconduct review workspace with evidence posture, case priority, and follow-up actions instead of just counts and a timeline.

**Tech Stack:** FastAPI, Pydantic schemas, shared backend AI quality helpers, Next.js/React, Node contract tests, Python unittest.

---

### Task 1: Lock the richer proctor-review contract with failing tests

**Files:**
- Modify: `backend/tests/test_ai_proctor_review.py`
- Modify: `frontend/tests/proctor-review-contract.test.mjs`

- [ ] **Step 1: Add backend expectations for stronger review outputs**

Extend the tests so the payload must include:
- `case_posture`
- `evidence_strength`
- `review_priority`
- `debarrment_guidance`
- `follow_up_actions`

Also assert that a heuristic-only case does not overclaim and instead produces a review-oriented posture.

- [ ] **Step 2: Run the backend test to verify it fails**

Run:

```bash
python3 -m unittest backend.tests.test_ai_proctor_review -v
```

Expected: FAIL because the new review fields do not exist yet.

- [ ] **Step 3: Add frontend contract expectations for the stronger UI surfacing**

Update the contract test so it checks the shared panel for:
- `Case posture`
- `Evidence strength`
- `Review priority`
- `Debar review`
- `Follow-up actions`

- [ ] **Step 4: Run the frontend contract test to verify it fails**

Run:

```bash
cd frontend && node --test tests/proctor-review-contract.test.mjs
```

Expected: FAIL because the panel does not render those sections yet.

### Task 2: Upgrade backend proctor-review intelligence

**Files:**
- Modify: `backend/app/services/proctor_review.py`
- Modify: `backend/app/schemas/__init__.py`

- [ ] **Step 1: Expand the response schema**

Add focused models for:
- `ProctorFollowUpAction`
- `ProctorDebarGuidance`

Extend the response with:
- `case_posture`
- `evidence_strength`
- `review_priority`
- `debarrment_guidance`
- `follow_up_actions`

- [ ] **Step 2: Implement richer misconduct review logic**

Add logic that:
- distinguishes strong misconduct signals from weak heuristic-only suspicion
- derives case posture and educator review priority from severity, termination state, and signal mix
- produces a debar-review block with clearer language when termination occurred
- emits explicit follow-up actions for warning-only, mixed, and terminated cases

- [ ] **Step 3: Re-run backend tests**

Run:

```bash
python3 -m unittest backend.tests.test_ai_proctor_review -v
```

Expected: PASS

### Task 3: Rebuild the shared proctor-review surface

**Files:**
- Modify: `frontend/components/ProctorReviewPanel.jsx`
- Verify surfacing in: `frontend/pages/classrooms/[id]/quiz/[quizId].jsx`
- Verify surfacing in: `frontend/pages/educator/student/[id].jsx`

- [ ] **Step 1: Make the panel read like a review workspace**

Refactor the panel so it highlights:
- case posture
- evidence strength
- review priority
- debar review guidance
- follow-up actions

Keep the timeline and student incident snapshots, but make them support the decision flow rather than dominate it.

- [ ] **Step 2: Preserve the educator entry points**

Keep the quiz educator view and student analytics view using the shared panel so the richer review appears in both places without duplicating logic.

- [ ] **Step 3: Re-run frontend contract test**

Run:

```bash
cd frontend && node --test tests/proctor-review-contract.test.mjs
```

Expected: PASS

### Task 4: Verify the slice

**Files:**
- Verify only

- [ ] **Step 1: Run backend verification**

```bash
python3 -m unittest backend.tests.test_ai_proctor_review -v
```

Expected: PASS

- [ ] **Step 2: Run frontend verification**

```bash
cd frontend && node --test tests/proctor-review-contract.test.mjs
```

Expected: PASS

- [ ] **Step 3: Run production build**

```bash
cd frontend && npm run build -- --no-lint
```

Expected: PASS
