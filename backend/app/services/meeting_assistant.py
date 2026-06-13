"""Helpers for building AI meeting assistant state."""
from __future__ import annotations

from datetime import datetime
import json

import requests
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.models import (
    Classroom,
    ClassroomLiveMeeting,
    ClassroomMeetingAISummary,
    ClassroomMeetingEvent,
    ClassroomMeetingTranscript,
    User,
)
from app.services.ai_evaluation import should_use_safe_fallback
from app.services.ai_quality import classify_confidence


def _groq_available() -> bool:
    key = (settings.groq_api_key or "").strip()
    return bool(key and not key.lower().startswith("your_"))


def normalize_meeting_transcript_content(content: str | None) -> str:
    """Collapse noisy transcript whitespace before storage and comparison."""
    return " ".join(str(content or "").strip().split())


def build_meeting_transcription_prompt(
    meeting_title: str | None = None,
    recent_transcript_lines: list[str] | None = None,
) -> str:
    """Provide lightweight class context so speech-to-text stays on-topic."""
    recent_lines = [
        normalize_meeting_transcript_content(line)
        for line in (recent_transcript_lines or [])
        if normalize_meeting_transcript_content(line)
    ]
    context_suffix = ""
    if recent_lines:
        context_suffix = f" Recent classroom context: {' | '.join(recent_lines[-4:])}."
    title_prefix = f"Meeting topic: {meeting_title}. " if meeting_title else ""
    return (
        f"{title_prefix}This is a live classroom meeting transcript. "
        "Focus on educational terminology, biological or academic vocabulary, and concise spoken content. "
        "The room can contain multiple speakers, so preserve the clearest academic phrasing instead of filler syllables. "
        "If a term sounds uncertain, prefer the most plausible classroom word or scientific term from context. "
        "Ignore filler words, background noise, repeated fragments, and microphone artefacts."
        f"{context_suffix}"
    )


def transcribe_meeting_audio_blob(
    audio_bytes: bytes,
    filename: str = "meeting-audio.webm",
    content_type: str | None = None,
    meeting_title: str | None = None,
    recent_transcript_lines: list[str] | None = None,
) -> str | None:
    """Transcribe a captured meeting-audio chunk using Groq speech-to-text when available."""
    if not _groq_available() or not audio_bytes:
        return None

    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/audio/transcriptions",
            headers={
                "Authorization": f"Bearer {settings.groq_api_key}",
            },
            data={
                "model": "whisper-large-v3-turbo",
                "response_format": "verbose_json",
                "language": "en",
                "prompt": build_meeting_transcription_prompt(
                    meeting_title=meeting_title,
                    recent_transcript_lines=recent_transcript_lines,
                ),
            },
            files={
                "file": (filename, audio_bytes, content_type or "audio/webm"),
            },
            timeout=40,
        )
        response.raise_for_status()
        payload = response.json()
        transcript = normalize_meeting_transcript_content(payload.get("text"))
        return transcript or None
    except Exception:
        return None


