"""Database initialization and connection management."""
from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from app.core import settings

from .models import (
    Base,
    StickyNote,
    STICKY_NOTE_HEIGHT_MAX,
    STICKY_NOTE_HEIGHT_MIN,
    STICKY_NOTE_WIDTH_MAX,
    STICKY_NOTE_WIDTH_MIN,
    STICKY_NOTE_X_RATIO_MAX,
    STICKY_NOTE_X_RATIO_MIN,
    STICKY_NOTE_Y_RATIO_MAX,
    STICKY_NOTE_Y_RATIO_MIN,
    STICKY_NOTE_Z_INDEX_MIN,
)


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
    if "classroom_exam_id" not in classroom_assignment_columns:
        statements.append("ALTER TABLE classroom_assignments ADD COLUMN classroom_exam_id VARCHAR")
    if "exam_reference" not in classroom_assignment_columns:
        statements.append("ALTER TABLE classroom_assignments ADD COLUMN exam_reference VARCHAR")

    classroom_quiz_columns = table_columns.get("classroom_quizzes", set())
    if "quiz_mode" not in classroom_quiz_columns:
        statements.append("ALTER TABLE classroom_quizzes ADD COLUMN quiz_mode VARCHAR DEFAULT 'generated'")
    if "manual_questions" not in classroom_quiz_columns:
        if get_database_backend() == "postgresql":
            statements.append("ALTER TABLE classroom_quizzes ADD COLUMN manual_questions JSON")
        else:
            statements.append("ALTER TABLE classroom_quizzes ADD COLUMN manual_questions TEXT")

    classroom_exam_columns = table_columns.get("classroom_exams", set())
    if classroom_exam_columns:
        if "instructions" not in classroom_exam_columns:
            statements.append("ALTER TABLE classroom_exams ADD COLUMN instructions TEXT")
        if "exam_mode" not in classroom_exam_columns:
            statements.append("ALTER TABLE classroom_exams ADD COLUMN exam_mode VARCHAR DEFAULT 'mixed'")
        if "authoring_mode" not in classroom_exam_columns:
            statements.append("ALTER TABLE classroom_exams ADD COLUMN authoring_mode VARCHAR DEFAULT 'manual'")
        if "generation_scope" not in classroom_exam_columns:
            statements.append("ALTER TABLE classroom_exams ADD COLUMN generation_scope VARCHAR DEFAULT 'selected_materials'")
        if "total_marks" not in classroom_exam_columns:
            statements.append("ALTER TABLE classroom_exams ADD COLUMN total_marks FLOAT DEFAULT 0")
        if "publish_to_stream" not in classroom_exam_columns:
            statements.append("ALTER TABLE classroom_exams ADD COLUMN publish_to_stream BOOLEAN DEFAULT 1")
        if "proctoring_enabled" not in classroom_exam_columns:
            statements.append("ALTER TABLE classroom_exams ADD COLUMN proctoring_enabled BOOLEAN DEFAULT 1")
        if "allow_late_entries" not in classroom_exam_columns:
            statements.append("ALTER TABLE classroom_exams ADD COLUMN allow_late_entries BOOLEAN DEFAULT 0")
        if "linked_material_ids" not in classroom_exam_columns:
            if get_database_backend() == "postgresql":
                statements.append("ALTER TABLE classroom_exams ADD COLUMN linked_material_ids JSON")
            else:
                statements.append("ALTER TABLE classroom_exams ADD COLUMN linked_material_ids TEXT")
        if "grading_notes" not in classroom_exam_columns:
            if get_database_backend() == "postgresql":
                statements.append("ALTER TABLE classroom_exams ADD COLUMN grading_notes JSON")
            else:
                statements.append("ALTER TABLE classroom_exams ADD COLUMN grading_notes TEXT")
        if "anticheat_policy" not in classroom_exam_columns:
            if get_database_backend() == "postgresql":
                statements.append("ALTER TABLE classroom_exams ADD COLUMN anticheat_policy JSON")
            else:
                statements.append("ALTER TABLE classroom_exams ADD COLUMN anticheat_policy TEXT")

    sticky_note_columns = table_columns.get("sticky_notes", set())
    if sticky_note_columns:
        if "x_position" not in sticky_note_columns:
            statements.append("ALTER TABLE sticky_notes ADD COLUMN x_position INTEGER")
        if "y_position" not in sticky_note_columns:
            statements.append("ALTER TABLE sticky_notes ADD COLUMN y_position INTEGER")

    if statements:
        with engine.begin() as connection:
            for statement in statements:
                connection.execute(text(statement))

    _ensure_sticky_note_constraints(inspect(engine))


def _ensure_sticky_note_constraints(inspector):
    """Rebuild older SQLite sticky_notes tables so DB checks match the ORM model."""
    if get_database_backend() != "sqlite":
        return

    table_names = set(inspector.get_table_names())
    if "sticky_notes" not in table_names and "sticky_notes_legacy" not in table_names:
        return

    if "sticky_notes_legacy" in table_names:
        _recover_sticky_notes_from_legacy(inspector, has_current_table="sticky_notes" in table_names)
        return

    if _sticky_note_table_has_required_constraints(inspector, "sticky_notes"):
        return

    sticky_note_index_names = _get_table_index_names(inspector, "sticky_notes")
    with engine.begin() as connection:
        connection.execute(text("PRAGMA foreign_keys=OFF"))
        try:
            connection.execute(text("ALTER TABLE sticky_notes RENAME TO sticky_notes_legacy"))
            _drop_index_names(connection, sticky_note_index_names)
            StickyNote.__table__.create(bind=connection)
            _copy_sticky_notes_with_normalization(connection, source_table="sticky_notes_legacy")
            connection.execute(text("DROP TABLE sticky_notes_legacy"))
        finally:
            connection.execute(text("PRAGMA foreign_keys=ON"))


