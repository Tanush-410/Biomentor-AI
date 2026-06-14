import os
import sys
import unittest

from fastapi.testclient import TestClient


CURRENT_DIR = os.path.dirname(__file__)
BACKEND_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.main import app  # noqa: E402
from app.database.models import ClassroomLiveMeeting  # noqa: E402
from app.schemas import ClassroomMeetingCreate, ClassroomMeetingResponse  # noqa: E402


class ClassroomLiveMeetingModelTest(unittest.TestCase):
    def test_live_meeting_model_and_schemas_exist(self):
        self.assertIsNotNone(ClassroomLiveMeeting)
        self.assertIsNotNone(ClassroomMeetingCreate)
        self.assertIsNotNone(ClassroomMeetingResponse)


class ClassroomLiveMeetingRouteTest(unittest.TestCase):
    def test_meeting_routes_exist(self):
        client = TestClient(app)
        create_response = client.post("/api/classrooms/example/meetings", json={})
        list_response = client.get("/api/classrooms/example/meetings")
        detail_response = client.get("/api/classrooms/example/meetings/example-meeting")
        start_response = client.post("/api/classrooms/example/meetings/example-meeting/start", json={})
        end_response = client.post("/api/classrooms/example/meetings/example-meeting/end", json={})

        self.assertNotEqual(create_response.status_code, 404)
        self.assertNotEqual(list_response.status_code, 404)
        self.assertNotEqual(detail_response.status_code, 404)
        self.assertNotEqual(start_response.status_code, 404)
        self.assertNotEqual(end_response.status_code, 404)


class MeetingSignalingSmokeTest(unittest.TestCase):
    def test_signaling_manager_exists(self):
        from app.services.meeting_signaling import MeetingSignalingManager  # noqa: E402

        self.assertIsNotNone(MeetingSignalingManager)


class ClassroomJoinRouteTest(unittest.TestCase):
    def test_shared_classroom_join_route_exists(self):
        client = TestClient(app)
        join_response = client.post("/api/classrooms/join", json={"invite_code": "ABC123"})
        self.assertNotEqual(join_response.status_code, 404)

    def test_classroom_quiz_heartbeat_route_exists(self):
        client = TestClient(app)
        heartbeat_response = client.post(
            "/api/classrooms/example-classroom/quizzes/example-quiz/heartbeat",
            json={"attempt_id": "example-attempt"},
        )
        self.assertNotEqual(heartbeat_response.status_code, 404)

    def test_classroom_quiz_warning_route_exists(self):
        client = TestClient(app)
        warning_response = client.post(
            "/api/classrooms/example-classroom/quizzes/example-quiz/warning",
            json={"attempt_id": "example-attempt", "warning_type": "multiple_faces"},
        )
        self.assertNotEqual(warning_response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