def build_teacher_assistant_snapshot(
    transcript_items: list[dict],
    meeting_events: list[dict],
    meeting_title: str | None,
) -> dict:
    """Build a minimal teacher-facing assistant snapshot from meeting context."""
    live_notes = [
        item.get("content", "").strip()
        for item in transcript_items[-5:]
        if item.get("content", "").strip()
    ]

    unresolved_doubts = [
        event.get("payload", {}).get("question", "").strip()
        for event in meeting_events
        if event.get("event_type") == "doubt_flag"
        and event.get("payload", {}).get("question", "").strip()
    ]

    concept_signals = []
    for note in live_notes[:3]:
        cleaned = note.rstrip(".")
        concept_signals.append(cleaned)
    for doubt in unresolved_doubts[:2]:
        concept_signals.append(f"Students are still unsure about: {doubt}")
    if meeting_title and not concept_signals:
        concept_signals.append(f"{meeting_title} still needs one clearer anchor explanation before students leave the session.")

    action_items = []
    if meeting_title:
        action_items.append(f"Revisit {meeting_title} in the next class.")
    if live_notes:
        action_items.append("Convert the key discussion points into a short revision task.")
    else:
        action_items.append("Capture the core teaching points before the meeting ends.")

    teacher_moves = []
    if unresolved_doubts:
        teacher_moves.append(
            {
                "label": "Clarify the most repeated doubt before closing",
                "reason": "Students are still leaving the meeting with unresolved conceptual confusion."
            }
        )
    if live_notes:
        teacher_moves.append(
            {
                "label": "Turn today’s explanation into one follow-up checkpoint",
                "reason": "The meeting already surfaced enough teaching evidence to support a short reinforcement task."
            }
        )
    if not teacher_moves:
        teacher_moves.append(
            {
                "label": "Mark one key teaching point before ending the room",
                "reason": "The assistant has too little transcript evidence to build a strong recap without one clearer anchor."
            }
        )

    student_risk_flags = []
    if unresolved_doubts:
        student_risk_flags.append("Repeated unresolved doubts suggest that part of the class may leave with a shaky understanding.")
    if not live_notes:
        student_risk_flags.append("Transcript evidence is thin, so some important explanation may not yet be captured clearly.")

    follow_up_assets = []
    if meeting_title:
        follow_up_assets.append(
            {
                "label": f"Share a {meeting_title} recap note",
                "reason": "Students will benefit from a short written anchor after the live explanation."
            }
        )
    follow_up_assets.append(
        {
            "label": "Post one short practice or retrieval prompt",
            "reason": "A fast post-meeting check will confirm whether the live explanation actually landed."
        }
    )

    follow_up_suggestions = [
        "Prepare a short follow-up quiz from today's discussion.",
        "Share one supporting material in classwork after the meeting.",
    ]

    confidence_meta = classify_confidence(
        evidence_count=len(live_notes) + len(unresolved_doubts),
        average_score=0.62 if live_notes else 0.28 if unresolved_doubts else 0.1,
        malformed_output=False,
    )

    return {
        "live_notes": {"items": live_notes},
        "concept_signals": {"items": concept_signals[:4]},
        "action_items": {"items": action_items},
        "teacher_moves": teacher_moves[:3],
        "student_risk_flags": {"items": student_risk_flags[:3]},
        "unresolved_doubts": {"items": unresolved_doubts},
        "follow_up_assets": follow_up_assets[:3],
        "follow_up_suggestions": {"items": follow_up_suggestions},
        "confidence": confidence_meta["confidence"],
        "confidence_reason": confidence_meta["confidence_reason"],
        "fallback_used": should_use_safe_fallback(
            evidence_count=len(live_notes) + len(unresolved_doubts),
            confidence=confidence_meta["confidence"],
        ),
        "origin": "meeting_transcript",
    }


def generate_ai_meeting_summary(
    transcript_items: list[dict],
    meeting_events: list[dict],
    meeting_title: str | None,
    audience: str,
) -> dict | None:
    """Use the configured LLM to produce a richer meeting summary when available."""
    if not _groq_available():
        return None

    transcript_text = "\n".join(
        f"{item.get('speaker_name') or item.get('speaker_role')}: {item.get('content', '').strip()}"
        for item in transcript_items[-10:]
        if item.get("content", "").strip()
    )
    event_text = "\n".join(
        f"{event.get('event_type')}: {json.dumps(event.get('payload', {}), ensure_ascii=True)}"
        for event in meeting_events[-10:]
    )

    if audience == "teacher":
        instruction = (
            "Return valid JSON only with keys summary, action_items, unresolved_doubts, follow_up_suggestions. "
            "Make it concise, practical, and specific for the educator."
        )
    else:
        instruction = (
            "Return valid JSON only with keys summary, action_items, key_takeaways. "
            "Keep it student-safe, concise, and easy to revise from."
        )

    payload = {
        "model": "llama-3.3-70b-versatile",
        "temperature": 0.2,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are an academic meeting assistant for a classroom platform. "
                    "Summarize only from the provided meeting transcript and event cues. "
                    "Do not invent facts that are not supported by the meeting evidence. "
                    f"{instruction}"
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Meeting title: {meeting_title or 'Class meeting'}\n\n"
                    f"Transcript snippets:\n{transcript_text or 'No transcript available.'}\n\n"
                    f"Meeting events:\n{event_text or 'No structured events.'}\n\n"
                    "Generate the JSON output now."
                ),
            },
        ],
    }

    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.groq_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=20,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"].strip()
        return json.loads(content)
    except Exception:
        return None


