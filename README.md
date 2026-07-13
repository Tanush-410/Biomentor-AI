# VYDRA CORE

VYDRA CORE is a full-stack learning and classroom platform that combines AI-guided study, classroom management, educator intervention, and quiz delivery in one workspace.

The project includes:
- a `FastAPI` backend
- a `Next.js` frontend
- support for `Supabase/Postgres` as the main database
- support for `Qdrant` for retrieval and document search
- a local `SQLite` fallback for development when hosted database access is unavailable

## What VYDRA CORE Does

### Student experience
- upload study material and reopen it later
- read documents in-app with offline-friendly access
- ask material-grounded questions in Learning Chat
- fall back to trusted web sources automatically when uploaded material is insufficient
- generate quizzes from uploaded material
- take classroom exams with fixed-response and typed-answer flows
- earn VYDRA CORE-branded classroom certifications after completing tracks
- join classrooms with invite codes
- take classroom quizzes with protected attempts
- track progress across practice activity
- keep private sticky notes pinned to the exact app page where they were created
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
- create classroom exams with structured document blocks, descriptive answers, and proctoring
- review anti-cheat cases with evidence snapshots and teacher decisions
- create certification tracks and issue student certificates
- schedule quizzes for classrooms
- use proctored classroom quiz flows with warning/debar support
- monitor student progress, alerts, and intervention signals
- use private sticky notes across educator pages without exposing them to students

## Core Features

- AI learning chat grounded in uploaded material with automatic trusted-web fallback
- adaptive Quick Check mini-tests with short targeted feedback
- offline-friendly document viewing
- document upload and delete flows
- private colorful sticky notes tied to exact page URLs with drag, persistence, and per-user privacy
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
- classroom exam authoring, review, and anti-cheat case tracking
- certification authoring with issued certificate generation
- built-in WebRTC classroom meetings with FastAPI signaling
- dedicated meeting room route for live classes
- invite-code classroom enrollment
- AI-assisted browser-side proctoring warnings and auto-debar after repeated violations
- circular progress indicators across major student and educator pages

## How to Use VYDRA CORE

This guide is the recommended client walkthrough after the app is deployed and the backend health check is passing.

### 1. Create the first accounts

1. Open the deployed frontend URL.
2. Choose `Create Account`.
3. Create at least one educator account and one student account.
4. Sign in through the correct mode on `/login`.

Use educator mode for classroom setup, exams, quizzes, meetings, certifications, and review workflows. Use student mode for studying, joining classrooms, taking assessments, joining meetings, and earning certificates.

### 2. Student workflow

Students should start from the student dashboard and use this flow:

1. Go to `Materials`.
2. Upload a PDF, TXT, or Markdown file.
3. Open the uploaded material in the document viewer.
4. Use `Learning Chat` to ask source-grounded questions.
5. Use quick checks or generated quizzes to practice from the same material.
6. Join a classroom with the invite code shared by the educator.
7. Open classroom `Classwork` to take scheduled quizzes, exams, and certification tasks.
8. Use private sticky notes by right-clicking any page, writing the note, and leaving it there. Notes stay tied to that exact URL until deleted.

### 3. Educator workflow

Educators should start from educator mode and use this flow:

1. Create or open a classroom.
2. Copy the classroom invite code and send it to students.
3. Upload or attach materials for the class.
4. Use `Quiz Maker` to create manual quizzes or generate quizzes from uploaded material.
5. Use `Exam Maker` to build structured exam papers, add fixed response boxes, attach images or diagrams, add grading keywords, and schedule the exam.
6. Use `Live` to schedule or start an in-app WebRTC classroom meeting.
7. Use `Certification` to create a course track from links or custom tasks, then issue VYDRA CORE-branded certificates when students complete it.
8. Review student progress, classroom intelligence, proctor events, exam answers, and anti-cheat evidence from the educator review surfaces.

### 4. Classroom workflow

Classrooms are organized into these areas:

- `Stream`: announcements, meeting notices, and class updates.
- `Classwork`: scheduled quizzes, exams, certificates, and assignments.
- `People`: enrolled learners and classroom membership.
- `Messages`: educator-student communication.
- `Live`: built-in scheduled meetings and live session access.

Students join classrooms with invite codes. Educators control scheduling, publishing, and review.

### 5. Live meeting workflow

