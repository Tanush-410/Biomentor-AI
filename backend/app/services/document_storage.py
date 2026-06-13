"""Durable document storage for local development and hosted production."""
from __future__ import annotations

import mimetypes
import os
import shutil
from typing import Tuple
from urllib.parse import quote

import requests

from app.core import settings


LOCAL_UPLOAD_DIR = "uploads"


def build_supabase_document_uri(bucket: str, object_key: str) -> str:
    """Create a stable storage URI for a Supabase object."""
    cleaned_bucket = bucket.strip().strip("/")
    cleaned_key = object_key.strip().lstrip("/")
    return f"supabase://{cleaned_bucket}/{cleaned_key}"


def parse_supabase_document_uri(uri: str) -> Tuple[str, str]:
    """Split a Supabase storage URI into bucket and object key."""
    prefix = "supabase://"
    if not str(uri).startswith(prefix):
        raise ValueError("Not a Supabase storage URI")
    bucket_and_key = str(uri)[len(prefix):]
    bucket, object_key = bucket_and_key.split("/", 1)
    return bucket, object_key


def is_supabase_document_uri(uri: str) -> bool:
    """Return True when a file path points to Supabase object storage."""
    return str(uri or "").startswith("supabase://")


def has_supabase_document_storage_config() -> bool:
    """Return True when the object-storage settings required for hosted uploads exist."""
    return bool(
        str(getattr(settings, "supabase_url", "") or "").strip()
        and str(getattr(settings, "supabase_service_key", "") or "").strip()
        and str(getattr(settings, "supabase_documents_bucket", "") or "").strip()
    )


def use_supabase_document_storage() -> bool:
    """Use durable object storage automatically in hosted production."""
    return settings.environment.strip().lower() == "production" and has_supabase_document_storage_config()


def persist_document_file(source_path: str, owner_user_id: str, document_id: str, file_name: str, content_type: str | None = None) -> str:
    """Persist a processed upload either locally or in Supabase storage."""
    if use_supabase_document_storage():
        try:
            bucket = settings.supabase_documents_bucket
            object_key = _build_object_key(owner_user_id, document_id, file_name)
            _ensure_supabase_bucket(bucket)
            _upload_to_supabase(bucket, object_key, source_path, content_type)
            return build_supabase_document_uri(bucket, object_key)
        except Exception as exc:
            raise RuntimeError(
                "Durable document storage is unavailable. Check the Supabase storage bucket/service-role configuration."
            ) from exc

    os.makedirs(LOCAL_UPLOAD_DIR, exist_ok=True)
    destination_path = os.path.join(LOCAL_UPLOAD_DIR, os.path.basename(source_path))
    shutil.copy2(source_path, destination_path)
    return destination_path


def load_document_bytes(file_path: str, file_name: str) -> Tuple[bytes, str]:
    """Load document bytes from the active backing store."""
    if is_supabase_document_uri(file_path):
        bucket, object_key = parse_supabase_document_uri(file_path)
        response = _supabase_request(
            "GET",
            f"/object/authenticated/{quote(bucket, safe='')}/{quote(object_key, safe='/')}",
        )
        media_type = response.headers.get("content-type") or mimetypes.guess_type(file_name)[0] or "application/octet-stream"
        return response.content, media_type

    with open(file_path, "rb") as stored_file:
        payload = stored_file.read()
    media_type = mimetypes.guess_type(file_name)[0] or "application/octet-stream"
    return payload, media_type


def delete_document_file(file_path: str) -> None:
    """Remove a document from the active storage backend."""
    if is_supabase_document_uri(file_path):
        bucket, object_key = parse_supabase_document_uri(file_path)
        encoded_bucket = quote(bucket, safe="")
        encoded_key = quote(object_key, safe="/")
        response = _supabase_request(
            "DELETE",
            f"/object/{encoded_bucket}/{encoded_key}",
            allow_statuses={200, 204, 404, 405},
        )
        if response.status_code == 405:
            _supabase_request(
                "DELETE",
                f"/object/{encoded_bucket}",
                json=[object_key],
                allow_statuses={200, 204, 404},
            )
        return

    if os.path.exists(file_path):
        os.remove(file_path)


def _build_object_key(owner_user_id: str, document_id: str, file_name: str) -> str:
    safe_name = os.path.basename(file_name or f"{document_id}.bin")
    return f"{owner_user_id}/{document_id}/{safe_name}"


def _ensure_supabase_bucket(bucket: str) -> None:
    _supabase_request(
        "POST",
        "/bucket",
        json={"id": bucket, "name": bucket, "public": False},
        allow_statuses={200, 201, 400, 409},
    )


def _upload_to_supabase(bucket: str, object_key: str, source_path: str, content_type: str | None) -> None:
    with open(source_path, "rb") as source_file:
        payload = source_file.read()

    upload_headers = {
        "content-type": content_type or "application/octet-stream",
        "x-upsert": "true",
    }
    _supabase_request(
        "POST",
        f"/object/{quote(bucket, safe='')}/{quote(object_key, safe='/')}",
        data=payload,
        extra_headers=upload_headers,
        allow_statuses={200, 201},
    )


def _supabase_request(
    method: str,
    path: str,
    *,
    data: bytes | None = None,
    json=None,
    extra_headers: dict | None = None,
    allow_statuses: set[int] | None = None,
):
    base_url = settings.supabase_url.rstrip("/")
    url = f"{base_url}/storage/v1{path}"
    headers = {
        "Authorization": f"Bearer {settings.supabase_service_key}",
        "apikey": settings.supabase_service_key,
    }
    if extra_headers:
        headers.update(extra_headers)

    response = requests.request(
        method,
        url,
        headers=headers,
        data=data,
        json=json,
        timeout=120,
    )

    allowed = allow_statuses or {200}
    if response.status_code not in allowed:
        detail = response.text.strip() or response.reason
        raise RuntimeError(f"Supabase storage request failed ({response.status_code}): {detail}")
    return response
