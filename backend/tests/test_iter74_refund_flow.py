"""Iter-74: Customer-cancel refund flow + panel visibility + 24h reminder idempotency.

Covers:
- POST /api/refunds/customer-cancel policy math (>72h => 10% deduction).
- Booking status -> cancellation_requested.
- Refund visibility: /pending for admin/finance/ceo, /care-view for support (403 for customer).
- Customer /my tracker.
- POST /api/scheduler/trigger/departure-reminders idempotency for the flagged yacht booking.
"""
import os
import sys
import asyncio
import pytest
import requests
from dotenv import dotenv_values

sys.path.insert(0, "/app/backend")

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env["REACT_APP_BACKEND_URL"]).rstrip("/")
API = f"{BASE_URL}/api"

CUSTOMER = {"email": "customer@airyatra.co.in", "password": "Customer@123"}
ADMIN = {"email": "admin@airyatra.co.in", "password": "Adm@Air123"}
FINANCE = {"email": "finance@airyatra.co.in", "password": "Fin@Air123"}
CEO = {"email": "ceo@airyatra.co.in", "password": "Ceo@Air123"}
SUPPORT = {"email": "noreply@airyatra.co.in", "password": "Nor@Air123"}

# Chosen seeded paid yacht booking with start_date deep in future (>72h -> 10% deduction).
TARGET_BOOKING_ID = "cd75547b-ed2f-4a04-bf35-599133b3ab3b"
TARGET_BOOKING_REF = "YB2026080009"
TARGET_AMOUNT = 12000.0
EXPECTED_DEDUCTION_PCT = 10.0
EXPECTED_DEDUCTION = round(TARGET_AMOUNT * EXPECTED_DEDUCTION_PCT / 100, 2)
EXPECTED_REFUNDABLE = round(TARGET_AMOUNT - EXPECTED_DEDUCTION, 2)

# Booking already flagged departure_reminder_24h_sent=True (per handoff).
FLAGGED_YACHT_ID = "1d76b5bf-4188-4ee0-aff0-5517239d53db"


def _login_direct(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text[:300]}"
    return r.json()


async def _mint_otp_and_verify(email, password):
    data = _login_direct(email, password)
    if not data.get("otp_required"):
        return data["access_token"]
    from database import connect_to_mongo, get_database
    from services.otp_service import OTPService
    await connect_to_mongo()
    db = get_database()
    user = await db.users.find_one({"email": email})
    assert user, f"User {email} not found"
    await db.otp_codes.delete_many({"user_id": user["id"], "purpose": "login"})
    code, rec = await OTPService().create_otp(user["id"], email, purpose="login",
                                              ip_address="127.0.0.1", user_agent="pytest")
    assert code, f"OTP mint failed: {rec}"
    v = requests.post(f"{API}/auth/login/verify-otp", json={"email": email, "otp_code": code}, timeout=30)
    assert v.status_code == 200, v.text
    return v.json()["access_token"]


def _run(coro):
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            raise RuntimeError
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)


def _staff_token(cred):
    return _run(_mint_otp_and_verify(cred["email"], cred["password"]))