The meeting feature uses browser WebRTC for audio/video and FastAPI WebSockets only for signaling. For reliable hosted calls, configure TURN variables in Vercel.

Recommended meeting test:

1. Educator opens a classroom and goes to `Live`.
2. Educator schedules a meeting or starts an active meeting.
3. Student opens the same classroom `Live` tab and joins.
4. Both users allow camera and microphone permissions.
5. Confirm local video, remote video, and remote audio work on both sides.
6. Use mute, camera off, leave, and teacher end meeting controls.

If two people cannot see or hear each other on different networks, check that `NEXT_PUBLIC_TURN_URLS`, `NEXT_PUBLIC_TURN_USERNAME`, and `NEXT_PUBLIC_TURN_CREDENTIAL` are set in Vercel and that the frontend was redeployed after changing them.

### 6. Proctored quiz and exam workflow

VYDRA CORE supports protected attempts for classroom quizzes and exams.

Expected student flow:

1. Open the scheduled quiz or exam from classroom `Classwork`.
2. Grant camera permission when prompted.
3. Enter fullscreen when required.
4. Complete the attempt without switching tabs or hiding the camera.
5. Submit answers before time expires.

Expected educator flow:

1. Open the relevant classroom or educator review page.
2. Review attempts, warnings, debarred cases, and evidence snapshots.
3. For descriptive exam answers, use the grading review workspace to compare the student response against teacher keywords and AI grading support.
4. Make the final teacher decision before treating any anti-cheat event as conclusive.

Important: anti-cheat signals are decision-support evidence. A teacher should review the final case, warning history, and captured evidence before making a final academic decision.

### 7. Certification workflow

Educators can create certification tracks for classroom learning outcomes.

1. Open `Educator > Certification`.
2. Create a course with teacher-provided links or custom completion tasks.
3. Assign the course to a classroom or students.
4. Students complete the required steps.
5. VYDRA CORE generates a branded certificate with the student name, course name, completion metadata, and platform branding.

### 8. AI workspace workflow

VYDRA CORE's AI tools are designed as visible workspaces, not hidden widgets.

- `Material Intelligence Studio`: turns uploaded content into summaries, concept maps, misconception checks, viva prompts, and study paths.
- `AI Study Coach`: helps students choose what to revise next.
- `AI Educator Copilot`: helps teachers decide what to assign, who needs attention, and how to respond.
- `Classroom AI Board`: shows class-level focus signals and reteach opportunities.
- `Assessment Intelligence Studio`: reviews quiz quality, release risk, Bloom balance, remediation, and question health.
- `AI Meeting Assistant`: supports live class notes, follow-up prompts, and recap structure.
- `AI Proctor Review`: summarizes proctor evidence and review priority for teacher decisions.

### 9. Sticky notes workflow

Sticky notes are private to the signed-in user.

1. Right-click on an authenticated app page.
2. Add a note.
3. Drag it to the desired spot.
4. Type the reminder.
5. Leave it there to persist across logout/login.
6. Press delete only when the note should be permanently removed.

Notes are tied to the exact page URL where they were created, so a note on one classroom page will not appear on a different document or classroom route.

### 10. Client handoff checklist

Before a client uses VYDRA CORE in a real class, verify:

- The backend `/health` endpoint returns a healthy response.
- Render has production `DATABASE_URL`, Supabase keys, `SECRET_KEY`, Groq/Qdrant keys if used, and correct `CORS_ORIGINS`.
- Vercel has `NEXT_PUBLIC_API_URL` pointing to the Render backend.
- Vercel has TURN variables for hosted live meetings.
- Supabase is active and not paused.
- Login works for both student and educator mode.
- File upload and document viewing work from the hosted frontend.
- Classroom invite code join works.
- A sample quiz can be scheduled by the educator and opened by the student.
- A sample exam can be scheduled, attempted, and reviewed.
- A live meeting works between two devices or two different browser profiles.
- Certification creation and certificate generation work.
- Sticky notes persist after logout and can be deleted.

## Recent AI Platform Upgrades

VYDRA CORE now exposes its intelligence as explicit product workspaces instead of subtle helper text.

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
- sticky notes now mount as a global shell layer so students and educators can keep private page-specific reminders anywhere in the app

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
├── VYDRA CORE Web App.docx source product reference
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
- set frontend TURN variables in Vercel for production-grade meeting relay support

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
NEXT_PUBLIC_TURN_URLS=
NEXT_PUBLIC_TURN_URL=
NEXT_PUBLIC_TURN_USERNAME=
NEXT_PUBLIC_TURN_CREDENTIAL=
NEXT_PUBLIC_TURN_PASSWORD=
```

### Start frontend

```bash
cd frontend
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Frontend:
- app: `http://127.0.0.1:3000`

