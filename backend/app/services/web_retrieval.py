"""Trusted and broad web retrieval helpers for agentic learning chat."""
from __future__ import annotations

import html
import re
from dataclasses import dataclass
from typing import Dict, List, Sequence, Tuple
from urllib.parse import quote, unquote

import requests


TAG_RE = re.compile(r"<[^>]+>")
WHITESPACE_RE = re.compile(r"\s+")
RESULT_LINK_RE = re.compile(r'<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="(?P<href>[^"]+)"[^>]*>(?P<title>.*?)</a>')
REDIRECT_RE = re.compile(r"uddg=([^&]+)")


def normalize_web_result(item: Dict, source_type: str) -> Dict:
    content = normalize_text(item.get("content", ""))
    return {
        "content": content,
        "document_id": None,
        "document_title": item.get("title", item.get("url", "Web source")),
        "page_number": None,
        "chunk_index": None,
        "relevance_score": float(item.get("relevance_score", 0.45)),
        "source_type": source_type,
        "url": item.get("url"),
        "excerpt": content[:220],
        "title": item.get("title", item.get("url", "Web source")),
    }


def rank_web_results(query: str, trusted_domains: Sequence[str], candidates: Sequence[Dict]) -> List[Dict]:
    ranked: List[Dict] = []
    for candidate in candidates:
        url = (candidate.get("url") or "").lower()
        source_type = "trusted_web" if any(domain.lower() in url for domain in trusted_domains) else "broader_web"
        ranked.append(normalize_web_result(candidate, source_type))

    return sorted(
        ranked,
        key=lambda item: (
            0 if item["source_type"] == "trusted_web" else 1,
            -float(item.get("relevance_score", 0.0)),
            len(item.get("content", "")) == 0,
        ),
    )


def retrieve_web_contexts(search_client, query: str, trusted_domains: Sequence[str]) -> Tuple[List[Dict], List[Dict]]:
    trusted = rank_web_results(query, trusted_domains, search_client.search_trusted(query))
    if trusted:
        return trusted, []

    broad = rank_web_results(query, trusted_domains, search_client.search_broad(query))
    return [], broad


def normalize_text(text: str) -> str:
    return WHITESPACE_RE.sub(" ", TAG_RE.sub(" ", html.unescape(text or ""))).strip()


@dataclass
class DuckDuckGoSearchClient:
    trusted_domains: Sequence[str]
    top_k: int = 4
    timeout: int = 8

    def search_trusted(self, query: str) -> List[Dict]:
        site_clause = " OR ".join(f"site:{domain}" for domain in self.trusted_domains)
        search_query = f"{query} {site_clause}".strip() if site_clause else query
        return self._search(search_query, trusted_only=True)

    def search_broad(self, query: str) -> List[Dict]:
        return self._search(query, trusted_only=False)

    def _search(self, query: str, trusted_only: bool) -> List[Dict]:
        search_url = f"https://html.duckduckgo.com/html/?q={quote(query)}"
        response = requests.get(
            search_url,
            headers={"User-Agent": "Mozilla/5.0 VydraCore/1.0"},
            timeout=self.timeout,
        )
        response.raise_for_status()

        results: List[Dict] = []
        for index, match in enumerate(RESULT_LINK_RE.finditer(response.text)):
            resolved = _resolve_duckduckgo_url(match.group("href"))
            if not resolved:
                continue
            if trusted_only and not any(domain.lower() in resolved.lower() for domain in self.trusted_domains):
                continue

            page_text = self._fetch_page_text(resolved)
            if not page_text:
                continue
            results.append(
                {
                    "title": normalize_text(match.group("title")),
                    "url": resolved,
                    "content": page_text,
                    "relevance_score": max(0.2, 1.0 - (index * 0.08)),
                }
            )
            if len(results) >= self.top_k:
                break
        return results

    def _fetch_page_text(self, url: str) -> str:
        try:
            response = requests.get(
                url,
                headers={"User-Agent": "Mozilla/5.0 VydraCore/1.0"},
                timeout=self.timeout,
            )
            response.raise_for_status()
            return normalize_text(response.text)[:2200]
        except Exception:
            return ""


def _resolve_duckduckgo_url(href: str) -> str:
    if href.startswith("http://") or href.startswith("https://"):
        return href

    redirect_match = REDIRECT_RE.search(href)
    if redirect_match:
        return unquote(redirect_match.group(1))
    return ""
