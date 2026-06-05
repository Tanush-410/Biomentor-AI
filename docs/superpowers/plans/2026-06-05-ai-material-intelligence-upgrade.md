# AI Material Intelligence Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade AI Material Intelligence from a summary/glossary helper into a differentiated study engine with layered summaries, concept maps, exam-oriented cues, misconception traps, viva questions, and stronger frontend surfacing.

**Architecture:** Extend the backend material intelligence service to produce richer structured study outputs with conservative evidence-aware fallbacks, then expand the document API contract and replace the current lightweight panel with a more prominent multi-section workspace on both the materials list and document detail pages. Preserve current Groq-backed generation where available, but add stronger schema handling and deterministic fallbacks so the feature remains useful without AI responses.

**Tech Stack:** FastAPI, SQLAlchemy-backed document context retrieval, Groq JSON generation, React/Next.js, existing AppShell/card UI patterns, Node contract tests, Python unittest.

---

### Task 1: Expand the backend response contract for richer study outputs

**Files:**
- Modify: `backend/app/schemas/__init__.py`
- Test: `backend/tests/test_ai_material_intelligence.py`

- [ ] **Step 1: Write the failing backend schema/service test**

Add assertions to `backend/tests/test_ai_material_intelligence.py` so the payload must include the new fields:

```python
        self.assertIn("layered_summaries", payload)
        self.assertIn("concept_map", payload)
        self.assertIn("misconception_traps", payload)
        self.assertIn("viva_questions", payload)
        self.assertIn("study_path", payload)
        self.assertTrue(payload["layered_summaries"]["quick"])
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd backend && python3 -m unittest backend.tests.test_ai_material_intelligence -v
```

Expected:
- FAIL because the current payload does not expose those fields

- [ ] **Step 3: Extend the response models**

Update `backend/app/schemas/__init__.py` by introducing nested models used by `MaterialIntelligenceResponse`, for example:

```python
class MaterialLayeredSummaries(BaseModel):
    quick: str
    standard: str
    exam_focus: str


class MaterialConceptNode(BaseModel):
    label: str
    importance: str
    connects_to: List[str] = []


class MaterialTrapItem(BaseModel):
    concept: str
    trap: str
    correction: str


class MaterialVivaQuestion(BaseModel):
    question: str
    expected_focus: str


class MaterialStudyStep(BaseModel):
    label: str
    reason: str


class MaterialIntelligenceResponse(BaseModel):
    document_id: str
    document_title: str
    summary: str
    layered_summaries: MaterialLayeredSummaries
    revision_bullets: List[str] = []
    glossary: List[GlossaryItem] = []
    flashcards: List[FlashcardItem] = []
    follow_up_prompts: List[str] = []
    prerequisite_warning: Optional[str] = None
    concepts: List[ConceptInsight] = []
    key_pages: List[KeyPageInsight] = []
    concept_map: List[MaterialConceptNode] = []
    misconception_traps: List[MaterialTrapItem] = []
    viva_questions: List[MaterialVivaQuestion] = []
    study_path: List[MaterialStudyStep] = []
    confidence: Optional[str] = None
    confidence_reason: Optional[str] = None
```

- [ ] **Step 4: Run the backend schema test again**

Run:

```bash
cd backend && python3 -m unittest backend.tests.test_ai_material_intelligence -v
```

Expected:
- still FAIL, but now because the service does not yet build the new fields

- [ ] **Step 5: Commit the schema contract step**

```bash
git add backend/app/schemas/__init__.py backend/tests/test_ai_material_intelligence.py
git commit -m "test: expand material intelligence response contract"
```

### Task 2: Upgrade backend material intelligence generation and fallback logic

**Files:**
- Modify: `backend/app/services/material_intelligence.py`
- Test: `backend/tests/test_ai_material_intelligence.py`

- [ ] **Step 1: Write the failing behavior tests for richer outputs**

Add tests to `backend/tests/test_ai_material_intelligence.py` that require structured richness from fallback behavior:

```python
    def test_material_intelligence_builds_layered_outputs_from_context(self):
        payload = build_material_intelligence(
            {"id": "doc-1", "title": "Cell Biology Notes"},
            [
                {
                    "content": "Mitochondria produce ATP for cellular energy. Ribosomes build proteins. Enzymes lower activation energy.",
                    "document_id": "doc-1",
                    "document_title": "Cell Biology Notes",
                    "page_number": 2,
                    "chunk_index": 0,
                    "relevance_score": 0.9,
                }
            ],
        )
        self.assertGreaterEqual(len(payload["concept_map"]), 1)
        self.assertGreaterEqual(len(payload["misconception_traps"]), 1)
        self.assertGreaterEqual(len(payload["viva_questions"]), 1)
        self.assertGreaterEqual(len(payload["study_path"]), 1)
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd backend && python3 -m unittest backend.tests.test_ai_material_intelligence.MaterialIntelligenceServiceTest.test_material_intelligence_builds_layered_outputs_from_context -v
```

