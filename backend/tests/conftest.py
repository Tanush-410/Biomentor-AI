"""Keep the test suite isolated from developer and production databases."""
import os


os.environ["DATABASE_URL"] = "sqlite:////tmp/biomentor-pytest.db"
os.environ["ENVIRONMENT"] = "test"
