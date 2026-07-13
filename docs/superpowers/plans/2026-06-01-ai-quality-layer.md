# AI Quality Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a shared AI quality layer that improves grounding, confidence handling, fallback behavior, and output consistency across all existing AI features in VYDRA CORE.

**Architecture:** Add four shared backend services for evidence assembly, generation, quality scoring, and evaluation, then refactor each existing AI feature to consume the shared layer. Keep the current page and API structure intact while extending backend payloads and frontend panels with confidence-aware UI.

**Tech Stack:** FastAPI, SQLAlchemy, Groq chat completions, Next.js 14, React 18, Node test runner, Python unittest

---

## File Structure

### New backend files
- Create: `backend/app/services/ai_quality.py`
- Create: `backend/app/services/ai_generation.py`
- Create: `backend/app/services/ai_evidence.py`
- Create: `backend/app/services/ai_evaluation.py`
- Create: `backend/tests/test_ai_quality_layer.py`

### Existing backend files
- Modify: `backend/app/services/web_retrieval.py`
- Modify: `backend/app/services/meeting_assistant.py`
- Modify: `backend/app/services/educator_copilot.py`
- Modify: `backend/app/services/study_coach.py`
- Modify: `backend/app/services/classroom_intelligence.py`
- Modify: `backend/app/services/quiz_quality.py`
- Modify: `backend/app/services/material_intelligence.py`
- Modify: `backend/app/services/proctor_review.py`
- Modify: `backend/app/routers/qa.py`
- Modify: `backend/app/schemas/__init__.py`
- Create or modify focused backend tests per feature:
  - `backend/tests/test_agentic_learning_chat.py`
  - `backend/tests/test_ai_meeting_assistant.py`
  - `backend/tests/test_ai_educator_copilot.py`
  - `backend/tests/test_ai_study_coach.py`
  - `backend/tests/test_ai_classroom_intelligence.py`
  - `backend/tests/test_ai_quiz_quality.py`
  - `backend/tests/test_ai_material_intelligence.py`
  - `backend/tests/test_ai_proctor_review.py`

### Existing frontend files
- Modify: `frontend/pages/learning-chat.jsx`
- Modify: `frontend/components/QuickCheckCard.jsx`
- Modify: `frontend/components/MeetingAssistantPanel.jsx`
- Modify: `frontend/components/EducatorCopilotPanel.jsx`
- Modify: `frontend/components/StudyCoachPanel.jsx`
- Modify: `frontend/components/ClassroomIntelligencePanel.jsx`
- Modify: `frontend/components/QuizQualityPanel.jsx`
- Modify: `frontend/components/MaterialIntelligencePanel.jsx`
- Modify: `frontend/components/ProctorReviewPanel.jsx`
- Modify: `frontend/tests/learning-chat-agentic-contract.test.mjs`
- Modify: `frontend/tests/meeting-assistant-contract.test.mjs`
- Modify: `frontend/tests/educator-copilot-contract.test.mjs`
- Modify: `frontend/tests/study-coach-contract.test.mjs`
- Modify: `frontend/tests/classroom-intelligence-contract.test.mjs`
- Modify: `frontend/tests/quiz-quality-contract.test.mjs`
- Modify: `frontend/tests/material-intelligence-contract.test.mjs`
- Modify: `frontend/tests/proctor-review-contract.test.mjs`

---

### Task 1: Build the shared AI quality core

**Files:**
- Create: `backend/app/services/ai_quality.py`
- Create: `backend/app/services/ai_generation.py`
- Create: `backend/app/services/ai_evidence.py`
- Create: `backend/app/services/ai_evaluation.py`
- Test: `backend/tests/test_ai_quality_layer.py`

- [ ] **Step 1: Write the failing backend tests for shared confidence and evidence helpers**

