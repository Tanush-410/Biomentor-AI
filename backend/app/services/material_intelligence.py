"""Document-level study intelligence built from uploaded material."""
from __future__ import annotations

import json
from collections import Counter
from typing import Dict, List

import requests

from app.core.config import settings
from app.services.ai_quality import classify_confidence
from app.services.document_context import build_context_window, build_document_insights


GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


def build_material_intelligence(document: Dict, contexts: List[Dict]) -> Dict:
    """Return a richer study engine payload for one document."""
    normalized_contexts = contexts or []
    insights = build_document_insights(normalized_contexts, max_concepts=12, max_pages=5)
    fallback = _fallback_material_intelligence(document, normalized_contexts, insights)
    ai_payload = _generate_with_ai(document, normalized_contexts)
    confidence_meta = classify_confidence(
        evidence_count=len(normalized_contexts),
        average_relevance=_average_relevance(normalized_contexts),
        has_primary_sources=bool(normalized_contexts),
    )
    if ai_payload:
        merged = dict(fallback)
        merged.update({key: value for key, value in ai_payload.items() if value})
        if not merged.get("concepts"):
            merged["concepts"] = fallback["concepts"]
        if not merged.get("key_pages"):
            merged["key_pages"] = fallback["key_pages"]
        if not merged.get("concept_map"):
            merged["concept_map"] = fallback["concept_map"]
        if not merged.get("misconception_traps"):
            merged["misconception_traps"] = fallback["misconception_traps"]
        if not merged.get("viva_questions"):
            merged["viva_questions"] = fallback["viva_questions"]
        if not merged.get("study_path"):
            merged["study_path"] = fallback["study_path"]
        if not merged.get("layered_summaries"):
            merged["layered_summaries"] = fallback["layered_summaries"]
        merged["confidence"] = confidence_meta["confidence"]
        merged["confidence_reason"] = confidence_meta["confidence_reason"]
        return merged
    fallback["confidence"] = confidence_meta["confidence"]
    fallback["confidence_reason"] = confidence_meta["confidence_reason"]
    return fallback


def _average_relevance(contexts: List[Dict]) -> float:
    scores = [float(item.get("relevance_score") or 0.0) for item in contexts if item.get("relevance_score") is not None]
    if not scores:
        return 0.0
    return max(0.0, min(1.0, sum(scores) / len(scores)))


def _generate_with_ai(document: Dict, contexts: List[Dict]) -> Dict | None:
    if not settings.groq_api_key or not contexts:
        return None

    prompt_context = build_context_window(contexts[:8], max_chars=9000)
    if not prompt_context.strip():
        return None

    prompt = f"""
You are an academic study assistant. Read the uploaded study material and return JSON only.

Document title: {document.get("title")}

Return this shape:
{{
  "summary": "2-3 sentence study summary",
  "layered_summaries": {{
    "quick": "one sentence snapshot",
    "standard": "2-3 sentence teaching summary",
    "exam_focus": "exam-oriented explanation"
  }},
  "revision_bullets": ["bullet 1", "bullet 2", "bullet 3"],
  "glossary": [
    {{"term": "term", "meaning": "short meaning"}}
  ],
  "flashcards": [
    {{"prompt": "question", "answer": "answer"}}
  ],
  "follow_up_prompts": ["prompt 1", "prompt 2"],
  "prerequisite_warning": "optional one-line warning if this material assumes prior knowledge",
  "concept_map": [
    {{"label": "concept", "importance": "core", "connects_to": ["related concept"]}}
  ],
  "misconception_traps": [
    {{"concept": "concept", "trap": "common mistake", "correction": "correct framing"}}
  ],
  "viva_questions": [
    {{"question": "oral exam question", "expected_focus": "what a strong answer should cover"}}
  ],
  "study_path": [
    {{"label": "study action", "reason": "why this should come next"}}
  ]
}}

Rules:
- Stay grounded in the material only.
- Keep wording student-friendly.
- Prefer concise revision language.
- Do not mention page headers or extraction artifacts.

Material:
\"\"\"
{prompt_context}
\"\"\"
""".strip()

    try:
        response = requests.post(
            GROQ_URL,
            headers={
                "Authorization": f"Bearer {settings.groq_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "llama-3.3-70b-versatile",
                "temperature": 0.2,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": "Return only valid JSON."},
                    {"role": "user", "content": prompt},
                ],
            },
            timeout=35,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        parsed = json.loads(content)
        return {
            "summary": parsed.get("summary"),
            "layered_summaries": parsed.get("layered_summaries") or {},
            "revision_bullets": parsed.get("revision_bullets") or [],
            "glossary": parsed.get("glossary") or [],
            "flashcards": parsed.get("flashcards") or [],
            "follow_up_prompts": parsed.get("follow_up_prompts") or [],
            "prerequisite_warning": parsed.get("prerequisite_warning"),
            "concept_map": parsed.get("concept_map") or [],
            "misconception_traps": parsed.get("misconception_traps") or [],
            "viva_questions": parsed.get("viva_questions") or [],
            "study_path": parsed.get("study_path") or [],
        }
    except Exception:
        return None


