"""
Backend tests for AirYatra HRMS Phase 4:
- Leave email alerts (verify email log lines in backend supervisor logs)
- Attendance selfie upload + static serve + cross-user 404
- Payroll auto-run GET/POST toggle
- Manual payroll generate regression
"""
import os
import io
import time
import uuid
import pytest
import requests
from datetime import datetime, timezone
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")

ADMIN_EMAIL = "admin@airyatra.com"
ADMIN_PWD = "Admin123!"
EMP_EMAIL = "employee@airyatra.com"
EMP_PWD = "Employee@123"

BACKEND_LOG = "/var/log/supervisor/backend.err.log"

TINY_JPG = (
    b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    b"\xff\xdb\x00C\x00" + b"\x08" * 64 +
    b"\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00"
    b"\xff\xc4\x00\x14\x00\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00"
    b"\xff\xc4\x00\x14\x10\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00"
    b"\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xd2\xcf \xff\xd9"
)


def _login(email, pwd):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pwd}, timeout=30)
    assert r.status_code == 200, f"login {email}: {r.status_code} {r.text[:200]}"
    d = r.json()
    tok = d.get("token") or d.get("access_token")
    assert tok
    return tok, d


def _log_tail_contains(needle: str, since_offset: int = 0) -> bool:
    """Check if backend log contains needle (searching from byte offset)."""
    try:
        with open(BACKEND_LOG, "rb") as f:
            f.seek(since_offset)
            data = f.read().decode("utf-8", errors="ignore")
        return needle in data
    except FileNotFoundError:
        return False


def _log_size() -> int:
    try:
        return os.path.getsize(BACKEND_LOG)
    except FileNotFoundError:
        return 0


def _wait_log(needle: str, since: int, timeout: float = 25.0) -> bool:
    end = time.time() + timeout
    while time.time() < end:
        if _log_tail_contains(needle, since):
            return True
        time.sleep(1.0)
    return False


@pytest.fixture(scope="module")
def admin_headers():
    tok, _ = _login(ADMIN_EMAIL, ADMIN_PWD)
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def emp_headers():
    tok, _ = _login(EMP_EMAIL, EMP_PWD)
    return {"Authorization": f"Bearer {tok}"}


STATE = {}


