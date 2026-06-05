# AI Educator Copilot Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade AI Educator Copilot from a helpful educator summary into a sharper operational copilot that ranks intervention urgency more clearly, drafts more specific actions, and makes class-level teaching recommendations feel much more actionable.

**Architecture:** Extend the backend educator copilot service to produce richer dashboard priorities, communication draft context, and class-insights recommendations tied back to real signals from complaints, quiz performance, and meetings. Then rebuild the educator-facing copilot panels so they read like clear command surfaces rather than subtle helper cards.

**Tech Stack:** FastAPI, SQLAlchemy-backed classroom and educator signal aggregation, shared AI confidence helpers, React/Next.js, existing educator dashboard/communication/class-insights pages, Python unittest, Node contract tests.

---

### Task 1: Expand the educator copilot response contract

**Files:**
- Modify: `backend/app/schemas/__init__.py`
- Test: `backend/tests/test_ai_educator_copilot.py`

- [ ] **Step 1: Write the failing contract test**

Extend `backend/tests/test_ai_educator_copilot.py` with assertions for richer outputs:

```python
        self.assertIn("why_now", payload["priorities"][0])
        self.assertIn("recommended_window", payload["priorities"][0])
        self.assertIn("intervention_plan", payload)
```

For communication drafts:

```python
        self.assertIn("draft_reason", payload["drafts"][0])
        self.assertIn("escalation_signal", payload["drafts"][0])
```

For class insights:

```python
        self.assertIn("teaching_move", payload["trend_explanations"][0])
        self.assertIn("review_sequence", payload["group_review_recommendations"][0])
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
python3 -m unittest backend.tests.test_ai_educator_copilot -v
```

Expected:
- FAIL because the current schemas and payloads do not yet include those richer fields

- [ ] **Step 3: Extend the copilot schemas**

Update `backend/app/schemas/__init__.py` with richer educator copilot models, for example:

```python
class EducatorCopilotPriority(BaseModel):
    ...
    why_now: Optional[str] = None
    recommended_window: Optional[str] = None


class EducatorCopilotDashboardResponse(BaseModel):
    ...
    intervention_plan: List[str] = Field(default_factory=list)


class EducatorCopilotDraft(BaseModel):
    ...
    draft_reason: Optional[str] = None
    escalation_signal: Optional[str] = None
```

and add stronger class-insight detail fields such as:

```python
teaching_move: Optional[str] = None
review_sequence: List[str] = Field(default_factory=list)
```

- [ ] **Step 4: Run the test again**

Run:

```bash
python3 -m unittest backend.tests.test_ai_educator_copilot -v
```

Expected:
- still FAIL, but now because the service logic does not yet build those fields

### Task 2: Upgrade backend educator copilot logic

**Files:**
- Modify: `backend/app/services/educator_copilot.py`
- Test: `backend/tests/test_ai_educator_copilot.py`

- [ ] **Step 1: Write the failing service assertions**

Add expectations so the dashboard priorities must expose clearer urgency and follow-up guidance:

```python
        self.assertTrue(payload["priorities"][0]["why_now"])
        self.assertTrue(payload["priorities"][0]["recommended_window"])
        self.assertTrue(payload["intervention_plan"])
```

and for communication and class insights:

```python
        self.assertTrue(payload["drafts"][0]["draft_reason"])
        self.assertTrue(payload["drafts"][0]["escalation_signal"])
        self.assertTrue(payload["trend_explanations"][0]["teaching_move"])
        self.assertTrue(payload["group_review_recommendations"][0]["review_sequence"])
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
python3 -m unittest backend.tests.test_ai_educator_copilot.EducatorCopilotServiceTest -v
```

Expected:
- FAIL because the current builder functions still emit thinner payloads

- [ ] **Step 3: Upgrade dashboard copilot intelligence**

Update `build_dashboard_copilot_payload()` in `backend/app/services/educator_copilot.py` so each priority now includes:

```python
{
    "why_now": "...",
    "recommended_window": "today" | "next class" | "this week",
}
```

