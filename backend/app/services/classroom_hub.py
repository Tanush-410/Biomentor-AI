"""Shared helpers for classroom hub routes."""
from __future__ import annotations

from datetime import datetime
from typing import Iterable, List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.database.models import (
    Classroom,
    ClassroomEnrollment,
    ClassroomMessageThread,
    Notification,
    User,
)


def get_accessible_classroom(db: Session, classroom_id: str, current_user: User) -> Classroom:
    """Return a classroom the current user is allowed to view."""
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id, Classroom.is_active == True).first()  # noqa: E712
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")

    if current_user.role == "admin":
        return classroom

    if current_user.role == "educator" and classroom.educator_id == current_user.id:
        return classroom

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
        if enrollment:
            return classroom

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this classroom.")


def list_classroom_students(db: Session, classroom_id: str) -> List[tuple[ClassroomEnrollment, User]]:
    """Fetch active students in a classroom."""
    return (
        db.query(ClassroomEnrollment, User)
        .join(User, User.id == ClassroomEnrollment.student_id)
        .filter(
            ClassroomEnrollment.classroom_id == classroom_id,
            ClassroomEnrollment.status == "active",
        )
        .order_by(User.full_name.asc())
        .all()
    )


def get_thread_for_user(
    db: Session,
    classroom_id: str,
    thread_id: str,
    current_user: User,
) -> ClassroomMessageThread:
    """Validate that the user can open a private classroom thread."""
    thread = (
        db.query(ClassroomMessageThread)
        .filter(
            ClassroomMessageThread.id == thread_id,
            ClassroomMessageThread.classroom_id == classroom_id,
        )
        .first()
    )
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    if current_user.role == "admin":
        return thread

    if current_user.role == "educator" and thread.teacher_id == current_user.id:
        return thread

    if current_user.role == "student" and thread.student_id == current_user.id:
        return thread

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this thread.")


def get_or_create_thread(
    db: Session,
    classroom: Classroom,
    current_user: User,
    recipient_id: Optional[str] = None,
) -> ClassroomMessageThread:
    """Create a persistent educator-student thread if it does not already exist."""
    if current_user.role == "student":
        teacher_id = classroom.educator_id
        student_id = current_user.id
        if recipient_id and recipient_id != teacher_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Students can only message classroom teachers.")
    elif current_user.role == "educator":
        if classroom.educator_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this classroom.")
        if not recipient_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Choose a student to message.")
        student_id = recipient_id
        teacher_id = current_user.id
        enrollment = (
            db.query(ClassroomEnrollment)
            .filter(
                ClassroomEnrollment.classroom_id == classroom.id,
                ClassroomEnrollment.student_id == student_id,
                ClassroomEnrollment.status == "active",
            )
            .first()
        )
        if not enrollment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student is not enrolled in this classroom.")
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only students and educators can start classroom threads.")

    thread = (
        db.query(ClassroomMessageThread)
        .filter(
            ClassroomMessageThread.classroom_id == classroom.id,
            ClassroomMessageThread.teacher_id == teacher_id,
            ClassroomMessageThread.student_id == student_id,
        )
        .first()
    )
    if thread:
        return thread

    thread = ClassroomMessageThread(
        classroom_id=classroom.id,
        teacher_id=teacher_id,
        student_id=student_id,
        last_message_at=datetime.utcnow(),
    )
    db.add(thread)
    db.commit()
    db.refresh(thread)
    return thread


def create_notifications(
    db: Session,
    user_ids: Iterable[str],
    classroom_id: Optional[str],
    notification_type: str,
    title: str,
    body: str,
    action_url: Optional[str] = None,
) -> None:
    """Create in-app notifications in an email-ready shape."""
    user_id_list = [user_id for user_id in user_ids if user_id]
    for user_id in user_id_list:
        db.add(
            Notification(
                user_id=user_id,
                classroom_id=classroom_id,
                type=notification_type,
                title=title,
                body=body,
                action_url=action_url,
                delivery_channels=["in_app"],
            )
        )
    if user_id_list:
        db.commit()
