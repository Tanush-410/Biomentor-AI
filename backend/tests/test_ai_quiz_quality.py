import os
import sys
import unittest

from fastapi.testclient import TestClient


CURRENT_DIR = os.path.dirname(__file__)
BACKEND_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.main import app  # noqa: E402
from app.services.quiz_quality import build_quiz_quality_review  # noqa: E402


class QuizQualityServiceTest(unittest.TestCase):
    def test_manual_quiz_review_flags_duplicate_options_and_missing_explanations(self):
        payload = build_quiz_quality_review(
            {
                "quiz_mode": "manual",
                "duration_minutes": 15,
                "proctoring_enabled": True,
                "manual_questions": [
                    {
                        "prompt": "Define osmosis briefly",
                        "bloom_level": 2,
                        "correct_option_id": "A",
                        "explanation": "",
                        "options": [
                            {"id": "A", "text": "Water movement"},
                            {"id": "B", "text": "Water movement"},
                            {"id": "C", "text": "Salt"},
                            {"id": "D", "text": "Cell"},
                        ],
                    }
                ],
            }
        )

        self.assertEqual(payload["readiness"], "revise")
        self.assertTrue(any(issue["severity"] == "high" for issue in payload["issues"]))
        self.assertTrue(payload["suggestions"])

    def test_generated_quiz_review_flags_missing_document_and_mixed_bloom(self):
        payload = build_quiz_quality_review(
            {
                "quiz_mode": "generated",
                "document_id": None,
                "num_questions": 2,
                "duration_minutes": 1,
                "proctoring_enabled": False,
            }
        )
        self.assertTrue(any(issue["severity"] == "high" for issue in payload["issues"]))
        self.assertGreaterEqual(payload["quality_score"], 42)
        self.assertIn("confidence", payload)

    def test_small_quiz_review_avoids_overclaiming(self):
        payload = build_quiz_quality_review(
            {
                "quiz_mode": "manual",
                "duration_minutes": 15,
                "proctoring_enabled": True,
                "manual_questions": [
                    {
                        "prompt": "What is osmosis?",
                        "bloom_level": 2,
                        "correct_option_id": "A",
                        "explanation": "It is water movement.",
                        "options": [
                            {"id": "A", "text": "Water movement"},
                            {"id": "B", "text": "Salt movement"},
                        ],
                    }
                ],
            }
        )
        self.assertEqual(payload["confidence"], "low")


class QuizQualityRouteTest(unittest.TestCase):
    def test_quiz_quality_route_exists(self):
        client = TestClient(app)
        response = client.post("/api/educator/quiz-quality/review", json={})
        self.assertNotEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