```python
from app.services.ai_quality import classify_confidence, make_origin_label
from app.services.ai_evidence import dedupe_evidence_items, trim_evidence_items
from app.services.ai_evaluation import should_use_safe_fallback


def test_classify_confidence_prefers_high_when_evidence_is_strong():
    result = classify_confidence(evidence_count=4, average_score=0.87, malformed_output=False)
    assert result["confidence"] == "high"
    assert "strong" in result["confidence_reason"].lower()


def test_classify_confidence_downgrades_when_output_is_malformed():
    result = classify_confidence(evidence_count=3, average_score=0.82, malformed_output=True)
    assert result["confidence"] == "medium"


def test_safe_fallback_triggers_when_evidence_is_thin():
    assert should_use_safe_fallback(evidence_count=0, confidence="low") is True


def test_dedupe_evidence_items_keeps_highest_scoring_unique_item():
    items = [
        {"title": "A", "content": "same text", "relevance_score": 0.51},
        {"title": "B", "content": "same text", "relevance_score": 0.74},
    ]
    deduped = dedupe_evidence_items(items)
    assert len(deduped) == 1
    assert deduped[0]["title"] == "B"


def test_trim_evidence_items_limits_total_context_but_preserves_order():
    items = [
        {"content": "a" * 600, "relevance_score": 0.9},
        {"content": "b" * 600, "relevance_score": 0.8},
        {"content": "c" * 600, "relevance_score": 0.7},
    ]
    trimmed = trim_evidence_items(items, max_chars=1000)
    assert len(trimmed) == 2
```

- [ ] **Step 2: Run the shared-layer tests to verify they fail**

Run: `cd /Users/tanush.s.vashisht/Desktop/Tanush/work && python3 -m unittest backend.tests.test_ai_quality_layer -v`

Expected: FAIL with import errors because the new shared AI quality modules do not exist yet.

- [ ] **Step 3: Implement the minimal shared AI quality helpers**

```python
# backend/app/services/ai_quality.py
def classify_confidence(*, evidence_count: int, average_score: float, malformed_output: bool) -> dict:
    if evidence_count <= 0 or average_score < 0.35:
        return {"confidence": "low", "confidence_reason": "Evidence is weak or missing."}
    if malformed_output or average_score < 0.7:
        return {"confidence": "medium", "confidence_reason": "Evidence is usable but not fully reliable."}
    return {"confidence": "high", "confidence_reason": "Evidence is strong and well-aligned."}


def make_origin_label(origin: str) -> str:
    labels = {
        "material": "Answered from your material",
        "trusted_web": "Enhanced with trusted web sources",
        "broader_web": "Enhanced with web sources",
        "meeting_transcript": "Derived from meeting transcript",
        "analytics": "Derived from learning analytics",
        "rule_based": "Generated from rule-based signals",
    }
    return labels.get(origin, "AI-assisted")
```

```python
# backend/app/services/ai_evidence.py
def dedupe_evidence_items(items):
    best = {}
    for item in items:
        key = (item.get("content") or "").strip().lower()
        current = best.get(key)
        if not current or float(item.get("relevance_score", 0)) > float(current.get("relevance_score", 0)):
            best[key] = item
    return list(best.values())


def trim_evidence_items(items, max_chars=2200):
    kept = []
    total = 0
    for item in items:
        content = item.get("content", "")
        if total >= max_chars:
            break
        kept.append(item)
        total += len(content)
    return kept
```

```python
# backend/app/services/ai_evaluation.py
def should_use_safe_fallback(*, evidence_count: int, confidence: str) -> bool:
    return evidence_count <= 0 or confidence == "low"
```

```python
# backend/app/services/ai_generation.py
import json
import requests
from app.core.config import settings


def groq_json_completion(*, system_prompt: str, user_prompt: str, timeout: int = 20):
    key = (settings.groq_api_key or "").strip()
    if not key or key.lower().startswith("your_"):
        return None
    response = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={
            "model": "llama-3.3-70b-versatile",
            "temperature": 0.2,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        },
        timeout=timeout,
    )
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"].strip()
    return json.loads(content)
```

