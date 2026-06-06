import os
import sys
import unittest


CURRENT_DIR = os.path.dirname(__file__)
BACKEND_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.services.document_storage import (  # noqa: E402
    build_supabase_document_uri,
    parse_supabase_document_uri,
)


class DocumentStorageTests(unittest.TestCase):
    def test_supabase_document_uri_round_trip(self):
        uri = build_supabase_document_uri("documents", "student-1/document-1.pdf")
        bucket, object_key = parse_supabase_document_uri(uri)

        self.assertEqual(uri, "supabase://documents/student-1/document-1.pdf")
        self.assertEqual(bucket, "documents")
        self.assertEqual(object_key, "student-1/document-1.pdf")


if __name__ == "__main__":
    unittest.main()
