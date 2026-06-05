# AI UI Surfacing Batch 2

## Goal
Make the second-wave AI systems unmistakably central in the product experience across:
- document study
- educator quiz authoring
- live meeting room
- class insights
- student progress

## Target pages
- `frontend/pages/document/[id].jsx`
- `frontend/pages/educator/quiz-maker.jsx`
- `frontend/components/VideoMeetingRoom.jsx`
- `frontend/pages/educator/class-insights.jsx`
- `frontend/pages/progress.jsx`

## Visibility targets
- Document study: `Deep Study Mode`
- Quiz maker: `Assessment Intelligence Studio`
- Meeting room: `AI Teaching Room`
- Class insights: `Insight Command Deck`
- Progress: `Progress Strategy Board`

## Implementation steps
1. Add a failing frontend contract test for the five new AI surfacing targets.
2. Reuse `AISpotlightBanner` where page-level framing helps.
3. Strengthen section naming and entry copy so the AI systems read like dedicated workspaces.
4. Keep the existing AI panels as the main action surfaces below the new spotlight layer.
5. Run targeted frontend contract tests plus a production build.

## Verification
- `cd frontend && node --test tests/ai-surfacing-batch-2-contract.test.mjs`
- `cd frontend && node --test tests/material-intelligence-contract.test.mjs tests/quiz-quality-contract.test.mjs tests/meeting-assistant-contract.test.mjs`
- `cd frontend && npm run build -- --no-lint`
