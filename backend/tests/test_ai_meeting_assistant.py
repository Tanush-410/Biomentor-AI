import os
import sys
import unittest
from unittest.mock import Mock

from fastapi.testclient import TestClient

CURRENT_DIR = os.path.dirname(__file__)
BACKEND_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.main import app  # noqa: E402
from app.database import Base  # noqa: E402
from app.database.models import (  # noqa: E402
    ClassroomMeetingAISummary,
    ClassroomMeetingEvent,
    ClassroomMeetingTranscript,
)
from app.services.meeting_assistant import build_meeting_transcription_prompt  # noqa: E402
from app.services.meeting_assistant import build_teacher_assistant_snapshot  # noqa: E402
from app.services.meeting_assistant import build_teacher_summary_payload  # noqa: E402


class MeetingAssistantModelTest(unittest.TestCase):
    def test_meeting_assistant_models_are_registered(self):
        table_names = set(Base.metadata.tables.keys())
        self.assertIn("classroom_meeting_transcripts", table_names)
        self.assertIn("classroom_meeting_events", table_names)
        self.assertIn("classroom_meeting_ai_summaries", table_names)

    def test_ai_summary_allows_teacher_and_student_summary_types(self):
        summary = ClassroomMeetingAISummary(summary_type="teacher_summary")
        self.assertEqual(summary.summary_type, "teacher_summary")


class MeetingAssistantServiceTest(unittest.TestCase):
    def test_snapshot_extracts_notes_actions_doubts_and_followups(self):
        snapshot = build_teacher_assistant_snapshot(
            transcript_items=[{"speaker_name": "Tan", "content": "Need to revise mitosis next class."}],
            meeting_events=[{"event_type": "doubt_flag", "payload": {"question": "What is metaphase?"}}],
            meeting_title="Cell Division Review",
        )

        self.assertIn("live_notes", snapshot)
        self.assertIn("action_items", snapshot)
        self.assertIn("unresolved_doubts", snapshot)
        self.assertIn("follow_up_suggestions", snapshot)
        self.assertIn("concept_signals", snapshot)
        self.assertIn("teacher_moves", snapshot)
        self.assertIn("student_risk_flags", snapshot)
        self.assertIn("follow_up_assets", snapshot)
        self.assertTrue(snapshot["concept_signals"]["items"])
        self.assertTrue(snapshot["teacher_moves"])
        self.assertTrue(snapshot["follow_up_assets"])
        self.assertEqual(snapshot["confidence"], "medium")
        self.assertTrue(snapshot["confidence_reason"])

    def test_snapshot_downgrades_confidence_when_transcript_is_sparse(self):
        snapshot = build_teacher_assistant_snapshot(
            transcript_items=[],
            meeting_events=[],
            meeting_title="Revision",
        )

        self.assertEqual(snapshot["confidence"], "low")
        self.assertTrue(snapshot["fallback_used"])

    def test_teacher_summary_prefers_ai_generator_output_when_available(self):
        generator = Mock(
            return_value={
                "summary": "Students compared mitosis and meiosis clearly.",
                "action_items": ["Share the comparison chart."],
                "unresolved_doubts": ["Clarify crossing over next class."],
                "follow_up_suggestions": ["Create a two-question meiosis recap quiz."],
            }
        )

        payload = build_teacher_summary_payload(
            transcript_items=[{"speaker_name": "Tan", "content": "We compared mitosis and meiosis."}],
            meeting_events=[{"event_type": "doubt_flag", "payload": {"question": "What is crossing over?"}}],
            meeting_title="Cell Division Review",
            generator=generator,
        )

        self.assertEqual(payload["summary"], "Students compared mitosis and meiosis clearly.")
        self.assertIn("Share the comparison chart.", payload["action_items"])
        self.assertIn("study_recap", payload)
        self.assertIn("unresolved_questions", payload)
        self.assertIn("next_class_moves", payload)
        self.assertIn("confidence", payload)
        self.assertIn("confidence_reason", payload)
        self.assertTrue(generator.called)

    def test_transcription_prompt_includes_meeting_context(self):
        prompt = build_meeting_transcription_prompt(
            meeting_title="Cell Division Review",
            recent_transcript_lines=[
                "Revise mitosis checkpoints.",
                "Students are unsure about metaphase.",
            ],
        )

        self.assertIn("Cell Division Review", prompt)
        self.assertIn("mitosis checkpoints", prompt)
        self.assertIn("metaphase", prompt)
        self.assertIn("Ignore filler words", prompt)


class MeetingAssistantRouteTest(unittest.TestCase):
    def test_meeting_assistant_routes_exist(self):
        client = TestClient(app)

        transcript_response = client.post(
            "/api/classrooms/example-classroom/meetings/example-meeting/transcripts",
            json={"speaker_role": "teacher", "speaker_name": "Dr. Bio", "content": "Revise osmosis for tomorrow."},
        )
        event_response = client.post(
            "/api/classrooms/example-classroom/meetings/example-meeting/events",
            json={"event_type": "doubt_flag", "payload": {"question": "What is diffusion?"}},
        )
        snapshot_response = client.get(
            "/api/classrooms/example-classroom/meetings/example-meeting/assistant",
        )
        recap_response = client.get(
            "/api/classrooms/example-classroom/meetings/example-meeting/recap",
        )
        audio_transcript_response = client.post(
            "/api/classrooms/example-classroom/meetings/example-meeting/transcriptions/audio",
        )

        self.assertNotEqual(transcript_response.status_code, 404)
        self.assertNotEqual(event_response.status_code, 404)
        self.assertNotEqual(snapshot_response.status_code, 404)
        self.assertNotEqual(recap_response.status_code, 404)
        self.assertNotEqual(audio_transcript_response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
