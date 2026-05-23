"""Helpers for document chunk ingestion and retrieval."""
from __future__ import annotations

import math
import re
from collections import Counter
from typing import Dict, Iterable, List, Optional

from sqlalchemy.orm import Session

from app.database.models import Document, DocumentChunk
from app.services.vector_store import search_chunks, upsert_document_chunks

WORD_RE = re.compile(r"[A-Za-z][A-Za-z0-9'-]+")
SPLIT_RE = re.compile(r"(?<=[.!?])\s+")

STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "been", "by", "for", "from",
    "has", "have", "he", "in", "is", "it", "its", "of", "on", "or", "that",
    "the", "their", "them", "they", "this", "to", "was", "were", "which",
    "with", "you", "your",
}

FOLLOW_UP_HINTS = (
    "it", "that", "this", "they", "them", "those", "these",
    "shorter", "simpler", "summarize", "summary", "explain", "continue",
    "next", "elaborate", "expand", "briefly", "in short", "what about",
)


def build_page_payloads_from_text(text: str, file_type: str) -> List[Dict]:
    """Build page-like payloads for plain text material."""
    cleaned = (text or "").strip()
    if not cleaned:
        return []

    if file_type in {"txt", "md"}:
        blocks = [block.strip() for block in re.split(r"\n\s*\n", cleaned) if block.strip()]
        pages: List[Dict] = []
        current: List[str] = []
        current_len = 0
        page_number = 1
        for block in blocks:
            if current and current_len + len(block) > 2400:
                pages.append({"page_number": page_number, "text": "\n\n".join(current)})
                current = []
                current_len = 0
                page_number += 1
            current.append(block)
            current_len += len(block)
        if current:
            pages.append({"page_number": page_number, "text": "\n\n".join(current)})
        return pages

    return [{"page_number": 1, "text": cleaned}]


def chunk_pages(page_payloads: Iterable[Dict], chunk_size: int = 1200, overlap: int = 180) -> List[Dict]:
    """Split page payloads into overlapping retrieval chunks."""
    chunks: List[Dict] = []
    chunk_index = 0

    for payload in page_payloads:
        page_number = int(payload.get("page_number") or 1)
        text = normalize_whitespace(payload.get("text", ""))
        if not text:
            continue

        parts = [part.strip() for part in SPLIT_RE.split(text) if part.strip()]
        current_parts: List[str] = []
        current_len = 0

        for sentence in parts:
            sentence_len = len(sentence)
            if current_parts and current_len + sentence_len > chunk_size:
                chunk_text = " ".join(current_parts).strip()
                if chunk_text:
                    chunks.append(
                        {
                            "chunk_index": chunk_index,
                            "page_number": page_number,
                            "text_content": chunk_text,
                        }
                    )
                    chunk_index += 1

                overlap_parts = _tail_overlap(current_parts, overlap)
                current_parts = overlap_parts[:] if overlap_parts else []
                current_len = len(" ".join(current_parts))

            current_parts.append(sentence)
            current_len += sentence_len + 1

        if current_parts:
            chunk_text = " ".join(current_parts).strip()
            if chunk_text:
                chunks.append(
                    {
                        "chunk_index": chunk_index,
                        "page_number": page_number,
                        "text_content": chunk_text,
                    }
                )
                chunk_index += 1

    return chunks


def index_document_chunks(
    db: Session,
    document: Document,
    page_payloads: List[Dict],
    content_preview: Optional[str] = None,
) -> int:
    """Persist retrieval chunks for a document and update processing metadata."""
    chunks = chunk_pages(page_payloads)
    db.query(DocumentChunk).filter(DocumentChunk.document_id == document.id).delete(synchronize_session=False)

    qdrant_payload = []
    for chunk in chunks:
        vector_id = f"{document.id}:{chunk['chunk_index']}"
        db.add(
            DocumentChunk(
                document_id=document.id,
                chunk_index=chunk["chunk_index"],
                page_number=chunk["page_number"],
                text_content=chunk["text_content"],
                vector_id=vector_id,
            )
        )
        qdrant_payload.append(
            {
                "vector_id": vector_id,
                "document_id": document.id,
                "document_title": document.title,
                "user_id": document.user_id,
                "chunk_index": chunk["chunk_index"],
                "page_number": chunk["page_number"],
                "text_content": chunk["text_content"],
            }
        )

    document.embedding_count = len(chunks)
    document.is_processed = True
    document.processing_status = "completed" if chunks else "failed"
    if content_preview is not None:
        document.content_preview = content_preview[:1500]

    db.flush()
    try:
        upsert_document_chunks(qdrant_payload)
    except Exception:
        # Keep local lexical retrieval working even if vector indexing fails.
        pass
    return len(chunks)


