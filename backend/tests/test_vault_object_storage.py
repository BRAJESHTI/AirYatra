"""Backend tests for object-storage vault upload + photo gallery endpoints.

Covers:
- POST /api/vault/upload -> storage_type=object_storage + thumbnail_url for images
- GET  /api/vault/file/{file_id} -> serves file from object storage
- GET  /api/vault/image/{file_id} -> inline image preview
- GET  /api/vault/photos/{owner_id} -> gallery listing (image documents only)
"""
import io
import os
import sys
import uuid
import struct
import zlib
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

sys.path.insert(0, "/app/backend")
from auth import create_access_token  # noqa: E402

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"

OPERATOR = {"id": "88e05bf4-57fc-43b3-82cb-18252892026b",
            "email": "operator8fkf0x@airyatra.com", "roles": ["operator"]}
ADMIN = {"id": "601a4741-f347-4ce8-845e-6cbd91bf9a78",
         "email": "admin@airyatra.com", "roles": ["admin"]}
OUTSIDER = {"id": "d8bf6df5-360b-4a8e-b665-43d09a3e8626",
            "email": "loyaltytest@airyatra.com", "roles": ["customer"]}


def _token(u):
    return create_access_token({"sub": u["id"], "id": u["id"],
                                "email": u["email"], "roles": u["roles"]})


def _auth(u):
    return {"Authorization": f"Bearer {_token(u)}"}


def _make_png(width=8, height=8, color=(200, 30, 30)):
    """Build a small valid PNG in-memory without extra deps."""
    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data +
                struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    raw = b""
    for _ in range(height):
        raw += b"\x00" + bytes(color) * width
    idat = zlib.compress(raw)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


STATE = {"file_id": None, "document_id": None, "png_bytes": None}