def serialize_transcript(transcript: ClassroomMeetingTranscript) -> dict:
    return {
        "id": transcript.id,
        "meeting_id": transcript.meeting_id,
        "classroom_id": transcript.classroom_id,
        "speaker_role": transcript.speaker_role,
        "speaker_name": transcript.speaker_name,
        "content": transcript.content,
        "created_at": transcript.created_at,
    }


def serialize_event(event: ClassroomMeetingEvent) -> dict:
    return {
        "id": event.id,
        "meeting_id": event.meeting_id,
        "classroom_id": event.classroom_id,
        "actor_id": event.actor_id,
        "event_type": event.event_type,
        "payload": event.payload or {},
        "created_at": event.created_at,
    }


def persist_meeting_transcript(
    db: Session,
    meeting: ClassroomLiveMeeting,
    current_user: User,
    speaker_role: str,
    speaker_name: str | None,
    content: str,
) -> ClassroomMeetingTranscript:
    normalized_content = normalize_meeting_transcript_content(content)
    if len(normalized_content.split()) < 2:
        raise ValueError("Transcript content is too short to persist.")

    latest_transcript = (
        db.query(ClassroomMeetingTranscript)
        .filter(
            ClassroomMeetingTranscript.meeting_id == meeting.id,
            ClassroomMeetingTranscript.speaker_role == (speaker_role or current_user.role),
        )
        .order_by(ClassroomMeetingTranscript.created_at.desc())
        .first()
    )
    if latest_transcript and normalize_meeting_transcript_content(latest_transcript.content).lower() == normalized_content.lower():
        return latest_transcript

    transcript = ClassroomMeetingTranscript(
        meeting_id=meeting.id,
        classroom_id=meeting.classroom_id,
        speaker_role=speaker_role or current_user.role,
        speaker_name=speaker_name or current_user.full_name,
        content=normalized_content,
    )
    db.add(transcript)
    db.commit()
    db.refresh(transcript)
    return transcript


