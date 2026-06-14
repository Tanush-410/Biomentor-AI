"""Quiz and questions router."""
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.database.models import GeneratedQuestion, QuizAnswer, QuizSession
from app.schemas import (
    AnalyzeLevelRequest,
    AnalyzeLevelResponse,
    QuestionConversionRequest,
    QuestionConversionResponse,
    QuestionVariant,
    QuizGenerationResponse,
    QuizSessionCreate,
    QuizSubmissionRequest,
    TaxonomyAnalysis,
)
from app.agents import BloomClassifier, QuestionDifficultyConverter
from app.agents.question_generator import QuestionGenerator
from app.services.document_context import build_context_window, fallback_preview_context, get_document_context
from app.services.learning_analytics import build_progress_payload

router = APIRouter(prefix="/api/quiz", tags=["quiz"])


def get_current_user(request: Request, db: Session = Depends(get_db)):
    """Dependency to get current user from JWT token in Authorization header."""
    from app.core import settings
    from jose import JWTError, jwt
    
    # Extract token from Authorization header
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    token = auth_header.split(" ")[1]
    
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        return user_id
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )


@router.post("/generate", response_model=QuizGenerationResponse)
async def generate_quiz(
    request: QuizSessionCreate,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate a quiz session with intelligent questions from documents.
    
    - **num_questions**: Number of questions to generate
    - **bloom_level**: Specific Bloom's level filter (optional)
    - **document_ids**: Limit to specific documents (optional)
    - **duration_minutes**: Quiz time limit (optional)
    """
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not authenticated"
        )
    
    # Create quiz session
    session = QuizSession(
        user_id=user_id,
        total_questions=request.num_questions,
        bloom_level=request.bloom_level,
        document_ids=request.document_ids
    )
    
    db.add(session)
    db.commit()
    db.refresh(session)
    
    # Generate questions from indexed document chunks.
    content = ""
    questions = []
    source_contexts = []
    selected_document_ids = request.document_ids or None
    primary_document_id = selected_document_ids[0] if selected_document_ids else None
    
    try:
        source_contexts = get_document_context(
            db,
            user_id=user_id,
            document_ids=selected_document_ids,
            top_k=max(request.num_questions * 5, 12),
        )
        if not source_contexts:
            source_contexts = fallback_preview_context(
                db,
                user_id=user_id,
                document_ids=selected_document_ids,
                top_k=max(request.num_questions * 3, 6),
            )

        source_contexts = QuestionGenerator.select_source_contexts(
            source_contexts,
            max_items=max(request.num_questions * 2, 6),
        )
        content = build_context_window(source_contexts, max_chars=14000)
        if content.strip():
            bloom_levels = [request.bloom_level] if request.bloom_level else [1, 2, 3, 4, 5]
            questions = QuestionGenerator.generate_questions(
                content,
                num_questions=request.num_questions,
                bloom_levels=bloom_levels,
                source_contexts=source_contexts,
            )

        if not questions or len(questions) == 0:
            questions = _generate_sample_questions(request.num_questions, request.bloom_level or 3)

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
            
    except Exception as e:
        print(f"Error generating questions: {e}")
        questions = _generate_sample_questions(request.num_questions, request.bloom_level or 3)
    
    for question in questions:
        correct_option = next(
            (option["id"] for option in question.get("options", []) if option.get("is_correct")),
            None
        )
        db.add(
            GeneratedQuestion(
                id=question["id"],
                session_id=session.id,
                user_id=user_id,
                document_id=primary_document_id,
                source_text=question.get("source") or question.get("document_reference") or content[:500],
                bloom_level=question.get("bloom_level", request.bloom_level or 3),
                question_text=question.get("text", ""),
                options=question.get("options", []),
                correct_answer=correct_option,
                explanation=question.get("explanation")
            )
        )
    db.commit()

    return QuizGenerationResponse(
        session_id=session.id,
        questions=questions
    )


@router.post("/analyze-question")
async def analyze_question(
    text: str,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Analyze a question's Bloom's Taxonomy level.
    
    - **text**: Question text to analyze
    """
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not authenticated"
        )
    
    analysis = BloomClassifier.analyze(text)
    
    return {
        "question": text,
        "current_level": analysis["level"],
        "current_level_name": analysis["level_name"],
        "confidence": analysis["confidence"],
        "detected_keywords": analysis["detected_keywords"],
        "description": analysis["description"]
    }


