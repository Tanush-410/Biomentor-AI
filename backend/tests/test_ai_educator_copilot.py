import os
import sys
import unittest

from fastapi.testclient import TestClient


CURRENT_DIR = os.path.dirname(__file__)
BACKEND_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.main import app  # noqa: E402
from app.services.educator_copilot import (  # noqa: E402
    build_class_insights_copilot_payload,
    build_communication_copilot_payload,
    build_dashboard_copilot_payload,
)


class EducatorCopilotServiceTest(unittest.TestCase):
    def test_dashboard_payload_prioritizes_open_complaints_and_struggling_students(self):
        payload = build_dashboard_copilot_payload(
            student_snapshots=[
                {
                    "student_id": "student-1",
                    "student_name": "Tanush",
                    "classroom_id": "class-1",
                    "classroom_name": "Biology Lab",
                    "average_score": 54,
                    "risk": "high",
                    "top_gap": {"level": "Analyze"},
                }
            ],
            complaints=[
                {
                    "id": "complaint-1",
                    "subject": "Material not visible",
                    "content": "The PDF link does not open.",
                    "priority": "high",
                    "status": "open",
                    "student_name": "Tanush",
                    "classroom_name": "Biology Lab",
                }
            ],
            meeting_summaries=[
                {
                    "meeting_id": "meeting-1",
                    "classroom_id": "class-1",
                    "classroom_name": "Biology Lab",
                    "summary": "Students need a recap on osmosis.",
                    "action_items": ["Share the osmosis recap sheet."],
                    "follow_up_suggestions": ["Create a short osmosis checkpoint quiz."],
                }
            ],
        )

        self.assertGreaterEqual(len(payload["priorities"]), 2)
        self.assertIn("urgent item", payload["summary"])
        self.assertIn("Share the osmosis recap sheet.", payload["meeting_follow_ups"])
        self.assertTrue(payload["priorities"][0]["confidence_reason"])
        self.assertTrue(payload["priorities"][0]["why_now"])
        self.assertTrue(payload["priorities"][0]["recommended_window"])
        self.assertTrue(payload["intervention_plan"])

    def test_communication_payload_creates_reply_drafts(self):
        payload = build_communication_copilot_payload(
            messages=[
                {
                    "id": "message-1",
                    "subject": "Need help with quiz",
                    "sender_name": "Tanush",
                    "audience": "student",
                    "classroom_name": "Biology Lab",
                }
            ],
            complaints=[
                {
                    "id": "complaint-1",
                    "subject": "Material not visible",
                    "content": "The material link is broken for everyone in class.",
                    "priority": "high",
                    "status": "open",
                    "student_name": "Tanush",
                    "classroom_name": "Biology Lab",
                }
            ],
        )

        self.assertEqual(len(payload["drafts"]), 2)
        self.assertIn("open complaint", payload["queue_summary"][0])
        self.assertEqual(payload["drafts"][0]["handling_mode"], "private_then_classwide")
        self.assertTrue(payload["drafts"][0]["confidence_reason"])
        self.assertTrue(payload["drafts"][0]["draft_reason"])
        self.assertTrue(payload["drafts"][0]["escalation_signal"])

    def test_class_insights_payload_explains_trends_and_review_actions(self):
        payload = build_class_insights_copilot_payload(
            topic_trends=[
                {
                    "topic": "Analyze",
                    "mastery": 48.0,
                    "students_measured": 12,
                    "dominant_classroom": "Biology Lab",
                }
            ]
        )

        self.assertIn("weakest shared topic", payload["overview_summary"])
        self.assertEqual(payload["trend_explanations"][0]["topic"], "Analyze")
        self.assertEqual(payload["group_review_recommendations"][0]["classroom_name"], "Biology Lab")
        self.assertTrue(payload["group_review_recommendations"][0]["confidence_reason"])
        self.assertTrue(payload["trend_explanations"][0]["teaching_move"])
        self.assertTrue(payload["group_review_recommendations"][0]["review_sequence"])


class EducatorCopilotRouteTest(unittest.TestCase):
    def test_educator_copilot_routes_exist(self):
        client = TestClient(app)

        dashboard_response = client.get("/api/educator/copilot/dashboard")
        communication_response = client.get("/api/educator/copilot/communication")
        insights_response = client.get("/api/educator/copilot/class-insights")

        self.assertNotEqual(dashboard_response.status_code, 404)
        self.assertNotEqual(communication_response.status_code, 404)
        self.assertNotEqual(insights_response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
