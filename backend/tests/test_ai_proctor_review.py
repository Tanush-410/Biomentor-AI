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
        self.assertIn("evidence_posture_reason", payload)
        self.assertIn("review_priority", payload)
        self.assertIn("debarrment_guidance", payload)
        self.assertTrue(payload["follow_up_actions"])
        self.assertIn("evidence_snapshots", payload)
        self.assertIn("signal_breakdown", payload)
        self.assertIn("latest_decisive_signals", payload)
        self.assertIn("assessment_type", payload)
        self.assertIn("final_case_reason", payload)
        self.assertIn("teacher_review_required", payload)
        self.assertEqual(payload.get("assessment_type"), "quiz")
        self.assertEqual(payload.get("final_case_reason"), "ai_proctoring_debarred")
        self.assertTrue(payload.get("teacher_review_required"))
        self.assertGreaterEqual(payload["signal_breakdown"]["hard_rule"], 1)

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
        self.assertEqual(payload["signal_breakdown"]["heuristic"], 1)
        self.assertIn("heuristic", payload["evidence_posture_reason"].lower())

    def test_payload_limits_case_evidence_to_last_three_snapshots(self):
        payload = build_proctor_review_payload(
            quiz={"id": "quiz-3", "title": "Evidence Window"},
            incidents=[
                {
                    "id": "incident-1",
                    "student_id": "student-1",
                    "student_name": "Tanush",
                    "violation_type": "ai_looking_down",
                    "incident_type": "Possible phone or off-screen glance",
                    "severity": "medium",
                    "action_taken": "warning",
                    "details": {"evidence_image_url": "https://example.com/1.png"},
                    "created_at": "2026-05-31T10:00:00",
                },
                {
                    "id": "incident-2",
                    "student_id": "student-1",
                    "student_name": "Tanush",
                    "violation_type": "ai_face_missing",
                    "incident_type": "Face not visible",
                    "severity": "high",
                    "action_taken": "warning",
                    "details": {"evidence_image_url": "https://example.com/2.png"},
                    "created_at": "2026-05-31T10:01:00",
                },
                {
                    "id": "incident-3",
                    "student_id": "student-1",
                    "student_name": "Tanush",
                    "violation_type": "window_blur",
                    "incident_type": "Window lost focus",
                    "severity": "high",
                    "action_taken": "warning",
                    "details": {"evidence_image_url": "https://example.com/3.png"},
                    "created_at": "2026-05-31T10:02:00",
                },
                {
                    "id": "incident-4",
                    "student_id": "student-1",
                    "student_name": "Tanush",
                    "violation_type": "fullscreen_exit",
                    "incident_type": "Fullscreen exited",
                    "severity": "critical",
                    "action_taken": "terminated",
                    "details": {"evidence_image_url": "https://example.com/4.png"},
                    "created_at": "2026-05-31T10:03:00",
                },
            ],
            attempts=[
                {
                    "id": "attempt-1",
                    "student_id": "student-1",
                    "student_name": "Tanush",
                    "status": "terminated",
                    "violation_count": 4,
                    "termination_reason": "ai_proctoring_debarred",
                }
            ],
        )

        self.assertIn("evidence_snapshots", payload)
        self.assertEqual(len(payload.get("evidence_snapshots", [])), 3)
        self.assertEqual(payload.get("evidence_snapshots", [{}])[0].get("image_url"), "https://example.com/4.png")


class ProctorReviewRouteTest(unittest.TestCase):
    def test_proctor_review_route_exists(self):
        client = TestClient(app)
        response = client.get("/api/classrooms/example/quizzes/example/proctor-review")
        self.assertNotEqual(response.status_code, 404)

    def test_anticheat_bot_route_exists(self):
        client = TestClient(app)
        response = client.get("/api/classrooms/example/anticheat-bot")
        self.assertNotEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
