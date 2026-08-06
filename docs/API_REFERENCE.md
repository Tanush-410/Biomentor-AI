# 📚 API Reference - Smart Learning Assistant

Base URL: `http://localhost:8000`

---

## 🔐 Authentication

### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123",  // min 8 chars
  "full_name": "John Doe"
}
```

**Response**: 
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "full_name": "John Doe",
  "created_at": "2024-01-20T10:00:00"
}
```

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response**:
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer"
}
```

### Get Current User
```http
GET /api/auth/me
Authorization: Bearer {token}
```

---

## 📄 Documents

### Upload Document
```http
POST /api/documents/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data

file: <PDF/TXT file>
title: "Optional Title"
```

**Response**:
```json
{
  "id": "doc-uuid",
  "user_id": "user-uuid",
  "title": "My Study Material",
  "file_name": "material.pdf",
  "file_size": 1024000,
  "pages": 45,
  "created_at": "2024-01-20T10:00:00"
}
```

### List User Documents
```http
GET /api/documents/
Authorization: Bearer {token}
```

**Response**: Array of documents

### Get Document Details
```http
GET /api/documents/{document_id}
Authorization: Bearer {token}
```

### Delete Document
```http
DELETE /api/documents/{document_id}
Authorization: Bearer {token}
```

**Response**:
```json
{
  "message": "Document deleted successfully"
}
```

---

## 🧠 SOLO Taxonomy

### Get All Taxonomy Levels
```http
GET /api/quiz/solo-taxonomy
```

**Response**:
```json
[
  {
    "level": 1,
    "name": "Prestructural",
    "description": "Little or no relevant understanding is shown; the task is approached through a single unconnected, often surface-level detail",
    "keywords": ["what is", "name", "label", "point out", ...],
    "examples": ["name a term", "point to a fact", ...]
  },
  ...
  {
    "level": 5,
    "name": "Extended Abstract",
    "description": "Understanding is generalized beyond the given information, transferred to a new context, or used to form an abstract principle",
    "keywords": ["generalize", "hypothesize", "predict", ...],
    "examples": ["propose a new theory", "predict outcomes in a new context", ...]
  }
]
```

### Analyze Question Difficulty
```http
POST /api/quiz/analyze-question?user_id={user_id}
Content-Type: application/json

{
  "text": "Explain how the stages of cellular respiration relate to and depend on one another."
}
```

**Response**:
```json
{
  "question": "Explain how the stages of cellular respiration relate to and depend on one another.",
  "current_level": 4,
  "current_level_name": "Relational",
  "confidence": 0.89,
  "detected_keywords": ["explain how", "relate"],
  "description": "Multiple pieces of information are integrated into a coherent whole, with clear relationships understood between the parts"
}
```

---

## 🎯 Quiz

### Generate Quiz
```http
POST /api/quiz/generate
Authorization: Bearer {token}
Content-Type: application/json

{
  "num_questions": 10,
  "bloom_level": 3,              // optional, 1-5 (SOLO level)
  "document_ids": ["doc1", "doc2"] // optional
}
```

**Response**: 
```json
[
  {
    "id": "q-uuid",
    "text": "What is the purpose of photosynthesis?",
    "bloom_level": 3,
    "bloom_level_name": "Multistructural",
    "document_reference": "Biology101.pdf",
    "page_number": 12,
    "options": [
      {"id": "A", "text": "To create energy"},
      {"id": "B", "text": "To break down glucose"},
      ...
    ]
  },
  ...
]
```

### Convert Question Difficulty
```http
POST /api/quiz/convert-difficulty
Authorization: Bearer {token}
Content-Type: application/json

{
  "question_text": "What is photosynthesis?",
  "current_level": 1,
  "target_level": 5,
  "context": "Optional document excerpt"
}
```

**Response**:
```json
{
  "original_question": "What is photosynthesis?",
  "current_analysis": {
    "current_level": 1,
    "current_level_name": "Prestructural",
    "target_level": 5,
    "target_level_name": "Extended Abstract",
    "confidence": 0.92
  },
  "variants": [
    {
      "text": "How would you generalize or apply photosynthesis to a new situation?",
      "bloom_level": 5,
      "bloom_level_name": "Extended Abstract",
      "reasoning": "Increased by 4 levels"
    }
  ],
  "confidence": 0.92
}
```

### Submit Quiz Answer
```http
POST /api/quiz/submit-answer?session_id={id}&question_id={id}&option_id=A&user_id={user_id}
Authorization: Bearer {token}
```

**Response**:
```json
{
  "message": "Answer recorded",
  "current_score": 66.67,
  "correct_count": 2
}
```

---

## 💬 Q&A (Question & Answers)

### Generate Answer with Sources
```http
POST /api/qa/answer
Authorization: Bearer {token}
Content-Type: application/json

