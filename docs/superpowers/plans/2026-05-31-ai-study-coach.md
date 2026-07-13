# AI Study Coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a student-facing AI Study Coach that guides learners across Dashboard, Progress, Materials, and Learning Chat using live quiz, material, and chat signals.

**Architecture:** Add one shared backend study-coach service that aggregates student learning signals and exposes focused endpoints for each student page. Keep frontend surfaces thin by rendering those shared payloads as student-specific coaching panels and recommendation cards.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, Next.js pages router, React 18, existing VYDRA CORE auth/API patterns, Node contract tests, Python unittest

---

### Task 1: Add study coach schemas and failing backend tests

**Files:**
- Create: `backend/tests/test_ai_study_coach.py`
- Modify: `backend/app/schemas/__init__.py`

- [ ] **Step 1: Write the failing backend tests**

```python
class StudyCoachServiceTest(unittest.TestCase):
    def test_overview_payload_prioritizes_next_action_and_short_plan(self):
        payload = build_study_coach_overview(
            progress_payload={
                "averageScore": 58,
                "totalQuizzes": 3,
                "totalQuestionsAnswered": 18,
                "bloomLevelStats": {
                    4: {"name": "Analyze", "count": 8, "average": 42},
                    2: {"name": "Understand", "count": 5, "average": 64},
                },
                "recentQuizzes": [],
            },
            recommendations={
                "immediate": ["Review Analyze questions first."],
                "short_term": ["Retry a Bloom quiz tomorrow."],
                "next_steps": ["Ask Learning Chat to compare two concepts."]
            },
            documents=[],
        )
        self.assertIn("next_action", payload)
        self.assertGreaterEqual(len(payload["short_plan"]), 2)
```

```python
class StudyCoachRouteTest(unittest.TestCase):
    def test_study_coach_routes_exist(self):
        client = TestClient(app)
        self.assertNotEqual(client.get("/api/study-coach/overview").status_code, 404)
        self.assertNotEqual(client.get("/api/study-coach/progress").status_code, 404)
        self.assertNotEqual(client.get("/api/study-coach/materials").status_code, 404)
        self.assertNotEqual(client.get("/api/study-coach/chat-suggestions").status_code, 404)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m unittest backend.tests.test_ai_study_coach -v`
Expected: FAIL because the study coach service/functions and schemas do not exist yet.

- [ ] **Step 3: Add minimal study coach schemas**

```python
class StudyCoachAction(BaseModel):
    label: str
    reason: str
    target_url: Optional[str] = None


class StudyCoachOverviewResponse(BaseModel):
    next_action: str
    rationale: str
    short_plan: List[StudyCoachAction] = Field(default_factory=list)
    weak_focus_areas: List[str] = Field(default_factory=list)


class StudyCoachProgressResponse(BaseModel):
    summary: str
    practice_order: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)


class StudyCoachMaterialRecommendation(BaseModel):
    document_id: str
    title: str
    suggested_action: str
    reason: str


class StudyCoachMaterialsResponse(BaseModel):
    recommendations: List[StudyCoachMaterialRecommendation] = Field(default_factory=list)


class StudyCoachChatSuggestionsResponse(BaseModel):
    follow_up_prompts: List[str] = Field(default_factory=list)
    quick_check_guidance: Optional[str] = None
    next_step: Optional[str] = None
```

- [ ] **Step 4: Run backend test again**

Run: `python3 -m unittest backend.tests.test_ai_study_coach -v`
Expected: still FAIL, but now due to missing study-coach service/route logic instead of missing schema types.

- [ ] **Step 5: Commit**

```bash
git add backend/tests/test_ai_study_coach.py backend/app/schemas/__init__.py
git commit -m "test: add study coach backend contract coverage"
```

### Task 2: Build the shared Study Coach backend service

**Files:**
- Create: `backend/app/services/study_coach.py`
- Modify: `backend/tests/test_ai_study_coach.py`

- [ ] **Step 1: Expand failing tests for service behavior**

```python
def test_material_recommendation_prefers_uploaded_pdf_when_gaps_exist(self):
    payload = build_study_coach_materials_payload(
        documents=[{"id": "doc-1", "title": "Cell Biology Notes", "file_name": "cell.pdf"}],
        gap_list=[{"level": "Analyze", "gap_percentage": 58.0}],
    )
    self.assertEqual(payload["recommendations"][0]["document_id"], "doc-1")
```

```python
def test_chat_suggestions_offer_follow_up_prompts_and_quick_check_guidance(self):
    payload = build_study_coach_chat_payload(
        gap_list=[{"level": "Analyze", "gap_percentage": 58.0}],
        documents=[{"id": "doc-1", "title": "Cell Biology Notes"}],
    )
    self.assertTrue(payload["follow_up_prompts"])
    self.assertIn("Quick Check", payload["quick_check_guidance"])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m unittest backend.tests.test_ai_study_coach -v`
Expected: FAIL because the service helpers do not exist yet.

- [ ] **Step 3: Write the minimal study coach service**

