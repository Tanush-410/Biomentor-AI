"""Socratic tutor orchestration: the database-backed half of the 10-agent
pipeline (see app.agents.socratic_agents for the other seven).

Agent 8 (RetrievalAgent) and Agent 9 (GapLinkingAgent) each need a database
session for lookups, and Agent 10 (SessionOrchestratorAgent) sequences all
ten agents per turn and persists the session -- so all three live here
rather than in app/agents, matching the existing agents/ (pure logic) vs
services/ (db-backed) split used by SoloClassifier vs document_context.py.
"""
from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.agents.socratic_agents import (
    ClarifyingQuestionAgent,
    DiagramAgent,
    EncouragementAgent,
    HintAgent,
    MisconceptionAgent,
    QuestionAgent,
    RecapAgent,
    SoloResponseAgent,
)
from app.agents.solo_classifier import SOLO_TAXONOMY
from app.database.models import Document, SocraticSession
from app.services.document_context import fallback_preview_context, get_document_context
from app.services.learning_analytics import build_topic_gap_list

logger = logging.getLogger(__name__)

RECAP_EVERY_N_TURNS = 4
STRUGGLE_HINT_THRESHOLD = 1

# Matches a short "I don't know" style non-answer (in English -- speech
# recognition transcribes even non-English speech through this same text
# path, but a student typing/saying this is overwhelmingly likely to type
# it in English regardless of the session language). Deliberately narrow
# and anchored to the whole message so it never matches a real, longer
# answer that merely contains one of these words.
_NO_ATTEMPT_RE = re.compile(
    r"^\s*(i\s*)?(don'?t|dont|do\s*not)\s*know\s*[.!?]*\s*$"
    r"|^\s*(idk|dunno|no\s*idea|not\s*sure|no\s*clue)\s*[.!?]*\s*$",
    re.IGNORECASE,
)


def _is_no_attempt(student_message: str) -> bool:
    return bool(_NO_ATTEMPT_RE.match(student_message.strip()))


class RetrievalAgent:
    """Agent 8: pulls grounding context from the student's own uploaded
    material for the session's topic/document."""

    @staticmethod
    def gather(db: Session, *, user_id: str, document_id: Optional[str], query: str) -> str:
        document_ids = [document_id] if document_id else None
        # top_k=8 (up from 5) so the tutor has enough grounding to field a
        # genuine student question (ClarifyingQuestionAgent) or a deeper
        # hint, not just enough for a single-fact next question.
        contexts = get_document_context(db, user_id=user_id, document_ids=document_ids, query=query, top_k=8)
        if not contexts:
            contexts = fallback_preview_context(db, user_id, document_ids=document_ids, top_k=4)
        return "\n\n".join(item["content"] for item in contexts[:8]) if contexts else ""


class GapLinkingAgent:
    """Agent 9: when the student doesn't pick a topic, steer the session
    toward their weakest known area from existing gap analysis instead of
    starting cold."""

    @staticmethod
    def pick_focus(db: Session, *, user_id: str) -> Dict:
        gaps = build_topic_gap_list(db, user_id, limit=1)
        if gaps:
            return {"topic": gaps[0]["topic"], "document_id": gaps[0].get("document_id")}
        return {"topic": "General", "document_id": None}


def _turn(role: str, text: str) -> Dict:
    return {"role": role, "text": text, "at": datetime.utcnow().isoformat()}


def level_name(level: int) -> str:
    return SOLO_TAXONOMY.get(level, SOLO_TAXONOMY[2])["name"]


