import importlib
import os
import sys
import unittest

from fastapi.testclient import TestClient


CURRENT_DIR = os.path.dirname(__file__)
BACKEND_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.main import app  # noqa: E402


class ClassroomExamRouteTest(unittest.TestCase):
    def test_exam_routes_exist(self):
        client = TestClient(app)
        routes = [
            ("GET", "/api/classrooms/example-classroom/exams"),
            ("POST", "/api/classrooms/example-classroom/exams"),
            ("POST", "/api/classrooms/example-classroom/exams/draft"),
            ("GET", "/api/classrooms/example-classroom/exams/example-exam"),
            ("GET", "/api/classrooms/example-classroom/exams/example-exam/review"),
            ("GET", "/api/classrooms/example-classroom/exams/example-exam/review/example-attempt"),
            ("POST", "/api/classrooms/example-classroom/exams/example-exam/review/example-attempt"),
            ("POST", "/api/classrooms/example-classroom/exams/example-exam/start"),
            ("POST", "/api/classrooms/example-classroom/exams/example-exam/submit"),
            ("POST", "/api/classrooms/example-classroom/exams/example-exam/warning"),
            ("POST", "/api/classrooms/example-classroom/exams/example-exam/violation"),
            ("GET", "/api/classrooms/example-classroom/anticheat-bot"),
            ("GET", "/api/classrooms/example-classroom/anticheat-bot/example-case"),
            ("GET", "/api/classrooms/example-classroom/anticheat-bot/example-case/evidence/example-evidence/image"),
            ("POST", "/api/classrooms/example-classroom/anticheat-bot/example-case/uphold"),
            ("POST", "/api/classrooms/example-classroom/anticheat-bot/example-case/excuse"),
            ("POST", "/api/classrooms/example-classroom/anticheat-bot/example-case/reopen"),
        ]

        for method, path in routes:
            if method == "POST":
                response = client.post(path, json={})
            else:
                response = client.get(path)
            self.assertNotEqual(response.status_code, 404, f"{method} {path} should exist")


class ClassroomExamServiceContractTest(unittest.TestCase):
    def test_exam_authoring_service_module_exists(self):
        self.assertIsNotNone(importlib.util.find_spec("app.services.exam_authoring"))

    def test_exam_grading_service_module_exists(self):
        self.assertIsNotNone(importlib.util.find_spec("app.services.exam_grading"))

    def test_exam_review_service_module_exists(self):
        self.assertIsNotNone(importlib.util.find_spec("app.services.exam_review"))

    def test_anticheat_bot_service_module_exists(self):
        self.assertIsNotNone(importlib.util.find_spec("app.services.anticheat_bot"))

    def test_exam_drafting_service_module_exists(self):
        self.assertIsNotNone(importlib.util.find_spec("app.services.exam_drafting"))


if __name__ == "__main__":
    unittest.main()