Expected:
- FAIL because the current service does not return those structures

- [ ] **Step 3: Expand the AI prompt and fallback builders**

In `backend/app/services/material_intelligence.py`, replace the current narrow JSON shape with a richer one and implement deterministic fallback builders. The service should return a dict shaped like:

```python
{
    "summary": "...",
    "layered_summaries": {
        "quick": "...",
        "standard": "...",
        "exam_focus": "...",
    },
    "revision_bullets": [...],
    "glossary": [...],
    "flashcards": [...],
    "follow_up_prompts": [...],
    "prerequisite_warning": "...",
    "concepts": [...],
    "key_pages": [...],
    "concept_map": [
        {"label": "Mitochondria", "importance": "core", "connects_to": ["ATP"]},
    ],
    "misconception_traps": [
        {
            "concept": "Mitochondria",
            "trap": "Treating mitochondria as only a label, not an energy process",
            "correction": "Tie mitochondria to ATP production and cellular energy transfer",
        }
    ],
    "viva_questions": [
        {"question": "Why are mitochondria important in cell biology?", "expected_focus": "ATP and energy transfer"}
    ],
    "study_path": [
        {"label": "Learn the glossary first", "reason": "The topic is concept dense"},
        {"label": "Review the ATP section", "reason": "It anchors later ideas"},
    ],
}
```

Update `_generate_with_ai()` so the prompt returns:

```python
Return this shape:
{
  "summary": "...",
  "layered_summaries": {
    "quick": "...",
    "standard": "...",
    "exam_focus": "..."
  },
  "revision_bullets": ["..."],
  "glossary": [{"term": "...", "meaning": "..."}],
  "flashcards": [{"prompt": "...", "answer": "..."}],
  "follow_up_prompts": ["..."],
  "prerequisite_warning": "...",
  "concept_map": [{"label": "...", "importance": "core|supporting", "connects_to": ["..."]}],
  "misconception_traps": [{"concept": "...", "trap": "...", "correction": "..."}],
  "viva_questions": [{"question": "...", "expected_focus": "..."}],
  "study_path": [{"label": "...", "reason": "..."}]
}
```

Add helper builders such as:

```python
def _build_layered_summaries(...): ...
def _build_concept_map(...): ...
def _build_misconception_traps(...): ...
def _build_viva_questions(...): ...
def _build_study_path(...): ...
```

- [ ] **Step 4: Run the backend material intelligence suite**

Run:

```bash
cd backend && python3 -m unittest backend.tests.test_ai_material_intelligence -v
```

Expected:
- PASS

- [ ] **Step 5: Commit the backend service upgrade**

```bash
git add backend/app/services/material_intelligence.py backend/tests/test_ai_material_intelligence.py
git commit -m "feat: deepen material intelligence study outputs"
```

### Task 3: Return the richer material intelligence payload through the documents API

**Files:**
- Modify: `backend/app/routers/documents.py`
- Test: `backend/tests/test_ai_material_intelligence.py`

- [ ] **Step 1: Add a route-level assertion for new response fields**

Extend the route test with:

```python
    def test_material_intelligence_route_exists(self):
        client = TestClient(app)
        response = client.get("/api/documents/example/material-intelligence")
        self.assertNotEqual(response.status_code, 404)
```

and add a schema serialization smoke test:

```python
    def test_material_intelligence_response_model_accepts_new_fields(self):
        payload = MaterialIntelligenceResponse(
            document_id="doc-1",
            document_title="Cell Biology Notes",
            summary="...",
            layered_summaries={"quick": "...", "standard": "...", "exam_focus": "..."},
            concept_map=[{"label": "ATP", "importance": "core", "connects_to": ["Energy"]}],
            misconception_traps=[{"concept": "ATP", "trap": "...", "correction": "..."}],
            viva_questions=[{"question": "...", "expected_focus": "..."}],
            study_path=[{"label": "...", "reason": "..."}],
        )
        self.assertEqual(payload.document_id, "doc-1")
```

- [ ] **Step 2: Run the test to verify it fails if router/response are stale**

Run:

```bash
cd backend && python3 -m unittest backend.tests.test_ai_material_intelligence.MaterialIntelligenceRouteTest -v
```

Expected:
- FAIL until the router returns the expanded fields

- [ ] **Step 3: Map the new service payload into the API response**