def _fallback_material_intelligence(document: Dict, contexts: List[Dict], insights: Dict) -> Dict:
    combined_text = " ".join(item.get("content", "") for item in contexts[:8]).strip()
    sentences = [sentence.strip() for sentence in combined_text.split(".") if sentence.strip()]
    summary = ". ".join(sentences[:2]).strip()
    if summary and not summary.endswith("."):
        summary += "."
    layered_summaries = _build_layered_summaries(document, summary, contexts)

    concepts = insights.get("concepts") or []
    key_pages = insights.get("key_pages") or []
    revision_bullets = [page["preview"][:140] for page in key_pages[:3] if page.get("preview")]
    glossary = [
        {"term": concept["label"].title(), "meaning": f"Key concept highlighted in {document.get('title', 'this material')}."}
        for concept in concepts[:4]
    ]
    flashcards = _build_flashcards_from_contexts(contexts, concepts)
    follow_up_prompts = _build_follow_up_prompts(document, concepts)
    prerequisite_warning = _build_prerequisite_warning(concepts, combined_text)
    concept_map = _build_concept_map(concepts)
    misconception_traps = _build_misconception_traps(concepts, combined_text)
    viva_questions = _build_viva_questions(concepts, document)
    study_path = _build_study_path(document, concepts, prerequisite_warning)

    return {
        "summary": summary or f"{document.get('title', 'This material')} is ready for review and question practice.",
        "layered_summaries": layered_summaries,
        "revision_bullets": revision_bullets or ["Review the highlighted concepts, then ask Learning Chat to simplify the hardest section."],
        "glossary": glossary,
        "flashcards": flashcards,
        "follow_up_prompts": follow_up_prompts,
        "prerequisite_warning": prerequisite_warning,
        "concepts": concepts,
        "key_pages": key_pages,
        "concept_map": concept_map,
        "misconception_traps": misconception_traps,
        "viva_questions": viva_questions,
        "study_path": study_path,
    }


def _build_layered_summaries(document: Dict, summary: str, contexts: List[Dict]) -> Dict:
    base = summary or f"{document.get('title', 'This material')} is ready for review."
    context_text = " ".join(item.get("content", "") for item in contexts[:2]).strip()
    quick = base.split(".")[0].strip() or base
    if quick and not quick.endswith("."):
        quick += "."
    standard = base
    exam_focus = (
        f"Focus on explaining the main process, the important terms, and at least one applied example from {document.get('title', 'this material')}."
    )
    if context_text:
        exam_focus = (
            f"Focus on the cause-and-effect ideas in this material, then connect them to likely exam explanations and short-answer recall."
        )
    return {
        "quick": quick,
        "standard": standard,
        "exam_focus": exam_focus,
    }


def _build_concept_map(concepts: List[Dict]) -> List[Dict]:
    if not concepts:
        return []
    labels = [concept["label"].title() for concept in concepts[:5]]
    result = []
    for index, label in enumerate(labels):
        connects_to = []
        if index + 1 < len(labels):
            connects_to.append(labels[index + 1])
        if index + 2 < len(labels) and index == 0:
            connects_to.append(labels[index + 2])
        result.append(
            {
                "label": label,
                "importance": "core" if index < 2 else "supporting",
                "connects_to": connects_to,
            }
        )
    return result


