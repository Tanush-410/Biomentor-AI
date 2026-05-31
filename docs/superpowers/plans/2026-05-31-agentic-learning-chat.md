# Agentic Learning Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Learning Chat so it answers from uploaded PDFs first, automatically falls back to trusted web and then broader web when needed, and offers adaptive quick-check questions with simple feedback.

**Architecture:** Extend the existing FastAPI QA router with an answer orchestrator that combines document retrieval, trusted web retrieval, and broad web retrieval behind one response contract. Keep the existing Next.js Learning Chat page, but add answer-origin badges and an adaptive quick-check block so the feature feels native to the current study flow.

**Tech Stack:** FastAPI, SQLAlchemy, requests, Next.js 14, React 18, node:test, Python unittest

---

## File Map

- Create: `backend/app/services/web_retrieval.py`
  - Trusted-source and broad-web retrieval helpers
- Create: `backend/tests/test_agentic_learning_chat.py`
  - Backend coverage for answer orchestration and quick-check evaluation
- Modify: `backend/app/core/config.py`
  - Add trusted-domain config and fallback search tuning
- Modify: `backend/app/schemas/__init__.py`
  - Extend QA response schema and add quick-check request/response models
- Modify: `backend/app/routers/qa.py`
  - Add answer orchestration and quick-check evaluation endpoint
- Modify: `frontend/pages/learning-chat.jsx`
  - Render answer-origin badges, quick-check block, and targeted feedback
- Create: `frontend/components/QuickCheckCard.jsx`
  - Compact adaptive mini-test UI
- Create: `frontend/tests/learning-chat-agentic-contract.test.mjs`
  - Frontend contract checks for new chat affordances
- Modify: `backend/.env.example`
  - Document trusted search and web fallback env placeholders
- Modify: `README.md`
  - Document agentic topic search and adaptive quick checks

### Task 1: Extend QA schemas and config

**Files:**
- Modify: `backend/app/core/config.py`
- Modify: `backend/app/schemas/__init__.py`
- Test: `backend/tests/test_agentic_learning_chat.py`

- [ ] **Step 1: Write the failing backend schema/config tests**

```python
def test_answer_generation_response_exposes_agentic_fields(self):
    response = AnswerGenerationResponse(
        question="What is photosynthesis?",
        answer="Test answer",
        sources=[],
        confidence=0.72,
        answer_origin="material",
        complexity="moderate",
        show_quick_check=True,
        quick_check={
            "id": "qc-1",
            "title": "Quick Check",
            "questions": [],
        },
        generated_at=datetime.utcnow(),
    )
    self.assertEqual(response.answer_origin, "material")
    self.assertTrue(response.show_quick_check)


def test_settings_expose_trusted_search_domains(self):
    self.assertTrue(isinstance(settings.trusted_search_domains, list))
    self.assertGreater(len(settings.trusted_search_domains), 0)
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
python3 -m unittest backend.tests.test_agentic_learning_chat.AgenticLearningChatSchemaTests -v
```

Expected: FAIL because the schema fields and config entries do not exist yet.

- [ ] **Step 3: Write minimal schema and config support**

```python
class QuickCheckQuestionOption(BaseModel):
    id: str
    text: str


class QuickCheckQuestion(BaseModel):
    id: str
    prompt: str
    options: List[QuickCheckQuestionOption]


class QuickCheckPayload(BaseModel):
    id: str
    title: str
    questions: List[QuickCheckQuestion]


class AnswerGenerationResponse(BaseModel):
    question: str
    answer: str
    sources: List[SourceReference]
    confidence: float
    answer_origin: str = "material"
    complexity: str = "simple"
    show_quick_check: bool = False
    quick_check: Optional[QuickCheckPayload] = None
    generated_at: datetime
```

```python
trusted_search_domains: List[str] = Field(
    default_factory=lambda: [
        "khanacademy.org",
        "britannica.com",
        "nih.gov",
        "nasa.gov",
        "edu",
    ]
)
web_fallback_top_k: int = 4
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
python3 -m unittest backend.tests.test_agentic_learning_chat.AgenticLearningChatSchemaTests -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/config.py backend/app/schemas/__init__.py backend/tests/test_agentic_learning_chat.py
git commit -m "feat: extend qa schemas for agentic chat"
```

### Task 2: Add trusted and broad web retrieval service

**Files:**
- Create: `backend/app/services/web_retrieval.py`
- Test: `backend/tests/test_agentic_learning_chat.py`

- [ ] **Step 1: Write the failing retrieval tests**

