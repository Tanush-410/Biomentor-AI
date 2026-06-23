"""Pydantic schemas for request/response validation."""
from pydantic import BaseModel, EmailStr, Field
from typing import Any, Dict, Optional, List, Union
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


class StickyNoteBase(BaseModel):
    """Shared sticky note fields."""
    page_url: str
    title: Optional[str] = Field(default=None, max_length=120)
    content: str = Field(..., max_length=4000)
    color: str = "amber"
    x_ratio: float = Field(default=0.5, ge=0.0, le=1.0)
    y_ratio: float = Field(default=0.25, ge=0.0, le=1.0)
    x_position: Optional[int] = Field(default=None, ge=0, le=1_000_000)
    y_position: Optional[int] = Field(default=None, ge=0, le=1_000_000)
    width: int = Field(default=320, ge=220, le=420)
    height: int = Field(default=220, ge=160, le=420)


class StickyNoteCreate(StickyNoteBase):
    """Create sticky note request."""


class StickyNoteUpdate(BaseModel):
    """Partial sticky note update request."""
    title: Optional[str] = Field(default=None, max_length=120)
    content: Optional[str] = Field(default=None, max_length=4000)
    color: Optional[str] = None
    x_ratio: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    y_ratio: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    x_position: Optional[int] = Field(default=None, ge=0, le=1_000_000)
    y_position: Optional[int] = Field(default=None, ge=0, le=1_000_000)
    width: Optional[int] = Field(default=None, ge=220, le=420)
    height: Optional[int] = Field(default=None, ge=160, le=420)
    z_index: Optional[int] = Field(default=None, ge=1)


class StickyNoteResponse(StickyNoteBase):
    """Sticky note response."""
    id: str
    user_id: str
    z_index: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MaterialIntelligenceGlossaryItem(BaseModel):
    """Glossary-style term extracted from uploaded material."""
    term: str
    meaning: str


class MaterialIntelligenceFlashcard(BaseModel):
    """Flashcard prompt and answer derived from uploaded material."""
    prompt: str
    answer: str


class MaterialLayeredSummaries(BaseModel):
    """Three study depths for the same material."""
    quick: str
    standard: str
    exam_focus: str


class MaterialConceptNode(BaseModel):
    """One concept and its connections inside the document."""
    label: str
    importance: str
    connects_to: List[str] = Field(default_factory=list)


class MaterialTrapItem(BaseModel):
    """One misconception trap and the correction."""
    concept: str
    trap: str
    correction: str


class MaterialVivaQuestion(BaseModel):
    """A likely viva/oral question from the material."""
    question: str
    expected_focus: str


class MaterialStudyStep(BaseModel):
    """One recommended next study action."""
    label: str
    reason: str


class MaterialIntelligenceResponse(BaseModel):
    """Document-level AI study layer."""
    document_id: str
    document_title: str
    summary: str
    layered_summaries: MaterialLayeredSummaries
    revision_bullets: List[str] = Field(default_factory=list)
    glossary: List[MaterialIntelligenceGlossaryItem] = Field(default_factory=list)
    flashcards: List[MaterialIntelligenceFlashcard] = Field(default_factory=list)
    follow_up_prompts: List[str] = Field(default_factory=list)
    prerequisite_warning: Optional[str] = None
    concepts: List[Dict[str, Any]] = Field(default_factory=list)
    key_pages: List[Dict[str, Any]] = Field(default_factory=list)
    concept_map: List[MaterialConceptNode] = Field(default_factory=list)
    misconception_traps: List[MaterialTrapItem] = Field(default_factory=list)
    viva_questions: List[MaterialVivaQuestion] = Field(default_factory=list)
    study_path: List[MaterialStudyStep] = Field(default_factory=list)
    confidence: Optional[str] = None
    confidence_reason: Optional[str] = None


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
    page_number: Optional[int] = None
    chunk_index: Optional[int] = None
    excerpt: str
    url: Optional[str] = None
    source_type: str = "material"


class QuickCheckQuestionOption(BaseModel):
    """One option for a lightweight chat quick check."""
    id: str
    text: str