- [ ] **Step 4: Run the shared-layer tests to verify they pass**

Run: `cd /Users/tanush.s.vashisht/Desktop/Tanush/work && python3 -m unittest backend.tests.test_ai_quality_layer -v`

Expected: PASS

- [ ] **Step 5: Commit the shared AI quality core**

```bash
git add backend/app/services/ai_quality.py backend/app/services/ai_generation.py backend/app/services/ai_evidence.py backend/app/services/ai_evaluation.py backend/tests/test_ai_quality_layer.py
git commit -m "feat: add shared ai quality core"
```

---

### Task 2: Upgrade Learning Chat to use the shared quality layer

**Files:**
- Modify: `backend/app/services/web_retrieval.py`
- Modify: `backend/app/routers/qa.py`
- Modify: `backend/app/schemas/__init__.py`
- Modify: `frontend/pages/learning-chat.jsx`
- Modify: `frontend/components/QuickCheckCard.jsx`
- Test: `backend/tests/test_agentic_learning_chat.py`
- Test: `frontend/tests/learning-chat-agentic-contract.test.mjs`

- [ ] **Step 1: Write the failing tests for confidence-aware chat responses**

```python
def test_agentic_answer_prefers_material_origin_when_material_context_is_strong(self):
    response = self.client.post("/api/qa/answer", json=self.material_question_payload)
    data = response.json()
    assert data["answer_origin"] == "material"
    assert data["confidence"] in {"high", "medium"}
    assert data["confidence_reason"]


def test_agentic_answer_uses_trusted_web_when_material_is_missing(self):
    response = self.client.post("/api/qa/answer", json=self.web_question_payload)
    data = response.json()
    assert data["answer_origin"] in {"trusted_web", "broader_web"}
    assert data["source_badge"]


def test_agentic_answer_uses_safe_language_when_confidence_is_low(self):
    response = self.client.post("/api/qa/answer", json=self.weak_context_payload)
    data = response.json()
    assert data["confidence"] == "low"
    assert data["fallback_used"] is True
```

```javascript
test("learning chat renders confidence-aware source badge", async () => {
  const source = fs.readFileSync("pages/learning-chat.jsx", "utf8");
  assert.match(source, /confidence_reason/);
  assert.match(source, /sourceBadgeLabel|source_badge/i);
});
```

- [ ] **Step 2: Run the Learning Chat tests to verify they fail**

Run: `cd /Users/tanush.s.vashisht/Desktop/Tanush/work && python3 -m unittest backend.tests.test_agentic_learning_chat -v && node --test frontend/tests/learning-chat-agentic-contract.test.mjs`

Expected: FAIL because the route and page do not yet use the shared confidence/evidence helpers.

- [ ] **Step 3: Refactor the QA route and retrieval helpers to produce shared quality fields**

```python
# backend/app/routers/qa.py
from app.services.ai_quality import classify_confidence, make_origin_label
from app.services.ai_evidence import dedupe_evidence_items, trim_evidence_items
from app.services.ai_evaluation import should_use_safe_fallback

evidence_items = trim_evidence_items(dedupe_evidence_items(material_results + trusted_web_results + broader_web_results))
confidence_meta = classify_confidence(
    evidence_count=len(evidence_items),
    average_score=_average_relevance(evidence_items),
    malformed_output=False,
)
fallback_used = should_use_safe_fallback(
    evidence_count=len(evidence_items),
    confidence=confidence_meta["confidence"],
)

return {
    "answer": answer_text,
    "answer_origin": origin,
    "source_badge": make_origin_label(origin),
    "confidence": confidence_meta["confidence"],
    "confidence_reason": confidence_meta["confidence_reason"],
    "fallback_used": fallback_used,
    "sources": serialized_sources,
    "quick_check": quick_check_payload,
}
```

```jsx
// frontend/pages/learning-chat.jsx
<p className="text-sm text-stone-600">{message.confidence_reason}</p>
<span className="ui-badge ui-badge-soft">{message.source_badge}</span>
{message.confidence === "low" ? (
  <p className="text-sm text-amber-800">This answer is lower confidence, so review the cited sources or use Quick Check next.</p>
) : null}
```

