import importlib
import os
import sys
import unittest


CURRENT_DIR = os.path.dirname(__file__)
BACKEND_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)


class ExamDraftingContractTest(unittest.TestCase):
    def _load_module(self):
        spec = importlib.util.find_spec("app.services.exam_drafting")
        self.assertIsNotNone(spec, "app.services.exam_drafting should exist")
        return importlib.import_module("app.services.exam_drafting")

    def test_exam_drafting_service_exports_builder(self):
        module = self._load_module()
        self.assertTrue(hasattr(module, "build_exam_draft_payload"))

    def test_exam_draft_payload_shape(self):
        module = self._load_module()
        payload = module.build_exam_draft_payload(
            title="Cell Biology Midterm",
            instructions="Answer every section clearly.",
            exam_mode="mixed",
            num_questions=4,
            linked_material_ids=["doc-1", "doc-2"],
            source_contexts=[
                {
                    "content": "Mitosis is the process of cell division that produces two identical daughter cells. The phases include prophase, metaphase, anaphase, and telophase.",
                    "document_id": "doc-1",
                    "document_title": "Cell Notes",
                    "page_number": 2,
                    "chunk_index": 0,
                    "relevance_score": 0.9,
                },
                {
                    "content": "Cell cycle checkpoints help regulate the timing of mitosis and prevent damaged DNA from progressing.",
                    "document_id": "doc-2",
                    "document_title": "Checkpoint Guide",
                    "page_number": 4,
                    "chunk_index": 1,
                    "relevance_score": 0.8,
                },
            ],
        )

        self.assertIn("title", payload)
        self.assertIn("blocks", payload)
        self.assertIn("questions", payload)
        self.assertIn("source_documents_used", payload)
        self.assertTrue(payload["blocks"])
        self.assertTrue(payload["questions"])
        first_question = payload["questions"][0]
        self.assertIn("prompt", first_question)
        self.assertIn("question_type", first_question)
        self.assertIn("response_mode", first_question)
        self.assertIn("grading_keywords", first_question)
        self.assertIn("ai_suggestion_context", first_question)


if __name__ == "__main__":
    unittest.main()
