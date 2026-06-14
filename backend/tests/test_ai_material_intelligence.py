import os
import sys
import unittest

from fastapi.testclient import TestClient


CURRENT_DIR = os.path.dirname(__file__)
BACKEND_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.main import app  # noqa: E402
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

    def test_short_documents_receive_conservative_confidence(self):
        payload = build_material_intelligence(
            {"id": "doc-1", "title": "Short Notes"},
            [{"content": "Short text", "document_id": "doc-1", "document_title": "Short Notes", "page_number": 1, "chunk_index": 0, "relevance_score": 0.2}],
        )
        self.assertIn(payload["confidence"], {"low", "medium"})


class MaterialIntelligenceRouteTest(unittest.TestCase):
    def test_material_intelligence_route_exists(self):
        client = TestClient(app)
        response = client.get("/api/documents/example/material-intelligence")
        self.assertNotEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
