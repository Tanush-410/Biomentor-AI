# Quick Start

Use [README.md](README.md) as the main setup guide.

## Fastest local run

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev -- --hostname 127.0.0.1 --port 3000
```

## Main local URLs

- frontend: `http://127.0.0.1:3000`
- backend health: `http://127.0.0.1:8000/health`
- backend docs: `http://127.0.0.1:8000/api/docs`

## Recommended first checks

1. Create a student account
2. Create an educator account
3. Upload a material file
4. Test Learning Chat
5. Test Start Quiz
6. Test Classrooms with an invite code
7. Test Educator Quiz Maker
8. Test Classroom Live meeting room

## Infrastructure note

- If `DATABASE_URL` is unset, the backend falls back to local SQLite.
- If `DATABASE_URL` is set correctly, the backend uses Supabase/Postgres.
- Qdrant is optional for local startup but supported by the app.
- TURN env vars are placeholders for production-ready classroom meeting relay.
