"""Shared fallback decisions for AI features."""
from __future__ import annotations


def should_use_safe_fallback(*, evidence_count: int, confidence: str) -> bool:
    """Return whether the caller should switch to safer fallback behavior."""
    return evidence_count <= 0 or confidence == "low"
