import os
import sys
import unittest


CURRENT_DIR = os.path.dirname(__file__)
BACKEND_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from sqlalchemy.pool import StaticPool  # noqa: E402

from app.database import build_engine_kwargs  # noqa: E402


class SQLiteEngineConfigTest(unittest.TestCase):
    def test_file_sqlite_does_not_use_static_pool(self):
        kwargs = build_engine_kwargs("sqlite:///./app.db")

        self.assertIn("connect_args", kwargs)
        self.assertEqual(kwargs["connect_args"]["check_same_thread"], False)
        self.assertEqual(kwargs["connect_args"]["timeout"], 30)
        self.assertNotIn("poolclass", kwargs)

    def test_in_memory_sqlite_uses_static_pool(self):
        kwargs = build_engine_kwargs("sqlite://")

        self.assertEqual(kwargs["poolclass"], StaticPool)
        self.assertEqual(kwargs["connect_args"]["check_same_thread"], False)
        self.assertEqual(kwargs["connect_args"]["timeout"], 30)


if __name__ == "__main__":
    unittest.main()
