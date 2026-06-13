"""AI-assisted classroom exam draft generation."""
from __future__ import annotations

import re
from typing import Dict, List

from app.agents.question_generator import QuestionGenerator
from app.services.document_context import build_context_window, normalize_whitespace

WORD_RE = re.compile(r"[A-Za-z][A-Za-z0-9'-]+")
STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "been", "by", "for", "from",
    "has", "have", "in", "is", "it", "its", "of", "on", "or", "that", "the",
    "their", "this", "to", "was", "were", "which", "with", "into", "about",
}


def build_exam_draft_payload(
    title: str,
    instructions: str | None,
    exam_mode: str,
    num_questions: int,
    linked_material_ids: List[str],
    source_contexts: List[Dict],
) -> Dict:
    """Build a mixed-format exam draft from source contexts."""
    selected_contexts = QuestionGenerator.select_source_contexts(source_contexts, max_items=max(num_questions * 2, 6))
    prompt_context = build_context_window(selected_contexts, max_chars=14000)
    normalized_title = (title or "").strip() or "AI-assisted classroom exam"
    normalized_instructions = (
        (instructions or "").strip()
        or "Answer every section clearly. Keep working inside the fixed response areas and support longer answers with key terminology from the material."
    )

    objective_target = max(2, min(num_questions // 2, num_questions)) if num_questions > 1 else 1
    objective_questions = []
    if prompt_context:
        objective_questions = QuestionGenerator.generate_questions(
            prompt_context,
            num_questions=objective_target,
            bloom_levels=[1, 2, 3, 4],
            source_contexts=selected_contexts,
        )

    draft_questions = []
    position = 0

    for item in objective_questions[:objective_target]:
        correct_option = next((option["id"] for option in item.get("options", []) if option.get("is_correct")), None)
        draft_questions.append(
            {
                "prompt": item.get("text") or "Review the material and answer this objective check.",
                "question_type": "mcq",
                "response_mode": "typed",
                "marks": 2,
                "options": [
                    {"id": option["id"], "text": option["text"]}
                    for option in (item.get("options") or [])
                    if option.get("text")
                ],
                "answer_key": correct_option,
                "grading_keywords": _extract_keywords(
                    f"{item.get('source_excerpt') or ''} {item.get('explanation') or ''}",
                    limit=4,
                ),
                "fixed_response_box": True,
                "response_config": {},
                "ai_suggestion_context": {
                    "source_document_id": item.get("document_id"),
                    "source_document_title": item.get("document_reference"),
                    "page_number": item.get("page_number"),
                    "suggestion_type": "objective_grounded",
                },
                "position": position,
            }
        )
        position += 1

    remaining_slots = max(0, num_questions - len(draft_questions))
    descriptive_contexts = selected_contexts[: max(remaining_slots, 2)]
    descriptive_types = _descriptive_type_cycle(exam_mode)

    for index in range(remaining_slots):
        context = descriptive_contexts[index % len(descriptive_contexts)] if descriptive_contexts else {}
        question_type = descriptive_types[index % len(descriptive_types)]
        response_mode = "typed_or_image" if question_type == "hybrid" else "typed"
        excerpt = normalize_whitespace(context.get("content", ""))[:260]
        keywords = _extract_keywords(excerpt, limit=5)
        topic = keywords[0].replace("-", " ") if keywords else "the core concept"
        supporting_topic = keywords[1].replace("-", " ") if len(keywords) > 1 else "the evidence from the material"
        document_title = context.get("document_title") or "the linked material"

        if question_type == "short_text":
            prompt = f"In 3 to 5 sentences, explain {topic} using evidence from {document_title}."
            marks = 4
            rows = 5
        elif question_type == "hybrid":
            prompt = f"Describe {topic} and add a labeled sketch, diagram, or handwritten working if it helps clarify {supporting_topic}."
            marks = 6
            rows = 6
        else:
            prompt = f"Write a structured answer explaining how {topic} connects to {supporting_topic} based on {document_title}."
            marks = 8
            rows = 8

        draft_questions.append(
            {
                "prompt": prompt,
                "question_type": question_type,
                "response_mode": response_mode,
                "marks": marks,
                "options": [],
                "answer_key": excerpt or f"Reference the linked material clearly when discussing {topic}.",
                "grading_keywords": keywords,
                "fixed_response_box": True,
                "response_config": {
                    "rows": rows,
                    "placeholder": "Write a grounded answer using the linked study material.",
                },
                "ai_suggestion_context": {
                    "source_document_id": context.get("document_id"),
                    "source_document_title": document_title,
                    "page_number": context.get("page_number"),
                    "suggestion_type": "descriptive_grounded",
                },
                "position": position,
            }
        )
        position += 1

    blocks = [
        {
            "block_type": "heading",
            "title": "Exam overview",
            "content": {"text": normalized_title},
            "sort_order": 0,
            "metadata": {"source": "ai_draft"},
        },
        {
            "block_type": "instructions",
            "title": "Instructions",
            "content": {"text": normalized_instructions},
            "sort_order": 1,
            "metadata": {"source": "ai_draft"},
        },
        {
            "block_type": "rich_text",
            "title": "Coverage",
            "content": {
                "text": "This AI-assisted paper blends quick objective checks with longer written responses so the educator can review both recall and reasoning from the linked material."
            },
            "sort_order": 2,
            "metadata": {"source": "ai_draft"},
        },
    ]

    source_documents_used = []
    seen_document_ids = set()
    for item in selected_contexts:
        document_id = item.get("document_id")
        if not document_id or document_id in seen_document_ids:
            continue
        seen_document_ids.add(document_id)
        source_documents_used.append(
            {
                "document_id": document_id,
                "document_title": item.get("document_title"),
                "page_number": item.get("page_number"),
            }
        )

    return {
        "title": normalized_title,
        "instructions": normalized_instructions,
        "exam_mode": exam_mode,
        "linked_material_ids": linked_material_ids,
        "blocks": blocks,
        "questions": draft_questions[:num_questions],
        "source_documents_used": source_documents_used,
        "generation_summary": {
            "question_count": min(num_questions, len(draft_questions)),
            "objective_count": len([question for question in draft_questions[:num_questions] if question["question_type"] == "mcq"]),
            "descriptive_count": len([question for question in draft_questions[:num_questions] if question["question_type"] != "mcq"]),
        },
    }


def _extract_keywords(text: str, limit: int = 5) -> List[str]:
    counts: Dict[str, int] = {}
    for token in WORD_RE.findall(text or ""):
        normalized = token.lower()
        if len(normalized) < 4 or normalized in STOPWORDS:
            continue
        counts[normalized] = counts.get(normalized, 0) + 1
    ranked = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    return [word for word, _count in ranked[:limit]]


def _descriptive_type_cycle(exam_mode: str) -> List[str]:
    if exam_mode == "objective":
        return ["short_text"]
    if exam_mode == "written":
        return ["long_text", "hybrid", "short_text"]
    return ["short_text", "long_text", "hybrid"]
