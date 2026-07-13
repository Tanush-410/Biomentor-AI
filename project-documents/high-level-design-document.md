# VYDRA CORE High Level Design Document

## Document Control

- Project: VYDRA CORE
- Document Type: High Level Design
- Version: 1.0
- Date: 13 May 2026

## 1. Purpose

This document describes the high-level architecture, core components, data flows, deployment topology, and design decisions for the VYDRA CORE web application.

## 2. System Overview

VYDRA CORE is a role-aware web platform for exam preparation. The product combines:

- A student learning workspace
- An educator command center
- AI-assisted learning and quiz generation
- Document upload and offline viewing
- Retrieval-backed Q&A
- Bloom's Taxonomy-based authoring and assessment support
- Real-time collaboration and communication features

## 3. Architectural Style

The solution follows a layered web application architecture:

- Presentation layer: Next.js frontend
- API layer: FastAPI backend
- Domain and service layer: routers, services, agents, and analytics logic
- Persistence layer: relational database plus vector store
- Integration layer: LLM providers, vector infrastructure, and optional external knowledge sources

## 4. Technology Stack

### 4.1 Frontend

- Next.js 14
- React 18
- Tailwind CSS
- Lucide icons
- Recharts for analytics and charts

### 4.2 Backend

- FastAPI
- SQLAlchemy
- Pydantic
- Uvicorn
- PyPDF for extraction
- Scikit-learn and NumPy for lightweight data support

### 4.3 Data and AI Infrastructure

- PostgreSQL or Supabase for primary structured data
- SQLite fallback for local availability
- Qdrant for vector storage and retrieval
- Groq-backed LLM path and Ollama-compatible local model path

## 5. Logical Architecture

## 5.1 Frontend Modules

- Authentication pages
- Student dashboard and materials library
- Offline document viewer
- Learning chat
- Quiz generator and quiz session views
- Progress tracker
- Student classroom page
- Educator dashboards
- Bloom's Question Studio
- Communication hub
- Collaboration hub
- Admin analytics

## 5.2 Backend Modules

- `auth` router for registration, login, and user identity
- `documents` router for upload, deletion, file serving, and study access
- `quiz` router for generation, submission, and Bloom analysis
- `qa` router for question answering
- `learning` router for recommendations and progress support
- `educator` router for classroom, communication, analytics, and complaints
- `collaboration` router for live-session workflows

## 5.3 Service and AI Modules

- Document chunking and context building
- Lightweight vector retrieval abstraction
- Quiz and question generation
- Bloom's classifier and difficulty converter
- Learning analytics and recommendation logic

## 6. High-Level Component View

### 6.1 Student Path

1. Student logs in.
2. Frontend loads role-aware dashboard.
3. Student uploads material through the document API.
4. Backend extracts text, creates chunks, and optionally indexes vectors.
5. Student studies material in the document viewer or offline cache.
6. Student asks questions or generates quizzes.
7. Backend retrieves relevant context and generates grounded responses.
8. Student quiz outcomes update progress and recommendations.

### 6.2 Educator Path

1. Educator logs in to role-aware dashboard.
2. Educator creates classrooms and monitors alerts.
3. Students join via classroom invite codes.
4. Educator inspects student analytics and class trends.
5. Educator uses Bloom's Question Studio for question analysis and rewriting.
6. Educator sends updates, receives complaints, and manages live sessions.

### 6.3 Collaboration Path

1. Educator creates a live session.
2. Students join using session codes.
3. Live events are transmitted through web sockets and stored as collaboration events.
4. Polls, quick checks, and AI-assisted discussion happen in real time.
5. Session summaries and insights are generated after the session.

## 7. Data Architecture

## 7.1 Primary Relational Model

Core entities include:

- `users`
- `documents`
- `document_chunks`
- `quiz_sessions`
- `quiz_answers`
- `generated_questions`
- `user_progress`
- `classrooms`
- `classroom_enrollments`
- `reinforcement_lessons`
- `communication_messages`
- `support_complaints`
- `live_sessions`
- `live_session_participants`
- `collaboration_events`

## 7.2 Document Processing Model