class QuickCheckQuestion(BaseModel):
    """One mini-test question in the learning chat."""
    id: str
    prompt: str
    options: List[QuickCheckQuestionOption]
    correct_option_id: Optional[str] = None
    explanation: Optional[str] = None


class QuickCheckPayload(BaseModel):
    """Adaptive quick check payload attached to a chat answer."""
    id: str
    title: str
    questions: List[QuickCheckQuestion]


class QuickCheckAnswer(BaseModel):
    """Student answer for one quick-check question."""
    question_id: str
    selected_option_id: str


class QuickCheckEvaluationRequest(BaseModel):
    """Submit quick-check answers for grading."""
    quick_check_id: str
    quick_check: QuickCheckPayload
    answers: List[QuickCheckAnswer]


class QuickCheckEvaluationResult(BaseModel):
    """One graded quick-check result."""
    question_id: str
    selected_option_id: str
    correct_option_id: str
    is_correct: bool
    explanation: str


class QuickCheckEvaluationResponse(BaseModel):
    """Targeted feedback for a quick check."""
    quick_check_id: str
    score: int
    total_questions: int
    results: List[QuickCheckEvaluationResult]
    next_step: str


class AnswerGenerationResponse(BaseModel):
    """Generated answer response."""
    question: str
    answer: str
    sources: List[SourceReference]
    confidence: float
    confidence_label: str = "medium"
    confidence_reason: str = ""
    answer_origin: str = "material"
    source_badge: str = "Answered from your material"
    fallback_used: bool = False
    complexity: str = "simple"
    show_quick_check: bool = False
    quick_check: Optional[QuickCheckPayload] = None
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


class QuizQualityIssue(BaseModel):
    """One issue detected during quiz-quality review."""
    severity: str
    title: str
    detail: str


class QuizQualitySuggestion(BaseModel):
    """One suggestion emitted by the quiz-quality layer."""
    title: str
    detail: str


class QuizQualityBloomMetric(BaseModel):
    """Bloom-distribution summary for a quiz draft."""
    level: int
    label: str
    count: int
    percentage: int


class QuizQualityQuestionHealth(BaseModel):
    """Per-question health summary for manual quiz review."""
    question_number: int
    status: str
    title: str
    detail: str


class QuizQualityFixFirstItem(BaseModel):
    """Highest-priority action before releasing a quiz."""
    title: str
    detail: str
    impact: str


class QuizQualityRemediationStep(BaseModel):
    """Post-release coaching step tied to quiz shape."""
    phase: str
    action: str


class QuizQualityReviewRequest(BaseModel):
    """Educator draft-review request before publishing a classroom quiz."""
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


class QuizQualityReviewResponse(BaseModel):
    """Educator-facing AI quiz-quality review payload."""
    quality_score: int
    readiness: str
    summary: str
    assessment_focus: str
    release_risk: str
    issues: List[QuizQualityIssue] = Field(default_factory=list)
    suggestions: List[QuizQualitySuggestion] = Field(default_factory=list)
    bloom_distribution: List[QuizQualityBloomMetric] = Field(default_factory=list)
    question_health: List[QuizQualityQuestionHealth] = Field(default_factory=list)
    fix_first: List[QuizQualityFixFirstItem] = Field(default_factory=list)
    remediation_plan: List[QuizQualityRemediationStep] = Field(default_factory=list)
    confidence: Optional[str] = None
    confidence_reason: Optional[str] = None


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


class ClassroomQuizHeartbeatCreate(BaseModel):
    """Keep an in-progress classroom quiz attempt marked as active."""
    attempt_id: str


class ClassroomQuizWarningCreate(BaseModel):
    """Report an AI-assisted proctoring warning before debarment."""
    attempt_id: str
    warning_type: str
    details: Optional[dict] = None


class ClassroomExamBlockCreate(BaseModel):
    """Mini-word block used to compose an educator exam."""
    block_type: str = "text"
    title: Optional[str] = None
    content: Dict[str, Any] = Field(default_factory=dict)
    sort_order: int = 0
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ClassroomExamQuestionOption(BaseModel):
    """One option for an objective exam question."""
    id: str
    text: str


