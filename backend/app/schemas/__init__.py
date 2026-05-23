"""Pydantic schemas for request/response validation."""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime


# ===== AUTH SCHEMAS =====
class UserRegister(BaseModel):
    """User registration request."""
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str
    role: str = "student"
    institution_name: Optional[str] = None
    focus_area: Optional[str] = None
    class_code: Optional[str] = None


class UserLogin(BaseModel):
    """User login request."""
    email: EmailStr
    password: str
    desired_role: Optional[str] = None


class UserResponse(BaseModel):
    """User response model."""
    id: str
    email: str
    full_name: str
    role: str
    institution_name: Optional[str] = None
    focus_area: Optional[str] = None
    class_code: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class Token(BaseModel):
    """JWT token response."""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ===== DOCUMENT SCHEMAS =====
class DocumentMetadata(BaseModel):
    """Document metadata."""
    file_name: str
    file_size: int
    pages: int
    upload_date: datetime


class DocumentCreate(BaseModel):
    """Create document request."""
    title: str
    description: Optional[str] = None


class DocumentResponse(BaseModel):
    """Document response."""
    id: str
    user_id: str
    title: str
    file_name: str
    file_size: int
    pages: int
    content_preview: Optional[str] = None
    processing_status: Optional[str] = None
    is_processed: Optional[bool] = None
    embedding_count: Optional[int] = None
    storage_mode: Optional[str] = None
    selected_pages: Optional[List[int]] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# ===== BLOOM'S TAXONOMY SCHEMAS =====
class BloomLevel(BaseModel):
    """Bloom's Taxonomy level."""
    level: int  # 1-6
    name: str  # Remember, Understand, Apply, Analyze, Evaluate, Create
    description: str
    keywords: List[str]


class TaxonomyAnalysis(BaseModel):
    """Taxonomy analysis result."""
    current_level: int
    current_level_name: str
    target_level: Optional[int] = None
    target_level_name: Optional[str] = None
    confidence: float


# ===== QUIZ SCHEMAS =====
class QuizOption(BaseModel):
    """Quiz question option."""
    id: str
    text: str
    is_correct: Optional[bool] = None  # None if not revealed


class QuizQuestion(BaseModel):
    """Quiz question."""
    id: str
    text: str
    document_id: Optional[str] = None
    document_reference: Optional[str] = None
    page_number: Optional[int] = None
    source_excerpt: Optional[str] = None
    bloom_level: int
    bloom_level_name: str
    options: List[QuizOption]
    explanation: Optional[str] = None
    
    class Config:
        from_attributes = True


class QuizSessionCreate(BaseModel):
    """Create quiz session."""
    num_questions: int = 10
    bloom_level: Optional[int] = None  # If specified, filter questions
    document_ids: Optional[List[str]] = None  # If empty, use all documents
    duration_minutes: Optional[int] = None  # Time limit in minutes


class QuizGenerationResponse(BaseModel):
    """Response returned when a quiz session is generated."""
    session_id: str
    questions: List[QuizQuestion]


class QuizSessionResponse(BaseModel):
    """Quiz session response."""
    id: str
    user_id: str
    questions: List[QuizQuestion]
    current_question_index: int
    score: int = 0
    total_questions: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class QuizAnswer(BaseModel):
    """User's quiz answer."""
    question_id: str
    selected_option_id: str


class QuizSubmissionAnswer(BaseModel):
    """Single submitted answer."""
    question_id: str
    selected_option_id: str


class QuizSubmissionRequest(BaseModel):
    """Submit a completed quiz session."""
    session_id: str
    answers: List[QuizSubmissionAnswer]
    total_questions: int


class LiveSessionJoinRequest(BaseModel):
    """Join a collaboration session."""
    join_code: str


class CollaborationEventCreate(BaseModel):
    """Create a collaboration event."""
    event_type: str
    content: str
    metadata: Optional[dict] = None


# ===== QUESTION AGENT SCHEMAS =====
class QuestionConversionRequest(BaseModel):
    """Request to convert question difficulty."""
    question_text: str
    current_level: int  # 1-6 (Bloom's)
    target_level: int   # 1-6 (Bloom's)
    context: Optional[str] = None  # Document context if available


class QuestionVariant(BaseModel):
    """Generated question variant."""
    text: str
    bloom_level: int
    bloom_level_name: str
    reasoning: str  # Why this level


class QuestionConversionResponse(BaseModel):
    """Response from question converter."""
    original_question: str
    current_analysis: TaxonomyAnalysis
    variants: List[QuestionVariant]  # Simplified, same, advanced
    source_document: Optional[str] = None
    confidence: float


class AnalyzeLevelRequest(BaseModel):
    """Request to analyze question's Bloom's level."""
    question_text: str


class AnalyzeLevelResponse(BaseModel):
    """Response from level analyzer."""
    level: int  # 1-6 (Bloom's)
    level_name: str  # Remember, Understand, Apply, Analyze, Evaluate, Create
    confidence: float
    keywords: Optional[List[str]] = None
    description: Optional[str] = None


# ===== RAG SCHEMAS =====
class RetrievalRequest(BaseModel):
    """Document retrieval request."""
    query: str
    top_k: int = 5
    document_ids: Optional[List[str]] = None


class RetrievedContext(BaseModel):
    """Retrieved context chunk."""
    content: str
    document_id: str
    document_title: str
    page_number: int
    chunk_index: int
    relevance_score: float


class RetrievalResponse(BaseModel):
    """Document retrieval response."""
    query: str
    results: List[RetrievedContext]


class ConversationTurn(BaseModel):
    """Minimal chat turn used for follow-up aware answering."""
    role: str
    content: str


