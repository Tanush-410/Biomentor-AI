"""Security helpers for auth, rate limits, and uploads."""
from __future__ import annotations

from collections import defaultdict, deque
from datetime import datetime, timedelta
import os
import re
from typing import Iterable, Optional

from fastapi import HTTPException, Request, status

VALID_ROLES = {"student", "educator", "admin"}
ALLOWED_UPLOAD_EXTENSIONS = {".pdf", ".txt", ".md"}
ALLOWED_UPLOAD_MIME_TYPES = {
    "application/pdf",
    "text/plain",
    "text/markdown",
    "text/x-markdown",
    "application/octet-stream",
}

_RATE_LIMIT_BUCKETS = defaultdict(deque)


def normalize_role(role: Optional[str], default: str = "student") -> str:
    """Normalize role strings."""
    candidate = (role or default).strip().lower()
    if candidate not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role must be one of: {', '.join(sorted(VALID_ROLES))}",
        )
    return candidate


def enforce_rate_limit(
    request: Request,
    bucket: str,
    limit: int,
    window_seconds: int,
) -> None:
    """Simple in-memory rate limiting for sensitive endpoints."""
    forwarded = request.headers.get("x-forwarded-for", "")
    client_ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")
    key = f"{bucket}:{client_ip}"
    now = datetime.utcnow()
    window_start = now - timedelta(seconds=window_seconds)
    entries = _RATE_LIMIT_BUCKETS[key]

    while entries and entries[0] < window_start:
        entries.popleft()

    if len(entries) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please slow down and try again shortly.",
        )

    entries.append(now)


def sanitize_filename(file_name: str) -> str:
    """Strip dangerous path fragments while preserving readability."""
    safe_name = os.path.basename(file_name or "upload")
    safe_name = re.sub(r"[^A-Za-z0-9._ -]+", "_", safe_name).strip("._ ")
    return safe_name or "upload"


def validate_upload(file_name: str, content_type: Optional[str]) -> str:
    """Validate upload type and return normalized extension."""
    safe_name = sanitize_filename(file_name)
    extension = os.path.splitext(safe_name)[1].lower()
    if extension not in ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF, TXT, and MD files are supported",
        )
    if content_type and content_type not in ALLOWED_UPLOAD_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type for upload",
        )
    return extension


def parse_page_selection(raw_pages: Optional[str], max_pages: int) -> Optional[list[int]]:
    """Parse a page selection string like '1-3,5,8-10'."""
    if not raw_pages:
        return None

    selected = set()
    for part in raw_pages.split(","):
        token = part.strip()
        if not token:
            continue
        if "-" in token:
            start_text, end_text = token.split("-", 1)
            start, end = int(start_text), int(end_text)
            if start <= 0 or end < start:
                raise HTTPException(status_code=400, detail="Invalid page range selection")
            selected.update(range(start, end + 1))
        else:
            page = int(token)
            if page <= 0:
                raise HTTPException(status_code=400, detail="Page numbers must be positive")
            selected.add(page)

    filtered = sorted(page for page in selected if page <= max_pages)
    if not filtered:
        raise HTTPException(status_code=400, detail="No valid pages selected in the requested range")
    return filtered


def ensure_role(current_role: str, allowed_roles: Iterable[str]) -> None:
    """Guard endpoints by role."""
    if current_role not in set(allowed_roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this area.",
        )
