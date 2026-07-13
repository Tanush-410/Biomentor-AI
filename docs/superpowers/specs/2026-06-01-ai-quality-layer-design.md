# AI Quality Layer Design

## Goal

Upgrade every AI-powered surface in VYDRA CORE so the system is more accurate, more evidence-grounded, more consistent across pages, and more conservative when confidence is weak.

This design does not introduce ML training pipelines. Instead, it makes the existing AI stack smarter through:
- stronger evidence retrieval
- shared confidence scoring
- structured response contracts
- safer fallback behavior
- better prompt orchestration
- lightweight evaluation coverage

## Scope

This quality layer should improve all current AI features:
- Learning Chat
- AI Meeting Assistant
- AI Educator Copilot
- AI Study Coach
- AI Classroom Intelligence
- AI Quiz Quality Layer
- AI Material Intelligence
- AI Proctor Review

It should not break existing routes, page structure, or role flows.

## Product Principles

### 1. Evidence first
AI should prefer grounded responses over fluent guessing. If evidence is weak, the system should say so and switch to safer behavior.

### 2. Shared intelligence
Every AI feature should use the same core logic for:
- evidence packaging
- confidence scoring
- fallback decisions
- output normalization

### 3. Conservative when uncertain
When the model is not well-supported, it should:
- avoid overstating conclusions
- ask narrower questions when needed
- surface uncertainty clearly
- lean on sources, summaries, and small checks

### 4. Structured outputs over freeform text
Each AI feature should return typed, well-shaped responses instead of loose prose blobs wherever possible.

### 5. Keep current UX intact
Existing product areas remain the same. This is a quality pass, not a product rewrite.

## Current Gaps

From the current implementation:
- Learning Chat has web fallback, but confidence and answer-shaping can still be improved.
- Meeting Assistant uses a mix of rule-based summaries and one-shot LLM summaries, but lacks shared evaluation and evidence scoring.
- Educator Copilot and Study Coach rely heavily on heuristics and static recommendation shaping.
- Classroom Intelligence, Quiz Quality, Material Intelligence, and Proctor Review all work, but they do not yet share one confidence-aware orchestration layer.
- Prompt structure and fallback behavior are inconsistent between features.

## Architecture

Add one shared backend quality subsystem for AI orchestration.

### New shared service family

Create a small set of shared AI quality modules under `backend/app/services/`:

1. `ai_quality.py`
   Central helpers for:
   - evidence scoring
   - confidence classification
   - uncertainty labeling
   - output normalization

2. `ai_generation.py`
   Shared model invocation helpers for:
   - Groq chat generation
   - JSON-only structured generation
   - prompt assembly
   - safe fallback behavior

3. `ai_evidence.py`
   Shared helpers for:
   - assembling source snippets
   - trimming noisy context
   - ranking and deduplicating supporting evidence
   - formatting evidence into a consistent model-ready shape

4. `ai_evaluation.py`
   Shared lightweight evaluation logic for:
   - expected output shape checks
   - confidence downgrade triggers
   - low-evidence fallback triggers

These services become dependencies of all existing AI feature services.

## Shared Quality Contract

Every AI feature should internally produce or use:

- `evidence_items`
  The pieces of support used for generation

- `confidence`
  One of:
  - `high`
  - `medium`
  - `low`

- `confidence_reason`
  Short explanation for why confidence received that level

- `fallback_used`
  Whether the feature had to use a safer fallback path

- `origin`
  Where the answer primarily came from, when relevant:
  - `material`
  - `trusted_web`
  - `broader_web`
  - `meeting_transcript`
  - `analytics`
  - `rule_based`

Not every one of these fields needs to be exposed directly in the UI, but each feature should use them internally and expose the relevant subset.

## Feature Upgrades

### 1. Learning Chat

#### Quality upgrades
- Better evidence packing from uploaded material chunks
- Better ranking between material evidence and web fallback evidence
- Stronger trusted-domain preference before broad web
- Better follow-up question rewriting
- Confidence-aware answer shaping
- Stronger “I am not sure” behavior when evidence is thin

#### Response behavior
- If uploaded material strongly supports the answer:
  - answer from material
  - cite material
- If material is weak:
  - use trusted web first
  - broaden only when needed
- If evidence remains weak:
  - say the answer is lower confidence
  - provide the best grounded summary possible
  - offer a mini-check or narrowing suggestion

#### UI behavior
Continue the current source-badge approach, but make it more honest and more precise.

### 2. AI Meeting Assistant

#### Quality upgrades
- Better transcript snippet selection
- Better event-to-summary integration
- Better teacher-private summary separation from student-safe recap
- Better action-item extraction
- Better unresolved-doubt detection
- Better follow-up quiz/material suggestions

#### Confidence rules
- If transcript density is too low, reduce confidence
- If only sparse structured events exist, keep output concise and cautious
- If both transcript and events are rich, allow stronger meeting recap output

### 3. AI Educator Copilot

#### Quality upgrades
- Priorities should be backed by clearer signal combinations
- Draft replies should reflect issue type and urgency
- Group review suggestions should reference actual weak topics
- Meeting follow-up recommendations should cite meeting outputs when available

