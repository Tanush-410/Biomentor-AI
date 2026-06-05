import os
import sys
import unittest

from fastapi.testclient import TestClient


CURRENT_DIR = os.path.dirname(__file__)
BACKEND_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.main import app  # noqa: E402
from app.services.proctor_review import build_proctor_review_payload  # noqa: E402


class ProctorReviewServiceTest(unittest.TestCase):
    def test_payload_prioritizes_terminated_attempts_and_recommendations(self):
        payload = build_proctor_review_payload(
            quiz={"id": "quiz-1", "title": "Cell Division Checkpoint"},
            incidents=[
                {
                    "id": "incident-1",
                    "student_id": "student-1",
                    "student_name": "Tanush",
                    "violation_type": "ai_multiple_faces",
                    "incident_type": "Multiple faces detected",
                    "severity": "high",
                    "action_taken": "warning",
                    "details": {},
                    "created_at": "2026-05-31T10:00:00",
                },
                {
                    "id": "incident-2",
                    "student_id": "student-1",
                    "student_name": "Tanush",
                    "violation_type": "fullscreen_exit",
                    "incident_type": "Fullscreen exited",
                    "severity": "critical",
                    "action_taken": "terminated",
                    "details": {},
                    "created_at": "2026-05-31T10:02:00",
                },
            ],
            attempts=[
                {
                    "id": "attempt-1",
                    "student_id": "student-1",
                    "student_name": "Tanush",
                    "status": "terminated",
                    "violation_count": 3,
                    "termination_reason": "ai_proctoring_debarred",
                }
            ],
        )

        self.assertEqual(payload["overall_severity"], "critical")
        self.assertEqual(payload["student_summaries"][0]["attempt_status"], "terminated")
        self.assertTrue(payload["educator_recommendations"])
        self.assertIn("terminated", payload["review_summary"])
        self.assertIn("confidence_reason", payload)
        self.assertIn("case_posture", payload)
        self.assertIn("evidence_strength", payload)
        self.assertIn("review_priority", payload)
        self.assertIn("debarrment_guidance", payload)
        self.assertTrue(payload["follow_up_actions"])

    def test_heuristic_only_incidents_require_review_language(self):
        payload = build_proctor_review_payload(
            quiz={"id": "quiz-2", "title": "Heuristic Check"},
            incidents=[
                {
                    "id": "incident-1",
                    "student_id": "student-1",
                    "student_name": "Tanush",
                    "violation_type": "ai_looking_down",
                    "incident_type": "Possible phone or off-screen glance",
                    "severity": "medium",
                    "action_taken": "warning",
                    "details": {},
                    "created_at": "2026-05-31T10:00:00",
                },
            ],
            attempts=[
                {
                    "id": "attempt-1",
                    "student_id": "student-1",
                    "student_name": "Tanush",
                    "status": "submitted",
                    "violation_count": 1,
                    "termination_reason": None,
                }
            ],
        )
        joined = " ".join(payload["educator_recommendations"]).lower()
        self.assertIn("review", joined)
        self.assertEqual(payload["case_posture"], "review_required")
        self.assertIn(payload["evidence_strength"], {"mixed", "limited"})
        self.assertTrue(payload["follow_up_actions"])


class ProctorReviewRouteTest(unittest.TestCase):
    def test_proctor_review_route_exists(self):
        client = TestClient(app)
        response = client.get("/api/classrooms/example/quizzes/example/proctor-review")
        self.assertNotEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
