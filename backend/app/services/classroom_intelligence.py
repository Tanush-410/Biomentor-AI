"""Role-aware classroom intelligence for teachers and students."""
from __future__ import annotations

from collections import Counter
from statistics import mean
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.database.models import (
    Classroom,
    ClassroomAnnouncement,
    ClassroomAssignment,
    ClassroomEnrollment,
    ClassroomMaterial,
    ClassroomMeetingAISummary,
    ClassroomQuiz,
    ClassroomQuizAttempt,
    Document,
    SupportComplaint,
    User,
)
from app.services.ai_quality import classify_confidence
from app.services.learning_analytics import build_gap_list, build_progress_payload


def load_classroom_signal_context(db: Session, classroom: Classroom) -> Dict:
    """Collect classroom-level study, quiz, complaint, and meeting signals."""
    enrollment_rows = (
        db.query(ClassroomEnrollment, User)
        .join(User, User.id == ClassroomEnrollment.student_id)
        .filter(
            ClassroomEnrollment.classroom_id == classroom.id,
            ClassroomEnrollment.status == "active",
        )
        .all()
    )
    student_rows = [
        {"enrollment": enrollment, "student": student}
        for enrollment, student in enrollment_rows
    ]

    student_snapshots: List[Dict] = []
    topic_counter: Counter = Counter()
    for row in student_rows:
        student = row["student"]
        progress = build_progress_payload(db, student.id)
        gaps = build_gap_list(progress)
        top_gaps = gaps[:3]
        for gap in top_gaps[:2]:
            topic_counter.update([gap["level"]])
        student_snapshots.append(
            {
                "student_id": student.id,
                "student_name": student.full_name,
                "average_score": round(progress["averageScore"], 1),
                "total_quizzes": progress["totalQuizzes"],
                "top_gaps": top_gaps,
                "risk": (
                    "high"
                    if progress["averageScore"] < 60
                    else "medium"
                    if progress["averageScore"] < 75
                    else "stable"
                ),
            }
        )

    announcements = (
        db.query(ClassroomAnnouncement)
        .filter(ClassroomAnnouncement.classroom_id == classroom.id)
        .order_by(ClassroomAnnouncement.created_at.desc())
        .limit(6)
        .all()
    )
    materials = (
        db.query(ClassroomMaterial, Document)
        .join(Document, Document.id == ClassroomMaterial.document_id)
        .filter(ClassroomMaterial.classroom_id == classroom.id)
        .order_by(ClassroomMaterial.created_at.desc())
        .all()
    )
    assignments = (
        db.query(ClassroomAssignment)
        .filter(ClassroomAssignment.classroom_id == classroom.id)
        .order_by(
            ClassroomAssignment.due_at.is_(None),
            ClassroomAssignment.due_at.asc(),
            ClassroomAssignment.created_at.desc(),
        )
        .limit(8)
        .all()
    )
    quizzes = (
        db.query(ClassroomQuiz)
        .filter(ClassroomQuiz.classroom_id == classroom.id)
        .order_by(
            ClassroomQuiz.available_from.is_(None),
            ClassroomQuiz.available_from.asc(),
            ClassroomQuiz.created_at.desc(),
        )
        .all()
    )
    attempts = (
        db.query(ClassroomQuizAttempt)
        .filter(ClassroomQuizAttempt.classroom_id == classroom.id)
        .order_by(ClassroomQuizAttempt.updated_at.desc())
        .all()
    )
    open_complaints = (
        db.query(SupportComplaint)
        .filter(
            SupportComplaint.classroom_id == classroom.id,
            SupportComplaint.status == "open",
        )
        .order_by(SupportComplaint.created_at.desc())
        .all()
    )
    meeting_summaries = (
        db.query(ClassroomMeetingAISummary)
        .filter(ClassroomMeetingAISummary.classroom_id == classroom.id)
        .order_by(ClassroomMeetingAISummary.updated_at.desc())
        .limit(8)
        .all()
    )

    submitted_attempts = [
        attempt for attempt in attempts if attempt.status in {"submitted", "completed", "ended"}
    ]
    in_progress_attempts = [attempt for attempt in attempts if attempt.status == "in_progress"]
    average_attempt_score = round(mean([attempt.score for attempt in submitted_attempts]), 1) if submitted_attempts else None

    latest_teacher_summary = next(
        (summary for summary in meeting_summaries if summary.summary_type == "teacher_summary"),
        None,
    )
    latest_student_summary = next(
        (summary for summary in meeting_summaries if summary.summary_type == "student_summary"),
        None,
    )

    return {
        "classroom": classroom,
        "student_snapshots": student_snapshots,
        "student_count": len(student_rows),
        "topic_counter": topic_counter,
        "announcements": announcements,
        "materials": materials,
        "assignments": assignments,
        "quizzes": quizzes,
        "attempts": attempts,
        "submitted_attempts": submitted_attempts,
        "in_progress_attempts": in_progress_attempts,
        "average_attempt_score": average_attempt_score,
        "open_complaints": open_complaints,
        "meeting_summaries": meeting_summaries,
        "latest_teacher_summary": latest_teacher_summary,
        "latest_student_summary": latest_student_summary,
    }