class ClassroomExamQuestionCreate(BaseModel):
    """One exam question authored manually or suggested by AI."""
    prompt: str
    question_type: str = "long_text"
    response_mode: str = "typed"
    marks: float = 1.0
    options: List[ClassroomExamQuestionOption] = Field(default_factory=list)
    answer_key: Optional[str] = None
    grading_keywords: List[str] = Field(default_factory=list)
    fixed_response_box: bool = True
    response_config: Dict[str, Any] = Field(default_factory=dict)
    ai_suggestion_context: Dict[str, Any] = Field(default_factory=dict)
    position: int = 0


class ClassroomExamCreate(BaseModel):
    """Create and publish a classroom exam."""
    title: str
    description: Optional[str] = None
    instructions: Optional[str] = None
    exam_mode: str = "mixed"
    authoring_mode: str = "manual"
    generation_scope: str = "selected_materials"
    total_marks: float = 0.0
    duration_minutes: int = 60
    available_from: Optional[datetime] = None
    available_until: Optional[datetime] = None
    publish_to_stream: bool = True
    proctoring_enabled: bool = True
    allow_late_entries: bool = False
    linked_material_ids: List[str] = Field(default_factory=list)
    grading_notes: Dict[str, Any] = Field(default_factory=dict)
    anticheat_policy: Dict[str, Any] = Field(default_factory=dict)
    blocks: List[ClassroomExamBlockCreate] = Field(default_factory=list)
    questions: List[ClassroomExamQuestionCreate] = Field(default_factory=list)


class ClassroomExamDraftCreate(BaseModel):
    """Generate an AI-assisted classroom exam draft from linked material."""
    title: Optional[str] = None
    instructions: Optional[str] = None
    exam_mode: str = "mixed"
    generation_scope: str = "selected_materials"
    linked_material_ids: List[str] = Field(default_factory=list)
    num_questions: int = 6


class ClassroomExamHeartbeatCreate(BaseModel):
    """Keep an in-progress classroom exam attempt active."""
    attempt_id: str


class ClassroomExamResponseInput(BaseModel):
    """Per-question student response on a classroom exam."""
    question_id: str
    typed_answer: Optional[str] = None
    uploaded_image_urls: List[str] = Field(default_factory=list)
    selected_option_ids: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ClassroomExamAttemptSubmit(BaseModel):
    """Submit a classroom exam attempt."""
    attempt_id: str
    responses: List[ClassroomExamResponseInput] = Field(default_factory=list)


class ClassroomExamTeacherReviewResponseUpdate(BaseModel):
    """Teacher override for one descriptive exam response."""
    response_id: str
    teacher_score: float = 0.0
    teacher_feedback: Optional[str] = None
    review_status: str = "teacher_finalized"


class ClassroomExamTeacherReviewSubmit(BaseModel):
    """Finalize teacher review for one submitted classroom exam attempt."""
    overall_feedback: Optional[str] = None
    responses: List[ClassroomExamTeacherReviewResponseUpdate] = Field(default_factory=list)


class ClassroomCertificationStepCreate(BaseModel):
    """One milestone inside a classroom certification track."""
    step_type: str = "custom_checkpoint"
    title: str
    description: Optional[str] = None
    linked_resource_id: Optional[str] = None
    linked_resource_type: Optional[str] = None
    required: bool = True
    minimum_score: Optional[float] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    sort_order: int = 0


class ClassroomCertificationCreate(BaseModel):
    """Create a classroom certification."""
    title: str
    description: Optional[str] = None
    course_mode: str = "biomentor_track"
    provider_name: Optional[str] = None
    external_url: Optional[str] = None
    issuer_name: Optional[str] = None
    certificate_subtitle: Optional[str] = None
    completion_message: Optional[str] = None
    manual_issue_only: bool = False
    requires_teacher_approval: bool = True
    certificate_template: Dict[str, Any] = Field(default_factory=dict)
    ai_notes: Dict[str, Any] = Field(default_factory=dict)
    steps: List[ClassroomCertificationStepCreate] = Field(default_factory=list)


