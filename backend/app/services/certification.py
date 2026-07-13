"""Classroom certification helpers."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.database.models import (
    Classroom,
    ClassroomCertification,
    ClassroomCertificationEnrollment,
    ClassroomCertificationStep,
    ClassroomCertificationStepProgress,
    ClassroomEnrollment,
    ClassroomExam,
    ClassroomExamAttempt,
    ClassroomMaterial,
    ClassroomQuiz,
    ClassroomQuizAttempt,
    CertificationProofSubmission,
    IssuedCertificate,
    User,
    new_id,
)


VALID_STEP_TYPES = {
    "material",
    "quiz",
    "exam",
    "external_link",
    "custom_checkpoint",
}


def serialize_utc_datetime(value: datetime | None) -> str | None:
    """Serialize a datetime in UTC ISO format."""
    if not value:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)
    return value.isoformat().replace("+00:00", "Z")


def normalize_certification_steps(raw_steps: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Validate and normalize certification milestones."""
    normalized: list[dict[str, Any]] = []
    if not raw_steps:
        raise ValueError("Add at least one certification step.")

    for index, step in enumerate(raw_steps):
        step_type = str(step.get("step_type") or "custom_checkpoint").strip().lower()
        if step_type not in VALID_STEP_TYPES:
            raise ValueError(f"Unsupported certification step type: {step_type}")

        title = str(step.get("title") or "").strip()
        if not title:
            raise ValueError("Every certification step needs a title.")

        minimum_score = step.get("minimum_score")
        if minimum_score in {"", None}:
            minimum_score = None
        elif float(minimum_score) < 0:
            raise ValueError("Minimum score cannot be negative.")
        else:
            minimum_score = float(minimum_score)

        normalized.append(
            {
                "step_type": step_type,
                "title": title,
                "description": str(step.get("description") or "").strip() or None,
                "linked_resource_id": step.get("linked_resource_id") or None,
                "linked_resource_type": step.get("linked_resource_type") or infer_linked_resource_type(step_type),
                "required": bool(step.get("required", True)),
                "minimum_score": minimum_score,
                "metadata": step.get("metadata") or {},
                "sort_order": int(step.get("sort_order", index)),
            }
        )
    return normalized


def infer_linked_resource_type(step_type: str) -> str | None:
    if step_type == "material":
        return "document"
    if step_type == "quiz":
        return "classroom_quiz"
    if step_type == "exam":
        return "classroom_exam"
    if step_type == "external_link":
        return "external_url"
    return None


def ensure_certification_enrollments(db, certification: ClassroomCertification) -> list[ClassroomCertificationEnrollment]:
    """Ensure active classroom students have certification enrollment rows."""
    classroom_students = (
        db.query(ClassroomEnrollment)
        .filter(
            ClassroomEnrollment.classroom_id == certification.classroom_id,
            ClassroomEnrollment.status == "active",
        )
        .all()
    )

    created = False
    enrollments: list[ClassroomCertificationEnrollment] = []
    for row in classroom_students:
        enrollment = (
            db.query(ClassroomCertificationEnrollment)
            .filter(
                ClassroomCertificationEnrollment.certification_id == certification.id,
                ClassroomCertificationEnrollment.student_id == row.student_id,
            )
            .first()
        )
        if not enrollment:
            enrollment = ClassroomCertificationEnrollment(
                certification_id=certification.id,
                classroom_id=certification.classroom_id,
                student_id=row.student_id,
                status="not_started",
                proof_status="pending" if certification.course_mode == "external_course" else "not_required",
            )
            db.add(enrollment)
            created = True
        enrollments.append(enrollment)

    if created:
        db.commit()
        for enrollment in enrollments:
            db.refresh(enrollment)
    return enrollments


def get_or_create_enrollment(db, certification: ClassroomCertification, student_id: str) -> ClassroomCertificationEnrollment:
    """Return the student's certification enrollment, creating it when needed."""
    enrollment = (
        db.query(ClassroomCertificationEnrollment)
        .filter(
            ClassroomCertificationEnrollment.certification_id == certification.id,
            ClassroomCertificationEnrollment.student_id == student_id,
        )
        .first()
    )
    if enrollment:
        return enrollment

    enrollment = ClassroomCertificationEnrollment(
        certification_id=certification.id,
        classroom_id=certification.classroom_id,
        student_id=student_id,
        status="not_started",
        proof_status="pending" if certification.course_mode == "external_course" else "not_required",
    )
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    return enrollment


