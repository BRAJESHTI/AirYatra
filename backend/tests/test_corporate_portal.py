"""
Backend tests for AirYatra Corporate Portal (Task 2)
- /api/corporate/my-account resolution via auth
- Employee booking create (auto-approve + approval flow)
- Approval action approve/reject
- GST invoice PDF generation
- Policy guards (max limit, budget exceeded)
"""
import os
import uuid
from datetime import datetime, timedelta
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")

CORP_EMAIL = "corporate@airyatra.co.in"
CORP_PWD = "Corporate@123"
CORPORATE_ID = "CORP-DEMO26"

# Seeded employees
EMP_VIKRAM = "CORP-DEM-EMP-OPS001"   # limit 50k
EMP_SNEHA = "CORP-DEM-EMP-MKT001"    # limit 20k
EMP_ROHIT = "CORP-DEM-EMP-SALES1"    # approver / no approval


# ============ Fixtures ============
@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def corp_token(api):
    r = api.post(f"{BASE_URL}/api/auth/login", json={"email": CORP_EMAIL, "password": CORP_PWD})
    assert r.status_code == 200, f"Corporate login failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok, f"No token in login response: {data}"
    return tok


def _future_date(days=14):
    return (datetime.utcnow() + timedelta(days=days)).strftime("%Y-%m-%d")


# ============ /my-account ============
class TestMyAccount:
    def test_my_account_resolves(self, api, corp_token):
        r = api.get(f"{BASE_URL}/api/corporate/my-account",
                    headers={"Authorization": f"Bearer {corp_token}"})
        assert r.status_code == 200, r.text[:300]
        j = r.json()
        assert j["success"] is True
        corp = j.get("corporate")
        assert corp, "Corporate account not resolved"
        assert corp["corporate_id"] == CORPORATE_ID
        assert "TechVista" in corp["company_name"]
        assert corp["status"] == "approved"
        assert corp["gst_number"] == "27AATCV1234F1Z5"

    def test_my_account_requires_auth(self, api):
        r = api.get(f"{BASE_URL}/api/corporate/my-account")
        assert r.status_code in (401, 403)


# ============ Bookings list ============
class TestBookingsList:
    def test_bookings_list(self, api):
        r = api.get(f"{BASE_URL}/api/corporate/bookings/{CORPORATE_ID}")
        assert r.status_code == 200
        j = r.json()
        assert j["success"] is True
        assert isinstance(j["bookings"], list)


# ============ Booking creation + auto-approve ============
class TestBookingCreateAutoApprove:
    booking_id = None

    def test_auto_approve_below_25k(self, api):
        payload = {
            "corporate_id": CORPORATE_ID,
            "employee_code": EMP_VIKRAM,
            "from_location": "Mumbai",
            "to_location": "Nashik",
            "travel_date": _future_date(),
            "passengers": 1,
            "aircraft_type": "helicopter",
            "purpose": f"TEST_auto_{uuid.uuid4().hex[:6]}",
            "estimated_amount": 15000,
        }
        r = api.post(f"{BASE_URL}/api/corporate/booking/create", json=payload)
        assert r.status_code == 200, r.text[:300]
        j = r.json()
        assert j["success"] is True
        assert j["auto_approved"] is True
        assert j["booking"]["status"] == "confirmed"
        assert j["booking"]["approval_status"] == "auto_approved"
        TestBookingCreateAutoApprove.booking_id = j["booking"]["id"]

    def test_gst_pdf_for_confirmed_booking(self, api):
        assert TestBookingCreateAutoApprove.booking_id, "No booking created"
        r = api.get(
            f"{BASE_URL}/api/corporate/invoice/{TestBookingCreateAutoApprove.booking_id}/gst",
            params={"corporate_id": CORPORATE_ID},
        )
        assert r.status_code == 200, r.text[:300]
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content.startswith(b"%PDF"), "Response is not a valid PDF"
        # Check some GST invoice markers exist in raw PDF stream
        body = r.content
        assert len(body) > 1000
        # PDF text is often compressed; we just assert basic PDF marker presence.


