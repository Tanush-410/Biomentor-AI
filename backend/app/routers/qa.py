"""Question answering router backed by uploaded materials."""
from datetime import datetime
import json
import re
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
    QuickCheckEvaluationRequest,
    QuickCheckEvaluationResponse,
    QuickCheckEvaluationResult,
    RetrievalRequest,
    RetrievalResponse,
    SourceReference,
)
from app.services.ai_evaluation import should_use_safe_fallback
from app.services.ai_evidence import dedupe_evidence_items, trim_evidence_items
from app.services.ai_quality import classify_confidence, make_origin_label
from app.services.document_context import build_context_window, fallback_preview_context, get_document_context
from app.services.web_retrieval import DuckDuckGoSearchClient, retrieve_web_contexts

router = APIRouter(prefix="/api/qa", tags=["qa"])

COMPLEXITY_HINTS = ("compare", "analyze", "evaluate", "why", "how", "difference", "complex", "mechanism")
CONFIDENCE_WEB_BONUS = 0.08


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


@router.post("/quick-check/evaluate", response_model=QuickCheckEvaluationResponse)
async def evaluate_quick_check_route(
    request: QuickCheckEvaluationRequest,
    http_request: Request,
    current_user=Depends(get_current_user),
):
    """Grade a lightweight adaptive quick check."""
    enforce_rate_limit(http_request, "qa-quick-check", limit=60, window_seconds=300)
    return evaluate_quick_check_submission(request)


def build_answer_response(
    db: Session,
    current_user,
    request: AnswerGenerationRequest,
    retrieve_fn=None,
    web_search_fn=None,
) -> AnswerGenerationResponse:
    """Reusable answer builder for HTTP and collaboration flows."""
    user_id = current_user.id
    conversation_history = _normalize_conversation_history(request.conversation_history)
    retrieve_fn = retrieve_fn or _retrieve_for_question
    web_search_fn = web_search_fn or retrieve_web_contexts

    contexts = retrieve_fn(
        db,
        user_id,
        request.question,
        request.document_ids,
        top_k=5,
        conversation_history=conversation_history,
    )
    answer_origin = "material"
    trusted_web_contexts = []
    broad_web_contexts = []

    if _needs_web_fallback(contexts):
        try:
            trusted_web_contexts, broad_web_contexts = web_search_fn(
                _default_web_search_client(),
                request.question,
                settings.trusted_search_domains,
            )
        except TypeError:
            trusted_web_contexts, broad_web_contexts = web_search_fn(
                request.question,
                settings.trusted_search_domains,
            )

        if trusted_web_contexts or broad_web_contexts:
            web_contexts = trusted_web_contexts + broad_web_contexts
            contexts = _merge_agentic_contexts(contexts, web_contexts, top_k=5)
            answer_origin = "trusted_web" if trusted_web_contexts else "web_enhanced"

    if not contexts:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No uploaded material is available for answering this question."
        )

    evidence_items = trim_evidence_items(dedupe_evidence_items(contexts), max_chars=2600)
    answer_text, confidence = _generate_answer_from_context(request.question, evidence_items, conversation_history)
    if answer_origin != "material":
        confidence = min(0.92, confidence + CONFIDENCE_WEB_BONUS)
    confidence_meta = classify_confidence(
        evidence_count=len(evidence_items),
        average_score=_average_relevance(evidence_items),
        malformed_output=False,
    )
    fallback_used = should_use_safe_fallback(
        evidence_count=len(evidence_items),
        confidence=confidence_meta["confidence"],
    )
    if fallback_used:
        answer_text = (
            "I am not fully confident in this answer, so I have kept it conservative and grounded in the best evidence I found.\n\n"
            f"{answer_text}"
        )
    complexity = _estimate_complexity(request.question, answer_text)
    show_quick_check = _should_offer_quick_check(confidence, complexity)
    quick_check = _build_quick_check(request.question, evidence_items, answer_text) if show_quick_check else None
    sources = [
        SourceReference(
            document_id=item["document_id"],
            document_title=item["document_title"],
            page_number=item["page_number"],
            chunk_index=item["chunk_index"],
            excerpt=item["content"][:220],
            url=item.get("url"),
            source_type=item.get("source_type", "material"),
        )
        for item in evidence_items[:3]
    ] if request.include_sources else []
    normalized_origin = "broader_web" if answer_origin == "web_enhanced" else answer_origin

    return AnswerGenerationResponse(
        question=request.question,
        answer=answer_text,
        sources=sources,
        confidence=confidence,
        confidence_label=confidence_meta["confidence"],
        confidence_reason=confidence_meta["confidence_reason"],
        answer_origin=normalized_origin,
        source_badge=make_origin_label(normalized_origin),
        fallback_used=fallback_used,
        complexity=complexity,
        show_quick_check=show_quick_check,
        quick_check=quick_check,
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


def _default_web_search_client():
    return DuckDuckGoSearchClient(settings.trusted_search_domains, top_k=settings.web_fallback_top_k)


def _needs_web_fallback(contexts):
    if not contexts:
        return True

    top_score = max(float(item.get("relevance_score", 0.0) or 0.0) for item in contexts[:3])
    if top_score <= 0.18:
        return True

    content_lengths = [len((item.get("content") or "").strip()) for item in contexts[:3]]
    return max(content_lengths, default=0) < 120


def _merge_agentic_contexts(document_contexts, web_contexts, top_k=5):
    combined = list(document_contexts or []) + list(web_contexts or [])
    combined = dedupe_evidence_items(combined)
    return combined[: max(top_k, 5)]


def _average_relevance(items):
    if not items:
        return 0.0
    scores = [float(item.get("relevance_score", 0.0) or 0.0) for item in items]
    return sum(scores) / len(scores)


def _estimate_complexity(question: str, answer_text: str) -> str:
    lowered = f"{question} {answer_text}".lower()
    if len(question.split()) > 12 or any(hint in lowered for hint in COMPLEXITY_HINTS):
        return "complex"
    if len(answer_text.split()) > 45:
        return "moderate"
    return "simple"


def _should_offer_quick_check(confidence: float, complexity: str) -> bool:
    return confidence < 0.7 or complexity == "complex"


def _build_quick_check(question: str, contexts, answer_text: str):
    if _groq_available():
        generated = _generate_quick_check_with_groq(question, contexts, answer_text)
        if generated:
            return generated
    return _build_quick_check_fallback(question, contexts, answer_text)


def _generate_quick_check_with_groq(question: str, contexts, answer_text: str):
    context_text = build_context_window(contexts[:3], max_chars=3500)
    payload = {
        "model": "llama-3.3-70b-versatile",
        "temperature": 0.2,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Create a compact 2-3 question multiple-choice quick check. "
                    "Return valid JSON only with keys id, title, questions. "
                    "Each question must include id, prompt, options, correct_option_id, explanation. "
                    "Each option must include id and text."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Question:\n{question}\n\n"
                    f"Answer:\n{answer_text}\n\n"
                    f"Sources:\n{context_text}\n\n"
                    "Create a short quick check grounded in this material."
                ),
            },
        ],
    }
    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.groq_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=30,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"].strip()
        parsed = json.loads(content)
        return parsed
    except Exception:
        return None


