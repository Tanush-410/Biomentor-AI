"""Voice-based Socratic tutor: a 10-agent pipeline (7 in app.agents.socratic_agents,
3 db-backed ones in app.services.socratic_tutor) that runs a grounded, level-calibrated
tutoring conversation with the student, one question at a time."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.security import enforce_rate_limit
from app.database import get_db
from app.database.models import SocraticSession
from app.routers.auth import get_current_user
from app.schemas import (
    SOCRATIC_LANGUAGES,
    SocraticSessionSummary,
    SocraticStartRequest,
    SocraticTurnRequest,
    SocraticTurnResponse,
)
from app.services.socratic_tutor import SessionOrchestratorAgent, level_name

router = APIRouter(prefix="/api/socratic", tags=["socratic-tutor"])
logger = logging.getLogger(__name__)


def _validate_language(language: str) -> str:
    code = (language or "en").strip().lower()
    if code not in SOCRATIC_LANGUAGES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"language must be one of: {', '.join(sorted(SOCRATIC_LANGUAGES))}")
    return code


def _get_owned_session(db: Session, session_id: str, user_id: str) -> SocraticSession:
    session = db.query(SocraticSession).filter(SocraticSession.id == session_id, SocraticSession.user_id == user_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Socratic session not found.")
    return session


@router.post("/start", response_model=SocraticTurnResponse)
async def start_session(
    payload: SocraticStartRequest,
    request: Request,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Start a new Socratic tutoring session, grounded in the student's own material."""
    enforce_rate_limit(request, "socratic-start", limit=20, window_seconds=300)
    language = _validate_language(payload.language)

    try:
        session = SessionOrchestratorAgent.start(
            db, user_id=current_user.id, document_id=payload.document_id, topic=payload.topic, language=language
        )
    except Exception:
        logger.exception("Unexpected failure starting a Socratic session.")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Couldn't start the tutoring session. Please try again.")

    opening = session.transcript[-1]["text"]
    return SocraticTurnResponse(
        session_id=session.id,
        tutor_message=opening,
        language=session.language,
        solo_level=session.solo_level,
        solo_level_name=level_name(session.solo_level),
        misconception=None,
        hint_given=False,
        diagram=None,
        recap=None,
        turn_count=session.turn_count,
        status=session.status,
    )


@router.post("/{session_id}/respond", response_model=SocraticTurnResponse)
async def respond(
    session_id: str,
    payload: SocraticTurnRequest,
    request: Request,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send the student's next spoken/typed turn and get the tutor's grounded, level-calibrated reply."""
    enforce_rate_limit(request, "socratic-respond", limit=60, window_seconds=300)
    session = _get_owned_session(db, session_id, current_user.id)
    if session.status != "active":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This session has already ended.")

    try:
        result = SessionOrchestratorAgent.respond(db, session=session, student_message=payload.message.strip())
    except Exception:
        logger.exception("Unexpected failure during a Socratic tutor turn.")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Couldn't process that answer. Please try again.")

    return SocraticTurnResponse(**result)


@router.post("/{session_id}/end", response_model=SocraticSessionSummary)
async def end_session(
    session_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a session complete and return its full transcript."""
    session = _get_owned_session(db, session_id, current_user.id)
    session.status = "completed"
    db.add(session)
    db.commit()
    db.refresh(session)
    return SocraticSessionSummary(
        session_id=session.id,
        topic=session.topic,
        language=session.language,
        solo_level=session.solo_level,
        solo_level_name=level_name(session.solo_level),
        turn_count=session.turn_count,
        status=session.status,
        transcript=session.transcript,
    )


@router.get("/{session_id}", response_model=SocraticSessionSummary)
async def get_session(
    session_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Fetch a session's full transcript, e.g. to resume the page after a refresh."""
    session = _get_owned_session(db, session_id, current_user.id)
    return SocraticSessionSummary(
        session_id=session.id,
        topic=session.topic,
        language=session.language,
        solo_level=session.solo_level,
        solo_level_name=level_name(session.solo_level),
        turn_count=session.turn_count,
        status=session.status,
        transcript=session.transcript,
    )
