# Agentic Learning Chat Design

Date: 2026-05-31

## Goal

Upgrade VYDRA CORE's existing Learning Chat so it can:

1. answer from uploaded PDFs first
2. automatically fall back to trusted academic web sources when PDFs are insufficient
3. broaden to general web only if trusted sources are still insufficient
4. offer a small adaptive test for complex or low-confidence topics
5. give simple targeted feedback after the test

This feature should feel like a natural extension of the current student learning flow, not a separate tool.

## Product Decisions

- Primary experience stays inside the existing `Learning Chat`
- Web search fallback is automatic
- Search strategy is tiered:
  - uploaded PDFs first
  - trusted academic / educational sites second
  - broader web third
- Mini-test behavior is adaptive:
  - auto-trigger or strongly suggest it only for complex or low-confidence answers
- Feedback stays lightweight:
  - score
  - correct answer
  - one-line explanation
  - one next-step suggestion

## User Experience

### Student flow

1. Student asks a question in Learning Chat.
2. System tries to answer from uploaded material.
3. If uploaded material is enough:
   - answer is returned with PDF sources
   - response is labeled as material-grounded
4. If uploaded material is weak:
   - system searches trusted web sources automatically
   - if still weak, system expands to broader web
   - answer is returned with clear source attribution
   - response is labeled as web-enhanced
5. If the topic is complex or the answer confidence is low:
   - a small `Quick Check` block appears
   - student answers 2–3 short MCQs
6. After submission:
   - score is shown
   - each answer shows the correct option and one-line reasoning
   - one next step is suggested

### Educator value

This improves educator workflows indirectly by:

- making student question answering more reliable on complex topics
- reducing confusion when PDFs do not fully cover a topic
- providing short formative checks instead of only long quiz flows
- creating a path for future analytics on student misconceptions

## Architecture

The current QA flow should be extended rather than replaced.

### Backend layers

1. `Document Retrieval Layer`
   - existing uploaded-material retrieval
   - uses current chunk retrieval flow across Postgres + Qdrant-assisted ranking

2. `Trusted Web Retrieval Layer`
   - searches curated academic / educational domains first
   - example domain families:
     - university sites
     - educational content providers
     - government / health / science organizations
     - high-trust reference sites

3. `Broad Web Retrieval Layer`
   - runs only if trusted retrieval is still weak
   - should use the same normalization and ranking contract as trusted results

4. `Answer Orchestrator`
   - decides whether PDF context is sufficient
   - decides whether trusted web fallback is needed
   - decides whether broader web fallback is needed
   - merges, deduplicates, and ranks sources
   - labels final answer origin and confidence

5. `Mini-Test Generator`
   - builds 2–3 short MCQs from the final answer context
   - grounded in the same sources used for the answer
   - designed for quick feedback, not formal assessment

6. `Mini-Test Evaluator`
   - grades submitted answers
   - returns score, correct answer, short explanation, and one next-step suggestion

### Frontend layers

1. `Learning Chat`
   - remains the entry point
   - adds answer origin badge and quick-check block

2. `Source Presentation`
   - groups material sources and web sources consistently
   - keeps clickable source references

3. `Quick Check UI`
   - compact MCQ card stack
   - simple submit flow
   - lightweight feedback results

## Data Flow

### Answer generation

1. User sends question.
2. Backend retrieves document contexts.
3. Backend scores context sufficiency.
4. If sufficient:
   - answer from PDFs only
5. If insufficient:
   - run trusted web retrieval
6. If still insufficient:
   - run broader web retrieval
7. Merge and rank all candidate contexts.
8. Generate final answer.
9. Determine:
   - origin label
   - confidence level
   - complexity level
   - whether to show quick check
10. Return answer payload to frontend.

### Mini-test flow

1. Backend flags `show_quick_check=true` when:
   - confidence is below threshold, or
   - topic complexity is above threshold
2. Backend includes mini-test questions in answer response or via a follow-up endpoint.
3. Student answers MCQs.
4. Backend grades responses.
5. Frontend displays targeted feedback.

