"""AI-assisted grading helpers for classroom exams."""
from __future__ import annotations

import re
from collections import Counter
from typing import Any


WORD_RE = re.compile(r"[a-z0-9']+")
STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have",
    "in", "into", "is", "it", "of", "on", "or", "that", "the", "their", "there",
    "this", "to", "was", "were", "will", "with", "your",
}
REASONING_WORDS = {
    "because", "therefore", "thus", "hence", "so", "which", "shows", "means",
    "results", "causes", "leads", "explains", "compare", "difference", "process",
}


def _normalize_text(value: str | None) -> str:
    return " ".join((value or "").strip().lower().split())


def _tokenize(value: str | None) -> list[str]:
    return [token for token in WORD_RE.findall(_normalize_text(value)) if token not in STOPWORDS]


def _unique_ratio(tokens: list[str]) -> float:
    if not tokens:
        return 0.0
    return min(1.0, len(set(tokens)) / max(len(tokens), 1))


def _sentence_count(value: str | None) -> int:
    parts = [chunk.strip() for chunk in re.split(r"[.!?\n]+", value or "") if chunk.strip()]
    return len(parts)


def _keyword_coverage(answer_text: str, keywords: list[str]) -> tuple[float, list[str], list[str]]:
    normalized_keywords = [str(item).strip().lower() for item in keywords if str(item).strip()]
    if not normalized_keywords:
        return 0.0, [], []

    matched = [keyword for keyword in normalized_keywords if keyword in answer_text]
    missed = [keyword for keyword in normalized_keywords if keyword not in matched]
    coverage = len(matched) / max(len(normalized_keywords), 1)
    return coverage, matched, missed


def _answer_key_alignment(answer_text: str, answer_key: str | None) -> tuple[float, list[str]]:
    key_terms = [token for token, count in Counter(_tokenize(answer_key)).items() if count >= 1]
    if not key_terms:
        return 0.0, []

    matched = [token for token in key_terms if token in answer_text]
    alignment = len(matched) / max(len(key_terms), 1)
    return min(1.0, alignment), matched[:8]


def _reasoning_signal(answer_text: str) -> float:
    tokens = _tokenize(answer_text)
    if not tokens:
        return 0.0
    hits = sum(1 for token in tokens if token in REASONING_WORDS)
    sentence_bonus = min(_sentence_count(answer_text) / 4, 1.0)
    vocabulary_bonus = _unique_ratio(tokens)
    return min(1.0, (hits / 3) * 0.5 + sentence_bonus * 0.25 + vocabulary_bonus * 0.25)


def _length_signal(answer_text: str, response_config: dict[str, Any] | None) -> float:
    tokens = _tokenize(answer_text)
    expected_rows = max(int((response_config or {}).get("rows") or 4), 1)
    target_words = max(expected_rows * 10, 20)
    return min(1.0, len(tokens) / target_words)


def _build_descriptive_feedback(
    *,
    coverage: float,
    answer_key_alignment: float,
    reasoning_signal: float,
    missed_keywords: list[str],
    image_only: bool,
) -> str:
    if image_only:
        return "Image-only answer detected. Teacher review is required before releasing marks."
    if coverage >= 0.8 and answer_key_alignment >= 0.55:
        return "Strong answer coverage. Review for nuance and exact accuracy before release."
    if coverage >= 0.5:
        hint = f" Missing focus areas: {', '.join(missed_keywords[:3])}." if missed_keywords else ""
        return f"Partially aligned answer with some important concepts present.{hint}"
    if reasoning_signal >= 0.5:
        return "The response shows some reasoning, but it is missing too many target concepts."
    return "Low alignment to the expected concepts. Teacher review should check understanding and completeness."


def _grade_objective_question(question: dict[str, Any], response: dict[str, Any]) -> tuple[float, float]:
    marks = float(question.get("marks") or 0.0)
    expected = question.get("answer_key")
    selected_ids = response.get("selected_option_ids") or []
    if isinstance(expected, str):
        expected_ids = [expected]
    else:
        expected_ids = list(expected or [])
    if not expected_ids:
        return 0.0, 0.0
    selected = sorted(str(item) for item in selected_ids)
    expected = sorted(str(item) for item in expected_ids)
    score = marks if selected == expected else 0.0
    confidence = 0.98 if selected == expected else 0.72
    return score, confidence


