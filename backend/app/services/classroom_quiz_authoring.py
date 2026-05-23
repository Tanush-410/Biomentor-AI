"""Helpers for educator-authored classroom quizzes."""
from __future__ import annotations

import uuid
from typing import Dict, List


def normalize_manual_questions(questions: List[Dict] | None) -> List[Dict]:
    """Validate and normalize educator-authored questions."""
    if not questions:
        raise ValueError("At least one manual question is required.")

    normalized = []
    for index, item in enumerate(questions, start=1):
        prompt = (item.get("prompt") or "").strip()
        if not prompt:
            raise ValueError(f"Question {index} is missing a prompt.")

        raw_options = item.get("options") or []
        if len(raw_options) != 4:
            raise ValueError(f"Question {index} must include exactly 4 options.")

        normalized_options = []
        seen_ids = set()
        for option_index, option in enumerate(raw_options, start=1):
            option_id = str(option.get("id") or chr(64 + option_index)).strip().upper()
            option_text = (option.get("text") or "").strip()
            if not option_text:
                raise ValueError(f"Question {index} has an empty option.")
            if option_id in seen_ids:
                raise ValueError(f"Question {index} contains duplicate option ids.")
            seen_ids.add(option_id)
            normalized_options.append({"id": option_id, "text": option_text, "is_correct": False})

        correct_option_id = str(item.get("correct_option_id") or "").strip().upper()
        if correct_option_id not in seen_ids:
            raise ValueError(f"Question {index} must select one valid correct option.")

        for option in normalized_options:
            option["is_correct"] = option["id"] == correct_option_id

        bloom_level = int(item.get("bloom_level") or 3)
        normalized.append(
            {
                "prompt": prompt,
                "options": normalized_options,
                "correct_option_id": correct_option_id,
                "explanation": (item.get("explanation") or "").strip() or None,
                "bloom_level": bloom_level,
                "position": index,
            }
        )

    return normalized


def build_manual_generated_questions(
    normalized_questions: List[Dict],
    *,
    user_id: str,
    session_id: str,
    classroom_quiz_title: str,
    document_id: str | None,
) -> List[Dict]:
    """Convert manual classroom questions into the generated-question runtime shape."""
    generated = []
    for item in normalized_questions:
        generated.append(
            {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "session_id": session_id,
                "document_id": document_id,
                "source_text": item["prompt"],
                "question_text": item["prompt"],
                "options": item["options"],
                "correct_answer": item["correct_option_id"],
                "explanation": item.get("explanation"),
                "bloom_level": item.get("bloom_level", 3),
                "source_excerpt": item["prompt"],
                "document_reference": classroom_quiz_title,
                "page_number": None,
            }
        )
    return generated