class SessionOrchestratorAgent:
    """Agent 10: sequences the other nine agents for each turn and
    persists session state. This is the only agent that touches the
    database for writes."""

    @staticmethod
    def start(db: Session, *, user_id: str, document_id: Optional[str], topic: Optional[str], language: str) -> SocraticSession:
        resolved_topic = topic
        resolved_document_id = document_id

        if not resolved_topic:
            if resolved_document_id:
                document = db.query(Document).filter(Document.id == resolved_document_id, Document.user_id == user_id).first()
                resolved_topic = document.title if document else "General"
            else:
                focus = GapLinkingAgent.pick_focus(db, user_id=user_id)
                resolved_topic = focus["topic"]
                resolved_document_id = focus["document_id"]

        context_text = RetrievalAgent.gather(db, user_id=user_id, document_id=resolved_document_id, query=resolved_topic)
        opening_question = QuestionAgent.ask(
            context_text=context_text, topic=resolved_topic, language=language, solo_level=2, history=[]
        )

        session = SocraticSession(
            user_id=user_id,
            document_id=resolved_document_id,
            topic=resolved_topic,
            language=language,
            solo_level=2,
            turn_count=1,
            transcript=[_turn("tutor", opening_question)],
            status="active",
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return session

    @staticmethod
    def respond(db: Session, *, session: SocraticSession, student_message: str) -> Dict:
        transcript: List[Dict] = list(session.transcript or [])
        transcript.append(_turn("student", student_message))

        context_text = RetrievalAgent.gather(
            db, user_id=session.user_id, document_id=session.document_id, query=f"{session.topic} {student_message}"
        )
        last_question = next((t["text"] for t in reversed(transcript) if t["role"] == "tutor"), session.topic)

        # If the student is asking the tutor a genuine question rather than
        # attempting to answer ("wait, what does that term mean?"), answer
        # it directly and re-ask the same pending question, instead of
        # running it through misconception-detection/grading as if it were
        # an answer attempt -- streaks and level are left untouched since
        # nothing was actually attempted this turn.
        clarifying_answer = ClarifyingQuestionAgent.maybe_answer(
            context_text=context_text, tutor_question=last_question, student_message=student_message, language=session.language
        )
        if clarifying_answer:
            tutor_message = f"{clarifying_answer}\n\n{last_question}"
            transcript.append(_turn("tutor", tutor_message))
            session.transcript = transcript
            session.turn_count += 1
            db.add(session)
            db.commit()
            db.refresh(session)
            return {
                "session_id": session.id,
                "tutor_message": tutor_message,
                "language": session.language,
                "solo_level": session.solo_level,
                "solo_level_name": level_name(session.solo_level),
                "misconception": None,
                "hint_given": False,
                "diagram": None,
                "recap": None,
                "turn_count": session.turn_count,
                "status": session.status,
            }

        solo_result = SoloResponseAgent.classify(student_message)
        no_attempt = _is_no_attempt(student_message)
        # A "don't know" style answer has no factual content to check, so
        # skip the misconception LLM call entirely -- there's nothing to
        # detect a misconception about.
        misconception = None if no_attempt else MisconceptionAgent.detect(
            context_text=context_text, tutor_question=last_question, student_answer=student_message, language=session.language
        )

        # Correctness comes from the misconception check (or an explicit
        # "I don't know"), not from the SOLO level of the answer's phrasing
        # -- a correct one-fact answer to a Unistructural question is
        # *supposed* to score low on structural complexity, so using that
        # as a struggle signal would keep struggle_streak climbing forever
        # on perfectly good short answers and the session would never
        # progress past hints. Without the no_attempt check, "I don't know"
        # had no misconception to flag either, so it was wrongly treated as
        # a fine attempt and praised with "Good effort."
        is_struggling = bool(misconception) or no_attempt
        correct_streak = session.correct_streak + 1 if not is_struggling else 0
        struggle_streak = session.struggle_streak + 1 if is_struggling else 0

        hint_given = False
        if is_struggling and struggle_streak > STRUGGLE_HINT_THRESHOLD:
            tutor_message = HintAgent.hint(
                context_text=context_text,
                tutor_question=last_question,
                student_answer=student_message,
                hint_level=struggle_streak - STRUGGLE_HINT_THRESHOLD - 1,
                language=session.language,
            )
            hint_given = True
        else:
            # A correct answer that's structurally more sophisticated than
            # the current level (e.g. the student unprompted explains a
            # relationship, not just states one fact) moves the level up
            # immediately; otherwise it takes a streak of two correct
            # answers in a row to advance.
            next_level = max(session.solo_level, min(5, solo_result["level"]))
            if correct_streak >= 2:
                next_level = min(5, next_level + 1)
            tutor_message = QuestionAgent.ask(
                context_text=context_text,
                topic=session.topic,
                language=session.language,
                solo_level=next_level,
                history=transcript,
            )
            session.solo_level = next_level

        encouragement = EncouragementAgent.phrase(
            correct_streak=correct_streak, struggle_streak=struggle_streak, language=session.language
        )
        if not hint_given:
            tutor_message = f"{encouragement} {tutor_message}"

        diagram = DiagramAgent.maybe_diagram(topic=session.topic, tutor_message=tutor_message, context_text=context_text)

        recap = None
        if session.turn_count > 0 and session.turn_count % RECAP_EVERY_N_TURNS == 0:
            recap = RecapAgent.summarize(transcript=transcript, topic=session.topic, language=session.language)
            if recap:
                tutor_message = f"{tutor_message}\n\n{recap}"

        transcript.append(_turn("tutor", tutor_message))

        session.transcript = transcript
        session.turn_count += 1
        session.correct_streak = correct_streak
        session.struggle_streak = struggle_streak
        db.add(session)
        db.commit()
        db.refresh(session)

        return {
            "session_id": session.id,
            "tutor_message": tutor_message,
            "language": session.language,
            "solo_level": session.solo_level,
            "solo_level_name": level_name(session.solo_level),
            "misconception": misconception,
            "hint_given": hint_given,
            "diagram": diagram,
            "recap": recap,
            "turn_count": session.turn_count,
            "status": session.status,
        }