def _recover_sticky_notes_from_legacy(inspector, has_current_table: bool):
    """Merge stranded sticky_notes_legacy rows back into sticky_notes and remove the legacy table."""
    with engine.begin() as connection:
        connection.execute(text("PRAGMA foreign_keys=OFF"))
        try:
            if has_current_table and not _sticky_note_table_has_required_constraints(inspector, "sticky_notes"):
                current_index_names = _get_table_index_names(inspector, "sticky_notes")
                connection.execute(text("ALTER TABLE sticky_notes RENAME TO sticky_notes_current_source"))
                _drop_index_names(connection, current_index_names)
                StickyNote.__table__.create(bind=connection)
                _copy_sticky_notes_with_normalization(
                    connection,
                    source_table="sticky_notes_current_source",
                    conflict_policy="error",
                )
                connection.execute(text("DROP TABLE sticky_notes_current_source"))

            if not has_current_table:
                StickyNote.__table__.create(bind=connection)

            _copy_sticky_notes_with_normalization(
                connection,
                source_table="sticky_notes_legacy",
                conflict_policy="ignore",
            )
            connection.execute(text("DROP TABLE sticky_notes_legacy"))
        finally:
            connection.execute(text("PRAGMA foreign_keys=ON"))


def _sticky_note_table_has_required_constraints(inspector, table_name: str) -> bool:
    """Return whether the given sticky note table already has all expected named checks."""
    required_constraint_names = {
        constraint.name
        for constraint in StickyNote.__table__.constraints
        if constraint.name
    }
    existing_constraint_names = {
        constraint.get("name")
        for constraint in inspector.get_check_constraints(table_name)
        if constraint.get("name")
    }
    return required_constraint_names.issubset(existing_constraint_names)


def _get_table_index_names(inspector, table_name: str) -> list[str]:
    """Collect named indexes for a table from the current inspector snapshot."""
    return [
        index["name"]
        for index in inspector.get_indexes(table_name)
        if index.get("name")
    ]


def _drop_index_names(connection, index_names: list[str]):
    """Drop a list of indexes by name."""
    for index_name in index_names:
        connection.execute(text(f'DROP INDEX IF EXISTS "{index_name}"'))


def _copy_sticky_notes_with_normalization(connection, source_table: str, conflict_policy: str = "error"):
    """Copy sticky note rows into the constrained table, clamping legacy layout values into bounds."""
    sticky_note_columns = [column.name for column in StickyNote.__table__.columns]
    source_columns = {
        column["name"]
        for column in inspect(connection).get_columns(source_table)
    }
    quoted_columns = ", ".join(f'"{column}"' for column in sticky_note_columns)
    normalized_values = {
        "id": '"id"',
        "user_id": '"user_id"',
        "page_url": '"page_url"',
        "title": '"title"',
        "content": '"content"',
        "color": '"color"',
        "x_ratio": (
            f'CASE WHEN "x_ratio" < {STICKY_NOTE_X_RATIO_MIN} THEN {STICKY_NOTE_X_RATIO_MIN} '
            f'WHEN "x_ratio" > {STICKY_NOTE_X_RATIO_MAX} THEN {STICKY_NOTE_X_RATIO_MAX} '
            'ELSE "x_ratio" END'
        ),
        "y_ratio": (
            f'CASE WHEN "y_ratio" < {STICKY_NOTE_Y_RATIO_MIN} THEN {STICKY_NOTE_Y_RATIO_MIN} '
            f'WHEN "y_ratio" > {STICKY_NOTE_Y_RATIO_MAX} THEN {STICKY_NOTE_Y_RATIO_MAX} '
            'ELSE "y_ratio" END'
        ),
        "x_position": '"x_position"' if "x_position" in source_columns else "NULL",
        "y_position": '"y_position"' if "y_position" in source_columns else "NULL",
        "width": (
            f'CASE WHEN "width" < {STICKY_NOTE_WIDTH_MIN} THEN {STICKY_NOTE_WIDTH_MIN} '
            f'WHEN "width" > {STICKY_NOTE_WIDTH_MAX} THEN {STICKY_NOTE_WIDTH_MAX} '
            'ELSE "width" END'
        ),
        "height": (
            f'CASE WHEN "height" < {STICKY_NOTE_HEIGHT_MIN} THEN {STICKY_NOTE_HEIGHT_MIN} '
            f'WHEN "height" > {STICKY_NOTE_HEIGHT_MAX} THEN {STICKY_NOTE_HEIGHT_MAX} '
            'ELSE "height" END'
        ),
        "z_index": f'CASE WHEN "z_index" < {STICKY_NOTE_Z_INDEX_MIN} THEN {STICKY_NOTE_Z_INDEX_MIN} ELSE "z_index" END',
        "created_at": '"created_at"',
        "updated_at": '"updated_at"',
    }
    select_values = ", ".join(
        f'{normalized_values[column]} AS "{column}"'
        for column in sticky_note_columns
    )
    insert_verbs = {
        "error": "INSERT",
        "ignore": "INSERT OR IGNORE",
        "replace": "INSERT OR REPLACE",
    }
    insert_verb = insert_verbs[conflict_policy]

    connection.execute(text(
        f'{insert_verb} INTO sticky_notes ({quoted_columns}) '
        f'SELECT {select_values} FROM "{source_table}"'
    ))
