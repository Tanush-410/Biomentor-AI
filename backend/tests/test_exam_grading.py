import importlib
import os
import sys
import unittest


CURRENT_DIR = os.path.dirname(__file__)
BACKEND_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)


class ExamGradingContractTest(unittest.TestCase):
    def _load_module(self):
        spec = importlib.util.find_spec("app.services.exam_grading")
        self.assertIsNotNone(spec, "app.services.exam_grading should exist")
        return importlib.import_module("app.services.exam_grading")

    def test_exam_grading_service_exports_grade_function(self):
        module = self._load_module()
        self.assertTrue(hasattr(module, "grade_exam_attempt"))

    def test_exam_grading_payload_shape(self):
        module = self._load_module()
        self.assertTrue(hasattr(module, "build_exam_grading_payload"))
        payload = module.build_exam_grading_payload(
            exam={
                "id": "exam-1",
                "title": "Midterm",
            },
            questions=[
                {
                    "id": "question-1",
                    "question_type": "long_text",
                    "marks": 10,
                    "grading_keywords": ["mitosis", "phases"],
                    "response_mode": "typed",
                    "answer_key": "Explain mitosis and its phases.",
                }
            ],
            responses=[
                {
                    "question_id": "question-1",
                    "typed_answer": "Mitosis has phases including prophase and metaphase.",
                    "uploaded_image_urls": [],
                }
            ],
        )

        self.assertIn("objective_score", payload)
        self.assertIn("descriptive_score", payload)
        self.assertIn("keyword_alignment", payload)
        self.assertIn("teacher_review_required", payload)
        self.assertIn("low_confidence_reasons", payload)
        self.assertIn("question_breakdown", payload)
        self.assertTrue(payload["question_breakdown"])
        breakdown_item = payload["question_breakdown"][0]
        self.assertIn("grading_keywords", breakdown_item)
        self.assertIn("response_mode", breakdown_item)
        self.assertIn("confidence", breakdown_item)


if __name__ == "__main__":
    unittest.main()
