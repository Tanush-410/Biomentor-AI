import os
import sys
import unittest


CURRENT_DIR = os.path.dirname(__file__)
BACKEND_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.core.config import Settings  # noqa: E402


class DeploymentConfigParsingTests(unittest.TestCase):
    def test_cors_origins_accept_comma_separated_values(self):
        settings = Settings(
            supabase_url="https://example.supabase.co",
            supabase_key="anon",
            supabase_service_key="service",
            groq_api_key="groq",
            secret_key="secret",
            cors_origins="https://app.example.com, https://preview.example.com",
        )

        self.assertEqual(
            settings.cors_origins,
            ["https://app.example.com", "https://preview.example.com"],
        )

    def test_trusted_search_domains_accept_json_arrays(self):
        settings = Settings(
            supabase_url="https://example.supabase.co",
            supabase_key="anon",
            supabase_service_key="service",
            groq_api_key="groq",
            secret_key="secret",
            trusted_search_domains='["khanacademy.org", "britannica.com"]',
        )

        self.assertEqual(settings.trusted_search_domains, ["khanacademy.org", "britannica.com"])

    def test_debug_defaults_to_false_when_not_set(self):
        settings = Settings(
            supabase_url="https://example.supabase.co",
            supabase_key="anon",
            supabase_service_key="service",
            groq_api_key="groq",
            secret_key="secret",
        )

        self.assertFalse(settings.debug)

    def test_access_tokens_default_to_a_full_workday(self):
        settings = Settings(
            supabase_url="https://example.supabase.co",
            supabase_key="anon",
            supabase_service_key="service",
            groq_api_key="groq",
            secret_key="secret",
        )

        self.assertEqual(settings.access_token_expire_minutes, 480)


if __name__ == "__main__":
    unittest.main()