@router.post("/convert-difficulty", response_model=QuestionConversionResponse)
async def convert_question_difficulty(
    request: QuestionConversionRequest,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Convert a question to a different difficulty level.
    
    - **question_text**: Original question
    - **current_level**: Current Bloom's level (1-6)
    - **target_level**: Target Bloom's level (1-6)
    - **context**: Optional document context
    """
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not authenticated"
        )
    
    # Analyze current
    current_analysis = BloomClassifier.analyze(request.question_text)
    
    # Get variants
    variants_dict = QuestionDifficultyConverter.get_all_level_variants(
        request.question_text,
        request.current_level,
        request.target_level
    )

    target_variant = variants_dict.get(f"level_{request.target_level}")
    if not target_variant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to convert question to the requested level"
        )

    variants = [
        QuestionVariant(
            text=target_variant["text"],
            bloom_level=target_variant["level"],
            bloom_level_name=target_variant["level_name"],
            reasoning=target_variant["adjustment"]
        )
    ]
    
    return QuestionConversionResponse(
        original_question=request.question_text,
        current_analysis=TaxonomyAnalysis(
            current_level=current_analysis["level"],
            current_level_name=current_analysis["level_name"],
            target_level=request.target_level,
            target_level_name=target_variant["level_name"],
            confidence=current_analysis["confidence"]
        ),
        variants=variants,
        source_document=request.context,
        confidence=current_analysis["confidence"]
    )


@router.post("/generate-level-variants")
async def generate_level_variants(
    request: AnalyzeLevelRequest,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Identify a question's current Bloom level and generate versions for all levels.
    """
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not authenticated"
        )

    analysis = BloomClassifier.analyze(request.question_text)
    variants_dict = QuestionDifficultyConverter.get_all_level_variants(
        request.question_text,
        analysis["level"],
    )

    variants = [
        {
            "text": value["text"],
            "bloom_level": value["level"],
            "bloom_level_name": value["level_name"],
            "reasoning": value["adjustment"],
        }
        for _, value in sorted(
            variants_dict.items(),
            key=lambda item: item[1]["level"],
        )
    ]

    return {
        "original_question": request.question_text,
        "identified_level": analysis["level"],
        "identified_level_name": analysis["level_name"],
        "confidence": analysis["confidence"],
        "variants": variants,
    }


@router.post("/analyze-level", response_model=AnalyzeLevelResponse)
async def analyze_question_level(
    request: AnalyzeLevelRequest,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Analyze a question's Bloom's Taxonomy level.
    
    - **question_text**: Question text to analyze
    
    Returns the identified Bloom's level and confidence score.
    """
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not authenticated"
        )
    
    # Analyze the question
    analysis = BloomClassifier.analyze(request.question_text)
    
    return AnalyzeLevelResponse(
        level=analysis["level"],
        level_name=analysis["level_name"],
        confidence=analysis["confidence"],
        keywords=analysis.get("detected_keywords", []),
        description=analysis.get("description")
    )


@router.get("/bloom-taxonomy")
async def get_bloom_taxonomy():
    """Get all Bloom's Taxonomy levels with descriptions."""
    return BloomClassifier.get_all_levels()


@router.post("/submit-answer")
async def submit_quiz_answer(
    request: QuizSubmissionRequest,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Submit an answer to a quiz question.
    
    - **session_id**: Quiz session ID
    - **answers**: Submitted question answers
    """
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not authenticated"
        )
    
    session = db.query(QuizSession).filter(
        QuizSession.id == request.session_id,
        QuizSession.user_id == user_id
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz session not found"
        )
    
    db.query(QuizAnswer).filter(QuizAnswer.session_id == session.id).delete()

    submitted_count = 0
    for submitted in request.answers:
        generated_question = db.query(GeneratedQuestion).filter(
            GeneratedQuestion.id == submitted.question_id,
            GeneratedQuestion.user_id == user_id
        ).first()
        is_correct = bool(
            generated_question and generated_question.correct_answer == submitted.selected_option_id
        )

        db.add(
            QuizAnswer(
                session_id=session.id,
                question_id=submitted.question_id,
                selected_option_id=submitted.selected_option_id,
                is_correct=is_correct,
                bloom_level=session.bloom_level or 3
            )
        )
        if is_correct:
            submitted_count += 1

    session.correct_answers = submitted_count
    session.total_questions = request.total_questions
    session.score = (submitted_count / request.total_questions) * 100 if request.total_questions else 0
    session.is_completed = True
    session.completed_at = datetime.utcnow()
    
    db.commit()
    
    return {
        "message": "Answer recorded",
        "current_score": session.score,
        "correct_count": session.correct_answers
    }


@router.get("/progress")
async def get_progress(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's learning progress."""
    return build_progress_payload(db, current_user)


def _generate_sample_questions(num_questions: int, bloom_level: int = 3) -> list:
    """Disable fake placeholder questions that degrade the quiz experience."""
    return []
