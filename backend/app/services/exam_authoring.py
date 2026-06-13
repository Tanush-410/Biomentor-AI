"""Helpers for classroom exam authoring and normalization."""
from __future__ import annotations

from typing import Any


def normalize_exam_blocks(blocks: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    """Return a stable ordered block payload for storage."""
    normalized: list[dict[str, Any]] = []
    for index, block in enumerate(blocks or []):
        normalized.append(
            {
                "block_type": block.get("block_type") or "text",
                "title": block.get("title"),
                "content": block.get("content") or {},
                "sort_order": block.get("sort_order", index),
                "metadata": block.get("metadata") or {},
            }
        )
    return normalized


def normalize_exam_questions(questions: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    """Normalize manual or AI-suggested exam questions before persistence."""
    normalized: list[dict[str, Any]] = []
    for index, question in enumerate(questions or []):
        normalized.append(
            {
                "prompt": (question.get("prompt") or "").strip(),
                "question_type": question.get("question_type") or "long_text",
                "response_mode": question.get("response_mode") or "typed",
                "marks": float(question.get("marks") or 1.0),
                "options": question.get("options") or [],
                "answer_key": question.get("answer_key"),
                "grading_keywords": question.get("grading_keywords") or [],
                "fixed_response_box": bool(question.get("fixed_response_box", True)),
                "response_config": question.get("response_config") or {},
                "ai_suggestion_context": question.get("ai_suggestion_context") or {},
                "position": question.get("position", index),
            }
        )
    return normalized

