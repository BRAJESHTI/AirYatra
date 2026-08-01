"""
Phase 5 HRMS backend tests:
- Team Attendance Today
- Holidays CRUD + duplicate + RBAC
- Payroll holiday credit
- Expense REJECT email (single trigger to avoid spam)
"""
import os
import io
import time
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")

ADMIN_EMAIL = "admin@airyatra.com"
ADMIN_PWD = "Admin123!"
EMP_EMAIL = "employee@airyatra.com"
EMP_PWD = "Employee@123"
BACKEND_LOG = "/var/log/supervisor/backend.err.log"

# tiny PNG (1x1 red)
TINY_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90"
    b"wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0\x00\x00\x00\x03\x00\x01^\xf3*:\x00\x00\x00\x00IEND\xaeB`\x82"
)


def _login(email, pwd):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pwd}, timeout=30)
    assert r.status_code == 200, f"login {email}: {r.status_code} {r.text[:200]}"
    d = r.json()
    tok = d.get("access_token") or d.get("token")
    assert tok
    return tok


def _log_size():
    try:
        return os.path.getsize(BACKEND_LOG)
    except FileNotFoundError:
        return 0


def _wait_log(needle, since, timeout=30.0):
    end = time.time() + timeout
    while time.time() < end:
        try:
            with open(BACKEND_LOG, "rb") as f:
                f.seek(since)
                data = f.read().decode("utf-8", errors="ignore")
            if needle in data:
                return True
        except FileNotFoundError:
            pass
        time.sleep(1.0)
    return False


@pytest.fixture(scope="module")
def admin_h():
    return {"Authorization": f"Bearer {_login(ADMIN_EMAIL, ADMIN_PWD)}"}


@pytest.fixture(scope="module")
def emp_h():
    return {"Authorization": f"Bearer {_login(EMP_EMAIL, EMP_PWD)}"}