```python
def build_study_coach_overview(progress_payload, recommendations, documents):
    gap_list = build_gap_list(progress_payload)
    top_gap = gap_list[0]["level"] if gap_list else "your next quiz set"
    return {
        "next_action": f"Focus on {top_gap} next.",
        "rationale": "This is your weakest recent Bloom level and will improve score fastest.",
        "short_plan": [
            {"label": "Review material", "reason": "Refresh the concept before practice.", "target_url": "/documents"},
            {"label": "Ask Learning Chat", "reason": "Clarify the weak concept with your own material.", "target_url": "/learning-chat"},
            {"label": "Take a quiz", "reason": "Check whether the gap improved.", "target_url": "/start-quiz"},
        ],
        "weak_focus_areas": [gap["level"] for gap in gap_list[:3]],
    }
```

```python
def build_study_coach_progress_payload(progress_payload):
    gap_list = build_gap_list(progress_payload)
    practice_order = [gap["level"] for gap in gap_list[:3]]
    return {
        "summary": "Your coach wants you to improve lower-mastery Bloom levels before moving up in difficulty.",
        "practice_order": practice_order,
        "recommendations": [
            f"Practice {level} questions next." for level in practice_order
        ],
    }
```

```python
def build_study_coach_materials_payload(documents, gap_list):
    if not documents:
        return {"recommendations": []}
    top_gap = gap_list[0]["level"] if gap_list else "Study Review"
    first = documents[0]
    return {
        "recommendations": [
            {
                "document_id": str(first["id"]),
                "title": first["title"],
                "suggested_action": "Review then ask a focused chat question",
                "reason": f"This is the fastest material to revisit before another {top_gap} round.",
            }
        ]
    }
```

```python
def build_study_coach_chat_payload(gap_list, documents):
    topic = gap_list[0]["level"] if gap_list else "your next concept"
    title = documents[0]["title"] if documents else "your uploaded material"
    return {
        "follow_up_prompts": [
            f"Explain {topic} in simpler terms.",
            f"Compare the hardest part of {topic} with an easier example.",
        ],
        "quick_check_guidance": f"Use Quick Check after reviewing {title}.",
        "next_step": f"Ask one focused follow-up about {topic}, then test yourself.",
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m unittest backend.tests.test_ai_study_coach -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/study_coach.py backend/tests/test_ai_study_coach.py
git commit -m "feat: add study coach backend service"
```

### Task 3: Add Study Coach API routes

**Files:**
- Modify: `backend/app/routers/learning.py`
- Modify: `backend/tests/test_ai_study_coach.py`

- [ ] **Step 1: Extend route tests with payload expectations**

```python
def test_study_coach_routes_require_auth_but_are_registered(self):
    client = TestClient(app)
    response = client.get("/api/study-coach/overview")
    self.assertIn(response.status_code, {401, 403})
```

- [ ] **Step 2: Run test to verify current failure**

Run: `python3 -m unittest backend.tests.test_ai_study_coach -v`
Expected: FAIL because the routes are not implemented.

- [ ] **Step 3: Add study coach endpoints to the learning router**

```python
@router.get("/study-coach/overview", response_model=StudyCoachOverviewResponse)
async def get_study_coach_overview(...):
    progress_payload = build_progress_payload(db, current_user.id)
    recommendations = build_recommendations(db, current_user.id, progress_payload)
    documents = _load_user_documents(db, current_user.id)
    return build_study_coach_overview(progress_payload, recommendations, documents)
```

```python
@router.get("/study-coach/progress", response_model=StudyCoachProgressResponse)
async def get_study_coach_progress(...):
    progress_payload = build_progress_payload(db, current_user.id)
    return build_study_coach_progress_payload(progress_payload)
```

```python
@router.get("/study-coach/materials", response_model=StudyCoachMaterialsResponse)
async def get_study_coach_materials(...):
    progress_payload = build_progress_payload(db, current_user.id)
    documents = _load_user_documents(db, current_user.id)
    return build_study_coach_materials_payload(documents, build_gap_list(progress_payload))
```

```python
@router.get("/study-coach/chat-suggestions", response_model=StudyCoachChatSuggestionsResponse)
async def get_study_coach_chat_suggestions(...):
    progress_payload = build_progress_payload(db, current_user.id)
    documents = _load_user_documents(db, current_user.id)
    return build_study_coach_chat_payload(build_gap_list(progress_payload), documents)
```

- [ ] **Step 4: Run backend test suite**

Run: `python3 -m unittest backend.tests.test_ai_study_coach backend.tests.test_agentic_learning_chat backend.tests.test_classroom_module -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/learning.py backend/tests/test_ai_study_coach.py
git commit -m "feat: add study coach api routes"
```

### Task 4: Add student Study Coach UI components and dashboard wiring

**Files:**
- Create: `frontend/components/StudyCoachPanel.jsx`
- Modify: `frontend/pages/dashboard.jsx`
- Create: `frontend/tests/study-coach-contract.test.mjs`

