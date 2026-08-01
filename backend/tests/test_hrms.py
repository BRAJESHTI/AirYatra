"""
Backend tests for AirYatra OS Phase 3: HRMS Suite
- Employee management (admin)
- Employee self-service (attendance, leave, payroll, expense)
"""
import os
import io
import uuid
import time
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")

ADMIN_EMAIL = "admin@airyatra.com"
ADMIN_PWD = "Admin123!"
EMP_EMAIL = "employee@airyatra.com"
EMP_PWD = "Employee@123"


def _login(email, password):
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=30,
    )
    assert r.status_code == 200, f"login {email} -> {r.status_code} {r.text[:300]}"
    data = r.json()
    # Support common token field names
    token = (
        data.get("token")
        or data.get("access_token")
        or (data.get("data") or {}).get("token")
    )
    assert token, f"no token in login response: {data}"
    return token, data


@pytest.fixture(scope="module")
def admin_token():
    tok, _ = _login(ADMIN_EMAIL, ADMIN_PWD)
    return tok


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def seeded_emp_token():
    tok, data = _login(EMP_EMAIL, EMP_PWD)
    # verify role
    user = data.get("user") or {}
    roles = user.get("roles") or user.get("role") or []
    if isinstance(roles, str):
        roles = [roles]
    assert "employee" in roles, f"seeded employee should have employee role, got {roles}"
    return tok


@pytest.fixture(scope="module")
def seeded_emp_headers(seeded_emp_token):
    return {"Authorization": f"Bearer {seeded_emp_token}"}


# Test-scoped state
_STATE = {}


class TestEmployeeManagement:
    def test_create_employee(self, admin_headers):
        unique = uuid.uuid4().hex[:6]
        email = f"testemp_{unique}@airyatra.com"
        payload = {
            "email": email,
            "password": "TestEmp@123",
            "full_name": f"TEST Emp {unique}",
            "phone": "+919888000111",
            "role": "employee",
            "department": "Operations",
            "designation": "Analyst",
            "basic_salary": 30000,
            "hra": 10000,
        }
        r = requests.post(
            f"{BASE_URL}/api/hr/employees", json=payload, headers=admin_headers, timeout=30
        )
        assert r.status_code in (200, 201), f"{r.status_code} {r.text[:400]}"
        d = r.json()
        emp = d.get("employee") or d
        code = emp.get("employee_code") or d.get("employee_code")
        assert code and code.startswith("EMP-"), f"employee_code missing/invalid: {d}"
        _STATE["new_emp_email"] = email
        _STATE["new_emp_password"] = "TestEmp@123"
        _STATE["new_emp_id"] = d.get("employee_id") or (d.get("employee") or {}).get("id")
        _STATE["new_emp_code"] = code

    def test_list_employees(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/hr/employees", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        emps = d.get("employees") or d
        assert isinstance(emps, list) and len(emps) >= 1
        sample = emps[0]
        assert "gross_salary" in sample, f"missing gross_salary field. keys={list(sample.keys())}"
        assert "today_status" in sample, f"missing today_status field. keys={list(sample.keys())}"

    def test_deactivate_then_reactivate(self, admin_headers):
        emp_id = _STATE.get("new_emp_id")
        assert emp_id, "need created employee id"
        # deactivate
        r = requests.put(
            f"{BASE_URL}/api/hr/employees/{emp_id}",
            json={"is_active": False},
            headers=admin_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text[:300]

        # login should fail (403 or 401)
        r2 = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": _STATE["new_emp_email"], "password": _STATE["new_emp_password"]},
            timeout=30,
        )
        assert r2.status_code in (401, 403), f"expected 401/403 for deactivated user, got {r2.status_code}: {r2.text[:300]}"

        # reactivate
        r3 = requests.put(
            f"{BASE_URL}/api/hr/employees/{emp_id}",
            json={"is_active": True},
            headers=admin_headers,
            timeout=30,
        )
        assert r3.status_code == 200, r3.text[:300]

        # login now succeeds
        r4 = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": _STATE["new_emp_email"], "password": _STATE["new_emp_password"]},
            timeout=30,
        )
        assert r4.status_code == 200, r4.text[:300]
        data = r4.json()
        tok = data.get("token") or data.get("access_token")
        assert tok
        _STATE["new_emp_token"] = tok