def persist_meeting_event(
    db: Session,
    meeting: ClassroomLiveMeeting,
    current_user: User,
    event_type: str,
    payload: dict,
) -> ClassroomMeetingEvent:
    event = ClassroomMeetingEvent(
        meeting_id=meeting.id,
        classroom_id=meeting.classroom_id,
        actor_id=current_user.id,
        event_type=event_type,
        payload=payload or {},
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def list_recent_transcripts(db: Session, meeting_id: str, limit: int = 30) -> list[dict]:
    rows = (
        db.query(ClassroomMeetingTranscript)
        .filter(ClassroomMeetingTranscript.meeting_id == meeting_id)
        .order_by(ClassroomMeetingTranscript.created_at.asc())
        .limit(limit)
        .all()
    )
    return [serialize_transcript(row) for row in rows]


def list_recent_events(db: Session, meeting_id: str, limit: int = 30) -> list[dict]:
    rows = (
        db.query(ClassroomMeetingEvent)
        .filter(ClassroomMeetingEvent.meeting_id == meeting_id)
        .order_by(ClassroomMeetingEvent.created_at.asc())
        .limit(limit)
        .all()
    )
    return [serialize_event(row) for row in rows]


def _upsert_summary(
    db: Session,
    meeting_id: str,
    classroom_id: str,
    summary_type: str,
    content_json: dict,
) -> ClassroomMeetingAISummary:
    summary = (
        db.query(ClassroomMeetingAISummary)
        .filter(
            ClassroomMeetingAISummary.meeting_id == meeting_id,
            ClassroomMeetingAISummary.summary_type == summary_type,
        )
        .first()
    )
    if summary:
        summary.content_json = content_json
        summary.updated_at = datetime.utcnow()
    else:
        summary = ClassroomMeetingAISummary(
            meeting_id=meeting_id,
            classroom_id=classroom_id,
            summary_type=summary_type,
            content_json=content_json,
        )
        db.add(summary)
    db.commit()
    db.refresh(summary)
    return summary


def refresh_teacher_assistant_snapshot(
    db: Session,
    meeting: ClassroomLiveMeeting,
) -> ClassroomMeetingAISummary:
    snapshot = build_teacher_assistant_snapshot(
        transcript_items=list_recent_transcripts(db, meeting.id),
        meeting_events=list_recent_events(db, meeting.id),
        meeting_title=meeting.title,
    )
    snapshot["updated_at"] = datetime.utcnow().isoformat()
    return _upsert_summary(db, meeting.id, meeting.classroom_id, "live_notes", snapshot)


def get_teacher_assistant_snapshot(db: Session, meeting: ClassroomLiveMeeting) -> dict:
    summary = (
        db.query(ClassroomMeetingAISummary)
        .filter(
            ClassroomMeetingAISummary.meeting_id == meeting.id,
            ClassroomMeetingAISummary.summary_type == "live_notes",
        )
        .first()
    )
    if not summary:
        summary = refresh_teacher_assistant_snapshot(db, meeting)
    payload = dict(summary.content_json or {})
    payload.setdefault("meeting_id", meeting.id)
    payload.setdefault("live_notes", {"items": []})
    payload.setdefault("concept_signals", {"items": []})
    payload.setdefault("action_items", {"items": []})
    payload.setdefault("teacher_moves", [])
    payload.setdefault("student_risk_flags", {"items": []})
    payload.setdefault("unresolved_doubts", {"items": []})
    payload.setdefault("follow_up_assets", [])
    payload.setdefault("follow_up_suggestions", {"items": []})
    payload["updated_at"] = summary.updated_at
    return payload


def build_teacher_summary_payload(
    transcript_items: list[dict],
    meeting_events: list[dict],
    meeting_title: str | None,
    generator=generate_ai_meeting_summary,
) -> dict:
    snapshot = build_teacher_assistant_snapshot(transcript_items, meeting_events, meeting_title)
    generated = generator(transcript_items, meeting_events, meeting_title, "teacher") if generator else None
    if isinstance(generated, dict):
        return {
            "summary": generated.get("summary") or " ".join(snapshot["live_notes"]["items"][:3]).strip() or "Meeting completed. Review the class discussion points.",
            "study_recap": generated.get("study_recap") or snapshot["concept_signals"]["items"][:3],
            "action_items": generated.get("action_items") or snapshot["action_items"]["items"],
            "unresolved_doubts": generated.get("unresolved_doubts") or snapshot["unresolved_doubts"]["items"],
            "unresolved_questions": generated.get("unresolved_questions") or generated.get("unresolved_doubts") or snapshot["unresolved_doubts"]["items"],
            "next_class_moves": generated.get("next_class_moves") or [move["label"] for move in snapshot["teacher_moves"]],
            "follow_up_suggestions": generated.get("follow_up_suggestions") or snapshot["follow_up_suggestions"]["items"],
            "teacher_moves": generated.get("teacher_moves") or snapshot["teacher_moves"],
            "follow_up_assets": generated.get("follow_up_assets") or snapshot["follow_up_assets"],
            "confidence": snapshot["confidence"],
            "confidence_reason": snapshot["confidence_reason"],
            "fallback_used": snapshot["fallback_used"],
        }
    summary_text = " ".join(snapshot["live_notes"]["items"][:3]).strip() or "Meeting completed. Review the class discussion points."
    return {
        "summary": summary_text,
        "study_recap": snapshot["concept_signals"]["items"][:3],
        "action_items": snapshot["action_items"]["items"],
        "unresolved_doubts": snapshot["unresolved_doubts"]["items"],
        "unresolved_questions": snapshot["unresolved_doubts"]["items"],
        "next_class_moves": [move["label"] for move in snapshot["teacher_moves"]],
        "follow_up_suggestions": snapshot["follow_up_suggestions"]["items"],
        "teacher_moves": snapshot["teacher_moves"],
        "follow_up_assets": snapshot["follow_up_assets"],
        "confidence": snapshot["confidence"],
        "confidence_reason": snapshot["confidence_reason"],
        "fallback_used": snapshot["fallback_used"],
    }


def build_student_summary_payload(
    transcript_items: list[dict],
    meeting_events: list[dict],
    meeting_title: str | None,
    generator=generate_ai_meeting_summary,
) -> dict:
    snapshot = build_teacher_assistant_snapshot(transcript_items, meeting_events, meeting_title)
    generated = generator(transcript_items, meeting_events, meeting_title, "student") if generator else None
    if isinstance(generated, dict):
        return {
            "summary": generated.get("summary") or " ".join(snapshot["live_notes"]["items"][:2]).strip() or "Your educator has shared a recap for this meeting.",
            "study_recap": generated.get("study_recap") or snapshot["concept_signals"]["items"][:3],
            "action_items": generated.get("action_items") or snapshot["action_items"]["items"][:2],
            "key_takeaways": generated.get("key_takeaways") or snapshot["live_notes"]["items"][:3],
            "unresolved_questions": generated.get("unresolved_questions") or snapshot["unresolved_doubts"]["items"][:2],
            "next_class_moves": generated.get("next_class_moves") or [asset["label"] for asset in snapshot["follow_up_assets"][:2]],
            "confidence": snapshot["confidence"],
            "confidence_reason": snapshot["confidence_reason"],
            "fallback_used": snapshot["fallback_used"],
        }
    student_actions = snapshot["action_items"]["items"][:2]
    return {
        "summary": " ".join(snapshot["live_notes"]["items"][:2]).strip() or "Your educator has shared a recap for this meeting.",
        "study_recap": snapshot["concept_signals"]["items"][:3],
        "action_items": student_actions,
        "key_takeaways": snapshot["live_notes"]["items"][:3],
        "unresolved_questions": snapshot["unresolved_doubts"]["items"][:2],
        "next_class_moves": [asset["label"] for asset in snapshot["follow_up_assets"][:2]],
        "confidence": snapshot["confidence"],
        "confidence_reason": snapshot["confidence_reason"],
        "fallback_used": snapshot["fallback_used"],
    }


def finalize_meeting_assistant_outputs(
    db: Session,
    classroom: Classroom,
    meeting: ClassroomLiveMeeting,
) -> tuple[dict, dict]:
    transcript_items = list_recent_transcripts(db, meeting.id)
    meeting_events = list_recent_events(db, meeting.id)
    teacher_summary = build_teacher_summary_payload(transcript_items, meeting_events, meeting.title)
    student_summary = build_student_summary_payload(transcript_items, meeting_events, meeting.title)
    _upsert_summary(db, meeting.id, classroom.id, "teacher_summary", teacher_summary)
    _upsert_summary(db, meeting.id, classroom.id, "student_summary", student_summary)
    return teacher_summary, student_summary


def get_student_recap(db: Session, meeting: ClassroomLiveMeeting) -> dict | None:
    summary = (
        db.query(ClassroomMeetingAISummary)
        .filter(
            ClassroomMeetingAISummary.meeting_id == meeting.id,
            ClassroomMeetingAISummary.summary_type == "student_summary",
        )
        .first()
    )
    return dict(summary.content_json or {}) if summary else None
