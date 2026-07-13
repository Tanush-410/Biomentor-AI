# AI Educator Copilot Design

Date: 2026-05-31

## Goal

Add an `AI Educator Copilot` to VYDRA CORE so educators get actionable, draft-ready support across their daily workflow without automating decisions unsafely.

The copilot should:

1. prioritize which students or classrooms need attention first
2. draft educator-facing actions such as complaint replies and class announcements
3. explain class-level learning trends in plain language
4. recommend group review topics and next interventions
5. reuse signals already generated elsewhere in the product, including:
   - quiz results
   - progress gaps
   - classroom messages and complaints
   - classroom activity
   - AI Meeting Assistant outputs

## Product Decisions

- Build one shared copilot intelligence layer with multiple UI surfaces
- Make `Dashboard` the primary home for the copilot
- Surface supporting copilot panels in:
  - `Communication Hub`
  - `Class Insights`
- The copilot may `draft` and `suggest`, but it must never send or apply actions automatically
- Version 1 should prioritize:
  - daily intervention priorities
  - draft complaint/message replies
  - group review recommendations

## User Experience

### Dashboard

The educator dashboard becomes the main copilot home.

The copilot should show:
- daily intervention priorities
- at-risk students
- follow-up tasks after meetings
- suggested next actions

Examples:
- `Reply to Tanush about lab material visibility`
- `Review osmosis confusion across Biology Lab`
- `Schedule a short meiosis recap quiz`

The dashboard should feel like a command center:
- what needs attention
- why it needs attention
- what the educator can do next

### Communication Hub

The communication hub becomes the action surface for the copilot.

The copilot should:
- summarize complaints
- summarize long or repeated student messages
- suggest a reply draft
- suggest the urgency level
- suggest whether it should be resolved privately, class-wide, or escalated

This should help educators respond faster without forcing them to type every message from scratch.

### Class Insights

The class insights page becomes the analysis surface.

The copilot should:
- explain weak topics in plain language
- suggest group review sessions
- suggest what to reteach
- suggest what material to share next
- identify repeated confusion patterns

Instead of showing only analytics, the page should show what those analytics mean and what action to take.

## Architecture

This feature should be implemented as one shared backend service, not three separate copilot systems.

### Core layers

1. `Signal Aggregation`
   Collects educator-relevant inputs from:
   - classroom quiz attempts
   - user progress
   - complaints
   - direct messages
   - class insights/topic trends
   - AI meeting recaps

2. `Copilot Orchestrator`
   Combines those signals into:
   - ranked intervention priorities
   - draft communications
   - class-level recommendations

3. `Page-Specific Surface Formatters`
   Transform the same intelligence into:
   - dashboard cards
   - communication suggestions
   - class-insights recommendations

4. `Action Draft Safety Layer`
   Ensures drafts are suggestions only.
   No message, announcement, or intervention can be sent automatically.

## Backend Responsibilities

### Shared copilot service

Create a new service layer responsible for:
- loading educator classrooms
- aggregating weak students and weak topics
- summarizing complaints/messages
- generating draft replies
- generating group review recommendations
- exposing normalized copilot payloads to multiple routes

### Suggested route additions

Extend or add educator endpoints such as:

- `GET /api/educator/copilot/dashboard`
  - daily intervention priorities
  - meeting follow-up suggestions
  - recommended educator actions

- `GET /api/educator/copilot/communication`
  - complaint/message summaries
  - reply drafts
  - urgency and escalation guidance

- `GET /api/educator/copilot/class-insights`
  - plain-language topic explanations
  - review recommendations
  - material/quiz follow-up suggestions

If existing educator endpoints are a better fit, these may be merged into them instead of creating brand-new top-level routes, but the internal service should still stay shared.

### Draft generation

For version 1, drafts should include:
- short reply body
- suggested tone
- target audience hint
- one recommended next step

Examples:
- private reply draft to a student complaint
- class-wide announcement draft after a weak quiz result
- reminder draft tied to a meeting recap

## Frontend Responsibilities

### Dashboard surface

Add an `AI Educator Copilot` panel to the educator dashboard.

It should show:
- priority cards
- one-line rationale
- suggested action
- quick links to the relevant classroom, student, or communication surface

### Communication Hub surface

Add a copilot assistance module near the inbox and compose area.

It should show:
- summarized complaint/message context
- draft response
- recommended handling mode

The educator should be able to copy or apply the draft into the compose form, but still edit before sending.

### Class Insights surface

Add a recommendation section that explains:
- what trend matters
- why it matters
- what to do next

This should feel more like an academic strategist and less like a static dashboard.

## AI Behavior

### Daily intervention priorities

The copilot should identify:
- students with repeated quiz weakness
- unresolved complaints
- classes with common concept confusion
- meeting follow-up tasks still pending

### Draft replies

The copilot should produce concise, educator-appropriate message drafts.

It should not:
- overpromise
- fabricate facts
- auto-send

### Group review recommendations

The copilot should recommend:
- which topic to reteach
- which class it affects
- what kind of follow-up is best
  - short recap
  - extra material
  - mini quiz
  - live review session

## Data Sources

The copilot should ground itself in:
- classroom performance data
- complaint and message content
- classroom and meeting context
- AI Meeting Assistant recap outputs when available

It should avoid generic advice when classroom-specific evidence exists.

## Version 1 Scope

Included:
- dashboard copilot panel
- communication reply drafting
- class-insights recommendation panel
- shared backend copilot intelligence service

Not included yet:
- automatic sending
- parent/admin escalation workflows
- long-term intervention tracking
- institution-wide copilot actions beyond current analytics

## Success Criteria

Version 1 is successful if:
- educators can see what needs attention first
- educators can respond faster to complaints and messages
- educators can understand weak class trends without interpreting raw metrics manually
- the product feels more assistant-driven without removing educator control