def get_latest_quiz_attempt(db, quiz_id: str, student_id: str) -> ClassroomQuizAttempt | None:
    return (
        db.query(ClassroomQuizAttempt)
        .filter(
            ClassroomQuizAttempt.classroom_quiz_id == quiz_id,
            ClassroomQuizAttempt.student_id == student_id,
        )
        .order_by(ClassroomQuizAttempt.created_at.desc())
        .first()
    )


def get_latest_exam_attempt(db, exam_id: str, student_id: str) -> ClassroomExamAttempt | None:
    return (
        db.query(ClassroomExamAttempt)
        .filter(
            ClassroomExamAttempt.classroom_exam_id == exam_id,
            ClassroomExamAttempt.student_id == student_id,
        )
        .order_by(ClassroomExamAttempt.created_at.desc())
        .first()
    )


def get_or_create_step_progress(
    db,
    enrollment: ClassroomCertificationEnrollment,
    step: ClassroomCertificationStep,
) -> ClassroomCertificationStepProgress:
    progress = (
        db.query(ClassroomCertificationStepProgress)
        .filter(
            ClassroomCertificationStepProgress.enrollment_id == enrollment.id,
            ClassroomCertificationStepProgress.step_id == step.id,
        )
        .first()
    )
    if progress:
        return progress
    progress = ClassroomCertificationStepProgress(
        enrollment_id=enrollment.id,
        step_id=step.id,
        status="available",
        completion_source="auto",
    )
    db.add(progress)
    db.commit()
    db.refresh(progress)
    return progress


def evaluate_step_state(
    db,
    certification: ClassroomCertification,
    enrollment: ClassroomCertificationEnrollment,
    step: ClassroomCertificationStep,
) -> dict[str, Any]:
    """Return the learner-facing state for a certification step."""
    progress = get_or_create_step_progress(db, enrollment, step)
    status = progress.status or "available"
    score_achieved = progress.score_achieved
    evidence_payload = progress.evidence_payload or {}
    completed_at = progress.completed_at
    launch_url = None

    if step.step_type == "quiz" and step.linked_resource_id:
        attempt = get_latest_quiz_attempt(db, step.linked_resource_id, enrollment.student_id)
        launch_url = f"/classrooms/{certification.classroom_id}/quiz/{step.linked_resource_id}"
        if attempt and attempt.status in {"submitted", "teacher_review_required"}:
            score_achieved = attempt.score
            if step.minimum_score is None or float(attempt.score or 0.0) >= float(step.minimum_score):
                status = "completed"
                completed_at = completed_at or attempt.submitted_at or attempt.ended_at or attempt.created_at
            elif step.required:
                status = "available"
    elif step.step_type == "exam" and step.linked_resource_id:
        attempt = get_latest_exam_attempt(db, step.linked_resource_id, enrollment.student_id)
        launch_url = f"/classrooms/{certification.classroom_id}/exam/{step.linked_resource_id}"
        if attempt and attempt.status in {"submitted", "teacher_review_required"}:
            score_achieved = attempt.score
            if step.minimum_score is None or float(attempt.score or 0.0) >= float(step.minimum_score):
                status = "completed"
                completed_at = completed_at or attempt.submitted_at or attempt.ended_at or attempt.created_at
            elif step.required:
                status = "available"
    elif step.step_type == "material" and step.linked_resource_id:
        launch_url = f"/document/{step.linked_resource_id}"
    elif step.step_type == "external_link":
        launch_url = step.linked_resource_id or (step.step_metadata or {}).get("external_url") or certification.external_url

    if progress.status != status or progress.score_achieved != score_achieved or progress.completed_at != completed_at:
        progress.status = status
        progress.score_achieved = score_achieved
        progress.completed_at = completed_at
        db.add(progress)
        db.commit()
        db.refresh(progress)

    return {
        "id": step.id,
        "step_type": step.step_type,
        "title": step.title,
        "description": step.description,
        "required": step.required,
        "minimum_score": step.minimum_score,
        "status": status,
        "score_achieved": score_achieved,
        "launch_url": launch_url,
        "linked_resource_id": step.linked_resource_id,
        "linked_resource_type": step.linked_resource_type,
        "metadata": step.step_metadata or {},
        "evidence_payload": evidence_payload,
        "completed_at": serialize_utc_datetime(completed_at),
    }