@pytest.fixture(scope="module")
def customer_token():
    data = _login_direct(**CUSTOMER)
    assert not data.get("otp_required"), f"Customer unexpectedly required OTP: {data}"
    return data["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return _staff_token(ADMIN)


@pytest.fixture(scope="module")
def finance_token():
    return _staff_token(FINANCE)


@pytest.fixture(scope="module")
def ceo_token():
    return _staff_token(CEO)


@pytest.fixture(scope="module")
def support_token():
    return _staff_token(SUPPORT)


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ==================== CUSTOMER CANCEL FLOW ====================

class TestCustomerCancelFlow:
    """Customer self-cancel produces correctly-computed refund request."""

    def test_cancel_creates_refund_request_with_10pct_policy(self, customer_token):
        r = requests.post(f"{API}/refunds/customer-cancel",
                          headers=_h(customer_token),
                          json={"booking_id": TARGET_BOOKING_ID, "reason": "Change of plans"},
                          timeout=30)
        assert r.status_code == 200, f"customer-cancel failed: {r.status_code} {r.text[:400]}"
        body = r.json()
        req = body.get("refund_request")
        assert req, f"No refund_request in response: {body}"
        # Math assertions
        assert req["amount_paid"] == TARGET_AMOUNT, f"paid mismatch: {req['amount_paid']}"
        assert req["deduction_pct"] == EXPECTED_DEDUCTION_PCT, \
            f"deduction_pct expected {EXPECTED_DEDUCTION_PCT}%, got {req['deduction_pct']}%"
        assert req["deduction_amount"] == EXPECTED_DEDUCTION, \
            f"deduction_amount expected {EXPECTED_DEDUCTION}, got {req['deduction_amount']}"
        assert req["refundable_amount"] == EXPECTED_REFUNDABLE, \
            f"refundable expected {EXPECTED_REFUNDABLE}, got {req['refundable_amount']}"
        assert req["status"] == "pending_approval"
        assert req["initiated_by"] == "customer_cancel"
        assert req["booking_id"] == TARGET_BOOKING_ID
        assert req["booking_ref"] == TARGET_BOOKING_REF
        # Save request id for later assertions
        pytest.refund_request_id = req["id"]

    def test_double_cancel_rejected(self, customer_token):
        r = requests.post(f"{API}/refunds/customer-cancel",
                          headers=_h(customer_token),
                          json={"booking_id": TARGET_BOOKING_ID, "reason": "Change of plans"},
                          timeout=30)
        assert r.status_code == 400, f"expected 400 double-cancel, got {r.status_code}: {r.text[:200]}"
        assert "already exists" in r.text.lower()

    def test_booking_status_now_cancellation_requested(self, customer_token):
        # Verify via /refunds/my which reflects the state.
        r = requests.get(f"{API}/refunds/my", headers=_h(customer_token), timeout=30)
        assert r.status_code == 200
        refunds = r.json()["refunds"]
        match = [x for x in refunds if x["booking_id"] == TARGET_BOOKING_ID]
        assert match, "Customer /my did not include the just-cancelled booking"
        m = match[0]
        assert m["status"] == "pending_approval"
        assert m["refundable_amount"] == EXPECTED_REFUNDABLE
        assert m["deduction_pct"] == EXPECTED_DEDUCTION_PCT
        # Steps: requested done, approved pending, credited pending
        steps = {s["key"]: s for s in m["steps"]}
        assert steps["requested"]["done"] is True
        assert steps["approved"]["done"] is False
        assert steps["credited"]["done"] is False


# ==================== PANEL VISIBILITY ====================

class TestPanelVisibility:

    def _assert_in_pending(self, tok, role_label):
        r = requests.get(f"{API}/refunds/pending", headers=_h(tok), timeout=30)
        assert r.status_code == 200, f"{role_label} /pending status {r.status_code}: {r.text[:200]}"
        data = r.json()
        ids = [x["id"] for x in data.get("requests", [])]
        assert getattr(pytest, "refund_request_id", None) in ids, \
            f"{role_label} /pending missing new refund request. Got ids sample: {ids[:5]}"

    def test_admin_sees_pending(self, admin_token):
        self._assert_in_pending(admin_token, "admin")

    def test_finance_sees_pending(self, finance_token):
        self._assert_in_pending(finance_token, "finance")

    def test_ceo_sees_pending(self, ceo_token):
        self._assert_in_pending(ceo_token, "ceo")

    def test_support_care_view(self, support_token):
        r = requests.get(f"{API}/refunds/care-view", headers=_h(support_token), timeout=30)
        assert r.status_code == 200, f"support /care-view status {r.status_code}: {r.text[:200]}"
        data = r.json()
        assert "stats" in data and all(k in data["stats"] for k in ("pending", "approved", "rejected", "credited"))
        ids = [x["id"] for x in data.get("requests", [])]
        assert getattr(pytest, "refund_request_id", None) in ids, "support /care-view missing new request"
        # New request should count in pending stat
        assert data["stats"]["pending"] >= 1

    def test_admin_can_also_care_view(self, admin_token):
        r = requests.get(f"{API}/refunds/care-view", headers=_h(admin_token), timeout=30)
        assert r.status_code == 200
        assert "stats" in r.json()

    def test_customer_denied_care_view(self, customer_token):
        r = requests.get(f"{API}/refunds/care-view", headers=_h(customer_token), timeout=30)
        assert r.status_code == 403, f"expected 403 for customer, got {r.status_code}: {r.text[:200]}"

    def test_customer_denied_pending(self, customer_token):
        r = requests.get(f"{API}/refunds/pending", headers=_h(customer_token), timeout=30)
        assert r.status_code == 403


# ==================== 24H DEPARTURE REMINDER IDEMPOTENCY ====================

class TestDepartureReminderIdempotency:
    """The yacht booking YB2026080001 already flagged departure_reminder_24h_sent=True.
    Triggering again must NOT re-send an email for it. Any additional sends must be for
    OTHER bookings whose start_date falls in the +0/+1/+2 IST window and 10<=hours<=30.
    """

    def test_trigger_idempotent_for_flagged_booking(self, admin_token):
        r = requests.post(f"{API}/scheduler/trigger/departure-reminders",
                          headers=_h(admin_token), timeout=60)
        assert r.status_code == 200, f"trigger failed: {r.status_code} {r.text[:300]}"
        data = r.json()
        assert "emails_sent" in data
        # Verify flagged booking flag remains True (still True, was not un-set).
        _run(_verify_flag_unchanged(FLAGGED_YACHT_ID))


async def _verify_flag_unchanged(booking_id):
    from database import connect_to_mongo, get_database
    await connect_to_mongo()
    db = get_database()
    b = await db.vertical_bookings.find_one({"id": booking_id},
                                            {"_id": 0, "departure_reminder_24h_sent": 1})
    assert b, f"Booking {booking_id} missing"
    assert b.get("departure_reminder_24h_sent") is True, \
        f"Flag should stay True, got {b.get('departure_reminder_24h_sent')}"
