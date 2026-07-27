"""Routers package initialization."""
from .auth import router as auth_router
from .bio_lab import router as bio_lab_router
from .certificates import router as certificates_router
from .classrooms import router as classrooms_router
from .collaboration import router as collaboration_router
from .documents import router as documents_router
from .educator import router as educator_router
from .feedback import router as feedback_router
from .math_lab import router as math_lab_router
from .quantum_lab import router as quantum_lab_router
from .quiz import router as quiz_router
from .qa import router as qa_router
from .sticky_notes import router as sticky_notes_router

__all__ = [
    "auth_router",
    "bio_lab_router",
    "certificates_router",
    "classrooms_router",
    "collaboration_router",
    "documents_router",
    "educator_router",
    "feedback_router",
    "math_lab_router",
    "quantum_lab_router",
    "quiz_router",
    "qa_router",
    "sticky_notes_router",
]