class TestEmployeeSelfService:
    def test_overview(self):
        tok = _STATE.get("new_emp_token")
        assert tok
        r = requests.get(
            f"{BASE_URL}/api/hr/employee/overview",
            headers={"Authorization": f"Bearer {tok}"},
            timeout=30,
        )
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        # accept flexible schema but require the requested sections
        for key in ("employee", "month_summary", "leave_balance", "expenses"):
            assert key in d or key in (d.get("data") or {}), f"missing {key} in overview: {list(d.keys())}"

    def test_checkin_checkout_and_my(self):
        tok = _STATE.get("new_emp_token")
        assert tok
        headers = {"Authorization": f"Bearer {tok}"}
        r = requests.post(
            f"{BASE_URL}/api/hr/attendance/check-in",
            json={"latitude": 19.0, "longitude": 72.8},
            headers=headers,
            timeout=30,
        )
        assert r.status_code == 200, f"check-in failed: {r.status_code} {r.text[:300]}"

        r2 = requests.post(
            f"{BASE_URL}/api/hr/attendance/check-out",
            json={"latitude": 19.0, "longitude": 72.8},
            headers=headers,
            timeout=30,
        )
        assert r2.status_code == 200, f"check-out failed: {r2.status_code} {r2.text[:300]}"

        r3 = requests.get(f"{BASE_URL}/api/hr/attendance/my", headers=headers, timeout=30)
        assert r3.status_code == 200
        d = r3.json()
        recs = d.get("attendance") or d.get("records") or d
        assert isinstance(recs, list) and len(recs) >= 1

    def test_leave_apply_admin_approve(self, admin_headers):
        tok = _STATE.get("new_emp_token")
        headers = {"Authorization": f"Bearer {tok}"}
        payload = {
            "leave_type": "casual",
            "start_date": "2026-09-10",
            "end_date": "2026-09-11",
            "reason": "TEST leave",
        }
        r = requests.post(
            f"{BASE_URL}/api/hr/leave/apply", json=payload, headers=headers, timeout=30
        )
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        leave_id = d.get("leave_id") or (d.get("leave") or {}).get("id")
        assert leave_id, f"leave id missing: {d}"

        # admin list pending
        rp = requests.get(f"{BASE_URL}/api/hr/leave/pending", headers=admin_headers, timeout=30)
        assert rp.status_code == 200
        pending = rp.json().get("pending_leaves") or rp.json().get("leaves") or []
        ids = [p.get("id") or p.get("leave_id") for p in pending]
        assert leave_id in ids, f"newly-applied leave not in pending list: {ids}"

        # approve
        ra = requests.put(
            f"{BASE_URL}/api/hr/leave/{leave_id}/approve",
            headers=admin_headers,
            timeout=30,
        )
        assert ra.status_code == 200, ra.text[:300]

        # employee GET /leave/my shows approved + balance
        rm = requests.get(f"{BASE_URL}/api/hr/leave/my", headers=headers, timeout=30)
        assert rm.status_code == 200
        dm = rm.json()
        leaves = dm.get("leaves") or dm.get("data") or []
        assert any(
            (l.get("id") == leave_id or l.get("leave_id") == leave_id)
            and (l.get("status", "").lower() == "approved")
            for l in leaves
        ), f"approved leave not found in employee /leave/my: {leaves}"
        # balance field expected
        assert "balance" in dm or "leave_balance" in dm, f"leave balance missing: {list(dm.keys())}"

    def test_payroll_generate_idempotent_and_pdf(self, admin_headers):
        emp_id = _STATE.get("new_emp_id")
        assert emp_id
        r = requests.post(
            f"{BASE_URL}/api/hr/payroll/generate",
            json={"employee_id": emp_id},
            headers=admin_headers,
            timeout=60,
        )
        assert r.status_code == 200, r.text[:400]
        body = r.json()
        recs = body.get("records") or [body.get("payroll") or body]
        rec = recs[0] if recs else {}
        pid1 = rec.get("id") or rec.get("payroll_id")
        assert pid1, f"payroll id missing: {body}"

        # regenerate must return same id (idempotency bug fixed)
        r2 = requests.post(
            f"{BASE_URL}/api/hr/payroll/generate",
            json={"employee_id": emp_id},
            headers=admin_headers,
            timeout=60,
        )
        assert r2.status_code == 200, r2.text[:400]
        body2 = r2.json()
        recs2 = body2.get("records") or [body2.get("payroll") or body2]
        rec2 = recs2[0] if recs2 else {}
        pid2 = rec2.get("id") or rec2.get("payroll_id")
        assert pid1 == pid2, f"regenerate returned different id: {pid1} vs {pid2} (idempotency broken)"

        # employee downloads own payslip
        tok = _STATE.get("new_emp_token")
        rp = requests.get(
            f"{BASE_URL}/api/hr/payroll/{pid1}/payslip.pdf",
            headers={"Authorization": f"Bearer {tok}"},
            timeout=60,
        )
        assert rp.status_code == 200, rp.text[:300]
        assert rp.content[:4] == b"%PDF", f"payslip does not look like PDF, starts with {rp.content[:8]!r}"

        # other employee (seeded) trying to fetch this payslip -> 403
        seeded_tok, _ = _login(EMP_EMAIL, EMP_PWD)
        rf = requests.get(
            f"{BASE_URL}/api/hr/payroll/{pid1}/payslip.pdf",
            headers={"Authorization": f"Bearer {seeded_tok}"},
            timeout=30,
        )
        assert rf.status_code == 403, f"expected 403 forbidden for other user's payslip, got {rf.status_code}"

    def test_expense_flow(self):
        tok = _STATE.get("new_emp_token")
        headers = {"Authorization": f"Bearer {tok}"}
        payload = {
            "title": "TEST Travel",
            "category": "travel",
            "amount": 1200,
            "expense_date": "2026-08-05",
            "description": "TEST expense",
        }
        r = requests.post(
            f"{BASE_URL}/api/hr/expense/create", json=payload, headers=headers, timeout=30
        )
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        exp = d.get("expense") or d
        eid = exp.get("id") or exp.get("expense_id") or d.get("id")
        assert eid, f"expense id missing: {d}"

        # upload document (tiny png)
        png = (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
            b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0"
            b"\x00\x00\x00\x03\x00\x01\x5b\xdc\x0f\xd3\x00\x00\x00\x00IEND\xaeB`\x82"
        )
        files = {"file": ("receipt.png", io.BytesIO(png), "image/png")}
        ru = requests.post(
            f"{BASE_URL}/api/hr/expense/{eid}/upload-document",
            headers=headers,
            files=files,
            timeout=30,
        )
        assert ru.status_code == 200, f"upload-document failed: {ru.status_code} {ru.text[:300]}"

        rs = requests.put(
            f"{BASE_URL}/api/hr/expense/{eid}/submit", headers=headers, timeout=30
        )
        assert rs.status_code == 200, rs.text[:300]

        rm = requests.get(f"{BASE_URL}/api/hr/expense/my", headers=headers, timeout=30)
        assert rm.status_code == 200
        exps = rm.json().get("expenses") or rm.json()
        target = next(
            (e for e in exps if (e.get("id") == eid or e.get("expense_id") == eid)), None
        )
        assert target, f"expense {eid} not found in /expense/my"
        status = (target.get("status") or "").lower()
        assert "hr_pending" in status or "pending" in status, f"unexpected status: {status}"