```python
def test_ranked_web_retrieval_prefers_trusted_domains(self):
    results = rank_web_results(
        query="cell respiration",
        trusted_domains=["nih.gov"],
        candidates=[
            {"title": "Random blog", "url": "https://example.com/post", "content": "blog"},
            {"title": "NIH overview", "url": "https://www.nih.gov/test", "content": "trusted"},
        ],
    )
    self.assertEqual(results[0]["source_type"], "trusted_web")


def test_broad_retrieval_runs_when_trusted_results_are_empty(self):
    client = FakeWebSearchClient(trusted_results=[], broad_results=[{"title": "Fallback", "url": "https://example.com", "content": "fallback"}])
    trusted, broad = retrieve_web_contexts(client, "osmosis", ["nih.gov"])
    self.assertEqual(trusted, [])
    self.assertEqual(len(broad), 1)
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
python3 -m unittest backend.tests.test_agentic_learning_chat.AgenticLearningChatRetrievalTests -v
```

Expected: FAIL because the retrieval module and helpers do not exist yet.

- [ ] **Step 3: Write the minimal retrieval service**

```python
def normalize_web_result(item, source_type):
    return {
        "title": item["title"],
        "url": item["url"],
        "content": item["content"],
        "source_type": source_type,
        "excerpt": item["content"][:220],
    }


def rank_web_results(query, trusted_domains, candidates):
    ranked = []
    for item in candidates:
        source_type = "trusted_web" if any(domain in item["url"] for domain in trusted_domains) else "broader_web"
        ranked.append(normalize_web_result(item, source_type))
    return sorted(ranked, key=lambda item: 0 if item["source_type"] == "trusted_web" else 1)
```

```python
def retrieve_web_contexts(search_client, query, trusted_domains):
    trusted = rank_web_results(query, trusted_domains, search_client.search_trusted(query))
    if trusted:
        return trusted, []
    broad = rank_web_results(query, trusted_domains, search_client.search_broad(query))
    return [], broad
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
python3 -m unittest backend.tests.test_agentic_learning_chat.AgenticLearningChatRetrievalTests -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/web_retrieval.py backend/tests/test_agentic_learning_chat.py
git commit -m "feat: add web retrieval service for qa fallback"
```

### Task 3: Add answer orchestration with PDF-first and web fallback

**Files:**
- Modify: `backend/app/routers/qa.py`
- Modify: `backend/tests/test_agentic_learning_chat.py`

- [ ] **Step 1: Write the failing orchestration tests**

```python
def test_answer_origin_is_material_when_document_context_is_sufficient(self):
    response = build_answer_response(self.db, self.user, self.request, retrieve_fn=lambda *args, **kwargs: [self.document_context], web_search_fn=self.empty_web)
    self.assertEqual(response.answer_origin, "material")
    self.assertFalse(response.show_quick_check)


def test_answer_origin_is_web_enhanced_when_document_context_is_missing(self):
    response = build_answer_response(self.db, self.user, self.request, retrieve_fn=lambda *args, **kwargs: [], web_search_fn=self.web_search)
    self.assertEqual(response.answer_origin, "web_enhanced")
    self.assertGreaterEqual(len(response.sources), 1)
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
python3 -m unittest backend.tests.test_agentic_learning_chat.AgenticLearningChatAnswerTests -v
```

Expected: FAIL because `build_answer_response` does not orchestrate web fallback or answer origin yet.

- [ ] **Step 3: Write the minimal orchestration**

```python
def build_answer_response(db, current_user, request, retrieve_fn=_retrieve_for_question, web_search_fn=retrieve_web_contexts):
    contexts = retrieve_fn(...)
    answer_origin = "material"
    web_contexts = []

    if not contexts:
        trusted, broad = web_search_fn(_default_search_client(), request.question, settings.trusted_search_domains)
        web_contexts = trusted or broad
        contexts = web_contexts
        answer_origin = "trusted_web" if trusted else "web_enhanced"

    answer_text, confidence = _generate_answer_from_context(request.question, contexts, conversation_history)
    complexity = _estimate_complexity(request.question, answer_text, confidence)
    quick_check = _build_quick_check(request.question, contexts, answer_text) if _should_offer_quick_check(confidence, complexity) else None
    return AnswerGenerationResponse(...)
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
python3 -m unittest backend.tests.test_agentic_learning_chat.AgenticLearningChatAnswerTests -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/qa.py backend/tests/test_agentic_learning_chat.py
git commit -m "feat: add agentic answer orchestration"
```

### Task 4: Add quick-check grading endpoint and targeted feedback

**Files:**
- Modify: `backend/app/routers/qa.py`
- Modify: `backend/app/schemas/__init__.py`
- Test: `backend/tests/test_agentic_learning_chat.py`

- [ ] **Step 1: Write the failing quick-check evaluation tests**

```python
def test_quick_check_evaluation_returns_score_and_next_step(self):
    payload = QuickCheckEvaluationRequest(
        quick_check_id="qc-1",
        questions=[
            {"question_id": "q1", "selected_option_id": "a"},
            {"question_id": "q2", "selected_option_id": "b"},
        ],
    )
    response = evaluate_quick_check(payload, quick_check=self.quick_check_payload)
    self.assertEqual(response.score, 1)
    self.assertEqual(response.total_questions, 2)
    self.assertTrue(response.next_step)
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
python3 -m unittest backend.tests.test_agentic_learning_chat.AgenticLearningChatQuickCheckTests -v
```