def get_document_context(
    db: Session,
    user_id: str,
    document_ids: Optional[List[str]] = None,
    query: Optional[str] = None,
    top_k: int = 5,
    conversation_history: Optional[List[Dict]] = None,
) -> List[Dict]:
    """Fetch chunked context with optional lexical ranking."""
    if query:
        query_candidates = build_query_candidates(query, conversation_history)
        vector_results: List[Dict] = []
        for candidate in query_candidates:
            try:
                vector_results.extend(search_chunks(candidate, user_id=user_id, document_ids=document_ids, top_k=max(top_k, 4)))
            except Exception:
                continue

        lexical_results = _lexical_search_contexts(
            db,
            user_id=user_id,
            document_ids=document_ids,
            queries=query_candidates,
            top_k=max(top_k * 3, 8),
        )

        hybrid_results = merge_context_results(query, vector_results, lexical_results, top_k=top_k)
        if hybrid_results:
            return hybrid_results

    chunk_rows = (
        db.query(DocumentChunk, Document)
        .join(Document, Document.id == DocumentChunk.document_id)
        .filter(Document.user_id == user_id)
    )

    if document_ids:
        chunk_rows = chunk_rows.filter(Document.id.in_(document_ids))

    pairs = chunk_rows.order_by(Document.uploaded_at.desc(), DocumentChunk.page_number.asc(), DocumentChunk.chunk_index.asc()).all()
    contexts = [
        {
            "content": normalize_whitespace(chunk.text_content),
            "document_id": document.id,
            "document_title": document.title,
            "page_number": chunk.page_number,
            "chunk_index": chunk.chunk_index,
            "relevance_score": 0.0,
        }
        for chunk, document in pairs
        if normalize_whitespace(chunk.text_content)
    ]

    if not query:
        return _apply_diversity(contexts, top_k=top_k)

    scored = []
    for item in contexts:
        score = _score_chunk(query, item["content"])
        if score <= 0:
            continue
        ranked = dict(item)
        ranked["relevance_score"] = score
        scored.append(ranked)

    scored.sort(key=lambda item: (item["relevance_score"], -item["page_number"], -item["chunk_index"]), reverse=True)
    return _apply_diversity(scored, top_k=top_k)


def build_context_window(contexts: List[Dict], max_chars: int = 10000) -> str:
    """Build a prompt-ready text window preserving source references."""
    selected = []
    total = 0

    for item in contexts:
        block = (
            f"[Source: {item['document_title']} | Page {item['page_number']} | Chunk {item['chunk_index']}]\n"
            f"{item['content']}"
        )
        if selected and total + len(block) > max_chars:
            continue
        selected.append(block)
        total += len(block)
        if total >= max_chars:
            break

    return "\n\n".join(selected)


def build_document_insights(contexts: List[Dict], max_concepts: int = 10, max_pages: int = 4) -> Dict:
    """Build lightweight study-map data from retrieved chunks."""
    page_buckets: Dict[int, List[Dict]] = {}
    keyword_counts: Counter = Counter()

    for item in contexts:
        page_buckets.setdefault(item["page_number"], []).append(item)
        keyword_counts.update(_tokenize(item["content"]))

    key_pages = []
    for page_number in sorted(page_buckets.keys())[:max_pages]:
        chunks = page_buckets[page_number]
        preview = " ".join(chunk["content"] for chunk in chunks[:2]).strip()
        key_pages.append(
            {
                "page_number": page_number,
                "document_id": chunks[0]["document_id"],
                "document_title": chunks[0]["document_title"],
                "preview": preview[:260],
                "chunk_count": len(chunks),
            }
        )

    concept_chips = [
        {"label": keyword.replace("-", " "), "weight": count}
        for keyword, count in keyword_counts.most_common(max_concepts)
    ]

    return {
        "concepts": concept_chips,
        "key_pages": key_pages,
        "total_chunks": len(contexts),
    }


