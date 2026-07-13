# AI Study Coach Design

Date: 2026-05-31

## Goal

Add an `AI Study Coach` to VYDRA CORE so students get a more guided, assistant-driven learning journey across:
- dashboard
- progress
- materials
- learning chat

The coach should:
1. turn live quiz and material data into next-step study guidance
2. help students decide what to review next and why
3. keep recommendations lightweight and actionable
4. coordinate with Learning Chat and Quick Check behavior rather than duplicating it

## Product Decision

Version 1 is `student-facing first`.

This keeps the feature focused and polished:
- students get direct coaching where they already study
- educators keep using the Educator Copilot instead of seeing a second overlapping recommendation system

Later, Study Coach outputs may be exposed to educators as additional learner-facing context.

## User Experience

### Dashboard

The dashboard should feel less like a static snapshot and more like an active study plan.

The Study Coach should surface:
- a primary next step
- a short sequence of `Do this now` actions
- weak-skill focus areas
- a recommended material or chat follow-up

Examples:
- `Review Analyze-level questions before your next quiz`
- `Open Cell Division Notes and revisit the cited meiosis section`
- `Ask Learning Chat to compare mitosis and meiosis, then take the quick check`

### Progress

The progress page should explain performance rather than only show metrics.

The Study Coach should:
- interpret weak Bloom levels
- suggest a revision order
- recommend when to review, re-quiz, or ask follow-up questions
- provide a short coaching explanation for the current learning pattern

### Materials

The materials page should become more intelligent about what students should open next.

The Study Coach should:
- recommend which uploaded material to review next
- explain why that material is relevant
- identify whether the student should read, quiz, or chat from that material

### Learning Chat

The Learning Chat should stay the main conversational study surface.

The Study Coach should:
- suggest follow-up prompts after answers
- recommend when to use `Quick Check`
- reinforce the next best action after a complex topic or weak response

The coach should not replace chat answers. It should wrap them with guidance.

## Architecture

Build one shared backend `Study Coach` service and render it differently on each student page.

### Core layers

1. `Signal Aggregation`
   Collect:
   - uploaded materials
   - quiz progress
   - Bloom-level gaps
   - recent quizzes
   - recent learning-chat activity where available

2. `Study Coach Orchestrator`
   Convert those signals into:
   - primary next step
   - short study plan
   - weak-skill coaching summary
   - recommended material actions
   - chat follow-up suggestions

3. `Page-Specific Formatters`
   Transform the same intelligence into:
   - dashboard study cards
   - progress guidance cards
   - materials recommendations
   - chat follow-up coaching

## Backend Responsibilities

Create a shared service:
- `backend/app/services/study_coach.py`

Responsibilities:
- load live student learning state
- rank weak Bloom levels and nearby next actions
- choose a recommended material when available
- suggest whether the student should:
  - reread
  - ask Learning Chat
  - take a quiz
  - use Quick Check
- produce grounded, concise coaching outputs

### Suggested endpoints

- `GET /api/study-coach/overview`
  - dashboard coaching payload

- `GET /api/study-coach/progress`
  - progress interpretation and revision order

- `GET /api/study-coach/materials`
  - recommended materials and suggested actions

- `GET /api/study-coach/chat-suggestions`
  - recommended follow-up prompts and quick-check guidance

## Frontend Responsibilities

### Dashboard surface

Add an `AI Study Coach` panel that shows:
- your next best move
- why it matters
- a 2–4 step short plan

### Progress surface

Add a coaching panel that explains:
- where the student is struggling
- what order to practice in
- what kind of review is best next

### Materials surface

Add a recommendation panel that suggests:
- which uploaded material to open next
- why that material is relevant
- whether to review, quiz, or chat from it

### Learning Chat surface

Add a lightweight coaching card that suggests:
- good follow-up prompts
- when to take a quick check
- one next action after the answer

## AI Behavior

The Study Coach should feel like a guide, not a generic motivator.

It should:
- stay grounded in real user data
- prefer short action-oriented advice
- avoid overwhelming the student with too many options
- connect study actions across pages

## Version 1 Scope

Included:
- dashboard study coach panel
- progress coaching interpretation
- materials recommendation panel
- chat follow-up coaching
- shared backend Study Coach service

Not included yet:
- long-term weekly planning
- streak gamification
- calendar scheduling
- push/email reminders

## Success Criteria

Version 1 is successful if:
- students can tell what to do next without guessing
- the dashboard feels more guided than static
- the progress page explains weak areas clearly
- the materials page recommends what to open next
- learning chat feels more connected to the overall study journey
