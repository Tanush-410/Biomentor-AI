import os
import sys
import unittest

from fastapi.testclient import TestClient


CURRENT_DIR = os.path.dirname(__file__)
BACKEND_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.main import app  # noqa: E402
from app.database.models import (  # noqa: E402
    ClassroomAnnouncement,
    ClassroomAssignment,
    ClassroomQuiz,
    ClassroomQuizAttempt,
    ClassroomQuizViolation,
    ClassroomMaterial,
    ClassroomMessageThread,
    ClassroomThreadMessage,
    Notification,
)


class ClassroomModelSmokeTest(unittest.TestCase):
    def test_new_classroom_models_exist(self):
        self.assertIsNotNone(ClassroomAnnouncement)
        self.assertIsNotNone(ClassroomAssignment)
        self.assertIsNotNone(ClassroomQuiz)
        self.assertIsNotNone(ClassroomQuizAttempt)
        self.assertIsNotNone(ClassroomQuizViolation)
        self.assertIsNotNone(ClassroomMaterial)
        self.assertIsNotNone(ClassroomMessageThread)
        self.assertIsNotNone(ClassroomThreadMessage)
        self.assertIsNotNone(Notification)


class ClassroomRouteTest(unittest.TestCase):
    def test_classroom_routes_exist(self):
        client = TestClient(app)
        list_response = client.get("/api/classrooms")
        detail_response = client.get("/api/classrooms/example-classroom")
        quizzes_response = client.get("/api/classrooms/example-classroom/quizzes")
        quiz_detail_response = client.get("/api/classrooms/example-classroom/quizzes/example-quiz")
        self.assertNotEqual(list_response.status_code, 404)
        self.assertNotEqual(detail_response.status_code, 404)
        self.assertNotEqual(quizzes_response.status_code, 404)
        self.assertNotEqual(quiz_detail_response.status_code, 404)

    def test_classroom_quiz_post_routes_exist(self):
        client = TestClient(app)
        create_response = client.post("/api/classrooms/example-classroom/quizzes", json={})
        start_response = client.post("/api/classrooms/example-classroom/quizzes/example-quiz/start", json={})
        submit_response = client.post("/api/classrooms/example-classroom/quizzes/example-quiz/submit", json={})
        violation_response = client.post("/api/classrooms/example-classroom/quizzes/example-quiz/violation", json={})
        self.assertNotEqual(create_response.status_code, 404)
        self.assertNotEqual(start_response.status_code, 404)
        self.assertNotEqual(submit_response.status_code, 404)
        self.assertNotEqual(violation_response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