def fallback_preview_context(db: Session, user_id: str, document_ids: Optional[List[str]] = None, top_k: int = 3) -> List[Dict]:
    """Fallback to previews when chunk rows are not available yet."""
    query = db.query(Document).filter(Document.user_id == user_id)
    if document_ids:
        query = query.filter(Document.id.in_(document_ids))

    documents = query.order_by(Document.uploaded_at.desc()).limit(max(3, top_k)).all()
    return [
        {
            "content": normalize_whitespace(document.content_preview or ""),
            "document_id": document.id,
            "document_title": document.title,
            "page_number": 1,
            "chunk_index": 0,
            "relevance_score": 0.35,
        }
        for document in documents
        if normalize_whitespace(document.content_preview or "")
    ][:top_k]


def normalize_whitespace(text: str) -> str:
    """Normalize whitespace and remove repeated blank areas."""
    return re.sub(r"\s+", " ", str(text or "")).strip()


def _tokenize(text: str) -> List[str]:
    return [
        token.lower()
        for token in WORD_RE.findall(text or "")
        if len(token) > 2 and token.lower() not in STOPWORDS
    ]


def _score_chunk(query: str, content: str) -> float:
    query_tokens = _tokenize(query)
    content_tokens = _tokenize(content)
    if not query_tokens or not content_tokens:
        return 0.0

    query_counts = Counter(query_tokens)
    content_counts = Counter(content_tokens)

    overlap = sum(min(content_counts[token], count) for token, count in query_counts.items())
    if overlap == 0:
        return 0.0

    distinct_overlap = len(set(query_tokens) & set(content_tokens))
    density = overlap / math.sqrt(len(content_tokens))
    phrase_bonus = 0.35 if normalize_whitespace(query).lower() in normalize_whitespace(content).lower() else 0.0
    return round(density + distinct_overlap * 0.45 + phrase_bonus, 4)


def build_query_candidates(question: str, conversation_history: Optional[List[Dict]] = None, max_candidates: int = 4) -> List[str]:
    """Expand follow-up questions into richer retrieval candidates."""
    question_text = normalize_whitespace(question)
    if not question_text:
        return []

    candidates = [question_text]
    history = conversation_history or []
    lowered = question_text.lower()
    is_follow_up = (
        len(question_text.split()) <= 4
        or any(hint in lowered for hint in FOLLOW_UP_HINTS)
        or bool(re.match(r"^(and|also|then|what about|how about|can you|now)\b", lowered))
    )
    if not history or not is_follow_up:
        return candidates

    recent_user = next((item.get("content", "") for item in reversed(history) if item.get("role") == "user"), "")
    recent_assistant = next((item.get("content", "") for item in reversed(history) if item.get("role") == "assistant"), "")

    if recent_user:
        candidates.append(f"{question_text}\nPrevious user question: {normalize_whitespace(recent_user)}")
    if recent_assistant:
        candidates.append(f"{question_text}\nPrevious answer topic: {normalize_whitespace(recent_assistant)[:280]}")
        summary_keywords = _top_keywords(recent_assistant, limit=8)
        if summary_keywords:
            candidates.append(f"{question_text} {' '.join(summary_keywords)}")

    unique_candidates: List[str] = []
    seen = set()
    for candidate in candidates:
        normalized = normalize_whitespace(candidate)
        key = normalized.lower()
        if not normalized or key in seen:
            continue
        seen.add(key)
        unique_candidates.append(normalized)
        if len(unique_candidates) >= max_candidates:
            break
    return unique_candidates