Update `backend/app/routers/documents.py` so `get_material_intelligence()` returns the new fields:

```python
    return MaterialIntelligenceResponse(
        document_id=document.id,
        document_title=document.title,
        summary=payload["summary"],
        layered_summaries=payload["layered_summaries"],
        revision_bullets=payload.get("revision_bullets", []),
        glossary=payload.get("glossary", []),
        flashcards=payload.get("flashcards", []),
        follow_up_prompts=payload.get("follow_up_prompts", []),
        prerequisite_warning=payload.get("prerequisite_warning"),
        concepts=payload.get("concepts", []),
        key_pages=payload.get("key_pages", []),
        concept_map=payload.get("concept_map", []),
        misconception_traps=payload.get("misconception_traps", []),
        viva_questions=payload.get("viva_questions", []),
        study_path=payload.get("study_path", []),
        confidence=payload.get("confidence"),
        confidence_reason=payload.get("confidence_reason"),
    )
```

- [ ] **Step 4: Re-run the route tests**

Run:

```bash
cd backend && python3 -m unittest backend.tests.test_ai_material_intelligence -v
```

Expected:
- PASS

- [ ] **Step 5: Commit the API step**

```bash
git add backend/app/routers/documents.py backend/tests/test_ai_material_intelligence.py
git commit -m "feat: expose richer material intelligence API payload"
```

### Task 4: Redesign the Material Intelligence panel into a real study workspace

**Files:**
- Modify: `frontend/components/MaterialIntelligencePanel.jsx`
- Test: `frontend/tests/material-intelligence-contract.test.mjs`

- [ ] **Step 1: Add the failing frontend contract expectations**

Extend `frontend/tests/material-intelligence-contract.test.mjs` so it checks for the new major sections:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('MaterialIntelligencePanel exposes advanced study sections', () => {
  const source = fs.readFileSync(new URL('../components/MaterialIntelligencePanel.jsx', import.meta.url), 'utf8')
  assert.match(source, /Concept map/i)
  assert.match(source, /Misconception traps/i)
  assert.match(source, /Viva questions/i)
  assert.match(source, /Study path/i)
})
```

- [ ] **Step 2: Run the frontend contract test to verify it fails**

Run:

```bash
cd frontend && node --test tests/material-intelligence-contract.test.mjs
```

Expected:
- FAIL because the current panel only shows summary, bullets, glossary, prompts, and flashcards

- [ ] **Step 3: Replace the panel layout with a stronger study workspace**

Refactor `frontend/components/MaterialIntelligencePanel.jsx` to render:

```jsx
<div className="card p-6">
  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
    ...
  </div>

  <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
    <section>{/* Layered summaries */}</section>
    <aside>{/* Confidence + prerequisite + study path */}</aside>
  </div>

  <div className="mt-6 grid gap-6 lg:grid-cols-2">
    <section>{/* Concept map */}</section>
    <section>{/* Misconception traps */}</section>
  </div>

  <div className="mt-6 grid gap-6 lg:grid-cols-2">
    <section>{/* Viva questions */}</section>
    <section>{/* Flashcards + follow-up prompts */}</section>
  </div>
</div>
```

Key UI behaviors:
- prominent layered summary trio: quick, standard, exam focus
- visible `Study Path` section with numbered actions
- visible `Concept Map` and `Misconception Traps`
- less subtle title treatment so it reads like a major AI workspace

- [ ] **Step 4: Re-run the contract test**

Run:

```bash
cd frontend && node --test tests/material-intelligence-contract.test.mjs
```

Expected:
- PASS

- [ ] **Step 5: Commit the panel redesign**

```bash
git add frontend/components/MaterialIntelligencePanel.jsx frontend/tests/material-intelligence-contract.test.mjs
git commit -m "feat: redesign material intelligence study workspace"
```

### Task 5: Make Material Intelligence more prominent on the materials list page

**Files:**
- Modify: `frontend/pages/documents.jsx`
- Test: `frontend/tests/material-intelligence-contract.test.mjs`

- [ ] **Step 1: Add a failing contract for stronger page-level surfacing**

Append checks to `frontend/tests/material-intelligence-contract.test.mjs`:

```js
test('documents page gives material intelligence a primary entry point', () => {
  const source = fs.readFileSync(new URL('../pages/documents.jsx', import.meta.url), 'utf8')
  assert.match(source, /Material Intelligence Preview/i)
  assert.match(source, /Review With Material Intelligence/i)
})
```

- [ ] **Step 2: Run the contract test to verify it fails**

Run:

```bash
cd frontend && node --test tests/material-intelligence-contract.test.mjs
```

Expected:
- FAIL because the page does not yet use those labels or hierarchy

- [ ] **Step 3: Add a stronger list-page AI surface**

Update `frontend/pages/documents.jsx` so the first visible AI section becomes a named preview module:

```jsx
<section className="card p-8">
  <div className="flex items-center justify-between gap-4">
    <div>
      <p className="section-kicker text-[#8a5a36]">AI Study Engine</p>
      <h2 className="text-2xl font-bold text-slate-900">Material Intelligence Preview</h2>
      <p className="text-slate-600">See what this material is really about before you open it.</p>
    </div>
    {documents[0] ? <Link href={`/document/${documents[0].id}`} className="btn btn-primary">Review With Material Intelligence</Link> : null}
  </div>
  <div className="mt-6">
    <MaterialIntelligencePanel intelligence={materialIntelligence} title="Preview the strongest concepts, traps, and viva prompts" actionHref={documents[0] ? `/document/${documents[0].id}` : undefined} actionLabel="Open Full Study View" />
  </div>
