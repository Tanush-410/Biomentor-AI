"""Routers package initialization."""
from .auth import router as auth_router
from .classrooms import router as classrooms_router
from .collaboration import router as collaboration_router
from .documents import router as documents_router
from .educator import router as educator_router
from .quiz import router as quiz_router
from .qa import router as qa_router

__all__ = [
    "auth_router",
    "classrooms_router",
    "collaboration_router",
    "documents_router",
    "educator_router",
    "quiz_router",
    "qa_router"
]
