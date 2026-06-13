import os
import sys
import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


CURRENT_DIR = os.path.dirname(__file__)
BACKEND_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.database.models import (  # noqa: E402
    Base,
    Classroom,
    ClassroomCertification,
    ClassroomCertificationStep,
    ClassroomEnrollment,
    ClassroomExam,
    ClassroomExamAttempt,
    ClassroomQuiz,
    ClassroomQuizAttempt,
    IssuedCertificate,
    User,
)
from app.services.certification import (  # noqa: E402
    build_certificates_dashboard,
    build_certification_roster,
    issue_certificate,
    refresh_certification_enrollment,
)


class CertificationServiceTests(unittest.TestCase):
    def setUp(self):
        engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=engine)
        self.session = sessionmaker(bind=engine)()

        self.educator = User(
            id="educator-1",
            email="educator@example.com",
            hashed_password="hashed",
            full_name="Educator One",
            role="educator",
        )
        self.student = User(
            id="student-1",
            email="student@example.com",
            hashed_password="hashed",
            full_name="Student One",
            role="student",
        )
        self.classroom = Classroom(
            id="classroom-1",
            educator_id=self.educator.id,
            name="Biology Lab",
            description="Certification class",
            subject="Biology",
            invite_code="CERT1234",
        )
        self.enrollment = ClassroomEnrollment(
            id="enrollment-1",
            classroom_id=self.classroom.id,
            student_id=self.student.id,
            status="active",
        )
        self.quiz = ClassroomQuiz(
            id="quiz-1",
            classroom_id=self.classroom.id,
            educator_id=self.educator.id,
            title="Checkpoint Quiz",
            num_questions=5,
            duration_minutes=15,
            status="published",
        )
        self.exam = ClassroomExam(
            id="exam-1",
            classroom_id=self.classroom.id,
            educator_id=self.educator.id,
            title="Summative Exam",
            total_marks=20,
            duration_minutes=45,
            status="published",
        )
        self.certification = ClassroomCertification(
            id="cert-1",
            classroom_id=self.classroom.id,
            educator_id=self.educator.id,
            title="Cell Biology Certification",
            course_mode="biomentor_track",
            status="published",
            requires_teacher_approval=False,
            manual_issue_only=False,
        )
        self.quiz_step = ClassroomCertificationStep(
            id="step-quiz",
            certification_id=self.certification.id,
            step_type="quiz",
            title="Pass the quiz",
            linked_resource_id=self.quiz.id,
            linked_resource_type="classroom_quiz",
            required=True,
            minimum_score=70,
            sort_order=0,
        )
        self.exam_step = ClassroomCertificationStep(
            id="step-exam",
            certification_id=self.certification.id,
            step_type="exam",
            title="Pass the exam",
            linked_resource_id=self.exam.id,
            linked_resource_type="classroom_exam",
            required=True,
            minimum_score=60,
            sort_order=1,
        )

        self.session.add_all(
            [
                self.educator,
                self.student,
                self.classroom,
                self.enrollment,
                self.quiz,
                self.exam,
                self.certification,
                self.quiz_step,
                self.exam_step,
            ]
        )
        self.session.commit()

    def tearDown(self):
        self.session.close()

    def test_enrollment_progress_completes_after_assessment_thresholds(self):
        self.session.add_all(
            [
                ClassroomQuizAttempt(
                    id="attempt-quiz-1",
                    classroom_quiz_id=self.quiz.id,
                    classroom_id=self.classroom.id,
                    student_id=self.student.id,
                    status="submitted",
                    score=86,
                ),
                ClassroomExamAttempt(
                    id="attempt-exam-1",
                    classroom_exam_id=self.exam.id,
                    classroom_id=self.classroom.id,
                    student_id=self.student.id,
                    status="submitted",
                    score=72,
                ),
            ]
        )
        self.session.commit()

        enrollment, steps, certificate = refresh_certification_enrollment(
            self.session,
            self.certification,
            self.student.id,
        )

        self.assertEqual(enrollment.status, "ready_for_review")
        self.assertEqual(round(enrollment.completion_percentage), 100)
        self.assertIsNone(certificate)
        self.assertTrue(all(step["status"] == "completed" for step in steps))

    def test_issue_certificate_creates_artifact_and_dashboard_entry(self):
        self.session.add_all(
            [
                ClassroomQuizAttempt(
                    id="attempt-quiz-2",
                    classroom_quiz_id=self.quiz.id,
                    classroom_id=self.classroom.id,
                    student_id=self.student.id,
                    status="submitted",
                    score=95,
                ),
                ClassroomExamAttempt(
                    id="attempt-exam-2",
                    classroom_exam_id=self.exam.id,
                    classroom_id=self.classroom.id,
                    student_id=self.student.id,
                    status="submitted",
                    score=88,
                ),
            ]
        )
        self.session.commit()

        certificate = issue_certificate(
            self.session,
            self.certification,
            self.classroom,
            self.student,
            self.educator,
        )

        self.assertIsInstance(certificate, IssuedCertificate)
        self.assertTrue(certificate.certificate_number.startswith("BM-"))
        dashboard = build_certificates_dashboard(self.session, self.student)
        self.assertEqual(len(dashboard["issued_certificates"]), 1)
        self.assertEqual(dashboard["issued_certificates"][0]["id"], certificate.id)

    def test_roster_marks_student_ready_for_issue(self):
        self.session.add_all(
            [
                ClassroomQuizAttempt(
                    id="attempt-quiz-3",
                    classroom_quiz_id=self.quiz.id,
                    classroom_id=self.classroom.id,
                    student_id=self.student.id,
                    status="submitted",
                    score=90,
                ),
                ClassroomExamAttempt(
                    id="attempt-exam-3",
                    classroom_exam_id=self.exam.id,
                    classroom_id=self.classroom.id,
                    student_id=self.student.id,
                    status="submitted",
                    score=90,
                ),
            ]
        )
        self.session.commit()

        roster = build_certification_roster(self.session, self.certification)

        self.assertEqual(len(roster), 1)
        self.assertEqual(roster[0]["student_id"], self.student.id)
        self.assertEqual(roster[0]["status"], "ready_for_review")
        self.assertTrue(roster[0]["ready_for_issue"])


if __name__ == "__main__":
    unittest.main()
