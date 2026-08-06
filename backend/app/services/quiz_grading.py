"""Shared grading logic for MCQ quiz sessions.

Both the personal quiz flow (POST /api/quiz/submit-answer) and the
classroom quiz flow (POST /api/classrooms/{id}/quizzes/{id}/submit) grade a
QuizSession's answers against GeneratedQuestion rows the same way. This
module holds that shared logic so the two entry points can't drift apart
the way they previously had (e.g. one deriving total_questions server-side
while trusting the client in a subtly different way, or one attributing the
wrong SOLO level to an answer).
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional, Sequence

from sqlalchemy.orm import Session

from app.database.models import GeneratedQuestion, QuizAnswer, QuizSession


def grade_mcq_session(
    db: Session,
    session: QuizSession,
    user_id: str,
    answers: Sequence[Any],
    client_total_questions: Optional[int],
    default_solo_level: int = 3,
) -> tuple[int, int]:
    """Grade a QuizSession's MCQ answers and update it in place.

    `answers` items just need `.question_id` and `.selected_option_id`
    attributes (both QuizSubmissionAnswer and ClassroomQuizSubmissionAnswer
    satisfy this).

    total_questions is derived from what was actually generated for this
    session, never trusted from the client, so a stale/incorrect client
    value can't skew the percentage. Each QuizAnswer records the SOLO level
    of the specific question it answers (falling back to the session's
    level only when that question can't be found), so mixed-level quiz
    stats attribute correctly instead of collapsing every answer onto one
    level.

    Mutates `session` (correct_answers, total_questions, score,
    is_completed, completed_at) and adds QuizAnswer rows, but does not
    commit -- the caller commits alongside whatever else it needs to save
    in the same transaction (e.g. a ClassroomQuizAttempt).

    Returns (correct_count, total_questions).
    """
    actual_total_questions = db.query(GeneratedQuestion).filter(
        GeneratedQuestion.session_id == session.id,
        GeneratedQuestion.user_id == user_id,
    ).count()
    total_questions = actual_total_questions or session.total_questions or client_total_questions or 0

    db.query(QuizAnswer).filter(QuizAnswer.session_id == session.id).delete()

    correct_count = 0
    for submitted in answers:
        generated_question = db.query(GeneratedQuestion).filter(
            GeneratedQuestion.id == submitted.question_id,
            GeneratedQuestion.session_id == session.id,
            GeneratedQuestion.user_id == user_id,
        ).first()
        is_correct = bool(
            generated_question and generated_question.correct_answer == submitted.selected_option_id
        )

        db.add(
            QuizAnswer(
                session_id=session.id,
                question_id=submitted.question_id,
                selected_option_id=submitted.selected_option_id,
                is_correct=is_correct,
                bloom_level=(
                    (generated_question.bloom_level if generated_question else None)
                    or session.bloom_level
                    or default_solo_level
                ),
            )
        )
        if is_correct:
            correct_count += 1

    session.correct_answers = correct_count
    session.total_questions = total_questions
    session.score = round((correct_count / total_questions) * 100, 2) if total_questions else 0
    session.is_completed = True
    session.completed_at = datetime.utcnow()

    return correct_count, total_questions
