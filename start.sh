#!/bin/bash
# Start VYDRA CORE locally: launches the backend (FastAPI) and frontend
# (Next.js) dev servers in the background and prints their URLs.
set -e

cd "$(dirname "$0")"

if [ ! -f "backend/.env" ]; then
    echo "No backend/.env file found - creating from template."
    cp backend/.env.example backend/.env
    echo "Created backend/.env - add your GROQ_API_KEY (and any other keys) before continuing."
    exit 1
fi

if [ ! -d ".venv" ]; then
    echo "No .venv found - creating one and installing backend dependencies..."
    python3 -m venv .venv
    ./.venv/bin/pip install -r backend/requirements.txt
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    (cd frontend && npm install)
fi

if [ ! -f "frontend/.env.local" ]; then
    cp frontend/.env.example frontend/.env.local
    echo "Created frontend/.env.local from template."
fi

mkdir -p .run

echo "Initializing database..."
(cd backend && ../.venv/bin/python -c "from app.database import init_db; init_db()")

echo "Starting backend on http://127.0.0.1:8000 ..."
(cd backend && nohup ../.venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 \
    > ../.run/backend.log 2>&1 & echo $! > ../.run/backend.pid)

echo "Starting frontend on http://127.0.0.1:3000 ..."
(cd frontend && nohup npm run dev -- --hostname 127.0.0.1 --port 3000 \
    > ../.run/frontend.log 2>&1 & echo $! > ../.run/frontend.pid)

sleep 3

echo ""
echo "VYDRA CORE is starting up:"
echo "  Frontend: http://127.0.0.1:3000"
echo "  Backend health: http://127.0.0.1:8000/health"
echo "  API docs: http://127.0.0.1:8000/api/docs"
echo ""
echo "Logs: .run/backend.log and .run/frontend.log"
echo "Stop both with: ./stop.sh"