def _grade_descriptive_question(question: dict[str, Any], response: dict[str, Any]) -> tuple[float, float, float, list[str], dict[str, Any]]:
    marks = float(question.get("marks") or 0.0)
    answer_text = _normalize_text(response.get("typed_answer"))
    image_urls = response.get("uploaded_image_urls") or []
    image_only = bool(image_urls and not answer_text)
    keywords = question.get("grading_keywords") or []

    coverage, matched_keywords, missed_keywords = _keyword_coverage(answer_text, keywords)
    answer_key_alignment, matched_answer_key_terms = _answer_key_alignment(answer_text, question.get("answer_key"))
    reasoning_signal = _reasoning_signal(answer_text)
    length_signal = _length_signal(answer_text, question.get("response_config"))

    weighted_alignment = (
        coverage * 0.5
        + answer_key_alignment * 0.22
        + reasoning_signal * 0.16
        + length_signal * 0.12
    )
    weighted_alignment = min(1.0, weighted_alignment)
    score = round(marks * weighted_alignment, 2)

    confidence = min(0.96, 0.34 + coverage * 0.3 + answer_key_alignment * 0.18 + reasoning_signal * 0.1 + length_signal * 0.08)
    review_reasons: list[str] = []
    if image_only:
      confidence = min(confidence, 0.24)
      review_reasons.append("image_only_response_requires_teacher_review")
    if coverage < 0.35:
      review_reasons.append("keyword_alignment_low")
    if len(_tokenize(answer_text)) < 12 and not image_only:
      review_reasons.append("answer_too_brief_for_confident_release")
    if answer_key_alignment < 0.2 and question.get("answer_key"):
      review_reasons.append("model_answer_alignment_low")

    rubric = {
        "coverage_score": round(coverage, 2),
        "answer_key_alignment": round(answer_key_alignment, 2),
        "reasoning_signal": round(reasoning_signal, 2),
        "length_signal": round(length_signal, 2),
        "matched_keywords": matched_keywords[:8],
        "missed_keywords": missed_keywords[:8],
        "matched_answer_key_terms": matched_answer_key_terms,
        "auto_feedback": _build_descriptive_feedback(
            coverage=coverage,
            answer_key_alignment=answer_key_alignment,
            reasoning_signal=reasoning_signal,
            missed_keywords=missed_keywords,
            image_only=image_only,
        ),
    }
    return score, round(confidence, 2), weighted_alignment, review_reasons, rubric


def build_exam_grading_payload(
    *,
    exam: dict[str, Any],
    questions: list[dict[str, Any]],
    responses: list[dict[str, Any]],
) -> dict[str, Any]:
    """Build a structured grading payload for mixed-mode exam attempts."""
    response_by_question = {response.get("question_id"): response for response in responses}
    objective_score = 0.0
    descriptive_score = 0.0
    keyword_alignment: dict[str, float] = {}
    low_confidence_reasons: list[str] = []
    question_breakdown: list[dict[str, Any]] = []

    for question in questions:
        question_id = question.get("id")
        response = response_by_question.get(question_id, {})
        question_type = question.get("question_type") or "long_text"
        response_mode = question.get("response_mode") or "typed"
        grading_keywords = question.get("grading_keywords") or []

        rubric_summary: dict[str, Any] | None = None
        if question_type in {"mcq", "multiple_choice", "checkbox"}:
            score, confidence = _grade_objective_question(question, response)
            objective_score += score
            alignment = 1.0 if score > 0 else 0.0
            reasons: list[str] = []
        else:
            score, confidence, alignment, reasons, rubric_summary = _grade_descriptive_question(question, response)
            descriptive_score += score
            low_confidence_reasons.extend(reasons)

        keyword_alignment[question_id] = round(alignment, 2)
        question_breakdown.append(
            {
                "question_id": question_id,
                "question_type": question_type,
                "response_mode": response_mode,
                "grading_keywords": grading_keywords,
                "confidence": round(confidence, 2),
                "score": round(score, 2),
                "teacher_review_required": confidence < 0.68 or bool(reasons),
                "review_reasons": reasons,
                "rubric_summary": rubric_summary,
            }
        )

    teacher_review_required = any(item["teacher_review_required"] for item in question_breakdown)
    return {
        "exam_id": exam.get("id"),
        "exam_title": exam.get("title"),
        "objective_score": round(objective_score, 2),
        "descriptive_score": round(descriptive_score, 2),
        "keyword_alignment": keyword_alignment,
        "teacher_review_required": teacher_review_required,
        "low_confidence_reasons": list(dict.fromkeys(low_confidence_reasons)),
        "question_breakdown": question_breakdown,
    }


def grade_exam_attempt(
    *,
    exam: dict[str, Any],
    questions: list[dict[str, Any]],
    responses: list[dict[str, Any]],
) -> dict[str, Any]:
    """Return a teacher-friendly summary for an exam attempt."""
    payload = build_exam_grading_payload(exam=exam, questions=questions, responses=responses)
    total_score = round(payload["objective_score"] + payload["descriptive_score"], 2)
    payload["total_score"] = total_score
    payload["status"] = "teacher_review_required" if payload["teacher_review_required"] else "ai_graded"
    return payload
