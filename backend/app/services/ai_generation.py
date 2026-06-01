"""Shared AI generation helpers."""
from __future__ import annotations

import json

import requests

from app.core.config import settings


def groq_json_completion(*, system_prompt: str, user_prompt: str, timeout: int = 20):
    """Request a JSON-only completion from Groq when configured."""
    key = (settings.groq_api_key or "").strip()
    if not key or key.lower().startswith("your_"):
        return None

    response = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={
            "model": "llama-3.3-70b-versatile",
            "temperature": 0.2,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        },
        timeout=timeout,
    )
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"].strip()
    return json.loads(content)