def _build_misconception_traps(concepts: List[Dict], combined_text: str) -> List[Dict]:
    traps: List[Dict] = []
    for concept in concepts[:3]:
        label = concept["label"].title()
        traps.append(
            {
                "concept": label,
                "trap": f"Treating {label} like a standalone definition instead of linking it to its role in the topic.",
                "correction": f"Explain what {label} does, how it connects to the surrounding process, and why it matters in this material.",
            }
        )
    if not traps and combined_text:
        traps.append(
            {
                "concept": "Core topic",
                "trap": "Memorizing wording without understanding the process underneath it.",
                "correction": "Restate the process in your own words, then attach one example from the material.",
            }
        )
    return traps


def _build_viva_questions(concepts: List[Dict], document: Dict) -> List[Dict]:
    if not concepts:
        return [
            {
                "question": f"What is the main idea behind {document.get('title', 'this material')}?",
                "expected_focus": "State the topic clearly, define the central concept, and give one supporting explanation.",
            }
        ]
    questions = []
    for concept in concepts[:3]:
        label = concept["label"].title()
        questions.append(
            {
                "question": f"Why is {label} important in {document.get('title', 'this material')}?",
                "expected_focus": f"Define {label}, describe its role, and connect it to the wider topic.",
            }
        )
    return questions


def _build_study_path(document: Dict, concepts: List[Dict], prerequisite_warning: str | None) -> List[Dict]:
    steps: List[Dict] = []
    if prerequisite_warning:
        steps.append(
            {
                "label": "Review the prerequisite ideas first",
                "reason": prerequisite_warning,
            }
        )
    if concepts:
        steps.append(
            {
                "label": f"Lock in {concepts[0]['label'].title()} before moving on",
                "reason": "This looks like one of the anchor concepts for the rest of the material.",
            }
        )
        if len(concepts) > 1:
            steps.append(
                {
                    "label": f"Compare {concepts[0]['label'].title()} and {concepts[1]['label'].title()}",
                    "reason": "Understanding how the key ideas connect will make quiz and viva answers stronger.",
                }
            )
    steps.append(
        {
            "label": f"Finish with a self-test on {document.get('title', 'this material')}",
            "reason": "A short quiz or chat-based recall check will show whether the concepts are actually sticking.",
        }
    )
    return steps[:4]


def _build_flashcards_from_contexts(contexts: List[Dict], concepts: List[Dict]) -> List[Dict]:
    cards: List[Dict] = []
    for concept in concepts[:3]:
        cards.append(
            {
                "prompt": f"What is the role of {concept['label']} in this material?",
                "answer": f"Review the section on {concept['label']} and explain it back in one or two sentences.",
            }
        )
    for item in contexts[:2]:
        content = item.get("content", "")
        if not content:
            continue
        excerpt = content[:120].strip()
        cards.append(
            {
                "prompt": "Which idea should you remember from this section?",
                "answer": excerpt,
            }
        )
        if len(cards) >= 4:
            break
    return cards[:4]


def _build_follow_up_prompts(document: Dict, concepts: List[Dict]) -> List[str]:
    if not concepts:
        return [
            f"Summarize the hardest part of {document.get('title', 'this material')}.",
            "Turn the main concept into a simple example.",
        ]

    lead = concepts[0]["label"]
    follow = concepts[1]["label"] if len(concepts) > 1 else concepts[0]["label"]
    return [
        f"Explain {lead} in simpler terms.",
        f"Compare {lead} and {follow}.",
        f"Test me on {lead}.",
    ]


def _build_prerequisite_warning(concepts: List[Dict], combined_text: str) -> str | None:
    lower = combined_text.lower()
    if "assume" in lower or "previously" in lower or "prerequisite" in lower:
        return "This material appears to build on earlier concepts. Review prerequisite topics before deeper practice."
    if len(concepts) >= 5:
        return "This topic is concept-dense, so review the glossary terms before attempting a quiz."
    return None