## Running with SQLite fallback

If hosted Postgres is unavailable, VYDRA CORE can run locally with SQLite by leaving `DATABASE_URL` empty in `backend/.env`.

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

## Production Deployment: Vercel + Render

VYDRA CORE should be deployed with:
- `Vercel` for the `frontend`
- `Render` for the `backend`
- `Supabase/Postgres` for production relational data
- `Qdrant` for vector retrieval

This split is important because the classroom meeting system uses FastAPI WebSockets for signaling. The backend should stay on Render instead of being deployed as Vercel Functions.

### 1. Deploy the backend to Render

Create a Render web service from the repo and set the service root to `backend`.

Render can use the included [backend/Dockerfile](/Users/tanush.s.vashisht/Desktop/Tanush/work/backend/Dockerfile:1), which binds `0.0.0.0:$PORT` correctly for production.

Set these Render variables:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.your-project.supabase.co:5432/postgres
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
QDRANT_URL=https://your-qdrant-endpoint
QDRANT_API_KEY=your_qdrant_api_key
GROQ_API_KEY=your_groq_api_key
SECRET_KEY=replace-this-with-a-long-random-secret
ENVIRONMENT=production
DEBUG=false
CORS_ORIGINS=["https://your-frontend.vercel.app","https://your-custom-domain.com"]
TRUSTED_SEARCH_DOMAINS=["khanacademy.org","britannica.com","nih.gov","nasa.gov",".edu/"]
WEB_FALLBACK_TOP_K=4
```

After deploy, confirm:
- `https://your-render-service.onrender.com/health`
- the response should include `"database_backend": "postgresql"`

### 2. Deploy the frontend to Vercel

Import the same repo into Vercel and set the project root to `frontend`.

Set these Vercel environment variables:

```env
NEXT_PUBLIC_API_URL=https://your-render-service.onrender.com
NEXT_PUBLIC_TURN_URLS=stun:stun.relay.metered.ca:80,turn:global.relay.metered.ca:80,turn:global.relay.metered.ca:80?transport=tcp,turn:global.relay.metered.ca:443,turns:global.relay.metered.ca:443?transport=tcp
NEXT_PUBLIC_TURN_USERNAME=your_turn_username
NEXT_PUBLIC_TURN_CREDENTIAL=your_turn_password
```

`NEXT_PUBLIC_TURN_URL` is still supported for one older single relay URL, but `NEXT_PUBLIC_TURN_URLS` is preferred for Metered or any provider that gives multiple STUN/TURN endpoints. Render does not need these TURN variables for the current meeting implementation because the backend only handles WebSocket signaling; the browser creates the audio/video peer connection directly.

After deploy, test:
- login
- classroom join by invite code
- Learning Chat
- built-in live meeting schedule and join
- educator quiz publish
- student proctored quiz start

### 3. Production notes

- Do **not** rely on SQLite in production.
- Do **not** leave `DEBUG=true`.
- Set a strong `SECRET_KEY`.
- Use a real TURN server for reliable classroom calls. STUN-only is not enough for many real-world networks.
- Put TURN credentials in Vercel as frontend environment variables, then redeploy the frontend so the browser bundle receives them.
- CORS is now environment-driven through `CORS_ORIGINS`, so Render should allow your Vercel domain once it is added there.

## Running with Qdrant

Set in `backend/.env`:

```env
QDRANT_URL=https://your-qdrant-endpoint
QDRANT_API_KEY=your_qdrant_api_key
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
- sticky notes render across authenticated app pages and stay tied to the exact URL where they were created

### Classroom module
- `/classrooms/[id]/stream`
- `/classrooms/[id]/classwork`
- `/classrooms/[id]/people`
- `/classrooms/[id]/messages`
- `/classrooms/[id]/live`
- `/classrooms/[id]/live/[meetingId]/room`

### Educator pages
- `/educator/quiz-maker`
- `/educator/exam-maker`
- `/educator/exam-review/[attemptId]`
- `/educator/certification`
- `/educator/anticheat-bot`
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
- `/api/sticky-notes`
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
