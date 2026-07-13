# VYDRA CORE Requirements Document

## Document Control

- Project: VYDRA CORE
- Product Type: Smart learning assistant web application for exam preparation
- Version: 1.0
- Date: 13 May 2026
- Prepared For: VYDRA CORE project submission and implementation alignment

## 1. Purpose

This document defines the business, functional, non-functional, security, and operational requirements for VYDRA CORE. The application is intended to support exam preparation through AI-assisted study, retrieval-augmented question answering, Bloom's Taxonomy-aligned quiz workflows, offline study support, educator analytics, and real-time class collaboration.

## 2. Product Vision

VYDRA CORE is a web-based intelligent learning platform that helps students study from uploaded material, ask grounded questions, practice AI-generated quizzes, and track mastery over time. It also gives educators tools to monitor class performance, identify learning gaps, intervene quickly, and manage live AI-supported collaboration sessions.

## 3. Objectives

### 3.1 Business Objectives

- Improve student exam preparation quality through personalized AI support.
- Reduce time spent by educators identifying weak learners and weak topics.
- Provide a structured bridge between study material, formative assessment, and progress analytics.
- Support future expansion into institution-scale deployment and analytics.

### 3.2 Learning Objectives

- Help students move from passive reading to active recall and applied practice.
- Generate question sets aligned to Bloom's cognitive levels.
- Surface gaps in understanding and recommend next learning actions.
- Provide teachers with actionable intervention signals.

## 4. Scope

### 4.1 In Scope

- Student registration, login, and role-based access
- Educator/admin registration, login, and role-based access
- PDF and study-material upload, storage, retrieval, and deletion
- Offline access to previously saved uploaded PDFs
- AI learning chat with source-aware study support
- Quiz generation from uploaded materials
- Bloom's Taxonomy analysis and question conversion tools for educators
- Student progress tracking and recommendations
- Educator dashboards, student analytics, and class insights
- Real-time collaboration workflows with live session support
- Student complaints and educator communication flows
- Security controls suitable for MVP and scalable follow-on hardening

### 4.2 Out of Scope

- Full LMS-grade assignment submission and grading workflows
- Native mobile applications
- Proctored examinations
- Payment or subscription management
- Full compliance certification workflows

## 5. Stakeholders

- Students preparing for exams
- Educators monitoring and supporting learners
- Admin users monitoring institutional analytics
- Project owner and evaluators
- Future institutional adopters

## 6. User Roles

### 6.1 Student

- Upload and manage study materials
- Access offline PDF viewer
- Ask questions to the AI learning assistant
- Generate and take quizzes from uploaded materials
- View progress and recommendations
- Join educator classrooms
- Send direct messages and difficulty complaints to educators
- Participate in collaboration sessions, polls, and quick checks

### 6.2 Educator

- Access educator dashboard and class overview
- Create and manage classrooms
- Monitor student mastery and learning gaps
- Send updates and messages
- Receive real-time student complaints and messages
- Use Bloom's Question Studio to identify and regenerate question levels
- Launch and manage live collaboration sessions
- Review class insights and assign reinforcement lessons

### 6.3 Admin

- Access institutional analytics
- Compare class performance
- Monitor engagement and complaint trends
- Oversee educator and student usage at higher level

## 7. Functional Requirements

### 7.1 Authentication and Role Management

- The system shall support registration and login for student, educator, and admin roles.
- The system shall maintain role-specific navigation and feature access.
- The system shall persist authenticated session state for the active user.
- The system shall support forgot-password and account recovery flow foundations.
- The system shall lock accounts temporarily after repeated failed login attempts.

### 7.2 Student Learning Workspace

- The system shall provide a student dashboard with quick stats, recommendations, and study actions.
- The system shall show a progress overview based on quiz attempts and Bloom-level performance.
- The system shall allow students to access uploaded materials from a materials library.

### 7.3 Document and Material Management

- The system shall allow users to upload supported study files.
- The system shall store title, file name, file size, page count, preview text, and processing status.
- The system shall support deleting uploaded materials.
- The system shall support storage modes such as full file upload and reduced-data text-only mode.
- The system shall support optional page selection for reduced upload scope.

### 7.4 Offline PDF Access

- The system shall allow users to open uploaded PDFs in an in-app viewer.
- The system shall allow users to save supported material for offline access.
- The system shall allow previously cached documents to be reopened when the network is unavailable.
- The system shall preserve document metadata and present a user-friendly offline reading experience.

### 7.5 AI Learning Chat and RAG

- The system shall let students and educators ask questions about uploaded materials.
- The system shall retrieve document context before generating answers.
- The system shall include source references with answers where available.
- The system shall support a scalable path to vector retrieval through a vector database such as Qdrant.
- The system shall support a safe fallback retrieval path if vector search is unavailable.

### 7.6 Quiz Generation and Bloom's Taxonomy

- The system shall generate quiz questions from uploaded material content.
- The system shall align generated questions to selected Bloom's levels.
- The system shall store question options, correct answers, explanations, and source context.
- The system shall allow students to take generated quizzes and submit answers.
- The system shall compute scores and persist quiz outcomes.

