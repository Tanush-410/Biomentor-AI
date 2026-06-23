"""Private sticky note CRUD endpoints."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.database import get_db
from app.database.models import StickyNote
from app.routers.auth import get_current_user
from app.schemas import StickyNoteCreate, StickyNoteResponse, StickyNoteUpdate


router = APIRouter(prefix="/api/sticky-notes", tags=["sticky-notes"])


def _get_user_note(db: Session, note_id: str, user_id: str) -> Optional[StickyNote]:
    """Return a sticky note only when it belongs to the current user."""
    return (
        db.query(StickyNote)
        .filter(
            StickyNote.id == note_id,
            StickyNote.user_id == user_id,
        )
        .first()
    )


@router.get("", response_model=list[StickyNoteResponse])
async def list_sticky_notes(
    page_url: str = Query(..., min_length=1),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List private sticky notes for the exact current page URL."""
    return (
        db.query(StickyNote)
        .filter(
            StickyNote.user_id == current_user.id,
            StickyNote.page_url == page_url,
        )
        .order_by(StickyNote.z_index.asc(), StickyNote.created_at.asc())
        .all()
    )


@router.post("", response_model=StickyNoteResponse, status_code=status.HTTP_201_CREATED)
async def create_sticky_note(
    payload: StickyNoteCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new private sticky note for the current user and page."""
    top_note = (
        db.query(StickyNote)
        .filter(
            StickyNote.user_id == current_user.id,
            StickyNote.page_url == payload.page_url,
        )
        .order_by(desc(StickyNote.z_index))
        .first()
    )

    note = StickyNote(
        user_id=current_user.id,
        page_url=payload.page_url,
        title=payload.title,
        content=payload.content,
        color=payload.color,
        x_ratio=payload.x_ratio,
        y_ratio=payload.y_ratio,
        x_position=payload.x_position,
        y_position=payload.y_position,
        width=payload.width,
        height=payload.height,
        z_index=(top_note.z_index + 1) if top_note else 1,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.patch("/{note_id}", response_model=StickyNoteResponse)
async def update_sticky_note(
    note_id: str,
    payload: StickyNoteUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a private sticky note in place."""
    note = _get_user_note(db, note_id, current_user.id)
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sticky note not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(note, field, value)

    db.commit()
    db.refresh(note)
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sticky_note(
    note_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a private sticky note."""
    note = _get_user_note(db, note_id, current_user.id)
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sticky note not found")

    db.delete(note)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
