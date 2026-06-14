"""Shared helpers for shaping supporting evidence before generation."""
from __future__ import annotations


def dedupe_evidence_items(items):
    """Keep the highest-scoring item for duplicated content."""
    best = {}
    for item in items:
        key = (item.get("content") or "").strip().lower()
        current = best.get(key)
        if not current or float(item.get("relevance_score", 0)) > float(current.get("relevance_score", 0)):
            best[key] = item
    return list(best.values())


def trim_evidence_items(items, max_chars=2200):
    """Trim evidence to a reasonable total context size while preserving order."""
    kept = []
    total = 0
    for item in items:
        content = item.get("content", "")
        if total >= max_chars:
            break
        kept.append(item)
        total += len(content)
    return kept
