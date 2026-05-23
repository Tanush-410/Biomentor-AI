"""Shared classroom hub routes for student and educator flows."""
from __future__ import annotations

from datetime import datetime
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.database.models import (
    Classroom,
    ClassroomAnnouncement,
    ClassroomAssignment,
    ClassroomEnrollment,
    ClassroomQuiz,
    ClassroomQuizAttempt,
    ClassroomQuizViolation,
    ClassroomMaterial,
    ClassroomMessageThread,
    ClassroomThreadMessage,
    Document,
    DocumentChunk,
    GeneratedQuestion,
    LiveSession,
    Notification,
    QuizAnswer,
    QuizSession,
    User,
)
from app.routers.auth import get_current_user, require_roles
from app.schemas import (
    ClassroomAnnouncementCreate,
    ClassroomAssignmentCreate,
    ClassroomQuizAttemptSubmit,
    ClassroomQuizCreate,
    ClassroomLiveScheduleCreate,
    ClassroomMaterialShareCreate,
    ClassroomThreadCreate,
    ClassroomThreadMessageCreate,
    ClassroomQuizViolationCreate,
    LiveSessionCreate,
)
from app.agents.question_generator import QuestionGenerator
from app.services.classroom_quiz_authoring import (
    build_manual_generated_questions,
    normalize_manual_questions,
)
from app.services.document_context import build_context_window
from app.services.classroom_hub import (
    create_notifications,
    get_accessible_classroom,
    get_or_create_thread,
    get_thread_for_user,
    list_classroom_students,
)

router = APIRouter(prefix="/api/classrooms", tags=["classrooms"])


@router.get("/notifications")
async def list_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return recent in-app notifications for the current user."""
    notifications = (
        db.query(Notification, Classroom)
        .outerjoin(Classroom, Classroom.id == Notification.classroom_id)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )
    return {
        "notifications": [
            {
                "id": notification.id,
                "type": notification.type,
                "title": notification.title,
                "body": notification.body,
                "action_url": notification.action_url,
                "classroom_id": notification.classroom_id,
                "classroom_name": classroom.name if classroom else None,
                "is_read": notification.read_at is not None,
                "created_at": notification.created_at.isoformat(),
            }
            for notification, classroom in notifications
        ]
    }


@router.post("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a notification as read."""
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == current_user.id)
        .first()
    )
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    notification.read_at = datetime.utcnow()
    db.commit()
    return {"message": "Notification marked as read."}


