"""Question answering router backed by uploaded materials."""
from datetime import datetime
import base64
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
from app.services.ai_generation import (
    ai_chat_completion,
    ai_json_completion,
    ai_provider_available,
    gemini_generate_image,
)
from app.services.ai_quality import classify_confidence, make_origin_label
from app.services.document_context import build_context_window, fallback_preview_context, get_document_context
from app.services.learning_analytics import record_gap_snapshot
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


class ImageGenerateRequest(BaseModel):
    prompt: str


class ImageGenerateResponse(BaseModel):
    image_url: Optional[str] = None
    source: str = "none"


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


@router.post("/image-generate", response_model=ImageGenerateResponse)
async def image_generate(
    request: ImageGenerateRequest,
    http_request: Request,
    current_user=Depends(get_current_user),
):
    """Automatically generate an illustration with Gemini when no real photo was found.

    Called by the chat UI as the second step of a requested ```image block,
    after a Wikimedia Commons search comes up empty. Returns a data URI so
    the frontend can render it directly with no extra storage step.
    """
    enforce_rate_limit(http_request, "qa-image-generate", limit=30, window_seconds=300)
    prompt = (request.prompt or "").strip()
    if not prompt:
        return ImageGenerateResponse(image_url=None, source="none")

    # gemini_generate_image() already catches its own request/network errors
    # and returns None on failure. This extra guard is for anything
    # unexpected beyond that (e.g. a malformed image payload) -- the chat UI
    # already handles image_url=None by falling back to the Pollinations
    # illustration, so degrading here is always safe and never surfaces as
    # a broken chat message.
    try:
        image_bytes = gemini_generate_image(prompt)
    except Exception:
        logger.exception("Unexpected failure generating an image with Gemini.")
        image_bytes = None

    if not image_bytes:
        return ImageGenerateResponse(image_url=None, source="none")

    try:
        encoded = base64.b64encode(image_bytes).decode("ascii")
    except Exception:
        logger.exception("Failed to encode generated image bytes.")
        return ImageGenerateResponse(image_url=None, source="none")

    return ImageGenerateResponse(image_url=f"data:image/png;base64,{encoded}", source="gemini")


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
    db: Session = Depends(get_db),
):
    """Grade a lightweight adaptive quick check."""
    enforce_rate_limit(http_request, "qa-quick-check", limit=60, window_seconds=300)
    return evaluate_quick_check_submission(request, db=db, user_id=current_user.id)


def build_answer_response(
    db: Session,
    current_user,
    request: AnswerGenerationRequest,
    retrieve_fn=None,
    web_search_fn=None,
) -> AnswerGenerationResponse:
    """Reusable answer builder for HTTP and collaboration flows.

    This is a thin safety-net wrapper around _build_answer_response_inner:
    the student always gets a normal chat message back, never a raw crash.
    An intentional HTTPException (e.g. "no material available", a 404) is a
    real, meaningful error and is left to propagate as-is -- the frontend
    already shows that message properly. Anything else -- a bug, a network
    hiccup in a dependency, a malformed AI response that slips past our own
    validation -- is caught here, logged with the full traceback for
    debugging, and turned into a normal-looking (if apologetic) answer
    instead of the raw "Internal Server Error" text a student would
    otherwise see with no explanation.
    """
    try:
        return _build_answer_response_inner(db, current_user, request, retrieve_fn, web_search_fn)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Unexpected failure while building a chat answer; returning a safe fallback instead of a 500.")
        return AnswerGenerationResponse(
            question=request.question,
            answer=(
                "I ran into an unexpected problem while working on that answer. Please try asking again -- "
                "if it keeps happening, try rephrasing the question or picking a specific document from the list."
            ),
            sources=[],
            confidence=0.4,
            confidence_label="low",
            confidence_reason="An internal error interrupted answer generation, so this is a safe placeholder rather than a real answer.",
            answer_origin="material",
            source_badge=make_origin_label("material"),
            fallback_used=True,
            complexity="simple",
            show_quick_check=False,
            quick_check=None,
            generated_at=datetime.utcnow(),
        )