- [ ] **Step 4: Run the Learning Chat tests to verify they pass**

Run: `cd /Users/tanush.s.vashisht/Desktop/Tanush/work && python3 -m unittest backend.tests.test_agentic_learning_chat -v && node --test frontend/tests/learning-chat-agentic-contract.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit the Learning Chat quality upgrade**

```bash
git add backend/app/services/web_retrieval.py backend/app/routers/qa.py backend/app/schemas/__init__.py frontend/pages/learning-chat.jsx frontend/components/QuickCheckCard.jsx backend/tests/test_agentic_learning_chat.py frontend/tests/learning-chat-agentic-contract.test.mjs
git commit -m "feat: improve learning chat quality layer"
```

---

### Task 3: Upgrade AI Meeting Assistant and Educator Copilot

**Files:**
- Modify: `backend/app/services/meeting_assistant.py`
- Modify: `backend/app/services/educator_copilot.py`
- Modify: `backend/app/schemas/__init__.py`
- Modify: `frontend/components/MeetingAssistantPanel.jsx`
- Modify: `frontend/components/EducatorCopilotPanel.jsx`
- Test: `backend/tests/test_ai_meeting_assistant.py`
- Test: `backend/tests/test_ai_educator_copilot.py`
- Test: `frontend/tests/meeting-assistant-contract.test.mjs`
- Test: `frontend/tests/educator-copilot-contract.test.mjs`

- [ ] **Step 1: Write the failing tests for confidence-aware meeting summaries and educator recommendations**

```python
def test_meeting_assistant_downgrades_confidence_when_transcript_is_sparse(self):
    payload = build_teacher_assistant_snapshot([], [], "Revision")
    assert payload["confidence"] == "low"


def test_educator_copilot_priorities_include_confidence_reason(self):
    payload = build_dashboard_copilot_payload(student_snapshots, complaints, meeting_summaries)
    assert payload["priorities"][0]["confidence_reason"]
```

```javascript
test("meeting assistant panel renders confidence cue", async () => {
  const source = fs.readFileSync("components/MeetingAssistantPanel.jsx", "utf8");
  assert.match(source, /confidence_reason/);
});

test("educator copilot panel renders evidence or confidence cue", async () => {
  const source = fs.readFileSync("components/EducatorCopilotPanel.jsx", "utf8");
  assert.match(source, /confidence_reason|evidence/i);
});
```

- [ ] **Step 2: Run the meeting and copilot tests to verify they fail**

Run: `cd /Users/tanush.s.vashisht/Desktop/Tanush/work && python3 -m unittest backend.tests.test_ai_meeting_assistant backend.tests.test_ai_educator_copilot -v && node --test frontend/tests/meeting-assistant-contract.test.mjs frontend/tests/educator-copilot-contract.test.mjs`

Expected: FAIL because these services do not yet return shared quality fields.

- [ ] **Step 3: Refactor the meeting assistant and educator copilot to use the quality layer**

```python
# backend/app/services/meeting_assistant.py
from app.services.ai_quality import classify_confidence

confidence_meta = classify_confidence(
    evidence_count=len(transcript_items) + len(meeting_events),
    average_score=0.82 if transcript_items else 0.4,
    malformed_output=False,
)
snapshot["confidence"] = confidence_meta["confidence"]
snapshot["confidence_reason"] = confidence_meta["confidence_reason"]
snapshot["fallback_used"] = confidence_meta["confidence"] == "low"
snapshot["origin"] = "meeting_transcript"
```

```python
# backend/app/services/educator_copilot.py
priority["confidence"] = "high" if priority["severity"] == "high" else "medium"
priority["confidence_reason"] = "Multiple learner, complaint, or meeting signals support this recommendation."
```

```jsx
// frontend/components/EducatorCopilotPanel.jsx
<p className="text-xs text-stone-500">{item.confidence_reason}</p>

