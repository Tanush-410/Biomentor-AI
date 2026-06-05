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
        self.assertIn("assessment_focus", payload)
        self.assertIn("release_risk", payload)
        self.assertTrue(payload["question_health"])
        self.assertTrue(payload["fix_first"])
        self.assertTrue(payload["remediation_plan"])

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
        self.assertIn(payload["release_risk"], {"low", "medium", "high"})
        self.assertTrue(payload["remediation_plan"])

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

    def test_manual_quiz_review_builds_actionable_question_health(self):
        payload = build_quiz_quality_review(
            {
                "quiz_mode": "manual",
                "duration_minutes": 12,
                "proctoring_enabled": True,
                "manual_questions": [
                    {
                        "prompt": "Define diffusion briefly",
                        "bloom_level": 2,
                        "correct_option_id": "A",
                        "explanation": "",
                        "options": [
                            {"id": "A", "text": "Movement of particles from high concentration to low concentration"},
                            {"id": "B", "text": "Movement of particles from high concentration to low concentration"},
                            {"id": "C", "text": "Cell wall"},
                            {"id": "D", "text": "ATP"},
                        ],
                    },
                    {
                        "prompt": "Explain how osmosis differs from diffusion in one case.",
                        "bloom_level": 3,
                        "correct_option_id": "B",
                        "explanation": "Osmosis specifically concerns water movement across a selectively permeable membrane.",
                        "options": [
                            {"id": "A", "text": "It is always active transport."},
                            {"id": "B", "text": "It focuses on water movement through a selectively permeable membrane."},
                            {"id": "C", "text": "It never occurs in cells."},
                            {"id": "D", "text": "It happens only in animals."},
                        ],
                    },
                ],
            }
        )
        self.assertTrue(any(item["question_number"] == 1 for item in payload["question_health"]))
        self.assertTrue(any(item["status"] in {"revise", "watch"} for item in payload["question_health"]))
        self.assertTrue(any("question" in item["title"].lower() or "distractor" in item["title"].lower() for item in payload["fix_first"]))


class QuizQualityRouteTest(unittest.TestCase):
    def test_quiz_quality_route_exists(self):
        client = TestClient(app)
        response = client.post("/api/educator/quiz-quality/review", json={})
        self.assertNotEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