def _build_answer_response_inner(
    db: Session,
    current_user,
    request: AnswerGenerationRequest,
    retrieve_fn=None,
    web_search_fn=None,
) -> AnswerGenerationResponse:
    """Actual answer-building logic, previously named build_answer_response.

    Kept as a separate function so build_answer_response's try/except can
    wrap the entire pipeline in one place instead of scattering guards
    throughout it.
    """
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
            try:
                trusted_web_contexts, broad_web_contexts = web_search_fn(
                    _default_web_search_client(),
                    request.question,
                    settings.trusted_search_domains,
                )
            except TypeError:
                # web_search_fn doesn't take a search-client arg (e.g. a test
                # double) -- not a real failure, just a different calling
                # convention, so retry that way rather than falling to the
                # broader except below.
                trusted_web_contexts, broad_web_contexts = web_search_fn(
                    request.question,
                    settings.trusted_search_domains,
                )
        except Exception:
            # A genuine web-search failure (network error, timeout, search
            # provider outage, unexpected response shape) should degrade to
            # material-only answering, not crash the whole chat request.
            logger.warning("Web search fallback failed; continuing with material-only context.", exc_info=True)
            trusted_web_contexts, broad_web_contexts = [], []

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
    if ai_provider_available():
        answer = _generate_with_ai(question, contexts, conversation_history or [])
        if answer:
            return answer, 0.82

    top = contexts[0]
    return (
        f"Based on your uploaded material \"{top['document_title']}\", the most relevant section says: {top['content'][:260]}...",
        0.55
    )


def _generate_with_ai(question: str, contexts, conversation_history):
    context_text = build_context_window(contexts[:6], max_chars=9000)
    conversation_text = _format_conversation_history(conversation_history)
    system_prompt = (
                    "You are a study assistant. Ground your answer in the provided study material first: use it as "
                    "your primary source, quote or paraphrase it, and cite what it says. "
                    "If the study material only partially covers the question, or does not cover it at all, do NOT "
                    "just say the material doesn't cover it and stop there -- briefly note that in one short sentence "
                    "at most, then immediately go on to actually answer the question fully and confidently using your "
                    "own general knowledge, the same way a knowledgeable tutor would. The student asked a question and "
                    "expects a real, complete answer every time, not a refusal or a mostly-empty response padded with "
                    "caveats. Never end an answer early just because the material was thin -- keep going until the "
                    "question is genuinely answered. "
                    "Be accurate and student-friendly, and match your length and depth to what the question actually "
                    "needs. For a simple, factual, or definition-style question ('what is X', 'when did Y happen'), "
                    "answer briefly and directly -- a sentence or two, no padding. For a question that asks to "
                    "explain, compare, analyze, or understand a mechanism ('why', 'how', 'explain', 'compare', "
                    "'walk me through'), or one that is inherently multi-part or conceptually deep, give a fuller "
                    "explanation: break it into the key steps or components, and use a short concrete example where "
                    "it genuinely helps understanding. Never pad a simple answer with unnecessary detail just to "
                    "seem thorough, and never compress a genuinely complex topic into one line just to seem concise -- "
                    "let the question's own complexity set the length. "
                    "Treat the recent conversation as context for follow-up questions like 'shorter', 'explain that', "
                    "'what about the next part', or 'simplify it'. "
                    "If the user asks a follow-up, preserve the topic from the conversation. "
                    "Formatting rules: "
                    "1) Write every mathematical, physics, chemistry, or biology formula, equation, or notation in LaTeX. "
                    "Use $...$ for a short inline expression (e.g. $E = mc^2$) and $$...$$ on its own line for a longer "
                    "or displayed equation. Never write formulas as plain text or ASCII when LaTeX can express them. "
                    "2) Include a flowchart/diagram whenever the answer genuinely involves a process, cycle, sequence "
                    "of steps, or a relationship between multiple concepts that is easier to follow visually than in "
                    "prose alone -- you do not need to wait for the student to say 'diagram' or 'flowchart', use your "
                    "judgment. Skip it for simple factual or single-idea answers where a diagram would add nothing. "
                    "When you include one, draw it "
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
                    "3) ALWAYS include one relevant real picture with every single answer, no exceptions -- this is "
                    "mandatory, not optional and not dependent on the student asking for one or on the topic being "
                    "visual. Every answer, regardless of subject or how abstract or simple the question is, must end "
                    "with a fenced ```image code block illustrating something relevant to the answer -- the main "
                    "subject discussed, a related real-world object, a person, place, or concept tied to it. Never "
                    "skip this step. That query is "
                    "used to search a real photo library first (Wikimedia "
                    "Commons), so its body must be a SHORT, concrete search phrase of 2-6 keywords naming the exact "
                    "subject -- the way you would type into an image search box -- not a full descriptive sentence. "
                    "Good: \"human eye anatomy diagram\", \"plant leaf cross section\", \"Eiffel Tower\". Bad: \"a "
                    "detailed cross-section illustration showing the cuticle, epidermis, mesophyll, and stomata of a "
                    "plant leaf, labeled\" -- that phrasing rarely matches a real photo's title or description, so it "
                    "fails the search and falls back to a generic AI illustration instead of a real, accurate photo. "
                    "If the student needs specific labeled parts, put those labels in your diagram or prose instead of "
                    "cramming them into the image search phrase. Use ```diagram for structured flows, cycles, or "
                    "relationships between concepts, and ```image for the real photo or drawing that must accompany "
                    "every answer -- they serve different purposes, so include the diagram in addition to the "
                    "mandatory image whenever the process/relationship visual is also warranted, never as a "
                    "replacement for it."
    )
    user_prompt = (
        f"Current question: {question}\n\n"
        f"Recent conversation:\n{conversation_text}\n\n"
        f"Study material:\n{context_text}\n\n"
        "Answer the current question. If it is a follow-up, use the recent conversation only to clarify intent, "
        "but ground the answer in the study material."
    )

    text, provider = ai_chat_completion(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=0.2,
        timeout=30,
    )
    if not text:
        logger.warning("Both Gemini and Groq failed to produce an answer.")
        return None
    if provider == "groq":
        logger.info("Answer generated via Groq failsafe (Gemini unavailable or failed).")
    return text.strip()


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
    if ai_provider_available():
        generated = _generate_quick_check_with_ai(question, contexts, answer_text)
        if _is_valid_quick_check_shape(generated):
            generated.setdefault("topic", _quick_check_topic(contexts))
            return generated
    quick_check = _build_quick_check_fallback(question, contexts, answer_text)
    quick_check["topic"] = _quick_check_topic(contexts)
    return quick_check


