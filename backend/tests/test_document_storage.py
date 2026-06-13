import os
import sys
import tempfile
import unittest
from unittest.mock import patch


CURRENT_DIR = os.path.dirname(__file__)
BACKEND_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.services.document_storage import (  # noqa: E402
    build_supabase_document_uri,
    persist_document_file,
    parse_supabase_document_uri,
)


class DocumentStorageTests(unittest.TestCase):
    def test_supabase_document_uri_round_trip(self):
        uri = build_supabase_document_uri("documents", "student-1/document-1.pdf")
        bucket, object_key = parse_supabase_document_uri(uri)

        self.assertEqual(uri, "supabase://documents/student-1/document-1.pdf")
        self.assertEqual(bucket, "documents")
        self.assertEqual(object_key, "student-1/document-1.pdf")

    def test_production_raises_when_durable_supabase_upload_fails(self):
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as source_file:
            source_file.write(b"study-notes")
            source_path = source_file.name

        try:
            with patch("app.services.document_storage.settings.environment", "production"), patch(
                "app.services.document_storage.settings.supabase_url", "https://project.supabase.co"
            ), patch("app.services.document_storage.settings.supabase_service_key", "service-role"), patch(
                "app.services.document_storage.settings.supabase_documents_bucket", "documents"
            ), patch("app.services.document_storage._ensure_supabase_bucket"), patch(
                "app.services.document_storage._upload_to_supabase",
                side_effect=RuntimeError("storage offline"),
            ):
                with self.assertRaises(RuntimeError):
                    persist_document_file(
                        source_path,
                        owner_user_id="student-1",
                        document_id="document-1",
                        file_name="notes.pdf",
                        content_type="application/pdf",
                    )
        finally:
            if os.path.exists(source_path):
                os.remove(source_path)

    def test_development_still_uses_local_storage_when_supabase_is_unavailable(self):
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as source_file:
            source_file.write(b"study-notes")
            source_path = source_file.name

        with tempfile.TemporaryDirectory() as temp_upload_dir:
            try:
                with patch("app.services.document_storage.LOCAL_UPLOAD_DIR", temp_upload_dir), patch(
                    "app.services.document_storage.settings.environment", "development"
                ), patch("app.services.document_storage._ensure_supabase_bucket"), patch(
                    "app.services.document_storage._upload_to_supabase",
                    side_effect=RuntimeError("storage offline"),
                ):
                    persisted_path = persist_document_file(
                        source_path,
                        owner_user_id="student-1",
                        document_id="document-1",
                        file_name="notes.pdf",
                        content_type="application/pdf",
                    )
            finally:
                if os.path.exists(source_path):
                    os.remove(source_path)

            self.assertTrue(persisted_path.startswith(temp_upload_dir))
            self.assertTrue(os.path.exists(persisted_path))


if __name__ == "__main__":
    unittest.main()