class TestObjectStorageUpload:
    """POST /api/vault/upload persists to object_storage + generates thumbnail."""

    def test_upload_image_to_object_storage(self):
        png = _make_png()
        STATE["png_bytes"] = png
        fname = f"TEST_photo_{uuid.uuid4().hex[:6]}.png"
        files = {"file": (fname, png, "image/png")}
        data = {
            "owner_id": OPERATOR["id"],
            "owner_type": "operator",
            "name": "TEST_FleetPhoto",
            "category": "photos",
            "document_type": "aircraft_photo",
            "tags": f"aircraft_TEST_{uuid.uuid4().hex[:6]}",
            "is_sensitive": "false",
            "reminder_days": "30",
        }
        r = requests.post(f"{API}/vault/upload", data=data, files=files,
                          headers=_auth(OPERATOR), timeout=60)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["success"] is True
        doc = body["document"]
        # Capture state BEFORE any further assertion so dependent tests run
        STATE["document_id"] = doc["document_id"]
        # KEY assertion: object storage is now the primary path
        assert doc["storage_type"] == "object_storage", (
            f"expected object_storage got {doc.get('storage_type')} — "
            "did Emergent Object Storage fail? full body=" + str(body))
        assert doc["file_url"], "file_url should be present"
        assert doc["document_id"].startswith("DOC-")
        # KEY assertion: thumbnail generated for image
        assert doc["thumbnail_url"], (
            "BUG: thumbnail_url is None even though storage_type=object_storage. "
            "Root cause: /api/vault/upload does thumbnail_url = thumb_result.get('url') "
            "with no fallback; Emergent Object Storage put_object() response does not "
            "carry a 'url' key (same reason file_url falls back to /api/vault/file/{file_id})."
            f" full body={body}")

    def test_upload_stored_document_has_object_storage_metadata(self):
        assert STATE["document_id"], "prior upload test must run first"
        r = requests.get(f"{API}/vault/document/{STATE['document_id']}",
                         headers=_auth(OPERATOR), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()["document"]
        assert d["storage_type"] == "object_storage"
        assert d.get("storage_path"), "storage_path must be set for object storage docs"
        assert d.get("file_id"), "file_id must exist"
        assert d["file_type"] == "image/png"
        STATE["file_id"] = d["file_id"]
        assert d["thumbnail_url"], (
            "BUG (persisted): document.thumbnail_url is None in stored record.")


class TestFileDownload:
    """GET /api/vault/file/{file_id} works for object-storage-backed documents."""

    def test_download_requires_auth(self):
        assert STATE["file_id"]
        r = requests.get(f"{API}/vault/file/{STATE['file_id']}", timeout=30)
        assert r.status_code in (401, 403), r.text

    def test_outsider_forbidden(self):
        assert STATE["file_id"]
        r = requests.get(f"{API}/vault/file/{STATE['file_id']}",
                         headers=_auth(OUTSIDER), timeout=30)
        assert r.status_code == 403, r.text

    def test_owner_download_returns_bytes(self):
        assert STATE["file_id"]
        r = requests.get(f"{API}/vault/file/{STATE['file_id']}",
                         headers=_auth(OPERATOR), timeout=60)
        assert r.status_code == 200, r.text
        # It should return the original PNG bytes
        assert r.content == STATE["png_bytes"], (
            f"content mismatch: got {len(r.content)} bytes vs original "
            f"{len(STATE['png_bytes'])} bytes")
        # Content-Disposition attachment
        cd = r.headers.get("Content-Disposition", "")
        assert "attachment" in cd.lower()

    def test_admin_can_download(self):
        assert STATE["file_id"]
        r = requests.get(f"{API}/vault/file/{STATE['file_id']}",
                         headers=_auth(ADMIN), timeout=60)
        assert r.status_code == 200, r.text
        assert len(r.content) == len(STATE["png_bytes"])

    def test_download_missing_file_404(self):
        r = requests.get(f"{API}/vault/file/doc_does_not_exist_{uuid.uuid4().hex}",
                         headers=_auth(OPERATOR), timeout=30)
        assert r.status_code == 404, r.text


class TestImagePreview:
    """GET /api/vault/image/{file_id} serves inline image content."""

    def test_image_preview_returns_inline(self):
        assert STATE["file_id"]
        r = requests.get(f"{API}/vault/image/{STATE['file_id']}",
                         headers=_auth(OPERATOR), timeout=60)
        assert r.status_code == 200, r.text
        # Should be the PNG bytes served inline
        assert r.content == STATE["png_bytes"]
        assert r.headers.get("Content-Type", "").startswith("image/")
        cd = r.headers.get("Content-Disposition", "")
        assert "inline" in cd.lower(), f"expected inline disposition got {cd!r}"

    def test_image_preview_thumbnail_flag(self):
        assert STATE["file_id"]
        r = requests.get(f"{API}/vault/image/{STATE['file_id']}",
                         params={"thumbnail": "true"},
                         headers=_auth(OPERATOR), timeout=30)
        assert r.status_code == 200, r.text
        # Thumbnail branch returns JSON {redirect_url: ...} per implementation
        ctype = r.headers.get("Content-Type", "")
        if ctype.startswith("application/json"):
            body = r.json()
            assert "redirect_url" in body and body["redirect_url"]
        else:
            # If backend chose to stream instead, at least ensure it's an image
            assert ctype.startswith("image/"), f"unexpected content-type {ctype}"

    def test_image_preview_forbidden_for_outsider(self):
        assert STATE["file_id"]
        r = requests.get(f"{API}/vault/image/{STATE['file_id']}",
                         headers=_auth(OUTSIDER), timeout=30)
        assert r.status_code == 403, r.text

    def test_image_preview_non_image_returns_400(self):
        # Upload a tiny non-image and confirm /image rejects it
        files = {"file": (f"TEST_note_{uuid.uuid4().hex[:6]}.txt",
                          b"hello world", "text/plain")}
        data = {
            "owner_id": OPERATOR["id"], "owner_type": "operator",
            "name": "TEST_TextDoc", "category": "other",
            "document_type": "other", "is_sensitive": "false",
            "reminder_days": "30",
        }
        r = requests.post(f"{API}/vault/upload", data=data, files=files,
                          headers=_auth(OPERATOR), timeout=30)
        assert r.status_code == 200, r.text
        doc = r.json()["document"]
        # Fetch the file_id
        d = requests.get(f"{API}/vault/document/{doc['document_id']}",
                         headers=_auth(OPERATOR), timeout=30).json()["document"]
        r2 = requests.get(f"{API}/vault/image/{d['file_id']}",
                          headers=_auth(OPERATOR), timeout=30)
        assert r2.status_code == 400, r2.text
        # cleanup
        requests.delete(f"{API}/vault/document/{doc['document_id']}",
                        params={"permanent": "true"},
                        headers=_auth(OPERATOR), timeout=30)


class TestPhotoGallery:
    """GET /api/vault/photos/{owner_id} returns only image documents."""

    def test_photos_requires_auth(self):
        r = requests.get(f"{API}/vault/photos/{OPERATOR['id']}", timeout=30)
        assert r.status_code in (401, 403), r.text

    def test_photos_forbidden_for_outsider(self):
        r = requests.get(f"{API}/vault/photos/{OPERATOR['id']}",
                         headers=_auth(OUTSIDER), timeout=30)
        assert r.status_code == 403, r.text

    def test_owner_gets_photo_list(self):
        r = requests.get(f"{API}/vault/photos/{OPERATOR['id']}",
                         headers=_auth(OPERATOR), timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["success"] is True
        assert "photos" in body and "total" in body
        assert isinstance(body["photos"], list)
        assert body["total"] >= 1
        # Every returned doc must be an image
        for p in body["photos"]:
            assert p.get("file_type", "").startswith("image/"), (
                f"non-image in photos response: {p.get('file_type')}")
        # Our uploaded photo should be included
        our = [p for p in body["photos"]
               if p.get("document_id") == STATE["document_id"]]
        assert our, "uploaded test photo missing from gallery response"
        assert our[0].get("storage_type") == "object_storage"

    def test_admin_can_read_owner_photos(self):
        r = requests.get(f"{API}/vault/photos/{OPERATOR['id']}",
                         headers=_auth(ADMIN), timeout=30)
        assert r.status_code == 200, r.text
        assert isinstance(r.json().get("photos"), list)

    def test_photos_pagination_params(self):
        r = requests.get(f"{API}/vault/photos/{OPERATOR['id']}",
                         params={"skip": 0, "limit": 1},
                         headers=_auth(OPERATOR), timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["limit"] == 1
        assert body["skip"] == 0
        assert len(body["photos"]) <= 1


@pytest.fixture(scope="module", autouse=True)
def _cleanup():
    yield
    if STATE.get("document_id"):
        try:
            requests.delete(f"{API}/vault/document/{STATE['document_id']}",
                            params={"permanent": "true"},
                            headers=_auth(OPERATOR), timeout=30)
        except Exception:
            pass
