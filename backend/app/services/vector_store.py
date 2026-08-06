"""Lightweight Qdrant-backed vector store helpers."""
from __future__ import annotations

import hashlib
import logging
import math
import uuid
from typing import Dict, Iterable, List, Optional

import requests

from app.core import settings

logger = logging.getLogger(__name__)

# BAAI/bge-small-en-v1.5 (fastembed, ONNX/CPU, ~67MB, no GPU/torch needed).
# Both the real model and the hashed fallback below produce vectors of this
# size so callers (Qdrant collections, the in-process fallback search) never
# need to know which one actually ran.
VECTOR_DIMENSION = 384
_EMBEDDING_MODEL_NAME = "BAAI/bge-small-en-v1.5"

_embedding_model = None
_embedding_model_load_failed = False


def _get_embedding_model():
    """Lazily load the real embedding model once per process.

    Returns None (and remembers not to retry) if fastembed isn't installed
    or the model can't be downloaded/loaded, so callers fall back to the
    hashed embedding instead of retrying an expensive failure on every call.
    """
    global _embedding_model, _embedding_model_load_failed
    if _embedding_model is not None or _embedding_model_load_failed:
        return _embedding_model

    try:
        from fastembed import TextEmbedding
        _embedding_model = TextEmbedding(model_name=_EMBEDDING_MODEL_NAME)
    except Exception as e:
        logger.warning("Real embedding model unavailable, falling back to hashed embeddings: %s", e)
        _embedding_model_load_failed = True
        return None

    return _embedding_model


def qdrant_available() -> bool:
    """Whether Qdrant is configured."""
    return bool((settings.qdrant_url or "").strip())


def ensure_collection() -> bool:
    """Create the Qdrant collection if it does not exist, or recreate it if
    an older collection was indexed with a different vector size (e.g. the
    previous hashed-embedding dimension). The collection is a rebuildable
    index over DocumentChunk rows, not a source of truth, so recreating it
    is safe -- documents get re-indexed the next time they're touched.
    """
    if not qdrant_available():
        return False

    collection_url = f"{settings.qdrant_url}/collections/{settings.qdrant_collection}"
    collection_exists = False

    try:
        info_response = requests.get(collection_url, headers=_headers(), timeout=10)
        if info_response.ok:
            existing_size = (
                info_response.json()
                .get("result", {})
                .get("config", {})
                .get("params", {})
                .get("vectors", {})
                .get("size")
            )
            if existing_size == VECTOR_DIMENSION:
                collection_exists = True
            else:
                requests.delete(collection_url, headers=_headers(), timeout=20)
    except Exception as e:
        logger.warning("Could not inspect existing Qdrant collection: %s", e)

    if not collection_exists:
        payload = {
            "vectors": {
                "size": VECTOR_DIMENSION,
                "distance": "Cosine",
            }
        }
        response = requests.put(collection_url, headers=_headers(), json=payload, timeout=20)
        if not response.ok:
            return False

    _ensure_payload_indexes(collection_url)
    return True


def _ensure_payload_indexes(collection_url: str) -> None:
    """Create payload indexes for fields used in filters.

    Clusters with strict mode enabled reject any filter on a field with no
    index ("Index required but not found"), so user_id/document_id -- both
    filtered on in search_chunks/delete_document_vectors -- need one.
    Idempotent: re-creating an existing index is a harmless no-op/short error
    that's safe to ignore.
    """
    for field_name in ("user_id", "document_id"):
        try:
            requests.put(
                f"{collection_url}/index",
                headers=_headers(),
                json={"field_name": field_name, "field_schema": "keyword"},
                timeout=10,
            )
        except Exception as e:
            logger.warning("Could not ensure payload index for %s: %s", field_name, e)


def upsert_document_chunks(chunks: Iterable[Dict]) -> bool:
    """Upsert vectors for indexed chunks.

    Each chunk dict may already carry a precomputed `embedding` (the caller
    -- index_document_chunks -- computes it once and reuses it for both the
    DocumentChunk.embedding column and this Qdrant upsert, rather than
    embedding the same text twice).
    """
    chunk_list = list(chunks)
    if not chunk_list or not qdrant_available():
        return False

    ensure_collection()
    points = []
    for chunk in chunk_list:
        vector = chunk.get("embedding") or embed_text(chunk["text_content"])
        points.append(
            {
                # Qdrant point IDs must be an unsigned integer or a UUID --
                # DocumentChunk.vector_id ("{document_id}:{chunk_index}") is
                # neither, so derive a stable UUID5 from it instead. It's
                # deterministic, so re-indexing the same document/chunk
                # overwrites the same point rather than orphaning one.
                "id": _point_id(chunk["vector_id"]),
                "vector": vector,
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
    """Embed text with the real model, falling back to a deterministic
    hashed embedding if the model isn't available (not installed, offline,
    failed to load). Both paths always return a VECTOR_DIMENSION-length
    vector so callers never need to branch on which one ran.
    """
    model = _get_embedding_model()
    if model is not None:
        try:
            return list(model.embed([text]))[0].tolist()
        except Exception as e:
            logger.warning("Embedding call failed, falling back to hashed embedding: %s", e)

    return _hashed_embed_text(text)


def embed_texts(texts: List[str]) -> List[List[float]]:
    """Batch-embed multiple texts in one call (much faster than embedding
    one at a time when indexing a document's worth of chunks).
    """
    if not texts:
        return []

    model = _get_embedding_model()
    if model is not None:
        try:
            return [vector.tolist() for vector in model.embed(texts)]
        except Exception as e:
            logger.warning("Batch embedding call failed, falling back to hashed embeddings: %s", e)

    return [_hashed_embed_text(text) for text in texts]


def _hashed_embed_text(text: str) -> List[float]:
    """Deterministic hashed embedding, used only when the real model is
    unavailable. Captures lexical overlap, not real semantic similarity.
    """
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


def _point_id(vector_id: str) -> str:
    """Derive a Qdrant-valid point ID (UUID) from an arbitrary vector_id string."""
    return str(uuid.uuid5(uuid.NAMESPACE_URL, vector_id))


def _headers() -> Dict[str, str]:
    headers = {"Content-Type": "application/json"}
    api_key = (settings.qdrant_api_key or "").strip()
    if api_key:
        headers["api-key"] = api_key
    return headers


def _tokenize(text: str) -> List[str]:
    return [token.strip(".,!?;:()[]{}\"'").lower() for token in (text or "").split() if len(token.strip()) > 2]
