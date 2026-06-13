"""Helpers for assembling educator-facing anti-cheat bot responses."""
from __future__ import annotations

from typing import Any


HARD_RULE_SIGNAL_TYPES = {
    "fullscreen_exit",
    "tab_hidden",
    "window_blur",
    "camera_lost",
    "blocked_shortcut",
    "context_menu",
}

HEURISTIC_SIGNAL_TYPES = {
    "ai_multiple_faces",
    "ai_face_missing",
    "ai_looking_down",
}


def classify_signal_family(violation_type: str | None) -> str:
    """Group anti-cheat signals into human-review buckets."""
    if violation_type in HARD_RULE_SIGNAL_TYPES:
        return "hard_rule"
    if violation_type in HEURISTIC_SIGNAL_TYPES:
        return "heuristic"
    return "other"


def serialize_anticheat_evidence(evidence: dict[str, Any]) -> dict[str, Any]:
    """Normalize one evidence snapshot for frontend consumption."""
    return {
        "id": evidence.get("id"),
        "image_url": evidence.get("image_url"),
        "violation_type": evidence.get("violation_type"),
        "signal_family": classify_signal_family(evidence.get("violation_type")),
        "action_taken": evidence.get("action_taken") or "warning",
        "captured_at": evidence.get("captured_at") or evidence.get("created_at"),
        "details": evidence.get("details") or {},
    }


def build_case_signal_summary(evidence_rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Summarize what kind of evidence drove the anti-cheat case."""
    summary = {
        "hard_rule_count": 0,
        "heuristic_count": 0,
        "other_count": 0,
        "camera_evidence_count": 0,
    }
    for row in evidence_rows:
        family = classify_signal_family(row.get("violation_type"))
        if family == "hard_rule":
            summary["hard_rule_count"] += 1
        elif family == "heuristic":
            summary["heuristic_count"] += 1
        else:
            summary["other_count"] += 1
        if row.get("image_url") or (row.get("details") or {}).get("evidence_image_url"):
            summary["camera_evidence_count"] += 1

    summary["posture"] = (
        "hard_rule_dominant"
        if summary["hard_rule_count"] > summary["heuristic_count"]
        else "heuristic_dominant"
        if summary["heuristic_count"] > 0
        else "mixed_review"
    )
    summary["teacher_note"] = (
        "This case contains hard-rule signals like tab, fullscreen, or device-control violations."
        if summary["hard_rule_count"] > 0
        else "This case is driven mainly by camera heuristics and should be confirmed manually."
        if summary["heuristic_count"] > 0
        else "This case needs manual review because the signal mix is unclear."
    )
    return summary


def build_anticheat_case_payload(case: dict[str, Any], evidence_rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Build one anti-cheat bot case card."""
    ordered = sorted(
        evidence_rows,
        key=lambda row: row.get("captured_at") or row.get("created_at") or "",
        reverse=True,
    )
    signal_summary = build_case_signal_summary(ordered)
    last_three_reasons = [
        row.get("violation_type")
        for row in ordered[:3]
        if row.get("violation_type")
    ]
    return {
        "id": case.get("id"),
        "assessment_type": case.get("assessment_type"),
        "assessment_id": case.get("assessment_id"),
        "attempt_id": case.get("attempt_id"),
        "student_id": case.get("student_id"),
        "student_name": case.get("student_name"),
        "final_case_reason": case.get("final_case_reason"),
        "status": case.get("status") or "teacher_review_required",
        "teacher_review_required": bool(case.get("teacher_review_required", True)),
        "latest_warning_count": case.get("latest_warning_count") or 0,
        "created_at": case.get("created_at"),
        "signal_summary": signal_summary,
        "last_three_reasons": last_three_reasons,
        "final_recommendation": (
            "Review before confirming debarment."
            if signal_summary["heuristic_count"] > 0
            else "Hard-rule evidence supports the current case posture."
        ),
        "evidence_snapshots": [serialize_anticheat_evidence(row) for row in ordered[:3]],
    }
