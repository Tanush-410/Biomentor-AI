# BioMentor AI

BioMentor AI is a full-stack learning and classroom platform that combines AI-guided study, classroom management, educator intervention, and quiz delivery in one workspace.

The project includes:
- a `FastAPI` backend
- a `Next.js` frontend
- support for `Supabase/Postgres` as the main database
- support for `Qdrant` for retrieval and document search
- a local `SQLite` fallback for development when hosted database access is unavailable

## What BioMentor AI Does

### Student experience
- upload study material and reopen it later
- read documents in-app with offline-friendly access
- ask material-grounded questions in Learning Chat
- fall back to trusted web sources automatically when uploaded material is insufficient
- generate quizzes from uploaded material
- join classrooms with invite codes
- take classroom quizzes with protected attempts
- track progress across practice activity
- participate in classrooms, built-in live meetings, and educator communication

### Educator experience
- manage classrooms with dedicated pages
- post public announcements to a class
- send private teacher-student messages
- share class materials
- schedule and run built-in classroom meetings
- create quizzes in dual mode:
  - generate from material
  - build manually with answer keys
- schedule quizzes for classrooms
- use proctored classroom quiz flows with warning/debar support
- monitor student progress, alerts, and intervention signals

## Core Features

- AI learning chat grounded in uploaded material with automatic trusted-web fallback
- adaptive Quick Check mini-tests with short targeted feedback
- offline-friendly document viewing
- document upload and delete flows
- classroom hub with:
  - `Stream`
  - `Classwork`
  - `People`
  - `Messages`
  - `Live`
- educator communication hub
- collaboration hub
- Bloom's Taxonomy support
- material-based quiz generation
- manual quiz authoring with answer-key autograding
- classroom quiz scheduling
- built-in WebRTC classroom meetings with FastAPI signaling
- dedicated meeting room route for live classes
- invite-code classroom enrollment
- AI-assisted browser-side proctoring warnings and auto-debar after repeated violations
- circular progress indicators across major student and educator pages

## Recent AI Platform Upgrades

BioMentor AI now exposes its intelligence as explicit product workspaces instead of subtle helper text.

### Upgraded AI Workspaces
- `Material Intelligence Studio`
  - layered summaries
  - concept maps
  - misconception traps
  - viva questions
  - study paths
- `AI Mission Control`
  - stronger dashboard-level study and intervention surfacing
- `AI Reasoning Mode`
  - clearer Learning Chat source grounding and quick-check support
- `Classroom AI Board`
  - class focus signals
  - reteach recommendations
  - student focus groups
- `AI Teaching Room`
  - upgraded meeting assistant surfacing inside live sessions
- `Assessment Intelligence Studio`
  - stronger quiz review, release-risk analysis, and remediation guidance
- `Copilot Response Center`
  - educator reply drafting and intervention guidance
- `Progress Strategy Board`
  - more visible study-coaching and checkpoint planning

### AI Systems Upgraded
- `AI Material Intelligence`
  - now behaves like a study engine rather than a simple summary card
- `AI Study Coach`
  - now produces study modes, daily goals, weekly plans, checkpoint goals, and recovery paths
- `AI Classroom Intelligence`
  - now distinguishes class-wide patterns, student focus groups, and reteach recommendations
- `AI Meeting Assistant`
  - now produces stronger teacher moves, concept signals, follow-up assets, and student-safe recaps
- `AI Educator Copilot`
  - now drafts sharper educator actions and intervention guidance
- `AI Quiz Quality Layer`
  - now gives assessment focus, release risk, question health, fix-first priorities, and remediation plans
- `AI Proctor Review`
  - now gives case posture, evidence strength, review priority, debar guidance, and follow-up actions

### UI + Formatting Improvements
- AI surfaces were reworked so they format cleanly inside sidebars and narrow classroom rails
- the upgraded AI cards now wrap and stack correctly instead of collapsing into unreadable vertical text
- the main classroom and quiz-maker layouts were widened and rebalanced so AI panels feel intentional, not squeezed

## AI Features Map

These AI systems are part of the project and are implemented inside the `backend` and `frontend` folders, not as separate top-level root files.

### AI Meeting Assistant
- backend: `backend/app/services/meeting_assistant.py`
- frontend: `frontend/components/MeetingAssistantPanel.jsx`

### AI Educator Copilot
- backend: `backend/app/services/educator_copilot.py`
- frontend: `frontend/components/EducatorCopilotPanel.jsx`

### AI Study Coach
- backend: `backend/app/services/study_coach.py`
- frontend: `frontend/components/StudyCoachPanel.jsx`

### AI Classroom Intelligence
- backend: `backend/app/services/classroom_intelligence.py`
- frontend: `frontend/components/ClassroomIntelligencePanel.jsx`

### AI Quiz Quality Layer
- backend: `backend/app/services/quiz_quality.py`
- frontend: `frontend/components/QuizQualityPanel.jsx`

### AI Material Intelligence
- backend: `backend/app/services/material_intelligence.py`
- frontend: `frontend/components/MaterialIntelligencePanel.jsx`

### AI Proctor Review
- backend: `backend/app/services/proctor_review.py`
- frontend: `frontend/components/ProctorReviewPanel.jsx`

### Shared AI Quality + Retrieval Support
- `backend/app/services/ai_quality.py`
- `backend/app/services/ai_evidence.py`
- `backend/app/services/ai_generation.py`
- `backend/app/services/ai_evaluation.py`
- `backend/app/services/web_retrieval.py`
- `frontend/components/QuickCheckCard.jsx`

## Project Structure