def build_teacher_classroom_intelligence(context: Dict) -> Dict:
    """Summarize the classroom for teacher-facing action."""
    student_snapshots = context["student_snapshots"]
    topic_counter: Counter = context["topic_counter"]
    materials = context["materials"]
    assignments = context["assignments"]
    quizzes = context["quizzes"]
    open_complaints = context["open_complaints"]
    latest_teacher_summary = context["latest_teacher_summary"]
    average_attempt_score = context["average_attempt_score"]
    in_progress_attempts = context["in_progress_attempts"]

    focus_topics = [topic for topic, _ in topic_counter.most_common(3)]
    focus_topic_details = []
    for topic, count in topic_counter.most_common(3):
        confidence_meta = classify_confidence(
            evidence_count=count,
            average_relevance=min(0.92, 0.38 + (count * 0.18)),
            has_primary_sources=bool(student_snapshots),
        )
        focus_topic_details.append(
            {
                "topic": topic,
                "status": "confirmed" if count >= 2 else "emerging",
                "count": count,
                "confidence": confidence_meta["confidence"],
                "confidence_reason": confidence_meta["confidence_reason"],
            }
        )
    struggling = [student for student in student_snapshots if student["risk"] != "stable"]
    overall_confidence = classify_confidence(
        evidence_count=len(student_snapshots) + len(topic_counter),
        average_relevance=min(0.95, ((average_attempt_score or 58.0) / 100) if student_snapshots else 0.22),
        has_primary_sources=bool(student_snapshots or materials or quizzes),
    )

    overview_summary = (
        f"{len(struggling)} learner(s) need closer support, "
        f"{len(materials)} material item(s) are shared, and "
        f"{len(quizzes)} classroom quiz(zes) are currently active or scheduled."
        if student_snapshots
        else "This classroom has no student signals yet. Share a resource or post a quiz to start generating intelligence."
    )
    if average_attempt_score is not None:
        overview_summary = (
            f"{overview_summary} Recent submitted quiz attempts are averaging {average_attempt_score}%."
        )

    attention_signals: List[Dict] = []
    for student in sorted(struggling, key=lambda item: item["average_score"])[:4]:
        gap = student["top_gaps"][0]["level"] if student["top_gaps"] else "class reinforcement"
        attention_signals.append(
            {
                "title": f"{student['student_name']} is slipping in {gap}",
                "detail": f"Average score is {round(student['average_score'])}% with {student['total_quizzes']} completed quiz(zes).",
                "severity": student["risk"],
                "target_url": f"/educator/student/{student['student_id']}",
            }
        )

    if open_complaints:
        attention_signals.insert(
            0,
            {
                "title": f"{len(open_complaints)} open complaint(s) need follow-up",
                "detail": "Reply in Communication Hub or clarify the issue in Stream before the next class task.",
                "severity": "high",
                "target_url": "/communication-hub",
            },
        )
    if in_progress_attempts:
        attention_signals.append(
            {
                "title": f"{len(in_progress_attempts)} quiz attempt(s) are still live",
                "detail": "Use the classroom quiz view to monitor active proctored attempts and warning counts.",
                "severity": "medium",
                "target_url": f"/classrooms/{context['classroom'].id}/classwork",
            }
        )

    class_pattern_summary: List[str] = []
    if focus_topic_details:
        strongest_topic = focus_topic_details[0]
        class_pattern_summary.append(
            f"{strongest_topic['topic']} is the clearest class-wide weak point, showing up in {strongest_topic['count']} recent learner-gap signal(s)."
        )
    if average_attempt_score is not None:
        class_pattern_summary.append(
            f"Recent submitted classroom quiz attempts are averaging {average_attempt_score}%, which suggests the class needs tighter reinforcement before the next check."
        )
    if open_complaints:
        class_pattern_summary.append(
            f"{len(open_complaints)} open classroom complaint(s) are still unresolved, so communication clarity is becoming part of the learning risk."
        )
    if not class_pattern_summary:
        class_pattern_summary.append(
            "This classroom has only early signal data so far, so use the next quiz or material review to confirm where the real gap is."
        )

    high_risk_count = len([student for student in student_snapshots if student["risk"] == "high"])
    medium_risk_count = len([student for student in student_snapshots if student["risk"] == "medium"])
    low_attempt_count = len([student for student in student_snapshots if student["total_quizzes"] == 0])
    student_focus_groups: List[Dict] = []
    if high_risk_count:
        top_gap = next(
            (
                student["top_gaps"][0]["level"]
                for student in student_snapshots
                if student["risk"] == "high" and student["top_gaps"]
            ),
            focus_topics[0] if focus_topics else "the current focus topic",
        )
        student_focus_groups.append(
            {
                "label": "High-risk reteach group",
                "reason": f"These learners are currently slipping most around {top_gap} and need direct support before the next classroom check.",
                "learner_count": high_risk_count,
            }
        )
    if medium_risk_count:
        medium_gap = next(
            (
                student["top_gaps"][0]["level"]
                for student in student_snapshots
                if student["risk"] == "medium" and student["top_gaps"]
            ),
            focus_topics[0] if focus_topics else "recent class material",
        )
        student_focus_groups.append(
            {
                "label": "Watch-list reinforcement group",
                "reason": f"These learners are not yet critical, but they are beginning to drift on {medium_gap}.",
                "learner_count": medium_risk_count,
            }
        )
    if low_attempt_count:
        student_focus_groups.append(
            {
                "label": "Low-evidence learners",
                "reason": "These learners have little or no quiz evidence yet, so one short checkpoint would make the classroom picture much clearer.",
                "learner_count": low_attempt_count,
            }
        )

    reteach_recommendations: List[Dict] = []
    for topic_detail in focus_topic_details[:2]:
        reteach_recommendations.append(
            {
                "topic": topic_detail["topic"],
                "reason": f"{topic_detail['topic']} appears repeatedly in the current classroom gap pattern.",
                "recommended_move": (
                    f"Post one worked example and one short follow-up task for {topic_detail['topic']} before the next classroom quiz."
                ),
            }
        )
    if not materials:
        reteach_recommendations.append(
            {
                "topic": "Classroom study structure",
                "reason": "Students do not yet have a shared classroom resource to revisit after class.",
                "recommended_move": "Share one anchor material and tie the next task directly to it."
            }
        )
    if not assignments:
        reteach_recommendations.append(
            {
                "topic": "Follow-up accountability",
                "reason": "The class has too few structured next steps after materials or meetings.",
                "recommended_move": "Create one lightweight review task that checks whether students can apply the current focus."
            }
        )

    recommended_actions: List[Dict] = []
    if focus_topics:
        recommended_actions.append(
            {
                "label": f"Reinforce {focus_topics[0]} in the next class update",
                "reason": f"{focus_topics[0]} is showing up most often in recent weak-signal patterns.",
                "target_url": f"/classrooms/{context['classroom'].id}/stream",
            }
        )
    if not materials:
        recommended_actions.append(
            {
                "label": "Share one starter resource",
                "reason": "Students have no classroom study material to revisit between quizzes.",
                "target_url": f"/classrooms/{context['classroom'].id}/classwork",
            }
        )
    elif len(assignments) < 2:
        recommended_actions.append(
            {
                "label": "Add one follow-up classwork task",
                "reason": "The class has resources, but not enough structured next steps tied to them.",
                "target_url": f"/classrooms/{context['classroom'].id}/classwork",
            }
        )
    if latest_teacher_summary:
        follow_up_suggestions = (latest_teacher_summary.content_json or {}).get("follow_up_suggestions", [])
        if follow_up_suggestions:
            recommended_actions.append(
                {
                    "label": "Act on the latest meeting follow-up",
                    "reason": follow_up_suggestions[0],
                    "target_url": f"/classrooms/{context['classroom'].id}/live",
                }
            )

    meeting_follow_up = []
    if latest_teacher_summary:
        meeting_payload = latest_teacher_summary.content_json or {}
        meeting_follow_up = [
            *(meeting_payload.get("action_items") or [])[:2],
            *(meeting_payload.get("unresolved_doubts") or [])[:1],
        ]

    teacher_brief = {
        "now": (
            attention_signals[0]["title"]
            if attention_signals
            else (
                f"Reinforce {focus_topics[0]} while the class signal is still fresh."
                if focus_topics
                else "Create one measurable classroom checkpoint to strengthen the signal quality."
            )
        ),
        "next": (
            recommended_actions[0]["label"]
            if recommended_actions
            else "Post one class update that clarifies what students should review next."
        ),
        "later": (
            "Review the next submitted quiz batch to see whether the current class gap is shrinking."
            if student_snapshots
            else "Once learners start submitting quizzes, revisit this classroom intelligence view for stronger patterns."
        ),
    }

    return {
        "overview_summary": overview_summary,
        "focus_topics": focus_topics,
        "focus_topic_details": focus_topic_details,
        "class_pattern_summary": class_pattern_summary[:3],
        "attention_signals": attention_signals[:4],
        "student_focus_groups": student_focus_groups[:3],
        "reteach_recommendations": reteach_recommendations[:3],
        "recommended_actions": recommended_actions[:4],
        "meeting_follow_up": meeting_follow_up[:3],
        "teacher_brief": teacher_brief,
        "confidence": overall_confidence["confidence"],
        "confidence_reason": overall_confidence["confidence_reason"],
    }


