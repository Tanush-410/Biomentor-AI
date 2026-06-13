"""Documents router for PDF upload and management."""
from datetime import datetime
import mimetypes
import os
import tempfile
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse, Response
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.agents.pdf_extractor import PDFExtractor
from app.core.security import enforce_rate_limit, parse_page_selection, sanitize_filename, validate_upload
from app.database import get_db
from app.database.models import (
    Classroom,
    ClassroomAnnouncement,
    ClassroomAssignment,
    ClassroomEnrollment,
    ClassroomMaterial,
    ClassroomQuiz,
    Document,
    DocumentChunk,
)
from app.routers.auth import get_current_user
from app.schemas import DocumentResponse, MaterialIntelligenceResponse
from app.services.document_context import (
    build_document_insights,
    build_page_payloads_from_text,
    get_document_context,
    index_document_chunks,
)
from app.services.document_storage import delete_document_file, load_document_bytes, persist_document_file
from app.services.material_intelligence import build_material_intelligence
from app.services.vector_store import delete_document_vectors


router = APIRouter(prefix="/api/documents", tags=["documents"])

# Keep uploads practical for exam prep and prevent huge local files.
MAX_FILE_SIZE = 100 * 1024 * 1024


def list_accessible_documents_for_user(db: Session, current_user) -> List[Document]:
    """Return the document library visible to a user across personal and classroom access."""
    if getattr(current_user, "role", None) == "admin":
        return (
            db.query(Document)
            .order_by(Document.uploaded_at.desc(), Document.created_at.desc())
            .all()
        )

    visible_by_id: dict[str, Document] = {}
    own_documents = (
        db.query(Document)
        .filter(Document.user_id == current_user.id)
        .order_by(Document.uploaded_at.desc(), Document.created_at.desc())
        .all()
    )
    for document in own_documents:
        visible_by_id[document.id] = document

    if current_user.role == "educator":
        classroom_rows = db.query(Classroom.id).filter(Classroom.educator_id == current_user.id).all()
    else:
        classroom_rows = (
            db.query(ClassroomEnrollment.classroom_id)
            .filter(
                ClassroomEnrollment.student_id == current_user.id,
                ClassroomEnrollment.status == "active",
            )
            .all()
        )

    classroom_ids = [row[0] for row in classroom_rows]
    if classroom_ids:
        classroom_documents = (
            db.query(Document)
            .outerjoin(ClassroomMaterial, ClassroomMaterial.document_id == Document.id)
            .outerjoin(ClassroomAssignment, ClassroomAssignment.document_id == Document.id)
            .outerjoin(ClassroomAnnouncement, ClassroomAnnouncement.linked_document_id == Document.id)
            .outerjoin(ClassroomQuiz, ClassroomQuiz.document_id == Document.id)
            .filter(
                or_(
                    ClassroomMaterial.classroom_id.in_(classroom_ids),
                    ClassroomAssignment.classroom_id.in_(classroom_ids),
                    ClassroomAnnouncement.classroom_id.in_(classroom_ids),
                    ClassroomQuiz.classroom_id.in_(classroom_ids),
                )
            )
            .order_by(Document.uploaded_at.desc(), Document.created_at.desc())
            .all()
        )
        for document in classroom_documents:
            visible_by_id[document.id] = document

    return sorted(
        visible_by_id.values(),
        key=lambda document: document.uploaded_at or document.created_at or datetime.min,
        reverse=True,
    )


def get_accessible_document_for_user(db: Session, current_user, document_id: str) -> Optional[Document]:
    """Return a document when the user owns it or can access it through a classroom."""
    if getattr(current_user, "role", None) == "admin":
        return db.query(Document).filter(Document.id == document_id).first()

    document = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == current_user.id,
    ).first()
    if document:
        return document

    if current_user.role == "educator":
        classroom_rows = (
            db.query(Classroom.id)
            .filter(Classroom.educator_id == current_user.id)
            .all()
        )
    else:
        classroom_rows = (
            db.query(ClassroomEnrollment.classroom_id)
            .filter(
                ClassroomEnrollment.student_id == current_user.id,
                ClassroomEnrollment.status == "active",
            )
            .all()
        )

    classroom_ids = [row[0] for row in classroom_rows]
    if not classroom_ids:
        return None

    return (
        db.query(Document)
        .outerjoin(ClassroomMaterial, ClassroomMaterial.document_id == Document.id)
        .outerjoin(ClassroomAssignment, ClassroomAssignment.document_id == Document.id)
        .outerjoin(ClassroomAnnouncement, ClassroomAnnouncement.linked_document_id == Document.id)
        .outerjoin(ClassroomQuiz, ClassroomQuiz.document_id == Document.id)
        .filter(
            Document.id == document_id,
            or_(
                ClassroomMaterial.classroom_id.in_(classroom_ids),
                ClassroomAssignment.classroom_id.in_(classroom_ids),
                ClassroomAnnouncement.classroom_id.in_(classroom_ids),
                ClassroomQuiz.classroom_id.in_(classroom_ids),
            ),
        )
        .first()
    )