def _is_valid_quick_check_shape(generated) -> bool:
    """Reject a model's quick-check JSON if it doesn't actually match QuickCheckPayload's shape.

    ai_json_completion already guarantees a dict (never a bare list/scalar),
    but a dict can still be missing "questions" or have malformed question
    entries -- which would otherwise blow up later when we try to build the
    AnswerGenerationResponse from it. Better to detect that here and fall
    back to the deterministic quick check than crash the whole request.
    """
    if not isinstance(generated, dict):
        return False
    questions = generated.get("questions")
    if not isinstance(questions, list) or not questions:
        return False
    for question in questions:
        if not isinstance(question, dict):
            return False
        options = question.get("options")
        if not isinstance(options, list) or not options:
            return False
        if not all(isinstance(option, dict) and "id" in option and "text" in option for option in options):
            return False
        if "id" not in question or "prompt" not in question:
            return False
    return True


def _quick_check_topic(contexts) -> Optional[str]:
    """Best-effort topic label for a quick check, used later to record a gap-analytics snapshot."""
    if not contexts:
        return None
    return contexts[0].get("document_title") or None


def _generate_quick_check_with_ai(question: str, contexts, answer_text: str):
    context_text = build_context_window(contexts[:3], max_chars=3500)
    system_prompt = (
        "Create a compact 2-3 question multiple-choice quick check. "
        "Return valid JSON only with keys id, title, questions. "
        "Each question must include id, prompt, options, correct_option_id, explanation. "
        "Each option must include id and text."
    )
    user_prompt = (
        f"Question:\n{question}\n\n"
        f"Answer:\n{answer_text}\n\n"
        f"Sources:\n{context_text}\n\n"
        "Create a short quick check grounded in this material."
    )
    parsed = ai_json_completion(system_prompt=system_prompt, user_prompt=user_prompt, temperature=0.2, timeout=30)
    if parsed is None:
        logger.warning("Both Gemini and Groq failed to produce a quick check.")
    return parsed


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


def evaluate_quick_check_submission(
    request: QuickCheckEvaluationRequest,
    db: Optional[Session] = None,
    user_id: Optional[str] = None,
) -> QuickCheckEvaluationResponse:
    try:
        return _evaluate_quick_check_submission_inner(request, db=db, user_id=user_id)
    except Exception:
        # The grading loop runs over already Pydantic-validated data, so this
        # should be very rare -- but per "never a raw crash," still degrade
        # to an honest zero-score result instead of a 500 if something
        # unexpected happens here.
        logger.exception("Unexpected failure while grading a quick check; returning a safe fallback result.")
        total_questions = len(request.quick_check.questions) if request.quick_check else 0
        return QuickCheckEvaluationResponse(
            quick_check_id=request.quick_check_id,
            score=0,
            total_questions=total_questions,
            results=[],
            next_step="We couldn't grade that quick check just now -- re-read the answer above and continue when you're ready.",
        )


def _evaluate_quick_check_submission_inner(
    request: QuickCheckEvaluationRequest,
    db: Optional[Session] = None,
    user_id: Optional[str] = None,
) -> QuickCheckEvaluationResponse:
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

    # Feed this graded quick check into gap analytics (best-effort -- a
    # missing db/user_id, e.g. in direct unit-test calls, just skips this).
    if db is not None and user_id and total_questions > 0:
        try:
            mastery = (score / total_questions) * 100
            record_gap_snapshot(
                db,
                user_id,
                request.quick_check.topic or "General",
                mastery,
                source="quick_check",
                sample_size=total_questions,
            )
            db.commit()
        except Exception:
            logger.exception("Failed to record gap snapshot for quick check.")
            db.rollback()

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
