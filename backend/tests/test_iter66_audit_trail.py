"""Iteration 66 - Enhanced Audit Trail Backend Tests"""
import os
import sys
import asyncio
import pytest
import requests
from datetime import datetime
from dotenv import dotenv_values

# Ensure backend module path is importable for OTP mint helper
sys.path.insert(0, "/app/backend")

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@airyatra.co.in"
ADMIN_PASSWORD = "Admin123!"
CUSTOMER_EMAIL = "customer@airyatra.co.in"
CUSTOMER_PASSWORD = "Customer@123"
YACHT_EMAIL = "yachtowner@airyatra.co.in"
YACHT_PASSWORD = "Yacht@123456"


# ---------- helpers ----------
async def _mint_admin_otp():
    """Mint a fresh OTP for admin directly via OTPService (server-side)."""
    from motor.motor_asyncio import AsyncIOMotorClient
    import database as dbmod
    backend_env = dotenv_values("/app/backend/.env")
    mongo_url = os.environ.get("MONGO_URL") or backend_env.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME") or backend_env.get("DB_NAME")
    client = AsyncIOMotorClient(mongo_url)
    dbmod.db = client[db_name]
    from services.otp_service import OTPService
    user = await dbmod.db.users.find_one({"email": ADMIN_EMAIL})
    assert user, "admin user not found"
    # clear cooldown/old OTPs
    await dbmod.db.otp_codes.delete_many({"user_id": user["id"], "purpose": "login"})
    code, meta = await OTPService().create_otp(
        user_id=user["id"], email=ADMIN_EMAIL, purpose="login",
        ip_address="127.0.0.1", user_agent="pytest"
    )
    return code


def _login_direct(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    return r


def get_admin_token():
    # trigger login (will send otp)
    r = _login_direct(ADMIN_EMAIL, ADMIN_PASSWORD)
    body = r.json() if r.status_code == 200 else {}
    if body.get("access_token"):
        return body["access_token"]
    # otp path — mint OTP and verify
    code = asyncio.get_event_loop().run_until_complete(_mint_admin_otp())
    vr = requests.post(f"{API}/auth/login/verify-otp",
                      json={"email": ADMIN_EMAIL, "otp_code": code}, timeout=15)
    assert vr.status_code == 200, f"otp verify failed: {vr.status_code} {vr.text[:300]}"
    return vr.json()["access_token"]


def get_direct_token(email, password):
    r = _login_direct(email, password)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text[:200]}"
    return r.json()["access_token"]


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    return get_admin_token()

@pytest.fixture(scope="module")
def customer_token():
    return get_direct_token(CUSTOMER_EMAIL, CUSTOMER_PASSWORD)

@pytest.fixture(scope="module")
def yacht_token():
    # yacht_owner is privileged and requires OTP now — mint OTP via server-side helper
    r = _login_direct(YACHT_EMAIL, YACHT_PASSWORD)
    body = r.json() if r.status_code == 200 else {}
    if body.get("access_token"):
        return body["access_token"]
    async def _mint():
        from motor.motor_asyncio import AsyncIOMotorClient
        import database as dbmod
        backend_env = dotenv_values("/app/backend/.env")
        client = AsyncIOMotorClient(os.environ.get("MONGO_URL") or backend_env.get("MONGO_URL"))
        dbmod.db = client[os.environ.get("DB_NAME") or backend_env.get("DB_NAME")]
        from services.otp_service import OTPService
        u = await dbmod.db.users.find_one({"email": YACHT_EMAIL})
        await dbmod.db.otp_codes.delete_many({"user_id": u["id"], "purpose": "login"})
        code, _ = await OTPService().create_otp(user_id=u["id"], email=YACHT_EMAIL,
                                                purpose="login", ip_address="127.0.0.1", user_agent="pytest")
        return code
    code = asyncio.get_event_loop().run_until_complete(_mint())
    vr = requests.post(f"{API}/auth/login/verify-otp",
                       json={"email": YACHT_EMAIL, "otp_code": code}, timeout=15)
    assert vr.status_code == 200, f"yacht otp verify failed: {vr.text[:200]}"
    return vr.json()["access_token"]

