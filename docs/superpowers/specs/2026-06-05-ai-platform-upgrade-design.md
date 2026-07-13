# AI Platform Upgrade Design

Date: 2026-06-05

## Goal

Upgrade VYDRA CORE so its named AI systems feel indispensable rather than generic, while making those systems much more visible and valuable in the product UI.

This upgrade is balanced across both sides of the product:
- student value
- educator value

The systems remain separate rather than being collapsed into one umbrella assistant.

## Product Direction

The upgrade program follows two linked principles:

1. AI job quality first
   Each AI system must become much better at its specific task before it is made louder in the interface.

2. Stronger AI surfacing second
   Once the systems are sharper, the UI should make them obvious, differentiated, and easy to use.

This avoids a failure mode where more prominent AI draws attention to weak or generic behavior.

## Scope

This program covers the following AI systems:

- AI Material Intelligence
- AI Study Coach
- AI Classroom Intelligence
- AI Meeting Assistant
- AI Educator Copilot
- AI Quiz Quality Layer
- AI Proctor Review

It also covers the frontend surfaces where those systems appear.

## Non-Goals

This phase does not:
- replace the current model providers wholesale
- merge all AI systems into one assistant
- redesign unrelated non-AI workflows
- add voice-agent behavior or autonomous action sending

## Recommended Delivery Shape

The work should be delivered as one coordinated upgrade program with two phases:

### Phase A: Deep AI Quality Upgrade

Improve specificity, grounding, actionability, and confidence handling in each AI system.

### Phase B: AI Product Surfacing Upgrade

Redesign pages so the upgraded systems are clearly visible, task-oriented, and integrated into the workflow.

## System-by-System Upgrade Design

### 1. AI Material Intelligence

Current problem:
- feels like a smart summary panel, but not a differentiated study engine

Target behavior:
- turn uploaded material into layered, exam-focused study support

New outputs:
- concept map summary
- layered summaries:
  - quick overview
  - medium-depth explanation
  - exam-focused explanation
- key points by topic
- misconception traps
- grouped flashcards
- likely viva or oral questions
- prerequisite warnings with recommended pre-study topics

Rules:
- outputs should be derived from real document content, not generic subject priors
- when coverage is weak, the system should say so instead of overgeneralizing

Frontend surfacing:
- documents list page gets a stronger AI preview card
- document detail page gets a prominent Material Intelligence workspace with tabs or sections for:
  - summary
  - key points
  - flashcards
  - viva questions
  - study traps

### 2. AI Study Coach

Current problem:
- advice is useful but still too general and passive

Target behavior:
- act like an adaptive study planner that tells the student what to do next and why

New outputs:
- next-best-action recommendation
- daily study goal
- weekly checkpoint plan
- mode switching:
  - revision mode
  - reinforcement mode
  - challenge mode
- weak-area recovery path
- recommended order of documents, chat, and quizzes

Rules:
- recommendations should be based on:
  - quiz performance
  - classroom activity
  - weak topics
  - uploaded materials
- advice should be short, concrete, and sequenced

Frontend surfacing:
- dashboard gets a primary Study Coach module, not a subtle support card
- progress page gets a visible coach rail with:
  - current mode
  - next action
  - what to review next
- learning chat gets stronger coach follow-ups after answers and quick checks

### 3. AI Classroom Intelligence

Current problem:
- class summaries exist, but they do not yet explain the learning state with enough specificity

Target behavior:
- explain what is happening in the classroom, why it matters, and what should happen next

Teacher outputs:
- topic-level confusion clusters
- class-wide vs individual gap separation
- reteach recommendations
- class momentum summary
- suggested next materials or quiz actions

Student outputs:
- class focus summary
- personal focus summary
- what to revise before the next class
- what the teacher is likely to revisit

Rules:
- must connect signals across:
  - classwork
  - quizzes
  - meetings
  - messages
- should label stronger patterns as confirmed and weaker ones as emerging

Frontend surfacing:
- stream page gets a strong AI classroom insight module
- classwork gets next-step intelligence
- teacher view shows actionable classroom diagnosis
- student view shows simpler class guidance

### 4. AI Meeting Assistant

Current problem:
- useful foundation exists, but the assistant still feels more like structured notes than a premium live copilot

Target behavior:
- become a real teacher-side meeting copilot during live sessions

