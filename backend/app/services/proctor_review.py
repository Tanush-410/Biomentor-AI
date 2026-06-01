"""AI-flavored review helpers for classroom quiz proctoring incidents."""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime
from typing import Any

from app.services.ai_quality import classify_confidence


SEVERITY_RANK = {"low": 1, "medium": 2, "high": 3, "critical": 4}

VIOLATION_LABELS = {
    "ai_multiple_faces": "Multiple faces detected",
    "ai_face_missing": "Face not visible",
    "ai_looking_down": "Possible phone or off-screen glance",
    "tab_hidden": "Tab hidden",
    "window_blur": "Window lost focus",
    "fullscreen_exit": "Fullscreen exited",
    "camera_lost": "Camera feed lost",
    "blocked_shortcut": "Blocked shortcut attempt",
    "context_menu": "Context menu opened",
}


def describe_violation(violation_type: str) -> str:
    """Return a UI-friendly incident label."""
    return VIOLATION_LABELS.get(violation_type, violation_type.replace("_", " ").title())


def infer_incident_severity(violation_type: str, action_taken: str, warning_count: int = 1) -> str:
    """Map a violation into a severity band for educator review."""
    if action_taken == "terminated" or violation_type in {"fullscreen_exit", "tab_hidden", "camera_lost"}:
        return "critical"
    if violation_type in {"ai_multiple_faces", "blocked_shortcut", "window_blur"}:
        return "high"
    if warning_count >= 2 or violation_type in {"ai_looking_down", "context_menu"}:
        return "medium"
    return "low"


def build_proctor_review_payload(
    *,
    quiz: dict[str, Any],
    incidents: list[dict[str, Any]],
    attempts: list[dict[str, Any]],
    student_name: str | None = None,
) -> dict[str, Any]:
    """Summarize proctoring incidents for an educator-facing review panel."""
    incident_counts = Counter(item["violation_type"] for item in incidents)
    action_counts = Counter(item.get("action_taken") or "recorded" for item in incidents)
    severity_totals = Counter(item["severity"] for item in incidents)
    top_incident_type = incident_counts.most_common(1)[0][0] if incident_counts else None
    terminated_attempts = [attempt for attempt in attempts if attempt.get("status") == "terminated"]
    submitted_attempts = [attempt for attempt in attempts if attempt.get("status") == "submitted"]
    warning_only_attempts = [
        attempt for attempt in attempts
        if (attempt.get("violation_count") or 0) > 0 and attempt.get("status") == "submitted"
    ]

    timeline = [
        {
            "id": incident["id"],
            "student_name": incident["student_name"],
            "incident_type": incident["incident_type"],
            "severity": incident["severity"],
            "action_taken": incident["action_taken"],
            "details": incident.get("details") or {},
            "created_at": incident["created_at"],
        }
        for incident in sorted(incidents, key=lambda item: item["created_at"], reverse=True)
    ]

    student_summaries = []
    by_student: dict[str, dict[str, Any]] = defaultdict(lambda: {"incidents": [], "attempt": None})
    for attempt in attempts:
        by_student[attempt["student_id"]]["attempt"] = attempt
    for incident in incidents:
        by_student[incident["student_id"]]["incidents"].append(incident)

    for student_id, snapshot in by_student.items():
        attempt = snapshot["attempt"] or {}
        student_incidents = snapshot["incidents"]
        student_top_type = Counter(item["violation_type"] for item in student_incidents).most_common(1)
        student_summaries.append(
            {
                "student_id": student_id,
                "student_name": attempt.get("student_name") or (student_incidents[0]["student_name"] if student_incidents else "Student"),
                "attempt_status": attempt.get("status") or "not_started",
                "warning_count": attempt.get("violation_count") or len(student_incidents),
                "termination_reason": attempt.get("termination_reason"),
                "incident_count": len(student_incidents),
                "top_incident": describe_violation(student_top_type[0][0]) if student_top_type else "No incidents",
                "latest_incident_at": student_incidents[0]["created_at"] if student_incidents else None,
            }
        )

    student_summaries.sort(
        key=lambda item: (
            item["attempt_status"] != "terminated",
            -(item["warning_count"] or 0),
            item["student_name"].lower(),
        )
    )

    overall_severity = "low"
    if severity_totals:
        overall_severity = max(severity_totals.keys(), key=lambda item: SEVERITY_RANK.get(item, 0))

    review_summary = (
        f"{len(incidents)} proctoring incident{'s' if len(incidents) != 1 else ''} "
        f"across {len(attempts)} attempt{'s' if len(attempts) != 1 else ''}. "
        f"{len(terminated_attempts)} terminated attempt{'s' if len(terminated_attempts) != 1 else ''} "
        f"ended automatically."
    )
    if student_name:
        review_summary = f"{student_name}: {review_summary}"
    elif top_incident_type:
        review_summary += f" Most frequent signal: {describe_violation(top_incident_type)}."
    confidence_meta = classify_confidence(
        evidence_count=len(incidents),
        average_relevance=0.82 if terminated_attempts else 0.56 if incidents else 0.22,
        has_primary_sources=bool(incidents),
    )

    educator_recommendations = []
    if terminated_attempts:
        educator_recommendations.append(
            "Review terminated attempts first and confirm whether debarment should stand before reopening access."
        )
    if severity_totals.get("high") or severity_totals.get("critical"):
        educator_recommendations.append(
            "Compare the timeline with class instructions and camera evidence before recording a misconduct outcome."
        )
    if warning_only_attempts:
        educator_recommendations.append(
            "Message students who completed with warnings and assign a follow-up monitored retry if the context is unclear."
        )
    if top_incident_type in {"ai_looking_down", "ai_face_missing"}:
        educator_recommendations.append(
            "Review the camera timeline, then share a short reminder about device placement and camera framing before the next proctored quiz."
        )
    if not educator_recommendations:
        educator_recommendations.append(
            "No major intervention is needed. Keep this review on file and monitor the next scheduled attempt."
        )

    return {
        "quiz_id": quiz["id"],
        "quiz_title": quiz["title"],
        "overall_severity": overall_severity,
        "review_summary": review_summary,
        "incident_totals": {
            "total_incidents": len(incidents),
            "warning_events": action_counts.get("warning", 0),
            "terminated_events": action_counts.get("terminated", 0),
            "submitted_with_warnings": len(warning_only_attempts),
            "terminated_attempts": len(terminated_attempts),
            "submitted_attempts": len(submitted_attempts),
        },
        "top_signals": [
            {
                "incident_type": describe_violation(violation_type),
                "count": count,
            }
            for violation_type, count in incident_counts.most_common(4)
        ],
        "student_summaries": student_summaries,
        "timeline": timeline[:12],
        "educator_recommendations": educator_recommendations,
        "confidence": confidence_meta["confidence"],
        "confidence_reason": confidence_meta["confidence_reason"],
    }


def serialize_proctor_incident_row(
    violation,
    attempt,
    student,
) -> dict[str, Any]:
    """Convert ORM rows into a normalized incident payload."""
    warning_count = (attempt.violation_count or 0) if attempt else 0
    return {
        "id": violation.id,
        "student_id": student.id if student else (attempt.student_id if attempt else ""),
        "student_name": student.full_name if student else "Student",
        "violation_type": violation.violation_type,
        "incident_type": describe_violation(violation.violation_type),
        "severity": infer_incident_severity(violation.violation_type, violation.action_taken, warning_count),
        "action_taken": violation.action_taken,
        "details": violation.details or {},
        "created_at": violation.created_at.isoformat() if isinstance(violation.created_at, datetime) else str(violation.created_at),
    }
