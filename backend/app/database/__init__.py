"""Database initialization and connection management."""
from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from app.core import settings

from .models import Base


DEFAULT_SQLITE_URL = "sqlite:///./app.db"
SQLALCHEMY_DATABASE_URL = settings.database_url or DEFAULT_SQLITE_URL


def build_engine_kwargs(database_url: str) -> dict:
    """Build engine kwargs for the configured database URL."""
    engine_kwargs = {
        "pool_pre_ping": True,
    }

    if database_url.startswith("sqlite"):
        connect_args = {
            "check_same_thread": False,
            "timeout": 30,
        }
        engine_kwargs["connect_args"] = connect_args

        # StaticPool is useful for in-memory SQLite, but file-backed SQLite
        # should use normal connection behavior to reduce lock contention.
        if database_url in {"sqlite://", "sqlite:///:memory:"} or ":memory:" in database_url:
            engine_kwargs["poolclass"] = StaticPool

    return engine_kwargs


engine_kwargs = build_engine_kwargs(SQLALCHEMY_DATABASE_URL)

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    **engine_kwargs,
)


if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def set_sqlite_pragmas(dbapi_connection, connection_record):  # noqa: ARG001
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_database_backend() -> str:
    """Return a safe label for the active relational database backend."""
    if SQLALCHEMY_DATABASE_URL.startswith("postgresql"):
        return "postgresql"
    if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
        return "sqlite"
    return SQLALCHEMY_DATABASE_URL.split(":", 1)[0]


def init_db():
    """Initialize database tables."""
    Base.metadata.create_all(bind=engine)
    _ensure_incremental_columns()


def get_db():
    """Dependency to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _ensure_incremental_columns():
    """Add newer columns on existing tables when running without migrations."""
    inspector = inspect(engine)
    table_columns = {
        table: {column["name"] for column in inspector.get_columns(table)}
        for table in inspector.get_table_names()
    }

    statements = []
    user_columns = table_columns.get("users", set())
    if "role" not in user_columns:
        statements.append("ALTER TABLE users ADD COLUMN role VARCHAR DEFAULT 'student'")
    if "institution_name" not in user_columns:
        statements.append("ALTER TABLE users ADD COLUMN institution_name VARCHAR")
    if "focus_area" not in user_columns:
        statements.append("ALTER TABLE users ADD COLUMN focus_area VARCHAR")
    if "class_code" not in user_columns:
        statements.append("ALTER TABLE users ADD COLUMN class_code VARCHAR")
    if "failed_login_attempts" not in user_columns:
        statements.append("ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0")
    if "locked_until" not in user_columns:
        statements.append("ALTER TABLE users ADD COLUMN locked_until TIMESTAMP")
    if "last_login_at" not in user_columns:
        statements.append("ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP")

    document_columns = table_columns.get("documents", set())
    if "storage_mode" not in document_columns:
        statements.append("ALTER TABLE documents ADD COLUMN storage_mode VARCHAR DEFAULT 'full'")
    if "selected_pages" not in document_columns:
        if get_database_backend() == "postgresql":
            statements.append("ALTER TABLE documents ADD COLUMN selected_pages JSON")
        else:
            statements.append("ALTER TABLE documents ADD COLUMN selected_pages TEXT")

    live_session_columns = table_columns.get("live_sessions", set())
    if "meeting_provider" not in live_session_columns:
        statements.append("ALTER TABLE live_sessions ADD COLUMN meeting_provider VARCHAR")
    if "meeting_url" not in live_session_columns:
        statements.append("ALTER TABLE live_sessions ADD COLUMN meeting_url VARCHAR")
    if "scheduled_for" not in live_session_columns:
        statements.append("ALTER TABLE live_sessions ADD COLUMN scheduled_for TIMESTAMP")
    if "notification_sent_at" not in live_session_columns:
        statements.append("ALTER TABLE live_sessions ADD COLUMN notification_sent_at TIMESTAMP")

    quiz_session_columns = table_columns.get("quiz_sessions", set())
    if "classroom_id" not in quiz_session_columns:
        statements.append("ALTER TABLE quiz_sessions ADD COLUMN classroom_id VARCHAR")
    if "classroom_quiz_id" not in quiz_session_columns:
        statements.append("ALTER TABLE quiz_sessions ADD COLUMN classroom_quiz_id VARCHAR")
    if "proctoring_status" not in quiz_session_columns:
        statements.append("ALTER TABLE quiz_sessions ADD COLUMN proctoring_status VARCHAR DEFAULT 'not_applicable'")
    if "terminated_reason" not in quiz_session_columns:
        statements.append("ALTER TABLE quiz_sessions ADD COLUMN terminated_reason TEXT")

    generated_question_columns = table_columns.get("generated_questions", set())
    if "session_id" not in generated_question_columns:
        statements.append("ALTER TABLE generated_questions ADD COLUMN session_id VARCHAR")

    classroom_assignment_columns = table_columns.get("classroom_assignments", set())
    if "classroom_quiz_id" not in classroom_assignment_columns:
        statements.append("ALTER TABLE classroom_assignments ADD COLUMN classroom_quiz_id VARCHAR")

    classroom_quiz_columns = table_columns.get("classroom_quizzes", set())
    if "quiz_mode" not in classroom_quiz_columns:
        statements.append("ALTER TABLE classroom_quizzes ADD COLUMN quiz_mode VARCHAR DEFAULT 'generated'")
    if "manual_questions" not in classroom_quiz_columns:
        if get_database_backend() == "postgresql":
            statements.append("ALTER TABLE classroom_quizzes ADD COLUMN manual_questions JSON")
        else:
            statements.append("ALTER TABLE classroom_quizzes ADD COLUMN manual_questions TEXT")

    if not statements:
        return

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