class ClassroomCertificationUpdate(BaseModel):
    """Update a classroom certification."""
    title: Optional[str] = None
    description: Optional[str] = None
    provider_name: Optional[str] = None
    external_url: Optional[str] = None
    issuer_name: Optional[str] = None
    certificate_subtitle: Optional[str] = None
    completion_message: Optional[str] = None
    manual_issue_only: Optional[bool] = None
    requires_teacher_approval: Optional[bool] = None
    certificate_template: Optional[Dict[str, Any]] = None
    ai_notes: Optional[Dict[str, Any]] = None
    steps: Optional[List[ClassroomCertificationStepCreate]] = None


class ClassroomCertificationDraftCreate(BaseModel):
    """Generate AI-style certification milestone suggestions from selected materials."""
    title: Optional[str] = None
    course_mode: str = "biomentor_track"
    linked_material_ids: List[str] = Field(default_factory=list)
    target_outcome: Optional[str] = None


class ClassroomCertificationStepCompleteCreate(BaseModel):
    """Student completion payload for one certification step."""
    note: Optional[str] = None
    proof_url: Optional[str] = None


class ClassroomCertificationOverrideStepCreate(BaseModel):
    """Teacher override for one certification step."""
    student_id: str
    step_id: str
    status: str = "completed"
    note: Optional[str] = None
    score_achieved: Optional[float] = None


class ClassroomCertificationProofCreate(BaseModel):
    """Student proof submission for an external certification step."""
    step_id: str
    proof_type: str = "text"
    proof_url: Optional[str] = None
    text_note: Optional[str] = None


class IssuedCertificateResponse(BaseModel):
    """Issued certificate artifact summary."""
    id: str
    certification_id: str
    classroom_id: str
    certificate_number: str
    student_name: str
    course_title: str
    issued_at: Union[datetime, str]
    render_payload: Dict[str, Any] = Field(default_factory=dict)


class ClassroomCertificationStudentSummaryResponse(BaseModel):
    """Student progress view for one certification."""
    student_id: str
    student_name: str
    status: str
    completion_percentage: float = 0.0
    ready_for_issue: bool = False
    issued_certificate_id: Optional[str] = None


class ClassroomCertificationResponse(BaseModel):
    """Serialized classroom certification detail."""
    id: str
    classroom_id: str
    title: str
    description: Optional[str] = None
    course_mode: str
    provider_name: Optional[str] = None
    external_url: Optional[str] = None
    issuer_name: Optional[str] = None
    certificate_subtitle: Optional[str] = None
    completion_message: Optional[str] = None
    status: str
    manual_issue_only: bool = False
    requires_teacher_approval: bool = True
    steps: List[Dict[str, Any]] = Field(default_factory=list)
    certificate_template: Dict[str, Any] = Field(default_factory=dict)
    ai_notes: Dict[str, Any] = Field(default_factory=dict)
    viewer_progress: Optional[Dict[str, Any]] = None
    created_at: Union[datetime, str]


class ClassroomCertificationRosterResponse(BaseModel):
    """Educator roster for one certification."""
    certification: ClassroomCertificationResponse
    roster: List[ClassroomCertificationStudentSummaryResponse] = Field(default_factory=list)


class ClassroomExamWarningCreate(BaseModel):
    """Record a major anti-cheat warning during a classroom exam."""
    attempt_id: str
    warning_type: str
    details: Optional[dict] = None


class ClassroomExamViolationCreate(BaseModel):
    """Record an auto-end anti-cheat violation during a classroom exam."""
    attempt_id: str
    violation_type: str
    details: Optional[dict] = None


class AnticheatEvidenceSnapshotResponse(BaseModel):
    """One evidence snapshot visible in the educator anti-cheat bot."""
    id: str
    image_url: Optional[str] = None
    violation_type: str
    action_taken: str
    captured_at: Union[datetime, str]
    details: Dict[str, Any] = Field(default_factory=dict)