{
  "question": "How does photosynthesis contribute to the carbon cycle?",
  "document_ids": ["doc1", "doc2"],  // optional, leave empty for all
  "include_sources": true
}
```

**Response**:
```json
{
  "question": "How does photosynthesis contribute to the carbon cycle?",
  "answer": "Photosynthesis is a key process in the carbon cycle. Plants absorb CO2 from the atmosphere during photosynthesis and fix it into organic compounds...",
  "sources": [
    {
      "document_title": "Biology101.pdf",
      "page_number": 34,
      "excerpt": "Photosynthesis is the process by which plants fix atmospheric carbon..."
    },
    {
      "document_title": "Environmental Science.pdf",
      "page_number": 12,
      "excerpt": "The carbon cycle involves multiple processes including photosynthesis..."
    }
  ],
  "confidence": 0.94,
  "generated_at": "2024-01-20T10:05:32"
}
```

### Retrieve Context
```http
POST /api/qa/retrieve
Authorization: Bearer {token}
Content-Type: application/json

{
  "query": "photosynthesis chlorophyll",
  "top_k": 5,
  "document_ids": ["doc1"]  // optional
}
```

**Response**:
```json
{
  "query": "photosynthesis chlorophyll",
  "results": [
    {
      "content": "Chlorophyll is the green pigment that absorbs light energy during photosynthesis. There are several types of chlorophyll...",
      "document_id": "doc1",
      "document_title": "Biology101.pdf",
      "page_number": 15,
      "chunk_index": 3,
      "relevance_score": 0.97
    },
    ...
  ]
}
```

### Multi-Perspective Answers
```http
POST /api/qa/multi-perspective?question={question}&perspectives=["Definition","Application","Analysis"]&user_id={user_id}
Authorization: Bearer {token}
```

**Response**:
```json
{
  "question": "What is photosynthesis?",
  "perspectives": {
    "Definition": {
      "question": "Explain the concept of: What is photosynthesis?",
      "answer": "Photosynthesis is the biochemical process...",
      "sources": [...],
      "confidence": 0.92,
      "generated_at": "..."
    },
    "Application": {
      "question": "How would you apply: What is photosynthesis?",
      "answer": "In practical applications, photosynthesis is used...",
      ...
    },
    "Analysis": {
      "question": "Analyze and compare: What is photosynthesis?",
      "answer": "Photosynthesis compared to cellular respiration...",
      ...
    }
  }
}
```

---

## 🏥 Health & Status

### Health Check
```http
GET /health
```

**Response**:
```json
{
  "status": "healthy",
  "environment": "development",
  "debug": true
}
```

### Root Info
```http
GET /
```

**Response**:
```json
{
  "name": "Smart Learning Assistant API",
  "version": "0.1.0",
  "docs": "/api/docs",
  "api_endpoints": {
    "auth": "/api/auth",
    "documents": "/api/documents",
    "quiz": "/api/quiz",
    "qa": "/api/qa"
  }
}
```

---

## 🔄 Common Workflows

### Workflow 1: User Registration & Login
```bash
# 1. Register
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@example.com",
    "password": "SecurePass123",
    "full_name": "Jane Student"
  }'

# 2. Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@example.com",
    "password": "SecurePass123"
  }'
# Save the access_token from response
```

### Workflow 2: Upload Document & Generate Quiz
```bash
TOKEN="your_token_here"

# 1. Upload document
curl -X POST http://localhost:8000/api/documents/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@study_material.pdf" \
  -F "title=Biology Notes"

# 2. Generate quiz from that document
curl -X POST http://localhost:8000/api/quiz/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "num_questions": 5,
    "bloom_level": 3,
    "document_ids": ["doc_id_from_step_1"]
  }'
```

### Workflow 3: Difficulty Conversion
```bash
TOKEN="your_token_here"

curl -X POST http://localhost:8000/api/quiz/convert-difficulty \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "question_text": "Explain photosynthesis",
    "current_level": 2,
    "target_level": 5
  }'
```

---

## 📋 Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Server Error

---

## 🔒 Authentication

All endpoints except `/`, `/health`, and `/api/auth/*` require:
```
Authorization: Bearer {access_token}
```

Get token from login endpoint and include in all requests.

---

**Full API Documentation**: `http://localhost:8000/api/docs` (Swagger UI)
**Alternative docs**: `http://localhost:8000/api/redoc` (ReDoc)
