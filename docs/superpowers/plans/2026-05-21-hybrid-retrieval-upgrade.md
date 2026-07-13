# Hybrid Retrieval Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strengthen VYDRA CORE’s material-grounded QA and quiz generation using smarter hybrid retrieval while keeping the current Supabase/Postgres + Qdrant setup and avoiding new embedding infrastructure.

**Architecture:** Keep Qdrant as the first-pass vector retriever and Postgres chunks as the lexical source of truth, but add multi-query retrieval, hybrid reranking, deduping, and diversity control in `document_context`. Then route QA and quiz generation through those stronger retrieval helpers so follow-up questions and quiz grounding improve immediately.

**Tech Stack:** FastAPI, SQLAlchemy, Qdrant HTTP API, existing hashed vector store, Groq answer generation, Node test runner for lightweight frontend route-state tests, Python `unittest`.

---

## File Structure

### Backend
- Modify: `backend/app/services/document_context.py`
  Add follow-up-aware query expansion, hybrid merge/rerank logic, and diversity-aware context selection.
- Modify: `backend/app/routers/qa.py`
  Pass conversation history deeper into retrieval and make answer generation use the improved retrieval helpers.
- Modify: `backend/app/routers/quiz.py`
  Pull more diverse, better-ranked contexts for question generation.
- Modify: `backend/app/agents/question_generator.py`
  Favor stronger source contexts and avoid over-reusing near-duplicate chunks.
- Create: `backend/tests/test_hybrid_retrieval.py`
  Unit tests for query expansion, stale follow-up handling, reranking, and diversity.

### Frontend
- No required feature/UI changes for this upgrade.

---

### Task 1: Add Hybrid Retrieval Unit Tests

**Files:**
- Create: `backend/tests/test_hybrid_retrieval.py`
- Test: `backend/tests/test_hybrid_retrieval.py`

- [ ] **Step 1: Write the failing tests**

Add tests for:
- query expansion from short follow-ups
- merging vector + lexical results without duplicates
- preferring diverse contexts over repeated near-identical chunks

- [ ] **Step 2: Run the tests to verify they fail**

Run: `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest backend.tests.test_hybrid_retrieval -v`

Expected: `ImportError` or assertion failures because the new helpers do not exist yet.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_hybrid_retrieval.py
git commit -m "test: add hybrid retrieval coverage"
```

### Task 2: Implement Query Expansion and Hybrid Reranking

**Files:**
- Modify: `backend/app/services/document_context.py`
- Test: `backend/tests/test_hybrid_retrieval.py`

- [ ] **Step 1: Add the new helper functions**

Implement focused helpers for:
- follow-up-aware query candidate expansion
- hybrid score calculation
- merging vector and lexical contexts
- diversity filtering and dedupe

- [ ] **Step 2: Run the tests to verify they pass**

Run: `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest backend.tests.test_hybrid_retrieval -v`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/document_context.py backend/tests/test_hybrid_retrieval.py
git commit -m "feat: add hybrid retrieval reranking"
```

### Task 3: Route QA Through the Stronger Retrieval Pipeline

**Files:**
- Modify: `backend/app/routers/qa.py`
- Test: `backend/tests/test_hybrid_retrieval.py`

- [ ] **Step 1: Add a QA-focused regression test**

Cover the follow-up case where a short query like `shorter` or `what about starvation?` should expand from conversation context before retrieval.

- [ ] **Step 2: Run the regression test to verify it fails**

Run: `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest backend.tests.test_hybrid_retrieval -v`

Expected: follow-up retrieval assertion fails before the router/helper wiring is updated.

- [ ] **Step 3: Update QA retrieval flow**

Make `build_answer_response()` and its retrieval helpers call the new hybrid retrieval path with conversation history included.

- [ ] **Step 4: Re-run the tests**

Run: `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest backend.tests.test_hybrid_retrieval -v`

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/qa.py backend/tests/test_hybrid_retrieval.py
git commit -m "feat: improve follow-up question retrieval"
```

### Task 4: Improve Quiz Grounding from Retrieved Chunks

**Files:**
- Modify: `backend/app/routers/quiz.py`
- Modify: `backend/app/agents/question_generator.py`

- [ ] **Step 1: Strengthen quiz context selection**

Retrieve a broader candidate pool and rely on the hybrid reranker to feed more diverse, less repetitive source contexts into question generation.

- [ ] **Step 2: Reduce duplicate-source question generation**

Adjust question generation to avoid repeatedly using near-identical source chunks when building multiple questions.

- [ ] **Step 3: Run regression verification**

Run: `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest backend.tests.test_classroom_module backend.tests.test_hybrid_retrieval -v`

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/quiz.py backend/app/agents/question_generator.py
git commit -m "feat: strengthen quiz grounding with hybrid retrieval"
```

### Task 5: Final Verification

**Files:**
- Modify: none expected unless verification reveals issues

- [ ] **Step 1: Run backend tests**

Run: `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest backend.tests.test_classroom_module backend.tests.test_hybrid_retrieval -v`

Expected: `OK`

- [ ] **Step 2: Run backend syntax verification**

Run: `PYTHONPYCACHEPREFIX=/private/tmp/pycache python3 -m py_compile backend/app/services/document_context.py backend/app/routers/qa.py backend/app/routers/quiz.py backend/app/agents/question_generator.py`

Expected: no output

- [ ] **Step 3: Run frontend build safety check**

Run: `npm run build`

Expected: successful Next build, with the known `eslint` warning if the repo still lacks `eslint`

