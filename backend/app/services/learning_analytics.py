"""Derived analytics and recommendation helpers."""
from typing import Dict, List

from sqlalchemy.orm import Session

from app.database.models import Document, QuizAnswer, QuizSession

BLOOM_LEVEL_NAMES = {
    1: "Remember",
    2: "Understand",
    3: "Apply",
    4: "Analyze",
    5: "Evaluate",
    6: "Create",
}


def build_progress_payload(db: Session, user_id: str) -> Dict:
    """Build progress metrics from persisted quiz sessions and answers."""
    sessions = (
        db.query(QuizSession)
        .filter(QuizSession.user_id == user_id, QuizSession.is_completed == True)  # noqa: E712
        .order_by(QuizSession.completed_at.desc(), QuizSession.started_at.desc())
        .all()
    )
    answers = (
        db.query(QuizAnswer, QuizSession)
        .join(QuizSession, QuizSession.id == QuizAnswer.session_id)
        .filter(QuizSession.user_id == user_id)
        .all()
    )

    total_quizzes = len(sessions)
    total_questions = sum(session.total_questions or 0 for session in sessions)
    average_score = (
        sum((session.score or 0.0) for session in sessions) / total_quizzes
        if total_quizzes
        else 0.0
    )

    bloom_stats = {}
    for level in range(1, 7):
        level_answers = [answer for answer, _ in answers if answer.bloom_level == level]
        count = len(level_answers)
        correct = sum(1 for answer in level_answers if answer.is_correct)
        average = (correct / count) * 100 if count else 0.0
        bloom_stats[level] = {
            "name": BLOOM_LEVEL_NAMES[level],
            "count": count,
            "average": average,
        }

    recent_quizzes = [
        {
            "title": _session_title(db, session),
            "questionCount": session.total_questions or 0,
            "score": session.score or 0.0,
            "date": (session.completed_at or session.started_at).isoformat() if (session.completed_at or session.started_at) else None,
        }
        for session in sessions[:5]
    ]

    return {
        "totalQuizzes": total_quizzes,
        "totalQuestionsAnswered": total_questions,
        "averageScore": average_score,
        "bloomLevelStats": bloom_stats,
        "recentQuizzes": recent_quizzes,
    }


def build_gap_list(progress_payload: Dict) -> List[Dict]:
    """Convert Bloom progress into gap records."""
    results = []
    for level, stats in progress_payload.get("bloomLevelStats", {}).items():
        count = stats.get("count", 0)
        if count == 0:
            continue
        average = stats.get("average", 0.0)
        results.append(
            {
                "topic": stats.get("name", BLOOM_LEVEL_NAMES.get(int(level), "Unknown")),
                "level": stats.get("name", BLOOM_LEVEL_NAMES.get(int(level), "Unknown")),
                "gap_percentage": round(max(0.0, 100 - average), 1),
                "answered_count": count,
            }
        )

    results.sort(key=lambda item: item["gap_percentage"], reverse=True)
    return results


def build_recommendations(db: Session, user_id: str, progress_payload: Dict) -> Dict:
    """Generate simple next-step recommendations from user history."""
    documents_count = db.query(Document).filter(Document.user_id == user_id).count()
    gap_list = build_gap_list(progress_payload)
    average_score = progress_payload.get("averageScore", 0.0)
    total_quizzes = progress_payload.get("totalQuizzes", 0)

    immediate = []
    short_term = []
    resources = []
    next_steps = []

    if total_quizzes == 0:
        immediate.append("Generate your first quiz from an uploaded material to start measuring Bloom's mastery.")
    if documents_count == 0:
        immediate.append("Upload one biology PDF or notes set so the tutor can ground answers and quizzes in your material.")
    if gap_list:
        top_gap = gap_list[0]
        immediate.append(
            f"Review {top_gap['level']} questions first. Your current gap there is {top_gap['gap_percentage']}%."
        )
        resources.append(
            {
                "title": f"Practice {top_gap['level']} questions",
                "type": "quiz",
                "difficulty": top_gap["level"],
                "estimated_time": 10,
            }
        )
    if average_score and average_score < 70:
        short_term.append("Reopen your uploaded PDF and review the cited sections before taking another quiz.")
    if len(gap_list) > 1:
        second_gap = gap_list[1]
        short_term.append(f"After that, strengthen {second_gap['level']} with one focused quiz session.")

    next_steps.extend(
        [
            "Ask follow-up questions in Learning Chat using the same document as the answer source.",
            "Aim for at least one completed quiz at each Bloom's level you want to master.",
        ]
    )

    return {
        "immediate": immediate,
        "short_term": short_term,
        "study_resources": resources,
        "next_steps": next_steps,
    }


def _session_title(db: Session, session: QuizSession) -> str:
    if session.document_ids:
        first_id = session.document_ids[0]
        document = db.query(Document).filter(Document.id == first_id).first()
        if document:
            return f"{document.title} Quiz"
    return f"Bloom's Level {session.bloom_level or 3} Quiz"
