"""In-memory signaling manager for classroom live meetings."""
from __future__ import annotations

from collections import defaultdict
from typing import Any

from fastapi import WebSocket


class MeetingSignalingManager:
    """Track sockets and lightweight participant metadata per meeting room."""

    def __init__(self) -> None:
        self.rooms: dict[str, dict[str, WebSocket]] = defaultdict(dict)
        self.participants: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
        # One "shared tool" (Math Lab, Quantum Lab, Bio Lab, 3D Studio) can be
        # live-presented per meeting at a time. This tracks who's presenting,
        # which tool, and the last broadcast state so a participant who joins
        # mid-presentation can be caught up immediately instead of seeing
        # nothing until the presenter's next action.
        self.shared_tool: dict[str, dict[str, Any]] = {}

    async def connect(
        self,
        meeting_id: str,
        user_id: str,
        websocket: WebSocket,
        participant: dict[str, Any],
    ) -> None:
        await websocket.accept()
        self.rooms[meeting_id][user_id] = websocket
        self.participants[meeting_id][user_id] = participant

    def disconnect(self, meeting_id: str, user_id: str) -> None:
        room = self.rooms.get(meeting_id, {})
        room.pop(user_id, None)
        if not room and meeting_id in self.rooms:
            self.rooms.pop(meeting_id, None)

        participants = self.participants.get(meeting_id, {})
        participants.pop(user_id, None)
        if not participants and meeting_id in self.participants:
            self.participants.pop(meeting_id, None)
        if not participants and meeting_id in self.shared_tool:
            self.shared_tool.pop(meeting_id, None)

    def list_participants(self, meeting_id: str) -> list[dict[str, Any]]:
        return list(self.participants.get(meeting_id, {}).values())

    def start_shared_tool(self, meeting_id: str, presenter_id: str, presenter_name: str, tool: str) -> None:
        self.shared_tool[meeting_id] = {
            "tool": tool,
            "presenter_id": presenter_id,
            "presenter_name": presenter_name,
            "state": None,
        }

    def update_shared_tool_state(self, meeting_id: str, presenter_id: str, state: Any) -> bool:
        """Update the live state for the current presenter's shared tool.
        Returns False (and updates nothing) if presenter_id isn't the
        currently tracked presenter -- this is what stops a non-presenting
        participant from overwriting what everyone else sees."""
        entry = self.shared_tool.get(meeting_id)
        if not entry or entry["presenter_id"] != presenter_id:
            return False
        entry["state"] = state
        return True

    def get_shared_tool(self, meeting_id: str) -> dict[str, Any] | None:
        return self.shared_tool.get(meeting_id)

    def clear_shared_tool(self, meeting_id: str, presenter_id: str | None = None) -> bool:
        """Clear the shared tool. If presenter_id is given, only clears when
        it matches the tracked presenter (or nothing is tracked)."""
        entry = self.shared_tool.get(meeting_id)
        if not entry:
            return False
        if presenter_id and entry["presenter_id"] != presenter_id:
            return False
        self.shared_tool.pop(meeting_id, None)
        return True

    def _drop_socket(self, meeting_id: str, user_id: str) -> None:
        self.disconnect(meeting_id, user_id)

    async def broadcast(
        self,
        meeting_id: str,
        payload: dict[str, Any],
        exclude_user_id: str | None = None,
    ) -> None:
        for user_id, socket in list(self.rooms.get(meeting_id, {}).items()):
            if exclude_user_id and user_id == exclude_user_id:
                continue
            try:
                await socket.send_json(payload)
            except RuntimeError:
                self._drop_socket(meeting_id, user_id)
            except Exception:
                self._drop_socket(meeting_id, user_id)

    async def send_to(self, meeting_id: str, user_id: str, payload: dict[str, Any]) -> None:
        socket = self.rooms.get(meeting_id, {}).get(user_id)
        if socket:
            try:
                await socket.send_json(payload)
            except RuntimeError:
                self._drop_socket(meeting_id, user_id)
            except Exception:
                self._drop_socket(meeting_id, user_id)