# ============ Approval flow ============
class TestApprovalFlow:
    approval_id_to_approve = None
    booking_id_to_approve = None
    approval_id_to_reject = None
    booking_id_to_reject = None

    def _create_pending(self, api, purpose_suffix, amount=26000):
        payload = {
            "corporate_id": CORPORATE_ID,
            "employee_code": EMP_SNEHA,   # approval_limit 20k
            "from_location": "Mumbai",
            "to_location": "Delhi",
            "travel_date": _future_date(20),
            "passengers": 1,
            "aircraft_type": "helicopter",
            "purpose": f"TEST_pending_{purpose_suffix}",
            "estimated_amount": amount,  # above 20k threshold triggers pending
        }
        r = api.post(f"{BASE_URL}/api/corporate/booking/create", json=payload)
        assert r.status_code == 200, r.text[:400]
        j = r.json()
        assert j["auto_approved"] is False, f"Expected pending but got auto-approved: {j}"
        assert j["approval"], "Approval doc missing"
        return j["booking"]["id"], j["approval"]["approval_id"]

    def test_create_pending_and_approve(self, api):
        bid, aid = self._create_pending(api, "approve")
        TestApprovalFlow.booking_id_to_approve = bid
        TestApprovalFlow.approval_id_to_approve = aid

        r = api.post(
            f"{BASE_URL}/api/corporate/approvals/action",
            params={"approver_id": "CORP-ADMIN"},
            json={"approval_id": aid, "action": "approve"},
        )
        assert r.status_code == 200, r.text[:300]
        assert r.json()["success"] is True

        # Verify booking flipped to confirmed
        r2 = api.get(f"{BASE_URL}/api/corporate/bookings/{CORPORATE_ID}")
        bk = next((b for b in r2.json()["bookings"] if b["id"] == bid), None)
        assert bk, "Booking not found in list"
        assert bk["status"] == "confirmed"
        assert bk["approval_status"] == "approved"

    def test_gst_pdf_for_approved_booking(self, api):
        bid = TestApprovalFlow.booking_id_to_approve
        r = api.get(
            f"{BASE_URL}/api/corporate/invoice/{bid}/gst",
            params={"corporate_id": CORPORATE_ID},
        )
        assert r.status_code == 200, r.text[:300]
        assert r.content.startswith(b"%PDF")

    def test_create_pending_and_reject(self, api):
        bid, aid = self._create_pending(api, "reject")
        TestApprovalFlow.booking_id_to_reject = bid
        TestApprovalFlow.approval_id_to_reject = aid

        r = api.post(
            f"{BASE_URL}/api/corporate/approvals/action",
            params={"approver_id": "CORP-ADMIN"},
            json={"approval_id": aid, "action": "reject", "comments": "TEST rejection"},
        )
        assert r.status_code == 200
        # Booking should be rejected
        r2 = api.get(f"{BASE_URL}/api/corporate/bookings/{CORPORATE_ID}")
        bk = next((b for b in r2.json()["bookings"] if b["id"] == bid), None)
        assert bk["status"] == "rejected"

    def test_gst_pdf_blocked_for_rejected(self, api):
        bid = TestApprovalFlow.booking_id_to_reject
        r = api.get(
            f"{BASE_URL}/api/corporate/invoice/{bid}/gst",
            params={"corporate_id": CORPORATE_ID},
        )
        assert r.status_code == 400, f"Expected 400 for rejected booking, got {r.status_code}"

    def test_double_action_fails(self, api):
        aid = TestApprovalFlow.approval_id_to_approve
        r = api.post(
            f"{BASE_URL}/api/corporate/approvals/action",
            params={"approver_id": "CORP-ADMIN"},
            json={"approval_id": aid, "action": "approve"},
        )
        assert r.status_code == 400


# ============ Policy guards ============
class TestPolicyGuards:
    def test_exceeds_travel_policy_limit(self, api):
        payload = {
            "corporate_id": CORPORATE_ID,
            "employee_code": EMP_VIKRAM,
            "from_location": "Mumbai",
            "to_location": "Nashik",
            "travel_date": _future_date(),
            "passengers": 1,
            "aircraft_type": "helicopter",
            "purpose": "TEST_policy_limit",
            "estimated_amount": 600000,   # > 500000 policy max
        }
        r = api.post(f"{BASE_URL}/api/corporate/booking/create", json=payload)
        assert r.status_code == 400
        assert "policy" in r.text.lower() or "limit" in r.text.lower()

    def test_budget_exceeded(self, api):
        # Sneha's total budget is 200k, we've already consumed some. Attempt way over.
        payload = {
            "corporate_id": CORPORATE_ID,
            "employee_code": EMP_SNEHA,
            "from_location": "Mumbai",
            "to_location": "Delhi",
            "travel_date": _future_date(),
            "passengers": 1,
            "aircraft_type": "helicopter",
            "purpose": "TEST_budget_exceeded",
            "estimated_amount": 490000,  # under 500k policy but exceeds Sneha's remaining budget
        }
        r = api.post(f"{BASE_URL}/api/corporate/booking/create", json=payload)
        assert r.status_code == 400
        assert "budget" in r.text.lower()


# ============ Employee management ============
class TestEmployeeManagement:
    def test_list_employees(self, api):
        r = api.get(f"{BASE_URL}/api/corporate/employees/{CORPORATE_ID}")
        assert r.status_code == 200
        j = r.json()
        assert j["success"] is True
        assert j["count"] >= 4, f"Expected >=4 active employees, got {j['count']}"

    def test_gst_invoice_for_seeded_booking(self, api):
        # cb-demo-001 is a confirmed seeded corporate booking
        r = api.get(
            f"{BASE_URL}/api/corporate/invoice/cb-demo-001/gst",
            params={"corporate_id": CORPORATE_ID},
        )
        assert r.status_code == 200, r.text[:400]
        assert r.content.startswith(b"%PDF")