</section>
```

- [ ] **Step 4: Re-run the contract test**

Run:

```bash
cd frontend && node --test tests/material-intelligence-contract.test.mjs
```

Expected:
- PASS

- [ ] **Step 5: Commit the materials-page surfacing step**

```bash
git add frontend/pages/documents.jsx frontend/tests/material-intelligence-contract.test.mjs
git commit -m "feat: promote material intelligence on materials page"
```

### Task 6: Make Material Intelligence the main AI workspace on the document detail page

**Files:**
- Modify: `frontend/pages/document/[id].jsx`
- Test: `frontend/tests/material-intelligence-contract.test.mjs`

- [ ] **Step 1: Add a failing contract for document-page prominence**

Append checks:

```js
test('document study page treats material intelligence as a primary workspace', () => {
  const source = fs.readFileSync(new URL('../pages/document/[id].jsx', import.meta.url), 'utf8')
  assert.match(source, /Material Intelligence Workspace/i)
  assert.match(source, /Ask Learning Chat/i)
  assert.match(source, /Generate Quiz From This Material/i)
})
```

- [ ] **Step 2: Run the contract test to verify it fails**

Run:

```bash
cd frontend && node --test tests/material-intelligence-contract.test.mjs
```

Expected:
- FAIL because the current document page presents the feature more quietly

- [ ] **Step 3: Reframe the document page around the upgraded AI workspace**

Update `frontend/pages/document/[id].jsx` so the AI section becomes a headline module above or alongside the viewer:

```jsx
<section className="card p-8">
  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
    <div>
      <p className="section-kicker text-[#8a5a36]">AI Study Engine</p>
      <h2 className="text-3xl font-bold text-slate-950">Material Intelligence Workspace</h2>
      <p className="mt-2 text-slate-600">Break this document into concepts, traps, viva prompts, and the best order to study it.</p>
    </div>
    <div className="flex flex-wrap gap-3">
      <Link href="/learning-chat" className="btn btn-outline">Ask Learning Chat</Link>
      <button type="button" onClick={handleStartQuiz} className="btn btn-primary">Generate Quiz From This Material</button>
    </div>
  </div>
  <div className="mt-6">
    <MaterialIntelligencePanel intelligence={materialIntelligence} title="Use the document as an exam-focused study engine" />
  </div>
</section>
```

- [ ] **Step 4: Run the frontend contract test**

Run:

```bash
cd frontend && node --test tests/material-intelligence-contract.test.mjs
```

Expected:
- PASS

- [ ] **Step 5: Commit the document-page surfacing step**

```bash
git add 'frontend/pages/document/[id].jsx' frontend/tests/material-intelligence-contract.test.mjs
git commit -m "feat: center material intelligence in study view"
```

### Task 7: Verify the full slice end to end

**Files:**
- Test: `backend/tests/test_ai_material_intelligence.py`
- Test: `frontend/tests/material-intelligence-contract.test.mjs`

- [ ] **Step 1: Run backend verification**

Run:

```bash
cd backend && python3 -m unittest backend.tests.test_ai_material_intelligence -v
```

Expected:
- PASS

- [ ] **Step 2: Run frontend contract verification**

Run:

```bash
cd frontend && node --test tests/material-intelligence-contract.test.mjs
```

Expected:
- PASS

- [ ] **Step 3: Run a production build**

Run:

```bash
cd frontend && npm run build -- --no-lint
```

Expected:
- PASS

- [ ] **Step 4: Commit the verified slice**

```bash
git add backend/tests/test_ai_material_intelligence.py frontend/tests/material-intelligence-contract.test.mjs
git commit -m "test: verify upgraded material intelligence slice"
```
