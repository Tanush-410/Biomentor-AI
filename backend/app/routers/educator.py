"""Educator and admin analytics routes."""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime
import secrets
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core import settings
from app.database import get_db
from app.database.models import (
    Classroom,
    ClassroomEnrollment,
    CommunicationMessage,
    LiveSession,
    ReinforcementLesson,
    SupportComplaint,
    User,
)
from app.routers.auth import get_current_user, require_roles
from app.schemas import (
    AdminAnalyticsResponse,
    ClassroomCreate,
    ClassroomEnrollmentJoin,
    ClassroomResponse,
    CommunicationMessageCreate,
    ReinforcementLessonCreate,
    SupportComplaintCreate,
    TeacherDashboardResponse,
)
from app.services.learning_analytics import build_gap_list, build_progress_payload

router = APIRouter(prefix="/api", tags=["educator"])


class NotificationManager:
    """Tracks educator notification sockets."""

    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = defaultdict(list)

    async def connect(self, educator_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[educator_id].append(websocket)

    def disconnect(self, educator_id: str, websocket: WebSocket):
        sockets = self.active_connections.get(educator_id, [])
        if websocket in sockets:
            sockets.remove(websocket)
        if not sockets and educator_id in self.active_connections:
            self.active_connections.pop(educator_id, None)

    async def notify(self, educator_id: str, payload: dict):
        for socket in list(self.active_connections.get(educator_id, [])):
            await socket.send_json(payload)


notification_manager = NotificationManager()


def _format_message_payload(message: CommunicationMessage, sender: User | None, classroom: Classroom | None) -> dict:
    """Normalize communication payloads for student and educator inbox views."""
    return {
        "id": message.id,
        "subject": message.subject,
        "content": message.content,
        "recipient_id": message.recipient_id,
        "classroom_id": message.classroom_id,
        "classroom_name": classroom.name if classroom else None,
        "sender_id": sender.id if sender else message.sender_id,
        "sender_name": sender.full_name if sender else "Unknown sender",
        "sender_role": sender.role if sender else None,
        "audience": message.audience,
        "delivery_status": message.delivery_status,
        "created_at": message.created_at.isoformat(),
    }


@router.get("/educator/dashboard", response_model=TeacherDashboardResponse)
async def get_educator_dashboard(
    current_user: User = Depends(require_roles("educator", "admin")),
    db: Session = Depends(get_db),
):
    """Return the educator overview, alerts, and class snapshots."""
    classrooms = (
        db.query(Classroom)
        .filter(Classroom.educator_id == current_user.id)
        .order_by(Classroom.created_at.desc())
        .all()
    )
    classroom_ids = [room.id for room in classrooms]
    enrollments = (
        db.query(ClassroomEnrollment, User)
        .join(User, User.id == ClassroomEnrollment.student_id)
        .filter(ClassroomEnrollment.classroom_id.in_(classroom_ids) if classroom_ids else False)
        .all()
        if classroom_ids
        else []
    )

    student_snapshots = []
    gap_counter: Counter = Counter()
    for enrollment, student in enrollments:
        progress = build_progress_payload(db, student.id)
        gaps = build_gap_list(progress)
        top_gap = gaps[0] if gaps else None
        if top_gap:
            gap_counter.update([top_gap["level"]])
        student_snapshots.append(
            {
                "student_id": student.id,
                "student_name": student.full_name,
                "classroom_id": enrollment.classroom_id,
                "average_score": round(progress["averageScore"], 1),
                "total_quizzes": progress["totalQuizzes"],
                "top_gap": top_gap,
                "risk": "high" if progress["averageScore"] < 60 else "medium" if progress["averageScore"] < 75 else "stable",
            }
        )

    student_snapshots.sort(key=lambda item: item["average_score"])
    live_sessions = (
        db.query(LiveSession)
        .filter(LiveSession.educator_id == current_user.id)
        .order_by(LiveSession.created_at.desc())
        .limit(5)
        .all()
    )
    complaints = (
        db.query(SupportComplaint, User)
        .join(User, User.id == SupportComplaint.student_id)
        .filter(
            SupportComplaint.educator_id == current_user.id,
            SupportComplaint.status == "open",
        )
        .order_by(SupportComplaint.created_at.desc())
        .limit(8)
        .all()
    )

    alerts = []
    for student in student_snapshots[:5]:
        if student["risk"] != "stable":
            gap_text = student["top_gap"]["level"] if student["top_gap"] else "Bloom reinforcement"
            alerts.append(
                {
                    "student_id": student["student_id"],
                    "student_name": student["student_name"],
                    "severity": student["risk"],
                    "message": f"{student['student_name']} needs support in {gap_text}.",
                }
            )
    for complaint, student in complaints:
        alerts.append(
            {
                "student_id": student.id,
                "student_name": student.full_name,
                "severity": complaint.priority,
                "message": f"Complaint raised: {complaint.subject}",
                "type": "complaint",
                "complaint_id": complaint.id,
            }
        )

    classroom_cards = []
    for room in classrooms:
        members = [item for item in student_snapshots if item["classroom_id"] == room.id]
        average_mastery = round(sum(item["average_score"] for item in members) / len(members), 1) if members else 0.0
        classroom_cards.append(
            {
                "id": room.id,
                "name": room.name,
                "subject": room.subject,
                "invite_code": room.invite_code,
                "student_count": len(members),
                "average_mastery": average_mastery,
                "struggling_count": sum(1 for item in members if item["risk"] != "stable"),
            }
        )

    overview = {
        "classrooms": len(classrooms),
        "students": len(student_snapshots),
        "average_mastery": round(sum(card["average_mastery"] for card in classroom_cards) / len(classroom_cards), 1) if classroom_cards else 0.0,
        "top_gap": gap_counter.most_common(1)[0][0] if gap_counter else "No quiz data yet",
    }

    return TeacherDashboardResponse(
        educator=current_user,
        overview=overview,
        alerts=alerts,
        classrooms=classroom_cards,
        struggling_students=student_snapshots[:8],
        complaints=[
            {
                "id": complaint.id,
                "student_id": student.id,
                "student_name": student.full_name,
                "subject": complaint.subject,
                "content": complaint.content,
                "priority": complaint.priority,
                "status": complaint.status,
                "created_at": complaint.created_at.isoformat(),
            }
            for complaint, student in complaints
        ],
        live_sessions=[
            {
                "id": session.id,
                "title": session.title,
                "status": session.status,
                "join_code": session.join_code,
                "created_at": session.created_at.isoformat(),
            }
            for session in live_sessions
        ],
    )


@router.post("/educator/classrooms", response_model=ClassroomResponse)
async def create_classroom(
    payload: ClassroomCreate,
    current_user: User = Depends(require_roles("educator", "admin")),
    db: Session = Depends(get_db),
):
    """Create a classroom for an educator."""
    classroom = Classroom(
        educator_id=current_user.id,
        name=payload.name,
        description=payload.description,
        subject=payload.subject,
        invite_code=secrets.token_hex(4).upper(),
    )
    db.add(classroom)
    db.commit()
    db.refresh(classroom)
    return classroom


@router.get("/educator/classrooms", response_model=List[ClassroomResponse])
async def list_classrooms(
    current_user: User = Depends(require_roles("educator", "admin")),
    db: Session = Depends(get_db),
):
    """List classrooms owned by the educator."""
    return (
        db.query(Classroom)
        .filter(Classroom.educator_id == current_user.id)
        .order_by(Classroom.created_at.desc())
        .all()
    )


@router.post("/classrooms/join")
async def join_classroom(
    payload: ClassroomEnrollmentJoin,
    current_user: User = Depends(require_roles("student")),
    db: Session = Depends(get_db),
):
    """Join a classroom using an educator invite code."""
    classroom = db.query(Classroom).filter(Classroom.invite_code == payload.invite_code.strip().upper()).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Invite code not found")

    existing = db.query(ClassroomEnrollment).filter(
        ClassroomEnrollment.classroom_id == classroom.id,
        ClassroomEnrollment.student_id == current_user.id,
    ).first()
    if existing:
        return {"message": "You are already enrolled in this classroom.", "classroom_id": classroom.id}

    enrollment = ClassroomEnrollment(classroom_id=classroom.id, student_id=current_user.id)
    db.add(enrollment)
    current_user.class_code = classroom.invite_code
    db.commit()
    return {"message": "Joined classroom successfully.", "classroom_id": classroom.id}


@router.get("/educator/classrooms/{classroom_id}/students")
async def get_classroom_students(
    classroom_id: str,
    current_user: User = Depends(require_roles("educator", "admin")),
    db: Session = Depends(get_db),
):
    """List classroom members with mastery summaries."""
    classroom = _owned_classroom_or_404(db, classroom_id, current_user.id, current_user.role)
    enrollments = (
        db.query(ClassroomEnrollment, User)
        .join(User, User.id == ClassroomEnrollment.student_id)
        .filter(ClassroomEnrollment.classroom_id == classroom.id)
        .all()
    )

    students = []
    for enrollment, student in enrollments:
        progress = build_progress_payload(db, student.id)
        gaps = build_gap_list(progress)
        students.append(
            {
                "id": student.id,
                "full_name": student.full_name,
                "email": student.email,
                "average_score": round(progress["averageScore"], 1),
                "total_quizzes": progress["totalQuizzes"],
                "top_gap": gaps[0] if gaps else None,
                "joined_at": enrollment.joined_at.isoformat(),
            }
        )
    return {"classroom": {"id": classroom.id, "name": classroom.name}, "students": students}


@router.get("/educator/student-analytics/{student_id}")
async def get_student_analytics(
    student_id: str,
    current_user: User = Depends(require_roles("educator", "admin")),
    db: Session = Depends(get_db),
):
    """Inspect one student's mastery, gaps, and assigned reinforcement."""
    student = db.query(User).filter(User.id == student_id, User.role == "student").first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if current_user.role != "admin":
        taught = (
            db.query(ClassroomEnrollment, Classroom)
            .join(Classroom, Classroom.id == ClassroomEnrollment.classroom_id)
            .filter(
                ClassroomEnrollment.student_id == student_id,
                Classroom.educator_id == current_user.id,
            )
            .first()
        )
        if not taught:
            raise HTTPException(status_code=403, detail="This student is not in one of your classrooms.")

    progress = build_progress_payload(db, student.id)
    lessons = (
        db.query(ReinforcementLesson)
        .filter(
            ReinforcementLesson.student_id == student_id,
            ReinforcementLesson.educator_id == current_user.id,
        )
        .order_by(ReinforcementLesson.created_at.desc())
        .all()
    )
    return {
        "student": {
            "id": student.id,
            "full_name": student.full_name,
            "email": student.email,
            "institution_name": student.institution_name,
        },
        "progress": progress,
        "gaps": build_gap_list(progress),
        "lessons": [
            {
                "id": lesson.id,
                "title": lesson.title,
                "instructions": lesson.instructions,
                "target_bloom_level": lesson.target_bloom_level,
                "status": lesson.status,
                "due_at": lesson.due_at.isoformat() if lesson.due_at else None,
            }
            for lesson in lessons
        ],
    }


@router.post("/educator/lessons")
async def assign_reinforcement_lesson(
    payload: ReinforcementLessonCreate,
    current_user: User = Depends(require_roles("educator", "admin")),
    db: Session = Depends(get_db),
):
    """Assign a reinforcement lesson to a student or classroom."""
    lesson = ReinforcementLesson(
        educator_id=current_user.id,
        classroom_id=payload.classroom_id,
        student_id=payload.student_id,
        document_id=payload.document_id,
        title=payload.title,
        instructions=payload.instructions,
        target_bloom_level=payload.target_bloom_level,
        due_at=payload.due_at,
    )
    db.add(lesson)
    db.commit()
    db.refresh(lesson)
    return {"message": "Reinforcement lesson assigned.", "lesson_id": lesson.id}


@router.get("/educator/class-insights")
async def get_class_insights(
    current_user: User = Depends(require_roles("educator", "admin")),
    db: Session = Depends(get_db),
):
    """Aggregate topic-level trends across the educator's classrooms."""
    classrooms = db.query(Classroom).filter(Classroom.educator_id == current_user.id).all()
    classroom_ids = [room.id for room in classrooms]
    enrollments = db.query(ClassroomEnrollment).filter(ClassroomEnrollment.classroom_id.in_(classroom_ids) if classroom_ids else False).all() if classroom_ids else []

    topic_totals = Counter()
    topic_counts = Counter()
    for enrollment in enrollments:
        progress = build_progress_payload(db, enrollment.student_id)
        for gap in build_gap_list(progress):
            topic_totals[gap["level"]] += 100 - gap["gap_percentage"]
            topic_counts[gap["level"]] += 1

    trends = [
        {
            "topic": level,
            "mastery": round(topic_totals[level] / topic_counts[level], 1),
            "students_measured": topic_counts[level],
        }
        for level in sorted(topic_counts.keys())
    ]
    trends.sort(key=lambda item: item["mastery"])

    return {
        "overview": {
            "classrooms": len(classrooms),
            "students_measured": len({enrollment.student_id for enrollment in enrollments}),
        },
        "topic_trends": trends,
        "recommended_group_reviews": [
            f"Schedule a group review on {trend['topic']}." for trend in trends[:3]
        ],
    }


@router.post("/educator/messages")
async def send_message(
    payload: CommunicationMessageCreate,
    current_user: User = Depends(require_roles("educator", "admin")),
    db: Session = Depends(get_db),
):
    """Send a message to a student or whole classroom."""
    message = CommunicationMessage(
        sender_id=current_user.id,
        recipient_id=payload.recipient_id,
        classroom_id=payload.classroom_id,
        subject=payload.subject,
        content=payload.content,
        audience=payload.audience,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return {"message": "Communication sent.", "id": message.id, "created_at": message.created_at.isoformat()}


@router.get("/educator/messages")
async def list_messages(
    current_user: User = Depends(require_roles("educator", "admin")),
    db: Session = Depends(get_db),
):
    """List educator inbox and sent communications."""
    messages = (
        db.query(CommunicationMessage, User, Classroom)
        .join(User, User.id == CommunicationMessage.sender_id)
        .outerjoin(Classroom, Classroom.id == CommunicationMessage.classroom_id)
        .filter(
            (CommunicationMessage.sender_id == current_user.id)
            | (CommunicationMessage.recipient_id == current_user.id)
        )
        .order_by(CommunicationMessage.created_at.desc())
        .limit(40)
        .all()
    )
    return {
        "messages": [
            {
                **_format_message_payload(message, sender, classroom),
                "direction": "sent" if message.sender_id == current_user.id else "received",
            }
            for message, sender, classroom in messages
        ]
    }


@router.get("/student/classrooms")
async def list_student_classrooms(
    current_user: User = Depends(require_roles("student")),
    db: Session = Depends(get_db),
):
    """List classrooms the student has joined."""
    enrollments = (
        db.query(ClassroomEnrollment, Classroom, User)
        .join(Classroom, Classroom.id == ClassroomEnrollment.classroom_id)
        .join(User, User.id == Classroom.educator_id)
        .filter(ClassroomEnrollment.student_id == current_user.id)
        .order_by(ClassroomEnrollment.joined_at.desc())
        .all()
    )
    return {
        "classrooms": [
            {
                "id": classroom.id,
                "name": classroom.name,
                "subject": classroom.subject,
                "description": classroom.description,
                "invite_code": classroom.invite_code,
                "educator_name": educator.full_name,
                "joined_at": enrollment.joined_at.isoformat(),
            }
            for enrollment, classroom, educator in enrollments
        ]
    }


@router.get("/student/messages")
async def list_student_messages(
    current_user: User = Depends(require_roles("student")),
    db: Session = Depends(get_db),
):
    """List educator announcements and direct educator replies visible to the student."""
    classroom_ids = [
        enrollment.classroom_id
        for enrollment in db.query(ClassroomEnrollment).filter(ClassroomEnrollment.student_id == current_user.id).all()
    ]
    messages = (
        db.query(CommunicationMessage, User, Classroom)
        .join(User, User.id == CommunicationMessage.sender_id)
        .outerjoin(Classroom, Classroom.id == CommunicationMessage.classroom_id)
        .filter(
            (CommunicationMessage.recipient_id == current_user.id)
            | (CommunicationMessage.classroom_id.in_(classroom_ids) if classroom_ids else False)
        )
        .order_by(CommunicationMessage.created_at.desc())
        .limit(30)
        .all()
    )
    return {
        "messages": [
            _format_message_payload(message, sender, classroom)
            for message, sender, classroom in messages
        ]
    }


@router.post("/student/messages")
async def send_student_message(
    payload: CommunicationMessageCreate,
    current_user: User = Depends(require_roles("student")),
    db: Session = Depends(get_db),
):
    """Send a direct message to the classroom educator and notify them instantly."""
    classroom = None
    if payload.classroom_id:
        classroom = db.query(Classroom).filter(Classroom.id == payload.classroom_id).first()
    elif current_user.class_code:
        classroom = db.query(Classroom).filter(Classroom.invite_code == current_user.class_code).first()

    if not classroom:
        raise HTTPException(status_code=400, detail="Join a classroom before sending a message.")

    enrollment = db.query(ClassroomEnrollment).filter(
        ClassroomEnrollment.classroom_id == classroom.id,
        ClassroomEnrollment.student_id == current_user.id,
    ).first()
    if not enrollment:
        raise HTTPException(status_code=403, detail="You are not enrolled in this classroom.")

    message = CommunicationMessage(
        sender_id=current_user.id,
        recipient_id=classroom.educator_id,
        classroom_id=classroom.id,
        subject=payload.subject,
        content=payload.content,
        audience="educator",
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    await notification_manager.notify(
        classroom.educator_id,
        {
            "type": "student_message",
            "message": {
                **_format_message_payload(message, current_user, classroom),
                "direction": "received",
            },
        },
    )

    return {"message": "Message sent to your educator.", "id": message.id, "created_at": message.created_at.isoformat()}


@router.post("/support/complaints")
async def create_support_complaint(
    payload: SupportComplaintCreate,
    current_user: User = Depends(require_roles("student")),
    db: Session = Depends(get_db),
):
    """Raise a complaint/help request and notify the educator instantly."""
    classroom = None
    if payload.classroom_id:
        classroom = db.query(Classroom).filter(Classroom.id == payload.classroom_id).first()
    elif current_user.class_code:
        classroom = db.query(Classroom).filter(Classroom.invite_code == current_user.class_code).first()

    if not classroom:
        raise HTTPException(status_code=400, detail="Join a classroom before submitting a complaint.")

    complaint = SupportComplaint(
        student_id=current_user.id,
        educator_id=classroom.educator_id,
        classroom_id=classroom.id,
        subject=payload.subject,
        content=payload.content,
        priority=(payload.priority or "medium").lower(),
    )
    db.add(complaint)
    db.commit()
    db.refresh(complaint)

    await notification_manager.notify(
        classroom.educator_id,
        {
            "type": "complaint",
            "complaint": {
                "id": complaint.id,
                "student_id": current_user.id,
                "student_name": current_user.full_name,
                "subject": complaint.subject,
                "content": complaint.content,
                "priority": complaint.priority,
                "classroom_id": classroom.id,
                "classroom_name": classroom.name,
                "created_at": complaint.created_at.isoformat(),
                "status": complaint.status,
            },
        },
    )

    return {"message": "Complaint sent to your educator.", "complaint_id": complaint.id}


@router.get("/educator/complaints")
async def list_educator_complaints(
    current_user: User = Depends(require_roles("educator", "admin")),
    db: Session = Depends(get_db),
):
    """List complaints for the educator."""
    complaints = (
        db.query(SupportComplaint, User, Classroom)
        .join(User, User.id == SupportComplaint.student_id)
        .join(Classroom, Classroom.id == SupportComplaint.classroom_id)
        .filter(SupportComplaint.educator_id == current_user.id)
        .order_by(SupportComplaint.created_at.desc())
        .all()
    )
    return {
        "complaints": [
            {
                "id": complaint.id,
                "subject": complaint.subject,
                "content": complaint.content,
                "priority": complaint.priority,
                "status": complaint.status,
                "student_id": student.id,
                "student_name": student.full_name,
                "classroom_id": classroom.id,
                "classroom_name": classroom.name,
                "created_at": complaint.created_at.isoformat(),
            }
            for complaint, student, classroom in complaints
        ]
    }


@router.post("/educator/complaints/{complaint_id}/resolve")
async def resolve_complaint(
    complaint_id: str,
    current_user: User = Depends(require_roles("educator", "admin")),
    db: Session = Depends(get_db),
):
    """Mark a complaint as resolved."""
    complaint = (
        db.query(SupportComplaint)
        .filter(
            SupportComplaint.id == complaint_id,
            SupportComplaint.educator_id == current_user.id,
        )
        .first()
    )
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    complaint.status = "resolved"
    complaint.resolved_at = datetime.utcnow()
    db.commit()
    return {"message": "Complaint resolved."}


@router.websocket("/educator/notifications/ws")
async def educator_notifications_websocket(websocket: WebSocket, token: str = Query(...), db: Session = Depends(get_db)):
    """Push educator notifications, including instant student complaints."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=4401)
            return
        user = db.query(User).filter(User.id == user_id).first()
        if not user or user.role not in {"educator", "admin"}:
            await websocket.close(code=4403)
            return
    except JWTError:
        await websocket.close(code=4401)
        return

    await notification_manager.connect(user.id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        notification_manager.disconnect(user.id, websocket)


@router.get("/admin/analytics", response_model=AdminAnalyticsResponse)
async def get_admin_analytics(
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Institution-level analytics for admin users."""
    users = db.query(User).filter(User.is_active == True).all()  # noqa: E712
    students = [user for user in users if user.role == "student"]
    educators = [user for user in users if user.role == "educator"]
    live_sessions = db.query(LiveSession).order_by(LiveSession.created_at.desc()).limit(8).all()
    complaints = db.query(SupportComplaint).all()

    mastery_by_role = []
    for label, collection in (("Students", students), ("Educators", educators)):
        averages = [build_progress_payload(db, user.id)["averageScore"] for user in collection]
        mastery_by_role.append(
            {
                "role": label,
                "count": len(collection),
                "average_mastery": round(sum(averages) / len(averages), 1) if averages else 0.0,
            }
        )

    class_comparisons = []
    classrooms = db.query(Classroom).all()
    for classroom in classrooms:
        enrollments = db.query(ClassroomEnrollment).filter(ClassroomEnrollment.classroom_id == classroom.id).all()
        student_ids = [enrollment.student_id for enrollment in enrollments]
        mastery_values = [build_progress_payload(db, student_id)["averageScore"] for student_id in student_ids]
        class_comparisons.append(
            {
                "classroom_id": classroom.id,
                "classroom_name": classroom.name,
                "student_count": len(student_ids),
                "average_mastery": round(sum(mastery_values) / len(mastery_values), 1) if mastery_values else 0.0,
                "open_complaints": sum(1 for complaint in complaints if complaint.classroom_id == classroom.id and complaint.status == "open"),
            }
        )
    class_comparisons.sort(key=lambda item: item["average_mastery"])

    return AdminAnalyticsResponse(
        overview={
            "users": len(users),
            "students": len(students),
            "educators": len(educators),
            "classrooms": db.query(Classroom).count(),
            "messages_sent": db.query(CommunicationMessage).count(),
            "open_complaints": sum(1 for complaint in complaints if complaint.status == "open"),
        },
        mastery_by_role=mastery_by_role,
        engagement={
            "live_sessions": db.query(LiveSession).count(),
            "assignments": db.query(ReinforcementLesson).count(),
            "complaints": len(complaints),
        },
        class_comparisons=class_comparisons,
        complaint_summary={
            "open": sum(1 for complaint in complaints if complaint.status == "open"),
            "resolved": sum(1 for complaint in complaints if complaint.status == "resolved"),
            "high_priority": sum(1 for complaint in complaints if complaint.priority == "high" and complaint.status == "open"),
        },
        live_sessions=[
            {
                "id": session.id,
                "title": session.title,
                "status": session.status,
                "created_at": session.created_at.isoformat(),
            }
            for session in live_sessions
        ],
    )


def _owned_classroom_or_404(db: Session, classroom_id: str, user_id: str, role: str) -> Classroom:
    query = db.query(Classroom).filter(Classroom.id == classroom_id)
    if role != "admin":
        query = query.filter(Classroom.educator_id == user_id)
    classroom = query.first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")
    return classroom
