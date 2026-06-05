# AI Quiz Quality Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the quiz quality layer from a generic pre-publish checklist into a more specific assessment copilot that diagnoses coverage, timing, distractors, remediation readiness, and release risk while surfacing those insights prominently in the educator quiz maker.

**Architecture:** Extend the existing `build_quiz_quality_review()` service so it emits richer structured assessment-review signals without changing the route shape or quiz-maker flow. Then rebuild the quiz-quality panel in the educator authoring page so the AI review becomes a primary release gate with explicit sections for risk, Bloom balance, question health, and fix-first actions.

**Tech Stack:** FastAPI, Pydantic schemas, existing backend AI quality helpers, Next.js/React, Node contract tests, Python unittest.

---

### Task 1: Lock the richer quiz-quality contract with failing tests

**Files:**
- Modify: `backend/tests/test_ai_quiz_quality.py`
- Modify: `frontend/tests/quiz-quality-contract.test.mjs`

- [ ] **Step 1: Add backend expectations for richer assessment-copilot fields**

Add assertions that the review payload includes:
- `assessment_focus`
- `release_risk`
- `question_health`
- `fix_first`
- `remediation_plan`

Also add expectations that manual quizzes with weak distractors produce non-empty `question_health` and `fix_first` output.

- [ ] **Step 2: Run the backend test to verify it fails**

Run:

```bash
python3 -m unittest backend.tests.test_ai_quiz_quality -v
```

Expected: FAIL because the new response fields do not exist yet.

- [ ] **Step 3: Add frontend contract expectations for the stronger UI surfacing**

Update the quiz-quality contract test so it checks the panel/page for:
- `Assessment command`
- `Fix first`
- `Question health`
- `Remediation plan`
- `Release risk`

- [ ] **Step 4: Run the frontend contract test to verify it fails**

Run:

```bash
cd frontend && node --test tests/quiz-quality-contract.test.mjs
```

Expected: FAIL because the panel does not render those sections yet.

### Task 2: Upgrade backend quiz-quality intelligence

**Files:**
- Modify: `backend/app/services/quiz_quality.py`
- Modify: `backend/app/schemas/__init__.py`

- [ ] **Step 1: Expand the response schema**

Add focused structured models for:
- `QuizQualityQuestionHealth`
- `QuizQualityFixFirstItem`
- `QuizQualityRemediationStep`

Extend `QuizQualityReviewResponse` with:
- `assessment_focus`
- `release_risk`
- `question_health`
- `fix_first`
- `remediation_plan`

- [ ] **Step 2: Implement richer assessment logic in `build_quiz_quality_review()`**

Add logic that:
- infers the likely assessment purpose from timing, length, Bloom shape, and proctoring
- computes a release-risk label from issue severity
- builds per-question health summaries for manual quizzes
- identifies the top 2-3 fix-first actions
- produces a short remediation plan educators can use after release

- [ ] **Step 3: Re-run backend tests**

Run:

```bash
python3 -m unittest backend.tests.test_ai_quiz_quality -v
```

Expected: PASS

### Task 3: Rebuild the quiz-quality surface in the quiz maker

**Files:**
- Modify: `frontend/components/QuizQualityPanel.jsx`
- Modify: `frontend/pages/educator/quiz-maker.jsx`

- [ ] **Step 1: Make the panel feel like an explicit AI assessment workspace**

Refactor the panel so it highlights:
- assessment command / assessment focus
- release readiness + release risk
- fix-first checklist
- question-health cards
- remediation plan

Keep the existing score ring and issues list, but make them secondary to the more actionable AI guidance.

- [ ] **Step 2: Make the quiz maker surface the panel more prominently**

Update the educator quiz maker so the AI review reads like a named release gate rather than a side helper. Add stronger heading/description copy around the quiz-quality area if needed.

- [ ] **Step 3: Re-run frontend contract test**

Run:

```bash
cd frontend && node --test tests/quiz-quality-contract.test.mjs
```

Expected: PASS

### Task 4: Verify the slice

**Files:**
- Verify only

- [ ] **Step 1: Run backend verification**

```bash
python3 -m unittest backend.tests.test_ai_quiz_quality -v
```

Expected: PASS

- [ ] **Step 2: Run frontend verification**

```bash
cd frontend && node --test tests/quiz-quality-contract.test.mjs
```

Expected: PASS

- [ ] **Step 3: Run production build**

```bash
cd frontend && npm run build -- --no-lint
```

Expected: PASS
