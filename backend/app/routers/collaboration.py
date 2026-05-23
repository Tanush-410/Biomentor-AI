"""Real-time collaboration hub routes."""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime
import json
import secrets
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core import settings
from app.database import get_db
from app.database.models import (
    Classroom,
    ClassroomEnrollment,
    CollaborationEvent,
    LiveSession,
    LiveSessionParticipant,
    User,
)
from app.routers.auth import get_current_user, require_roles
from app.routers.qa import build_answer_response
from app.schemas import (
    AnswerGenerationRequest,
    CollaborationEventCreate,
    LiveSessionCreate,
    LiveSessionJoinRequest,
    PollCreate,
    QuickCheckCreate,
    VoteCreate,
)
from app.services.learning_analytics import build_gap_list, build_progress_payload

router = APIRouter(prefix="/api/collaboration", tags=["collaboration"])


class ConnectionManager:
    """Tracks live websocket connections per session."""

    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = defaultdict(list)

    async def connect(self, session_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[session_id].append(websocket)

    def disconnect(self, session_id: str, websocket: WebSocket):
        connections = self.active_connections.get(session_id, [])
        if websocket in connections:
            connections.remove(websocket)
        if not connections and session_id in self.active_connections:
            self.active_connections.pop(session_id, None)

    async def broadcast(self, session_id: str, payload: dict):
        for connection in list(self.active_connections.get(session_id, [])):
            await connection.send_json(payload)


manager = ConnectionManager()


@router.post("/sessions")
async def create_live_session(
    payload: LiveSessionCreate,
    current_user: User = Depends(require_roles("educator", "admin")),
    db: Session = Depends(get_db),
):
    """Create a new collaboration session."""
    if payload.classroom_id:
        classroom = db.query(Classroom).filter(Classroom.id == payload.classroom_id).first()
        if not classroom:
            raise HTTPException(status_code=404, detail="Classroom not found")
        if current_user.role != "admin" and classroom.educator_id != current_user.id:
            raise HTTPException(status_code=403, detail="You do not own this classroom.")

    session = LiveSession(
        classroom_id=payload.classroom_id,
        educator_id=current_user.id,
        title=payload.title,
        agenda=payload.agenda,
        join_code=secrets.token_hex(3).upper(),
        status="live",
        resource_document_ids=payload.resource_document_ids or [],
        started_at=datetime.utcnow(),
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    db.add(
        LiveSessionParticipant(
            session_id=session.id,
            user_id=current_user.id,
            role=current_user.role,
            engagement_score=100.0,
        )
    )
    db.commit()

    return {
        "id": session.id,
        "title": session.title,
        "join_code": session.join_code,
        "status": session.status,
        "resource_document_ids": session.resource_document_ids or [],
    }


@router.post("/sessions/{session_id}/polls")
async def create_live_poll(
    session_id: str,
    payload: PollCreate,
    current_user: User = Depends(require_roles("educator", "admin")),
    db: Session = Depends(get_db),
):
    """Create a live poll inside the collaboration hub."""
    session = _get_session_for_user(db, session_id, current_user)
    event = CollaborationEvent(
        session_id=session.id,
        user_id=current_user.id,
        event_type="poll",
        payload={
            "content": payload.question,
            "metadata": {
                "options": payload.options,
                "votes": {},
                "results": {option: 0 for option in payload.options},
            },
        },
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    serialized = _serialize_event(event, current_user)
    await manager.broadcast(session.id, {"type": "event", "event": serialized})
    return {"event": serialized}


@router.post("/sessions/{session_id}/quick-checks")
async def create_quick_check(
    session_id: str,
    payload: QuickCheckCreate,
    current_user: User = Depends(require_roles("educator", "admin")),
    db: Session = Depends(get_db),
):
    """Create a quick quiz check in the collaboration hub."""
    session = _get_session_for_user(db, session_id, current_user)
    event = CollaborationEvent(
        session_id=session.id,
        user_id=current_user.id,
        event_type="quiz_prompt",
        payload={
            "content": payload.question,
            "metadata": {
                "options": payload.options,
                "answer_key": payload.correct_option,
                "explanation": payload.explanation,
                "responses": {},
                "results": {option: 0 for option in payload.options},
            },
        },
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    serialized = _serialize_event(event, current_user)
    await manager.broadcast(session.id, {"type": "event", "event": serialized})
    return {"event": serialized}


@router.get("/sessions")
async def list_live_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List sessions relevant to the current user."""
    if current_user.role in {"educator", "admin"}:
        sessions = (
            db.query(LiveSession)
            .filter(LiveSession.educator_id == current_user.id)
            .order_by(LiveSession.created_at.desc())
            .all()
        )
    else:
        classroom_ids = [
            enrollment.classroom_id
            for enrollment in db.query(ClassroomEnrollment)
            .filter(ClassroomEnrollment.student_id == current_user.id)
            .all()
        ]
        sessions = (
            db.query(LiveSession)
            .filter(LiveSession.classroom_id.in_(classroom_ids) if classroom_ids else False)
            .order_by(LiveSession.created_at.desc())
            .all()
            if classroom_ids
            else []
        )

    return {
        "sessions": [
            {
                "id": session.id,
                "title": session.title,
                "agenda": session.agenda,
                "join_code": session.join_code,
                "status": session.status,
                "classroom_id": session.classroom_id,
                "resource_document_ids": session.resource_document_ids or [],
                "created_at": session.created_at.isoformat(),
            }
            for session in sessions
        ]
    }


@router.post("/sessions/join")
async def join_live_session(
    payload: LiveSessionJoinRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Join an existing live session by code."""
    session = db.query(LiveSession).filter(LiveSession.join_code == payload.join_code.strip().upper()).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session code not found")

    existing = db.query(LiveSessionParticipant).filter(
        LiveSessionParticipant.session_id == session.id,
        LiveSessionParticipant.user_id == current_user.id,
    ).first()
    if not existing:
        db.add(LiveSessionParticipant(session_id=session.id, user_id=current_user.id, role=current_user.role))
        db.commit()

    return {"session_id": session.id, "title": session.title, "status": session.status}


@router.get("/sessions/{session_id}")
async def get_live_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get session details, participants, and recent events."""
    session = _get_session_for_user(db, session_id, current_user)
    participants = (
        db.query(LiveSessionParticipant, User)
        .join(User, User.id == LiveSessionParticipant.user_id)
        .filter(LiveSessionParticipant.session_id == session.id)
        .all()
    )
    events = (
        db.query(CollaborationEvent, User)
        .outerjoin(User, User.id == CollaborationEvent.user_id)
        .filter(CollaborationEvent.session_id == session.id)
        .order_by(CollaborationEvent.created_at.asc())
        .limit(40)
        .all()
    )
    return {
        "id": session.id,
        "title": session.title,
        "agenda": session.agenda,
        "join_code": session.join_code,
        "status": session.status,
        "resource_document_ids": session.resource_document_ids or [],
        "participants": [
            {
                "user_id": participant.user_id,
                "name": user.full_name,
                "role": participant.role,
                "engagement_score": participant.engagement_score,
            }
            for participant, user in participants
        ],
        "events": [_serialize_event(event, user) for event, user in events],
    }


@router.get("/sessions/{session_id}/events")
async def get_session_events(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return event history for the collaboration hub."""
    session = _get_session_for_user(db, session_id, current_user)
    events = (
        db.query(CollaborationEvent, User)
        .outerjoin(User, User.id == CollaborationEvent.user_id)
        .filter(CollaborationEvent.session_id == session.id)
        .order_by(CollaborationEvent.created_at.asc())
        .all()
    )
    return {"events": [_serialize_event(event, user) for event, user in events]}


@router.post("/sessions/{session_id}/events")
async def create_session_event(
    session_id: str,
    payload: CollaborationEventCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a collaboration event and broadcast it to participants."""
    session = _get_session_for_user(db, session_id, current_user)
    event = CollaborationEvent(
        session_id=session.id,
        user_id=current_user.id,
        event_type=payload.event_type,
        payload={
            "content": payload.content,
            "metadata": payload.metadata or {},
        },
    )
    db.add(event)

    participant = db.query(LiveSessionParticipant).filter(
        LiveSessionParticipant.session_id == session.id,
        LiveSessionParticipant.user_id == current_user.id,
    ).first()
    if participant:
        participant.engagement_score = (participant.engagement_score or 0.0) + 5.0

    db.commit()
    db.refresh(event)

    serialized = _serialize_event(event, current_user)
    await manager.broadcast(session.id, {"type": "event", "event": serialized})

    # AI moderator assistance for questions.
    if payload.event_type == "question":
        ai_reply = await _create_ai_collaboration_response(db, current_user, session, payload.content)
        if ai_reply:
            await manager.broadcast(session.id, {"type": "event", "event": ai_reply})

    return {"event": serialized}


@router.post("/events/{event_id}/respond")
async def respond_to_structured_event(
    event_id: str,
    payload: VoteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Vote in a poll or answer a quick-check event."""
    event = db.query(CollaborationEvent).filter(CollaborationEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Collaboration event not found")
    session = _get_session_for_user(db, event.session_id, current_user)
    metadata = dict(event.payload.get("metadata", {}))

    if event.event_type == "poll":
        votes = dict(metadata.get("votes", {}))
        votes[current_user.id] = payload.choice
        metadata["votes"] = votes
        metadata["results"] = {option: list(votes.values()).count(option) for option in metadata.get("options", [])}
    elif event.event_type == "quiz_prompt":
        responses = dict(metadata.get("responses", {}))
        responses[current_user.id] = payload.choice
        metadata["responses"] = responses
        metadata["results"] = {option: list(responses.values()).count(option) for option in metadata.get("options", [])}
    else:
        raise HTTPException(status_code=400, detail="This event does not accept responses.")

    event.payload = {
        "content": event.payload.get("content", ""),
        "metadata": metadata,
    }
    db.commit()
    db.refresh(event)
    actor = db.query(User).filter(User.id == event.user_id).first()
    serialized = _serialize_event(event, actor)
    await manager.broadcast(session.id, {"type": "event_update", "event": serialized})
    return {"event": serialized}


@router.get("/sessions/{session_id}/summary")
async def get_session_summary(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Summarize engagement, shared gaps, and follow-up actions."""
    session = _get_session_for_user(db, session_id, current_user)
    participants = db.query(LiveSessionParticipant).filter(LiveSessionParticipant.session_id == session.id).all()
    events = db.query(CollaborationEvent).filter(CollaborationEvent.session_id == session.id).all()

    engagement = sorted(
        [
            {"user_id": participant.user_id, "engagement_score": round(participant.engagement_score or 0.0, 1)}
            for participant in participants
        ],
        key=lambda item: item["engagement_score"],
        reverse=True,
    )

    gap_counter: Counter = Counter()
    for participant in participants:
        user = db.query(User).filter(User.id == participant.user_id).first()
        if not user or user.role != "student":
            continue
        gaps = build_gap_list(build_progress_payload(db, user.id))
        if gaps:
            gap_counter.update([gaps[0]["level"]])

    question_events = [event for event in events if event.event_type == "question"]
    top_topics = Counter(
        word.lower()
        for event in question_events
        for word in str(event.payload.get("content", "")).split()
        if len(word) > 4
    ).most_common(6)

    return {
        "session_id": session.id,
        "title": session.title,
        "engagement": engagement,
        "shared_learning_gaps": [
            {"topic": topic, "students_flagged": count}
            for topic, count in gap_counter.most_common(4)
        ],
        "top_discussion_topics": [{"label": label, "mentions": count} for label, count in top_topics],
        "follow_up_tasks": [
            f"Assign targeted practice on {topic}." for topic, _ in gap_counter.most_common(3)
        ] or ["Assign one follow-up Bloom's quiz to keep the session momentum going."],
    }


@router.websocket("/ws/{session_id}")
async def collaboration_websocket(websocket: WebSocket, session_id: str, token: str = Query(...), db: Session = Depends(get_db)):
    """Websocket for live collaboration updates."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=4401)
            return
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            await websocket.close(code=4401)
            return
        _get_session_for_user(db, session_id, user)
    except JWTError:
        await websocket.close(code=4401)
        return

    await manager.connect(session_id, websocket)
    try:
        while True:
            raw_message = await websocket.receive_text()
            try:
                payload = json.loads(raw_message)
            except json.JSONDecodeError:
                payload = {"type": "message", "content": raw_message}
            await manager.broadcast(session_id, {"type": "presence", "payload": payload})
    except WebSocketDisconnect:
        manager.disconnect(session_id, websocket)


def _get_session_for_user(db: Session, session_id: str, current_user: User) -> LiveSession:
    session = db.query(LiveSession).filter(LiveSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if current_user.role in {"educator", "admin"} and session.educator_id == current_user.id:
        return session

    participant = db.query(LiveSessionParticipant).filter(
        LiveSessionParticipant.session_id == session.id,
        LiveSessionParticipant.user_id == current_user.id,
    ).first()
    if participant:
        return session

    if current_user.role == "student" and session.classroom_id:
        enrolled = db.query(ClassroomEnrollment).filter(
            ClassroomEnrollment.classroom_id == session.classroom_id,
            ClassroomEnrollment.student_id == current_user.id,
        ).first()
        if enrolled:
            return session

    raise HTTPException(status_code=403, detail="You are not allowed to access this collaboration session.")


def _serialize_event(event: CollaborationEvent, user: Optional[User]) -> dict:
    return {
        "id": event.id,
        "event_type": event.event_type,
        "content": event.payload.get("content", ""),
        "metadata": event.payload.get("metadata", {}),
        "user_id": event.user_id,
        "user_name": user.full_name if user else "AI Collaboration Hub",
        "created_at": event.created_at.isoformat(),
    }


async def _create_ai_collaboration_response(db: Session, current_user: User, session: LiveSession, question: str) -> Optional[dict]:
    request = AnswerGenerationRequest(
        question=question,
        document_ids=session.resource_document_ids or None,
        include_sources=True,
    )
    try:
        answer = build_answer_response(db, current_user, request)
    except Exception:
        return None

    return {
        "id": f"ai-{datetime.utcnow().timestamp()}",
        "event_type": "ai_response",
        "content": answer.answer,
        "metadata": {
            "sources": [
                {
                    "document_id": source.document_id,
                    "document_title": source.document_title,
                    "page_number": source.page_number,
                }
                for source in answer.sources
            ]
        },
        "user_id": None,
        "user_name": "AI Collaboration Hub",
        "created_at": datetime.utcnow().isoformat(),
    }