def refresh_certification_enrollment(
    db,
    certification: ClassroomCertification,
    student_id: str,
) -> tuple[ClassroomCertificationEnrollment, list[dict[str, Any]], IssuedCertificate | None]:
    """Recalculate one learner's certification state."""
    enrollment = get_or_create_enrollment(db, certification, student_id)
    steps = (
        db.query(ClassroomCertificationStep)
        .filter(ClassroomCertificationStep.certification_id == certification.id)
        .order_by(ClassroomCertificationStep.sort_order.asc(), ClassroomCertificationStep.created_at.asc())
        .all()
    )
    step_payloads = [evaluate_step_state(db, certification, enrollment, step) for step in steps]

    required_steps = [step for step in step_payloads if step.get("required", True)]
    completed_required = [step for step in required_steps if step.get("status") == "completed"]
    completion_percentage = 100.0 if not required_steps else round((len(completed_required) / len(required_steps)) * 100, 2)
    any_started = any(step.get("status") in {"completed", "pending_review"} for step in step_payloads)
    ready = len(completed_required) == len(required_steps)
    existing_certificate = (
        db.query(IssuedCertificate)
        .filter(
            IssuedCertificate.certification_id == certification.id,
            IssuedCertificate.student_id == student_id,
        )
        .first()
    )

    if existing_certificate:
        status = "issued"
        issued_at = existing_certificate.issued_at
        completed_at = enrollment.completed_at or existing_certificate.issued_at
    elif ready and (certification.requires_teacher_approval or certification.manual_issue_only or certification.course_mode == "external_course"):
        status = "ready_for_review"
        issued_at = None
        completed_at = enrollment.completed_at or datetime.utcnow()
    elif ready:
        status = "ready_for_review"
        issued_at = None
        completed_at = enrollment.completed_at or datetime.utcnow()
    elif any_started:
        status = "in_progress"
        issued_at = None
        completed_at = None
    else:
        status = "not_started"
        issued_at = None
        completed_at = None

    enrollment.status = status
    enrollment.completion_percentage = completion_percentage
    enrollment.completed_at = completed_at
    enrollment.issued_at = issued_at
    enrollment.proof_status = enrollment.proof_status or ("pending" if certification.course_mode == "external_course" else "not_required")
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    return enrollment, step_payloads, existing_certificate


def serialize_certification(
    db,
    certification: ClassroomCertification,
    viewer: User,
) -> dict[str, Any]:
    """Return a role-aware certification payload."""
    steps = (
        db.query(ClassroomCertificationStep)
        .filter(ClassroomCertificationStep.certification_id == certification.id)
        .order_by(ClassroomCertificationStep.sort_order.asc(), ClassroomCertificationStep.created_at.asc())
        .all()
    )
    viewer_progress = None
    if viewer.role == "student":
        enrollment, step_payloads, existing_certificate = refresh_certification_enrollment(db, certification, viewer.id)
        viewer_progress = {
            "status": enrollment.status,
            "completion_percentage": enrollment.completion_percentage,
            "proof_status": enrollment.proof_status,
            "teacher_notes": enrollment.teacher_notes,
            "issued_certificate_id": existing_certificate.id if existing_certificate else None,
            "steps": step_payloads,
        }

    return {
        "id": certification.id,
        "classroom_id": certification.classroom_id,
        "title": certification.title,
        "description": certification.description,
        "course_mode": certification.course_mode,
        "provider_name": certification.provider_name,
        "external_url": certification.external_url,
        "issuer_name": certification.issuer_name,
        "certificate_subtitle": certification.certificate_subtitle,
        "completion_message": certification.completion_message,
        "status": certification.status,
        "manual_issue_only": certification.manual_issue_only,
        "requires_teacher_approval": certification.requires_teacher_approval,
        "certificate_template": certification.certificate_template or {},
        "ai_notes": certification.ai_notes or {},
        "steps": [
            {
                "id": step.id,
                "step_type": step.step_type,
                "title": step.title,
                "description": step.description,
                "linked_resource_id": step.linked_resource_id,
                "linked_resource_type": step.linked_resource_type,
                "required": step.required,
                "minimum_score": step.minimum_score,
                "sort_order": step.sort_order,
                "metadata": step.step_metadata or {},
            }
            for step in steps
        ],
        "viewer_progress": viewer_progress,
        "created_at": serialize_utc_datetime(certification.created_at),
    }


