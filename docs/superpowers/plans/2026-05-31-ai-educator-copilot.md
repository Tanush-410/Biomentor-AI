# AI Educator Copilot Implementation Plan

Date: 2026-05-31

## Goal

Implement the first production slice of `AI Educator Copilot` as one shared intelligence layer surfaced across:
- educator dashboard
- communication hub
- class insights

The copilot must:
- prioritize educator attention using classroom-specific signals
- draft but never auto-send educator actions
- explain classroom trends in plain language
- reuse meeting assistant and quiz-performance signals where possible

## Implementation Strategy

Build the feature in four phases:

1. define the shared backend contract
2. implement the backend copilot service and routes
3. wire page-specific educator UI panels
4. verify with backend tests, frontend contract tests, and production build

## Phase 1: Shared Backend Contract

Add new schemas to represent:
- daily intervention priorities
- draft replies and handling suggestions
- class-insights explanations and group-review guidance
- dashboard, communication, and class-insights copilot payloads

Design the schemas so one shared service can populate all three surfaces.

## Phase 2: Backend Copilot Intelligence

Create a shared service:
- `backend/app/services/educator_copilot.py`

Responsibilities:
- load educator classrooms and enrollments
- identify at-risk students from progress and quiz outcomes
- incorporate unresolved complaints and direct student messages
- incorporate classroom meeting recap outputs where available
- rank daily intervention priorities
- generate complaint/message reply drafts
- produce class-level plain-language explanations and review recommendations

Backend integration:
- extend `backend/app/routers/educator.py`
- add dedicated copilot endpoints or enrich existing educator endpoints with optional copilot payloads

Suggested initial endpoints:
- `GET /api/educator/copilot/dashboard`
- `GET /api/educator/copilot/communication`
- `GET /api/educator/copilot/class-insights`

Testing:
- add `backend/tests/test_ai_educator_copilot.py`
- cover:
  - priority ranking
  - message/complaint draft generation
  - class-insights explanation generation
  - route-level access control and payload shape

## Phase 3: Frontend Copilot Surfaces

Add reusable UI components:
- `EducatorCopilotPanel`
- `CopilotPriorityCard`
- `CopilotDraftCard`
- `CopilotRecommendationCard`

Update:
- `frontend/pages/dashboard.jsx`
  - render daily priorities and suggested actions
- `frontend/pages/communication-hub.jsx`
  - render summaries, reply drafts, urgency, and handling mode
  - allow copying/applying a suggested draft into the compose form
- `frontend/pages/educator/class-insights.jsx`
  - render plain-language trend explanation and group-review suggestions

Testing:
- add `frontend/tests/educator-copilot-contract.test.mjs`
- verify all three educator surfaces reference the copilot payloads and render the expected sections

## Phase 4: Verification

Run:
- backend educator copilot tests
- existing educator/dashboard/classroom-related tests that may be affected
- frontend contract tests
- production build

Commands to run:
- `python3 -m unittest backend.tests.test_ai_educator_copilot backend.tests.test_ai_meeting_assistant backend.tests.test_classroom_module -v`
- `node --test frontend/tests/educator-copilot-contract.test.mjs frontend/tests/meeting-assistant-contract.test.mjs frontend/tests/learning-chat-agentic-contract.test.mjs`
- `cd frontend && npm run build`

## Risks and Mitigations

### Risk: duplicate logic across educator pages
Mitigation:
- keep all intelligence in one backend service and keep frontend components thin

### Risk: over-automated or unsafe educator actions
Mitigation:
- drafts only
- no send/apply automation
- educator must review all outputs

### Risk: noisy recommendations from sparse classroom data
Mitigation:
- use structured heuristics with grounded signals first
- only add stronger AI generation where classroom evidence exists

## Success Criteria

This phase is complete when:
- educators see daily intervention priorities on the dashboard
- educators get usable reply drafts in communication hub
- educators get plain-language trend explanations and group-review suggestions in class insights
- all outputs remain classroom-grounded and educator-controlled