@router.get("")
async def list_classrooms(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List classrooms visible to the current user."""
    if current_user.role == "admin":
        classrooms = db.query(Classroom).order_by(Classroom.updated_at.desc()).all()
    elif current_user.role == "educator":
        classrooms = (
            db.query(Classroom)
            .filter(Classroom.educator_id == current_user.id)
            .order_by(Classroom.updated_at.desc())
            .all()
        )
    else:
        classrooms = (
            db.query(Classroom)
            .join(ClassroomEnrollment, ClassroomEnrollment.classroom_id == Classroom.id)
            .filter(
                ClassroomEnrollment.student_id == current_user.id,
                ClassroomEnrollment.status == "active",
            )
            .order_by(ClassroomEnrollment.joined_at.desc())
            .all()
        )

    classroom_ids = [classroom.id for classroom in classrooms]
    student_counts = {}
    if classroom_ids:
        for classroom_id, student in list_classroom_students_grouped(db, classroom_ids):
            student_counts[classroom_id] = student_counts.get(classroom_id, 0) + 1

    notifications = {}
    if classroom_ids:
        unread = (
            db.query(Notification.classroom_id)
            .filter(
                Notification.user_id == current_user.id,
                Notification.classroom_id.in_(classroom_ids),
                Notification.read_at.is_(None),
            )
            .all()
        )
        for classroom_id, in unread:
            notifications[classroom_id] = notifications.get(classroom_id, 0) + 1

    return {
        "classrooms": [
            {
                "id": classroom.id,
                "name": classroom.name,
                "subject": classroom.subject,
                "description": classroom.description,
                "invite_code": classroom.invite_code,
                "role": current_user.role,
                "student_count": student_counts.get(classroom.id, 0),
                "unread_notifications": notifications.get(classroom.id, 0),
                "updated_at": classroom.updated_at.isoformat(),
            }
            for classroom in classrooms
        ]
    }


@router.get("/{classroom_id}")
async def get_classroom_detail(
    classroom_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return summary data for a classroom home page."""
    classroom = get_accessible_classroom(db, classroom_id, current_user)
    student_rows = list_classroom_students(db, classroom.id)
    latest_live = (
        db.query(LiveSession)
        .filter(LiveSession.classroom_id == classroom.id)
        .order_by(LiveSession.scheduled_for.is_(None), LiveSession.scheduled_for.asc(), LiveSession.created_at.desc())
        .first()
    )
    unread_count = (
        db.query(Notification)
        .filter(
            Notification.user_id == current_user.id,
            Notification.classroom_id == classroom.id,
            Notification.read_at.is_(None),
        )
        .count()
    )
    return {
        "classroom": {
            "id": classroom.id,
            "name": classroom.name,
            "subject": classroom.subject,
            "description": classroom.description,
            "invite_code": classroom.invite_code,
            "role": current_user.role,
            "educator_id": classroom.educator_id,
            "student_count": len(student_rows),
            "unread_notifications": unread_count,
            "next_live_session": serialize_live_session(latest_live) if latest_live else None,
        }
    }


@router.get("/{classroom_id}/stream")
async def get_classroom_stream(
    classroom_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return public classroom stream posts."""
    classroom = get_accessible_classroom(db, classroom_id, current_user)
    announcements = (
        db.query(ClassroomAnnouncement, User, Document, LiveSession)
        .join(User, User.id == ClassroomAnnouncement.author_id)
        .outerjoin(Document, Document.id == ClassroomAnnouncement.linked_document_id)
        .outerjoin(LiveSession, LiveSession.id == ClassroomAnnouncement.linked_live_session_id)
        .filter(ClassroomAnnouncement.classroom_id == classroom.id)
        .order_by(ClassroomAnnouncement.is_pinned.desc(), ClassroomAnnouncement.created_at.desc())
        .all()
    )
    return {
        "classroom": {"id": classroom.id, "name": classroom.name},
        "posts": [
            {
                "id": post.id,
                "title": post.title,
                "content": post.content,
                "post_type": post.post_type,
                "is_pinned": post.is_pinned,
                "author": {"id": author.id, "name": author.full_name, "role": author.role},
                "document": (
                    {"id": document.id, "title": document.title, "file_name": document.file_name}
                    if document
                    else None
                ),
                "live_session": serialize_live_session(live_session) if live_session else None,
                "created_at": post.created_at.isoformat(),
            }
            for post, author, document, live_session in announcements
        ],
    }


@router.post("/{classroom_id}/announcements")
async def create_classroom_announcement(
    classroom_id: str,
    payload: ClassroomAnnouncementCreate,
    current_user: User = Depends(require_roles("educator", "admin")),
    db: Session = Depends(get_db),
):
    """Create a public post in the classroom stream."""
    classroom = get_accessible_classroom(db, classroom_id, current_user)
    announcement = ClassroomAnnouncement(
        classroom_id=classroom.id,
        author_id=current_user.id,
        title=payload.title,
        content=payload.content,
        post_type=payload.post_type,
        linked_document_id=payload.linked_document_id,
        linked_live_session_id=payload.linked_live_session_id,
        is_pinned=payload.is_pinned,
    )
    db.add(announcement)
    db.commit()
    db.refresh(announcement)

    student_ids = [student.id for _, student in list_classroom_students(db, classroom.id)]
    create_notifications(
        db,
        student_ids,
        classroom.id,
        "classroom_announcement",
        payload.title or f"New update in {classroom.name}",
        payload.content,
        f"/classrooms/{classroom.id}/stream",
    )
    return {"message": "Announcement posted.", "announcement_id": announcement.id}


@router.get("/{classroom_id}/classwork")
async def get_classwork(
    classroom_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return classroom materials and assignments."""
    classroom = get_accessible_classroom(db, classroom_id, current_user)
    materials = (
        db.query(ClassroomMaterial, Document, User)
        .join(Document, Document.id == ClassroomMaterial.document_id)
        .join(User, User.id == ClassroomMaterial.shared_by_user_id)
        .filter(ClassroomMaterial.classroom_id == classroom.id)
        .order_by(ClassroomMaterial.created_at.desc())
        .all()
    )
    assignments = (
        db.query(ClassroomAssignment, User, Document)
        .join(User, User.id == ClassroomAssignment.educator_id)
        .outerjoin(Document, Document.id == ClassroomAssignment.document_id)
        .filter(ClassroomAssignment.classroom_id == classroom.id)
        .order_by(ClassroomAssignment.due_at.is_(None), ClassroomAssignment.due_at.asc(), ClassroomAssignment.created_at.desc())
        .all()
    )
    quizzes = (
        db.query(ClassroomQuiz, User, Document)
        .join(User, User.id == ClassroomQuiz.educator_id)
        .outerjoin(Document, Document.id == ClassroomQuiz.document_id)
        .filter(ClassroomQuiz.classroom_id == classroom.id)
        .order_by(ClassroomQuiz.available_from.is_(None), ClassroomQuiz.available_from.asc(), ClassroomQuiz.created_at.desc())
        .all()
    )
    return {
        "classroom": {"id": classroom.id, "name": classroom.name},
        "materials": [
            {
                "id": material.id,
                "document_id": document.id,
                "title": material.title_override or document.title,
                "description": material.description,
                "file_name": document.file_name,
                "shared_by": {"id": user.id, "name": user.full_name},
                "created_at": material.created_at.isoformat(),
            }
            for material, document, user in materials
        ],
        "assignments": [
            {
                "id": assignment.id,
                "title": assignment.title,
                "description": assignment.description,
                "assignment_type": assignment.assignment_type,
                "classroom_quiz_id": assignment.classroom_quiz_id,
                "quiz_reference": assignment.quiz_reference,
                "due_at": assignment.due_at.isoformat() if assignment.due_at else None,
                "document": (
                    {"id": document.id, "title": document.title, "file_name": document.file_name}
                    if document
                    else None
                ),
                "author": {"id": user.id, "name": user.full_name},
                "created_at": assignment.created_at.isoformat(),
            }
            for assignment, user, document in assignments
        ],
        "quizzes": [
            serialize_classroom_quiz(quiz, document, user, current_user, db)
            for quiz, user, document in quizzes
        ],
    }


@router.post("/{classroom_id}/materials")
async def share_material(
    classroom_id: str,
    payload: ClassroomMaterialShareCreate,
    current_user: User = Depends(require_roles("educator", "admin")),
    db: Session = Depends(get_db),
):
    """Share a document into classroom classwork."""
    classroom = get_accessible_classroom(db, classroom_id, current_user)
    document = db.query(Document).filter(Document.id == payload.document_id).first()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    material = ClassroomMaterial(
        classroom_id=classroom.id,
        document_id=document.id,
        shared_by_user_id=current_user.id,
        title_override=payload.title_override,
        description=payload.description,
    )
    db.add(material)
    db.commit()
    db.refresh(material)

    student_ids = [student.id for _, student in list_classroom_students(db, classroom.id)]
    create_notifications(
        db,
        student_ids,
        classroom.id,
        "classroom_material",
        payload.title_override or document.title,
        payload.description or "New material has been shared in your classroom.",
        f"/classrooms/{classroom.id}/classwork",
    )
    return {"message": "Material shared.", "material_id": material.id}


@router.post("/{classroom_id}/assignments")
async def create_assignment(
    classroom_id: str,
    payload: ClassroomAssignmentCreate,
    current_user: User = Depends(require_roles("educator", "admin")),
    db: Session = Depends(get_db),
):
    """Create a classwork assignment or quiz entry."""
    classroom = get_accessible_classroom(db, classroom_id, current_user)
    assignment = ClassroomAssignment(
        classroom_id=classroom.id,
        educator_id=current_user.id,
        title=payload.title,
        description=payload.description,
        assignment_type=payload.assignment_type,
        document_id=payload.document_id,
        quiz_reference=payload.quiz_reference,
        due_at=payload.due_at,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)

    student_ids = [student.id for _, student in list_classroom_students(db, classroom.id)]
    create_notifications(
        db,
        student_ids,
        classroom.id,
        "classroom_assignment",
        payload.title,
        payload.description or "A new task has been posted in classwork.",
        f"/classrooms/{classroom.id}/classwork",
    )
    return {"message": "Assignment created.", "assignment_id": assignment.id}


@router.get("/{classroom_id}/quizzes")
async def list_classroom_quizzes(
    classroom_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List published quizzes inside a classroom."""
    classroom = get_accessible_classroom(db, classroom_id, current_user)
    rows = (
        db.query(ClassroomQuiz, User, Document)
        .join(User, User.id == ClassroomQuiz.educator_id)
        .outerjoin(Document, Document.id == ClassroomQuiz.document_id)
        .filter(ClassroomQuiz.classroom_id == classroom.id)
        .order_by(ClassroomQuiz.available_from.is_(None), ClassroomQuiz.available_from.asc(), ClassroomQuiz.created_at.desc())
        .all()
    )
    return {
        "classroom": {"id": classroom.id, "name": classroom.name},
        "quizzes": [serialize_classroom_quiz(quiz, document, educator, current_user, db) for quiz, educator, document in rows],
    }


@router.post("/{classroom_id}/quizzes")
async def create_classroom_quiz(
    classroom_id: str,
    payload: ClassroomQuizCreate,
    current_user: User = Depends(require_roles("educator", "admin")),
    db: Session = Depends(get_db),
):
    """Create and publish a classroom quiz."""
    classroom = get_accessible_classroom(db, classroom_id, current_user)
    if payload.available_from and payload.available_until and payload.available_until <= payload.available_from:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quiz end time must be after the start time.")

    quiz_mode = (payload.quiz_mode or "generated").strip().lower()
    if quiz_mode not in {"generated", "manual"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quiz mode must be generated or manual.")

    document = None
    if payload.document_id:
        document = db.query(Document).filter(Document.id == payload.document_id).first()
        if not document:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    manual_questions = None
    resolved_num_questions = payload.num_questions
    resolved_bloom_level = payload.bloom_level
    if quiz_mode == "manual":
        try:
            manual_questions = normalize_manual_questions(
                [question.model_dump() if hasattr(question, "model_dump") else question.dict() for question in (payload.manual_questions or [])]
            )
        except ValueError as error:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error))
        resolved_num_questions = len(manual_questions)
        if manual_questions and resolved_bloom_level is None:
            resolved_bloom_level = max(question.get("bloom_level", 3) for question in manual_questions)
    elif payload.document_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Generated quizzes must be linked to study material.")

    quiz = ClassroomQuiz(
        classroom_id=classroom.id,
        educator_id=current_user.id,
        document_id=payload.document_id,
        title=payload.title,
        description=payload.description,
        quiz_mode=quiz_mode,
        manual_questions=manual_questions,
        bloom_level=resolved_bloom_level,
        num_questions=resolved_num_questions,
        duration_minutes=payload.duration_minutes,
        available_from=payload.available_from,
        available_until=payload.available_until,
        publish_to_stream=payload.publish_to_stream,
        proctoring_enabled=payload.proctoring_enabled,
        allow_late_entries=payload.allow_late_entries,
        status=resolve_quiz_status(payload.available_from, payload.available_until),
    )
    db.add(quiz)
    db.flush()

    assignment = ClassroomAssignment(
        classroom_id=classroom.id,
        educator_id=current_user.id,
        title=payload.title,
        description=payload.description,
        assignment_type="quiz",
        document_id=payload.document_id,
        classroom_quiz_id=quiz.id,
        quiz_reference=payload.title,
        due_at=payload.available_until,
    )
    db.add(assignment)

    if payload.publish_to_stream:
        db.add(
            ClassroomAnnouncement(
                classroom_id=classroom.id,
                author_id=current_user.id,
                title=payload.title,
                content=payload.description or "A new classroom quiz is available in classwork.",
                post_type="quiz",
                linked_document_id=payload.document_id,
            )
        )
    db.commit()
    db.refresh(quiz)

    student_ids = [student.id for _, student in list_classroom_students(db, classroom.id)]
    create_notifications(
        db,
        student_ids,
        classroom.id,
        "classroom_quiz_published",
        payload.title,
        payload.description or "A new quiz has been posted in your classroom.",
        f"/classrooms/{classroom.id}/quiz/{quiz.id}",
    )

    return {
        "message": "Quiz published.",
        "quiz": serialize_classroom_quiz(quiz, document, current_user, current_user, db),
    }


@router.get("/{classroom_id}/quizzes/{quiz_id}")
async def get_classroom_quiz_detail(
    classroom_id: str,
    quiz_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return one classroom quiz and the current user's latest attempt state."""
    classroom = get_accessible_classroom(db, classroom_id, current_user)
    quiz, document, educator = get_classroom_quiz_row(db, classroom.id, quiz_id)
    return {
        "classroom": {"id": classroom.id, "name": classroom.name},
        "quiz": serialize_classroom_quiz(quiz, document, educator, current_user, db, include_attempt=True),
    }


@router.post("/{classroom_id}/quizzes/{quiz_id}/start")
async def start_classroom_quiz(
    classroom_id: str,
    quiz_id: str,
    current_user: User = Depends(require_roles("student")),
    db: Session = Depends(get_db),
):
    """Start or resume a scheduled classroom quiz attempt."""
    classroom = get_accessible_classroom(db, classroom_id, current_user)
    quiz, document, educator = get_classroom_quiz_row(db, classroom.id, quiz_id)
    availability = get_quiz_availability_state(quiz)
    if availability == "upcoming":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This quiz is not open yet.")
    if availability == "closed":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This quiz is no longer accepting attempts.")

    attempt = (
        db.query(ClassroomQuizAttempt)
        .filter(
            ClassroomQuizAttempt.classroom_quiz_id == quiz.id,
            ClassroomQuizAttempt.student_id == current_user.id,
        )
        .order_by(ClassroomQuizAttempt.created_at.desc())
        .first()
    )
    if attempt and attempt.status in {"submitted", "terminated"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You have already finished this classroom quiz.")

    if attempt and attempt.status == "in_progress" and attempt.quiz_session_id:
        questions = load_session_questions(db, attempt.quiz_session_id, current_user.id)
        if questions:
            return {
                "attempt": serialize_quiz_attempt(attempt),
                "quiz": serialize_classroom_quiz(quiz, document, educator, current_user, db),
                "questions": sanitize_questions_for_student(questions),
            }

    session = QuizSession(
        user_id=current_user.id,
        classroom_id=classroom.id,
        classroom_quiz_id=quiz.id,
        document_ids=[quiz.document_id] if quiz.document_id else None,
        bloom_level=quiz.bloom_level,
        total_questions=quiz.num_questions,
        proctoring_status="active" if quiz.proctoring_enabled else "not_applicable",
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    if quiz.quiz_mode == "manual":
        questions = create_manual_classroom_quiz_questions(
            db=db,
            quiz=quiz,
            user_id=current_user.id,
            session_id=session.id,
        )
    else:
        questions = generate_classroom_quiz_questions(
            db=db,
            classroom_id=classroom.id,
            user_id=current_user.id,
            session_id=session.id,
            num_questions=quiz.num_questions,
            bloom_level=quiz.bloom_level,
            document_id=quiz.document_id,
        )
    if not questions:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No usable quiz questions could be generated from this classroom quiz.")

    if not attempt:
        attempt = ClassroomQuizAttempt(
            classroom_quiz_id=quiz.id,
            classroom_id=classroom.id,
            student_id=current_user.id,
            quiz_session_id=session.id,
            status="in_progress",
            started_at=datetime.utcnow(),
            last_heartbeat_at=datetime.utcnow(),
        )
        db.add(attempt)
    else:
        attempt.quiz_session_id = session.id
        attempt.status = "in_progress"
        attempt.started_at = attempt.started_at or datetime.utcnow()
        attempt.last_heartbeat_at = datetime.utcnow()
    db.commit()
    db.refresh(attempt)

    return {
        "attempt": serialize_quiz_attempt(attempt),
        "quiz": serialize_classroom_quiz(quiz, document, educator, current_user, db),
        "questions": sanitize_questions_for_student(questions),
    }


@router.post("/{classroom_id}/quizzes/{quiz_id}/submit")
async def submit_classroom_quiz(
    classroom_id: str,
    quiz_id: str,
    payload: ClassroomQuizAttemptSubmit,
    current_user: User = Depends(require_roles("student")),
    db: Session = Depends(get_db),
):
    """Submit a classroom quiz attempt."""
    classroom = get_accessible_classroom(db, classroom_id, current_user)
    quiz, _, _ = get_classroom_quiz_row(db, classroom.id, quiz_id)
    attempt = get_quiz_attempt_for_student(db, quiz.id, payload.attempt_id, current_user.id)
    if not attempt.quiz_session_id or attempt.status != "in_progress":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This classroom quiz attempt is not active.")

    session = db.query(QuizSession).filter(QuizSession.id == attempt.quiz_session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz session not found")

    db.query(QuizAnswer).filter(QuizAnswer.session_id == session.id).delete()
    correct_count = 0
    for submitted in payload.answers:
        generated_question = (
            db.query(GeneratedQuestion)
            .filter(
                GeneratedQuestion.id == submitted.question_id,
                GeneratedQuestion.user_id == current_user.id,
                GeneratedQuestion.session_id == session.id,
            )
            .first()
        )
        is_correct = bool(generated_question and generated_question.correct_answer == submitted.selected_option_id)
        db.add(
            QuizAnswer(
                session_id=session.id,
                question_id=submitted.question_id,
                selected_option_id=submitted.selected_option_id,
                is_correct=is_correct,
                bloom_level=generated_question.bloom_level if generated_question else (quiz.bloom_level or 3),
            )
        )
        if is_correct:
            correct_count += 1

    session.correct_answers = correct_count
    session.total_questions = payload.total_questions
    session.score = (correct_count / payload.total_questions) * 100 if payload.total_questions else 0
    session.is_completed = True
    session.completed_at = datetime.utcnow()
    session.proctoring_status = "cleared" if quiz.proctoring_enabled else "not_applicable"

    attempt.status = "submitted"
    attempt.score = session.score
    attempt.submitted_at = datetime.utcnow()
    attempt.ended_at = datetime.utcnow()
    db.commit()

    return {
        "message": "Classroom quiz submitted.",
        "score": session.score,
        "correct_count": correct_count,
        "attempt": serialize_quiz_attempt(attempt),
    }


@router.post("/{classroom_id}/quizzes/{quiz_id}/violation")
async def report_quiz_violation(
    classroom_id: str,
    quiz_id: str,
    payload: ClassroomQuizViolationCreate,
    current_user: User = Depends(require_roles("student")),
    db: Session = Depends(get_db),
):
    """Terminate a proctored classroom quiz and notify the educator."""
    classroom = get_accessible_classroom(db, classroom_id, current_user)
    quiz, _, educator = get_classroom_quiz_row(db, classroom.id, quiz_id)
    attempt = get_quiz_attempt_for_student(db, quiz.id, payload.attempt_id, current_user.id)
    if attempt.status != "in_progress":
        return {"message": "Attempt already closed.", "attempt": serialize_quiz_attempt(attempt)}

    violation = ClassroomQuizViolation(
        classroom_quiz_id=quiz.id,
        attempt_id=attempt.id,
        classroom_id=classroom.id,
        student_id=current_user.id,
        violation_type=payload.violation_type,
        details=payload.details or {},
        action_taken="terminated",
    )
    db.add(violation)
    attempt.status = "terminated"
    attempt.violation_count = (attempt.violation_count or 0) + 1
    attempt.termination_reason = payload.violation_type
    attempt.ended_at = datetime.utcnow()

    session = db.query(QuizSession).filter(QuizSession.id == attempt.quiz_session_id).first()
    if session:
        session.is_completed = True
        session.completed_at = datetime.utcnow()
        session.proctoring_status = "terminated"
        session.terminated_reason = payload.violation_type

    db.commit()
    await notify_educator_of_violation(db, classroom, quiz, educator, current_user, attempt, violation)

    return {
        "message": "Quiz terminated due to a proctoring violation.",
        "attempt": serialize_quiz_attempt(attempt),
    }


@router.get("/{classroom_id}/people")
async def get_people(
    classroom_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return educator and student rosters for a classroom."""
    classroom = get_accessible_classroom(db, classroom_id, current_user)
    educator = db.query(User).filter(User.id == classroom.educator_id).first()
    students = list_classroom_students(db, classroom.id)
    return {
        "classroom": {"id": classroom.id, "name": classroom.name},
        "educators": [
            {
                "id": educator.id,
                "full_name": educator.full_name,
                "email": educator.email,
            }
        ]
        if educator
        else [],
        "students": [
            {
                "id": student.id,
                "full_name": student.full_name,
                "email": student.email,
                "joined_at": enrollment.joined_at.isoformat(),
            }
            for enrollment, student in students
        ],
    }


@router.get("/{classroom_id}/messages/threads")
async def list_threads(
    classroom_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List private teacher-student threads visible in a classroom."""
    classroom = get_accessible_classroom(db, classroom_id, current_user)
    query = (
        db.query(ClassroomMessageThread)
        .filter(ClassroomMessageThread.classroom_id == classroom.id)
        .order_by(ClassroomMessageThread.last_message_at.desc())
    )
    if current_user.role == "student":
        query = query.filter(ClassroomMessageThread.student_id == current_user.id)
    elif current_user.role == "educator":
        query = query.filter(ClassroomMessageThread.teacher_id == current_user.id)

    threads = query.all()
    users = {
        user.id: user
        for user in db.query(User)
        .filter(
            User.id.in_(
                {classroom.educator_id}
                | {thread.student_id for thread in threads}
                | {thread.teacher_id for thread in threads}
            )
        )
        .all()
    }
    return {
        "threads": [
            {
                "id": thread.id,
                "classroom_id": thread.classroom_id,
                "teacher": serialize_user(users.get(thread.teacher_id)),
                "student": serialize_user(users.get(thread.student_id)),
                "last_message_at": thread.last_message_at.isoformat() if thread.last_message_at else None,
            }
            for thread in threads
        ]
    }


@router.post("/{classroom_id}/messages/threads")
async def create_thread(
    classroom_id: str,
    payload: ClassroomThreadCreate,
    current_user: User = Depends(require_roles("student", "educator")),
    db: Session = Depends(get_db),
):
    """Create or fetch a persistent classroom teacher-student thread."""
    classroom = get_accessible_classroom(db, classroom_id, current_user)
    thread = get_or_create_thread(db, classroom, current_user, payload.recipient_id)
    return {"thread_id": thread.id}


@router.get("/{classroom_id}/messages/threads/{thread_id}")
async def get_thread_messages(
    classroom_id: str,
    thread_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return one persistent classroom thread and its message history."""
    get_accessible_classroom(db, classroom_id, current_user)
    thread = get_thread_for_user(db, classroom_id, thread_id, current_user)
    rows = (
        db.query(ClassroomThreadMessage, User)
        .join(User, User.id == ClassroomThreadMessage.sender_id)
        .filter(ClassroomThreadMessage.thread_id == thread.id)
        .order_by(ClassroomThreadMessage.created_at.asc())
        .all()
    )
    return {
        "thread": {
            "id": thread.id,
            "classroom_id": thread.classroom_id,
            "teacher_id": thread.teacher_id,
            "student_id": thread.student_id,
        },
        "messages": [
            {
                "id": message.id,
                "content": message.content,
                "message_type": message.message_type,
                "sender": {"id": sender.id, "name": sender.full_name, "role": sender.role},
                "created_at": message.created_at.isoformat(),
            }
            for message, sender in rows
        ],
    }


@router.post("/{classroom_id}/messages/threads/{thread_id}/messages")
async def post_thread_message(
    classroom_id: str,
    thread_id: str,
    payload: ClassroomThreadMessageCreate,
    current_user: User = Depends(require_roles("student", "educator")),
    db: Session = Depends(get_db),
):
    """Append a new message to a persistent classroom thread."""
    classroom = get_accessible_classroom(db, classroom_id, current_user)
    thread = get_thread_for_user(db, classroom_id, thread_id, current_user)
    message = ClassroomThreadMessage(thread_id=thread.id, sender_id=current_user.id, content=payload.content)
    db.add(message)
    thread.last_message_at = datetime.utcnow()
    db.commit()
    db.refresh(message)

    recipient_id = thread.student_id if current_user.id == thread.teacher_id else thread.teacher_id
    create_notifications(
        db,
        [recipient_id],
        classroom.id,
        "classroom_private_message",
        f"New message in {classroom.name}",
        payload.content,
        f"/classrooms/{classroom.id}/messages",
    )
    return {"message": "Thread message sent.", "message_id": message.id}


@router.get("/{classroom_id}/live")
async def get_live_page(
    classroom_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return scheduled and live sessions for a classroom."""
    classroom = get_accessible_classroom(db, classroom_id, current_user)
    sessions = (
        db.query(LiveSession)
        .filter(LiveSession.classroom_id == classroom.id)
        .order_by(LiveSession.scheduled_for.is_(None), LiveSession.scheduled_for.asc(), LiveSession.created_at.desc())
        .all()
    )
    return {"classroom": {"id": classroom.id, "name": classroom.name}, "sessions": [serialize_live_session(session) for session in sessions]}


@router.post("/{classroom_id}/live/schedule")
async def schedule_live_session(
    classroom_id: str,
    payload: ClassroomLiveScheduleCreate,
    current_user: User = Depends(require_roles("educator", "admin")),
    db: Session = Depends(get_db),
):
    """Schedule a classroom live session backed by an external meeting link."""
    classroom = get_accessible_classroom(db, classroom_id, current_user)
    session = LiveSession(
        classroom_id=classroom.id,
        educator_id=current_user.id,
        title=payload.title,
        agenda=payload.agenda,
        join_code=secrets.token_hex(3).upper(),
        status="scheduled",
        meeting_provider=payload.meeting_provider,
        meeting_url=payload.meeting_url,
        scheduled_for=payload.scheduled_for,
        resource_document_ids=payload.resource_document_ids or [],
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    announcement = ClassroomAnnouncement(
        classroom_id=classroom.id,
        author_id=current_user.id,
        title=payload.title,
        content=payload.agenda or "A live classroom session has been scheduled.",
        post_type="live_session",
        linked_live_session_id=session.id,
    )
    db.add(announcement)
    db.commit()

    student_ids = [student.id for _, student in list_classroom_students(db, classroom.id)]
    create_notifications(
        db,
        student_ids,
        classroom.id,
        "classroom_live_scheduled",
        payload.title,
        payload.agenda or "A live session has been scheduled in your classroom.",
        f"/classrooms/{classroom.id}/live",
    )
    return {"message": "Live session scheduled.", "session": serialize_live_session(session)}


@router.post("/{classroom_id}/live/start")
async def start_live_session(
    classroom_id: str,
    payload: LiveSessionCreate,
    current_user: User = Depends(require_roles("educator", "admin")),
    db: Session = Depends(get_db),
):
    """Start a classroom live session immediately."""
    classroom = get_accessible_classroom(db, classroom_id, current_user)
    session = LiveSession(
        classroom_id=classroom.id,
        educator_id=current_user.id,
        title=payload.title,
        agenda=payload.agenda,
        join_code=secrets.token_hex(3).upper(),
        status="live",
        meeting_provider="external",
        meeting_url=payload.meeting_url,
        scheduled_for=datetime.utcnow(),
        started_at=datetime.utcnow(),
        resource_document_ids=payload.resource_document_ids or [],
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    announcement = ClassroomAnnouncement(
        classroom_id=classroom.id,
        author_id=current_user.id,
        title=payload.title,
        content=payload.agenda or "A live classroom session has started.",
        post_type="live_session",
        linked_live_session_id=session.id,
        is_pinned=True,
    )
    db.add(announcement)
    db.commit()

    student_ids = [student.id for _, student in list_classroom_students(db, classroom.id)]
    create_notifications(
        db,
        student_ids,
        classroom.id,
        "classroom_live_started",
        payload.title,
        payload.agenda or "Your educator just started a live session.",
        f"/classrooms/{classroom.id}/live",
    )
    return {"message": "Live session started.", "session": serialize_live_session(session)}


def serialize_user(user: User | None) -> dict | None:
    if not user:
        return None
    return {"id": user.id, "full_name": user.full_name, "email": user.email, "role": user.role}


def serialize_live_session(session: LiveSession | None) -> dict | None:
    if not session:
        return None
    return {
        "id": session.id,
        "title": session.title,
        "agenda": session.agenda,
        "status": session.status,
        "meeting_provider": session.meeting_provider,
        "meeting_url": session.meeting_url,
        "join_code": session.join_code,
        "scheduled_for": session.scheduled_for.isoformat() if session.scheduled_for else None,
        "started_at": session.started_at.isoformat() if session.started_at else None,
        "resource_document_ids": session.resource_document_ids or [],
    }


def resolve_quiz_status(available_from: datetime | None, available_until: datetime | None) -> str:
    now = datetime.utcnow()
    if available_until and available_until <= now:
        return "closed"
    if available_from and available_from > now:
        return "scheduled"
    return "published"


def get_quiz_availability_state(quiz: ClassroomQuiz) -> str:
    return resolve_quiz_status(quiz.available_from, quiz.available_until)


def get_classroom_quiz_row(db: Session, classroom_id: str, quiz_id: str):
    row = (
        db.query(ClassroomQuiz, Document, User)
        .outerjoin(Document, Document.id == ClassroomQuiz.document_id)
        .join(User, User.id == ClassroomQuiz.educator_id)
        .filter(ClassroomQuiz.id == quiz_id, ClassroomQuiz.classroom_id == classroom_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom quiz not found")
    return row


def get_latest_attempt(db: Session, quiz_id: str, student_id: str) -> ClassroomQuizAttempt | None:
    return (
        db.query(ClassroomQuizAttempt)
        .filter(
            ClassroomQuizAttempt.classroom_quiz_id == quiz_id,
            ClassroomQuizAttempt.student_id == student_id,
        )
        .order_by(ClassroomQuizAttempt.created_at.desc())
        .first()
    )


def get_quiz_attempt_for_student(db: Session, quiz_id: str, attempt_id: str, student_id: str) -> ClassroomQuizAttempt:
    attempt = (
        db.query(ClassroomQuizAttempt)
        .filter(
            ClassroomQuizAttempt.id == attempt_id,
            ClassroomQuizAttempt.classroom_quiz_id == quiz_id,
            ClassroomQuizAttempt.student_id == student_id,
        )
        .first()
    )
    if not attempt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz attempt not found")
    return attempt


def serialize_quiz_attempt(attempt: ClassroomQuizAttempt | None) -> dict | None:
    if not attempt:
        return None
    return {
        "id": attempt.id,
        "status": attempt.status,
        "score": attempt.score,
        "started_at": attempt.started_at.isoformat() if attempt.started_at else None,
        "submitted_at": attempt.submitted_at.isoformat() if attempt.submitted_at else None,
        "ended_at": attempt.ended_at.isoformat() if attempt.ended_at else None,
        "violation_count": attempt.violation_count,
        "termination_reason": attempt.termination_reason,
    }


def serialize_classroom_quiz(
    quiz: ClassroomQuiz,
    document: Document | None,
    educator: User | None,
    viewer: User,
    db: Session,
    include_attempt: bool = False,
) -> dict:
    attempt = get_latest_attempt(db, quiz.id, viewer.id) if viewer.role == "student" else None
    availability = get_quiz_availability_state(quiz)
    return {
        "id": quiz.id,
        "classroom_id": quiz.classroom_id,
        "title": quiz.title,
        "description": quiz.description,
        "quiz_mode": quiz.quiz_mode,
        "bloom_level": quiz.bloom_level,
        "num_questions": quiz.num_questions,
        "duration_minutes": quiz.duration_minutes,
        "available_from": quiz.available_from.isoformat() if quiz.available_from else None,
        "available_until": quiz.available_until.isoformat() if quiz.available_until else None,
        "publish_to_stream": quiz.publish_to_stream,
        "proctoring_enabled": quiz.proctoring_enabled,
        "allow_late_entries": quiz.allow_late_entries,
        "status": quiz.status,
        "availability_state": availability,
        "document": (
            {"id": document.id, "title": document.title, "file_name": document.file_name}
            if document
            else None
        ),
        "educator": serialize_user(educator),
        "attempt": serialize_quiz_attempt(attempt) if include_attempt else None,
        "can_start": viewer.role == "student" and availability == "published" and (not attempt or attempt.status == "in_progress"),
        "created_at": quiz.created_at.isoformat(),
    }


def load_session_questions(db: Session, session_id: str, user_id: str) -> list[dict]:
    rows = (
        db.query(GeneratedQuestion)
        .filter(GeneratedQuestion.session_id == session_id, GeneratedQuestion.user_id == user_id)
        .order_by(GeneratedQuestion.created_at.asc())
        .all()
    )
    questions = []
    for question in rows:
        questions.append(
            {
                "id": question.id,
                "text": question.question_text,
                "document_id": question.document_id,
                "document_reference": None,
                "page_number": None,
                "source_excerpt": question.source_text[:220] if question.source_text else None,
                "bloom_level": question.bloom_level,
                "bloom_level_name": None,
                "options": question.options or [],
                "explanation": question.explanation,
            }
        )
    return questions


def generate_classroom_quiz_questions(
    db: Session,
    classroom_id: str,
    user_id: str,
    session_id: str,
    num_questions: int,
    bloom_level: int | None,
    document_id: str | None,
) -> list[dict]:
    source_contexts = get_classroom_source_contexts(
        db,
        classroom_id=classroom_id,
        selected_document_id=document_id,
        top_k=max(num_questions * 5, 12),
    )
    source_contexts = QuestionGenerator.select_source_contexts(source_contexts, max_items=max(num_questions * 2, 6))
    content = build_context_window(source_contexts, max_chars=14000)
    if not content.strip():
        return []

    bloom_levels = [bloom_level] if bloom_level else [1, 2, 3, 4, 5]
    questions = QuestionGenerator.generate_questions(
        content,
        num_questions=num_questions,
        bloom_levels=bloom_levels,
        source_contexts=source_contexts,
    )
    primary_document_id = document_id
    title_to_context = {
        (item.get("document_title") or "").strip().lower(): item
        for item in source_contexts
        if item.get("document_title")
    }

    for question in questions:
        if not question.get("document_id") and primary_document_id:
            question["document_id"] = primary_document_id
        reference = (question.get("document_reference") or "").strip().lower()
        matched = title_to_context.get(reference)
        if matched:
            question["document_id"] = question.get("document_id") or matched.get("document_id")
            question["page_number"] = question.get("page_number") or matched.get("page_number")
            question["source_excerpt"] = question.get("source_excerpt") or matched.get("content", "")[:220]

        correct_option = next(
            (option["id"] for option in question.get("options", []) if option.get("is_correct")),
            None,
        )
        db.add(
            GeneratedQuestion(
                id=question["id"],
                session_id=session_id,
                user_id=user_id,
                document_id=question.get("document_id"),
                source_text=question.get("source") or question.get("document_reference") or content[:500],
                bloom_level=question.get("bloom_level", bloom_level or 3),
                question_text=question.get("text", ""),
                options=question.get("options", []),
                correct_answer=correct_option,
                explanation=question.get("explanation"),
            )
        )
    db.commit()
    return questions


def create_manual_classroom_quiz_questions(
    db: Session,
    quiz: ClassroomQuiz,
    user_id: str,
    session_id: str,
) -> list[dict]:
    manual_questions = quiz.manual_questions or []
    if not manual_questions:
        return []

    generated = build_manual_generated_questions(
        manual_questions,
        user_id=user_id,
        session_id=session_id,
        classroom_quiz_title=quiz.title,
        document_id=quiz.document_id,
    )

    for question in generated:
        db.add(
            GeneratedQuestion(
                id=question["id"],
                session_id=question["session_id"],
                user_id=question["user_id"],
                document_id=question.get("document_id"),
                source_text=question["source_text"],
                bloom_level=question["bloom_level"],
                question_text=question["question_text"],
                options=question["options"],
                correct_answer=question["correct_answer"],
                explanation=question.get("explanation"),
            )
        )
    db.commit()

    return [
        {
            "id": question["id"],
            "text": question["question_text"],
            "document_id": question.get("document_id"),
            "document_reference": question.get("document_reference"),
            "page_number": question.get("page_number"),
            "source_excerpt": question.get("source_excerpt"),
            "bloom_level": question["bloom_level"],
            "bloom_level_name": None,
            "options": question["options"],
            "explanation": question.get("explanation"),
        }
        for question in generated
    ]


def sanitize_questions_for_student(questions: list[dict]) -> list[dict]:
    sanitized = []
    for question in questions:
        item = dict(question)
        item["options"] = [
            {
                **option,
                "is_correct": None,
            }
            for option in (question.get("options") or [])
        ]
        sanitized.append(item)
    return sanitized


def get_classroom_source_contexts(
    db: Session,
    classroom_id: str,
    selected_document_id: str | None,
    top_k: int,
) -> list[dict]:
    if selected_document_id:
        document_ids = [selected_document_id]
    else:
        document_ids = [
            row.document_id
            for row in db.query(ClassroomMaterial).filter(ClassroomMaterial.classroom_id == classroom_id).all()
        ]

    if not document_ids:
        return []

    rows = (
        db.query(DocumentChunk, Document)
        .join(Document, Document.id == DocumentChunk.document_id)
        .filter(Document.id.in_(document_ids))
        .order_by(Document.updated_at.desc(), DocumentChunk.page_number.asc(), DocumentChunk.chunk_index.asc())
        .all()
    )
    contexts = [
        {
            "content": chunk.text_content,
            "document_id": document.id,
            "document_title": document.title,
            "page_number": chunk.page_number,
            "chunk_index": chunk.chunk_index,
            "relevance_score": 0.55,
        }
        for chunk, document in rows
        if chunk.text_content
    ]
    if contexts:
        return contexts[:top_k]

    fallback_documents = db.query(Document).filter(Document.id.in_(document_ids)).all()
    return [
        {
            "content": document.content_preview or "",
            "document_id": document.id,
            "document_title": document.title,
            "page_number": 1,
            "chunk_index": 0,
            "relevance_score": 0.35,
        }
        for document in fallback_documents
        if document.content_preview
    ][:top_k]


async def notify_educator_of_violation(
    db: Session,
    classroom: Classroom,
    quiz: ClassroomQuiz,
    educator: User | None,
    student: User,
    attempt: ClassroomQuizAttempt,
    violation: ClassroomQuizViolation,
) -> None:
    title = f"Proctoring alert in {classroom.name}"
    body = f"{student.full_name} triggered {violation.violation_type} during {quiz.title}. The quiz was ended automatically."
    create_notifications(
        db,
        [classroom.educator_id],
        classroom.id,
        "classroom_quiz_violation",
        title,
        body,
        f"/classrooms/{classroom.id}/quiz/{quiz.id}",
    )

    try:
        from app.routers.educator import notification_manager

        await notification_manager.notify(
            classroom.educator_id,
            {
                "type": "quiz_violation",
                "violation": {
                    "quiz_id": quiz.id,
                    "attempt_id": attempt.id,
                    "classroom_id": classroom.id,
                    "classroom_name": classroom.name,
                    "student_id": student.id,
                    "student_name": student.full_name,
                    "title": quiz.title,
                    "violation_type": violation.violation_type,
                    "created_at": violation.created_at.isoformat(),
                },
            },
        )
    except Exception:
        return


def list_classroom_students_grouped(db: Session, classroom_ids: list[str]) -> list[tuple[str, str]]:
    """Return lightweight grouped student rows for classroom cards."""
    return (
        db.query(ClassroomEnrollment.classroom_id, ClassroomEnrollment.student_id)
        .filter(
            ClassroomEnrollment.classroom_id.in_(classroom_ids),
            ClassroomEnrollment.status == "active",
        )
        .all()
    )
