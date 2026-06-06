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
    ClassroomEnrollment,
    ClassroomMaterial,
    ClassroomQuiz,
    Document,
    User,
)
from app.routers.documents import get_accessible_document_for_user  # noqa: E402


class DocumentMaterialAccessTests(unittest.TestCase):
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
            full_name="Educator",
            role="educator",
        )
        self.student = User(
            id="student-1",
            email="student@example.com",
            hashed_password="hashed",
            full_name="Student",
            role="student",
        )
        self.classroom = Classroom(
            id="classroom-1",
            educator_id=self.educator.id,
            name="Biology",
            description="AP Biology",
            subject="Biology",
            invite_code="ABC12345",
        )
        self.enrollment = ClassroomEnrollment(
            id="enrollment-1",
            classroom_id=self.classroom.id,
            student_id=self.student.id,
            status="active",
        )
        self.document = Document(
            id="document-1",
            user_id=self.educator.id,
            title="Photosynthesis Notes",
            file_name="photosynthesis.pdf",
            file_path="supabase://documents/educator-1/document-1.pdf",
            file_size=2048,
            pages=8,
            content_preview="Chloroplasts and light reactions",
            processing_status="completed",
        )
        self.shared_material = ClassroomMaterial(
            id="material-1",
            classroom_id=self.classroom.id,
            document_id=self.document.id,
            shared_by_user_id=self.educator.id,
        )
        self.quiz = ClassroomQuiz(
            id="quiz-1",
            classroom_id=self.classroom.id,
            educator_id=self.educator.id,
            title="Photosynthesis Quiz",
            description="Quiz using shared notes",
            document_id=self.document.id,
            num_questions=5,
            duration_minutes=15,
        )

        self.session.add_all(
            [
                self.educator,
                self.student,
                self.classroom,
                self.enrollment,
                self.document,
                self.shared_material,
                self.quiz,
            ]
        )
        self.session.commit()

    def tearDown(self):
        self.session.close()

    def test_student_can_access_document_shared_into_their_classroom(self):
        accessible = get_accessible_document_for_user(self.session, self.student, self.document.id)

        self.assertIsNotNone(accessible)
        self.assertEqual(accessible.id, self.document.id)

    def test_owner_can_access_their_own_document(self):
        accessible = get_accessible_document_for_user(self.session, self.educator, self.document.id)

        self.assertIsNotNone(accessible)
        self.assertEqual(accessible.id, self.document.id)


if __name__ == "__main__":
    unittest.main()
