import os
import sys
import unittest
from collections import Counter

from fastapi.testclient import TestClient


CURRENT_DIR = os.path.dirname(__file__)
BACKEND_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.main import app  # noqa: E402
from app.services.classroom_intelligence import (  # noqa: E402
    build_student_classroom_intelligence,
    build_teacher_classroom_intelligence,
)


class ClassroomIntelligenceServiceTest(unittest.TestCase):
    def test_teacher_payload_prioritizes_focus_and_actions(self):
        payload = build_teacher_classroom_intelligence(
            {
                "classroom": type("ClassroomObj", (), {"id": "class-1"})(),
                "student_snapshots": [
                    {
                        "student_id": "student-1",
                        "student_name": "Maya",
                        "average_score": 52.0,
                        "total_quizzes": 3,
                        "top_gaps": [{"level": "Analyze"}],
                        "risk": "high",
                    }
                ],
                "topic_counter": Counter({"Analyze": 2, "Apply": 1}),
                "materials": [],
                "assignments": [],
                "quizzes": [type("QuizObj", (), {"title": "Quiz 1"})()],
                "open_complaints": [object()],
                "latest_teacher_summary": None,
                "average_attempt_score": 58.0,
                "in_progress_attempts": [],
            }
        )
        self.assertIn("Analyze", payload["focus_topics"])
        self.assertTrue(payload["attention_signals"])
        self.assertTrue(payload["recommended_actions"])
        self.assertEqual(payload["focus_topic_details"][0]["status"], "confirmed")

    def test_student_payload_surfaces_personal_focus_and_next_steps(self):
        payload = build_student_classroom_intelligence(
            {
                "classroom": type("ClassroomObj", (), {"id": "class-1", "name": "Biology Lab"})(),
                "student_snapshots": [
                    {
                        "student_id": "student-1",
                        "student_name": "Maya",
                        "average_score": 52.0,
                        "total_quizzes": 3,
                        "top_gaps": [{"level": "Analyze"}],
                        "risk": "high",
                    }
                ],
                "topic_counter": Counter({"Analyze": 2, "Apply": 1}),
                "materials": [
                    (object(), type("Doc", (), {"id": "doc-1", "title": "Cell Biology Notes"})())
                ],
                "assignments": [type("Assignment", (), {"title": "Review Task"})()],
                "quizzes": [type("QuizObj", (), {"title": "Quiz 1", "status": "published"})()],
                "latest_student_summary": None,
            },
            current_user=type("UserObj", (), {"id": "student-1"})(),
        )
        self.assertEqual(payload["personalized_focus"], "Analyze")
        self.assertTrue(payload["next_steps"])

    def test_teacher_payload_marks_emerging_topics_when_data_is_thin(self):
        payload = build_teacher_classroom_intelligence(
            {
                "classroom": type("ClassroomObj", (), {"id": "class-1"})(),
                "student_snapshots": [],
                "topic_counter": Counter({"Analyze": 1}),
                "materials": [],
                "assignments": [],
                "quizzes": [],
                "open_complaints": [],
                "latest_teacher_summary": None,
                "average_attempt_score": None,
                "in_progress_attempts": [],
            }
        )
        self.assertEqual(payload["focus_topic_details"][0]["status"], "emerging")


class ClassroomIntelligenceRouteTest(unittest.TestCase):
    def test_classroom_intelligence_route_exists(self):
        client = TestClient(app)
        response = client.get("/api/classrooms/example/intelligence")
        self.assertNotEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
