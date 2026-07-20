"""Question answering router backed by uploaded materials."""
from datetime import datetime
import json
import logging
import re
from typing import List, Optional

import requests
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
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
logger = logging.getLogger(__name__)

COMPLEXITY_HINTS = ("compare", "analyze", "evaluate", "why", "how", "difference", "complex", "mechanism")
CONFIDENCE_WEB_BONUS = 0.08


class ImageSearchRequest(BaseModel):
    query: str


class ImageSearchResponse(BaseModel):
    image_url: Optional[str] = None
    source: str = "wikimedia"


def _wikimedia_search_once(query: str) -> Optional[str]:
    """Single Wikimedia Commons lookup. Returns a thumbnail/full URL or None."""
    try:
        response = requests.get(
            "https://commons.wikimedia.org/w/api.php",
            params={
                "action": "query",
                "format": "json",
                "prop": "imageinfo",
                "generator": "search",
                "gsrsearch": query,
                "gsrlimit": 5,
                "iiprop": "url",
                "iiurlwidth": 768,
            },
            timeout=6,
        )
        response.raise_for_status()
        data = response.json()
        pages = (data.get("query") or {}).get("pages") or {}
        for page in pages.values():
            imageinfo = page.get("imageinfo") or []
            if not imageinfo:
                continue
            info = imageinfo[0]
            return info.get("thumburl") or info.get("url")
        return None
    except Exception:
        return None


def search_wikimedia_image(query: str) -> Optional[str]:
    """Look up a real image on Wikimedia Commons for the given query.

    Tries the query as given first, then progressively shorter keyword
    variants (Commons' search does much better on 2-4 keywords than on a
    full descriptive sentence). Returns a thumbnail URL (falling back to the
    full-size URL) for the first matching result, or None if nothing was
    found across all attempts.
    """
    if not query or not query.strip():
        return None

    tried = set()
    candidates = [query.strip()]

    words = [w for w in re.findall(r"[A-Za-z0-9]+", query) if len(w) > 2]
    if len(words) > 4:
        candidates.append(" ".join(words[:4]))
    if len(words) > 2:
        candidates.append(" ".join(words[:2]))

    for candidate in candidates:
        key = candidate.lower()
        if key in tried:
            continue
        tried.add(key)
        result = _wikimedia_search_once(candidate)
        if result:
            return result

    return None


@router.post("/image-search", response_model=ImageSearchResponse)
async def image_search(
    request: ImageSearchRequest,
    http_request: Request,
    current_user=Depends(get_current_user),
):
    """Find a real illustrative image on Wikimedia Commons for a chat-requested image block."""
    enforce_rate_limit(http_request, "qa-image-search", limit=60, window_seconds=300)
    image_url = search_wikimedia_image(request.query)
    return ImageSearchResponse(image_url=image_url, source="wikimedia")


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
        top_k=8,
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

    evidence_items = trim_evidence_items(dedupe_evidence_items(contexts), max_chars=6000)
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
    context_text = build_context_window(contexts[:6], max_chars=9000)
    conversation_text = _format_conversation_history(conversation_history)
    payload = {
        "model": "llama-3.3-70b-versatile",
        "temperature": 0.2,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a study assistant. Ground your answer in the provided study material first: use it as "
                    "your primary source, quote or paraphrase it, and cite what it says. "
                    "If the study material only partially covers the question, or does not cover it at all, do NOT "
                    "just say the material doesn't cover it and stop there -- briefly note that in one short sentence "
                    "at most, then immediately go on to actually answer the question fully and confidently using your "
                    "own general knowledge, the same way a knowledgeable tutor would. The student asked a question and "
                    "expects a real, complete answer every time, not a refusal or a mostly-empty response padded with "
                    "caveats. Never end an answer early just because the material was thin -- keep going until the "
                    "question is genuinely answered. "
                    "Be concise, accurate, and student-friendly. "
                    "Treat the recent conversation as context for follow-up questions like 'shorter', 'explain that', "
                    "'what about the next part', or 'simplify it'. "
                    "If the user asks a follow-up, preserve the topic from the conversation. "
                    "Formatting rules: "
                    "1) Write every mathematical, physics, chemistry, or biology formula, equation, or notation in LaTeX. "
                    "Use $...$ for a short inline expression (e.g. $E = mc^2$) and $$...$$ on its own line for a longer "
                    "or displayed equation. Never write formulas as plain text or ASCII when LaTeX can express them. "
                    "2) Only include a diagram if the student's message explicitly asks for one -- e.g. 'diagram', "
                    "'flowchart', 'flow chart', 'visualize', 'draw this', 'show me a diagram', 'map this out', or "
                    "similar. Do not add a diagram on your own initiative just because the topic could be visualized -- "
                    "answer in prose by default, and only draw something when asked to. When it is requested, draw it "
                    "yourself using a fenced ```diagram code block containing valid Mermaid syntax (flowchart, "
                    "sequenceDiagram, classDiagram, or graph). Mermaid syntax rules you must follow exactly: "
                    "(a) always wrap every node label in double quotes, e.g. A[\"Override run() method\"] not "
                    "A[Override run() method] -- required whenever a label contains parentheses, colons, pipes, quotes, "
                    "or any punctuation, and safe to do for every label even when not strictly required; never leave a "
                    "square-bracket, round-bracket, or curly-brace label unquoted if it contains anything other than "
                    "plain words and numbers. "
                    "(b) an edge label uses exactly this syntax: A -->|Label text| B -- the label sits between two pipe "
                    "characters directly after the arrow, and nothing else follows the closing pipe. Never write "
                    "A -->|Label|> B or add any '>' character after the closing pipe -- that is invalid and will fail "
                    "to render. "
                    "Mentally re-check every line of Mermaid syntax against these two rules before including it. "
                    "3) Only include a real picture if the student's message explicitly asks for one -- e.g. 'picture', "
                    "'photo', 'image', 'show me what it looks like', or similar. Do not add an image on your own "
                    "initiative. When it is requested, request one with a fenced ```image code block. That query is "
                    "used to search a real photo library first (Wikimedia "
                    "Commons), so its body must be a SHORT, concrete search phrase of 2-6 keywords naming the exact "
                    "subject -- the way you would type into an image search box -- not a full descriptive sentence. "
                    "Good: \"human eye anatomy diagram\", \"plant leaf cross section\", \"Eiffel Tower\". Bad: \"a "
                    "detailed cross-section illustration showing the cuticle, epidermis, mesophyll, and stomata of a "
                    "plant leaf, labeled\" -- that phrasing rarely matches a real photo's title or description, so it "
                    "fails the search and falls back to a generic AI illustration instead of a real, accurate photo. "
                    "If the student needs specific labeled parts, put those labels in your diagram or prose instead of "
                    "cramming them into the image search phrase. Use ```diagram for structured flows, cycles, or "
                    "relationships between concepts, and ```image for anything that should look like a real photo or "
                    "drawing -- never use both for the same visual, and use whichever (or both, for different parts of "
                    "the answer) genuinely helps the student understand."
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
    except requests.exceptions.HTTPError:
        logger.error(
            "Groq answer request failed with HTTP %s: %s",
            response.status_code,
            response.text[:500],
        )
        return None
    except Exception:
        logger.exception("Groq answer request failed")
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
        logger.exception("Groq quick-check request failed")
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