@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    storage_mode: str = Form("full"),
    selected_pages: Optional[str] = Form(None),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload a study document and index it into retrieval chunks.

    - **file**: PDF, TXT, or Markdown file (up to 100MB)
    - **title**: Document title (auto-generated from filename if not provided)
    - **storage_mode**: `full` to keep the source file, `text_only` to keep extracted text only
    - **selected_pages**: Optional page ranges like `1-5,8,10-12` for low-data extraction
    """
    enforce_rate_limit(request, "documents-upload", limit=20, window_seconds=600)

    # Extract user_id from current_user object
    user_id = current_user.id if hasattr(current_user, 'id') else current_user

    safe_file_name = sanitize_filename(file.filename or "upload")
    file_extension = validate_upload(safe_file_name, file.content_type)
    storage_mode = (storage_mode or "full").strip().lower()
    if storage_mode not in {"full", "text_only"}:
        raise HTTPException(status_code=400, detail="storage_mode must be either 'full' or 'text_only'")
    
    # Stream file to a temp location first so hosted environments can process it safely.
    file_size = 0
    chunk_size = 1024 * 1024  # 1MB chunks
    file_id = str(uuid.uuid4())
    with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as temp_file:
        temp_upload_path = temp_file.name
    file_path = temp_upload_path

    try:
        with open(file_path, "wb") as saved_file:
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                file_size += len(chunk)

                if file_size > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File size exceeds {MAX_FILE_SIZE // (1024*1024)}MB limit"
                    )

                saved_file.write(chunk)
    except HTTPException:
        if os.path.exists(temp_upload_path):
            os.remove(temp_upload_path)
        raise
    except Exception as e:
        if os.path.exists(temp_upload_path):
            os.remove(temp_upload_path)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error reading file: {str(e)}"
        )

    extracted_text = ""
    page_count = 1
    page_payloads = []

    try:
        if file_extension == '.pdf':
            page_payloads, page_count = PDFExtractor.extract_pages_from_file(file_path)
            selected_page_numbers = parse_page_selection(selected_pages, page_count) if selected_pages else None
            if selected_page_numbers:
                page_payloads = [payload for payload in page_payloads if payload["page_number"] in selected_page_numbers]
                page_count = len(page_payloads) or page_count
            extracted_text = "\n\n".join(payload["text"] for payload in page_payloads)
        elif file_extension == '.txt':
            with open(file_path, "r", encoding="utf-8", errors="ignore") as uploaded_file:
                extracted_text = uploaded_file.read()
            page_payloads = build_page_payloads_from_text(extracted_text, "txt")
            page_count = max(1, len(page_payloads))
        elif file_extension == '.md':
            with open(file_path, "r", encoding="utf-8", errors="ignore") as uploaded_file:
                extracted_text = uploaded_file.read()
            page_payloads = build_page_payloads_from_text(extracted_text, "md")
            page_count = max(1, len(page_payloads))
    except HTTPException:
        raise
    except Exception:
        extracted_text = ""
        page_payloads = []
        page_count = 1

    doc_title = title or os.path.splitext(safe_file_name)[0]
    persisted_source_path = temp_upload_path
    persisted_file_name = safe_file_name
    text_only_path = None

    if storage_mode == "text_only":
        with tempfile.NamedTemporaryFile(delete=False, suffix=".txt", mode="w", encoding="utf-8") as extracted_file:
            extracted_file.write(extracted_text or "")
            text_only_path = extracted_file.name
        persisted_source_path = text_only_path
        persisted_file_name = f"{doc_title}.txt"
        file_size = os.path.getsize(text_only_path)

    try:
        file_path = persist_document_file(
            persisted_source_path,
            owner_user_id=user_id,
            document_id=file_id,
            file_name=persisted_file_name,
            content_type=file.content_type if storage_mode == "full" else "text/plain; charset=utf-8",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to persist the uploaded file: {exc}",
        ) from exc
    finally:
        for cleanup_path in {temp_upload_path, text_only_path}:
            if cleanup_path and os.path.exists(cleanup_path):
                os.remove(cleanup_path)

    db_document = Document(
        user_id=user_id,
        title=doc_title,
        file_name=persisted_file_name,
        file_path=file_path,
        file_size=file_size,
        pages=page_count,
        content_preview=extracted_text[:1500],
        processing_status="processing",
        storage_mode=storage_mode,
        selected_pages=parse_page_selection(selected_pages, page_count) if selected_pages else None,
    )

    db.add(db_document)
    db.commit()
    db.refresh(db_document)

    try:
        chunk_count = index_document_chunks(
            db,
            db_document,
            page_payloads or build_page_payloads_from_text(extracted_text, file_extension.rsplit(".", 1)[-1].lower()),
            content_preview=extracted_text,
        )
        db_document.embedding_count = chunk_count
        db_document.pages = max(page_count, 1)
        db.commit()
        db.refresh(db_document)
    except Exception:
        db_document.processing_status = "failed"
        db.commit()
        db.refresh(db_document)

    return db_document


@router.get("/", response_model=List[DocumentResponse])
async def list_documents(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all documents for current user."""
    return list_accessible_documents_for_user(db, current_user)


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get specific document."""
    document = get_accessible_document_for_user(db, current_user, document_id)

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    return document


@router.get("/{document_id}/insights")
async def get_document_insights(
    document_id: str,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Return lightweight page and concept insights for the study viewer."""
    document = get_accessible_document_for_user(db, current_user, document_id)

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    contexts = get_document_context(db, user_id=document.user_id, document_ids=[document_id], top_k=24)
    insights = build_document_insights(contexts)
    return {
        "document_id": document.id,
        "document_title": document.title,
        "concepts": insights["concepts"],
        "key_pages": insights["key_pages"],
        "total_chunks": insights["total_chunks"],
    }