#### Confidence rules
- Low-signal classrooms should not receive overly specific advice
- Draft recommendations should clearly separate:
  - likely action
  - optional action
  - evidence source

### 4. AI Study Coach

#### Quality upgrades
- More specific next-step plans from real weak areas
- Better sequencing between:
  - material review
  - learning chat
  - quiz
  - progress review
- Better follow-up suggestions tied to actual weak Bloom levels

#### Confidence rules
- If progress history is sparse, coach should not over-personalize
- Early-stage students should get baseline-building guidance, not fake precision

### 5. AI Classroom Intelligence

#### Quality upgrades
- Better class-level focus topic selection
- Better class-vs-student distinction
- Better meeting follow-up inclusion
- Better teacher/student role-specific rendering

#### Confidence rules
- If a topic is inferred from too little data, label it as emerging rather than dominant

### 6. AI Quiz Quality Layer

#### Quality upgrades
- Better distractor analysis
- Better repeated-answer-pattern detection
- Better Bloom-balance judgments
- Better timing and explanation checks

#### Confidence rules
- If quiz has too few questions for strong pattern detection, avoid overclaiming systemic problems

### 7. AI Material Intelligence

#### Quality upgrades
- Better summary extraction from dense materials
- Better glossary filtering
- Better flashcard quality
- Better prerequisite warnings
- Better follow-up prompt usefulness

#### Confidence rules
- If document content is short or messy, summary should be shorter and less assertive

### 8. AI Proctor Review

#### Quality upgrades
- Better aggregation of incidents into a severity judgment
- Better educator-facing incident explanations
- Better pattern grouping for repeated suspicious behavior

#### Confidence rules
- Heuristic signals should never be treated like certain proof
- Recommendations should distinguish between:
  - review required
  - likely suspicious
  - automatically debarred by rules

## Prompting Strategy

Move all LLM-backed features toward a shared prompting style:

- system prompt enforces:
  - grounded answers only
  - explicit uncertainty when evidence is weak
  - JSON response shape when needed
  - no unsupported claims

- user payload includes:
  - compact task instruction
  - evidence block
  - output contract
  - tone/audience cue

This keeps the app’s AI behavior consistent.

## Fallback Strategy

When generation quality is weak or model output is malformed:

1. Attempt structured LLM response
2. If parsing fails, retry once with stricter contract
3. If still weak, fall back to deterministic or rule-based output
4. Mark confidence down and expose safer UI wording

This should apply across all AI surfaces.

## Testing Strategy

Add or expand tests in these categories:

### Backend
- Learning Chat confidence/fallback tests
- Meeting Assistant evidence and summary fallback tests
- Educator Copilot low-signal vs high-signal recommendation tests
- Study Coach sparse-progress tests
- Classroom Intelligence weak-data tests
- Quiz Quality small-quiz caution tests
- Material Intelligence messy-document fallback tests
- Proctor Review uncertainty phrasing tests

### Frontend contract tests
- confidence label rendering where relevant
- fallback/UI-state rendering where relevant
- no broken payload assumptions after new fields are added

## File Impact

### New backend files
- `backend/app/services/ai_quality.py`
- `backend/app/services/ai_generation.py`
- `backend/app/services/ai_evidence.py`
- `backend/app/services/ai_evaluation.py`

### Existing backend files likely to change
- `backend/app/services/web_retrieval.py`
- `backend/app/services/meeting_assistant.py`
- `backend/app/services/educator_copilot.py`
- `backend/app/services/study_coach.py`
- `backend/app/services/classroom_intelligence.py`
- `backend/app/services/quiz_quality.py`
- `backend/app/services/material_intelligence.py`
- `backend/app/services/proctor_review.py`
- `backend/app/routers/qa.py`
- relevant router/schema files that expose upgraded payloads

### Existing frontend files likely to change
- `frontend/pages/learning-chat.jsx`
- `frontend/components/QuickCheckCard.jsx`
- `frontend/components/MeetingAssistantPanel.jsx`
- `frontend/components/EducatorCopilotPanel.jsx`
- `frontend/components/StudyCoachPanel.jsx`
- `frontend/components/ClassroomIntelligencePanel.jsx`
- `frontend/components/QuizQualityPanel.jsx`
- `frontend/components/MaterialIntelligencePanel.jsx`
- `frontend/components/ProctorReviewPanel.jsx`

## Non-Goals

This phase does not include:
- training custom ML models
- replacing Groq with a different provider
- introducing vector embedding infrastructure beyond current architecture
- building a full offline model stack
- redesigning the page structure

## Rollout Order

Implement in this order:

1. Shared AI quality layer
2. Learning Chat upgrade
3. Meeting Assistant upgrade
4. Educator Copilot upgrade
5. Study Coach upgrade
6. Classroom Intelligence upgrade
7. Quiz Quality upgrade
8. Material Intelligence upgrade
9. Proctor Review upgrade

This order improves the most visible and most central AI surfaces first while keeping the rest aligned.
