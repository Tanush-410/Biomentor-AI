"""Learning chat, gaps detection, and analytics endpoints."""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.database.models import Document, User
from app.routers.auth import get_current_user
from app.routers.qa import build_answer_response
from app.schemas import (
    AnswerGenerationRequest,
    StudyCoachChatSuggestionsResponse,
    StudyCoachMaterialsResponse,
    StudyCoachOverviewResponse,
    StudyCoachProgressResponse,
)
from app.services.learning_analytics import build_gap_list, build_progress_payload, build_recommendations
from app.services.study_coach import (
    build_study_coach_chat_payload,
    build_study_coach_materials_payload,
    build_study_coach_overview,
    build_study_coach_progress_payload,
)

router = APIRouter(prefix="/api", tags=["learning"])


def _load_user_documents(db: Session, user_id: str) -> List[dict]:
    documents = (
        db.query(Document)
        .filter(Document.user_id == user_id)
        .order_by(Document.created_at.desc())
        .all()
    )
    return [
        {
            "id": document.id,
            "title": document.title,
            "file_name": document.file_name,
        }
        for document in documents
    ]


class ChatMessage(BaseModel):
    content: str
    document_id: Optional[str] = None


class GapDetection(BaseModel):
    topic: str
    level: str
    gap_percentage: float


class ProgressData(BaseModel):
    total_quizzes: int
    average_score: float
    mastered_topics: int
    study_streak: int
    gaps: List[GapDetection]
    recommendations: List[str]