def build_certification_roster(db, certification: ClassroomCertification) -> list[dict[str, Any]]:
    """Build the educator roster payload for a certification."""
    ensure_certification_enrollments(db, certification)
    student_rows = (
        db.query(ClassroomCertificationEnrollment, User)
        .join(User, User.id == ClassroomCertificationEnrollment.student_id)
        .filter(ClassroomCertificationEnrollment.certification_id == certification.id)
        .order_by(User.full_name.asc())
        .all()
    )
    roster: list[dict[str, Any]] = []
    for enrollment, student in student_rows:
        refreshed, step_payloads, issued = refresh_certification_enrollment(db, certification, student.id)
        proof_rows = (
            db.query(CertificationProofSubmission)
            .filter(CertificationProofSubmission.enrollment_id == refreshed.id)
            .order_by(CertificationProofSubmission.submitted_at.desc())
            .all()
        )
        roster.append(
            {
                "student_id": student.id,
                "student_name": student.full_name,
                "status": refreshed.status,
                "completion_percentage": refreshed.completion_percentage,
                "ready_for_issue": refreshed.status in {"ready_for_review", "issued"},
                "issued_certificate_id": issued.id if issued else None,
                "teacher_notes": refreshed.teacher_notes,
                "proof_status": refreshed.proof_status,
                "steps": step_payloads,
                "proof_submissions": [
                    {
                        "id": proof.id,
                        "step_id": proof.step_id,
                        "proof_type": proof.proof_type,
                        "proof_url": proof.proof_url,
                        "file_url": proof.file_url,
                        "text_note": proof.text_note,
                        "review_status": proof.review_status,
                        "submitted_at": serialize_utc_datetime(proof.submitted_at),
                    }
                    for proof in proof_rows
                ],
            }
        )
    return roster


def build_certificates_dashboard(db, student: User) -> dict[str, Any]:
    """Return active and earned certificates for a student."""
    classroom_ids = [
        row[0]
        for row in db.query(ClassroomEnrollment.classroom_id).filter(
            ClassroomEnrollment.student_id == student.id,
            ClassroomEnrollment.status == "active",
        )
    ]
    certifications = []
    if classroom_ids:
        certifications = (
            db.query(ClassroomCertification)
            .filter(
                ClassroomCertification.classroom_id.in_(classroom_ids),
                ClassroomCertification.status == "published",
            )
            .order_by(ClassroomCertification.created_at.desc())
            .all()
        )

    active = []
    earned = []
    for certification in certifications:
        enrollment, _, issued = refresh_certification_enrollment(db, certification, student.id)
        classroom = db.query(Classroom).filter(Classroom.id == certification.classroom_id).first()
        item = {
            "id": certification.id,
            "classroom_id": certification.classroom_id,
            "classroom_name": classroom.name if classroom else None,
            "title": certification.title,
            "course_mode": certification.course_mode,
            "status": enrollment.status,
            "completion_percentage": enrollment.completion_percentage,
            "issued_certificate_id": issued.id if issued else None,
        }
        if issued:
            earned.append(item | {"issued_at": serialize_utc_datetime(issued.issued_at)})
        else:
            active.append(item)

    issued_rows = (
        db.query(IssuedCertificate)
        .filter(IssuedCertificate.student_id == student.id)
        .order_by(IssuedCertificate.issued_at.desc())
        .all()
    )
    issued_certificates = [
        {
            "id": issued.id,
            "certification_id": issued.certification_id,
            "classroom_id": issued.classroom_id,
            "certificate_number": issued.certificate_number,
            "student_name": issued.student_name_snapshot,
            "course_title": issued.course_title_snapshot,
            "issued_at": serialize_utc_datetime(issued.issued_at),
            "render_payload": issued.render_payload or {},
        }
        for issued in issued_rows
    ]

    return {
        "active_certifications": active,
        "earned_certifications": earned,
        "issued_certificates": issued_certificates,
    }


