"""Application configuration management."""
import json
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from pydantic import field_validator
from pydantic_settings import BaseSettings

# Load environment variables from .env file
env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Main relational database (SQLite local fallback or Supabase/Postgres URI)
    database_url: Optional[str] = None
    
    # Supabase
    supabase_url: str = ""
    supabase_key: str = ""
    supabase_service_key: str = ""
    supabase_documents_bucket: str = "documents"
    
    # Groq API
    groq_api_key: str = ""
    
    # JWT
    secret_key: str = "changeme"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480
    
    # Qdrant
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str = ""
    qdrant_collection: str = "document_chunks"
    
    # Ollama (Local LLM)
    ollama_base_url: str = "http://localhost:11434"

    # Outbound email (password reset, notifications)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_from_name: str = "VYDRA CORE"
    smtp_use_tls: bool = True

    # Public frontend origin used to build links inside outbound emails
    frontend_base_url: str = "http://localhost:3000"

    # Agentic web fallback
    trusted_search_domains: List[str] = [
        "khanacademy.org",
        "britannica.com",
        "nih.gov",
        "nasa.gov",
        ".edu/",
    ]
    web_fallback_top_k: int = 4
    
    # API Settings
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ]
    
    # Environment
    environment: str = "development"
    debug: bool = False

    @field_validator("debug", mode="before")
    @classmethod
    def coerce_debug(cls, value):
        """Accept common deployment env strings without crashing startup."""
        if isinstance(value, bool):
            return value
        if value is None:
            return False
        text = str(value).strip().lower()
        if text in {"1", "true", "yes", "on", "debug", "development"}:
            return True
        if text in {"0", "false", "no", "off", "release", "production"}:
            return False
        return False

    @field_validator("cors_origins", "trusted_search_domains", mode="before")
    @classmethod
    def parse_list_fields(cls, value):
        """Accept JSON arrays or comma-separated strings from deployment dashboards."""
        if value is None:
            return value
        if isinstance(value, list):
            return value
        text = str(value).strip()
        if not text:
            return []
        if text.startswith("["):
            try:
                parsed = json.loads(text)
                if isinstance(parsed, list):
                    return [str(item).strip() for item in parsed if str(item).strip()]
            except json.JSONDecodeError:
                pass
        return [item.strip() for item in text.split(",") if item.strip()]
    
    class Config:
        case_sensitive = False


settings = Settings()  # type: ignore