def H(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- 1. Access Control ----------
class TestAccessControl:
    def test_admin_can_access_feed(self, admin_token):
        r = requests.get(f"{API}/admin/audit-trail/feed?limit=5", headers=H(admin_token))
        assert r.status_code == 200, r.text[:200]
        data = r.json()
        assert "logs" in data and "total" in data and "report_types" in data
        assert isinstance(data["logs"], list)

    def test_customer_forbidden(self, customer_token):
        r = requests.get(f"{API}/admin/audit-trail/feed", headers=H(customer_token))
        assert r.status_code == 403

    def test_yacht_forbidden(self, yacht_token):
        r = requests.get(f"{API}/admin/audit-trail/feed", headers=H(yacht_token))
        assert r.status_code == 403


# ---------- 2. Filters & Report Types ----------
class TestFiltersAndReports:
    def test_16_report_types_present(self, admin_token):
        r = requests.get(f"{API}/admin/audit-trail/feed?limit=1", headers=H(admin_token))
        types = r.json()["report_types"]
        # PRD requested 16 categories. Feed exposes at least these
        assert len(types) >= 14, f"expected ~16 report types, got {len(types)}: {types}"
        for req in ["login", "failed_login", "logout", "refund", "financial", "invoice",
                    "receipt", "role_change", "document", "security", "suspicious",
                    "api_audit", "device", "location", "user_activity", "approval"]:
            assert req in types, f"missing report_type {req}"

    def test_preset_today(self, admin_token):
        r = requests.get(f"{API}/admin/audit-trail/feed?preset=today&limit=5", headers=H(admin_token))
        assert r.status_code == 200

    def test_preset_this_week(self, admin_token):
        r = requests.get(f"{API}/admin/audit-trail/feed?preset=this_week&limit=5", headers=H(admin_token))
        assert r.status_code == 200

    def test_report_type_login(self, admin_token):
        r = requests.get(f"{API}/admin/audit-trail/feed?report_type=login&limit=20", headers=H(admin_token))
        assert r.status_code == 200
        for l in r.json()["logs"]:
            act = (l.get("action") or "").lower()
            assert any(k in act for k in ["login", "oauth", "otp", "2fa"]), f"unexpected action {act}"

    def test_action_filter(self, admin_token):
        r = requests.get(f"{API}/admin/audit-trail/feed?action=login&limit=20", headers=H(admin_token))
        assert r.status_code == 200

    def test_search_and_ip_filter(self, admin_token):
        r = requests.get(f"{API}/admin/audit-trail/feed?search=admin&limit=10", headers=H(admin_token))
        assert r.status_code == 200
        r2 = requests.get(f"{API}/admin/audit-trail/feed?ip=10&limit=5", headers=H(admin_token))
        assert r2.status_code == 200


# ---------- 3. Log generation via user actions ----------
class TestLogGeneration:
    def test_failed_login_captured(self, admin_token):
        # 3 wrong password attempts for customer (safe, < 5 lockout)
        for _ in range(3):
            requests.post(f"{API}/auth/login",
                          json={"email": CUSTOMER_EMAIL, "password": "wrongpass_iter66"},
                          timeout=10)
        # give logs a moment
        import time; time.sleep(1)
        r = requests.get(f"{API}/admin/audit-trail/feed?report_type=failed_login&limit=50",
                        headers=H(admin_token))
        assert r.status_code == 200
        actions = [l.get("action") for l in r.json()["logs"]]
        assert any(a in ("login_failed", "otp_failed", "account_locked") for a in actions), \
            f"no failed-login action in feed: {actions[:10]}"

    def test_customer_login_captured(self, admin_token, customer_token):
        # customer_token fixture already logged in successfully.
        # Legacy AuditLogger masks emails (c***r@airyatra.co.in), so search on domain.
        import time; time.sleep(1)
        r = requests.get(f"{API}/admin/audit-trail/feed?report_type=login&role=customer&limit=50",
                        headers=H(admin_token))
        assert r.status_code == 200
        logs = r.json()["logs"]
        assert any((l.get("action") or "").lower() in ("login", "google_oauth_login", "otp_verified") for l in logs), \
            f"no login events for role=customer: {[l.get('action') for l in logs[:10]]}"

    def test_report_download_logged(self, admin_token):
        # download a CSV
        r = requests.get(f"{API}/admin/audit-trail/export?format=csv&report_type=login",
                        headers=H(admin_token))
        assert r.status_code == 200
        import time; time.sleep(1)
        # verify audit_report_downloaded appears
        r2 = requests.get(f"{API}/admin/audit-trail/feed?action=audit_report_downloaded&limit=5",
                         headers=H(admin_token))
        assert r2.status_code == 200
        acts = [l.get("action") for l in r2.json()["logs"]]
        assert "audit_report_downloaded" in acts, f"download not logged: {acts}"


# ---------- 4. Exports ----------
class TestExports:
    def test_export_csv(self, admin_token):
        r = requests.get(f"{API}/admin/audit-trail/export?format=csv&report_type=login",
                        headers=H(admin_token))
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        assert len(r.content) > 30

    def test_export_excel(self, admin_token):
        r = requests.get(f"{API}/admin/audit-trail/export?format=excel&report_type=login",
                        headers=H(admin_token))
        assert r.status_code == 200
        assert "spreadsheet" in r.headers.get("content-type", "")
        assert len(r.content) > 500

    def test_export_pdf(self, admin_token):
        r = requests.get(f"{API}/admin/audit-trail/export?format=pdf&report_type=login",
                        headers=H(admin_token))
        assert r.status_code == 200
        assert "application/pdf" in r.headers.get("content-type", "")
        assert r.content[:4] == b"%PDF"


# ---------- 5. Suspicious ----------
class TestSuspicious:
    def test_suspicious_returns_alerts(self, admin_token):
        r = requests.get(f"{API}/admin/audit-trail/suspicious?days=30", headers=H(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert "alerts" in data and "count" in data
        types = [a.get("type") for a in data["alerts"]]
        # After multiple failed logins earlier this test module should surface multiple_failed_logins
        assert "multiple_failed_logins" in types, f"expected multiple_failed_logins alert, got {types}"

    def test_alerts_persisted(self, admin_token):
        # verify db.security_alerts collection has entries
        from motor.motor_asyncio import AsyncIOMotorClient
        backend_env = dotenv_values("/app/backend/.env")
        client = AsyncIOMotorClient(os.environ.get("MONGO_URL") or backend_env.get("MONGO_URL"))
        db = client[os.environ.get("DB_NAME") or backend_env.get("DB_NAME")]
        cnt = asyncio.get_event_loop().run_until_complete(db.security_alerts.count_documents({}))
        assert cnt >= 1, "security_alerts not persisted"


# ---------- 6. Immutability ----------
class TestImmutability:
    def test_verify_integrity_ok(self, admin_token):
        r = requests.get(f"{API}/admin/audit-trail/verify-integrity", headers=H(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert data["integrity"] == "OK", f"integrity={data.get('integrity')} tampered={data.get('tampered')}"
        assert data["tampered"] == 0

    def test_no_delete_endpoint(self, admin_token):
        r = requests.delete(f"{API}/admin/audit-trail/feed", headers=H(admin_token))
        assert r.status_code in (404, 405), f"DELETE should not exist, got {r.status_code}"

    def test_admin_cannot_archive(self, admin_token):
        r = requests.post(f"{API}/admin/audit-trail/archive?days_older_than=365",
                         headers=H(admin_token))
        assert r.status_code == 403, f"admin (not super_admin/ceo) archive should be 403 got {r.status_code}"