- Raw document metadata is stored in the relational database.
- Extracted or derived document chunks are stored for retrieval.
- Each chunk may map to a vector record in Qdrant.
- Source metadata such as page number is retained for references.

## 7.3 Offline Document Model

- The browser stores selected PDF data locally for offline use.
- Metadata and cached blobs are held client-side to restore prior study access.

## 8. AI and Retrieval Design

## 8.1 RAG Flow

1. User submits a question.
2. Backend builds retrieval query context.
3. Relevant chunks are found using vector search when available.
4. If vector search is unavailable, the application falls back to lexical retrieval.
5. Selected context is passed into answer-generation logic.
6. Response includes answer text and source references where available.

## 8.2 Quiz Generation Flow

1. User selects a document set and Bloom level.
2. Backend gathers relevant chunks.
3. Question generation logic produces structured quiz items.
4. Correct answer, distractors, and explanations are stored with source context.
5. Quiz session is presented to the learner.

## 8.3 Bloom's Question Studio Flow

1. Educator submits a question prompt.
2. Bloom classifier identifies the current cognitive level.
3. Converter generates either:
   - a single selected target rewrite, or
   - all six Bloom-level versions
4. The UI presents educator-ready question variants for teaching or remediation.

## 9. Security Design

### 9.1 Identity and Access

- Token-based API access
- Role-based route protection
- Student-only and educator-only feature separation
- Ownership checks for documents, sessions, and classrooms

### 9.2 Data Protection

- Password hashing
- File validation and name sanitization
- Limited route exposure based on role
- Login lockout and rate limiting measures

### 9.3 Production Hardening Path

- Secret rotation
- HTTPS-only deployment
- managed secret store
- enhanced logging and audit trails
- stricter upload scanning
- finer-grained admin permissions

## 10. Deployment Topology

### 10.1 Local or Development Topology

- Next.js frontend on port 3000
- FastAPI backend on port 8000
- SQLite fallback or remote PostgreSQL
- optional Qdrant cloud or local Qdrant

### 10.2 Cloud-Ready Topology

- Frontend served from a modern static or server-rendering host
- Backend hosted as a Python API service
- PostgreSQL via Supabase
- Qdrant via cloud cluster
- Object storage for uploaded files in future production hardening

## 11. Availability and Resilience

- Health endpoint provides service validation
- Frontend and backend can be restarted independently
- Retrieval layer supports fallback mode if vector search is unavailable
- Local database fallback supports development continuity when cloud DB access fails

## 12. Scalability Considerations

- Move document ingestion and embedding creation to background workers
- Migrate file storage from local disk to object storage
- Add queueing for extraction and indexing
- Expand analytics aggregation for institutional scale
- Add caching for repeated AI prompts and retrieval results

## 13. Observability Considerations

- Health endpoints
- API-level logging
- complaint and collaboration event persistence
- future metrics on latency, retrieval quality, and user engagement

## 14. Major Design Decisions

### 14.1 Role-Aware UX

Separate student and educator workflows reduce confusion and support clearer permissions.

### 14.2 Retrieval Abstraction

The platform is designed to use vector retrieval where available, but fallback retrieval preserves core functionality during infrastructure issues.

### 14.3 Offline-First Study Enhancement

Offline document viewing improves usability for learners with inconsistent connectivity and supports realistic exam preparation needs.

### 14.4 Bloom's Tool Placement

Bloom's authoring workflows are placed in educator mode because they are intended as teaching and question-authoring tools rather than student navigation clutter.

## 15. Risks and Mitigations

### Risk: AI answer quality depends on retrieval quality

Mitigation: store chunks with source metadata, support vector retrieval, and preserve fallback logic.

### Risk: large uploads increase latency and storage cost

Mitigation: support page selection, text-only mode, and future object storage.

### Risk: real-time workflows can become inconsistent under load

Mitigation: persist collaboration events and design toward scalable websocket or pub-sub infrastructure.

### Risk: environment failures can block hosted database access

Mitigation: local database fallback for development and operational troubleshooting.

## 16. Future Design Extensions

- stronger citation UX with exact page jumps
- richer diagram extraction and visual study aids
- LMS integrations
- dedicated event bus for real-time collaboration
- enterprise-grade audit and compliance controls