## API Changes

### Extend current QA answer response

The existing `/api/qa/answer` contract should be extended with:

- `answer_origin`
  - `material`
  - `trusted_web`
  - `web_enhanced`
- `confidence`
  - normalized score or coarse band
- `complexity`
  - simple
  - moderate
  - complex
- `show_quick_check`
  - boolean
- `quick_check`
  - optional payload with 2–3 MCQs

### Add quick-check evaluation endpoint

Suggested endpoint:

- `POST /api/qa/quick-check/evaluate`

Payload:
- question context id or chat session context
- user answers

Response:
- score
- per-question correctness
- one-line explanation per question
- one suggested next step

## Search Strategy

### Sufficiency evaluation

The system should not go to web just because web exists. It should go only when material retrieval is weak.

Weakness indicators:
- no material chunks found
- retrieval score below threshold
- chunks are too short, repetitive, or off-topic
- answer generator returns low-confidence signal

### Trusted-first search

The first web pass should prioritize a curated allowlist of domains or domain families. This should live in config so it can be tuned without rewriting business logic.

### Broad web fallback

Broader web should only run when:
- trusted web retrieval yields too few useful results
- or trusted results are too weak for an answer

### Source labeling

Every source shown to the user must retain:
- title
- URL or local document route
- excerpt
- source type
  - uploaded material
  - trusted web
  - broader web

## UI Changes

### Learning Chat

Add:
- answer origin pill
- quick confidence / complexity signal when useful
- `Quick Check` card below eligible answers
- feedback card after mini-test submission

### Copy behavior

When web fallback is used, the answer must clearly indicate that external sources were consulted.

Examples:
- `Answered from your material`
- `Enhanced with trusted web sources`
- `Enhanced with web sources because your uploaded material did not fully cover this topic`

## Error Handling

### No uploaded materials

If no uploaded materials exist:
- still allow web fallback
- explain that no study material was available
- clearly label the answer as web-based

### Web retrieval failure

If web retrieval fails:
- answer from PDFs if possible
- otherwise show a clear error that neither material nor web sources produced enough context

### Low-confidence answer

If answer confidence remains low after all retrieval:
- return a cautious answer
- explicitly acknowledge uncertainty
- still offer quick check only if enough source grounding exists

## Security and Trust

- Do not silently blur the boundary between user material and web content
- Web-derived answers must be labeled
- Source links must remain visible
- Trusted-source allowlist must be configurable
- Broader web should be sanitized before display
- Mini-test questions must be grounded in retrieved context, not hallucinated from nothing

## Testing

### Backend tests

Add tests for:
- answer from PDFs only
- fallback to trusted web when PDFs are weak
- fallback to broader web when trusted sources are weak
- answer origin labeling
- quick-check inclusion logic
- quick-check grading response

### Frontend tests

Add tests for:
- answer origin badge render
- quick-check block render only when flagged
- quick-check submission flow
- targeted feedback render

### Manual validation

Validate:
- strong PDF-only topic
- missing-PDF topic that should hit trusted web
- very hard topic that should hit broader web
- complex topic that triggers quick check
- simple topic that does not

## Rollout Plan

### Phase 1

- extend current QA backend with orchestration hooks
- add trusted/broader web retrieval services
- return source-origin metadata

### Phase 2

- add quick-check generation and grading
- add chat UI for quick-check and feedback

### Phase 3

- tune thresholds
- improve domain curation
- add analytics hooks for future educator insight features

## Non-Goals

This feature does not include:
- long-form formal assessments
- educator dashboard analytics for quick checks
- full browsing mode UI
- general-purpose web agent outside Learning Chat
- autonomous browsing loops beyond bounded tiered retrieval

## Success Criteria

This feature is successful when:

- complex questions are answered more reliably than PDF-only mode
- users can still see whether answers came from their material or the web
- mini-tests feel small and helpful rather than intrusive
- the system degrades gracefully when PDFs or web search are weak
- the chat remains the single primary study interface