class AnswerGenerationRequest(BaseModel):
    """Request to generate answer."""
    question: str
    document_ids: Optional[List[str]] = None
    include_sources: bool = True
    conversation_history: Optional[List[ConversationTurn]] = None


class SourceReference(BaseModel):
    """Source reference for answer."""
    document_id: Optional[str] = None
    document_title: str
    page_number: int
    chunk_index: Optional[int] = None
    excerpt: str


class AnswerGenerationResponse(BaseModel):
    """Generated answer response."""
    question: str
    answer: str
    sources: List[SourceReference]
    confidence: float
    generated_at: datetime


class ClassroomCreate(BaseModel):
    """Create a classroom."""
    name: str
    description: Optional[str] = None
    subject: str = "Biology"


class ClassroomResponse(BaseModel):
    """Classroom response."""
    id: str
    educator_id: str
    name: str
    description: Optional[str] = None
    subject: str
    invite_code: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ClassroomEnrollmentJoin(BaseModel):
    """Join a classroom by invite code."""
    invite_code: str


class ClassroomAnnouncementCreate(BaseModel):
    """Create a public classroom stream post."""
    title: Optional[str] = None
    content: str
    post_type: str = "announcement"
    linked_document_id: Optional[str] = None
    linked_live_session_id: Optional[str] = None
    is_pinned: bool = False


class ClassroomMaterialShareCreate(BaseModel):
    """Share an existing document into classroom classwork."""
    document_id: str
    title_override: Optional[str] = None
    description: Optional[str] = None


class ClassroomAssignmentCreate(BaseModel):
    """Create a classwork item inside a classroom."""
    title: str
    description: Optional[str] = None
    assignment_type: str = "task"
    document_id: Optional[str] = None
    quiz_reference: Optional[str] = None
    due_at: Optional[datetime] = None


class ManualClassroomQuizOption(BaseModel):
    """One option inside an educator-authored manual quiz question."""
    id: str
    text: str


class ManualClassroomQuizQuestion(BaseModel):
    """Educator-authored manual question with answer key."""
    prompt: str
    options: List[ManualClassroomQuizOption]
    correct_option_id: str
    explanation: Optional[str] = None
    bloom_level: Optional[int] = 3


class ClassroomQuizCreate(BaseModel):
    """Create and publish a classroom quiz."""
    title: str
    description: Optional[str] = None
    document_id: Optional[str] = None
    quiz_mode: str = "generated"
    bloom_level: Optional[int] = None
    num_questions: int = 5
    duration_minutes: int = 15
    available_from: Optional[datetime] = None
    available_until: Optional[datetime] = None
    publish_to_stream: bool = True
    proctoring_enabled: bool = True
    allow_late_entries: bool = False
    manual_questions: Optional[List[ManualClassroomQuizQuestion]] = None


class ClassroomQuizSubmissionAnswer(BaseModel):
    """Single answer inside a classroom quiz attempt."""
    question_id: str
    selected_option_id: str


class ClassroomQuizAttemptSubmit(BaseModel):
    """Submit a classroom quiz attempt."""
    attempt_id: str
    answers: List[ClassroomQuizSubmissionAnswer]
    total_questions: int


class ClassroomQuizViolationCreate(BaseModel):
    """Report a browser-side proctoring violation."""
    attempt_id: str
    violation_type: str
    details: Optional[dict] = None


class ReinforcementLessonCreate(BaseModel):
    """Assign a reinforcement lesson."""
    title: str
    instructions: str
    classroom_id: Optional[str] = None
    student_id: Optional[str] = None
    document_id: Optional[str] = None
    target_bloom_level: Optional[int] = None
    due_at: Optional[datetime] = None


class CommunicationMessageCreate(BaseModel):
    """Send a communication message."""
    subject: str
    content: str
    classroom_id: Optional[str] = None
    recipient_id: Optional[str] = None
    audience: str = "student"


class LiveSessionCreate(BaseModel):
    """Create a live collaboration session."""
    title: str
    agenda: Optional[str] = None
    classroom_id: Optional[str] = None
    meeting_url: Optional[str] = None
    resource_document_ids: Optional[List[str]] = None


class ClassroomLiveScheduleCreate(BaseModel):
    """Schedule a classroom live session backed by an external meeting link."""
    title: str
    agenda: Optional[str] = None
    meeting_provider: str = "external"
    meeting_url: str
    scheduled_for: datetime
    resource_document_ids: Optional[List[str]] = None


class PollCreate(BaseModel):
    """Create a live poll."""
    question: str
    options: List[str]


class VoteCreate(BaseModel):
    """Submit a vote/response."""
    choice: str


class ClassroomThreadCreate(BaseModel):
    """Create or look up a persistent classroom teacher-student thread."""
    recipient_id: Optional[str] = None


class ClassroomThreadMessageCreate(BaseModel):
    """Send a message within a classroom teacher-student thread."""
    content: str


class QuickCheckCreate(BaseModel):
    """Create a short live quiz prompt."""
    question: str
    options: List[str]
    correct_option: str
    explanation: Optional[str] = None


class SupportComplaintCreate(BaseModel):
    """Student complaint/help request."""
    classroom_id: Optional[str] = None
    subject: str
    content: str
    priority: str = "medium"


class TeacherDashboardResponse(BaseModel):
    """Educator dashboard summary."""
    educator: UserResponse
    overview: dict
    alerts: List[dict]
    classrooms: List[dict]
    struggling_students: List[dict]
    complaints: List[dict]
    live_sessions: List[dict]


class AdminAnalyticsResponse(BaseModel):
    """Institution/admin analytics summary."""
    overview: dict
    mastery_by_role: List[dict]
    engagement: dict
    class_comparisons: List[dict]
    complaint_summary: dict
    live_sessions: List[dict]
