"""Shared AI generation helpers.

Every call site in this app should go through the helpers here rather than
calling Groq or Gemini directly, so there is one place that implements the
provider failover: Groq is the primary text model (fast, generous free
tier); if its quota/rate limit is hit, it times out, or it errors, we
automatically fail over to Gemini before giving up. Gemini can also have a
second API key configured, and requests will cycle to it if the first
Gemini key is rate-limited, extending free usage further. Callers only ever
see one stable function -- the router internally handles provider
selection, quota detection, and key rotation so an outage or rate-limit on
a single provider/key never takes the chatbot down.
"""
from __future__ import annotations

import base64
import json
import logging
import re
from typing import List, Optional, Tuple

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_DEFAULT_MODEL = "llama-3.3-70b-versatile"

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
GEMINI_TEXT_MODEL = "gemini-2.0-flash"
GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image"


def _is_real_key(key: Optional[str]) -> bool:
    key = (key or "").strip()
    return bool(key) and not key.lower().startswith("your_")


def groq_available() -> bool:
    return _is_real_key(settings.groq_api_key)


def gemini_keys() -> List[str]:
    """All configured, non-placeholder Gemini API keys, in try-order."""
    candidates = [settings.gemini_api_key, settings.gemini_api_key_2]
    return [key.strip() for key in candidates if _is_real_key(key)]


def gemini_available() -> bool:
    return bool(gemini_keys())


def ai_provider_available() -> bool:
    """True if there is any configured AI text provider at all (Groq or Gemini)."""
    return groq_available() or gemini_available()