Expected: FAIL because grading models and endpoint do not exist yet.

- [ ] **Step 3: Write the minimal grading implementation**

```python
@router.post("/quick-check/evaluate", response_model=QuickCheckEvaluationResponse)
async def evaluate_quick_check_route(request: QuickCheckEvaluationRequest, ...):
    return evaluate_quick_check(request, lookup_quick_check(request.quick_check_id))
```

```python
def evaluate_quick_check(request, quick_check):
    graded = []
    score = 0
    for question in quick_check["questions"]:
        selected = request.answers_by_question[question["id"]]
        correct = selected == question["correct_option_id"]
        score += int(correct)
        graded.append({...})
    return QuickCheckEvaluationResponse(score=score, total_questions=len(quick_check["questions"]), results=graded, next_step=_suggest_next_step(score, len(quick_check["questions"])))
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
python3 -m unittest backend.tests.test_agentic_learning_chat.AgenticLearningChatQuickCheckTests -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/qa.py backend/app/schemas/__init__.py backend/tests/test_agentic_learning_chat.py
git commit -m "feat: add quick check evaluation flow"
```

### Task 5: Update Learning Chat UI for origin badges and quick checks

**Files:**
- Create: `frontend/components/QuickCheckCard.jsx`
- Modify: `frontend/pages/learning-chat.jsx`
- Create: `frontend/tests/learning-chat-agentic-contract.test.mjs`

- [ ] **Step 1: Write the failing frontend contract tests**

```javascript
test('learning chat renders answer origin badges', () => {
  const source = fs.readFileSync(new URL('../pages/learning-chat.jsx', import.meta.url), 'utf8')
  assert.match(source, /Answered from your material|Enhanced with trusted web sources|Enhanced with web sources/)
})

test('learning chat uses QuickCheckCard for adaptive checks', () => {
  const source = fs.readFileSync(new URL('../pages/learning-chat.jsx', import.meta.url), 'utf8')
  assert.match(source, /QuickCheckCard/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
node --test frontend/tests/learning-chat-agentic-contract.test.mjs
```

Expected: FAIL because the badge copy and component do not exist yet.

- [ ] **Step 3: Write the minimal frontend implementation**

```jsx
<p className="text-xs font-semibold uppercase tracking-wide text-[#8a5a36]">
  {message.answerOrigin === 'material'
    ? 'Answered from your material'
    : message.answerOrigin === 'trusted_web'
      ? 'Enhanced with trusted web sources'
      : 'Enhanced with web sources'}
</p>
```

```jsx
{message.quickCheck ? (
  <QuickCheckCard
    quickCheck={message.quickCheck}
    token={token}
    onEvaluated={(feedback) => attachFeedbackToMessage(message.id, feedback)}
  />
) : null}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
node --test frontend/tests/learning-chat-agentic-contract.test.mjs
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/components/QuickCheckCard.jsx frontend/pages/learning-chat.jsx frontend/tests/learning-chat-agentic-contract.test.mjs
git commit -m "feat: add adaptive quick checks to learning chat"
```

### Task 6: Update docs and run full verification

**Files:**
- Modify: `backend/.env.example`
- Modify: `README.md`

- [ ] **Step 1: Add env placeholders and README notes**

```env
TRUSTED_SEARCH_DOMAINS=khanacademy.org,britannica.com,nih.gov,nasa.gov,edu
WEB_FALLBACK_TOP_K=4
```

```md
- Agentic Learning Chat answers from uploaded material first, then falls back to trusted web sources when needed.
- Complex or low-confidence topics trigger adaptive Quick Check questions with simple targeted feedback.
```

- [ ] **Step 2: Run backend tests**

Run:
```bash
python3 -m unittest backend.tests.test_agentic_learning_chat backend.tests.test_hybrid_retrieval -v
```

Expected: PASS

- [ ] **Step 3: Run frontend tests**

Run:
```bash
node --test frontend/tests/learning-chat-agentic-contract.test.mjs frontend/tests/landing-page-content.test.mjs frontend/tests/quiz-session-contract.test.mjs
```

Expected: PASS

- [ ] **Step 4: Run production build**

Run:
```bash
cd frontend && npm run build
```

Expected: PASS with only the usual non-blocking warnings about ESLint or offline Google Fonts if they appear.

- [ ] **Step 5: Commit**

```bash
git add backend/.env.example README.md
git commit -m "docs: document agentic learning chat"
```

## Self-Review

- Spec coverage:
  - PDF-first answering: Task 3
  - trusted and broader web fallback: Tasks 2 and 3
  - adaptive mini-tests: Tasks 3, 4, and 5
  - targeted feedback: Task 4
  - chat UI integration: Task 5
  - docs/config updates: Task 6
- Placeholder scan:
  - no `TODO`, `TBD`, or implicit “add validation later” placeholders remain
- Type consistency:
  - `quick_check`, `answer_origin`, and `complexity` are defined in Task 1 and used consistently in Tasks 3 through 5

