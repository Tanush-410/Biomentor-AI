import os
import sys
import unittest
from datetime import datetime
from types import SimpleNamespace


CURRENT_DIR = os.path.dirname(__file__)
BACKEND_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.core.config import settings  # noqa: E402
from app.routers.qa import (  # noqa: E402
    build_answer_response,
    evaluate_quick_check_submission,
)
from app.schemas import (  # noqa: E402
    AnswerGenerationRequest,
    AnswerGenerationResponse,
    QuickCheckEvaluationRequest,
)
from app.services.web_retrieval import (  # noqa: E402
    rank_web_results,
    retrieve_web_contexts,
)


class FakeWebSearchClient:
    def __init__(self, trusted_results=None, broad_results=None):
        self._trusted_results = trusted_results or []
        self._broad_results = broad_results or []

    def search_trusted(self, _query):
        return self._trusted_results

    def search_broad(self, _query):
        return self._broad_results


class AgenticLearningChatSchemaTests(unittest.TestCase):
    def test_answer_generation_response_exposes_agentic_fields(self):
        response = AnswerGenerationResponse(
            question="What is photosynthesis?",
            answer="Plants convert light into stored chemical energy.",
            sources=[],
            confidence=0.72,
            confidence_label="high",
            confidence_reason="Evidence is strong and well-aligned.",
            answer_origin="material",
            source_badge="Answered from your material",
            fallback_used=False,
            complexity="moderate",
            show_quick_check=True,
            quick_check={
                "id": "qc-1",
                "title": "Quick Check",
                "questions": [],
            },
            generated_at=datetime.utcnow(),
        )

        self.assertEqual(response.answer_origin, "material")
        self.assertEqual(response.confidence_label, "high")
        self.assertEqual(response.source_badge, "Answered from your material")
        self.assertEqual(response.complexity, "moderate")
        self.assertTrue(response.show_quick_check)
        self.assertEqual(response.quick_check.id, "qc-1")

    def test_settings_expose_trusted_search_domains(self):
        self.assertIsInstance(settings.trusted_search_domains, list)
        self.assertGreater(len(settings.trusted_search_domains), 0)
        self.assertIsInstance(settings.web_fallback_top_k, int)


class AgenticLearningChatRetrievalTests(unittest.TestCase):
    def test_rank_web_results_prefers_trusted_domains(self):
        results = rank_web_results(
            query="cell respiration",
            trusted_domains=["nih.gov"],
            candidates=[
                {"title": "Random blog", "url": "https://example.com/post", "content": "blog"},
                {"title": "NIH overview", "url": "https://www.nih.gov/test", "content": "trusted"},
            ],
        )

        self.assertEqual(results[0]["source_type"], "trusted_web")
        self.assertEqual(results[1]["source_type"], "broader_web")

    def test_broad_retrieval_runs_when_trusted_results_are_empty(self):
        client = FakeWebSearchClient(
            trusted_results=[],
            broad_results=[{"title": "Fallback", "url": "https://example.com", "content": "fallback"}],
        )

        trusted, broad = retrieve_web_contexts(client, "osmosis", ["nih.gov"])

        self.assertEqual(trusted, [])
        self.assertEqual(len(broad), 1)
        self.assertEqual(broad[0]["source_type"], "broader_web")


class AgenticLearningChatAnswerTests(unittest.TestCase):
    def setUp(self):
        self.user = SimpleNamespace(id="user-1")
        self.request = AnswerGenerationRequest(question="What is photosynthesis?", include_sources=True)
        self.document_context = {
            "content": "Photosynthesis is the process by which green plants use sunlight to synthesize food from carbon dioxide and water.",
            "document_id": "doc-1",
            "document_title": "Plant Notes",
            "page_number": 4,
            "chunk_index": 0,
            "relevance_score": 0.91,
        }
        self.web_context = {
            "content": "Photosynthesis uses light energy to make glucose from carbon dioxide and water, releasing oxygen as a by-product.",
            "document_id": None,
            "document_title": "Britannica",
            "page_number": None,
            "chunk_index": None,
            "relevance_score": 0.78,
            "source_type": "trusted_web",
            "url": "https://www.britannica.com/science/photosynthesis",
        }

    def test_answer_origin_is_material_when_document_context_is_sufficient(self):
        response = build_answer_response(
            None,
            self.user,
            self.request,
            retrieve_fn=lambda *args, **kwargs: [self.document_context],
            web_search_fn=lambda *args, **kwargs: ([], []),
        )

        self.assertEqual(response.answer_origin, "material")
        self.assertGreater(response.confidence, 0.5)
        self.assertEqual(response.confidence_label, "high")
        self.assertFalse(response.fallback_used)

    def test_answer_origin_is_web_enhanced_when_document_context_is_missing(self):
        response = build_answer_response(
            None,
            self.user,
            self.request,
            retrieve_fn=lambda *args, **kwargs: [],
            web_search_fn=lambda *args, **kwargs: ([self.web_context], []),
        )

        self.assertEqual(response.answer_origin, "trusted_web")
        self.assertGreaterEqual(len(response.sources), 1)
        self.assertEqual(response.sources[0].document_title, "Britannica")
        self.assertEqual(response.source_badge, "Enhanced with trusted web sources")

    def test_answer_uses_safe_language_when_confidence_is_low(self):
        weak_context = {
            "content": "short",
            "document_id": "doc-2",
            "document_title": "Sparse Notes",
            "page_number": 1,
            "chunk_index": 0,
            "relevance_score": 0.12,
        }

        response = build_answer_response(
            None,
            self.user,
            self.request,
            retrieve_fn=lambda *args, **kwargs: [weak_context],
            web_search_fn=lambda *args, **kwargs: ([], []),
        )

        self.assertEqual(response.confidence_label, "low")
        self.assertTrue(response.fallback_used)
        self.assertIn("not fully confident", response.answer.lower())


class AgenticLearningChatQuickCheckTests(unittest.TestCase):
    def setUp(self):
        self.quick_check = {
            "id": "qc-1",
            "title": "Quick Check",
            "questions": [
                {
                    "id": "q1",
                    "prompt": "What is photosynthesis mainly used for?",
                    "options": [
                        {"id": "a", "text": "Making food"},
                        {"id": "b", "text": "Breaking bones"},
                    ],
                    "correct_option_id": "a",
                    "explanation": "Photosynthesis helps plants make food.",
                },
                {
                    "id": "q2",
                    "prompt": "Which input is required?",
                    "options": [
                        {"id": "a", "text": "Moonlight"},
                        {"id": "b", "text": "Sunlight"},
                    ],
                    "correct_option_id": "b",
                    "explanation": "Sunlight provides the energy for the process.",
                },
            ],
        }

    def test_quick_check_evaluation_returns_score_and_next_step(self):
        payload = QuickCheckEvaluationRequest(
            quick_check_id="qc-1",
            quick_check=self.quick_check,
            answers=[
                {"question_id": "q1", "selected_option_id": "a"},
                {"question_id": "q2", "selected_option_id": "a"},
            ],
        )

        response = evaluate_quick_check_submission(payload)

        self.assertEqual(response.score, 1)
        self.assertEqual(response.total_questions, 2)
        self.assertEqual(len(response.results), 2)
        self.assertTrue(response.next_step)


if __name__ == "__main__":
    unittest.main()