// frontend/components/MeetingAssistantPanel.jsx
<p className="text-xs text-stone-500">{assistantState.confidence_reason}</p>
```

- [ ] **Step 4: Run the meeting and copilot tests to verify they pass**

Run: `cd /Users/tanush.s.vashisht/Desktop/Tanush/work && python3 -m unittest backend.tests.test_ai_meeting_assistant backend.tests.test_ai_educator_copilot -v && node --test frontend/tests/meeting-assistant-contract.test.mjs frontend/tests/educator-copilot-contract.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit the meeting and copilot quality upgrade**

```bash
git add backend/app/services/meeting_assistant.py backend/app/services/educator_copilot.py backend/app/schemas/__init__.py frontend/components/MeetingAssistantPanel.jsx frontend/components/EducatorCopilotPanel.jsx backend/tests/test_ai_meeting_assistant.py backend/tests/test_ai_educator_copilot.py frontend/tests/meeting-assistant-contract.test.mjs frontend/tests/educator-copilot-contract.test.mjs
git commit -m "feat: improve meeting assistant and educator copilot quality"
```

---

### Task 4: Upgrade Study Coach and Classroom Intelligence

**Files:**
- Modify: `backend/app/services/study_coach.py`
- Modify: `backend/app/services/classroom_intelligence.py`
- Modify: `backend/app/schemas/__init__.py`
- Modify: `frontend/components/StudyCoachPanel.jsx`
- Modify: `frontend/components/ClassroomIntelligencePanel.jsx`
- Test: `backend/tests/test_ai_study_coach.py`
- Test: `backend/tests/test_ai_classroom_intelligence.py`
- Test: `frontend/tests/study-coach-contract.test.mjs`
- Test: `frontend/tests/classroom-intelligence-contract.test.mjs`

- [ ] **Step 1: Write the failing tests for sparse-signal and emerging-topic behavior**

```python
def test_study_coach_avoids_overpersonalizing_sparse_progress(self):
    payload = build_study_coach_progress_payload({"averageScore": 0, "bloomsDistribution": {}})
    assert "first quiz" in payload["summary"].lower()


def test_classroom_intelligence_marks_emerging_topics_when_data_is_thin(self):
    payload = build_classroom_intelligence_payload(student_signals=[single_signal])
    assert payload["teacher_view"]["focus_topics"][0]["status"] == "emerging"
```

```javascript
test("study coach panel renders confidence or certainty cue", async () => {
  const source = fs.readFileSync("components/StudyCoachPanel.jsx", "utf8");
  assert.match(source, /confidence_reason|certainty/i);
});
```

- [ ] **Step 2: Run the Study Coach and Classroom Intelligence tests to verify they fail**

Run: `cd /Users/tanush.s.vashisht/Desktop/Tanush/work && python3 -m unittest backend.tests.test_ai_study_coach backend.tests.test_ai_classroom_intelligence -v && node --test frontend/tests/study-coach-contract.test.mjs frontend/tests/classroom-intelligence-contract.test.mjs`

Expected: FAIL because these services do not yet expose the quality metadata and emerging-topic behavior.

- [ ] **Step 3: Refactor the student and classroom guidance services**

```python
# backend/app/services/study_coach.py
return {
    "summary": "...",
    "practice_order": practice_order,
    "recommendations": recommendations,
    "confidence": "medium" if practice_order else "low",
    "confidence_reason": "Based on recent quiz history." if practice_order else "Not enough quiz history yet.",
}
```

```python
# backend/app/services/classroom_intelligence.py
focus_topics.append(
    {
        "topic": topic,
        "status": "emerging" if topic_count < 2 else "confirmed",
        "confidence": "low" if topic_count < 2 else "medium",
        "confidence_reason": "Only a small amount of classroom evidence supports this topic." if topic_count < 2 else "Multiple learner signals support this topic.",
    }
)
```

