"""Lightweight Qdrant-backed vector store helpers."""
from __future__ import annotations

import hashlib
import math
from typing import Dict, Iterable, List, Optional

import requests

from app.core import settings

VECTOR_DIMENSION = 256


def qdrant_available() -> bool:
    """Whether Qdrant is configured."""
    return bool((settings.qdrant_url or "").strip())


def ensure_collection() -> bool:
    """Create the Qdrant collection if it does not exist."""
    if not qdrant_available():
        return False

    payload = {
        "vectors": {
            "size": VECTOR_DIMENSION,
            "distance": "Cosine",
        }
    }

    response = requests.put(
        f"{settings.qdrant_url}/collections/{settings.qdrant_collection}",
        headers=_headers(),
        json=payload,
        timeout=20,
    )
    return response.ok


def upsert_document_chunks(chunks: Iterable[Dict]) -> bool:
    """Upsert vectors for indexed chunks."""
    chunk_list = list(chunks)
    if not chunk_list or not qdrant_available():
        return False

    ensure_collection()
    points = []
    for chunk in chunk_list:
        vector_id = chunk["vector_id"]
        points.append(
            {
                "id": vector_id,
                "vector": embed_text(chunk["text_content"]),
                "payload": {
                    "document_id": chunk["document_id"],
                    "document_title": chunk["document_title"],
                    "page_number": chunk["page_number"],
                    "chunk_index": chunk["chunk_index"],
                    "content": chunk["text_content"],
                    "user_id": chunk["user_id"],
                },
            }
        )

    response = requests.put(
        f"{settings.qdrant_url}/collections/{settings.qdrant_collection}/points",
        headers=_headers(),
        json={"points": points},
        timeout=30,
    )
    return response.ok


def search_chunks(query: str, user_id: str, document_ids: Optional[List[str]] = None, top_k: int = 5) -> List[Dict]:
    """Search relevant chunks in Qdrant."""
    if not qdrant_available():
        return []

    must = [{"key": "user_id", "match": {"value": user_id}}]
    if document_ids:
        must.append({"key": "document_id", "match": {"any": document_ids}})

    response = requests.post(
        f"{settings.qdrant_url}/collections/{settings.qdrant_collection}/points/search",
        headers=_headers(),
        json={
            "vector": embed_text(query),
            "limit": top_k,
            "with_payload": True,
            "filter": {"must": must},
        },
        timeout=30,
    )
    if not response.ok:
        return []

    results = response.json().get("result", [])
    contexts = []
    for item in results:
        payload = item.get("payload", {})
        contexts.append(
            {
                "content": payload.get("content", ""),
                "document_id": payload.get("document_id"),
                "document_title": payload.get("document_title", "Uploaded Material"),
                "page_number": payload.get("page_number", 1),
                "chunk_index": payload.get("chunk_index", 0),
                "relevance_score": round(float(item.get("score", 0.0)), 4),
            }
        )
    return contexts


def delete_document_vectors(document_id: str) -> bool:
    """Delete vectors associated with a document."""
    if not qdrant_available():
        return False

    response = requests.post(
        f"{settings.qdrant_url}/collections/{settings.qdrant_collection}/points/delete",
        headers=_headers(),
        json={"filter": {"must": [{"key": "document_id", "match": {"value": document_id}}]}},
        timeout=20,
    )
    return response.ok


def embed_text(text: str) -> List[float]:
    """Deterministic hashed embedding for low-cost semantic retrieval."""
    vector = [0.0] * VECTOR_DIMENSION
    tokens = _tokenize(text)
    if not tokens:
        return vector

    for token in tokens:
        digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
        slot = int(digest[:8], 16) % VECTOR_DIMENSION
        sign = -1.0 if int(digest[8:10], 16) % 2 else 1.0
        weight = 1.0 + (len(token) / 20.0)
        vector[slot] += sign * weight

    norm = math.sqrt(sum(value * value for value in vector)) or 1.0
    return [round(value / norm, 6) for value in vector]


def _headers() -> Dict[str, str]:
    headers = {"Content-Type": "application/json"}
    api_key = (settings.qdrant_api_key or "").strip()
    if api_key:
        headers["api-key"] = api_key
    return headers


def _tokenize(text: str) -> List[str]:
    return [token.strip(".,!?;:()[]{}\"'").lower() for token in (text or "").split() if len(token.strip()) > 2]
