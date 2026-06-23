"""Database models for SQLAlchemy."""
from datetime import datetime
import uuid

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import declarative_base

Base = declarative_base()

STICKY_NOTE_COLOR_DEFAULT = "amber"
STICKY_NOTE_X_RATIO_MIN = 0.0
STICKY_NOTE_X_RATIO_MAX = 1.0
STICKY_NOTE_Y_RATIO_MIN = 0.0
STICKY_NOTE_Y_RATIO_MAX = 1.0
STICKY_NOTE_WIDTH_MIN = 220
STICKY_NOTE_WIDTH_MAX = 420
STICKY_NOTE_HEIGHT_MIN = 160
STICKY_NOTE_HEIGHT_MAX = 420
STICKY_NOTE_Z_INDEX_MIN = 1
STICKY_NOTE_X_RATIO_DEFAULT = 0.5
STICKY_NOTE_Y_RATIO_DEFAULT = 0.25
STICKY_NOTE_WIDTH_DEFAULT = 320
STICKY_NOTE_HEIGHT_DEFAULT = 220
STICKY_NOTE_Z_INDEX_DEFAULT = 1


def new_id() -> str:
    """Generate a stable UUID string."""
    return str(uuid.uuid4())


class User(Base):
    """Application user."""

    __tablename__ = "users"

    id = Column(String, primary_key=True, default=new_id)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(String, default="student", nullable=False, index=True)
    institution_name = Column(String, nullable=True)
    focus_area = Column(String, nullable=True)
    class_code = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)
    last_login_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Document(Base):
    """Uploaded document model."""

    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    pages = Column(Integer, default=0)
    content_preview = Column(Text, nullable=True)
    storage_mode = Column(String, default="full", nullable=False)
    selected_pages = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_processed = Column(Boolean, default=False)
    embedding_count = Column(Integer, default=0)
    processing_status = Column(String, default="pending")