and add a top-level `intervention_plan`, for example:

```python
[
    "Resolve the highest-risk complaint first.",
    "Reinforce the lowest-performing classroom topic before the next quiz.",
    "Follow up on the most recent meeting action within the next class cycle.",
]
```

Make this logic distinguish:
- urgent complaint response
- student-level intervention
- meeting follow-up
- class-wide reteach priority

- [ ] **Step 4: Upgrade communication draft quality**

Update `build_communication_copilot_payload()` so each draft now includes:

```python
{
    "draft_reason": "This should be class-wide because the material issue affects multiple students.",
    "escalation_signal": "repeatable_class_issue" | "private_support_only" | "monitor_after_reply",
}
```

Make the draft reasoning more specific to:
- class-wide material issues
- one-off personal confusion
- repeated support signals

- [ ] **Step 5: Upgrade class-insights teaching guidance**

Update `build_class_insights_copilot_payload()` so trend explanations and group-review recommendations now include:

```python
{
    "teaching_move": "Re-teach Analyze with one comparison activity and a short exit check.",
    "review_sequence": [
        "Revisit the base concept",
        "Show one worked example",
        "Run one short retrieval check",
    ],
}
```

- [ ] **Step 6: Run the backend suite**

Run:

```bash
python3 -m unittest backend.tests.test_ai_educator_copilot -v
```

Expected:
- PASS

### Task 3: Upgrade educator copilot frontend surfaces

**Files:**
- Modify: `frontend/components/EducatorCopilotPanel.jsx`
- Modify: `frontend/pages/dashboard.jsx`
- Modify: `frontend/pages/communication-hub.jsx`
- Modify: `frontend/pages/educator/class-insights.jsx`
- Test: `frontend/tests/educator-copilot-contract.test.mjs`

- [ ] **Step 1: Write the failing frontend contract test**

Extend `frontend/tests/educator-copilot-contract.test.mjs` to require stronger AI surfacing cues:

```js
  assert.match(source, /Educator Command Center/)
  assert.match(source, /Intervention plan/)
  assert.match(source, /Draft reason/)
  assert.match(source, /Escalation signal/)
  assert.match(source, /Teaching move/)
  assert.match(source, /Review sequence/)
```

- [ ] **Step 2: Run the contract test to verify it fails**

Run:

```bash
cd frontend && node --test tests/educator-copilot-contract.test.mjs
```

Expected:
- FAIL because the current educator copilot UI is still lighter and less explicit

- [ ] **Step 3: Rebuild the shared educator copilot UI**

Update `frontend/components/EducatorCopilotPanel.jsx` so it supports stronger named sections and more visible AI command surfaces, including:
- `Educator Command Center`
- richer priority cards with `Why now` and `Recommended window`
- draft cards with `Draft reason` and `Escalation signal`
- recommendation cards with `Teaching move` and `Review sequence`

- [ ] **Step 4: Upgrade dashboard, communication hub, and class insights surfacing**

Update:
- `frontend/pages/dashboard.jsx`
- `frontend/pages/communication-hub.jsx`
- `frontend/pages/educator/class-insights.jsx`

so the copilot is more prominent and visually positioned as a main educator workflow surface rather than a subtle helper block.

- [ ] **Step 5: Run the frontend contract test**

Run:

```bash
cd frontend && node --test tests/educator-copilot-contract.test.mjs
```

Expected:
- PASS

### Task 4: Run final verification for the slice

**Files:**
- No code changes expected

- [ ] **Step 1: Run backend verification**

Run:

```bash
python3 -m unittest backend.tests.test_ai_educator_copilot -v
```

Expected:
- PASS

- [ ] **Step 2: Run frontend verification**

Run:

```bash
cd frontend && node --test tests/educator-copilot-contract.test.mjs
```

Expected:
- PASS

- [ ] **Step 3: Run the production build**

Run:

```bash
cd frontend && npm run build -- --no-lint
```

Expected:
- PASS