def issue_certificate(
    db,
    certification: ClassroomCertification,
    classroom: Classroom,
    student: User,
    educator: User,
) -> IssuedCertificate:
    """Issue a certificate artifact for a student."""
    enrollment, _, existing = refresh_certification_enrollment(db, certification, student.id)
    if existing:
        return existing

    if enrollment.status not in {"ready_for_review", "issued"} and not certification.manual_issue_only:
        raise ValueError("The student has not met the certification issue requirements yet.")

    issued_at = datetime.utcnow()
    certificate = IssuedCertificate(
        certification_id=certification.id,
        classroom_id=classroom.id,
        student_id=student.id,
        educator_id=educator.id,
        certificate_number=f"BM-{issued_at.strftime('%Y%m%d')}-{new_id().split('-')[0].upper()}",
        student_name_snapshot=student.full_name,
        course_title_snapshot=certification.title,
        render_payload={
            "platform_name": "VYDRA CORE",
            "student_name": student.full_name,
            "course_title": certification.title,
            "classroom_name": classroom.name,
            "issuer_name": certification.issuer_name or educator.full_name,
            "completion_message": certification.completion_message or "has successfully completed the certification requirements.",
            "certificate_subtitle": certification.certificate_subtitle or "Certificate of Completion",
            "provider_name": certification.provider_name,
            "issued_at": serialize_utc_datetime(issued_at),
            "certificate_number": None,
        },
        issued_at=issued_at,
    )
    db.add(certificate)
    db.commit()
    db.refresh(certificate)
    certificate.render_payload = {
        **(certificate.render_payload or {}),
        "certificate_number": certificate.certificate_number,
        "certification_id": certification.id,
        "certificate_id": certificate.id,
    }
    db.add(certificate)
    enrollment.status = "issued"
    enrollment.issued_at = issued_at
    enrollment.completed_at = enrollment.completed_at or issued_at
    db.add(enrollment)
    db.commit()
    db.refresh(certificate)
    return certificate


def create_certification_draft_payload(
    *,
    title: str | None,
    materials: list[dict[str, Any]],
    course_mode: str,
    target_outcome: str | None = None,
) -> dict[str, Any]:
    """Generate a lightweight AI-style certification draft from selected materials."""
    chosen_title = (title or "").strip() or (
        f"{materials[0].get('title', 'Course')} Mastery Certification"
        if materials
        else "VYDRA CORE Certification Track"
    )
    focus_labels = [material.get("title") or material.get("file_name") for material in materials[:3] if material.get("title") or material.get("file_name")]
    learning_outcome = (
        target_outcome
        or f"Demonstrate confident applied understanding across {', '.join(focus_labels)}."
        if focus_labels
        else "Demonstrate completion of the required certification milestones."
    )
    suggested_steps = []
    for index, material in enumerate(materials[:3]):
        suggested_steps.append(
            {
                "step_type": "material",
                "title": f"Review {material.get('title') or material.get('file_name')}",
                "description": f"Use this source as a required checkpoint for the certification outcome.",
                "linked_resource_id": material.get("id"),
                "linked_resource_type": "document",
                "required": True,
                "minimum_score": None,
                "metadata": {"suggested_by": "certification_ai"},
                "sort_order": index,
            }
        )
    if course_mode == "biomentor_track":
        suggested_steps.append(
            {
                "step_type": "custom_checkpoint",
                "title": "Final readiness check",
                "description": "Teacher confirms the learner is ready for certificate issue.",
                "linked_resource_id": None,
                "linked_resource_type": None,
                "required": True,
                "minimum_score": None,
                "metadata": {"suggested_by": "certification_ai"},
                "sort_order": len(suggested_steps),
            }
        )
    return {
        "title": chosen_title,
        "description": f"A classroom certification track aligned to {learning_outcome}",
        "completion_message": "has completed the VYDRA CORE certification pathway and satisfied the required milestones.",
        "issuer_name": "VYDRA CORE",
        "suggested_learning_outcome": learning_outcome,
        "steps": suggested_steps,
    }
