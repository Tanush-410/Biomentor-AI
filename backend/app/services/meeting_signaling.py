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

    def list_participants(self, meeting_id: str) -> list[dict[str, Any]]:
        return list(self.participants.get(meeting_id, {}).values())

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