- [ ] **Step 4: Run the Study Coach and Classroom Intelligence tests to verify they pass**

Run: `cd /Users/tanush.s.vashisht/Desktop/Tanush/work && python3 -m unittest backend.tests.test_ai_study_coach backend.tests.test_ai_classroom_intelligence -v && node --test frontend/tests/study-coach-contract.test.mjs frontend/tests/classroom-intelligence-contract.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit the Study Coach and Classroom Intelligence upgrade**

```bash
git add backend/app/services/study_coach.py backend/app/services/classroom_intelligence.py backend/app/schemas/__init__.py frontend/components/StudyCoachPanel.jsx frontend/components/ClassroomIntelligencePanel.jsx backend/tests/test_ai_study_coach.py backend/tests/test_ai_classroom_intelligence.py frontend/tests/study-coach-contract.test.mjs frontend/tests/classroom-intelligence-contract.test.mjs
git commit -m "feat: improve study coach and classroom intelligence quality"
```

---

### Task 5: Upgrade Quiz Quality, Material Intelligence, and Proctor Review

**Files:**
- Modify: `backend/app/services/quiz_quality.py`
- Modify: `backend/app/services/material_intelligence.py`
- Modify: `backend/app/services/proctor_review.py`
- Modify: `backend/app/schemas/__init__.py`
- Modify: `frontend/components/QuizQualityPanel.jsx`
- Modify: `frontend/components/MaterialIntelligencePanel.jsx`
- Modify: `frontend/components/ProctorReviewPanel.jsx`
- Test: `backend/tests/test_ai_quiz_quality.py`
- Test: `backend/tests/test_ai_material_intelligence.py`
- Test: `backend/tests/test_ai_proctor_review.py`
- Test: `frontend/tests/quiz-quality-contract.test.mjs`
- Test: `frontend/tests/material-intelligence-contract.test.mjs`
- Test: `frontend/tests/proctor-review-contract.test.mjs`

- [ ] **Step 1: Write the failing tests for small-sample caution and heuristic caution**

```python
def test_quiz_quality_avoids_overclaiming_on_small_quiz(self):
    payload = review_quiz_quality(single_question_quiz)
    assert payload["confidence"] == "low"


def test_material_intelligence_short_documents_get_conservative_summary(self):
    payload = build_material_intelligence_payload("Short text")
    assert payload["confidence"] in {"low", "medium"}


def test_proctor_review_never_treats_heuristics_as_certain_proof(self):
    payload = build_proctor_review_payload(heuristic_incidents_only)
    assert "review" in payload["recommendation_summary"].lower()
```

```javascript
test("proctor review panel renders cautionary language", async () => {
  const source = fs.readFileSync("components/ProctorReviewPanel.jsx", "utf8");
  assert.match(source, /review required|likely suspicious|confidence_reason/i);
});
```

- [ ] **Step 2: Run the quiz/material/proctor tests to verify they fail**

Run: `cd /Users/tanush.s.vashisht/Desktop/Tanush/work && python3 -m unittest backend.tests.test_ai_quiz_quality backend.tests.test_ai_material_intelligence backend.tests.test_ai_proctor_review -v && node --test frontend/tests/quiz-quality-contract.test.mjs frontend/tests/material-intelligence-contract.test.mjs frontend/tests/proctor-review-contract.test.mjs`

Expected: FAIL because the services do not yet downgrade confidence or use cautionary language consistently.

- [ ] **Step 3: Refactor the remaining AI services to use the shared quality layer**

```python
# backend/app/services/quiz_quality.py
confidence_meta = classify_confidence(
    evidence_count=len(question_items),
    average_score=0.85 if len(question_items) >= 4 else 0.45,
    malformed_output=False,
)

# backend/app/services/material_intelligence.py
confidence_meta = classify_confidence(
    evidence_count=1 if document_text.strip() else 0,
    average_score=0.7 if len(document_text) > 600 else 0.4,
    malformed_output=False,
)

