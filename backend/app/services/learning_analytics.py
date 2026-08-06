"""Derived analytics and recommendation helpers."""
from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.database.models import Document, GapRecord, GeneratedQuestion, QuizAnswer, QuizSession

SOLO_LEVEL_NAMES = {
    1: "Prestructural",
    2: "Unistructural",
    3: "Multistructural",
    4: "Relational",
    5: "Extended Abstract",
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

    solo_stats = {}
    for level in range(1, 6):
        # Answers persisted before the SOLO migration may still carry a
        # pre-migration Bloom level (1-6); clamp to the SOLO range (1-5) the
        # same way the DB backfill does, so old data doesn't get dropped here.
        level_answers = [answer for answer, _ in answers if min(answer.bloom_level or 1, 5) == level]
        count = len(level_answers)
        correct = sum(1 for answer in level_answers if answer.is_correct)
        average = (correct / count) * 100 if count else 0.0
        solo_stats[level] = {
            "name": SOLO_LEVEL_NAMES[level],
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
        "soloLevelStats": solo_stats,
        "recentQuizzes": recent_quizzes,
    }


def build_gap_list(progress_payload: Dict) -> List[Dict]:
    """Convert SOLO progress into gap records."""
    results = []
    for level, stats in progress_payload.get("soloLevelStats", {}).items():
        count = stats.get("count", 0)
        if count == 0:
            continue
        average = stats.get("average", 0.0)
        results.append(
            {
                "topic": stats.get("name", SOLO_LEVEL_NAMES.get(int(level), "Unknown")),
                "level": stats.get("name", SOLO_LEVEL_NAMES.get(int(level), "Unknown")),
                "gap_percentage": round(max(0.0, 100 - average), 1),
                "answered_count": count,
            }
        )

    results.sort(key=lambda item: item["gap_percentage"], reverse=True)
    return results


def record_gap_snapshot(
    db: Session,
    user_id: str,
    topic: str,
    mastery_score: float,
    *,
    document_id: Optional[str] = None,
    source: str = "quiz",
    sample_size: int = 1,
) -> GapRecord:
    """Persist one point-in-time mastery reading for a topic.

    Callers add this to the same DB session they're already using (e.g. the
    quiz-submission flow) and let the caller's existing `db.commit()` save
    it -- this function does not commit on its own, so it never introduces
    a partial-write in a larger transaction.
    """
    topic = (topic or "General").strip() or "General"
    mastery_score = max(0.0, min(100.0, mastery_score))
    record = GapRecord(
        user_id=user_id,
        topic=topic,
        document_id=document_id,
        source=source,
        mastery_score=mastery_score,
        gap_percentage=round(100.0 - mastery_score, 1),
        sample_size=max(1, sample_size),
        recorded_at=datetime.utcnow(),
    )
    db.add(record)
    return record


def build_topic_gap_list(db: Session, user_id: str, limit: int = 8) -> List[Dict]:
    """Current weak topics, derived from quiz answers joined to their source document.

    This is the "Gap Detection Engine" half of gap analysis: it looks at
    real answers (not just SOLO level) and maps each one to the document it
    came from, which stands in for a curriculum-standard/topic tag until the
    app has a dedicated topic-tagging system.
    """
    rows = (
        db.query(QuizAnswer, GeneratedQuestion, Document)
        .join(QuizSession, QuizSession.id == QuizAnswer.session_id)
        .join(
            GeneratedQuestion,
            (GeneratedQuestion.id == QuizAnswer.question_id) & (GeneratedQuestion.session_id == QuizAnswer.session_id),
        )
        .outerjoin(Document, Document.id == GeneratedQuestion.document_id)
        .filter(QuizSession.user_id == user_id)
        .all()
    )

    by_topic: Dict[str, Dict] = {}
    for answer, question, document in rows:
        topic = document.title if document else "General"
        document_id = document.id if document else None
        bucket = by_topic.setdefault(
            topic,
            {"topic": topic, "document_id": document_id, "answered_count": 0, "correct_count": 0},
        )
        bucket["answered_count"] += 1
        bucket["correct_count"] += int(bool(answer.is_correct))

    results = []
    for bucket in by_topic.values():
        count = bucket["answered_count"]
        mastery = (bucket["correct_count"] / count) * 100 if count else 0.0
        results.append(
            {
                "topic": bucket["topic"],
                "document_id": bucket["document_id"],
                "mastery_percentage": round(mastery, 1),
                "gap_percentage": round(max(0.0, 100 - mastery), 1),
                "answered_count": count,
            }
        )

    results.sort(key=lambda item: item["gap_percentage"], reverse=True)
    return results[:limit]


def build_gap_trend(db: Session, user_id: str, topic: Optional[str] = None, limit: int = 50) -> List[Dict]:
    """Persisted gap history over time -- the "Gap Analytics" half of gap analysis.

    Returns oldest-first so a line chart can plot improvement (or decline)
    directly. When `topic` is omitted, returns recent history across all
    topics (still useful for an overall trend line).
    """
    query = db.query(GapRecord).filter(GapRecord.user_id == user_id)
    if topic:
        query = query.filter(GapRecord.topic == topic)
    records = query.order_by(GapRecord.recorded_at.desc()).limit(limit).all()
    records.reverse()

    return [
        {
            "topic": record.topic,
            "document_id": record.document_id,
            "source": record.source,
            "mastery_score": record.mastery_score,
            "gap_percentage": record.gap_percentage,
            "sample_size": record.sample_size,
            "recorded_at": record.recorded_at.isoformat() if record.recorded_at else None,
        }
        for record in records
    ]


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
        immediate.append("Generate your first quiz from an uploaded material to start measuring SOLO mastery.")
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
            "Aim for at least one completed quiz at each SOLO level you want to master.",
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
    return f"SOLO Level {min(session.bloom_level or 3, 5)} Quiz"