Teacher-live outputs:
- live notes
- action items
- unresolved doubts
- important concept flags
- likely follow-up material suggestions
- likely follow-up quiz suggestions

Post-meeting outputs:
- teacher recap
- student-safe recap
- follow-up tasks

Rules:
- teacher gets richer live intelligence
- students do not see the teacher’s private live assistant
- summaries should distinguish between:
  - what was taught
  - what was assigned
  - what remains unclear

Frontend surfacing:
- dedicated meeting room gets a stronger assistant panel
- classroom live lobby gets recap modules that are clearly AI-generated
- teacher controls should include explicit actions like:
  - mark doubt
  - generate recap
  - create follow-up suggestions

### 5. AI Educator Copilot

Current problem:
- valuable, but still too soft and generic in places

Target behavior:
- act like an operational teaching copilot that prioritizes, drafts, and explains

New outputs:
- ranked intervention priorities
- draft complaint replies
- draft student messages
- draft group announcements
- recommended next teaching actions
- urgency classification:
  - act now
  - monitor
  - low priority

Rules:
- every recommendation should have a short reason
- drafts should stay editable and never auto-send
- signals should combine:
  - complaints
  - performance
  - meetings
  - class trends

Frontend surfacing:
- dashboard gets a more prominent Educator Copilot command panel
- communication hub gets draft and tone support with clear AI entry points
- class insights gets stronger explanatory cards and recommended action modules

### 6. AI Quiz Quality Layer

Current problem:
- quality review works, but should feel more like expert assessment guidance

Target behavior:
- behave like a serious quiz reviewer before release

New outputs:
- distractor weakness analysis
- shallow question-set warnings
- Bloom distribution analysis
- timing adequacy review
- answer-pattern repetition warnings
- remediation suggestions after quiz results

Rules:
- feedback should be concrete and tied to actual quiz structure
- avoid generic “improve this” phrasing

Frontend surfacing:
- quiz maker gets a prominent quality review panel before publish
- release readiness should be visually strong and hard to miss

### 7. AI Proctor Review

Current problem:
- review exists, but should better support educator decisions

Target behavior:
- turn raw incidents into educator-decision support

New outputs:
- suspicion severity
- strongest evidence summary
- weak-signal vs strong-signal distinction
- incident timeline
- student-by-student summaries
- debar recommendation language

Rules:
- avoid overstating uncertain incidents
- clearly distinguish heuristic warnings from stronger patterns

Frontend surfacing:
- educator-facing quiz review should have a strong Proctor Review area
- student analytics should surface proctor review in a clearer, more formal way

## Shared Quality Expectations

All upgraded AI systems should:
- use stronger evidence packaging
- explain confidence more clearly
- avoid generic filler language
- stay conservative when evidence is weak
- prefer actionable outputs over descriptive outputs
- return structured data that the UI can present clearly

## Frontend Surfacing Strategy

The UI upgrade should make AI obviously useful without making the product noisy.

Principles:
- every major page gets one primary AI surface, not many equal-weight ones
- AI sections should be named and task-oriented
- calls to action should be explicit
- AI outputs should look like product modules, not side notes

Examples of stronger CTA language:
- Ask Study Coach
- Review With Material Intelligence
- Open Educator Copilot
- Generate Meeting Recap
- Check Quiz Quality
- Review Proctor Signals

## Delivery Order

Recommended build order:

1. Material Intelligence
2. Study Coach
3. Classroom Intelligence
4. Meeting Assistant
5. Educator Copilot
6. Quiz Quality Layer
7. Proctor Review
8. frontend surfacing pass across all upgraded systems

This order maximizes visible student and educator value while preserving coherent data dependencies.

## Testing Strategy

Each system upgrade should include:
- backend unit tests for structured outputs
- frontend contract tests for new UI states
- regression coverage for prior behavior
- manual spot-checks on representative student and educator flows

Acceptance standard:
- the upgraded system must be more specific, more actionable, and more visible than the current version
- no AI section should feel like generic filler text pasted into a panel

## Success Criteria

The upgrade is successful when:
- students feel the AI actively guides study, not just comments on it
- educators feel the AI saves time and sharpens decisions
- AI systems are clearly visible and easy to find in the interface
- outputs are specific enough that users can immediately act on them
- the product feels differentiated as an AI-heavy learning platform, not a standard app with scattered AI widgets