### 7.7 Bloom's Question Studio for Educators

- The system shall provide a Bloom's tool for educator mode.
- The system shall identify the Bloom's level of a provided question.
- The system shall generate the same question across all Bloom's levels.
- The system shall also allow one targeted conversion to a selected Bloom's level.
- The system shall keep Bloom's authoring tools hidden from student mode.

### 7.8 Progress and Recommendations

- The system shall track student performance across Bloom's levels.
- The system shall identify weak levels and present recommendations.
- The system shall provide a progress page with mastery trends and recent activity.

### 7.9 Educator Dashboard and Analytics

- The system shall provide an educator dashboard showing classes, students, alerts, and live session summaries.
- The system shall provide per-student analytics with mastery, gaps, and reinforcement suggestions.
- The system shall provide class insights to reveal common weak topics and review opportunities.
- The system shall support reinforcement lesson assignment by educator.

### 7.10 Communication and Intervention

- The system shall allow educators to send updates to students or classes.
- The system shall allow students to send direct messages to educators.
- The system shall allow students to raise difficulty complaints.
- The system shall deliver student complaints and student messages instantly to educators when they are online.
- The system shall allow educators to resolve complaint items.

### 7.11 Collaboration Hub

- The system shall let educators create live sessions.
- The system shall allow students to join via session codes.
- The system shall support live polls and quick checks during a session.
- The system shall store collaboration events and participant activity.
- The system shall produce post-session summaries and follow-up insights.

### 7.12 Admin Analytics

- The system shall provide overview metrics for users, classrooms, communications, and complaints.
- The system shall compare class-level mastery and complaint pressure.
- The system shall summarize engagement through sessions and assigned interventions.

## 8. Non-Functional Requirements

### 8.1 Usability

- The application shall provide a clean web interface for both students and educators.
- The application shall use role-aware navigation and sidebar menus for discoverability.
- The application shall minimize confusion between student and educator workflows.

### 8.2 Performance

- Normal page navigation should feel responsive under standard academic workloads.
- Upload, quiz generation, and dashboard operations should complete within acceptable interactive limits for a web app MVP.
- Retrieval and quiz workflows should support future migration to asynchronous job processing.

### 8.3 Scalability

- The design shall support migration from local or SQLite fallback modes to managed PostgreSQL.
- The design shall support integration with Qdrant for scalable vector retrieval.
- The design shall support future object storage, queue-based ingestion, and multi-tenant institutional expansion.

### 8.4 Reliability

- The application shall expose health checks for service validation.
- The application shall degrade gracefully if external retrieval or vector infrastructure is unavailable.

### 8.5 Maintainability

- The solution shall maintain clear separation between frontend, backend, database models, routers, schemas, and services.
- The solution shall support incremental extension of AI features, dashboards, and integrations.

## 9. Security Requirements

- The system shall hash passwords securely.
- The system shall use token-based authentication for authenticated API access.
- The system shall enforce role checks on restricted routes.
- The system shall validate uploads and sanitize file names.
- The system shall support rate limiting and login lockout controls.
- The system shall protect user-specific materials, sessions, and messages from unauthorized access.
- The production deployment shall protect secrets through environment variables and secret rotation.

## 10. Data Requirements

### 10.1 Core Data Entities

- Users
- Documents
- Document chunks
- Quiz sessions
- Quiz answers
- Generated questions
- User progress
- Classrooms
- Classroom enrollments
- Reinforcement lessons
- Communication messages
- Support complaints
- Live sessions
- Session participants
- Collaboration events

### 10.2 Retention and Traceability

- The system shall maintain enough metadata to trace AI answers and generated quizzes back to source material where possible.
- The system shall preserve timestamps for important user, message, complaint, and session events.

## 11. Integration Requirements

- Managed relational database support through PostgreSQL or Supabase
- Vector database support through Qdrant
- LLM access through configured providers such as Groq and a local Ollama-compatible path
- Optional future integration with LMS platforms and external academic sources

## 12. Assumptions and Constraints

- Users primarily access the system from a browser.
- Uploaded materials are primarily PDFs and text-heavy learning resources.
- Offline support applies to previously cached documents, not first-time offline acquisition.
- AI quality depends on document quality, retrieval quality, and model availability.

## 13. Acceptance Criteria Summary

- Students can register, upload materials, study offline, ask questions, take quizzes, view progress, and contact educators.
- Educators can log in to educator mode, manage classes, inspect student performance, use Bloom's question tools, run live sessions, and receive student alerts instantly.
- Admins can view higher-level analytics.
- The system can operate locally and has a defined path to cloud-backed deployment with Supabase and Qdrant.

## 14. Future Enhancements

- Stronger vector-search ranking and retrieval evaluation
- More advanced visual extraction from uploaded materials
- LMS integrations
- Push notifications and richer institutional workflows
- Production-grade observability, audit, and compliance tooling

