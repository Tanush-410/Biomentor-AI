"""Question answering router backed by uploaded materials."""
from datetime import datetime
from typing import List

import requests
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core import settings
from app.core.security import enforce_rate_limit
from app.database import get_db
from app.routers.auth import get_current_user
from app.schemas import (
    AnswerGenerationRequest,
    AnswerGenerationResponse,
    RetrievalRequest,
    RetrievalResponse,
    SourceReference,
)
from app.services.document_context import build_context_window, fallback_preview_context, get_document_context

router = APIRouter(prefix="/api/qa", tags=["qa"])


@router.post("/answer", response_model=AnswerGenerationResponse)
async def generate_answer(
    request: AnswerGenerationRequest,
    http_request: Request,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Answer a question using the user's uploaded materials."""
    enforce_rate_limit(http_request, "qa-answer", limit=45, window_seconds=300)
    return build_answer_response(db, current_user, request)


@router.post("/retrieve", response_model=RetrievalResponse)
async def retrieve_context(
    request: RetrievalRequest,
    http_request: Request,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve material snippets relevant to a user's question."""
    enforce_rate_limit(http_request, "qa-retrieve", limit=60, window_seconds=300)
    contexts = _retrieve_for_question(db, current_user.id, request.query, request.document_ids, top_k=request.top_k)
    return RetrievalResponse(query=request.query, results=contexts)


def build_answer_response(db: Session, current_user, request: AnswerGenerationRequest) -> AnswerGenerationResponse:
    """Reusable answer builder for HTTP and collaboration flows."""
    user_id = current_user.id
    conversation_history = _normalize_conversation_history(request.conversation_history)
    contexts = _retrieve_for_question(
        db,
        user_id,
        request.question,
        request.document_ids,
        top_k=5,
        conversation_history=conversation_history,
    )

    if not contexts:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No uploaded material is available for answering this question."
        )

    answer_text, confidence = _generate_answer_from_context(request.question, contexts, conversation_history)
    sources = [
        SourceReference(
            document_id=item["document_id"],
            document_title=item["document_title"],
            page_number=item["page_number"],
            chunk_index=item["chunk_index"],
            excerpt=item["content"][:220]
        )
        for item in contexts[:3]
    ] if request.include_sources else []

    return AnswerGenerationResponse(
        question=request.question,
        answer=answer_text,
        sources=sources,
        confidence=confidence,
        generated_at=datetime.utcnow()
    )


def _load_document_context(db: Session, user_id: str, document_ids: List[str] = None, top_k: int = 3):
    contexts = get_document_context(db, user_id=user_id, document_ids=document_ids, top_k=top_k)
    return contexts or fallback_preview_context(db, user_id, document_ids=document_ids, top_k=top_k)


def _retrieve_for_question(
    db: Session,
    user_id: str,
    question: str,
    document_ids: List[str] = None,
    top_k: int = 3,
    conversation_history=None,
):
    contexts = get_document_context(
        db,
        user_id=user_id,
        document_ids=document_ids,
        query=question,
        top_k=top_k,
        conversation_history=conversation_history,
    )
    if contexts:
        return contexts
    return fallback_preview_context(db, user_id, document_ids=document_ids, top_k=top_k)


def _generate_answer_from_context(question: str, contexts, conversation_history=None):
    if _groq_available():
        answer = _generate_with_groq(question, contexts, conversation_history or [])
        if answer:
            return answer, 0.82

    top = contexts[0]
    return (
        f"Based on your uploaded material \"{top['document_title']}\", the most relevant section says: {top['content'][:260]}...",
        0.55
    )


def _generate_with_groq(question: str, contexts, conversation_history):
    context_text = build_context_window(contexts[:4], max_chars=7000)
    conversation_text = _format_conversation_history(conversation_history)
    payload = {
        "model": "llama-3.3-70b-versatile",
        "temperature": 0.2,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Answer using only the provided study material. "
                    "Be concise, accurate, student-friendly, and mention uncertainty if the material is incomplete. "
                    "Treat the recent conversation as context for follow-up questions like 'shorter', 'explain that', "
                    "'what about the next part', or 'simplify it'. "
                    "If the user asks a follow-up, preserve the topic from the conversation and answer from the study material."
                )
            },
            {
                "role": "user",
                "content": (
                    f"Current question: {question}\n\n"
                    f"Recent conversation:\n{conversation_text}\n\n"
                    f"Study material:\n{context_text}\n\n"
                    "Answer the current question. If it is a follow-up, use the recent conversation only to clarify intent, "
                    "but ground the answer in the study material."
                )
            }
        ]
    }

    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.groq_api_key}",
                "Content-Type": "application/json"
            },
            json=payload,
            timeout=30
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"].strip()
    except Exception:
        return None


def _groq_available():
    key = (settings.groq_api_key or "").strip()
    return bool(key and not key.lower().startswith("your_"))


def _normalize_conversation_history(history):
    normalized = []
    for item in history or []:
        if hasattr(item, "model_dump"):
            item = item.model_dump()
        role = str(item.get("role", "")).strip().lower()
        content = str(item.get("content", "")).strip()
        if role in {"user", "assistant"} and content:
            normalized.append({"role": role, "content": content})
    return normalized[-6:]


def _format_conversation_history(history):
    if not history:
        return "No previous conversation."

    lines = []
    for item in history[-6:]:
        speaker = "User" if item["role"] == "user" else "Assistant"
        lines.append(f"{speaker}: {item['content']}")
    return "\n".join(lines)
