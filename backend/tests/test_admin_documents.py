"""Backend tests for Admin Document Verification + Vault Upload flow.

Endpoints covered:
- POST /api/vault/upload (multipart, authenticated)
- GET /api/admin/documents/verification-queue (admin)
- GET /api/admin/documents/stats (admin)
- POST /api/admin/documents/bulk-verify (admin)
- GET /api/admin/documents/operator/{operator_id} (admin)
- POST /api/vault/verify/{document_id} (used by AdminVerificationQueue UI)
- GET /api/compliance/categories (public - referenced by ComplianceDashboard)
- GET /api/compliance/dashboard, /alerts (admin - referenced by ComplianceDashboard)
"""

import io
import os
import sys
import uuid
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

# Users used in iteration_22 tests (JWTs bypass OTP via create_access_token)
ADMIN = {"id": "601a4741-f347-4ce8-845e-6cbd91bf9a78", "email": "admin@airyatra.com", "roles": ["admin"]}
OPERATOR = {"id": "88e05bf4-57fc-43b3-82cb-18252892026b", "email": "operator8fkf0x@airyatra.com", "roles": ["operator"]}
CUSTOMER = {"id": "d8bf6df5-360b-4a8e-b665-43d09a3e8626", "email": "loyaltytest@airyatra.com", "roles": ["customer"]}


def _token(u):
    return create_access_token({"sub": u["id"], "id": u["id"], "email": u["email"], "roles": u["roles"]})


def _auth(u):
    return {"Authorization": f"Bearer {_token(u)}"}


STATE = {"doc_ids": []}


# ============ Vault upload ============
class TestVaultUpload:
    def test_upload_requires_auth(self):
        r = requests.post(f"{API}/vault/upload", files={"file": ("t.txt", b"x")})
        assert r.status_code in (401, 403, 422), r.text

    def test_operator_uploads_document(self):
        content = b"TEST_dummy_pdf_content_for_verification_queue"
        files = {"file": (f"TEST_{uuid.uuid4().hex[:6]}.pdf", content, "application/pdf")}
        data = {
            "owner_id": OPERATOR["id"],
            "owner_type": "operator",
            "name": "TEST_Insurance_Policy",
            "category": "insurance",
            "document_type": "insurance_policy",
            "description": "Backend regression test upload",
            "reminder_days": "30",
            "is_sensitive": "false",
        }
        r = requests.post(f"{API}/vault/upload", data=data, files=files, headers=_auth(OPERATOR))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True
        doc = body["document"]
        assert doc["document_id"].startswith("DOC-")
        assert doc["name"] == "TEST_Insurance_Policy"
        STATE["doc_ids"].append(doc["document_id"])

    def test_upload_for_other_owner_forbidden(self):
        files = {"file": ("t.txt", b"x", "text/plain")}
        data = {
            "owner_id": ADMIN["id"],  # not self
            "owner_type": "user",
            "name": "TEST_bad",
            "category": "insurance",
            "document_type": "insurance_policy",
        }
        r = requests.post(f"{API}/vault/upload", data=data, files=files, headers=_auth(CUSTOMER))
        assert r.status_code == 403, r.text


