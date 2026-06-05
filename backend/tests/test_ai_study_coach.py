import os
import sys
import unittest

from fastapi.testclient import TestClient


CURRENT_DIR = os.path.dirname(__file__)
BACKEND_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.main import app  # noqa: E402
from app.services.study_coach import (  # noqa: E402
    build_study_coach_chat_payload,
    build_study_coach_materials_payload,
    build_study_coach_overview,
    build_study_coach_progress_payload,
)


class StudyCoachServiceTest(unittest.TestCase):
    def test_overview_payload_prioritizes_next_action_and_short_plan(self):
        payload = build_study_coach_overview(
            progress_payload={
                "averageScore": 58,
                "totalQuizzes": 3,
                "totalQuestionsAnswered": 18,
                "bloomLevelStats": {
                    4: {"name": "Analyze", "count": 8, "average": 42},
                    2: {"name": "Understand", "count": 5, "average": 64},
                },
                "recentQuizzes": [],
            },
            recommendations={
                "immediate": ["Review Analyze questions first."],
                "short_term": ["Retry a Bloom quiz tomorrow."],
                "next_steps": ["Ask Learning Chat to compare two concepts."],
            },
            documents=[],
        )
        self.assertIn("next_action", payload)
        self.assertGreaterEqual(len(payload["short_plan"]), 2)
        self.assertIn("Analyze", payload["weak_focus_areas"])
        self.assertIn("study_mode", payload)
        self.assertIn("daily_goal", payload)
        self.assertIn("weekly_plan", payload)
        self.assertIn("recovery_path", payload)

    def test_material_recommendation_prefers_uploaded_pdf_when_gaps_exist(self):
        payload = build_study_coach_materials_payload(
            documents=[{"id": "doc-1", "title": "Cell Biology Notes", "file_name": "cell.pdf"}],
            gap_list=[{"level": "Analyze", "gap_percentage": 58.0}],
        )
        self.assertEqual(payload["recommendations"][0]["document_id"], "doc-1")
        self.assertGreaterEqual(len(payload["recommendations"]), 1)
        self.assertIn("sequence_reason", payload)

    def test_chat_suggestions_offer_follow_up_prompts_and_quick_check_guidance(self):
        payload = build_study_coach_chat_payload(
            gap_list=[{"level": "Analyze", "gap_percentage": 58.0}],
            documents=[{"id": "doc-1", "title": "Cell Biology Notes"}],
        )
        self.assertTrue(payload["follow_up_prompts"])
        self.assertIn("Quick Check", payload["quick_check_guidance"])
        self.assertIn("checkpoint_goal", payload)

    def test_progress_payload_explains_practice_order(self):
        payload = build_study_coach_progress_payload(
            {
                "bloomLevelStats": {
                    4: {"name": "Analyze", "count": 8, "average": 42},
                    2: {"name": "Understand", "count": 5, "average": 64},
                }
            }
        )
        self.assertIn("Analyze", payload["practice_order"])
        self.assertIn("study_mode", payload)
        self.assertIn("mode_reason", payload)
        self.assertIn("checkpoint_goal", payload)

    def test_sparse_progress_avoids_overpersonalizing(self):
        payload = build_study_coach_progress_payload({"averageScore": 0, "bloomLevelStats": {}})
        self.assertIn("first quiz", payload["summary"].lower())
        self.assertEqual(payload["confidence"], "low")

    def test_overview_assigns_reinforcement_mode_for_low_mastery(self):
        payload = build_study_coach_overview(
            progress_payload={
                "averageScore": 41,
                "totalQuizzes": 4,
                "bloomLevelStats": {
                    4: {"name": "Analyze", "count": 8, "average": 35},
                    2: {"name": "Understand", "count": 5, "average": 58},
                },
            },
            recommendations={"immediate": [], "short_term": [], "next_steps": []},
            documents=[{"id": "doc-1", "title": "Cell Biology Notes"}],
        )
        self.assertEqual(payload["study_mode"], "reinforcement")
        self.assertTrue(payload["daily_goal"]["label"])


class StudyCoachRouteTest(unittest.TestCase):
    def test_study_coach_routes_exist(self):
        client = TestClient(app)
        self.assertNotEqual(client.get("/api/study-coach/overview").status_code, 404)
        self.assertNotEqual(client.get("/api/study-coach/progress").status_code, 404)
        self.assertNotEqual(client.get("/api/study-coach/materials").status_code, 404)
        self.assertNotEqual(client.get("/api/study-coach/chat-suggestions").status_code, 404)


if __name__ == "__main__":
    unittest.main()