# backend/app/services/proctor_review.py
recommendation_summary = "Review required before making a final misconduct decision." if heuristic_only else recommendation_summary
```

```jsx
// frontend/components/QuizQualityPanel.jsx
<p className="text-xs text-stone-500">{review.confidence_reason}</p>

// frontend/components/MaterialIntelligencePanel.jsx
<p className="text-xs text-stone-500">{panel.confidence_reason}</p>

// frontend/components/ProctorReviewPanel.jsx
<p className="text-xs text-stone-500">{review.confidence_reason}</p>
```

- [ ] **Step 4: Run the quiz/material/proctor tests to verify they pass**

Run: `cd /Users/tanush.s.vashisht/Desktop/Tanush/work && python3 -m unittest backend.tests.test_ai_quiz_quality backend.tests.test_ai_material_intelligence backend.tests.test_ai_proctor_review -v && node --test frontend/tests/quiz-quality-contract.test.mjs frontend/tests/material-intelligence-contract.test.mjs frontend/tests/proctor-review-contract.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit the remaining AI surface upgrades**

```bash
git add backend/app/services/quiz_quality.py backend/app/services/material_intelligence.py backend/app/services/proctor_review.py backend/app/schemas/__init__.py frontend/components/QuizQualityPanel.jsx frontend/components/MaterialIntelligencePanel.jsx frontend/components/ProctorReviewPanel.jsx backend/tests/test_ai_quiz_quality.py backend/tests/test_ai_material_intelligence.py backend/tests/test_ai_proctor_review.py frontend/tests/quiz-quality-contract.test.mjs frontend/tests/material-intelligence-contract.test.mjs frontend/tests/proctor-review-contract.test.mjs
git commit -m "feat: improve remaining ai quality surfaces"
```

---

### Task 6: Run full verification and refresh docs if needed

**Files:**
- Modify if needed: `README.md`
- Modify if needed: `GETTING_STARTED.md`
- Modify if needed: `QUICK_START.md`

- [ ] **Step 1: Run the backend AI quality suite**

Run:

```bash
cd /Users/tanush.s.vashisht/Desktop/Tanush/work
python3 -m unittest \
  backend.tests.test_ai_quality_layer \
  backend.tests.test_agentic_learning_chat \
  backend.tests.test_ai_meeting_assistant \
  backend.tests.test_ai_educator_copilot \
  backend.tests.test_ai_study_coach \
  backend.tests.test_ai_classroom_intelligence \
  backend.tests.test_ai_quiz_quality \
  backend.tests.test_ai_material_intelligence \
  backend.tests.test_ai_proctor_review -v
```

Expected: PASS

- [ ] **Step 2: Run the frontend AI contract suite**

Run:

```bash
cd /Users/tanush.s.vashisht/Desktop/Tanush/work/frontend
node --test \
  tests/learning-chat-agentic-contract.test.mjs \
  tests/meeting-assistant-contract.test.mjs \
  tests/educator-copilot-contract.test.mjs \
  tests/study-coach-contract.test.mjs \
  tests/classroom-intelligence-contract.test.mjs \
  tests/quiz-quality-contract.test.mjs \
  tests/material-intelligence-contract.test.mjs \
  tests/proctor-review-contract.test.mjs
```

Expected: PASS

- [ ] **Step 3: Run lint and production build**

Run:

```bash
cd /Users/tanush.s.vashisht/Desktop/Tanush/work/frontend
npm run lint
npm run build
```

Expected: lint passes with no new errors; build passes.

- [ ] **Step 4: Update the docs only if the visible user-facing AI behavior changed enough to warrant it**

```markdown
Add a short section to README/GETTING_STARTED only if needed:
- confidence-aware AI outputs
- safer fallback behavior
- evidence-grounded answer labeling
```

- [ ] **Step 5: Commit the final verification and doc updates**

```bash
git add README.md GETTING_STARTED.md QUICK_START.md
git commit -m "docs: refresh ai quality behavior notes"
```
