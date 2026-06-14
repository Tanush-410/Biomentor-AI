"""Shared confidence and origin-label helpers for AI features."""
from __future__ import annotations


def classify_confidence(
    *,
    evidence_count: int,
    average_score: float | None = None,
    malformed_output: bool = False,
    average_relevance: float | None = None,
    has_primary_sources: bool | None = None,
) -> dict:
    """Return a normalized confidence label and short reason.

    The helper accepts both the original `average_score`/`malformed_output` style
    and the newer `average_relevance`/`has_primary_sources` style used by the
    broader AI quality pass.
    """
    score = average_score if average_score is not None else average_relevance if average_relevance is not None else 0.0
    score = max(0.0, min(1.0, float(score)))
    primary_sources = True if has_primary_sources is None else bool(has_primary_sources)

    if evidence_count <= 0 or score < 0.35:
        reason = "Evidence is weak or missing."
        if primary_sources and evidence_count > 0:
            reason = "Evidence exists, but it is still too thin to trust strongly."
        return {"confidence": "low", "confidence_reason": reason}
    if malformed_output or score < 0.7:
        reason = "Evidence is usable but not fully reliable."
        if not primary_sources:
            reason = "Signals are useful, but they are inferred from indirect evidence."
        return {"confidence": "medium", "confidence_reason": reason}
    return {"confidence": "high", "confidence_reason": "Evidence is strong and well-aligned."}


def make_origin_label(origin: str) -> str:
    """Convert a backend origin flag into a user-facing label."""
    labels = {
        "material": "Answered from your material",
        "trusted_web": "Enhanced with trusted web sources",
        "broader_web": "Enhanced with web sources",
        "meeting_transcript": "Derived from meeting transcript",
        "analytics": "Derived from learning analytics",
        "rule_based": "Generated from rule-based signals",
    }
    return labels.get(origin, "AI-assisted")