```text
.
├── backend/                  FastAPI API, database models, routers, tests
├── frontend/                 Next.js web app
├── docs/                     specs and implementation plans
├── project-documents/        project writeups and delivery documents
├── BioMentor AI Web App.docx source product reference
├── docker-compose.yml        local container setup
├── GETTING_STARTED.md        quick operational guide
├── QUICK_START.md            condensed startup reference
└── README.md
```

## Tech Stack

### Frontend
- Next.js 14
- React 18
- Tailwind CSS
- Lucide React
- Recharts

### Backend
- FastAPI
- SQLAlchemy
- Pydantic
- python-jose
- bcrypt
- pypdf

### Data + AI
- Supabase/Postgres for primary structured data
- SQLite fallback for local development
- Qdrant for vector storage and retrieval
- Groq for LLM-backed answer and question generation
- WebRTC mesh calls for built-in classroom meetings
- requests-based web retrieval fallback for complex topic support

## Local Setup

### Prerequisites
- Python 3.9.6
- Node.js 18+
- npm

Optional:
- Qdrant local or Qdrant Cloud
- Supabase project

## 1. Clone and enter the project

```bash
git clone https://github.com/Tanush-410/Biomentor-AI.git
cd Biomentor-AI
```

## 2. Backend setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Update `backend/.env` with your values.

Minimum local-development path:
- leave `DATABASE_URL` empty to use SQLite fallback
- set a `SECRET_KEY`
- optionally set `GROQ_API_KEY`

If you want hosted infra:
- set `DATABASE_URL` to your Supabase/Postgres URI
- set `SUPABASE_URL`
- set `SUPABASE_KEY`
- set `SUPABASE_SERVICE_KEY`
- set `QDRANT_URL`
- set `QDRANT_API_KEY` if needed
- tune `TRUSTED_SEARCH_DOMAINS` and `WEB_FALLBACK_TOP_K` if you want different fallback search behavior
- set `TURN_URL`, `TURN_USERNAME`, and `TURN_CREDENTIAL` for production-grade meeting relay support

### Start backend

```bash
cd backend
source .venv/bin/activate
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Backend endpoints:
- API root: `http://127.0.0.1:8000`
- health: `http://127.0.0.1:8000/health`
- docs: `http://127.0.0.1:8000/api/docs`

## 3. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env.local
```

`frontend/.env.local` should contain:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_TURN_URL=
NEXT_PUBLIC_TURN_USERNAME=
NEXT_PUBLIC_TURN_CREDENTIAL=
```

### Start frontend

```bash
cd frontend
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Frontend:
- app: `http://127.0.0.1:3000`

## Running with SQLite fallback

If hosted Postgres is unavailable, BioMentor can run locally with SQLite by leaving `DATABASE_URL` empty in `backend/.env`.

The backend health endpoint will then show:

```json
{
  "database_backend": "sqlite"
}
```

This is useful for:
- demos
- local testing
- development without network access to Supabase

## Running with Supabase

Set `DATABASE_URL` in `backend/.env` to your direct Postgres connection string.

Example:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.your-project.supabase.co:5432/postgres
```

If the backend connects correctly, `/health` will show:

```json
{
  "database_backend": "postgresql"
}
```

## Running with Qdrant

Set in `backend/.env`:

```env
QDRANT_URL=https://your-qdrant-endpoint
QDRANT_API_KEY=your_qdrant_api_key
TURN_URL=
TURN_USERNAME=
TURN_CREDENTIAL=
```

The app is structured to use Qdrant-backed retrieval when available, with safer fallback behavior when vector search is unavailable.

## Important Routes

### Public
- `/`
- `/login`
- `/register`
- `/forgot-password`

### Student + educator shared app
- `/dashboard`
- `/documents`
- `/document/[id]`
- `/learning-chat`
- `/start-quiz`
- `/quiz-session`
- `/progress`
- `/classrooms`

### Classroom module
- `/classrooms/[id]/stream`
- `/classrooms/[id]/classwork`
- `/classrooms/[id]/people`
- `/classrooms/[id]/messages`
- `/classrooms/[id]/live`
- `/classrooms/[id]/live/[meetingId]/room`

### Educator pages
- `/educator/quiz-maker`
- `/educator/class-insights`
- `/educator/student/[id]`
- `/communication-hub`
- `/collaboration-hub`
- `/admin/analytics`

## Backend API Areas

- `/api/auth`
- `/api/documents`
- `/api/quiz`
- `/api/qa`
- `/api/classrooms`
- `/api/educator`
- `/api/collaboration`

## What to Demo First

1. Register one educator and one student
2. Create a classroom as educator
3. Join that classroom as student using the invite code
4. Publish a classroom quiz from Educator Quiz Maker
5. Open the same classroom as student and start the protected quiz
6. Start a built-in live meeting from the classroom `Live` tab

## Testing and Verification

### Frontend

```bash
cd frontend
npm run build
```

### Backend tests

```bash
cd backend
python3 -m unittest discover -s tests -v
```

### Health check

```bash
curl http://127.0.0.1:8000/health
```

## Notes for Clients

- This repository includes the full application source and supporting documents.
- Local secrets are intentionally not committed.
- Runtime-generated files like uploads, local databases, build output, and environment files are excluded so the repo stays clean and portable.
- To run the app, create your own local `.env` and `.env.local` files from the provided examples.

## Recommended First Run

1. Start backend with SQLite fallback
2. Start frontend
3. Create one student account and one educator account
4. Upload sample study material
5. Test:
   - Learning Chat
   - Quiz generation
   - Classrooms
   - Educator Quiz Maker

## Supporting Documents

Additional project documentation is included in:
- `project-documents/`
- `docs/`
- `GETTING_STARTED.md`
- `QUICK_START.md`

## License

This repository is currently being prepared for client delivery. Add your preferred license before public commercial distribution.