# ============ TEAM ATTENDANCE TODAY ============
class TestTeamAttendanceToday:
    def test_today_endpoint_shape_and_counts(self, admin_h):
        r = requests.get(f"{BASE_URL}/api/hr/attendance/today", headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert "date" in d
        assert "is_holiday" in d
        counts = d.get("counts") or {}
        for k in ["in_office", "checked_out", "on_leave", "missing", "total"]:
            assert k in counts, f"missing count key {k}: {counts}"
        s = counts["in_office"] + counts["checked_out"] + counts["on_leave"] + counts["missing"]
        assert s == counts["total"], f"sum {s} != total {counts['total']}"
        team = d.get("team") or []
        assert isinstance(team, list) and len(team) >= 1
        # Rahul Verma EMP-0001 should be checked_out with selfie_url
        rahul = next((m for m in team if m.get("employee_code") == "EMP-0001"), None)
        assert rahul, f"Rahul EMP-0001 missing from team: {[m.get('employee_code') for m in team]}"
        assert rahul.get("status") == "checked_out", f"Rahul status: {rahul}"
        assert rahul.get("selfie_url"), f"Rahul selfie_url missing: {rahul}"


# ============ HOLIDAYS CRUD ============
class TestHolidays:
    def test_list_seeded(self, admin_h):
        r = requests.get(f"{BASE_URL}/api/hr/holidays", params={"year": 2026}, headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text[:300]
        items = r.json().get("holidays") or r.json()
        assert isinstance(items, list)
        dates = {h.get("date"): h.get("name") for h in items}
        assert "2026-08-15" in dates, f"Independence Day missing: {dates}"
        assert "2026-10-20" in dates, f"Diwali missing: {dates}"

    def test_duplicate_rejected(self, admin_h):
        r = requests.post(
            f"{BASE_URL}/api/hr/holidays",
            json={"date": "2026-08-15", "name": "Dup Test"},
            headers=admin_h,
            timeout=30,
        )
        assert r.status_code == 400, f"expected 400 dup, got {r.status_code} {r.text[:200]}"

    def test_create_and_delete(self, admin_h):
        r = requests.post(
            f"{BASE_URL}/api/hr/holidays",
            json={"date": "2026-12-25", "name": "TEST Christmas"},
            headers=admin_h,
            timeout=30,
        )
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        hid = body.get("id") or body.get("holiday_id") or (body.get("holiday") or {}).get("id")
        assert hid, f"created holiday missing id: {body}"

        # verify GET now includes it
        r2 = requests.get(f"{BASE_URL}/api/hr/holidays", params={"year": 2026}, headers=admin_h, timeout=30)
        items = r2.json().get("holidays") or r2.json()
        assert any(h.get("date") == "2026-12-25" for h in items)

        # delete
        rd = requests.delete(f"{BASE_URL}/api/hr/holidays/{hid}", headers=admin_h, timeout=30)
        assert rd.status_code == 200, rd.text[:300]

        # verify gone
        r3 = requests.get(f"{BASE_URL}/api/hr/holidays", params={"year": 2026}, headers=admin_h, timeout=30)
        items3 = r3.json().get("holidays") or r3.json()
        assert not any(h.get("date") == "2026-12-25" for h in items3), "Christmas still present after delete"

    def test_employee_can_read_cannot_write(self, emp_h):
        rg = requests.get(f"{BASE_URL}/api/hr/holidays", params={"year": 2026}, headers=emp_h, timeout=30)
        assert rg.status_code == 200, f"employee GET holidays should be allowed: {rg.status_code}"
        rp = requests.post(
            f"{BASE_URL}/api/hr/holidays",
            json={"date": "2026-11-11", "name": "Emp Try"},
            headers=emp_h,
            timeout=30,
        )
        assert rp.status_code == 403, f"employee POST should be 403, got {rp.status_code}"


# ============ PAYROLL HOLIDAY CREDIT ============
class TestPayrollHolidayCredit:
    def test_generate_includes_holiday_days(self, admin_h):
        r = requests.post(
            f"{BASE_URL}/api/hr/payroll/generate",
            json={
                "employee_id": "5a171b36-b9fa-4acc-9290-829a80ddf20f",
                "month": 8,
                "year": 2026,
            },
            headers=admin_h,
            timeout=60,
        )
        assert r.status_code == 200, r.text[:400]
        body = r.json()
        recs = body.get("records") or ([body.get("record")] if body.get("record") else [])
        assert recs and len(recs) >= 1, f"no payroll record: {body}"
        rec = recs[0]
        assert rec.get("holiday_days") == 1, f"expected holiday_days=1, got {rec.get('holiday_days')} full={rec}"
        ewd = rec.get("effective_working_days")
        # expected: 0 present + 1 half*0.5 + 1 holiday = 1.5
        assert ewd is not None and abs(float(ewd) - 1.5) < 0.01, f"effective_working_days expected 1.5, got {ewd}"


# ============ EXPENSE REJECT EMAIL ============
class TestExpenseRejectEmail:
    def test_reject_triggers_email(self, emp_h, admin_h):
        # 1. create expense
        r = requests.post(
            f"{BASE_URL}/api/hr/expense/create",
            json={
                "category": "travel",
                "title": "TEST phase5 reject",
                "amount": 111,
                "description": "TEST phase5 reject email",
                "expense_date": "2026-08-05",
            },
            headers=emp_h,
            timeout=30,
        )
        assert r.status_code == 200, r.text[:400]
        body = r.json()
        exp_id = body.get("expense_id") or body.get("id") or (body.get("expense") or {}).get("id")
        assert exp_id, f"missing expense id: {body}"

        # 2. upload receipt
        files = {"file": ("r.png", io.BytesIO(TINY_PNG), "image/png")}
        ru = requests.post(
            f"{BASE_URL}/api/hr/expense/{exp_id}/upload-document",
            headers=emp_h,
            files=files,
            timeout=30,
        )
        assert ru.status_code == 200, f"receipt upload failed: {ru.status_code} {ru.text[:300]}"

        # 3. submit
        rs = requests.put(f"{BASE_URL}/api/hr/expense/{exp_id}/submit", headers=emp_h, timeout=30)
        assert rs.status_code == 200, rs.text[:300]

        # 4. reject via admin — trigger email
        off = _log_size()
        rr = requests.put(
            f"{BASE_URL}/api/hr/expense/{exp_id}/reject",
            json={"role": "hr", "reason": "test phase5"},
            headers=admin_h,
            timeout=30,
        )
        assert rr.status_code == 200, rr.text[:400]
        # look for 'Expense Rejected' email log line (case-insensitive attempt)
        found = _wait_log("Expense Rejected", off, timeout=45) or _wait_log("expense_rejected", off, timeout=1) or _wait_log("Rejected", off, timeout=1)
        assert found, "expected 'Expense Rejected' email log line after reject"
