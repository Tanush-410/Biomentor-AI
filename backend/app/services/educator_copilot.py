"""Shared educator copilot intelligence for dashboard and analytics surfaces."""
from __future__ import annotations

from collections import Counter
from typing import Dict, List

from sqlalchemy.orm import Session

from app.database.models import (
    Classroom,
    ClassroomEnrollment,
    ClassroomMeetingAISummary,
    CommunicationMessage,
    SupportComplaint,
    User,
)
from app.services.learning_analytics import build_gap_list, build_progress_payload

SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2, "stable": 3}


def load_educator_signal_context(db: Session, educator_id: str) -> Dict:
    """Collect educator-relevant classroom, student, communication, and meeting signals."""
    classrooms = (
        db.query(Classroom)
        .filter(Classroom.educator_id == educator_id)
        .order_by(Classroom.created_at.desc())
        .all()
    )
    classroom_ids = [room.id for room in classrooms]
    classroom_names = {room.id: room.name for room in classrooms}

    enrollments = (
        db.query(ClassroomEnrollment, User)
        .join(User, User.id == ClassroomEnrollment.student_id)
        .filter(ClassroomEnrollment.classroom_id.in_(classroom_ids) if classroom_ids else False)
        .all()
        if classroom_ids
        else []
    )

    student_snapshots = []
    for enrollment, student in enrollments:
        progress = build_progress_payload(db, student.id)
        gaps = build_gap_list(progress)
        top_gap = gaps[0] if gaps else None
        student_snapshots.append(
            {
                "student_id": student.id,
                "student_name": student.full_name,
                "classroom_id": enrollment.classroom_id,
                "classroom_name": classroom_names.get(enrollment.classroom_id, "Classroom"),
                "average_score": round(progress["averageScore"], 1),
                "total_quizzes": progress["totalQuizzes"],
                "top_gap": top_gap,
                "risk": "high" if progress["averageScore"] < 60 else "medium" if progress["averageScore"] < 75 else "stable",
            }
        )

    complaints = (
        db.query(SupportComplaint, User, Classroom)
        .join(User, User.id == SupportComplaint.student_id)
        .join(Classroom, Classroom.id == SupportComplaint.classroom_id)
        .filter(SupportComplaint.educator_id == educator_id)
        .order_by(SupportComplaint.created_at.desc())
        .limit(20)
        .all()
    )
    complaint_payloads = [
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

    messages = (
        db.query(CommunicationMessage, User, Classroom)
        .join(User, User.id == CommunicationMessage.sender_id)
        .outerjoin(Classroom, Classroom.id == CommunicationMessage.classroom_id)
        .filter(
            (CommunicationMessage.recipient_id == educator_id)
            | ((CommunicationMessage.classroom_id.in_(classroom_ids)) if classroom_ids else False)
        )
        .order_by(CommunicationMessage.created_at.desc())
        .limit(20)
        .all()
    )
    message_payloads = [
        {
            "id": message.id,
            "subject": message.subject,
            "content": message.content,
            "audience": message.audience,
            "sender_id": sender.id,
            "sender_name": sender.full_name,
            "sender_role": sender.role,
            "classroom_id": classroom.id if classroom else None,
            "classroom_name": classroom.name if classroom else None,
            "created_at": message.created_at.isoformat(),
        }
        for message, sender, classroom in messages
        if sender.id != educator_id
    ]

    topic_totals = Counter()
    topic_counts = Counter()
    topic_classrooms = {}
    for snapshot in student_snapshots:
        gap = snapshot.get("top_gap")
        if not gap:
            continue
        topic = gap["level"]
        topic_totals[topic] += 100 - gap["gap_percentage"]
        topic_counts[topic] += 1
        topic_classrooms.setdefault(topic, Counter()).update([snapshot["classroom_name"]])

    topic_trends = [
        {
            "topic": topic,
            "mastery": round(topic_totals[topic] / topic_counts[topic], 1),
            "students_measured": topic_counts[topic],
            "dominant_classroom": topic_classrooms.get(topic, Counter()).most_common(1)[0][0] if topic in topic_classrooms else "Multiple classrooms",
        }
        for topic in sorted(topic_counts.keys())
    ]
    topic_trends.sort(key=lambda item: item["mastery"])

    meeting_summaries = (
        db.query(ClassroomMeetingAISummary, Classroom)
        .join(Classroom, Classroom.id == ClassroomMeetingAISummary.classroom_id)
        .filter(
            Classroom.educator_id == educator_id,
            ClassroomMeetingAISummary.summary_type == "teacher_summary",
        )
        .order_by(ClassroomMeetingAISummary.updated_at.desc())
        .limit(10)
        .all()
    )
    meeting_payloads = [
        {
            "meeting_id": summary.meeting_id,
            "classroom_id": summary.classroom_id,
            "classroom_name": classroom.name,
            "summary": (summary.content_json or {}).get("summary", ""),
            "action_items": (summary.content_json or {}).get("action_items", []),
            "unresolved_doubts": (summary.content_json or {}).get("unresolved_doubts", []),
            "follow_up_suggestions": (summary.content_json or {}).get("follow_up_suggestions", []),
        }
        for summary, classroom in meeting_summaries
    ]

    return {
        "classrooms": classrooms,
        "student_snapshots": student_snapshots,
        "complaints": complaint_payloads,
        "messages": message_payloads,
        "topic_trends": topic_trends,
        "meeting_summaries": meeting_payloads,
    }


def build_dashboard_copilot_payload(
    student_snapshots: List[Dict],
    complaints: List[Dict],
    meeting_summaries: List[Dict],
) -> Dict:
    """Prioritize educator attention and next actions for the dashboard."""
    priorities: List[Dict] = []

    for complaint in complaints:
        if complaint.get("status") != "open":
            continue
        priorities.append(
            {
                "id": f"complaint-{complaint['id']}",
                "title": f"Reply to {complaint['student_name']} about {complaint['subject']}",
                "rationale": f"{complaint['student_name']} raised a {complaint['priority']} priority issue in {complaint['classroom_name']}.",
                "recommended_action": "Open Communication Hub and send a direct response or class-wide clarification.",
                "severity": complaint["priority"],
                "category": "complaint",
                "target_url": "/communication-hub",
                "why_now": "An open student complaint is already blocking trust or learning flow for this class.",
                "recommended_window": "today" if complaint["priority"] == "high" else "next class",
                "confidence_reason": "A live student complaint with explicit classroom context supports this priority.",
            }
        )

    for student in sorted(student_snapshots, key=lambda item: item["average_score"])[:6]:
        if student.get("risk") == "stable":
            continue
        gap_label = student["top_gap"]["level"] if student.get("top_gap") else "Bloom reinforcement"
        priorities.append(
            {
                "id": f"student-{student['student_id']}",
                "title": f"Support {student['student_name']} in {gap_label}",
                "rationale": f"{student['student_name']} is averaging {round(student['average_score'])}% in {student['classroom_name']}.",
                "recommended_action": "Review analytics, assign a short reinforcement task, and follow up with a checkpoint message.",
                "severity": student["risk"],
                "category": "student",
                "target_url": f"/educator/student/{student['student_id']}",
                "why_now": f"{student['student_name']} is already below the class stability threshold, so delay will make the intervention more expensive later.",
                "recommended_window": "today" if student["risk"] == "high" else "this week",
                "confidence_reason": "Recent quiz performance and Bloom gap signals support this intervention recommendation.",
            }
        )

    meeting_follow_ups: List[str] = []
    suggested_announcements: List[str] = []
    for meeting in meeting_summaries[:4]:
        meeting_follow_ups.extend(meeting.get("action_items", [])[:2])
        if meeting.get("follow_up_suggestions"):
            suggestion = meeting["follow_up_suggestions"][0]
            priorities.append(
                {
                    "id": f"meeting-{meeting['meeting_id']}",
                    "title": f"Follow up on {meeting['classroom_name']} meeting",
                    "rationale": meeting.get("summary") or f"{meeting['classroom_name']} ended with unresolved review tasks.",
                    "recommended_action": suggestion,
                    "severity": "medium",
                    "category": "meeting",
                    "target_url": f"/classrooms/{meeting['classroom_id']}/live",
                    "why_now": "The classroom meeting already surfaced a concrete next move while the discussion is still fresh.",
                    "recommended_window": "next class",
                    "confidence_reason": "This recommendation is backed by a recent meeting recap and follow-up suggestion.",
                }
            )
            suggested_announcements.append(
                f"Post a class update for {meeting['classroom_name']} summarizing the next step: {suggestion}"
            )

    priorities.sort(key=lambda item: (SEVERITY_ORDER.get(item["severity"], 9), item["title"]))
    priorities = priorities[:8]
    intervention_plan = []
    if any(item["category"] == "complaint" for item in priorities):
        intervention_plan.append("Resolve the highest-risk open complaint before the next major class activity.")
    if any(item["category"] == "student" for item in priorities):
        intervention_plan.append("Target the lowest-scoring learner with one reinforcement step and one follow-up check.")
    if any(item["category"] == "meeting" for item in priorities):
        intervention_plan.append("Carry the latest meeting follow-up into stream, classwork, or the next class opening.")
    if not intervention_plan:
        intervention_plan.append("Wait for new classroom signals, then rerun the copilot for the next intervention cycle.")
    summary = (
        f"{len([item for item in priorities if item['severity'] == 'high'])} urgent item(s), "
        f"{len([item for item in priorities if item['category'] == 'student'])} student support task(s), "
        f"and {len(meeting_follow_ups[:4])} meeting follow-up cue(s) are ready."
        if priorities
        else "No urgent educator actions right now. Use the copilot again after new quiz, complaint, or meeting activity arrives."
    )

    return {
        "priorities": priorities,
        "meeting_follow_ups": meeting_follow_ups[:6],
        "suggested_announcements": suggested_announcements[:4],
        "intervention_plan": intervention_plan[:4],
        "summary": summary,
    }


def build_communication_copilot_payload(messages: List[Dict], complaints: List[Dict]) -> Dict:
    """Generate draft-ready communication assistance for educators."""
    queue_summary = [
        f"{sum(1 for complaint in complaints if complaint.get('status') == 'open')} open complaint(s) need educator attention.",
        f"{len(messages)} recent student or classroom message(s) are available for follow-up.",
    ]

    drafts: List[Dict] = []
    for complaint in complaints[:4]:
        handling_mode = (
            "private_then_classwide"
            if any(token in complaint["content"].lower() for token in ["material", "link", "everyone", "class"])
            else "private_reply"
        )
        tone = "reassuring and urgent" if complaint.get("priority") == "high" else "calm and supportive"
        next_step = (
            "post a clarification to the whole classroom after replying privately"
            if handling_mode == "private_then_classwide"
            else "check back after the student confirms the issue is resolved"
        )
        drafts.append(
            {
                "id": f"complaint-draft-{complaint['id']}",
                "source_type": "complaint",
                "source_id": complaint["id"],
                "subject": complaint["subject"],
                "summary": f"{complaint['student_name']} reported: {complaint['content'][:120].strip()}",
                "suggested_tone": tone,
                "handling_mode": handling_mode,
                "draft_reply": (
                    f"Hi {complaint['student_name']}, thanks for flagging {complaint['subject'].lower()}. "
                    f"I have reviewed your concern in {complaint['classroom_name']} and will address it promptly. "
                    f"In the meantime, keep your current notes ready and I will follow up with the next step shortly."
                ),
                "recommended_next_step": next_step,
                "target_audience": "student",
                "draft_reason": (
                    "The complaint language suggests a class-wide resource issue, so the educator should reply privately first and then clarify publicly."
                    if handling_mode == "private_then_classwide"
                    else "The complaint looks learner-specific, so a direct supportive reply is the cleanest first move."
                ),
                "escalation_signal": (
                    "repeatable_class_issue"
                    if handling_mode == "private_then_classwide"
                    else "private_support_only"
                ),
                "confidence_reason": "The complaint content and priority provide enough context for a draft response.",
            }
        )

    for message in messages[:3]:
        handling_mode = "classroom_follow_up" if message.get("audience") == "classroom" else "private_reply"
        drafts.append(
            {
                "id": f"message-draft-{message['id']}",
                "source_type": "message",
                "source_id": message["id"],
                "subject": message["subject"],
                "summary": f"{message['sender_name']} asked about {message['subject'].lower()}.",
                "suggested_tone": "clear and instructional",
                "handling_mode": handling_mode,
                "draft_reply": (
                    f"Hi {message['sender_name']}, thanks for your message about {message['subject'].lower()}. "
                    f"I have noted it and will respond with the best next step for {message.get('classroom_name') or 'your class'}."
                ),
                "recommended_next_step": (
                    "Send a class-wide clarification if other students are likely affected."
                    if handling_mode == "classroom_follow_up"
                    else "Reply privately, then monitor whether the same doubt appears again."
                ),
                "target_audience": "student" if handling_mode == "private_reply" else "classroom",
                "draft_reason": (
                    "The audience and subject suggest this should become a classroom clarification, not only a private reply."
                    if handling_mode == "classroom_follow_up"
                    else "The message looks narrow enough that a private educator reply should resolve it first."
                ),
                "escalation_signal": (
                    "monitor_for_repeat"
                    if handling_mode == "private_reply"
                    else "repeatable_class_issue"
                ),
                "confidence_reason": "The recent message already identifies the subject, audience, and next response style.",
            }
        )

    return {
        "queue_summary": queue_summary,
        "drafts": drafts[:6],
    }


def build_class_insights_copilot_payload(topic_trends: List[Dict]) -> Dict:
    """Explain weak topics and recommend classroom-level responses."""
    if not topic_trends:
        return {
            "overview_summary": "No class-level mastery trends are available yet. Once students complete quizzes, the copilot will explain weak topics and suggest group reviews.",
            "trend_explanations": [],
            "group_review_recommendations": [],
        }

    weakest = topic_trends[0]
    overview_summary = (
        f"{weakest['topic']} is currently the weakest shared topic at {round(weakest['mastery'])}% mastery. "
        f"Students likely need a short reteach cycle before moving into the next assessment."
    )

    trend_explanations: List[Dict] = []
    recommendations: List[Dict] = []
    for trend in topic_trends[:3]:
        trend_explanations.append(
            {
                "topic": trend["topic"],
                "explanation": f"Students are showing uneven understanding in {trend['topic']}, with average mastery at {round(trend['mastery'])}%.",
                "why_it_matters": f"Low performance here can block progress for {trend['students_measured']} measured learners.",
                "recommended_action": f"Run a focused review on {trend['topic']} and follow it with a short recap quiz.",
                "teaching_move": f"Re-teach {trend['topic']} with one worked comparison, then run a short retrieval check before moving on.",
                "confidence_reason": "This topic appears repeatedly in classroom mastery trends.",
            }
        )
        recommendations.append(
            {
                "topic": trend["topic"],
                "classroom_name": trend.get("dominant_classroom") or "Multiple classrooms",
                "rationale": f"{trend['topic']} is the clearest shared weakness across {trend['students_measured']} students.",
                "suggested_format": "15-minute reteach plus 3-question quick check",
                "next_step": f"Share a concise recap resource, then schedule a group review on {trend['topic']}.",
                "review_sequence": [
                    f"Revisit the base concept behind {trend['topic']}",
                    f"Show one worked {trend['topic']} example",
                    "Run one short retrieval check before students leave the review",
                ],
                "confidence_reason": "Multiple learner signals place this topic among the weakest recent class areas.",
            }
        )

    return {
        "overview_summary": overview_summary,
        "trend_explanations": trend_explanations,
        "group_review_recommendations": recommendations,
    }
