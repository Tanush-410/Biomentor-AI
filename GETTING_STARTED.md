# Getting Started

Use [README.md](README.md) as the primary guide.

This file is a shorter operational checklist for a fresh machine.

## Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

## Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev -- --hostname 127.0.0.1 --port 3000
```

## Default local URLs

- frontend: `http://127.0.0.1:3000`
- backend health: `http://127.0.0.1:8000/health`
- backend docs: `http://127.0.0.1:8000/api/docs`

## Environment guidance

### Backend

`backend/.env` supports:
- SQLite fallback if `DATABASE_URL` is blank
- Supabase/Postgres if `DATABASE_URL` is provided
- Qdrant if `QDRANT_URL` is configured
- Groq if `GROQ_API_KEY` is configured
- TURN placeholders for built-in classroom meetings

### Frontend

`frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_TURN_URL=
NEXT_PUBLIC_TURN_USERNAME=
NEXT_PUBLIC_TURN_CREDENTIAL=
```

## First smoke test

1. open `http://127.0.0.1:3000`
2. create student and educator accounts
3. upload study material
4. try Learning Chat
5. try Start Quiz
6. open Classrooms
7. open Educator Quiz Maker
8. open Classroom Live and join a meeting room

## If Supabase is unreachable

You can still run locally by leaving `DATABASE_URL` empty in `backend/.env`.

Then verify:

```bash
curl http://127.0.0.1:8000/health
```

Expected backend indicator:

```json
{
  "database_backend": "sqlite"
}
```
