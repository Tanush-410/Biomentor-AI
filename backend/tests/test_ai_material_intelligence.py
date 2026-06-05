import os
import sys
import unittest

from fastapi.testclient import TestClient


CURRENT_DIR = os.path.dirname(__file__)
BACKEND_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.main import app  # noqa: E402
from app.schemas import MaterialIntelligenceResponse  # noqa: E402
from app.services.material_intelligence import build_material_intelligence  # noqa: E402


class MaterialIntelligenceServiceTest(unittest.TestCase):
    def test_material_intelligence_returns_summary_glossary_and_flashcards(self):
        payload = build_material_intelligence(
            {"id": "doc-1", "title": "Cell Biology Notes"},
            [
                {
                    "content": "Mitochondria produce ATP and are known as the powerhouse of the cell. ATP supports cell energy transfer.",
                    "document_id": "doc-1",
                    "document_title": "Cell Biology Notes",
                    "page_number": 2,
                    "chunk_index": 0,
                    "relevance_score": 0.9,
                }
            ],
        )

        self.assertIn("summary", payload)
        self.assertTrue(payload["glossary"])
        self.assertTrue(payload["flashcards"])
        self.assertTrue(payload["follow_up_prompts"])
        self.assertIn("confidence", payload)
        self.assertIn("layered_summaries", payload)
        self.assertIn("concept_map", payload)
        self.assertIn("misconception_traps", payload)
        self.assertIn("viva_questions", payload)
        self.assertIn("study_path", payload)
        self.assertTrue(payload["layered_summaries"]["quick"])

    def test_short_documents_receive_conservative_confidence(self):
        payload = build_material_intelligence(
            {"id": "doc-1", "title": "Short Notes"},
            [{"content": "Short text", "document_id": "doc-1", "document_title": "Short Notes", "page_number": 1, "chunk_index": 0, "relevance_score": 0.2}],
        )
        self.assertIn(payload["confidence"], {"low", "medium"})

    def test_material_intelligence_builds_layered_outputs_from_context(self):
        payload = build_material_intelligence(
            {"id": "doc-1", "title": "Cell Biology Notes"},
            [
                {
                    "content": "Mitochondria produce ATP for cellular energy. Ribosomes build proteins. Enzymes lower activation energy.",
                    "document_id": "doc-1",
                    "document_title": "Cell Biology Notes",
                    "page_number": 2,
                    "chunk_index": 0,
                    "relevance_score": 0.9,
                }
            ],
        )
        self.assertGreaterEqual(len(payload["concept_map"]), 1)
        self.assertGreaterEqual(len(payload["misconception_traps"]), 1)
        self.assertGreaterEqual(len(payload["viva_questions"]), 1)
        self.assertGreaterEqual(len(payload["study_path"]), 1)


class MaterialIntelligenceRouteTest(unittest.TestCase):
    def test_material_intelligence_route_exists(self):
        client = TestClient(app)
        response = client.get("/api/documents/example/material-intelligence")
        self.assertNotEqual(response.status_code, 404)

    def test_material_intelligence_response_model_accepts_new_fields(self):
        payload = MaterialIntelligenceResponse(
            document_id="doc-1",
            document_title="Cell Biology Notes",
            summary="Document summary",
            layered_summaries={"quick": "Quick", "standard": "Standard", "exam_focus": "Exam"},
            concept_map=[{"label": "ATP", "importance": "core", "connects_to": ["Energy"]}],
            misconception_traps=[{"concept": "ATP", "trap": "Trap", "correction": "Correction"}],
            viva_questions=[{"question": "What is ATP?", "expected_focus": "Energy transfer"}],
            study_path=[{"label": "Review ATP", "reason": "Foundation for energy questions"}],
        )
        self.assertEqual(payload.document_id, "doc-1")


if __name__ == "__main__":
    unittest.main()