class AnticheatBotCaseResponse(BaseModel):
    """Final debarred review card shown to educators."""
    id: str
    assessment_type: str
    assessment_id: str
    attempt_id: str
    student_id: str
    student_name: Optional[str] = None
    final_case_reason: Optional[str] = None
    status: str
    teacher_review_required: bool = True
    latest_warning_count: int = 0
    evidence_snapshots: List[AnticheatEvidenceSnapshotResponse] = Field(default_factory=list)
    created_at: Union[datetime, str]


class AnticheatBotResponse(BaseModel):
    """Educator anti-cheat bot summary for exams and quizzes."""
    cases: List[AnticheatBotCaseResponse] = Field(default_factory=list)


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


class ClassroomMeetingCreate(BaseModel):
    """Teacher schedules a classroom-native live meeting."""
    title: str
    description: Optional[str] = None
    scheduled_start: datetime
    scheduled_end: datetime


class ClassroomMeetingResponse(BaseModel):
    """Serialized classroom-native live meeting."""
    id: str
    classroom_id: str
    title: str
    description: Optional[str] = None
    scheduled_start: datetime
    scheduled_end: datetime
    created_by_teacher_id: str
    meeting_token: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MeetingTranscriptCreateRequest(BaseModel):
    """Transcript snippet posted from the live meeting room."""
    speaker_role: str = "participant"
    speaker_name: Optional[str] = None
    content: str


class MeetingEventCreateRequest(BaseModel):
    """Structured classroom meeting event for the assistant."""
    event_type: str
    payload: Dict[str, Any] = Field(default_factory=dict)


class MeetingAssistantSection(BaseModel):
    """One assistant panel section."""
    items: List[str] = Field(default_factory=list)


class MeetingAssistantTeacherMove(BaseModel):
    """Teacher move suggested by the meeting assistant."""
    label: str
    reason: str


class MeetingAssistantFollowUpAsset(BaseModel):
    """Suggested artifact to share after the meeting."""
    label: str
    reason: str


class MeetingAssistantSnapshotResponse(BaseModel):
    """Teacher-facing AI meeting assistant state."""
    meeting_id: str
    live_notes: MeetingAssistantSection
    concept_signals: MeetingAssistantSection
    action_items: MeetingAssistantSection
    teacher_moves: List[MeetingAssistantTeacherMove] = Field(default_factory=list)
    student_risk_flags: MeetingAssistantSection
    unresolved_doubts: MeetingAssistantSection
    follow_up_assets: List[MeetingAssistantFollowUpAsset] = Field(default_factory=list)
    follow_up_suggestions: MeetingAssistantSection
    updated_at: Optional[datetime] = None


class MeetingRecapResponse(BaseModel):
    """Student-safe post-meeting recap payload."""
    meeting_id: str
    summary: str
    study_recap: List[str] = Field(default_factory=list)
    action_items: List[str] = Field(default_factory=list)
    key_takeaways: List[str] = Field(default_factory=list)
    unresolved_questions: List[str] = Field(default_factory=list)
    next_class_moves: List[str] = Field(default_factory=list)


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


class EducatorCopilotPriority(BaseModel):
    """One educator dashboard priority emitted by the copilot."""
    id: str
    title: str
    rationale: str
    recommended_action: str
    severity: str
    category: str
    target_url: Optional[str] = None
    why_now: Optional[str] = None
    recommended_window: Optional[str] = None
    confidence_reason: Optional[str] = None


class EducatorCopilotDashboardResponse(BaseModel):
    """Dashboard-facing educator copilot payload."""
    priorities: List[EducatorCopilotPriority] = Field(default_factory=list)
    meeting_follow_ups: List[str] = Field(default_factory=list)
    suggested_announcements: List[str] = Field(default_factory=list)
    intervention_plan: List[str] = Field(default_factory=list)
    summary: Optional[str] = None


class EducatorCopilotDraft(BaseModel):
    """Draft educator response or intervention suggestion."""
    id: str
    source_type: str
    source_id: str
    subject: str
    summary: str
    suggested_tone: str
    handling_mode: str
    draft_reply: str
    recommended_next_step: str
    target_audience: str
    draft_reason: Optional[str] = None
    escalation_signal: Optional[str] = None
    confidence_reason: Optional[str] = None


