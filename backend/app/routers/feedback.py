"""Feedback exchanged between students and the educators of their classrooms.

A feedback entry is always scoped to a classroom, since that's the real-world
relationship being rated: a student is giving feedback about a specific
educator's specific class, and an educator is giving feedback about a
specific student's participation in a specific class. This lets:
  - a student enrolled in several classrooms send feedback to each class's
    educator independently
  - an educator teaching several classrooms see feedback rolled up across
    every class they teach, or filtered down to just one
"""
from __future__ import annotations

from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.security import enforce_rate_limit
from app.database import get_db
from app.database.models import Classroom, ClassroomEnrollment, Feedback, User
from app.routers.auth import get_current_user
from app.schemas import FeedbackCreate
from app.services.classroom_hub import create_notifications, list_classroom_students

router = APIRouter(prefix="/api/feedback", tags=["feedback"])

FEEDBACK_CATEGORIES = {"teaching_quality", "class_pace", "materials", "communication", "participation", "general"}


def _student_active_classrooms(db: Session, student_id: str) -> List[Classroom]:
    return (
        db.query(Classroom)
        .join(ClassroomEnrollment, ClassroomEnrollment.classroom_id == Classroom.id)
        .filter(
            ClassroomEnrollment.student_id == student_id,
            ClassroomEnrollment.status == "active",
            Classroom.is_active == True,  # noqa: E712
        )
        .order_by(Classroom.name.asc())
        .all()
    )


def _educator_classrooms(db: Session, educator_id: str) -> List[Classroom]:
    return (
        db.query(Classroom)
        .filter(Classroom.educator_id == educator_id, Classroom.is_active == True)  # noqa: E712
        .order_by(Classroom.name.asc())
        .all()
    )


@router.get("/targets")
async def list_feedback_targets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List who the current user is allowed to send feedback to, grouped by
    the classroom that relationship is grounded in. Powers the "send
    feedback to..." picker on the frontend without it needing to know
    anything about enrollment rules itself."""
    if current_user.role == "student":
        classrooms = _student_active_classrooms(db, current_user.id)
        educator_ids = [classroom.educator_id for classroom in classrooms]
        educators: Dict[str, User] = {
            user.id: user for user in db.query(User).filter(User.id.in_(educator_ids)).all()
        } if educator_ids else {}
        return {
            "role": "student",
            "targets": [
                {
                    "classroom_id": classroom.id,
                    "classroom_name": classroom.name,
                    "user_id": classroom.educator_id,
                    "user_name": educators[classroom.educator_id].full_name,
                    "user_role": "educator",
                }
                for classroom in classrooms
                if classroom.educator_id in educators
            ],
        }

    if current_user.role in {"educator", "admin"}:
        classrooms = _educator_classrooms(db, current_user.id)
        targets = [
            {
                "classroom_id": classroom.id,
                "classroom_name": classroom.name,
                "user_id": student.id,
                "user_name": student.full_name,
                "user_role": "student",
            }
            for classroom in classrooms
            for _enrollment, student in list_classroom_students(db, classroom.id)
        ]
        return {"role": "educator", "targets": targets}

    return {"role": current_user.role, "targets": []}


def _serialize_feedback(
    feedback: Feedback,
    sender: Optional[User],
    recipient: Optional[User],
    classroom: Optional[Classroom],
    viewer_id: str,
) -> dict:
    # Anonymity hides the sender's identity from everyone except the sender
    # looking at their own sent history.
    reveal_sender = not feedback.is_anonymous or feedback.from_user_id == viewer_id
    return {
        "id": feedback.id,
        "classroom_id": feedback.classroom_id,
        "classroom_name": classroom.name if classroom else None,
        "from_user_id": feedback.from_user_id if reveal_sender else None,
        "from_user_name": (sender.full_name if sender else "Someone") if reveal_sender else "Anonymous",
        "from_role": feedback.from_role,
        "to_user_id": feedback.to_user_id,
        "to_user_name": recipient.full_name if recipient else None,
        "to_role": feedback.to_role,
        "rating": feedback.rating,
        "message": feedback.message,
        "category": feedback.category,
        "is_anonymous": feedback.is_anonymous,
        "created_at": feedback.created_at.isoformat(),
    }


@router.post("/submit")
async def submit_feedback(
    payload: FeedbackCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send feedback -- student to educator, or educator to student -- always
    validated against a real, active classroom relationship rather than
    trusting the client. This is what stops a student from sending feedback
    to an educator who doesn't teach them, or vice versa."""
    enforce_rate_limit(request, "feedback-submit", limit=30, window_seconds=300)

    if current_user.role not in {"student", "educator", "admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only students and educators can send feedback.")

    classroom = db.query(Classroom).filter(Classroom.id == payload.classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found.")

    category = payload.category if payload.category in FEEDBACK_CATEGORIES else "general"
    is_anonymous = payload.is_anonymous

    if current_user.role == "student":
        enrollment = (
            db.query(ClassroomEnrollment)
            .filter(
                ClassroomEnrollment.classroom_id == classroom.id,
                ClassroomEnrollment.student_id == current_user.id,
                ClassroomEnrollment.status == "active",
            )
            .first()
        )
        if not enrollment:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not enrolled in this classroom.")
        if payload.to_user_id != classroom.educator_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="That educator does not teach this classroom.")
        from_role, to_role = "student", "educator"
    else:
        if classroom.educator_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not teach this classroom.")
        recipient_enrollment = (
            db.query(ClassroomEnrollment)
            .filter(
                ClassroomEnrollment.classroom_id == classroom.id,
                ClassroomEnrollment.student_id == payload.to_user_id,
                ClassroomEnrollment.status == "active",
            )
            .first()
        )
        if not recipient_enrollment:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="That student is not enrolled in this classroom.")
        from_role, to_role = "educator", "student"
        is_anonymous = False  # Anonymity is only meaningful going student -> educator.

    feedback = Feedback(
        classroom_id=classroom.id,
        from_user_id=current_user.id,
        from_role=from_role,
        to_user_id=payload.to_user_id,
        to_role=to_role,
        rating=payload.rating,
        message=payload.message.strip(),
        category=category,
        is_anonymous=is_anonymous,
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)

    sender_label = "Someone" if is_anonymous else current_user.full_name
    create_notifications(
        db,
        [payload.to_user_id],
        classroom.id,
        "feedback_received",
        f"New feedback in {classroom.name}",
        f"{sender_label} sent you feedback.",
        "/feedback",
    )

    recipient = db.query(User).filter(User.id == payload.to_user_id).first()
    return _serialize_feedback(feedback, current_user, recipient, classroom, current_user.id)