def _groq_chat(
    system_prompt: str,
    user_prompt: str,
    *,
    temperature: float,
    timeout: int,
    json_mode: bool,
    model: str = GROQ_DEFAULT_MODEL,
) -> Optional[str]:
    if not groq_available():
        return None

    payload = {
        "model": model,
        "temperature": temperature,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    try:
        response = requests.post(
            GROQ_CHAT_URL,
            headers={
                "Authorization": f"Bearer {settings.groq_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=timeout,
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"].strip()
    except Exception:
        logger.warning("Groq completion failed, will try failover provider.", exc_info=True)
        return None


def _gemini_chat_with_key(
    key: str,
    system_prompt: str,
    user_prompt: str,
    *,
    temperature: float,
    timeout: int,
    json_mode: bool,
) -> Optional[str]:
    generation_config = {"temperature": temperature}
    if json_mode:
        generation_config["response_mime_type"] = "application/json"

    payload = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
        "generationConfig": generation_config,
    }
    url = f"{GEMINI_API_BASE}/{GEMINI_TEXT_MODEL}:generateContent?key={key}"

    try:
        response = requests.post(url, json=payload, timeout=timeout)
        response.raise_for_status()
        data = response.json()
        candidates = data.get("candidates") or []
        if not candidates:
            return None
        parts = (candidates[0].get("content") or {}).get("parts") or []
        text = "".join(part.get("text", "") for part in parts).strip()
        return text or None
    except Exception:
        logger.warning("Gemini completion failed for one key, trying next key if available.", exc_info=True)
        return None


def _gemini_chat(
    system_prompt: str,
    user_prompt: str,
    *,
    temperature: float,
    timeout: int,
    json_mode: bool,
) -> Optional[str]:
    for key in gemini_keys():
        text = _gemini_chat_with_key(
            key,
            system_prompt,
            user_prompt,
            temperature=temperature,
            timeout=timeout,
            json_mode=json_mode,
        )
        if text:
            return text
    return None


def ai_chat_completion(
    *,
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.2,
    timeout: int = 30,
    json_mode: bool = False,
    groq_model: str = GROQ_DEFAULT_MODEL,
) -> Tuple[Optional[str], Optional[str]]:
    """Run a chat completion with Groq as primary and Gemini as failsafe.

    Returns (text, provider_used) where provider_used is "groq", "gemini",
    or None if every configured provider failed (or none were configured).
    """
    text = _groq_chat(
        system_prompt,
        user_prompt,
        temperature=temperature,
        timeout=timeout,
        json_mode=json_mode,
        model=groq_model,
    )
    if text:
        return text, "groq"

    text = _gemini_chat(
        system_prompt,
        user_prompt,
        temperature=temperature,
        timeout=timeout,
        json_mode=json_mode,
    )
    if text:
        return text, "gemini"

    return None, None


def _parse_json_loose(text: str) -> Optional[dict]:
    """Parse a model's JSON reply, but only ever return a dict (or None).

    Every caller of ai_json_completion / gemini_json_completion /
    groq_json_completion in this codebase expects a JSON *object* (they
    call .get()/.setdefault() on the result). If a model returns a bare
    JSON array or a scalar instead of an object -- which happens
    occasionally even with "json mode" enabled -- returning it as-is would
    hand callers a value whose methods don't exist, crashing the request
    with an unhandled AttributeError instead of failing gracefully. So a
    successfully-parsed non-dict is treated the same as a parse failure.
    """
    parsed = _try_parse_json(text)
    if isinstance(parsed, dict):
        return parsed
    if parsed is not None:
        logger.warning("AI completion returned valid JSON but not a JSON object (got %s); treating as a failure.", type(parsed).__name__)
    return None


def _try_parse_json(text: str):
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Occasionally a model wraps JSON in a ```json fence despite the
    # json-mode hint; try to recover it before giving up.
    fenced = re.search(r"```(?:json)?\s*(\{.*\}|\[.*\])\s*```", text, re.DOTALL)
    if fenced:
        try:
            return json.loads(fenced.group(1))
        except json.JSONDecodeError:
            pass
    return None


def ai_json_completion(
    *,
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.2,
    timeout: int = 30,
    groq_model: str = GROQ_DEFAULT_MODEL,
):
    """Chat completion that must return valid JSON, with Groq->Gemini failover.

    Returns the parsed JSON (dict/list) or None if every provider failed or
    none returned valid JSON.
    """
    text, provider = ai_chat_completion(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=temperature,
        timeout=timeout,
        json_mode=True,
        groq_model=groq_model,
    )
    if not text:
        return None

    parsed = _parse_json_loose(text)
    if parsed is None:
        logger.warning("AI completion from %s did not return valid JSON.", provider)
    return parsed


def groq_json_completion(*, system_prompt: str, user_prompt: str, timeout: int = 20):
    """Backwards-compatible Groq-only JSON completion (no Gemini failover).

    Prefer ai_json_completion / ai_chat_completion for new code so callers
    automatically get the Gemini failsafe.
    """
    text = _groq_chat(system_prompt, user_prompt, temperature=0.2, timeout=timeout, json_mode=False)
    if not text:
        return None
    return _parse_json_loose(text)


def gemini_json_completion(*, system_prompt: str, user_prompt: str, temperature: float = 0.2, timeout: int = 30):
    """Gemini-only JSON completion (no Groq attempt).

    Useful for call sites that already ran their own Groq attempt(s) and
    just want to fail over straight to Gemini without retrying Groq.
    """
    text = _gemini_chat(system_prompt, user_prompt, temperature=temperature, timeout=timeout, json_mode=True)
    if not text:
        return None
    return _parse_json_loose(text)


def gemini_generate_image(prompt: str, *, timeout: int = 30) -> Optional[bytes]:
    """Generate an image with Gemini's image-generation model.

    Tries each configured Gemini key in turn. Returns raw image bytes (PNG),
    or None if no Gemini key is configured or every attempt failed.
    """
    for key in gemini_keys():
        image_bytes = _gemini_generate_image_with_key(key, prompt, timeout=timeout)
        if image_bytes:
            return image_bytes
    return None


def _gemini_generate_image_with_key(key: str, prompt: str, *, timeout: int) -> Optional[bytes]:
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"responseModalities": ["IMAGE"]},
    }
    url = f"{GEMINI_API_BASE}/{GEMINI_IMAGE_MODEL}:generateContent?key={key}"

    try:
        response = requests.post(url, json=payload, timeout=timeout)
        response.raise_for_status()
        data = response.json()
        for candidate in data.get("candidates") or []:
            parts = (candidate.get("content") or {}).get("parts") or []
            for part in parts:
                inline = part.get("inlineData") or part.get("inline_data")
                if inline and inline.get("data"):
                    return base64.b64decode(inline["data"])
        return None
    except Exception:
        logger.warning("Gemini image generation failed for one key, trying next key if available.", exc_info=True)
        return None
