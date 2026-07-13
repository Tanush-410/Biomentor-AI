# VYDRA CORE Deployment Document

## Document Control

- Project: VYDRA CORE
- Document Type: Deployment Guide
- Version: 1.0
- Date: 13 May 2026

## 1. Purpose

This document explains how to configure, deploy, verify, and troubleshoot the VYDRA CORE application across local, development, and cloud-backed environments.

## 2. Deployment Overview

VYDRA CORE consists of:

- a Next.js frontend
- a FastAPI backend
- a relational database
- optional vector retrieval infrastructure
- environment-specific secrets and integration settings

## 3. Target Environments

### 3.1 Local Development

- Frontend on `127.0.0.1:3000`
- Backend on `127.0.0.1:8000`
- SQLite fallback or remote PostgreSQL
- Optional Qdrant Cloud or local Qdrant

### 3.2 Cloud-Backed Development or Demo

- Frontend on a managed host such as Vercel or equivalent
- Backend on a Python API host
- Supabase/PostgreSQL as primary DB
- Qdrant Cloud as vector store

### 3.3 Production Target

- Managed frontend hosting
- Managed API hosting
- Managed PostgreSQL
- Managed Qdrant
- Secret store and HTTPS-only networking
- Object storage for user uploads

## 4. Prerequisites

### 4.1 Tooling

- Node.js and npm
- Python 3.9 or higher
- pip
- access to Supabase or PostgreSQL if not using local SQLite
- access to Qdrant if vector retrieval is required

### 4.2 Accounts and External Services

- Supabase project for primary relational data
- Qdrant cluster for vector retrieval
- Groq API key or equivalent model provider
- optional Ollama endpoint for local model experiments

## 5. Repository Structure

- `frontend/` contains the Next.js application
- `backend/` contains the FastAPI API, models, services, and routers
- `project-documents/` contains formal project documentation

## 6. Environment Configuration

## 6.1 Backend Environment Variables

Typical backend settings include:

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `SUPABASE_SERVICE_KEY`
- `GROQ_API_KEY`
- `SECRET_KEY`
- `QDRANT_URL`
- `QDRANT_API_KEY`
- `ENVIRONMENT`
- `DEBUG`
- `API_HOST`
- `API_PORT`

## 6.2 Frontend Environment Variables

The frontend should include:

- `NEXT_PUBLIC_API_URL`

Example:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

## 7. Database Modes

## 7.1 Recommended Primary Mode

Use PostgreSQL or Supabase in hosted or persistent environments.

## 7.2 Development Fallback

If managed database connectivity is unavailable, use:

```env
DATABASE_URL=sqlite:///./app.db
```

This enables the backend to start locally without remote database access.

## 8. Qdrant Configuration

Qdrant is used for vector search and retrieval augmentation.

Recommended settings:

```env
QDRANT_URL=https://your-cluster-endpoint
QDRANT_API_KEY=your-qdrant-api-key
```

If Qdrant is unavailable, the application should fall back to non-vector retrieval behavior for development continuity.

## 9. Local Deployment Steps

### 9.1 Backend

1. Change into the backend directory.
2. Install dependencies.
3. Set the required environment variables.
4. Start the backend server.

Example:

```bash
cd backend
pip install -r requirements.txt
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

If hosted database connectivity is unavailable:

```bash
cd backend
DATABASE_URL=sqlite:///./app.db python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### 9.2 Frontend

1. Change into the frontend directory.
2. Install dependencies.
3. Start the development server.

Example:

```bash
cd frontend
npm install
npm run dev -- --hostname 127.0.0.1 --port 3000
```

## 10. Build and Release Validation

### 10.1 Frontend Build Validation

```bash
cd frontend
npm run build
```

### 10.2 Backend Syntax Validation

Suggested validation:

```bash
python3 -c "import pathlib; compile(pathlib.Path('backend/app/main.py').read_text(), 'backend/app/main.py', 'exec')"
```

## 11. Health and Smoke Checks

### 11.1 Backend Health

```bash
curl http://127.0.0.1:8000/health
```

Expected output includes:

- `status: healthy`
- selected `database_backend`

### 11.2 Frontend Smoke Checks

Validate:

- `http://127.0.0.1:3000`
- `http://127.0.0.1:3000/login`
- role-aware dashboard after login

## 12. Deployment Sequence for Demo or Production-Like Setup

1. Provision PostgreSQL or Supabase.
2. Provision Qdrant cluster.
3. Configure backend environment variables.
4. Configure frontend `NEXT_PUBLIC_API_URL`.
5. Deploy backend.
6. Run backend health check.
7. Deploy frontend.
8. Validate login, dashboard, document upload, quiz, and educator messaging.

## 13. Data Migration and Schema Management

The current design supports incremental schema evolution at startup. For more mature production deployment:

- adopt explicit migration tooling such as Alembic
- version schema changes
- validate upgrade and rollback paths

## 14. Security Hardening for Deployment

- rotate all exposed keys before public deployment
- use a strong production `SECRET_KEY`
- store secrets in environment or secret manager, not in source control
- force HTTPS
- restrict CORS to approved origins
- isolate admin credentials
- enable monitoring and access logs
- move uploaded files to managed object storage in production

## 15. Monitoring and Operations

Minimum recommended checks:

- backend health endpoint
- frontend availability
- database connectivity
- Qdrant availability
- upload success/failure rate
- login failure rate
- complaint and collaboration event persistence

## 16. Backup and Recovery

### 16.1 Database

- enable managed backups in Supabase or PostgreSQL provider
- define recovery point expectations

### 16.2 Files

- local-only deployments should back up upload directories
- production should use durable object storage with backup policy

### 16.3 Vector Data

- maintain ability to rebuild vectors from document chunks if needed

## 17. Rollback Approach

### Frontend

- redeploy last known good build

### Backend

- redeploy last known good image or code revision
- restore prior environment variables if a config change caused failure

### Database

- restore from backup if schema or data corruption occurs

## 18. Troubleshooting Guide

### Problem: Frontend shows white page

Possible causes:

- frontend dev server not running
- stale cache or service worker issue
- API base URL mismatch

Actions:

- restart frontend
- hard refresh browser
- verify `NEXT_PUBLIC_API_URL`

### Problem: Backend fails on startup

Possible causes:

- invalid environment variables
- remote PostgreSQL or Supabase connectivity issue
- missing dependencies

Actions:

- check logs
- verify `DATABASE_URL`
- test with SQLite fallback

### Problem: Educator does not receive complaint or message

Possible causes:

- user not enrolled in classroom
- websocket not connected
- backend route failure

Actions:

- verify classroom join
- verify educator dashboard or communication hub is open
- check backend logs and complaint/message API response

### Problem: Qdrant retrieval does not work

Possible causes:

- invalid cluster URL or API key
- collection missing
- network restriction

Actions:

- verify `QDRANT_URL`
- verify `QDRANT_API_KEY`
- test fallback retrieval path

## 19. Recommended Production Roadmap

- replace local upload storage with object storage
- add formal migrations
- add background workers for extraction and indexing
- add centralized logging and metrics
- add stronger auth/session management
- validate cost and latency controls for AI usage

## 20. Deployment Sign-Off Checklist

- environment variables configured
- backend health green
- frontend routes accessible
- student login tested
- educator login tested
- document upload tested
- quiz generation tested
- complaint and message flow tested
- Bloom's Question Studio tested
- collaboration hub tested

