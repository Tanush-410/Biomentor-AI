"""Student-facing study coach helpers."""
from __future__ import annotations

from typing import Dict, List

from app.services.ai_quality import classify_confidence
from app.services.learning_analytics import build_gap_list


def build_study_coach_overview(progress_payload: Dict, recommendations: Dict, documents: List[Dict]) -> Dict:
    """Build the dashboard study-coach payload from student signals."""
    gap_list = build_gap_list(progress_payload)
    top_gap = gap_list[0]["level"] if gap_list else "your next quiz set"
    next_action = f"Focus on {top_gap} next."
    rationale = (
        f"{top_gap} is your weakest recent Bloom level, so improving it should raise your score fastest."
        if gap_list
        else "Start with one guided quiz so the coach can identify your weakest Bloom level."
    )

    short_plan = [
        {
            "label": "Review material",
            "reason": "Refresh the concept before you practice again.",
            "target_url": f"/document/{documents[0]['id']}" if documents else "/documents",
        },
        {
            "label": "Ask Learning Chat",
            "reason": "Clarify the weak concept using your own uploaded material.",
            "target_url": "/learning-chat",
        },
        {
            "label": "Take a quiz",
            "reason": "Check whether the gap improved after your review.",
            "target_url": "/start-quiz",
        },
    ]

    if recommendations.get("immediate"):
        short_plan.insert(
            0,
            {
                "label": "Do this now",
                "reason": recommendations["immediate"][0],
                "target_url": "/progress",
            },
        )

    average_score = float(progress_payload.get("averageScore") or 0)
    total_quizzes = int(progress_payload.get("totalQuizzes") or 0)
    confidence_meta = classify_confidence(
        evidence_count=len(gap_list) + len(documents),
        average_relevance=min(1.0, average_score / 100) if total_quizzes else 0.0,
        has_primary_sources=bool(documents),
    )
    return {
        "next_action": next_action,
        "rationale": rationale,
        "short_plan": short_plan[:4],
        "weak_focus_areas": [gap["level"] for gap in gap_list[:3]],
        "confidence": confidence_meta["confidence"],
        "confidence_reason": confidence_meta["confidence_reason"],
    }


def build_study_coach_progress_payload(progress_payload: Dict) -> Dict:
    """Explain the student's progress in plain language."""
    gap_list = build_gap_list(progress_payload)
    practice_order = [gap["level"] for gap in gap_list[:3]]

    if not practice_order:
        confidence_meta = classify_confidence(
            evidence_count=0,
            average_relevance=0.0,
            has_primary_sources=False,
        )
        return {
            "summary": "Complete your first quiz to unlock skill-by-skill coaching across Bloom's levels.",
            "practice_order": [],
            "recommendations": ["Generate a quiz from your uploaded material to create a progress baseline."],
            "confidence": confidence_meta["confidence"],
            "confidence_reason": confidence_meta["confidence_reason"],
        }

    weakest = practice_order[0]
    average_score = float(progress_payload.get("averageScore") or 0)
    confidence_meta = classify_confidence(
        evidence_count=len(practice_order),
        average_relevance=min(1.0, average_score / 100) if average_score else 0.45,
        has_primary_sources=True,
    )
    return {
        "summary": f"Your coach wants you to strengthen {weakest} before moving into harder higher-order questions.",
        "practice_order": practice_order,
        "recommendations": [f"Practice {level} questions next." for level in practice_order],
        "confidence": confidence_meta["confidence"],
        "confidence_reason": confidence_meta["confidence_reason"],
    }


def build_study_coach_materials_payload(documents: List[Dict], gap_list: List[Dict]) -> Dict:
    """Recommend which uploaded material to open next."""
    if not documents:
        confidence_meta = classify_confidence(
            evidence_count=0,
            average_relevance=0.0,
            has_primary_sources=False,
        )
        return {
            "recommendations": [],
            "confidence": confidence_meta["confidence"],
            "confidence_reason": confidence_meta["confidence_reason"],
        }

    top_gap = gap_list[0]["level"] if gap_list else "Study Review"
    first = documents[0]
    confidence_meta = classify_confidence(
        evidence_count=len(documents) + len(gap_list),
        average_relevance=0.72 if gap_list else 0.56,
        has_primary_sources=True,
    )
    return {
        "recommendations": [
            {
                "document_id": str(first["id"]),
                "title": first["title"],
                "suggested_action": "Review then ask a focused chat question",
                "reason": f"This is the fastest material to revisit before another {top_gap} round.",
            }
        ],
        "confidence": confidence_meta["confidence"],
        "confidence_reason": confidence_meta["confidence_reason"],
    }


def build_study_coach_chat_payload(gap_list: List[Dict], documents: List[Dict]) -> Dict:
    """Suggest how the student should continue after Learning Chat answers."""
    topic = gap_list[0]["level"] if gap_list else "your next concept"
    title = documents[0]["title"] if documents else "your uploaded material"
    confidence_meta = classify_confidence(
        evidence_count=len(gap_list) + len(documents),
        average_relevance=0.68 if gap_list else 0.42,
        has_primary_sources=bool(documents),
    )
    return {
        "follow_up_prompts": [
            f"Explain {topic} in simpler terms.",
            f"Compare the hardest part of {topic} with an easier example.",
        ],
        "quick_check_guidance": f"Use Quick Check after reviewing {title}.",
        "next_step": f"Ask one focused follow-up about {topic}, then test yourself.",
        "confidence": confidence_meta["confidence"],
        "confidence_reason": confidence_meta["confidence_reason"],
    }
