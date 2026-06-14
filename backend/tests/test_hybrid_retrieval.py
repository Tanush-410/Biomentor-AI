import os
import sys
import unittest


CURRENT_DIR = os.path.dirname(__file__)
BACKEND_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.services.document_context import (  # noqa: E402
    build_query_candidates,
    merge_context_results,
)
from app.agents.question_generator import QuestionGenerator  # noqa: E402


class HybridRetrievalTest(unittest.TestCase):
    def test_build_query_candidates_expands_short_follow_up(self):
        history = [
            {"role": "user", "content": "Explain the dining philosopher problem"},
            {"role": "assistant", "content": "The dining philosopher problem is a deadlock and starvation coordination problem in operating systems."},
        ]

        candidates = build_query_candidates("shorter", history)

        self.assertGreaterEqual(len(candidates), 2)
        self.assertEqual(candidates[0], "shorter")
        self.assertTrue(any("dining philosopher problem" in candidate.lower() for candidate in candidates[1:]))

    def test_build_query_candidates_handles_topic_follow_up(self):
        history = [
            {"role": "user", "content": "Explain deadlock in dining philosophers"},
            {"role": "assistant", "content": "Deadlock happens when each philosopher holds one chopstick and waits forever for the other."},
        ]

        candidates = build_query_candidates("what about starvation?", history)

        self.assertGreaterEqual(len(candidates), 2)
        self.assertTrue(any("deadlock" in candidate.lower() or "philosopher" in candidate.lower() for candidate in candidates[1:]))

    def test_merge_context_results_dedupes_and_prefers_diverse_sources(self):
        vector_results = [
            {
                "content": "Deadlock happens when every philosopher waits forever.",
                "document_id": "doc-a",
                "document_title": "OS Notes",
                "page_number": 10,
                "chunk_index": 0,
                "relevance_score": 0.92,
            },
            {
                "content": "Deadlock happens when every philosopher waits forever.",
                "document_id": "doc-a",
                "document_title": "OS Notes",
                "page_number": 10,
                "chunk_index": 0,
                "relevance_score": 0.89,
            },
        ]
        lexical_results = [
            {
                "content": "Starvation means a philosopher may never get both chopsticks.",
                "document_id": "doc-a",
                "document_title": "OS Notes",
                "page_number": 11,
                "chunk_index": 1,
                "relevance_score": 0.61,
            },
            {
                "content": "Semaphores can coordinate pickup and putdown operations.",
                "document_id": "doc-b",
                "document_title": "Concurrent Systems",
                "page_number": 3,
                "chunk_index": 0,
                "relevance_score": 0.58,
            },
        ]

        merged = merge_context_results(
            "Explain deadlock and starvation in dining philosophers",
            vector_results,
            lexical_results,
            top_k=3,
        )

        self.assertEqual(len(merged), 3)
        unique_keys = {
            (item["document_id"], item["page_number"], item["chunk_index"], item["content"])
            for item in merged
        }
        self.assertEqual(len(unique_keys), 3)
        self.assertTrue(any(item["document_id"] == "doc-b" for item in merged))

    def test_select_source_contexts_avoids_repeated_pages(self):
        contexts = [
            {
                "content": "Deadlock happens when each philosopher waits while holding one chopstick.",
                "document_id": "doc-a",
                "document_title": "OS Notes",
                "page_number": 8,
                "chunk_index": 0,
                "relevance_score": 0.9,
            },
            {
                "content": "Deadlock happens when each philosopher waits while holding one chopstick.",
                "document_id": "doc-a",
                "document_title": "OS Notes",
                "page_number": 8,
                "chunk_index": 1,
                "relevance_score": 0.88,
            },
            {
                "content": "Starvation means a philosopher may never get both chopsticks.",
                "document_id": "doc-a",
                "document_title": "OS Notes",
                "page_number": 9,
                "chunk_index": 0,
                "relevance_score": 0.76,
            },
            {
                "content": "A semaphore solution uses pickup and putdown operations controlled by a monitor.",
                "document_id": "doc-b",
                "document_title": "Concurrent Systems",
                "page_number": 3,
                "chunk_index": 0,
                "relevance_score": 0.7,
            },
        ]

        selected = QuestionGenerator.select_source_contexts(contexts, max_items=3)

        self.assertEqual(len(selected), 3)
        self.assertEqual(len({(item["document_id"], item["page_number"]) for item in selected}), 3)
        self.assertTrue(any(item["document_id"] == "doc-b" for item in selected))


if __name__ == "__main__":
    unittest.main()