def build_student_classroom_intelligence(context: Dict, current_user: Optional[User] = None) -> Dict:
    """Summarize the classroom for student-facing focus and next steps."""
    topic_counter: Counter = context["topic_counter"]
    materials = context["materials"]
    quizzes = context["quizzes"]
    assignments = context["assignments"]
    latest_student_summary = context["latest_student_summary"]
    classroom = context["classroom"]

    focus_topics = [topic for topic, _ in topic_counter.most_common(3)]
    latest_material = materials[0][1] if materials else None
    latest_assignment = assignments[0] if assignments else None
    upcoming_quiz = next((quiz for quiz in quizzes if quiz.status in {"scheduled", "published"}), None)

    meeting_payload = (latest_student_summary.content_json if latest_student_summary else {}) or {}
    meeting_summary = meeting_payload.get("summary")
    key_takeaways = (meeting_payload.get("key_takeaways") or [])[:3]

    overview_summary = meeting_summary or (
        f"Use {classroom.name} to keep up with the class focus, shared materials, and upcoming checks."
    )
    if focus_topics:
        overview_summary = f"{overview_summary} Current class focus is strongest around {focus_topics[0]}."
    overall_confidence = classify_confidence(
        evidence_count=len(focus_topics) + len(materials) + len(quizzes),
        average_relevance=0.7 if focus_topics else 0.36,
        has_primary_sources=bool(materials or quizzes),
    )

    next_steps: List[Dict] = []
    study_targets: List[Dict] = []
    if latest_material:
        study_targets.append(
            {
                "label": f"Review {latest_material.title}",
                "reason": "This is the fastest way to revisit the latest shared class explanation before your next task or quiz.",
                "target_url": f"/document/{latest_material.id}",
            }
        )
        next_steps.append(
            {
                "label": f"Open {latest_material.title}",
                "reason": "This is the most recently shared class material and the fastest place to review today's focus.",
                "target_url": f"/document/{latest_material.id}",
            }
        )
    if upcoming_quiz:
        study_targets.append(
            {
                "label": f"Practice before {upcoming_quiz.title}",
                "reason": "A classroom quiz is already live or coming soon, so revise the current focus before you open it.",
                "target_url": f"/classrooms/{classroom.id}/classwork",
            }
        )
        next_steps.append(
            {
                "label": f"Prepare for {upcoming_quiz.title}",
                "reason": "A classroom quiz is available or scheduled, so reviewing before you open it will help your score.",
                "target_url": f"/classrooms/{classroom.id}/classwork",
            }
        )
    if latest_assignment:
        study_targets.append(
            {
                "label": f"Check {latest_assignment.title}",
                "reason": "This is the classwork item most likely to reinforce today’s classroom focus.",
                "target_url": f"/classrooms/{classroom.id}/classwork",
            }
        )
        next_steps.append(
            {
                "label": f"Check {latest_assignment.title}",
                "reason": "This is the latest classwork item your educator wants the class to complete next.",
                "target_url": f"/classrooms/{classroom.id}/classwork",
            }
        )
    next_steps.append(
        {
            "label": "Ask Learning Chat a focused follow-up",
            "reason": "Use your class material and the current focus topic to clear confusion before the next quiz.",
            "target_url": "/learning-chat",
        }
    )

    personalized_focus = None
    personal_focus_reason = None
    if current_user:
        snapshot = next(
            (student for student in context["student_snapshots"] if student["student_id"] == current_user.id),
            None,
        )
        if snapshot and snapshot["top_gaps"]:
            personalized_focus = snapshot["top_gaps"][0]["level"]
            personal_focus_reason = (
                f"Your own recent quiz pattern shows the most pressure around {personalized_focus}, so that is the best place to focus before the next check."
            )
        elif snapshot:
            personal_focus_reason = (
                "Your current signal looks steadier than the class average, so staying aligned with the class focus is the smartest next move."
            )

    class_focus_reason = (
        f"The class focus is currently centered on {focus_topics[0]} because it appears most often across recent weak-topic signals."
        if focus_topics
        else "The class focus will become sharper once more materials, quizzes, or meeting signals accumulate."
    )
    if not personal_focus_reason:
        personal_focus_reason = (
            f"Start with {focus_topics[0]} so your private practice stays aligned with what the whole classroom is working through."
            if focus_topics
            else "Use the latest classroom material and quiz cue to build your next study step."
        )

    ask_next = []
    if personalized_focus:
        ask_next.append(
            f"Ask Learning Chat to explain {personalized_focus} using this classroom’s latest material and one exam-style example."
        )
    if focus_topics:
        ask_next.append(
            f"Ask Learning Chat to compare {focus_topics[0]} with the next closest classroom topic so the difference becomes easier to remember."
        )
    ask_next.append(
        "Ask Learning Chat for one short self-test before you return to classwork."
    )

    return {
        "overview_summary": overview_summary,
        "focus_topics": focus_topics,
        "personalized_focus": personalized_focus,
        "class_focus_reason": class_focus_reason,
        "personal_focus_reason": personal_focus_reason,
        "key_takeaways": key_takeaways,
        "next_steps": next_steps[:4],
        "study_targets": study_targets[:4],
        "ask_next": ask_next[:3],
        "confidence": overall_confidence["confidence"],
        "confidence_reason": overall_confidence["confidence_reason"],
    }