class StickyNote(Base):
    """User-owned sticky note anchored to a page URL."""

    __tablename__ = "sticky_notes"
    __table_args__ = (
        CheckConstraint(
            f"x_ratio >= {STICKY_NOTE_X_RATIO_MIN} AND x_ratio <= {STICKY_NOTE_X_RATIO_MAX}",
            name="ck_sticky_notes_x_ratio_range",
        ),
        CheckConstraint(
            f"y_ratio >= {STICKY_NOTE_Y_RATIO_MIN} AND y_ratio <= {STICKY_NOTE_Y_RATIO_MAX}",
            name="ck_sticky_notes_y_ratio_range",
        ),
        CheckConstraint(
            f"width >= {STICKY_NOTE_WIDTH_MIN} AND width <= {STICKY_NOTE_WIDTH_MAX}",
            name="ck_sticky_notes_width_range",
        ),
        CheckConstraint(
            f"height >= {STICKY_NOTE_HEIGHT_MIN} AND height <= {STICKY_NOTE_HEIGHT_MAX}",
            name="ck_sticky_notes_height_range",
        ),
        CheckConstraint(f"z_index >= {STICKY_NOTE_Z_INDEX_MIN}", name="ck_sticky_notes_z_index_min"),
    )

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    page_url = Column(String, nullable=False, index=True)
    title = Column(String, nullable=True)
    content = Column(Text, nullable=False)
    color = Column(String, default=STICKY_NOTE_COLOR_DEFAULT, nullable=False)
    x_ratio = Column(Float, default=STICKY_NOTE_X_RATIO_DEFAULT, nullable=False)
    y_ratio = Column(Float, default=STICKY_NOTE_Y_RATIO_DEFAULT, nullable=False)
    x_position = Column(Integer, nullable=True)
    y_position = Column(Integer, nullable=True)
    width = Column(Integer, default=STICKY_NOTE_WIDTH_DEFAULT, nullable=False)
    height = Column(Integer, default=STICKY_NOTE_HEIGHT_DEFAULT, nullable=False)
    z_index = Column(Integer, default=STICKY_NOTE_Z_INDEX_DEFAULT, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DocumentChunk(Base):
    """Document text chunks for retrieval."""

    __tablename__ = "document_chunks"

    id = Column(String, primary_key=True, default=new_id)
    document_id = Column(String, ForeignKey("documents.id"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    page_number = Column(Integer, nullable=False)
    text_content = Column(Text, nullable=False)
    vector_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class QuizSession(Base):
    """Quiz session for tracking user performance."""

    __tablename__ = "quiz_sessions"

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    classroom_id = Column(String, ForeignKey("classrooms.id"), nullable=True, index=True)
    classroom_quiz_id = Column(String, ForeignKey("classroom_quizzes.id"), nullable=True, index=True)
    document_ids = Column(JSON, nullable=True)
    bloom_level = Column(Integer, nullable=True)
    total_questions = Column(Integer, nullable=False)
    correct_answers = Column(Integer, default=0)
    score = Column(Float, default=0.0)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    is_completed = Column(Boolean, default=False)
    proctoring_status = Column(String, default="not_applicable", nullable=False)
    terminated_reason = Column(Text, nullable=True)


class QuizAnswer(Base):
    """User answer to a generated question."""

    __tablename__ = "quiz_answers"

    id = Column(String, primary_key=True, default=new_id)
    session_id = Column(String, ForeignKey("quiz_sessions.id"), nullable=False, index=True)
    question_id = Column(String, nullable=False)
    selected_option_id = Column(String, nullable=False)
    is_correct = Column(Boolean, nullable=False)
    bloom_level = Column(Integer, nullable=False)
    answered_at = Column(DateTime, default=datetime.utcnow)


class GeneratedQuestion(Base):
    """Cached generated questions."""

    __tablename__ = "generated_questions"

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    session_id = Column(String, ForeignKey("quiz_sessions.id"), nullable=True, index=True)
    document_id = Column(String, ForeignKey("documents.id"), nullable=True)
    source_text = Column(Text, nullable=False)
    bloom_level = Column(Integer, nullable=False)
    question_text = Column(Text, nullable=False)
    options = Column(JSON)
    correct_answer = Column(String)
    explanation = Column(Text, nullable=True)
    variants = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    ttl_days = Column(Integer, default=7)


class UserProgress(Base):
    """Track user learning progress."""

    __tablename__ = "user_progress"

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True, unique=True)
    remember_score = Column(Float, default=0.0)
    understand_score = Column(Float, default=0.0)
    apply_score = Column(Float, default=0.0)
    analyze_score = Column(Float, default=0.0)
    evaluate_score = Column(Float, default=0.0)
    create_score = Column(Float, default=0.0)
    total_quizzes = Column(Integer, default=0)
    average_score = Column(Float, default=0.0)
    total_study_minutes = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Classroom(Base):
    """Educator-owned classroom."""

    __tablename__ = "classrooms"

    id = Column(String, primary_key=True, default=new_id)
    educator_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    subject = Column(String, default="Biology", nullable=False)
    invite_code = Column(String, unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ClassroomEnrollment(Base):
    """Student membership in classrooms."""

    __tablename__ = "classroom_enrollments"

    id = Column(String, primary_key=True, default=new_id)
    classroom_id = Column(String, ForeignKey("classrooms.id"), nullable=False, index=True)
    student_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String, default="active", nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow)


class ReinforcementLesson(Base):
    """Assignments created by educators."""

    __tablename__ = "reinforcement_lessons"

    id = Column(String, primary_key=True, default=new_id)
    educator_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    classroom_id = Column(String, ForeignKey("classrooms.id"), nullable=True, index=True)
    student_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    document_id = Column(String, ForeignKey("documents.id"), nullable=True)
    title = Column(String, nullable=False)
    instructions = Column(Text, nullable=False)
    target_bloom_level = Column(Integer, nullable=True)
    status = Column(String, default="assigned", nullable=False)
    due_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class CommunicationMessage(Base):
    """Teacher or admin communication to students."""

    __tablename__ = "communication_messages"

    id = Column(String, primary_key=True, default=new_id)
    sender_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    recipient_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    classroom_id = Column(String, ForeignKey("classrooms.id"), nullable=True, index=True)
    subject = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    audience = Column(String, default="student", nullable=False)
    delivery_status = Column(String, default="sent", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class ClassroomAnnouncement(Base):
    """Public classroom stream posts from educators."""

    __tablename__ = "classroom_announcements"

    id = Column(String, primary_key=True, default=new_id)
    classroom_id = Column(String, ForeignKey("classrooms.id"), nullable=False, index=True)
    author_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=True)
    content = Column(Text, nullable=False)
    post_type = Column(String, default="announcement", nullable=False)
    linked_document_id = Column(String, ForeignKey("documents.id"), nullable=True, index=True)
    linked_live_session_id = Column(String, ForeignKey("live_sessions.id"), nullable=True, index=True)
    is_pinned = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ClassroomMaterial(Base):
    """Documents shared into a classroom's classwork area."""

    __tablename__ = "classroom_materials"

    id = Column(String, primary_key=True, default=new_id)
    classroom_id = Column(String, ForeignKey("classrooms.id"), nullable=False, index=True)
    document_id = Column(String, ForeignKey("documents.id"), nullable=False, index=True)
    shared_by_user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    title_override = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ClassroomAssignment(Base):
    """Classroom tasks, quizzes, and due-date items."""

    __tablename__ = "classroom_assignments"

    id = Column(String, primary_key=True, default=new_id)
    classroom_id = Column(String, ForeignKey("classrooms.id"), nullable=False, index=True)
    educator_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    assignment_type = Column(String, default="task", nullable=False)
    document_id = Column(String, ForeignKey("documents.id"), nullable=True, index=True)
    classroom_quiz_id = Column(String, ForeignKey("classroom_quizzes.id"), nullable=True, index=True)
    classroom_exam_id = Column(String, ForeignKey("classroom_exams.id"), nullable=True, index=True)
    quiz_reference = Column(String, nullable=True)
    exam_reference = Column(String, nullable=True)
    due_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ClassroomQuiz(Base):
    """Educator-authored quiz that can be published into a classroom."""

    __tablename__ = "classroom_quizzes"

    id = Column(String, primary_key=True, default=new_id)
    classroom_id = Column(String, ForeignKey("classrooms.id"), nullable=False, index=True)
    educator_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    document_id = Column(String, ForeignKey("documents.id"), nullable=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    quiz_mode = Column(String, default="generated", nullable=False)
    manual_questions = Column(JSON, nullable=True)
    bloom_level = Column(Integer, nullable=True)
    num_questions = Column(Integer, default=5, nullable=False)
    duration_minutes = Column(Integer, default=15, nullable=False)
    available_from = Column(DateTime, nullable=True)
    available_until = Column(DateTime, nullable=True)
    publish_to_stream = Column(Boolean, default=True, nullable=False)
    proctoring_enabled = Column(Boolean, default=True, nullable=False)
    allow_late_entries = Column(Boolean, default=False, nullable=False)
    status = Column(String, default="scheduled", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ClassroomQuizAttempt(Base):
    """Student attempt for a classroom-published quiz."""

    __tablename__ = "classroom_quiz_attempts"

    id = Column(String, primary_key=True, default=new_id)
    classroom_quiz_id = Column(String, ForeignKey("classroom_quizzes.id"), nullable=False, index=True)
    classroom_id = Column(String, ForeignKey("classrooms.id"), nullable=False, index=True)
    student_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    quiz_session_id = Column(String, ForeignKey("quiz_sessions.id"), nullable=True, index=True)
    status = Column(String, default="not_started", nullable=False)
    score = Column(Float, default=0.0)
    started_at = Column(DateTime, nullable=True)
    submitted_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    last_heartbeat_at = Column(DateTime, nullable=True)
    violation_count = Column(Integer, default=0, nullable=False)
    termination_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ClassroomQuizViolation(Base):
    """Proctoring or suspicious-behavior events during a classroom quiz attempt."""

    __tablename__ = "classroom_quiz_violations"

    id = Column(String, primary_key=True, default=new_id)
    classroom_quiz_id = Column(String, ForeignKey("classroom_quizzes.id"), nullable=False, index=True)
    attempt_id = Column(String, ForeignKey("classroom_quiz_attempts.id"), nullable=False, index=True)
    classroom_id = Column(String, ForeignKey("classrooms.id"), nullable=False, index=True)
    student_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    violation_type = Column(String, nullable=False)
    details = Column(JSON, nullable=True)
    action_taken = Column(String, default="terminated", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class ClassroomExam(Base):
    """Educator-authored exam that supports manual and AI-assisted authoring."""

    __tablename__ = "classroom_exams"

    id = Column(String, primary_key=True, default=new_id)
    classroom_id = Column(String, ForeignKey("classrooms.id"), nullable=False, index=True)
    educator_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    instructions = Column(Text, nullable=True)
    exam_mode = Column(String, default="mixed", nullable=False)
    authoring_mode = Column(String, default="manual", nullable=False)
    generation_scope = Column(String, default="selected_materials", nullable=False)
    total_marks = Column(Float, default=0.0, nullable=False)
    duration_minutes = Column(Integer, default=60, nullable=False)
    available_from = Column(DateTime, nullable=True)
    available_until = Column(DateTime, nullable=True)
    publish_to_stream = Column(Boolean, default=True, nullable=False)
    proctoring_enabled = Column(Boolean, default=True, nullable=False)
    allow_late_entries = Column(Boolean, default=False, nullable=False)
    status = Column(String, default="scheduled", nullable=False, index=True)
    linked_material_ids = Column(JSON, nullable=True)
    grading_notes = Column(JSON, nullable=True)
    anticheat_policy = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ClassroomExamBlock(Base):
    """Mini-word style blocks inside an exam document layout."""

    __tablename__ = "classroom_exam_blocks"

    id = Column(String, primary_key=True, default=new_id)
    exam_id = Column(String, ForeignKey("classroom_exams.id"), nullable=False, index=True)
    block_type = Column(String, default="text", nullable=False)
    title = Column(String, nullable=True)
    content = Column(JSON, nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)
    block_metadata = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ClassroomExamQuestion(Base):
    """Question metadata for objective and descriptive exam responses."""

    __tablename__ = "classroom_exam_questions"

    id = Column(String, primary_key=True, default=new_id)
    exam_id = Column(String, ForeignKey("classroom_exams.id"), nullable=False, index=True)
    block_id = Column(String, ForeignKey("classroom_exam_blocks.id"), nullable=True, index=True)
    prompt = Column(Text, nullable=False)
    question_type = Column(String, default="long_text", nullable=False)
    response_mode = Column(String, default="typed", nullable=False)
    marks = Column(Float, default=1.0, nullable=False)
    options = Column(JSON, nullable=True)
    answer_key = Column(Text, nullable=True)
    grading_keywords = Column(JSON, nullable=True)
    fixed_response_box = Column(Boolean, default=True, nullable=False)
    response_config = Column(JSON, nullable=True)
    ai_suggestion_context = Column(JSON, nullable=True)
    position = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ClassroomExamAttempt(Base):
    """Student attempt for a scheduled classroom exam."""

    __tablename__ = "classroom_exam_attempts"

    id = Column(String, primary_key=True, default=new_id)
    classroom_exam_id = Column(String, ForeignKey("classroom_exams.id"), nullable=False, index=True)
    classroom_id = Column(String, ForeignKey("classrooms.id"), nullable=False, index=True)
    student_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String, default="not_started", nullable=False, index=True)
    objective_score = Column(Float, default=0.0, nullable=False)
    descriptive_score = Column(Float, default=0.0, nullable=False)
    score = Column(Float, default=0.0, nullable=False)
    started_at = Column(DateTime, nullable=True)
    submitted_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    last_heartbeat_at = Column(DateTime, nullable=True)
    violation_count = Column(Integer, default=0, nullable=False)
    termination_reason = Column(Text, nullable=True)
    teacher_review_required = Column(Boolean, default=False, nullable=False)
    grading_summary = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ClassroomExamResponse(Base):
    """Per-question student response for a classroom exam attempt."""

    __tablename__ = "classroom_exam_responses"

    id = Column(String, primary_key=True, default=new_id)
    attempt_id = Column(String, ForeignKey("classroom_exam_attempts.id"), nullable=False, index=True)
    question_id = Column(String, ForeignKey("classroom_exam_questions.id"), nullable=False, index=True)
    typed_answer = Column(Text, nullable=True)
    uploaded_image_urls = Column(JSON, nullable=True)
    selected_option_ids = Column(JSON, nullable=True)
    ai_score = Column(Float, default=0.0, nullable=False)
    ai_feedback = Column(Text, nullable=True)
    teacher_score = Column(Float, nullable=True)
    teacher_feedback = Column(Text, nullable=True)
    review_status = Column(String, default="pending_ai", nullable=False)
    response_metadata = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ClassroomCertification(Base):
    """Educator-authored certification track linked to a classroom."""

    __tablename__ = "classroom_certifications"

    id = Column(String, primary_key=True, default=new_id)
    classroom_id = Column(String, ForeignKey("classrooms.id"), nullable=False, index=True)
    educator_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    course_mode = Column(String, default="biomentor_track", nullable=False)
    provider_name = Column(String, nullable=True)
    external_url = Column(String, nullable=True)
    issuer_name = Column(String, nullable=True)
    certificate_subtitle = Column(String, nullable=True)
    completion_message = Column(Text, nullable=True)
    status = Column(String, default="draft", nullable=False, index=True)
    manual_issue_only = Column(Boolean, default=False, nullable=False)
    requires_teacher_approval = Column(Boolean, default=True, nullable=False)
    certificate_template = Column(JSON, nullable=True)
    ai_notes = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ClassroomCertificationStep(Base):
    """Ordered milestones that define a certification track."""

    __tablename__ = "classroom_certification_steps"

    id = Column(String, primary_key=True, default=new_id)
    certification_id = Column(String, ForeignKey("classroom_certifications.id"), nullable=False, index=True)
    step_type = Column(String, default="custom_checkpoint", nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    linked_resource_id = Column(String, nullable=True, index=True)
    linked_resource_type = Column(String, nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)
    required = Column(Boolean, default=True, nullable=False)
    minimum_score = Column(Float, nullable=True)
    step_metadata = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ClassroomCertificationEnrollment(Base):
    """Per-student progress state for a classroom certification."""

    __tablename__ = "classroom_certification_enrollments"

    id = Column(String, primary_key=True, default=new_id)
    certification_id = Column(String, ForeignKey("classroom_certifications.id"), nullable=False, index=True)
    classroom_id = Column(String, ForeignKey("classrooms.id"), nullable=False, index=True)
    student_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String, default="not_started", nullable=False, index=True)
    completion_percentage = Column(Float, default=0.0, nullable=False)
    teacher_notes = Column(Text, nullable=True)
    proof_status = Column(String, default="not_required", nullable=False)
    completed_at = Column(DateTime, nullable=True)
    issued_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ClassroomCertificationStepProgress(Base):
    """Manual or reviewed completion state for one certification step."""

    __tablename__ = "classroom_certification_step_progress"

    id = Column(String, primary_key=True, default=new_id)
    enrollment_id = Column(String, ForeignKey("classroom_certification_enrollments.id"), nullable=False, index=True)
    step_id = Column(String, ForeignKey("classroom_certification_steps.id"), nullable=False, index=True)
    status = Column(String, default="available", nullable=False, index=True)
    score_achieved = Column(Float, nullable=True)
    completion_source = Column(String, default="auto", nullable=False)
    evidence_payload = Column(JSON, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CertificationProofSubmission(Base):
    """Optional learner proof submission for an external certification step."""

    __tablename__ = "certification_proof_submissions"

    id = Column(String, primary_key=True, default=new_id)
    enrollment_id = Column(String, ForeignKey("classroom_certification_enrollments.id"), nullable=False, index=True)
    student_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    step_id = Column(String, ForeignKey("classroom_certification_steps.id"), nullable=False, index=True)
    proof_type = Column(String, default="text", nullable=False)
    file_url = Column(String, nullable=True)
    proof_url = Column(String, nullable=True)
    text_note = Column(Text, nullable=True)
    submitted_at = Column(DateTime, default=datetime.utcnow, index=True)
    review_status = Column(String, default="submitted", nullable=False, index=True)
    reviewed_at = Column(DateTime, nullable=True)
    reviewed_by = Column(String, ForeignKey("users.id"), nullable=True, index=True)


class IssuedCertificate(Base):
    """Rendered certificate artifact issued to a student."""

    __tablename__ = "issued_certificates"

    id = Column(String, primary_key=True, default=new_id)
    certification_id = Column(String, ForeignKey("classroom_certifications.id"), nullable=False, index=True)
    classroom_id = Column(String, ForeignKey("classrooms.id"), nullable=False, index=True)
    student_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    educator_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    certificate_number = Column(String, nullable=False, unique=True, index=True)
    student_name_snapshot = Column(String, nullable=False)
    course_title_snapshot = Column(String, nullable=False)
    issued_at = Column(DateTime, default=datetime.utcnow, index=True)
    file_url = Column(String, nullable=True)
    render_payload = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AssessmentAnticheatCase(Base):
    """Teacher review case for an auto-ended quiz or exam attempt."""

    __tablename__ = "assessment_anticheat_cases"

    id = Column(String, primary_key=True, default=new_id)
    classroom_id = Column(String, ForeignKey("classrooms.id"), nullable=False, index=True)
    assessment_type = Column(String, nullable=False, index=True)
    assessment_id = Column(String, nullable=False, index=True)
    attempt_id = Column(String, nullable=False, index=True)
    student_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    final_case_reason = Column(String, nullable=True)
    status = Column(String, default="teacher_review_required", nullable=False, index=True)
    teacher_review_required = Column(Boolean, default=True, nullable=False)
    latest_warning_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    reviewer_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)


class AssessmentAnticheatEvidence(Base):
    """Evidence snapshots attached to an anti-cheat review case."""

    __tablename__ = "assessment_anticheat_evidence"

    id = Column(String, primary_key=True, default=new_id)
    case_id = Column(String, ForeignKey("assessment_anticheat_cases.id"), nullable=False, index=True)
    classroom_id = Column(String, ForeignKey("classrooms.id"), nullable=False, index=True)
    assessment_type = Column(String, nullable=False, index=True)
    assessment_id = Column(String, nullable=False, index=True)
    attempt_id = Column(String, nullable=False, index=True)
    student_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    violation_type = Column(String, nullable=False)
    action_taken = Column(String, default="warning", nullable=False)
    image_url = Column(String, nullable=True)
    details = Column(JSON, nullable=True)
    captured_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class ClassroomMessageThread(Base):
    """Persistent private teacher-student classroom thread."""

    __tablename__ = "classroom_message_threads"

    id = Column(String, primary_key=True, default=new_id)
    classroom_id = Column(String, ForeignKey("classrooms.id"), nullable=False, index=True)
    teacher_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    student_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    last_message_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)


class ClassroomThreadMessage(Base):
    """Messages inside a classroom private thread."""

    __tablename__ = "classroom_thread_messages"

    id = Column(String, primary_key=True, default=new_id)
    thread_id = Column(String, ForeignKey("classroom_message_threads.id"), nullable=False, index=True)
    sender_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    message_type = Column(String, default="text", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Notification(Base):
    """In-app notifications, email-ready for later delivery channels."""

    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    classroom_id = Column(String, ForeignKey("classrooms.id"), nullable=True, index=True)
    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    action_url = Column(String, nullable=True)
    delivery_channels = Column(JSON, nullable=True)
    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class SupportComplaint(Base):
    """Student-raised complaint or help request."""

    __tablename__ = "support_complaints"

    id = Column(String, primary_key=True, default=new_id)
    student_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    educator_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    classroom_id = Column(String, ForeignKey("classrooms.id"), nullable=True, index=True)
    subject = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    priority = Column(String, default="medium", nullable=False)
    status = Column(String, default="open", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)


class LiveSession(Base):
    """Real-time collaboration session."""

    __tablename__ = "live_sessions"

    id = Column(String, primary_key=True, default=new_id)
    classroom_id = Column(String, ForeignKey("classrooms.id"), nullable=True, index=True)
    educator_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    agenda = Column(Text, nullable=True)
    join_code = Column(String, unique=True, index=True, nullable=False)
    status = Column(String, default="scheduled", nullable=False)
    meeting_provider = Column(String, nullable=True)
    meeting_url = Column(String, nullable=True)
    scheduled_for = Column(DateTime, nullable=True)
    notification_sent_at = Column(DateTime, nullable=True)
    resource_document_ids = Column(JSON, nullable=True)
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ClassroomLiveMeeting(Base):
    """Classroom-native scheduled or live WebRTC meeting."""

    __tablename__ = "classroom_live_meetings"

    id = Column(String, primary_key=True, default=new_id)
    classroom_id = Column(String, ForeignKey("classrooms.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    scheduled_start = Column(DateTime, nullable=False, index=True)
    scheduled_end = Column(DateTime, nullable=False)
    created_by_teacher_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    meeting_token = Column(String, nullable=False, unique=True, index=True)
    status = Column(String, default="scheduled", nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ClassroomMeetingTranscript(Base):
    """Transcript snippet captured during a classroom live meeting."""

    __tablename__ = "classroom_meeting_transcripts"

    id = Column(String, primary_key=True, default=new_id)
    meeting_id = Column(String, ForeignKey("classroom_live_meetings.id"), nullable=False, index=True)
    classroom_id = Column(String, ForeignKey("classrooms.id"), nullable=False, index=True)
    speaker_role = Column(String, default="participant", nullable=False)
    speaker_name = Column(String, nullable=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class ClassroomMeetingEvent(Base):
    """Structured meeting event used by the AI meeting assistant."""

    __tablename__ = "classroom_meeting_events"

    id = Column(String, primary_key=True, default=new_id)
    meeting_id = Column(String, ForeignKey("classroom_live_meetings.id"), nullable=False, index=True)
    classroom_id = Column(String, ForeignKey("classrooms.id"), nullable=False, index=True)
    actor_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    event_type = Column(String, nullable=False, index=True)
    payload = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class ClassroomMeetingAISummary(Base):
    """Persisted teacher and student AI summary payloads for meetings."""

    __tablename__ = "classroom_meeting_ai_summaries"

    id = Column(String, primary_key=True, default=new_id)
    meeting_id = Column(String, ForeignKey("classroom_live_meetings.id"), nullable=False, index=True)
    classroom_id = Column(String, ForeignKey("classrooms.id"), nullable=False, index=True)
    summary_type = Column(String, nullable=False, index=True)
    content_json = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class LiveSessionParticipant(Base):
    """Tracks who joined a live session."""

    __tablename__ = "live_session_participants"

    id = Column(String, primary_key=True, default=new_id)
    session_id = Column(String, ForeignKey("live_sessions.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String, nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow)
    last_seen_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    engagement_score = Column(Float, default=0.0)


class CollaborationEvent(Base):
    """Stored collaboration events for live sessions."""

    __tablename__ = "collaboration_events"

    id = Column(String, primary_key=True, default=new_id)
    session_id = Column(String, ForeignKey("live_sessions.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    event_type = Column(String, nullable=False)
    payload = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class APILog(Base):
    """API call logging for lightweight auditing."""

    __tablename__ = "api_logs"

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    endpoint = Column(String)
    method = Column(String)
    status_code = Column(Integer)
    response_time_ms = Column(Float)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