@router.post("/chat/send")
async def send_chat_message(
    message: ChatMessage,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Answer a student message using the same retrieval pipeline as Learning Chat."""
    try:
        answer = build_answer_response(
            db,
            current_user,
            AnswerGenerationRequest(
                question=message.content,
                document_ids=[message.document_id] if message.document_id else None,
                include_sources=True,
            ),
        )
        return {
            "success": True,
            "message": {
                "role": "assistant",
                "content": answer.answer,
                "sources": [
                    {
                        "doc_id": source.document_id,
                        "document_title": source.document_title,
                        "page_number": source.page_number,
                        "chunk_index": source.chunk_index,
                        "excerpt": source.excerpt,
                    }
                    for source in answer.sources
                ],
            },
            "timestamp": datetime.utcnow().isoformat(),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/gaps/detect")
async def detect_knowledge_gaps(
    quiz_responses: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Analyze submitted quiz-level results to estimate immediate gaps."""
    try:
        bloom_levels = quiz_responses.get("bloom_levels", []) if isinstance(quiz_responses, dict) else []
        gaps = []
        for item in bloom_levels:
            total = max(int(item.get("total", 0)), 1)
            correct = max(int(item.get("correct", 0)), 0)
            label = item.get("level") or "Unknown"
            gaps.append(
                {
                    "topic": label,
                    "level": label,
                    "gap_percentage": round(max(0.0, 100 - ((correct / total) * 100)), 1),
                }
            )

        gaps.sort(key=lambda gap: gap["gap_percentage"], reverse=True)
        return {
            "success": True,
            "gaps": gaps,
            "analysis": (
                f"Your largest current gap is in {gaps[0]['level']} questions."
                if gaps else
                "No Bloom-level response data was provided."
            ),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/gaps/list")
async def get_knowledge_gaps(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the user's persisted Bloom-level gap list."""
    try:
        progress_payload = build_progress_payload(db, current_user.id)
        gaps = build_gap_list(progress_payload)
        return {"success": True, "gaps": gaps, "total_gaps": len(gaps)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/progress/tracker")
async def get_progress_tracker(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get derived progress metrics for charts and progress cards."""
    try:
        progress_payload = build_progress_payload(db, current_user.id)
        gaps = build_gap_list(progress_payload)
        progress_data = {
            "total_quizzes": progress_payload["totalQuizzes"],
            "average_score": progress_payload["averageScore"],
            "mastered_topics": sum(
                1
                for stats in progress_payload["bloomLevelStats"].values()
                if stats["count"] > 0 and stats["average"] >= 80
            ),
            "study_streak": min(progress_payload["totalQuizzes"], 7),
            "bloom_levels": {
                stats["name"]: {
                    "correct": round((stats["average"] / 100) * stats["count"]),
                    "total": stats["count"],
                    "percentage": round(stats["average"]),
                }
                for stats in progress_payload["bloomLevelStats"].values()
            },
            "topic_mastery": [
                {"topic": gap["level"], "mastery": round(100 - gap["gap_percentage"])}
                for gap in gaps[:6]
            ],
            "recent_quizzes": progress_payload["recentQuizzes"],
        }
        return {"success": True, "data": progress_data}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/recommendations/study-plan")
async def get_study_recommendations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get personalized recommendations from live quiz history and materials."""
    try:
        progress_payload = build_progress_payload(db, current_user.id)
        recommendations = build_recommendations(db, current_user.id, progress_payload)
        return {"success": True, "recommendations": recommendations}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/study-coach/overview", response_model=StudyCoachOverviewResponse)
async def get_study_coach_overview(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the dashboard-focused Study Coach payload."""
    progress_payload = build_progress_payload(db, current_user.id)
    recommendations = build_recommendations(db, current_user.id, progress_payload)
    documents = _load_user_documents(db, current_user.id)
    return build_study_coach_overview(progress_payload, recommendations, documents)


@router.get("/study-coach/progress", response_model=StudyCoachProgressResponse)
async def get_study_coach_progress(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return progress-specific Study Coach interpretation."""
    progress_payload = build_progress_payload(db, current_user.id)
    return build_study_coach_progress_payload(progress_payload)


@router.get("/study-coach/materials", response_model=StudyCoachMaterialsResponse)
async def get_study_coach_materials(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return materials-page Study Coach recommendations."""
    progress_payload = build_progress_payload(db, current_user.id)
    documents = _load_user_documents(db, current_user.id)
    return build_study_coach_materials_payload(documents, build_gap_list(progress_payload))


@router.get("/study-coach/chat-suggestions", response_model=StudyCoachChatSuggestionsResponse)
async def get_study_coach_chat_suggestions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return Learning Chat follow-up coaching."""
    progress_payload = build_progress_payload(db, current_user.id)
    documents = _load_user_documents(db, current_user.id)
    return build_study_coach_chat_payload(build_gap_list(progress_payload), documents)


@router.get("/teacher/class-overview")
async def get_class_overview(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Teacher analytics are planned for a later phase."""
    raise HTTPException(
        status_code=501,
        detail="Teacher analytics are planned for a later phase and are not yet implemented.",
    )


@router.get("/teacher/student-analytics/{student_id}")
async def get_student_analytics(
    student_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Teacher analytics are planned for a later phase."""
    raise HTTPException(
        status_code=501,
        detail="Teacher analytics are planned for a later phase and are not yet implemented.",
    )


@router.get("/resources/")
async def get_resources(
    category: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return lightweight static resources until content integrations arrive."""
    resources = [
        {
            "id": 1,
            "title": "Review With Learning Chat",
            "type": "chat",
            "difficulty": "Understand",
            "topic": "Uploaded Material",
            "description": "Ask a source-grounded question about your uploaded document.",
        },
        {
            "id": 2,
            "title": "Bloom's Quiz Practice",
            "type": "quiz",
            "difficulty": "Apply",
            "topic": "Bloom's Taxonomy",
            "description": "Generate a quiz from your uploaded material and focus on one Bloom level.",
        },
        {
            "id": 3,
            "title": "Offline PDF Review",
            "type": "document",
            "difficulty": "Remember",
            "topic": "Study Review",
            "description": "Open a saved PDF offline and revisit the cited sections before retrying a quiz.",
        },
    ]
    if category:
        resources = [item for item in resources if item["type"] == category]
    return {"success": True, "resources": resources}