def merge_context_results(query: str, vector_results: List[Dict], lexical_results: List[Dict], top_k: int = 5) -> List[Dict]:
    """Merge vector and lexical contexts with dedupe and diversity."""
    merged: Dict[tuple, Dict] = {}

    for item in vector_results:
        key = _context_key(item)
        existing = merged.get(key)
        hybrid_score = _score_hybrid_item(query, item, source="vector")
        candidate = dict(item)
        candidate["hybrid_score"] = hybrid_score
        candidate["retrieval_sources"] = ["vector"]
        if not existing or hybrid_score > existing["hybrid_score"]:
            merged[key] = candidate

    for item in lexical_results:
        key = _context_key(item)
        hybrid_score = _score_hybrid_item(query, item, source="lexical")
        existing = merged.get(key)
        if existing:
            existing["hybrid_score"] = max(existing["hybrid_score"], hybrid_score) + 0.12
            sources = set(existing.get("retrieval_sources", []))
            sources.add("lexical")
            existing["retrieval_sources"] = sorted(sources)
            continue

        candidate = dict(item)
        candidate["hybrid_score"] = hybrid_score
        candidate["retrieval_sources"] = ["lexical"]
        merged[key] = candidate

    ranked = sorted(
        merged.values(),
        key=lambda item: (
            item.get("hybrid_score", 0.0),
            item.get("relevance_score", 0.0),
            -int(item.get("page_number") or 0),
            -int(item.get("chunk_index") or 0),
        ),
        reverse=True,
    )
    return _apply_diversity(ranked, top_k=top_k)


def _lexical_search_contexts(
    db: Session,
    user_id: str,
    document_ids: Optional[List[str]],
    queries: List[str],
    top_k: int,
) -> List[Dict]:
    rows = (
        db.query(DocumentChunk, Document)
        .join(Document, Document.id == DocumentChunk.document_id)
        .filter(Document.user_id == user_id)
    )
    if document_ids:
        rows = rows.filter(Document.id.in_(document_ids))

    pairs = rows.order_by(Document.uploaded_at.desc(), DocumentChunk.page_number.asc(), DocumentChunk.chunk_index.asc()).all()
    scored = []
    for chunk, document in pairs:
        content = normalize_whitespace(chunk.text_content)
        if not content:
            continue
        score = max((_score_chunk(query, content) for query in queries), default=0.0)
        if score <= 0:
            continue
        scored.append(
            {
                "content": content,
                "document_id": document.id,
                "document_title": document.title,
                "page_number": chunk.page_number,
                "chunk_index": chunk.chunk_index,
                "relevance_score": score,
            }
        )
    scored.sort(key=lambda item: (item["relevance_score"], -item["page_number"], -item["chunk_index"]), reverse=True)
    return scored[:top_k]


def _score_hybrid_item(query: str, item: Dict, source: str) -> float:
    lexical_score = _score_chunk(query, item.get("content", ""))
    vector_score = float(item.get("relevance_score") or 0.0)
    source_bonus = 0.2 if source == "vector" else 0.1
    return round(vector_score * 0.65 + lexical_score * 0.9 + source_bonus, 4)


def _context_key(item: Dict) -> tuple:
    return (
        item.get("document_id"),
        int(item.get("page_number") or 0),
        int(item.get("chunk_index") or 0),
        normalize_whitespace(item.get("content", "")),
    )


def _apply_diversity(contexts: List[Dict], top_k: int = 5, max_per_document: int = 2, max_per_page: int = 1) -> List[Dict]:
    selected: List[Dict] = []
    document_counts: Counter = Counter()
    page_counts: Counter = Counter()

    for item in contexts:
        document_id = item.get("document_id")
        page_key = (document_id, item.get("page_number"))
        if document_counts[document_id] >= max_per_document:
            continue
        if page_counts[page_key] >= max_per_page:
            continue
        selected.append(item)
        document_counts[document_id] += 1
        page_counts[page_key] += 1
        if len(selected) >= top_k:
            return selected

    for item in contexts:
        if item in selected:
            continue
        selected.append(item)
        if len(selected) >= top_k:
            break
    return selected[:top_k]


def _top_keywords(text: str, limit: int = 8) -> List[str]:
    counts = Counter(_tokenize(text))
    return [token for token, _ in counts.most_common(limit)]


def _tail_overlap(parts: List[str], overlap_chars: int) -> List[str]:
    if not parts:
        return []

    tail: List[str] = []
    current = 0
    for sentence in reversed(parts):
        tail.insert(0, sentence)
        current += len(sentence) + 1
        if current >= overlap_chars:
            break
    return tail
