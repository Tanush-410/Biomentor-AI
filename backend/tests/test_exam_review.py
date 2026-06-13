import os
import sys
import unittest


CURRENT_DIR = os.path.dirname(__file__)
BACKEND_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)


from app.services.exam_review import build_exam_review_attempt_payload  # noqa: E402


class ExamReviewPayloadTest(unittest.TestCase):
    def test_review_payload_includes_per_question_teacher_controls(self):
        payload = build_exam_review_attempt_payload(
            exam={
                "id": "exam-1",
                "title": "Unit Exam",
                "total_marks": 20,
            },
            attempt={
                "id": "attempt-1",
                "status": "submitted",
                "objective_score": 4,
                "descriptive_score": 6,
                "score": 10,
                "submitted_at": "2026-06-10T10:00:00",
                "teacher_review_required": True,
                "termination_reason": None,
                "grading_summary": {
                    "question_breakdown": [
                        {
                            "question_id": "question-1",
                            "confidence": 0.44,
                            "score": 6,
                            "teacher_review_required": True,
                        }
                    ],
                    "low_confidence_reasons": ["keyword_alignment_low"],
                },
            },
            student={
                "id": "student-1",
                "full_name": "Tanush",
                "email": "tanush@example.com",
            },
            questions=[
                {
                    "id": "question-1",
                    "prompt": "Explain mitosis.",
                    "question_type": "long_text",
                    "response_mode": "typed",
                    "marks": 10,
                    "grading_keywords": ["prophase", "metaphase"],
                    "answer_key": "Discuss the phases of mitosis.",
                    "position": 0,
                }
            ],
            responses=[
                {
                    "id": "response-1",
                    "question_id": "question-1",
                    "typed_answer": "Mitosis includes prophase.",
                    "uploaded_image_urls": [],
                    "selected_option_ids": [],
                    "ai_score": 6,
                    "teacher_score": None,
                    "teacher_feedback": None,
                    "review_status": "pending_ai",
                    "response_metadata": {"response_mode": "typed"},
                }
            ],
        )

        self.assertEqual(payload["attempt_id"], "attempt-1")
        self.assertEqual(payload["student_name"], "Tanush")
        self.assertEqual(payload["pending_review_count"], 1)
        self.assertEqual(len(payload["question_reviews"]), 1)
        question_review = payload["question_reviews"][0]
        self.assertEqual(question_review["response_id"], "response-1")
        self.assertIn("teacher_score", question_review)
        self.assertIn("teacher_feedback", question_review)
        self.assertIn("review_status", question_review)
        self.assertIn("ai_confidence", question_review)
        self.assertTrue(question_review["teacher_review_required"])
        self.assertIn("release_summary", payload)
        self.assertIn("question_navigator", payload)
        self.assertEqual(payload["release_summary"]["release_score"], 10)
        self.assertEqual(payload["question_navigator"][0]["response_id"], "response-1")


if __name__ == "__main__":
    unittest.main()
