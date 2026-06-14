#!/bin/bash
# Quick Start Script - Smart Learning Assistant

echo "🚀 Smart Learning Assistant - Quick Start"
echo "=========================================="
echo ""

# Check if .env exists
if [ ! -f "backend/.env" ]; then
    echo "❌ No backend/.env file found"
    echo "📝 Creating from template..."
    cp backend/.env.example backend/.env
    echo "✅ Created backend/.env - Update with your API keys!"
    exit 1
fi

# Activate venv
echo "📦 Activating Python environment..."
source .venv/bin/activate

# Backend
echo "🔧 Starting Backend (port 8000)..."
cd backend
python -c "from app.database import init_db; init_db()"
echo "✅ Database initialized"

echo ""
echo "🚀 Run these commands in separate terminals:"
echo ""
echo "Terminal 1 (Backend):"
echo "  cd backend"
echo "  source ../.venv/bin/activate"
echo "  python -m uvicorn app.main:app --reload"
echo ""
echo "Terminal 2 (Frontend):"
echo "  cd frontend"
echo "  npm install (first time only)"
echo "  npm run dev"
echo ""
echo "Then visit:"
echo "  🌐 Frontend: http://localhost:3000"
echo "  📚 API Docs: http://localhost:8000/api/docs"
echo ""
echo "✨ Happy learning!"
