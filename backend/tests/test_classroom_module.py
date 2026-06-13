import os
import sys
import unittest
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient


CURRENT_DIR = os.path.dirname(__file__)
BACKEND_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.main import app  # noqa: E402
from app.routers.classrooms import resolve_quiz_status, serialize_utc_datetime  # noqa: E402
from app.database import models  # noqa: E402
from app.database.models import (  # noqa: E402
    ClassroomAnnouncement,
    ClassroomAssignment,
    ClassroomCertification,
    ClassroomCertificationEnrollment,
    ClassroomCertificationStep,
    ClassroomCertificationStepProgress,
    ClassroomQuiz,
    ClassroomQuizAttempt,
    ClassroomQuizViolation,
    ClassroomMaterial,
    ClassroomMessageThread,
    ClassroomThreadMessage,
    CertificationProofSubmission,
    IssuedCertificate,
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
        self.assertIsNotNone(ClassroomCertification)
        self.assertIsNotNone(ClassroomCertificationStep)
        self.assertIsNotNone(ClassroomCertificationEnrollment)
        self.assertIsNotNone(ClassroomCertificationStepProgress)
        self.assertIsNotNone(CertificationProofSubmission)
        self.assertIsNotNone(IssuedCertificate)

    def test_exam_and_anticheat_models_exist(self):
        self.assertTrue(hasattr(models, "ClassroomExam"))
        self.assertTrue(hasattr(models, "ClassroomExamBlock"))
        self.assertTrue(hasattr(models, "ClassroomExamQuestion"))
        self.assertTrue(hasattr(models, "ClassroomExamAttempt"))
        self.assertTrue(hasattr(models, "ClassroomExamResponse"))
        self.assertTrue(hasattr(models, "AssessmentAnticheatCase"))
        self.assertTrue(hasattr(models, "AssessmentAnticheatEvidence"))


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

    def test_classroom_exam_routes_exist(self):
        client = TestClient(app)
        list_response = client.get("/api/classrooms/example-classroom/exams")
        detail_response = client.get("/api/classrooms/example-classroom/exams/example-exam")
        create_response = client.post("/api/classrooms/example-classroom/exams", json={})
        start_response = client.post("/api/classrooms/example-classroom/exams/example-exam/start", json={})
        submit_response = client.post("/api/classrooms/example-classroom/exams/example-exam/submit", json={})
        warning_response = client.post("/api/classrooms/example-classroom/exams/example-exam/warning", json={})
        violation_response = client.post("/api/classrooms/example-classroom/exams/example-exam/violation", json={})
        anti_cheat_response = client.get("/api/classrooms/example-classroom/anticheat-bot")
        self.assertNotEqual(list_response.status_code, 404)
        self.assertNotEqual(detail_response.status_code, 404)
        self.assertNotEqual(create_response.status_code, 404)
        self.assertNotEqual(start_response.status_code, 404)
        self.assertNotEqual(submit_response.status_code, 404)
        self.assertNotEqual(warning_response.status_code, 404)
        self.assertNotEqual(violation_response.status_code, 404)
        self.assertNotEqual(anti_cheat_response.status_code, 404)

    def test_classroom_certification_routes_exist(self):
        client = TestClient(app)
        list_response = client.get("/api/classrooms/example-classroom/certifications")
        create_response = client.post("/api/classrooms/example-classroom/certifications", json={})
        draft_response = client.post("/api/classrooms/example-classroom/certifications/draft", json={})
        detail_response = client.get("/api/classrooms/example-classroom/certifications/example-certification")
        roster_response = client.get("/api/classrooms/example-classroom/certifications/example-certification/roster")
        publish_response = client.post("/api/classrooms/example-classroom/certifications/example-certification/publish", json={})
        me_response = client.get("/api/classrooms/example-classroom/certifications/example-certification/me")
        complete_response = client.post("/api/classrooms/example-classroom/certifications/example-certification/steps/example-step/complete", json={})
        proof_response = client.post("/api/classrooms/example-classroom/certifications/example-certification/proof", json={})
        override_response = client.post("/api/classrooms/example-classroom/certifications/example-certification/override-step", json={})
        issue_response = client.post("/api/classrooms/example-classroom/certifications/example-certification/issue/example-student", json={})
        global_list_response = client.get("/api/certificates/me")
        global_detail_response = client.get("/api/certificates/example-certificate")

        self.assertNotEqual(list_response.status_code, 404)
        self.assertNotEqual(create_response.status_code, 404)
        self.assertNotEqual(draft_response.status_code, 404)
        self.assertNotEqual(detail_response.status_code, 404)
        self.assertNotEqual(roster_response.status_code, 404)
        self.assertNotEqual(publish_response.status_code, 404)
        self.assertNotEqual(me_response.status_code, 404)
        self.assertNotEqual(complete_response.status_code, 404)
        self.assertNotEqual(proof_response.status_code, 404)
        self.assertNotEqual(override_response.status_code, 404)
        self.assertNotEqual(issue_response.status_code, 404)
        self.assertNotEqual(global_list_response.status_code, 404)
        self.assertNotEqual(global_detail_response.status_code, 404)


class ClassroomQuizSchedulingTest(unittest.TestCase):
    def test_resolve_quiz_status_accepts_timezone_aware_datetimes(self):
        now = datetime.now(timezone.utc)
        self.assertEqual(resolve_quiz_status(now - timedelta(minutes=1), now + timedelta(minutes=30)), "published")
        self.assertEqual(resolve_quiz_status(now + timedelta(minutes=30), now + timedelta(minutes=60)), "scheduled")
        self.assertEqual(resolve_quiz_status(now - timedelta(minutes=60), now - timedelta(minutes=30)), "closed")

    def test_serialize_utc_datetime_marks_naive_timestamps_as_utc(self):
        raw = datetime(2026, 5, 31, 16, 11, 14)
        self.assertEqual(serialize_utc_datetime(raw), "2026-05-31T16:11:14Z")


if __name__ == "__main__":
    unittest.main()