def _build_quick_check_fallback(question: str, contexts, answer_text: str):
    base_title = "Quick Check"
    source_title = contexts[0].get("document_title", "your source") if contexts else "your source"
    keywords = _extract_keywords(question, answer_text)
    primary_keyword = keywords[0] if keywords else "the main idea"
    secondary_keyword = keywords[1] if len(keywords) > 1 else "the key detail"

    return {
        "id": f"qc-{abs(hash(question + answer_text)) % 1000000}",
        "title": base_title,
        "questions": [
            {
                "id": "q1",
                "prompt": f"Which option best matches the main idea about {primary_keyword}?",
                "options": [
                    {"id": "a", "text": answer_text[:90] or "The core explanation from the material."},
                    {"id": "b", "text": "An unrelated summary that does not match the source."},
                    {"id": "c", "text": f"A vague statement about {secondary_keyword} without the main concept."},
                ],
                "correct_option_id": "a",
                "explanation": f"The answer is grounded in {source_title}.",
            },
            {
                "id": "q2",
                "prompt": f"Which statement would best help you explain {secondary_keyword} next time?",
                "options": [
                    {"id": "a", "text": "Memorize only the heading and skip the explanation."},
                    {"id": "b", "text": answer_text[:120] or "Use the explanation from the answer and source."},
                    {"id": "c", "text": "Ignore the source and guess from general knowledge."},
                ],
                "correct_option_id": "b",
                "explanation": "The best next explanation should stay aligned with the grounded answer.",
            },
        ],
    }


def _extract_keywords(question: str, answer_text: str):
    tokens = re.findall(r"[A-Za-z][A-Za-z0-9'-]+", f"{question} {answer_text}")
    stopwords = {"what", "which", "with", "that", "this", "from", "your", "about", "have", "into", "when"}
    keywords = []
    for token in tokens:
        lowered = token.lower()
        if len(lowered) < 4 or lowered in stopwords:
            continue
        if lowered not in keywords:
            keywords.append(lowered)
    return keywords[:6]


def evaluate_quick_check_submission(request: QuickCheckEvaluationRequest) -> QuickCheckEvaluationResponse:
    answers_by_question = {item.question_id: item.selected_option_id for item in request.answers}
    results = []
    score = 0

    for question in request.quick_check.questions:
        correct_option_id = question.correct_option_id or ""
        selected_option_id = answers_by_question.get(question.id, "")
        is_correct = selected_option_id == correct_option_id
        score += int(is_correct)
        results.append(
            QuickCheckEvaluationResult(
                question_id=question.id,
                selected_option_id=selected_option_id,
                correct_option_id=correct_option_id,
                is_correct=is_correct,
                explanation=question.explanation or "Review the source-backed answer and try again.",
            )
        )

    total_questions = len(request.quick_check.questions)
    return QuickCheckEvaluationResponse(
        quick_check_id=request.quick_check_id,
        score=score,
        total_questions=total_questions,
        results=results,
        next_step=_suggest_next_step(score, total_questions),
    )


def _suggest_next_step(score: int, total_questions: int) -> str:
    if total_questions <= 0:
        return "Revisit the answer once more before moving on."
    if score == total_questions:
        return "You’ve got the core idea. Try asking a deeper follow-up question next."
    if score >= max(1, total_questions - 1):
        return "Review the one concept you missed, then test yourself again."
    return "Re-read the answer and its sources, then try a simpler follow-up question for clarity."
