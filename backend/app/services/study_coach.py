"""Student-facing study coach helpers."""
from __future__ import annotations

from typing import Dict, List

from app.services.ai_quality import classify_confidence
from app.services.learning_analytics import build_gap_list


def _choose_study_mode(gap_list: List[Dict], average_score: float, has_documents: bool) -> tuple[str, str]:
    if not gap_list:
        return (
            "revision",
            "The coach is still building your baseline, so it starts with a light revision loop instead of overfitting weak evidence.",
        )
    if average_score >= 76 and has_documents:
        return (
            "challenge",
            "Your recent scores are strong enough to push beyond simple review and into harder transfer practice.",
        )
    if average_score <= 60:
        return (
            "reinforcement",
            "Your weakest Bloom levels need targeted rebuilding before it makes sense to accelerate difficulty.",
        )
    return (
        "revision",
        "You have enough evidence for a guided review phase, but not enough mastery yet for full challenge mode.",
    )


def build_study_coach_overview(progress_payload: Dict, recommendations: Dict, documents: List[Dict]) -> Dict:
    """Build the dashboard study-coach payload from student signals."""
    gap_list = build_gap_list(progress_payload)
    top_gap = gap_list[0]["level"] if gap_list else "your next quiz set"
    average_score = float(progress_payload.get("averageScore") or 0)
    total_quizzes = int(progress_payload.get("totalQuizzes") or 0)
    study_mode, mode_reason = _choose_study_mode(gap_list, average_score, bool(documents))

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

    daily_goal = {
        "label": f"Move one step forward on {top_gap}.",
        "reason": "One narrow target is more likely to improve retention than a broad unfocused review block.",
    }
    weekly_plan = [
        {
            "label": "Open the anchor material first",
            "reason": "Start from your own uploaded source before you switch into practice.",
            "target_url": f"/document/{documents[0]['id']}" if documents else "/documents",
        },
        {
            "label": "Use Learning Chat on the hardest subtopic",
            "reason": "A focused explanation reduces the chance of repeating the same mistake in the next quiz.",
            "target_url": "/learning-chat",
        },
        {
            "label": "Finish with a quiz checkpoint",
            "reason": "Use one timed attempt to see whether the weak Bloom level is improving.",
            "target_url": "/start-quiz",
        },
    ]
    recovery_path = [
        {
            "label": f"Rebuild {top_gap} using easier examples",
            "reason": "Simpler framing makes it easier to repair the concept before you tackle harder questions again.",
            "target_url": "/learning-chat",
        },
        {
            "label": "Return to the source material and mark key terms",
            "reason": "This makes the next study loop feel anchored instead of abstract.",
            "target_url": f"/document/{documents[0]['id']}" if documents else "/documents",
        },
    ]

    confidence_meta = classify_confidence(
        evidence_count=len(gap_list) + len(documents),
        average_relevance=min(1.0, average_score / 100) if total_quizzes else 0.0,
        has_primary_sources=bool(documents),
    )
    return {
        "study_mode": study_mode,
        "mode_reason": mode_reason,
        "next_action": next_action,
        "rationale": rationale,
        "daily_goal": daily_goal,
        "weekly_plan": weekly_plan[:3],
        "recovery_path": recovery_path[:2],
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
            "study_mode": "revision",
            "mode_reason": "The coach needs one completed quiz before it can switch into reinforcement or challenge mode.",
            "summary": "Complete your first quiz to unlock skill-by-skill coaching across Bloom's levels.",
            "checkpoint_goal": {
                "label": "Create your first baseline",
                "reason": "One completed quiz gives the coach enough evidence to build a useful progress path.",
            },
            "practice_order": [],
            "recommendations": ["Generate a quiz from your uploaded material to create a progress baseline."],
            "confidence": confidence_meta["confidence"],
            "confidence_reason": confidence_meta["confidence_reason"],
        }

    weakest = practice_order[0]
    average_score = float(progress_payload.get("averageScore") or 0)
    study_mode, mode_reason = _choose_study_mode(gap_list, average_score, True)
    confidence_meta = classify_confidence(
        evidence_count=len(practice_order),
        average_relevance=min(1.0, average_score / 100) if average_score else 0.45,
        has_primary_sources=True,
    )
    return {
        "study_mode": study_mode,
        "mode_reason": mode_reason,
        "summary": f"Your coach wants you to strengthen {weakest} before moving into harder higher-order questions.",
        "checkpoint_goal": {
            "label": f"Raise {weakest} before the next harder round",
            "reason": "Use this checkpoint to decide whether you should stay in review mode or move into challenge practice.",
        },
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
            "sequence_reason": "Upload at least one source document so the coach can build a review order around real study material.",
            "recommendations": [],
            "confidence": confidence_meta["confidence"],
            "confidence_reason": confidence_meta["confidence_reason"],
        }

    top_gap = gap_list[0]["level"] if gap_list else "Study Review"
    first = documents[0]
    remaining = documents[1:3]
    confidence_meta = classify_confidence(
        evidence_count=len(documents) + len(gap_list),
        average_relevance=0.72 if gap_list else 0.56,
        has_primary_sources=True,
    )
    return {
        "sequence_reason": f"The coach is ordering these materials to help you recover {top_gap} before your next quiz attempt.",
        "recommendations": [
            {
                "document_id": str(first["id"]),
                "title": first["title"],
                "suggested_action": "Review then ask a focused chat question",
                "reason": f"This is the fastest material to revisit before another {top_gap} round.",
            },
            *[
                {
                    "document_id": str(item["id"]),
                    "title": item["title"],
                    "suggested_action": "Use as the second pass after the anchor review",
                    "reason": f"Use this after the main review if you want a broader recovery loop around {top_gap}.",
                }
                for item in remaining
            ],
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
            f"Turn {topic} into a likely exam question and answer it.",
        ],
        "quick_check_guidance": f"Use Quick Check after reviewing {title}.",
        "next_step": f"Ask one focused follow-up about {topic}, then test yourself.",
        "checkpoint_goal": {
            "label": f"Prove you understand {topic}",
            "reason": "One sharp follow-up plus a Quick Check is enough to tell whether the explanation actually stuck.",
        },
        "confidence": confidence_meta["confidence"],
        "confidence_reason": confidence_meta["confidence_reason"],
    }