- [ ] **Step 1: Add failing frontend contract tests**

```javascript
test("student dashboard references study coach overview endpoint", () => {
  const source = fs.readFileSync("frontend/pages/dashboard.jsx", "utf8");
  assert.match(source, /\/api\/study-coach\/overview/);
  assert.match(source, /AI Study Coach/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test frontend/tests/study-coach-contract.test.mjs`
Expected: FAIL because the Study Coach UI does not exist yet.

- [ ] **Step 3: Build the reusable Study Coach panel and dashboard integration**

```javascript
export default function StudyCoachPanel({ title, summary, actions, focusAreas }) {
  return (
    <div className="card p-6">
      <p className="section-kicker text-[#8a5a36]">AI Study Coach</p>
      <h3 className="mt-2 text-xl font-bold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{summary}</p>
      ...
    </div>
  )
}
```

```javascript
const [studyCoach, setStudyCoach] = useState(null)
...
fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/study-coach/overview`, { headers: { Authorization: `Bearer ${token}` } })
```

- [ ] **Step 4: Run frontend contract test**

Run: `node --test frontend/tests/study-coach-contract.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/components/StudyCoachPanel.jsx frontend/pages/dashboard.jsx frontend/tests/study-coach-contract.test.mjs
git commit -m "feat: add study coach dashboard panel"
```

### Task 5: Wire Study Coach into Progress, Materials, and Learning Chat

**Files:**
- Modify: `frontend/pages/progress.jsx`
- Modify: `frontend/pages/documents.jsx`
- Modify: `frontend/pages/learning-chat.jsx`
- Modify: `frontend/tests/study-coach-contract.test.mjs`

- [ ] **Step 1: Extend frontend contract tests**

```javascript
test("progress page references study coach progress endpoint", () => {
  const source = fs.readFileSync("frontend/pages/progress.jsx", "utf8");
  assert.match(source, /\/api\/study-coach\/progress/);
});
```

```javascript
test("materials page references study coach materials endpoint", () => {
  const source = fs.readFileSync("frontend/pages/documents.jsx", "utf8");
  assert.match(source, /\/api\/study-coach\/materials/);
});
```

```javascript
test("learning chat references study coach chat suggestions endpoint", () => {
  const source = fs.readFileSync("frontend/pages/learning-chat.jsx", "utf8");
  assert.match(source, /\/api\/study-coach\/chat-suggestions/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test frontend/tests/study-coach-contract.test.mjs`
Expected: FAIL because only the dashboard wiring exists.

- [ ] **Step 3: Add page-specific Study Coach surfaces**

```javascript
const [coachProgress, setCoachProgress] = useState(null)
...
fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/study-coach/progress`, ...)
```

```javascript
const [coachMaterials, setCoachMaterials] = useState(null)
...
fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/study-coach/materials`, ...)
```

```javascript
const [chatCoach, setChatCoach] = useState(null)
...
fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/study-coach/chat-suggestions`, ...)
```

Render:
- progress interpretation card
- materials recommendation card
- chat follow-up guidance card

- [ ] **Step 4: Run frontend contract tests**

Run: `node --test frontend/tests/study-coach-contract.test.mjs frontend/tests/learning-chat-agentic-contract.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/pages/progress.jsx frontend/pages/documents.jsx frontend/pages/learning-chat.jsx frontend/tests/study-coach-contract.test.mjs
git commit -m "feat: wire study coach across student pages"
```

### Task 6: Verify and finish the Study Coach slice

**Files:**
- Modify: `README.md` (only if Study Coach needs surfaced documentation)

- [ ] **Step 1: Run backend verification**

Run: `python3 -m unittest backend.tests.test_ai_study_coach backend.tests.test_agentic_learning_chat backend.tests.test_classroom_module -v`
Expected: PASS

- [ ] **Step 2: Run Python syntax verification**

Run: `env PYTHONPYCACHEPREFIX=/private/tmp/pycache python3 -m py_compile backend/app/services/study_coach.py backend/app/routers/learning.py backend/app/schemas/__init__.py`
Expected: PASS

- [ ] **Step 3: Run frontend verification**

Run: `node --test frontend/tests/study-coach-contract.test.mjs frontend/tests/learning-chat-agentic-contract.test.mjs frontend/tests/educator-copilot-contract.test.mjs`
Expected: PASS

- [ ] **Step 4: Run production build**

Run: `cd frontend && npm run build`
Expected: PASS, with only the known non-blocking warnings:
- ESLint not installed
- Google Fonts optimization skipped while offline

- [ ] **Step 5: Commit**

```bash
git add README.md backend/app/services/study_coach.py backend/app/routers/learning.py backend/app/schemas/__init__.py backend/tests/test_ai_study_coach.py frontend/components/StudyCoachPanel.jsx frontend/pages/dashboard.jsx frontend/pages/progress.jsx frontend/pages/documents.jsx frontend/pages/learning-chat.jsx frontend/tests/study-coach-contract.test.mjs
git commit -m "feat: add ai study coach"
```