# ==================== LEAVE EMAIL ALERTS ====================
class TestLeaveEmails:
    def test_apply_leave_triggers_hr_email(self, emp_headers):
        off = _log_size()
        payload = {
            "leave_type": "casual",
            "start_date": "2026-10-05",
            "end_date": "2026-10-05",
            "reason": "TEST phase4 email alert",
        }
        r = requests.post(f"{BASE_URL}/api/hr/leave/apply", json=payload, headers=emp_headers, timeout=30)
        assert r.status_code == 200, r.text[:300]
        leave_id = r.json().get("leave_id")
        assert leave_id
        STATE["approve_leave_id"] = leave_id
        # wait for background email log line
        found = _wait_log("New Leave Application", off, timeout=30)
        assert found, "Expected 'New Leave Application' log entry after leave apply"

    def test_approve_leave_emails_employee(self, admin_headers):
        leave_id = STATE.get("approve_leave_id")
        assert leave_id
        off = _log_size()
        r = requests.put(f"{BASE_URL}/api/hr/leave/{leave_id}/approve", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text[:300]
        found = _wait_log("approved", off, timeout=30)
        # Look for the approval email subject text pattern
        assert found, "Expected an 'approved' email log entry after approve"

    def test_reject_leave_emails_employee(self, emp_headers, admin_headers):
        # apply a fresh leave to reject
        off_apply = _log_size()
        payload = {
            "leave_type": "casual",
            "start_date": "2026-10-08",
            "end_date": "2026-10-08",
            "reason": "TEST phase4 reject email",
        }
        r = requests.post(f"{BASE_URL}/api/hr/leave/apply", json=payload, headers=emp_headers, timeout=30)
        assert r.status_code == 200
        leave_id = r.json().get("leave_id")
        assert leave_id
        _wait_log("New Leave Application", off_apply, timeout=15)

        off = _log_size()
        rr = requests.put(
            f"{BASE_URL}/api/hr/leave/{leave_id}/reject",
            json={"reason": "test rejection"},
            headers=admin_headers,
            timeout=30,
        )
        assert rr.status_code == 200, rr.text[:300]
        # Rejection subject includes "rejected" or "Leave" with rejection info
        found = _wait_log("reject", off, timeout=30)
        assert found, "Expected reject email log line after reject"


# ==================== ATTENDANCE SELFIE ====================
class TestAttendanceSelfie:
    def test_upload_selfie_and_serve(self, emp_headers, admin_headers):
        # Need an attendance record owned by employee@airyatra.com
        r = requests.get(f"{BASE_URL}/api/hr/attendance/my", headers=emp_headers, timeout=30)
        assert r.status_code == 200
        recs = r.json().get("attendance") or r.json().get("records") or r.json()
        assert isinstance(recs, list) and len(recs) >= 1, f"no attendance records: {recs}"
        # Skip on_leave rows without an id
        att_id = next((rec.get("id") for rec in recs if rec.get("id")), None)
        assert att_id, f"no attendance record with id: {recs}"
        STATE["att_id"] = att_id
        STATE["other_att_id"] = None
        # find one that is NOT owned by employee@airyatra.com (via admin listing)
        # Try uploading to a fake id first
        files = {"file": ("selfie.jpg", io.BytesIO(TINY_JPG), "image/jpeg")}
        ru = requests.post(
            f"{BASE_URL}/api/hr/attendance/{att_id}/selfie",
            headers=emp_headers,
            files=files,
            timeout=30,
        )
        assert ru.status_code == 200, ru.text[:400]
        selfie_url = ru.json().get("selfie_url")
        assert selfie_url and selfie_url.startswith("/api/uploads/attendance_selfies/")

        # GET the static image
        rs = requests.get(f"{BASE_URL}{selfie_url}", timeout=30)
        assert rs.status_code == 200, f"static selfie GET: {rs.status_code}"
        assert rs.content[:2] == b"\xff\xd8", f"not a jpeg magic: {rs.content[:4]!r}"

    def test_upload_selfie_other_user_att_returns_404(self, emp_headers):
        # A random/nonexistent attendance id must 404
        fake_id = str(uuid.uuid4())
        files = {"file": ("selfie.jpg", io.BytesIO(TINY_JPG), "image/jpeg")}
        ru = requests.post(
            f"{BASE_URL}/api/hr/attendance/{fake_id}/selfie",
            headers=emp_headers,
            files=files,
            timeout=30,
        )
        assert ru.status_code == 404, f"expected 404 for foreign/nonexistent attendance, got {ru.status_code}"


# ==================== PAYROLL AUTO-RUN ====================
class TestPayrollAutoRun:
    def test_get_and_toggle(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/hr/payroll-auto-run", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert "enabled" in d
        assert d.get("last_run_period") == "2026-07", f"expected last_run_period 2026-07, got {d.get('last_run_period')}"
        assert d.get("last_run_count") is not None

        # Disable
        r2 = requests.post(
            f"{BASE_URL}/api/hr/payroll-auto-run",
            json={"enabled": False},
            headers=admin_headers,
            timeout=30,
        )
        assert r2.status_code == 200
        r3 = requests.get(f"{BASE_URL}/api/hr/payroll-auto-run", headers=admin_headers, timeout=30)
        assert r3.status_code == 200
        assert r3.json().get("enabled") is False

        # Re-enable (IMPORTANT: leave enabled=True at end)
        r4 = requests.post(
            f"{BASE_URL}/api/hr/payroll-auto-run",
            json={"enabled": True},
            headers=admin_headers,
            timeout=30,
        )
        assert r4.status_code == 200
        r5 = requests.get(f"{BASE_URL}/api/hr/payroll-auto-run", headers=admin_headers, timeout=30)
        assert r5.status_code == 200
        assert r5.json().get("enabled") is True


# ==================== MANUAL PAYROLL GENERATE REGRESSION ====================
class TestManualPayrollGenerate:
    def test_generate_month(self, admin_headers):
        r = requests.post(
            f"{BASE_URL}/api/hr/payroll/generate",
            json={"month": 8, "year": 2026},
            headers=admin_headers,
            timeout=60,
        )
        assert r.status_code == 200, r.text[:400]
        body = r.json()
        recs = body.get("records") or []
        assert isinstance(recs, list) and len(recs) >= 1, f"expected at least 1 payroll record: {body}"