@router.get("/{document_id}/material-intelligence", response_model=MaterialIntelligenceResponse)
async def get_material_intelligence(
    document_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Return a richer AI study layer for one uploaded document."""
    document = get_accessible_document_for_user(db, current_user, document_id)

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    contexts = get_document_context(db, user_id=document.user_id, document_ids=[document_id], top_k=24)
    payload = build_material_intelligence(
        {"id": document.id, "title": document.title, "file_name": document.file_name},
        contexts,
    )
    return MaterialIntelligenceResponse(
        document_id=document.id,
        document_title=document.title,
        summary=payload["summary"],
        layered_summaries=payload["layered_summaries"],
        revision_bullets=payload.get("revision_bullets", []),
        glossary=payload.get("glossary", []),
        flashcards=payload.get("flashcards", []),
        follow_up_prompts=payload.get("follow_up_prompts", []),
        prerequisite_warning=payload.get("prerequisite_warning"),
        concepts=payload.get("concepts", []),
        key_pages=payload.get("key_pages", []),
        concept_map=payload.get("concept_map", []),
        misconception_traps=payload.get("misconception_traps", []),
        viva_questions=payload.get("viva_questions", []),
        study_path=payload.get("study_path", []),
        confidence=payload.get("confidence"),
        confidence_reason=payload.get("confidence_reason"),
    )


@router.get("/{document_id}/file")
async def get_document_file(
    document_id: str,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Stream the original uploaded file for in-browser viewing or offline caching."""
    user_id = current_user.id if hasattr(current_user, 'id') else current_user

    document = get_accessible_document_for_user(db, current_user, document_id)

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    headers = {"Content-Disposition": f'inline; filename="{document.file_name}"'}
    if os.path.exists(document.file_path):
        media_type, _ = mimetypes.guess_type(document.file_name)
        return FileResponse(
            document.file_path,
            media_type=media_type or "application/octet-stream",
            filename=document.file_name,
            headers=headers
        )

    try:
        payload, media_type = load_document_bytes(document.file_path, document.file_name)
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document file is missing. Re-upload this material to restore the original file."
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Unable to load the stored file: {exc}",
        ) from exc
    return Response(content=payload, media_type=media_type, headers=headers)


@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    request: Request,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a document."""
    enforce_rate_limit(request, "documents-delete", limit=30, window_seconds=600)
    user_id = current_user.id
    
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == user_id
    ).first()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Delete file
    delete_document_file(document.file_path)

    db.query(DocumentChunk).filter(DocumentChunk.document_id == document.id).delete(synchronize_session=False)
    try:
        delete_document_vectors(document.id)
    except Exception:
        pass
    db.delete(document)
    db.commit()
    
    return {"message": "Document deleted successfully"}
