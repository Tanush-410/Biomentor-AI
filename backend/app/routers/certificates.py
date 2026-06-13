"""Issued certificate endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.database.models import Classroom, ClassroomCertification, IssuedCertificate, User
from app.routers.auth import get_current_user
from app.routers.classrooms import serialize_issued_certificate
from app.services.certification import build_certificates_dashboard

router = APIRouter(prefix="/api/certificates", tags=["certificates"])


def get_accessible_certificate(db: Session, current_user: User, certificate_id: str) -> IssuedCertificate:
    certificate = db.query(IssuedCertificate).filter(IssuedCertificate.id == certificate_id).first()
    if not certificate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certificate not found")

    if current_user.role == "admin":
        return certificate

    if certificate.student_id == current_user.id:
        return certificate

    certification = (
        db.query(ClassroomCertification)
        .filter(ClassroomCertification.id == certificate.certification_id)
        .first()
    )
    classroom = db.query(Classroom).filter(Classroom.id == certificate.classroom_id).first()
    if current_user.role == "educator" and classroom and classroom.educator_id == current_user.id:
        return certificate
    if certification and certification.educator_id == current_user.id:
        return certificate

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this certificate")


@router.get("/me")
async def get_my_certificates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the current learner's active and earned certifications."""
    return build_certificates_dashboard(db, current_user)


@router.get("/{certificate_id}")
async def get_certificate_detail(
    certificate_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return one certificate artifact when the user is allowed to view it."""
    certificate = get_accessible_certificate(db, current_user, certificate_id)
    certification = (
        db.query(ClassroomCertification)
        .filter(ClassroomCertification.id == certificate.certification_id)
        .first()
    )
    classroom = db.query(Classroom).filter(Classroom.id == certificate.classroom_id).first()
    return {
        "certificate": serialize_issued_certificate(certificate),
        "meta": {
            "certification_title": certification.title if certification else certificate.course_title_snapshot,
            "classroom_name": classroom.name if classroom else None,
            "issuer_name": (certificate.render_payload or {}).get("issuer_name"),
        },
    }