# ============ /admin/documents/* ============
class TestAdminVerificationQueue:
    def test_queue_requires_admin(self):
        r = requests.get(f"{API}/admin/documents/verification-queue", headers=_auth(OPERATOR))
        assert r.status_code in (401, 403), r.text

    def test_queue_admin_ok(self):
        r = requests.get(f"{API}/admin/documents/verification-queue", headers=_auth(ADMIN))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["success"] is True
        assert isinstance(body["documents"], list)
        assert body["total"] == len(body["documents"])
        # Verify our uploaded doc is present with owner enrichment
        matches = [d for d in body["documents"] if d.get("document_id") in STATE["doc_ids"]]
        assert matches, "Uploaded test document not present in verification queue"
        doc = matches[0]
        assert doc.get("verification_status") == "pending"
        assert "_id" not in doc, "MongoDB _id leaked in response"
        assert "file_hash" not in doc, "file_hash leaked (should be projected out)"
        # Owner enrichment fields must be present when operator record exists
        assert "owner_name" in doc or "operator_name" in doc or "owner_email" in doc

    def test_queue_status_filter(self):
        r = requests.get(
            f"{API}/admin/documents/verification-queue",
            params={"status": "pending", "limit": 50},
            headers=_auth(ADMIN),
        )
        assert r.status_code == 200
        docs = r.json()["documents"]
        for d in docs:
            assert d.get("verification_status") == "pending"

    def test_queue_limit_cap(self):
        r = requests.get(
            f"{API}/admin/documents/verification-queue",
            params={"limit": 501},
            headers=_auth(ADMIN),
        )
        assert r.status_code == 422, r.text  # Query(le=500) enforced

    def test_stats_admin(self):
        r = requests.get(f"{API}/admin/documents/stats", headers=_auth(ADMIN))
        assert r.status_code == 200, r.text
        stats = r.json()["stats"]
        assert "by_status" in stats and "by_category" in stats
        assert set(stats["by_status"].keys()) >= {"pending", "verified", "rejected"}
        assert stats["by_status"]["pending"] >= 1  # our uploaded doc
        assert stats["total"] == sum(stats["by_status"].values())
        assert isinstance(stats["recent_uploads_7d"], int)

    def test_stats_forbidden_for_operator(self):
        r = requests.get(f"{API}/admin/documents/stats", headers=_auth(OPERATOR))
        assert r.status_code in (401, 403)

    def test_operator_documents_endpoint(self):
        r = requests.get(
            f"{API}/admin/documents/operator/{OPERATOR['id']}",
            headers=_auth(ADMIN),
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["success"] is True
        assert isinstance(body["documents"], list)
        # our doc should show up
        doc_ids = [d.get("document_id") for d in body["documents"]]
        assert any(did in STATE["doc_ids"] for did in doc_ids)

    def test_bulk_verify_invalid_status(self):
        # Bulk-verify expects JSON body (List[str], str, Optional[str]) via query-esque bindings.
        # FastAPI treats non-Body list & primitive params as body when there's a body param mix — send as query.
        r = requests.post(
            f"{API}/admin/documents/bulk-verify",
            params={"verification_status": "banana"},
            json=STATE["doc_ids"],
            headers=_auth(ADMIN),
        )
        # 400 if reached handler; 422 if binding rejected
        assert r.status_code in (400, 422), r.text

    def test_bulk_verify_approves_document(self):
        assert STATE["doc_ids"], "No doc uploaded to verify"
        r = requests.post(
            f"{API}/admin/documents/bulk-verify",
            params={"verification_status": "verified", "notes": "TEST auto-approve"},
            json=STATE["doc_ids"],
            headers=_auth(ADMIN),
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["success"] is True
        assert body["modified_count"] >= 1

        # Verify persistence via queue with status=verified
        r2 = requests.get(
            f"{API}/admin/documents/verification-queue",
            params={"status": "verified"},
            headers=_auth(ADMIN),
        )
        assert r2.status_code == 200
        verified_ids = [d["document_id"] for d in r2.json()["documents"]]
        assert STATE["doc_ids"][0] in verified_ids


# ============ /vault/verify (used by UI reject/approve modal) ============
class TestVaultVerify:
    def test_vault_verify_updates_status(self):
        # Upload a fresh doc then reject via /vault/verify
        files = {"file": ("t.pdf", b"reject-me", "application/pdf")}
        data = {
            "owner_id": OPERATOR["id"], "owner_type": "operator",
            "name": "TEST_reject", "category": "insurance", "document_type": "insurance_policy",
        }
        up = requests.post(f"{API}/vault/upload", data=data, files=files, headers=_auth(OPERATOR))
        assert up.status_code == 200
        doc_id = up.json()["document"]["document_id"]
        STATE["doc_ids"].append(doc_id)

        payload = {
            "verification_status": "rejected",
            "verified_by": ADMIN["id"],
            "verification_notes": "TEST reject reason",
        }
        r = requests.post(f"{API}/vault/verify/{doc_id}", json=payload, headers=_auth(ADMIN))
        assert r.status_code == 200, r.text
        assert r.json()["success"] is True

        # Confirm via queue
        r2 = requests.get(
            f"{API}/admin/documents/verification-queue",
            params={"status": "rejected"},
            headers=_auth(ADMIN),
        )
        rejected_ids = [d["document_id"] for d in r2.json()["documents"]]
        assert doc_id in rejected_ids


# ============ Compliance dashboard-related endpoints used by ComplianceDashboard UI ============
class TestComplianceForDashboardUI:
    def test_categories_public(self):
        r = requests.get(f"{API}/compliance/categories")
        assert r.status_code == 200
        body = r.json()
        assert "document_categories" in body
        assert "photo_categories" in body
        # UI iterates Object.entries(document_categories) and photo_categories.map
        assert isinstance(body["document_categories"], dict) and len(body["document_categories"]) > 0
        assert isinstance(body["photo_categories"], list) and len(body["photo_categories"]) > 0
        sample_cat = next(iter(body["document_categories"].values()))
        assert "label" in sample_cat and "types" in sample_cat

    def test_dashboard_admin(self):
        r = requests.get(f"{API}/compliance/dashboard", headers=_auth(ADMIN))
        assert r.status_code == 200, r.text
        body = r.json()
        # UI accesses dashboardData.aircraft.total / .verified / .pending / .suspended
        assert "aircraft" in body
        for k in ("total", "verified", "pending", "suspended"):
            assert k in body["aircraft"], f"missing aircraft.{k}"
        # UI accesses compliance_alerts.insurance_expiring_30d & maintenance_due_30d
        assert "compliance_alerts" in body
        for k in ("insurance_expiring_30d", "maintenance_due_30d"):
            assert k in body["compliance_alerts"], f"missing compliance_alerts.{k}"
        # last_check must be dict (UI conditionally reads .run_at)
        assert "last_check" in body

    def test_alerts_admin(self):
        r = requests.get(
            f"{API}/compliance/alerts",
            params={"days_threshold": 30},
            headers=_auth(ADMIN),
        )
        assert r.status_code == 200
        body = r.json()
        assert "alerts" in body and isinstance(body["alerts"], list)


# ============ Teardown: clean up TEST_ documents ============
@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    for did in STATE["doc_ids"]:
        try:
            requests.delete(
                f"{API}/vault/document/{did}",
                params={"permanent": "true"},
                headers=_auth(ADMIN),
                timeout=10,
            )
        except Exception:
            pass