class EducatorCommunicationCopilotResponse(BaseModel):
    """Communication hub copilot payload."""
    queue_summary: List[str] = Field(default_factory=list)
    drafts: List[EducatorCopilotDraft] = Field(default_factory=list)


class EducatorTrendExplanation(BaseModel):
    """Plain-language explanation for a weak topic trend."""
    topic: str
    explanation: str
    why_it_matters: str
    recommended_action: str
    teaching_move: Optional[str] = None
    confidence_reason: Optional[str] = None


class EducatorGroupReviewRecommendation(BaseModel):
    """Suggested group review based on class-wide weakness."""
    topic: str
    classroom_name: str
    rationale: str
    suggested_format: str
    next_step: str
    review_sequence: List[str] = Field(default_factory=list)
    confidence_reason: Optional[str] = None


class EducatorClassInsightsCopilotResponse(BaseModel):
    """Class-insights-facing educator copilot payload."""
    overview_summary: str
    trend_explanations: List[EducatorTrendExplanation] = Field(default_factory=list)
    group_review_recommendations: List[EducatorGroupReviewRecommendation] = Field(default_factory=list)


class StudyCoachAction(BaseModel):
    """One short, student-facing study action."""
    label: str
    reason: str
    target_url: Optional[str] = None


class StudyCoachGoal(BaseModel):
    """A focused goal emitted by the coach."""
    label: str
    reason: str


class StudyCoachOverviewResponse(BaseModel):
    """Dashboard-facing study coach payload."""
    study_mode: str
    mode_reason: str
    next_action: str
    rationale: str
    daily_goal: StudyCoachGoal
    weekly_plan: List[StudyCoachAction] = Field(default_factory=list)
    recovery_path: List[StudyCoachAction] = Field(default_factory=list)
    short_plan: List[StudyCoachAction] = Field(default_factory=list)
    weak_focus_areas: List[str] = Field(default_factory=list)
    confidence: Optional[str] = None
    confidence_reason: Optional[str] = None


class StudyCoachProgressResponse(BaseModel):
    """Progress-page coaching payload."""
    study_mode: str
    mode_reason: str
    summary: str
    checkpoint_goal: StudyCoachGoal
    practice_order: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    confidence: Optional[str] = None
    confidence_reason: Optional[str] = None


class StudyCoachMaterialRecommendation(BaseModel):
    """Recommendation for what material to study next."""
    document_id: str
    title: str
    suggested_action: str
    reason: str


class StudyCoachMaterialsResponse(BaseModel):
    """Materials-page study coach payload."""
    sequence_reason: Optional[str] = None
    recommendations: List[StudyCoachMaterialRecommendation] = Field(default_factory=list)
    confidence: Optional[str] = None
    confidence_reason: Optional[str] = None


class StudyCoachChatSuggestionsResponse(BaseModel):
    """Learning-chat coaching payload."""
    follow_up_prompts: List[str] = Field(default_factory=list)
    quick_check_guidance: Optional[str] = None
    next_step: Optional[str] = None
    checkpoint_goal: Optional[StudyCoachGoal] = None
    confidence: Optional[str] = None
    confidence_reason: Optional[str] = None


class ClassroomIntelligenceAction(BaseModel):
    """One suggested teacher or student classroom action."""
    label: str
    reason: str
    target_url: Optional[str] = None


class ClassroomTeacherAttentionSignal(BaseModel):
    """Teacher-facing classroom alert or support signal."""
    title: str
    detail: str
    severity: str
    target_url: Optional[str] = None


class ClassroomTeacherFocusGroup(BaseModel):
    """Grouped set of learners that need a similar classroom response."""
    label: str
    reason: str
    learner_count: int


class ClassroomTeacherReteachRecommendation(BaseModel):
    """One reteach move for a recurring class-level weakness."""
    topic: str
    reason: str
    recommended_move: str


class ClassroomTeacherBrief(BaseModel):
    """Teacher-facing summary of what matters now versus later."""
    now: str
    next: str
    later: str


