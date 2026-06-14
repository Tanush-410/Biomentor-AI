import os
import sys
import unittest


CURRENT_DIR = os.path.dirname(__file__)
BACKEND_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)


from app.services.classroom_quiz_authoring import (  # noqa: E402
    build_manual_generated_questions,
    normalize_manual_questions,
)


class ManualClassroomQuizAuthoringTest(unittest.TestCase):
    def test_normalize_manual_questions_requires_one_correct_option(self):
        with self.assertRaises(ValueError):
            normalize_manual_questions(
                [
                    {
                        "prompt": "What does CPU stand for?",
                        "options": [
                            {"id": "A", "text": "Central Print Unit"},
                            {"id": "B", "text": "Central Processing Unit"},
                            {"id": "C", "text": "Computer Processing User"},
                            {"id": "D", "text": "Control Process Utility"},
                        ],
                        "correct_option_id": "Z",
                    }
                ]
            )

    def test_normalize_manual_questions_preserves_explanations_and_counts(self):
        questions = normalize_manual_questions(
            [
                {
                    "prompt": "Which scheduling algorithm can cause starvation?",
                    "explanation": "Priority scheduling can starve low-priority processes.",
                    "bloom_level": 4,
                    "options": [
                        {"id": "A", "text": "Round Robin"},
                        {"id": "B", "text": "Priority Scheduling"},
                        {"id": "C", "text": "FCFS"},
                        {"id": "D", "text": "FIFO"},
                    ],
                    "correct_option_id": "B",
                }
            ]
        )

        self.assertEqual(len(questions), 1)
        self.assertEqual(questions[0]["correct_option_id"], "B")
        self.assertEqual(questions[0]["bloom_level"], 4)
        self.assertEqual(len(questions[0]["options"]), 4)
        self.assertIn("Priority scheduling", questions[0]["explanation"])

    def test_build_manual_generated_questions_matches_student_quiz_runtime_shape(self):
        normalized_questions = normalize_manual_questions(
            [
                {
                    "prompt": "What problem does the Dining Philosopher problem model?",
                    "explanation": "It models contention for shared resources and deadlock risks.",
                    "bloom_level": 3,
                    "options": [
                        {"id": "A", "text": "Disk fragmentation"},
                        {"id": "B", "text": "Shared resource contention"},
                        {"id": "C", "text": "Binary search"},
                        {"id": "D", "text": "IP routing"},
                    ],
                    "correct_option_id": "B",
                }
            ]
        )

        generated = build_manual_generated_questions(
            normalized_questions,
            user_id="student-1",
            session_id="session-1",
            classroom_quiz_title="Operating Systems Quiz",
            document_id=None,
        )

        self.assertEqual(len(generated), 1)
        question = generated[0]
        self.assertEqual(question["question_text"], "What problem does the Dining Philosopher problem model?")
        self.assertEqual(question["correct_answer"], "B")
        self.assertEqual(question["bloom_level"], 3)
        self.assertEqual(len(question["options"]), 4)
        self.assertEqual(question["user_id"], "student-1")
        self.assertEqual(question["session_id"], "session-1")


if __name__ == "__main__":
    unittest.main()
