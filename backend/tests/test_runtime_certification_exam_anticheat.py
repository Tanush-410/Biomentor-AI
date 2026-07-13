import os
import sys
import unittest

from fastapi.testclient import TestClient


CURRENT_DIR = os.path.dirname(__file__)
BACKEND_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.database import SessionLocal, engine, init_db  # noqa: E402
from app.database.models import (  # noqa: E402
    Base,
    Classroom,
    ClassroomEnrollment,
    ClassroomMaterial,
    Document,
    DocumentChunk,
)
from app.main import app  # noqa: E402


PNG_DATA_URL = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9p0nXU4AAAAASUVORK5CYII="
)


class RuntimeCertificationExamAnticheatFlowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.drop_all(bind=engine)
        init_db()
        cls.client = TestClient(app)

    def setUp(self):
        Base.metadata.drop_all(bind=engine)
        init_db()
        self.db = SessionLocal()
        self.educator = self._register_and_login(
            email="educator.runtime@example.com",
            password="StrongPass123",
            full_name="Educator Runtime",
            role="educator",
        )
        self.student = self._register_and_login(
            email="student.runtime@example.com",
            password="StrongPass123",
            full_name="Student Runtime",
            role="student",
        )
        self.classroom = Classroom(
            educator_id=self.educator["user"]["id"],
            name="Runtime Biology Lab",
            description="End-to-end runtime verification classroom",
            subject="Biology",
            invite_code="RUNTEST1",
            is_active=True,
        )
        self.db.add(self.classroom)
        self.db.flush()
        self.db.add(
            ClassroomEnrollment(
                classroom_id=self.classroom.id,
                student_id=self.student["user"]["id"],
                status="active",
            )
        )
        self.document = Document(
            user_id=self.educator["user"]["id"],
            title="Cell Energy Notes",
            description="Runtime verification source material",
            file_name="cell-energy.txt",
            file_path="/tmp/cell-energy.txt",
            file_size=128,
            pages=2,
            content_preview="Cells use ATP to power transport and metabolic work.",
            processing_status="completed",
            is_processed=True,
            embedding_count=2,
        )
        self.db.add(self.document)
        self.db.flush()
        self.db.add_all(
            [
                DocumentChunk(
                    document_id=self.document.id,
                    chunk_index=0,
                    page_number=1,
                    text_content="ATP stores energy and powers active transport across membranes.",
                ),
                DocumentChunk(
                    document_id=self.document.id,
                    chunk_index=1,
                    page_number=2,
                    text_content="Mitochondria support aerobic respiration and supply ATP for cell work.",
                ),
                ClassroomMaterial(
                    classroom_id=self.classroom.id,
                    document_id=self.document.id,
                    shared_by_user_id=self.educator["user"]["id"],
                    title_override="Cell Energy Pack",
                    description="Shared for runtime verification",
                ),
            ]
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_certification_flow_issues_real_certificate(self):
        create_response = self.client.post(
            f"/api/classrooms/{self.classroom.id}/certifications",
            headers=self._auth_headers(self.educator["access_token"]),
            json={
                "title": "VYDRA CORE External Certification",
                "description": "Learners submit external completion proof for review.",
                "course_mode": "external_course",
                "provider_name": "VYDRA CORE",
                "external_url": "https://example.com/course",
                "issuer_name": "VYDRA CORE",
                "certificate_subtitle": "Certificate of Completion",
                "completion_message": "completed the guided course path.",
                "manual_issue_only": False,
                "requires_teacher_approval": True,
                "certificate_template": {"theme": "biomentor-premium"},
                "ai_notes": {"target_outcome": "Complete external study track"},
                "steps": [
                    {
                        "step_type": "external_link",
                        "title": "Submit external course proof",
                        "description": "Paste the link or note proving completion.",
                        "linked_resource_id": "https://example.com/course",
                        "linked_resource_type": "external_url",
                        "required": True,
                        "minimum_score": None,
                        "metadata": {},
                        "sort_order": 0,
                    }
                ],
            },
        )
        self.assertEqual(create_response.status_code, 200, create_response.text)
        certification_id = create_response.json()["certification"]["id"]
        step_id = create_response.json()["certification"]["steps"][0]["id"]

        publish_response = self.client.post(
            f"/api/classrooms/{self.classroom.id}/certifications/{certification_id}/publish",
            headers=self._auth_headers(self.educator["access_token"]),
            json={},
        )
        self.assertEqual(publish_response.status_code, 200, publish_response.text)

        proof_response = self.client.post(
            f"/api/classrooms/{self.classroom.id}/certifications/{certification_id}/proof",
            headers=self._auth_headers(self.student["access_token"]),
            json={
                "step_id": step_id,
                "proof_type": "link",
                "proof_url": "https://example.com/completion/student-runtime",
                "text_note": "Completed the full linked course.",
            },
        )
        self.assertEqual(proof_response.status_code, 200, proof_response.text)

        roster_response = self.client.get(
            f"/api/classrooms/{self.classroom.id}/certifications/{certification_id}/roster",
            headers=self._auth_headers(self.educator["access_token"]),
        )
        self.assertEqual(roster_response.status_code, 200, roster_response.text)
        roster = roster_response.json()["roster"]
        self.assertEqual(len(roster), 1)
        self.assertEqual(roster[0]["status"], "in_progress")

        override_response = self.client.post(
            f"/api/classrooms/{self.classroom.id}/certifications/{certification_id}/override-step",
            headers=self._auth_headers(self.educator["access_token"]),
            json={
                "student_id": self.student["user"]["id"],
                "step_id": step_id,
                "status": "completed",
                "note": "Proof accepted by the teacher.",
                "score_achieved": 100,
            },
        )
        self.assertEqual(override_response.status_code, 200, override_response.text)

        issue_response = self.client.post(
            f"/api/classrooms/{self.classroom.id}/certifications/{certification_id}/issue/{self.student['user']['id']}",
            headers=self._auth_headers(self.educator["access_token"]),
            json={},
        )
        self.assertEqual(issue_response.status_code, 200, issue_response.text)
        certificate_id = issue_response.json()["certificate"]["id"]

        dashboard_response = self.client.get(
            "/api/certificates/me",
            headers=self._auth_headers(self.student["access_token"]),
        )
        self.assertEqual(dashboard_response.status_code, 200, dashboard_response.text)
        issued = dashboard_response.json()["issued_certificates"]
        self.assertEqual(len(issued), 1)
        self.assertEqual(issued[0]["id"], certificate_id)

        detail_response = self.client.get(
            f"/api/certificates/{certificate_id}",
            headers=self._auth_headers(self.student["access_token"]),
        )
        self.assertEqual(detail_response.status_code, 200, detail_response.text)
        payload = detail_response.json()
        self.assertEqual(payload["certificate"]["student_name"], "Student Runtime")
        self.assertEqual(payload["meta"]["certification_title"], "VYDRA CORE External Certification")

    def test_exam_authoring_ai_draft_submission_review_and_anticheat_case(self):
        draft_response = self.client.post(
            f"/api/classrooms/{self.classroom.id}/exams/draft",
            headers=self._auth_headers(self.educator["access_token"]),
            json={
                "title": "AI Assisted Bio Exam",
                "instructions": "Use the source pack to answer carefully.",
                "exam_mode": "mixed",
                "generation_scope": "selected_materials",
                "linked_material_ids": [self.document.id],
                "num_questions": 4,
            },
        )
        self.assertEqual(draft_response.status_code, 200, draft_response.text)
        draft = draft_response.json()["draft"]
        self.assertGreaterEqual(len(draft["blocks"]), 2)
        self.assertEqual(len(draft["questions"]), 4)

        create_response = self.client.post(
            f"/api/classrooms/{self.classroom.id}/exams",
            headers=self._auth_headers(self.educator["access_token"]),
            json={
                "title": "Word Style Runtime Exam",
                "description": "Structured paper for runtime verification.",
                "instructions": "Answer all sections inside the fixed response areas.",
                "exam_mode": "mixed",
                "authoring_mode": "manual",
                "generation_scope": "selected_materials",
                "total_marks": 15,
                "duration_minutes": 45,
                "publish_to_stream": True,
                "proctoring_enabled": True,
                "allow_late_entries": False,
                "linked_material_ids": [self.document.id],
                "grading_notes": {
                    "teacher_keywords_intent": "Look for ATP, active transport, mitochondria."
                },
                "anticheat_policy": {
                    "end_on_major_violation": True,
                    "capture_snapshot_on_warning": True,
                    "final_action": "teacher_review_required",
                },
                "blocks": [
                    {
                        "block_type": "section",
                        "title": "Section A",
                        "content": {
                            "text": "Short objective checks",
                            "layout": {"width": "full", "align": "left"},
                        },
                        "sort_order": 0,
                        "metadata": {"template": "section-divider"},
                    },
                    {
                        "block_type": "image",
                        "title": "Cell diagram",
                        "content": {
                            "image_url": "https://example.com/cell-diagram.png",
                            "caption": "Reference diagram",
                            "layout": {"width": "medium", "align": "center"},
                        },
                        "sort_order": 1,
                        "metadata": {"template": "diagram"},
                    },
                    {
                        "block_type": "text",
                        "title": "Long answer directions",
                        "content": {
                            "text": "Explain how ATP supports transport using the linked material.",
                            "layout": {"width": "full", "align": "left"},
                        },
                        "sort_order": 2,
                        "metadata": {"template": "instruction"},
                    },
                ],
                "questions": [
                    {
                        "prompt": "Which organelle is most directly linked to ATP production?",
                        "question_type": "mcq",
                        "response_mode": "typed",
                        "marks": 5,
                        "options": [
                            {"id": "A", "text": "Golgi body"},
                            {"id": "B", "text": "Mitochondria"},
                            {"id": "C", "text": "Ribosome"},
                            {"id": "D", "text": "Lysosome"},
                        ],
                        "answer_key": "B",
                        "grading_keywords": ["mitochondria", "ATP"],
                        "fixed_response_box": True,
                        "response_config": {"rows": 3},
                        "ai_suggestion_context": {},
                        "position": 0,
                    },
                    {
                        "prompt": "Explain how ATP powers active transport in cells.",
                        "question_type": "long_text",
                        "response_mode": "typed_or_image",
                        "marks": 10,
                        "options": [],
                        "answer_key": "ATP releases energy that membrane pumps use during active transport.",
                        "grading_keywords": ["ATP", "active transport", "energy", "membrane"],
                        "fixed_response_box": True,
                        "response_config": {"rows": 6, "placeholder": "Write your structured answer here."},
                        "ai_suggestion_context": {},
                        "position": 1,
                    },
                ],
            },
        )
        self.assertEqual(create_response.status_code, 200, create_response.text)
        exam = create_response.json()["exam"]
        exam_id = exam["id"]
        self.assertEqual(len(exam["blocks"]), 3)
        self.assertEqual(exam["blocks"][1]["block_type"], "image")
        self.assertEqual(exam["questions"][1]["response_mode"], "typed_or_image")
        self.assertTrue(exam["questions"][1]["fixed_response_box"])

        student_exam_response = self.client.get(
            f"/api/classrooms/{self.classroom.id}/exams/{exam_id}",
            headers=self._auth_headers(self.student["access_token"]),
        )
        self.assertEqual(student_exam_response.status_code, 200, student_exam_response.text)
        student_exam = student_exam_response.json()["exam"]
        self.assertEqual(student_exam["questions"][1]["answer_key"], None)

        start_response = self.client.post(
            f"/api/classrooms/{self.classroom.id}/exams/{exam_id}/start",
            headers=self._auth_headers(self.student["access_token"]),
            json={},
        )
        self.assertEqual(start_response.status_code, 200, start_response.text)
        attempt_id = start_response.json()["attempt"]["id"]

        question_ids = [question["id"] for question in exam["questions"]]
        submit_response = self.client.post(
            f"/api/classrooms/{self.classroom.id}/exams/{exam_id}/submit",
            headers=self._auth_headers(self.student["access_token"]),
            json={
                "attempt_id": attempt_id,
                "responses": [
                    {
                        "question_id": question_ids[0],
                        "selected_option_ids": ["B"],
                        "metadata": {},
                    },
                    {
                        "question_id": question_ids[1],
                        "typed_answer": "ATP releases energy so membrane proteins can move molecules against the gradient.",
                        "uploaded_image_urls": ["https://example.com/answer.jpg"],
                        "metadata": {"per_question_capture": "enabled"},
                    },
                ],
            },
        )
        self.assertEqual(submit_response.status_code, 200, submit_response.text)
        grading = submit_response.json()["grading"]
        self.assertEqual(grading["status"], "teacher_review_required")

        review_response = self.client.get(
            f"/api/classrooms/{self.classroom.id}/exams/{exam_id}/review",
            headers=self._auth_headers(self.educator["access_token"]),
        )
        self.assertEqual(review_response.status_code, 200, review_response.text)
        attempts = review_response.json()["attempts"]
        self.assertEqual(len(attempts), 1)
        review_attempt = attempts[0]
        self.assertEqual(review_attempt["pending_review_count"], 1)
        long_answer_review = next(
            item for item in review_attempt["question_reviews"] if item["question_type"] != "mcq"
        )

        finalize_response = self.client.post(
            f"/api/classrooms/{self.classroom.id}/exams/{exam_id}/review/{attempt_id}",
            headers=self._auth_headers(self.educator["access_token"]),
            json={
                "overall_feedback": "Clear reasoning with the correct transport link.",
                "responses": [
                    {
                        "response_id": long_answer_review["response_id"],
                        "teacher_score": 9,
                        "teacher_feedback": "Strong use of ATP and membrane transport keywords.",
                        "review_status": "teacher_finalized",
                    }
                ],
            },
        )
        self.assertEqual(finalize_response.status_code, 200, finalize_response.text)
        finalized = finalize_response.json()["attempt"]
        self.assertFalse(finalized["teacher_review_required"])
        self.assertEqual(finalized["release_summary"]["release_readiness"], "ready_to_release")

        warning_exam_response = self.client.post(
            f"/api/classrooms/{self.classroom.id}/exams",
            headers=self._auth_headers(self.educator["access_token"]),
            json={
                "title": "Anti-cheat Runtime Exam",
                "description": "Used to verify warning escalation and evidence capture.",
                "instructions": "Keep the camera visible.",
                "exam_mode": "written",
                "authoring_mode": "manual",
                "generation_scope": "selected_materials",
                "total_marks": 5,
                "duration_minutes": 15,
                "publish_to_stream": False,
                "proctoring_enabled": True,
                "allow_late_entries": False,
                "linked_material_ids": [self.document.id],
                "grading_notes": {},
                "anticheat_policy": {"capture_snapshot_on_warning": True},
                "blocks": [
                    {
                        "block_type": "text",
                        "title": "Integrity reminder",
                        "content": {"text": "Stay visible and fullscreen throughout the attempt."},
                        "sort_order": 0,
                        "metadata": {},
                    }
                ],
                "questions": [
                    {
                        "prompt": "State one function of ATP.",
                        "question_type": "short_text",
                        "response_mode": "typed",
                        "marks": 5,
                        "options": [],
                        "answer_key": "ATP stores and releases usable cellular energy.",
                        "grading_keywords": ["ATP", "energy"],
                        "fixed_response_box": True,
                        "response_config": {"rows": 3},
                        "ai_suggestion_context": {},
                        "position": 0,
                    }
                ],
            },
        )
        self.assertEqual(warning_exam_response.status_code, 200, warning_exam_response.text)
        warning_exam = warning_exam_response.json()["exam"]

        warning_start_response = self.client.post(
            f"/api/classrooms/{self.classroom.id}/exams/{warning_exam['id']}/start",
            headers=self._auth_headers(self.student["access_token"]),
            json={},
        )
        self.assertEqual(warning_start_response.status_code, 200, warning_start_response.text)
        warning_attempt_id = warning_start_response.json()["attempt"]["id"]

        for index, warning_type in enumerate(
            ["ai_looking_down", "ai_multiple_faces", "fullscreen_exit"],
            start=1,
        ):
            warning_response = self.client.post(
                f"/api/classrooms/{self.classroom.id}/exams/{warning_exam['id']}/warning",
                headers=self._auth_headers(self.student["access_token"]),
                json={
                    "attempt_id": warning_attempt_id,
                    "warning_type": warning_type,
                    "details": {
                        "major_warning_index": index,
                        "evidence_image_data_url": PNG_DATA_URL,
                        "teacher_reason": f"warning-{index}",
                    },
                },
            )
            self.assertEqual(warning_response.status_code, 200, warning_response.text)

        anticheat_cases_response = self.client.get(
            f"/api/classrooms/{self.classroom.id}/anticheat-bot",
            headers=self._auth_headers(self.educator["access_token"]),
        )
        self.assertEqual(anticheat_cases_response.status_code, 200, anticheat_cases_response.text)
        cases = anticheat_cases_response.json()["cases"]
        self.assertEqual(len(cases), 1)
        case = cases[0]
        self.assertEqual(case["status"], "teacher_review_required")
        self.assertEqual(case["final_case_reason"], "ai_proctoring_debarred")
        self.assertEqual(case["latest_warning_count"], 3)
        self.assertEqual(len(case["evidence_snapshots"]), 3)
        self.assertTrue(all(snapshot["image_url"] for snapshot in case["evidence_snapshots"]))
        self.assertEqual(case["last_three_reasons"], ["fullscreen_exit", "ai_multiple_faces", "ai_looking_down"])

        case_detail_response = self.client.get(
            f"/api/classrooms/{self.classroom.id}/anticheat-bot/{case['id']}",
            headers=self._auth_headers(self.educator["access_token"]),
        )
        self.assertEqual(case_detail_response.status_code, 200, case_detail_response.text)
        detail_case = case_detail_response.json()["case"]
        self.assertEqual(detail_case["signal_summary"]["camera_evidence_count"], 3)
        self.assertEqual(detail_case["signal_summary"]["heuristic_count"], 2)
        self.assertEqual(detail_case["signal_summary"]["hard_rule_count"], 1)

    def test_quiz_warnings_and_violations_create_anticheat_evidence_cases(self):
        create_response = self.client.post(
            f"/api/classrooms/{self.classroom.id}/quizzes",
            headers=self._auth_headers(self.educator["access_token"]),
            json={
                "title": "Protected ATP Quiz",
                "description": "Manual protected quiz for anti-cheat evidence regression.",
                "quiz_mode": "manual",
                "duration_minutes": 15,
                "publish_to_stream": False,
                "proctoring_enabled": True,
                "allow_late_entries": False,
                "manual_questions": [
                    {
                        "prompt": "Which molecule stores usable cellular energy?",
                        "explanation": "ATP stores and releases usable cellular energy.",
                        "bloom_level": 2,
                        "options": [
                            {"id": "A", "text": "ATP"},
                            {"id": "B", "text": "DNA"},
                            {"id": "C", "text": "Cellulose"},
                            {"id": "D", "text": "Water"},
                        ],
                        "correct_option_id": "A",
                    }
                ],
            },
        )
        self.assertEqual(create_response.status_code, 200, create_response.text)
        quiz = create_response.json()["quiz"]

        start_response = self.client.post(
            f"/api/classrooms/{self.classroom.id}/quizzes/{quiz['id']}/start",
            headers=self._auth_headers(self.student["access_token"]),
            json={},
        )
        self.assertEqual(start_response.status_code, 200, start_response.text)
        attempt_id = start_response.json()["attempt"]["id"]

        warning_response = self.client.post(
            f"/api/classrooms/{self.classroom.id}/quizzes/{quiz['id']}/warning",
            headers=self._auth_headers(self.student["access_token"]),
            json={
                "attempt_id": attempt_id,
                "warning_type": "ai_looking_down",
                "details": {
                    "teacher_reason": "possible phone glance",
                    "evidence_image_data_url": PNG_DATA_URL,
                },
            },
        )
        self.assertEqual(warning_response.status_code, 200, warning_response.text)

        violation_response = self.client.post(
            f"/api/classrooms/{self.classroom.id}/quizzes/{quiz['id']}/violation",
            headers=self._auth_headers(self.student["access_token"]),
            json={
                "attempt_id": attempt_id,
                "violation_type": "tab_hidden",
                "details": {
                    "teacher_reason": "student left the quiz tab",
                    "evidence_image_data_url": PNG_DATA_URL,
                },
            },
        )
        self.assertEqual(violation_response.status_code, 200, violation_response.text)

        cases_response = self.client.get(
            f"/api/classrooms/{self.classroom.id}/anticheat-bot",
            headers=self._auth_headers(self.educator["access_token"]),
        )
        self.assertEqual(cases_response.status_code, 200, cases_response.text)
        cases = cases_response.json()["cases"]
        self.assertEqual(len(cases), 1)
        case = cases[0]
        self.assertEqual(case["assessment_type"], "quiz")
        self.assertEqual(case["final_case_reason"], "tab_hidden")
        self.assertEqual(case["latest_warning_count"], 2)
        self.assertEqual(case["last_three_reasons"], ["tab_hidden", "ai_looking_down"])
        self.assertEqual(len(case["evidence_snapshots"]), 2)
        self.assertTrue(all(snapshot["image_url"] for snapshot in case["evidence_snapshots"]))

    def _register_and_login(self, *, email, password, full_name, role):
        register_response = self.client.post(
            "/api/auth/register",
            json={
                "email": email,
                "password": password,
                "full_name": full_name,
                "role": role,
            },
        )
        self.assertEqual(register_response.status_code, 200, register_response.text)

        login_response = self.client.post(
            "/api/auth/login",
            json={
                "email": email,
                "password": password,
                "desired_role": role,
            },
        )
        self.assertEqual(login_response.status_code, 200, login_response.text)
        return login_response.json()

    def _auth_headers(self, token):
        return {"Authorization": f"Bearer {token}"}


if __name__ == "__main__":
    unittest.main()