class ClassroomTeacherIntelligenceResponse(BaseModel):
    """Teacher-focused classroom intelligence payload."""
    overview_summary: str
    focus_topics: List[str] = Field(default_factory=list)
    focus_topic_details: List[Dict[str, Any]] = Field(default_factory=list)
    class_pattern_summary: List[str] = Field(default_factory=list)
    attention_signals: List[ClassroomTeacherAttentionSignal] = Field(default_factory=list)
    student_focus_groups: List[ClassroomTeacherFocusGroup] = Field(default_factory=list)
    reteach_recommendations: List[ClassroomTeacherReteachRecommendation] = Field(default_factory=list)
    recommended_actions: List[ClassroomIntelligenceAction] = Field(default_factory=list)
    meeting_follow_up: List[str] = Field(default_factory=list)
    teacher_brief: Optional[ClassroomTeacherBrief] = None
    confidence: Optional[str] = None
    confidence_reason: Optional[str] = None


class ClassroomStudentStudyTarget(BaseModel):
    """One class-specific student study target."""
    label: str
    reason: str
    target_url: Optional[str] = None


class ClassroomStudentIntelligenceResponse(BaseModel):
    """Student-facing classroom focus and next-step payload."""
    overview_summary: str
    focus_topics: List[str] = Field(default_factory=list)
    personalized_focus: Optional[str] = None
    class_focus_reason: Optional[str] = None
    personal_focus_reason: Optional[str] = None
    key_takeaways: List[str] = Field(default_factory=list)
    next_steps: List[ClassroomIntelligenceAction] = Field(default_factory=list)
    study_targets: List[ClassroomStudentStudyTarget] = Field(default_factory=list)
    ask_next: List[str] = Field(default_factory=list)
    confidence: Optional[str] = None
    confidence_reason: Optional[str] = None


class ClassroomIntelligenceResponse(BaseModel):
    """Shared classroom intelligence response with role-aware subviews."""
    role: str
    classroom_id: str
    classroom_name: str
    teacher_view: Optional[ClassroomTeacherIntelligenceResponse] = None
    student_view: Optional[ClassroomStudentIntelligenceResponse] = None


class ProctorReviewSignal(BaseModel):
    """Top recurring incident signal inside a proctored quiz."""
    incident_type: str
    count: int


class ProctorReviewStudentSummary(BaseModel):
    """Student-level summary for an educator reviewing quiz incidents."""
    student_id: str
    student_name: str
    attempt_status: str
    warning_count: int
    termination_reason: Optional[str] = None
    incident_count: int
    top_incident: str
    latest_incident_at: Optional[str] = None


class ProctorReviewIncident(BaseModel):
    """A timeline event recorded during a proctored quiz."""
    id: str
    student_name: str
    incident_type: str
    severity: str
    action_taken: str
    details: Dict[str, Any] = Field(default_factory=dict)
    created_at: str


class ProctorReviewIncidentTotals(BaseModel):
    """Aggregate counts for proctor review dashboards."""
    total_incidents: int
    warning_events: int
    terminated_events: int
    submitted_with_warnings: int
    terminated_attempts: int
    submitted_attempts: int


class ProctorReviewDebarGuidance(BaseModel):
    """Educator-facing debar review note for serious attempts."""
    status: str
    rationale: str


class ProctorReviewFollowUpAction(BaseModel):
    """One educator follow-up move after reviewing incidents."""
    phase: str
    action: str


class ProctorReviewResponse(BaseModel):
    """Educator-facing summary of proctored quiz incidents."""
    quiz_id: str
    quiz_title: str
    overall_severity: str
    review_summary: str
    case_posture: str
    evidence_strength: str
    review_priority: str
    incident_totals: ProctorReviewIncidentTotals
    top_signals: List[ProctorReviewSignal] = Field(default_factory=list)
    student_summaries: List[ProctorReviewStudentSummary] = Field(default_factory=list)
    timeline: List[ProctorReviewIncident] = Field(default_factory=list)
    debarrment_guidance: Optional[ProctorReviewDebarGuidance] = None
    follow_up_actions: List[ProctorReviewFollowUpAction] = Field(default_factory=list)
    educator_recommendations: List[str] = Field(default_factory=list)
    confidence: Optional[str] = None
    confidence_reason: Optional[str] = None
