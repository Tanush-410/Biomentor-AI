"""Teacher-facing review helpers for descriptive classroom exams."""
from __future__ import annotations

from typing import Any


def build_exam_review_attempt_payload(
    *,
    exam: dict[str, Any],
    attempt: dict[str, Any],
    student: dict[str, Any],
    questions: list[dict[str, Any]],
    responses: list[dict[str, Any]],
) -> dict[str, Any]:
    """Build a detailed teacher-review payload for one exam attempt."""
    grading_summary = attempt.get("grading_summary") or {}
    breakdown_by_question = {
        item.get("question_id"): item
        for item in (grading_summary.get("question_breakdown") or [])
        if item.get("question_id")
    }
    response_by_question = {
        response.get("question_id"): response
        for response in responses
        if response.get("question_id")
    }

    question_reviews: list[dict[str, Any]] = []
    pending_review_count = 0
    release_score = 0.0

    for question in sorted(questions, key=lambda item: item.get("position", 0)):
        response = response_by_question.get(question.get("id"), {})
        breakdown = breakdown_by_question.get(question.get("id"), {})
        review_status = response.get("review_status") or "pending_teacher_review"
        teacher_review_required = bool(
            review_status in {"pending_ai", "pending_teacher_review"}
            or (
                question.get("question_type") != "mcq"
                and review_status not in {"teacher_finalized", "ai_graded", "ai_confirmed"}
            )
            or (
                breakdown.get("teacher_review_required")
                and review_status not in {"teacher_finalized", "ai_confirmed"}
            )
        )
        if teacher_review_required:
            pending_review_count += 1

        released_score = response.get("teacher_score")
        if released_score is None:
            released_score = response.get("ai_score", breakdown.get("score", 0.0)) or 0.0
        release_score += float(released_score or 0.0)

        question_reviews.append(
            {
                "response_id": response.get("id"),
                "question_id": question.get("id"),
                "prompt": question.get("prompt"),
                "question_type": question.get("question_type"),
                "response_mode": question.get("response_mode"),
                "marks": question.get("marks") or 0,
                "grading_keywords": question.get("grading_keywords") or [],
                "answer_key": question.get("answer_key"),
                "position": question.get("position", 0),
                "typed_answer": response.get("typed_answer") or "",
                "uploaded_image_urls": response.get("uploaded_image_urls") or [],
                "selected_option_ids": response.get("selected_option_ids") or [],
                "response_metadata": response.get("response_metadata") or {},
                "ai_score": response.get("ai_score", breakdown.get("score", 0.0)) or 0.0,
                "ai_confidence": breakdown.get("confidence"),
                "ai_review_reasons": breakdown.get("review_reasons") or [],
                "rubric_summary": breakdown.get("rubric_summary") or {},
                "teacher_score": response.get("teacher_score"),
                "teacher_feedback": response.get("teacher_feedback"),
                "review_status": review_status,
                "teacher_review_required": teacher_review_required,
            }
        )

    question_navigator = [
        {
            "response_id": review.get("response_id"),
            "question_id": review.get("question_id"),
            "label": f"Question {index + 1}",
            "prompt_preview": (review.get("prompt") or "").strip()[:110],
            "teacher_review_required": review.get("teacher_review_required", False),
            "review_status": review.get("review_status"),
            "marks": review.get("marks") or 0,
        }
        for index, review in enumerate(question_reviews)
    ]

    total_release_score = attempt.get("score")
    if total_release_score is None:
        total_release_score = release_score

    release_summary = {
        "release_score": float(total_release_score or 0.0),
        "pending_review_count": pending_review_count,
        "questions_in_desk": len(question_reviews),
        "teacher_review_required": pending_review_count > 0 or bool(attempt.get("teacher_review_required")),
        "release_readiness": "ready_to_release" if pending_review_count == 0 else "teacher_review_required",
        "checklist": [
            {
                "id": "scores-reviewed",
                "label": "Every question has a teacher-reviewed or AI-confirmed released score.",
                "complete": len(question_reviews) > 0,
            },
            {
                "id": "pending-cleared",
                "label": "Pending question checks are cleared before final score release.",
                "complete": pending_review_count == 0,
            },
            {
                "id": "feedback-ready",
                "label": "Overall teacher feedback is ready for the learner release step.",
                "complete": bool((grading_summary.get("overall_feedback") or "").strip()),
            },
        ],
    }

    return {
        "attempt_id": attempt.get("id"),
        "exam_id": exam.get("id"),
        "exam_title": exam.get("title"),
        "student_id": student.get("id"),
        "student_name": student.get("full_name") or student.get("name") or student.get("email") or student.get("id"),
        "student_email": student.get("email"),
        "status": attempt.get("status"),
        "objective_score": attempt.get("objective_score") or 0.0,
        "descriptive_score": attempt.get("descriptive_score") or 0.0,
        "score": attempt.get("score") or 0.0,
        "submitted_at": attempt.get("submitted_at"),
        "ended_at": attempt.get("ended_at"),
        "teacher_review_required": bool(attempt.get("teacher_review_required")),
        "termination_reason": attempt.get("termination_reason"),
        "low_confidence_reasons": grading_summary.get("low_confidence_reasons") or [],
        "overall_feedback": grading_summary.get("overall_feedback"),
        "pending_review_count": pending_review_count,
        "release_summary": release_summary,
        "question_navigator": question_navigator,
        "question_reviews": question_reviews,
    }
