import os
import sys
import unittest
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


CURRENT_DIR = os.path.dirname(__file__)
BACKEND_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test-key")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-service-key")
os.environ.setdefault("GROQ_API_KEY", "test-groq-key")
os.environ.setdefault("SECRET_KEY", "test-secret-key")

import app.database as database  # noqa: E402
import app.database.models as models  # noqa: E402
from app.database import get_db  # noqa: E402
from app.routers.auth import get_current_user  # noqa: E402
from app.routers.sticky_notes import router as sticky_notes_router  # noqa: E402
from app.schemas import StickyNoteCreate, StickyNoteResponse, StickyNoteUpdate  # noqa: E402


class StickyNoteModelAndSchemaTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite:///:memory:")
        models.Base.metadata.create_all(cls.engine)
        cls.SessionLocal = sessionmaker(bind=cls.engine)

    def setUp(self):
        self.session = self.SessionLocal()
        user = models.User(
            email=f"user-{id(self)}@example.com",
            hashed_password="hashed-password",
            full_name="Sticky Note Tester",
        )
        self.session.add(user)
        self.session.commit()
        self.user_id = user.id

    def tearDown(self):
        self.session.close()

    @classmethod
    def tearDownClass(cls):
        cls.engine.dispose()

    def _create_legacy_users_table(self, engine):
        with engine.begin() as connection:
            connection.execute(text("""
                CREATE TABLE users (
                    id VARCHAR PRIMARY KEY,
                    email VARCHAR NOT NULL UNIQUE,
                    hashed_password VARCHAR NOT NULL,
                    full_name VARCHAR NOT NULL,
                    role VARCHAR DEFAULT 'student' NOT NULL,
                    institution_name VARCHAR,
                    focus_area VARCHAR,
                    class_code VARCHAR,
                    is_active BOOLEAN,
                    failed_login_attempts INTEGER DEFAULT 0,
                    locked_until TIMESTAMP,
                    last_login_at TIMESTAMP,
                    created_at TIMESTAMP,
                    updated_at TIMESTAMP
                )
            """))
            connection.execute(text("""
                INSERT INTO users (
                    id, email, hashed_password, full_name, role, is_active, failed_login_attempts
                ) VALUES (
                    'legacy-user', 'legacy@example.com', 'hashed-password', 'Legacy User', 'student', 1, 0
                )
            """))

    def _create_legacy_sticky_notes_table(self, engine, table_name="sticky_notes", note_values=None):
        note_values = note_values or {
            "id": "legacy-note",
            "page_url": "https://biomentor.ai/docs/legacy",
            "title": "Legacy note",
            "content": "Valid note carried through upgrade.",
            "color": "amber",
            "x_ratio": 0.5,
            "y_ratio": 0.25,
            "width": 320,
            "height": 220,
            "z_index": 1,
        }
        note_rows = note_values if isinstance(note_values, list) else [note_values]

        with engine.begin() as connection:
            connection.execute(text(f"""
                CREATE TABLE {table_name} (
                    id VARCHAR PRIMARY KEY,
                    user_id VARCHAR NOT NULL,
                    page_url VARCHAR NOT NULL,
                    title VARCHAR,
                    content TEXT NOT NULL,
                    color VARCHAR NOT NULL DEFAULT 'amber',
                    x_ratio FLOAT NOT NULL DEFAULT 0.5,
                    y_ratio FLOAT NOT NULL DEFAULT 0.25,
                    width INTEGER NOT NULL DEFAULT 320,
                    height INTEGER NOT NULL DEFAULT 220,
                    z_index INTEGER NOT NULL DEFAULT 1,
                    created_at TIMESTAMP,
                    updated_at TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users (id)
                )
            """))
            connection.execute(text(f"CREATE INDEX ix_{table_name}_user_id ON {table_name} (user_id)"))
            connection.execute(text(f"CREATE INDEX ix_{table_name}_page_url ON {table_name} (page_url)"))
            for note_row in note_rows:
                connection.execute(text(f"""
                    INSERT INTO {table_name} (
                        id, user_id, page_url, title, content, color, x_ratio, y_ratio, width, height, z_index
                    ) VALUES (
                        :id, 'legacy-user', :page_url, :title, :content, :color, :x_ratio, :y_ratio, :width, :height, :z_index
                    )
                """), note_row)

    def test_sticky_note_model_columns_defaults_and_constraints_are_mapped(self):
        sticky_note_table = models.StickyNote.__table__
        constraint_names = {constraint.name for constraint in sticky_note_table.constraints}

        self.assertEqual(sticky_note_table.name, "sticky_notes")
        self.assertTrue(sticky_note_table.c.user_id.index)
        self.assertTrue(sticky_note_table.c.page_url.index)
        self.assertEqual(sticky_note_table.c.color.default.arg, "amber")
        self.assertEqual(sticky_note_table.c.x_ratio.default.arg, 0.5)
        self.assertEqual(sticky_note_table.c.y_ratio.default.arg, 0.25)
        self.assertTrue(sticky_note_table.c.x_position.nullable)
        self.assertTrue(sticky_note_table.c.y_position.nullable)
        self.assertEqual(sticky_note_table.c.width.default.arg, 320)
        self.assertEqual(sticky_note_table.c.height.default.arg, 220)
        self.assertEqual(sticky_note_table.c.z_index.default.arg, 1)
        self.assertIn("ck_sticky_notes_x_ratio_range", constraint_names)
        self.assertIn("ck_sticky_notes_y_ratio_range", constraint_names)
        self.assertIn("ck_sticky_notes_width_range", constraint_names)
        self.assertIn("ck_sticky_notes_height_range", constraint_names)
        self.assertIn("ck_sticky_notes_z_index_min", constraint_names)

    def test_sticky_note_database_defaults_are_applied(self):
        sticky_note = models.StickyNote(
            user_id=self.user_id,
            page_url="https://biomentor.ai/docs/microbiology",
            content="Review gram-positive cell wall structure.",
        )

        self.session.add(sticky_note)
        self.session.commit()
        self.session.refresh(sticky_note)

        self.assertEqual(sticky_note.color, "amber")
        self.assertEqual(sticky_note.x_ratio, 0.5)
        self.assertEqual(sticky_note.y_ratio, 0.25)
        self.assertIsNone(sticky_note.x_position)
        self.assertIsNone(sticky_note.y_position)
        self.assertEqual(sticky_note.width, 320)
        self.assertEqual(sticky_note.height, 220)
        self.assertEqual(sticky_note.z_index, 1)

    def test_sticky_note_database_constraints_reject_invalid_layout_values(self):
        sticky_note = models.StickyNote(
            user_id=self.user_id,
            page_url="https://biomentor.ai/docs/evolution",
            content="Darwin notes",
            x_ratio=1.5,
            z_index=0,
        )

        self.session.add(sticky_note)

        with self.assertRaises(IntegrityError):
            self.session.commit()

        self.session.rollback()

    def test_init_db_upgrades_existing_sticky_notes_table_to_enforce_constraints(self):
        legacy_engine = create_engine("sqlite:///:memory:")
        legacy_session_factory = sessionmaker(bind=legacy_engine)

        self._create_legacy_users_table(legacy_engine)
        self._create_legacy_sticky_notes_table(legacy_engine)

        with patch.object(database, "engine", legacy_engine), patch.object(
            database,
            "SQLALCHEMY_DATABASE_URL",
            "sqlite:///:memory:",
        ):
            database.init_db()

        session = legacy_session_factory()
        try:
            carried_note = session.get(models.StickyNote, "legacy-note")
            self.assertIsNotNone(carried_note)
            self.assertEqual(carried_note.content, "Valid note carried through upgrade.")
            self.assertIsNone(carried_note.x_position)
            self.assertIsNone(carried_note.y_position)

            upgraded_columns = {
                column["name"]
                for column in database.inspect(legacy_engine).get_columns("sticky_notes")
            }
            self.assertIn("x_position", upgraded_columns)
            self.assertIn("y_position", upgraded_columns)

            session.add(
                models.StickyNote(
                    user_id="legacy-user",
                    page_url="https://biomentor.ai/docs/legacy-upgrade",
                    content="This should fail after upgrade.",
                    x_ratio=1.5,
                )
            )

            with self.assertRaises(IntegrityError):
                session.commit()
        finally:
            session.rollback()
            session.close()
            legacy_engine.dispose()

    def test_init_db_recovers_invalid_stranded_legacy_sticky_notes_data(self):
        legacy_engine = create_engine("sqlite:///:memory:")
        legacy_session_factory = sessionmaker(bind=legacy_engine)
        self._create_legacy_users_table(legacy_engine)

        models.StickyNote.__table__.create(bind=legacy_engine)
        self._create_legacy_sticky_notes_table(
            legacy_engine,
            table_name="sticky_notes_legacy",
            note_values={
                "id": "legacy-invalid-note",
                "page_url": "https://biomentor.ai/docs/legacy-invalid",
                "title": "Legacy invalid note",
                "content": "Needs normalization during upgrade.",
                "color": "amber",
                "x_ratio": -0.25,
                "y_ratio": 1.75,
                "width": 100,
                "height": 999,
                "z_index": 0,
            },
        )

        with patch.object(database, "engine", legacy_engine), patch.object(
            database,
            "SQLALCHEMY_DATABASE_URL",
            "sqlite:///:memory:",
        ):
            database.init_db()

        session = legacy_session_factory()
        try:
            upgraded_note = session.get(models.StickyNote, "legacy-invalid-note")

            self.assertIsNotNone(upgraded_note)
            self.assertEqual(upgraded_note.x_ratio, 0.0)
            self.assertEqual(upgraded_note.y_ratio, 1.0)
            self.assertEqual(upgraded_note.width, 220)
            self.assertEqual(upgraded_note.height, 420)
            self.assertEqual(upgraded_note.z_index, 1)

            inspector = database.inspect(legacy_engine)
            self.assertNotIn("sticky_notes_legacy", inspector.get_table_names())
            index_names = {index["name"] for index in inspector.get_indexes("sticky_notes")}
            self.assertIn("ix_sticky_notes_user_id", index_names)
            self.assertIn("ix_sticky_notes_page_url", index_names)
        finally:
            session.close()
            legacy_engine.dispose()

    def test_init_db_preserves_current_rows_and_merges_legacy_rows_without_overwrite(self):
        legacy_engine = create_engine("sqlite:///:memory:")
        legacy_session_factory = sessionmaker(bind=legacy_engine)
        self._create_legacy_users_table(legacy_engine)
        self._create_legacy_sticky_notes_table(
            legacy_engine,
            table_name="sticky_notes",
            note_values=[
                {
                    "id": "current-only",
                    "page_url": "https://biomentor.ai/docs/current-only",
                    "title": "Current only",
                    "content": "Keep this current row.",
                    "color": "amber",
                    "x_ratio": 0.5,
                    "y_ratio": 0.25,
                    "width": 320,
                    "height": 220,
                    "z_index": 2,
                },
                {
                    "id": "shared-note",
                    "page_url": "https://biomentor.ai/docs/shared-current",
                    "title": "Shared current",
                    "content": "Current content must win.",
                    "color": "amber",
                    "x_ratio": 0.6,
                    "y_ratio": 0.4,
                    "width": 330,
                    "height": 230,
                    "z_index": 3,
                },
            ],
        )
        self._create_legacy_sticky_notes_table(
            legacy_engine,
            table_name="sticky_notes_legacy",
            note_values=[
                {
                    "id": "legacy-only",
                    "page_url": "https://biomentor.ai/docs/legacy-only",
                    "title": "Legacy only",
                    "content": "Recover this legacy row.",
                    "color": "amber",
                    "x_ratio": 0.45,
                    "y_ratio": 0.55,
                    "width": 310,
                    "height": 210,
                    "z_index": 1,
                },
                {
                    "id": "shared-note",
                    "page_url": "https://biomentor.ai/docs/shared-legacy",
                    "title": "Shared legacy",
                    "content": "Legacy content must not overwrite current.",
                    "color": "amber",
                    "x_ratio": 0.1,
                    "y_ratio": 0.2,
                    "width": 220,
                    "height": 160,
                    "z_index": 1,
                },
            ],
        )

        with patch.object(database, "engine", legacy_engine), patch.object(
            database,
            "SQLALCHEMY_DATABASE_URL",
            "sqlite:///:memory:",
        ):
            database.init_db()

        session = legacy_session_factory()
        try:
            current_only_note = session.get(models.StickyNote, "current-only")
            legacy_only_note = session.get(models.StickyNote, "legacy-only")
            shared_note = session.get(models.StickyNote, "shared-note")

            self.assertIsNotNone(current_only_note)
            self.assertEqual(current_only_note.content, "Keep this current row.")
            self.assertIsNotNone(legacy_only_note)
            self.assertEqual(legacy_only_note.content, "Recover this legacy row.")
            self.assertIsNotNone(shared_note)
            self.assertEqual(shared_note.content, "Current content must win.")

            inspector = database.inspect(legacy_engine)
            self.assertNotIn("sticky_notes_legacy", inspector.get_table_names())
        finally:
            session.close()
            legacy_engine.dispose()

    def test_sticky_note_create_accepts_expected_fields(self):
        sticky_note = StickyNoteCreate(
            page_url="https://biomentor.ai/docs/cell-division",
            title="Mitosis recap",
            content="Review the four main stages before the quiz.",
            color="amber",
            x_ratio=0.25,
            y_ratio=0.75,
            width=320,
            height=220,
        )

        self.assertEqual(sticky_note.page_url, "https://biomentor.ai/docs/cell-division")
        self.assertEqual(sticky_note.title, "Mitosis recap")
        self.assertEqual(sticky_note.content, "Review the four main stages before the quiz.")
        self.assertEqual(sticky_note.color, "amber")
        self.assertEqual(sticky_note.x_ratio, 0.25)
        self.assertEqual(sticky_note.y_ratio, 0.75)
        self.assertEqual(sticky_note.width, 320)
        self.assertEqual(sticky_note.height, 220)

    def test_sticky_note_create_rejects_out_of_bounds_geometry(self):
        with self.assertRaises(ValidationError):
            StickyNoteCreate(
                page_url="https://biomentor.ai/docs/cell-division",
                content="Out of bounds",
                width=500,
            )

    def test_sticky_note_update_accepts_partial_updates(self):
        sticky_note_update = StickyNoteUpdate(
            title="Revised title",
            width=280,
            x_position=640,
            y_position=1250,
        )

        self.assertEqual(
            sticky_note_update.model_dump(exclude_unset=True),
            {
                "title": "Revised title",
                "width": 280,
                "x_position": 640,
                "y_position": 1250,
            },
        )

    def test_sticky_note_update_rejects_invalid_layout_values(self):
        with self.assertRaises(ValidationError):
            StickyNoteUpdate(z_index=0)

    def test_sticky_note_response_exposes_metadata_and_round_trips_fields(self):
        created_at = datetime(2026, 1, 1, 12, 0, 0)
        updated_at = datetime(2026, 1, 2, 12, 0, 0)

        sticky_note_record = SimpleNamespace(
            id="note-123",
            user_id="user-456",
            page_url="https://biomentor.ai/docs/genetics",
            title="Punnett square reminder",
            content="Double-check dominant vs recessive traits.",
            color="amber",
            x_ratio=0.5,
            y_ratio=0.25,
            x_position=640,
            y_position=1250,
            width=320,
            height=220,
            z_index=4,
            created_at=created_at,
            updated_at=updated_at,
        )

        sticky_note = StickyNoteResponse.model_validate(sticky_note_record)

        self.assertEqual(sticky_note.id, "note-123")
        self.assertEqual(sticky_note.user_id, "user-456")
        self.assertEqual(sticky_note.page_url, "https://biomentor.ai/docs/genetics")
        self.assertEqual(sticky_note.color, "amber")
        self.assertEqual(sticky_note.x_position, 640)
        self.assertEqual(sticky_note.y_position, 1250)
        self.assertEqual(sticky_note.z_index, 4)
        self.assertEqual(sticky_note.created_at, created_at)
        self.assertEqual(sticky_note.updated_at, updated_at)


class StickyNoteRouteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        models.Base.metadata.create_all(cls.engine)
        cls.SessionLocal = sessionmaker(bind=cls.engine, expire_on_commit=False)
        cls.app = FastAPI()
        cls.app.include_router(sticky_notes_router)

    @classmethod
    def tearDownClass(cls):
        cls.engine.dispose()

    def setUp(self):
        self.session = self.SessionLocal()
        self.primary_user = models.User(
            email=f"primary-{id(self)}@example.com",
            hashed_password="hashed-password",
            full_name="Primary User",
            role="educator",
        )
        self.secondary_user = models.User(
            email=f"secondary-{id(self)}@example.com",
            hashed_password="hashed-password",
            full_name="Secondary User",
            role="student",
        )
        self.session.add_all([self.primary_user, self.secondary_user])
        self.session.commit()
        self.primary_user_identity = SimpleNamespace(id=self.primary_user.id, role=self.primary_user.role)
        self.secondary_user_identity = SimpleNamespace(id=self.secondary_user.id, role=self.secondary_user.role)

        def override_get_db():
            try:
                yield self.session
            finally:
                pass

        self.app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(self.app)

    def tearDown(self):
        self.app.dependency_overrides.clear()
        self.session.close()

    def _set_current_user(self, user):
        self.app.dependency_overrides[get_current_user] = lambda: user

    def test_create_list_update_and_delete_sticky_notes_for_exact_page_url(self):
        self._set_current_user(self.primary_user_identity)

        create_response = self.client.post(
            "/api/sticky-notes",
            json={
                "page_url": "https://biomentor.ai/classrooms/abc",
                "title": "Lab note",
                "content": "Remember to review meiosis before class.",
                "color": "rose",
                "x_ratio": 0.2,
                "y_ratio": 0.3,
                "x_position": 280,
                "y_position": 1450,
                "width": 300,
                "height": 240,
            },
        )
        self.assertEqual(create_response.status_code, 201)
        created_note = create_response.json()
        self.assertEqual(created_note["page_url"], "https://biomentor.ai/classrooms/abc")
        self.assertEqual(created_note["x_position"], 280)
        self.assertEqual(created_note["y_position"], 1450)
        self.assertEqual(created_note["z_index"], 1)

        other_page_response = self.client.post(
            "/api/sticky-notes",
            json={
                "page_url": "https://biomentor.ai/classrooms/abc?tab=materials",
                "content": "Private note on a different exact URL.",
            },
        )
        self.assertEqual(other_page_response.status_code, 201)

        same_page_response = self.client.post(
            "/api/sticky-notes",
            json={
                "page_url": "https://biomentor.ai/classrooms/abc",
                "content": "Second note should stack above the first one.",
            },
        )
        self.assertEqual(same_page_response.status_code, 201)
        self.assertEqual(same_page_response.json()["z_index"], 2)

        list_response = self.client.get(
            "/api/sticky-notes",
            params={"page_url": "https://biomentor.ai/classrooms/abc"},
        )
        self.assertEqual(list_response.status_code, 200)
        listed_notes = list_response.json()
        self.assertEqual(len(listed_notes), 2)
        self.assertEqual([note["z_index"] for note in listed_notes], [1, 2])

        update_response = self.client.patch(
            f"/api/sticky-notes/{created_note['id']}",
            json={
                "content": "Updated reminder",
                "z_index": 4,
                "color": "mint",
                "x_position": 360,
                "y_position": 1725,
            },
        )
        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(update_response.json()["content"], "Updated reminder")
        self.assertEqual(update_response.json()["z_index"], 4)
        self.assertEqual(update_response.json()["color"], "mint")
        self.assertEqual(update_response.json()["x_position"], 360)
        self.assertEqual(update_response.json()["y_position"], 1725)

        delete_response = self.client.delete(f"/api/sticky-notes/{created_note['id']}")
        self.assertEqual(delete_response.status_code, 204)

        deleted_lookup_response = self.client.get(
            "/api/sticky-notes",
            params={"page_url": "https://biomentor.ai/classrooms/abc"},
        )
        self.assertEqual(deleted_lookup_response.status_code, 200)
        self.assertEqual(len(deleted_lookup_response.json()), 1)

    def test_sticky_notes_are_private_to_the_authenticated_user(self):
        hidden_note = models.StickyNote(
            user_id=self.secondary_user.id,
            page_url="https://biomentor.ai/dashboard",
            content="Only the owner should see this note.",
        )
        self.session.add(hidden_note)
        self.session.commit()

        self._set_current_user(self.primary_user_identity)

        list_response = self.client.get(
            "/api/sticky-notes",
            params={"page_url": "https://biomentor.ai/dashboard"},
        )
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.json(), [])

        update_response = self.client.patch(
            f"/api/sticky-notes/{hidden_note.id}",
            json={"content": "Attempted takeover"},
        )
        self.assertEqual(update_response.status_code, 404)

        delete_response = self.client.delete(f"/api/sticky-notes/{hidden_note.id}")
        self.assertEqual(delete_response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