@router.get("/received")
async def list_received_feedback(
    classroom_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Feedback the current user has received, newest first, with rating
    stats overall and per classroom. An educator teaching five classrooms
    gets all five rolled together here unless classroom_id filters it down."""
    query = db.query(Feedback).filter(Feedback.to_user_id == current_user.id)
    if classroom_id:
        query = query.filter(Feedback.classroom_id == classroom_id)
    items = query.order_by(Feedback.created_at.desc()).all()

    sender_ids = {item.from_user_id for item in items}
    classroom_ids = {item.classroom_id for item in items}
    senders: Dict[str, User] = {
        user.id: user for user in db.query(User).filter(User.id.in_(sender_ids)).all()
    } if sender_ids else {}
    classrooms: Dict[str, Classroom] = {
        c.id: c for c in db.query(Classroom).filter(Classroom.id.in_(classroom_ids)).all()
    } if classroom_ids else {}

    rated = [item.rating for item in items if item.rating]
    average_rating = round(sum(rated) / len(rated), 2) if rated else None

    by_classroom: Dict[str, dict] = {}
    for item in items:
        bucket = by_classroom.setdefault(
            item.classroom_id,
            {
                "classroom_id": item.classroom_id,
                "classroom_name": classrooms[item.classroom_id].name if item.classroom_id in classrooms else None,
                "count": 0,
                "ratings": [],
            },
        )
        bucket["count"] += 1
        if item.rating:
            bucket["ratings"].append(item.rating)

    return {
        "count": len(items),
        "average_rating": average_rating,
        "by_classroom": [
            {
                "classroom_id": bucket["classroom_id"],
                "classroom_name": bucket["classroom_name"],
                "count": bucket["count"],
                "average_rating": round(sum(bucket["ratings"]) / len(bucket["ratings"]), 2) if bucket["ratings"] else None,
            }
            for bucket in by_classroom.values()
        ],
        "feedback": [
            _serialize_feedback(
                item,
                senders.get(item.from_user_id),
                current_user,
                classrooms.get(item.classroom_id),
                current_user.id,
            )
            for item in items
        ],
    }


@router.get("/sent")
async def list_sent_feedback(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Feedback the current user has sent, newest first."""
    items = (
        db.query(Feedback)
        .filter(Feedback.from_user_id == current_user.id)
        .order_by(Feedback.created_at.desc())
        .all()
    )
    recipient_ids = {item.to_user_id for item in items}
    classroom_ids = {item.classroom_id for item in items}
    recipients: Dict[str, User] = {
        user.id: user for user in db.query(User).filter(User.id.in_(recipient_ids)).all()
    } if recipient_ids else {}
    classrooms: Dict[str, Classroom] = {
        c.id: c for c in db.query(Classroom).filter(Classroom.id.in_(classroom_ids)).all()
    } if classroom_ids else {}

    return {
        "feedback": [
            _serialize_feedback(
                item,
                current_user,
                recipients.get(item.to_user_id),
                classrooms.get(item.classroom_id),
                current_user.id,
            )
            for item in items
        ]
    }


@router.delete("/{feedback_id}")
async def delete_feedback(
    feedback_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retract a piece of feedback you sent."""
    feedback = (
        db.query(Feedback)
        .filter(Feedback.id == feedback_id, Feedback.from_user_id == current_user.id)
        .first()
    )
    if not feedback:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feedback not found.")
    db.delete(feedback)
    db.commit()
    return {"message": "Feedback removed."}
