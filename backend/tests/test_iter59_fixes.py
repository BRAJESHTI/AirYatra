"""Iteration 59: Verification of two fixes from iter58 audit.

FIX 1: POST /api/operator/submit-quote returns full breakdown.
FIX 2: GET /api/admin/pricing/invoice-email-log (admin only) returns {logs, total, sent}.
"""
import os
import time
import pytest
import requests
from datetime import datetime, timezone, timedelta
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@airyatra.co.in", "password": "Admin123!"}
OPERATOR = {"email": "operator@airyatra.co.in", "password": "Operator@123456"}
CUSTOMER = {"email": "customer@airyatra.co.in", "password": "Customer@123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"Login failed for {creds['email']}: {r.status_code} {r.text[:300]}")
    body = r.json()
    return body.get("access_token") or body.get("token")


@pytest.fixture(scope="module")
def tokens():
    t = {"admin": _login(ADMIN)}
    time.sleep(0.4)
    t["operator"] = _login(OPERATOR)
    time.sleep(0.4)
    t["customer"] = _login(CUSTOMER)
    return t


def H(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


class TestFix1_SubmitQuoteBreakdown:
    booking_id = None

    def test_create_custom_quote_booking(self, tokens):
        # Future date > 12h so urgency 0
        future_date = (datetime.now(timezone.utc) + timedelta(days=30)).date().isoformat()
        payload = {
            "from_location": "Mumbai", "to_location": "Pune",
            "trip_type": "one_way", "departure_date": future_date,
            "passengers": 2, "booking_type": "custom_quote",
            "special_requirements": "TEST_iter59_fix1",
        }
        r = requests.post(f"{API}/bookings/", headers=H(tokens["customer"]), json=payload, timeout=30)
        assert r.status_code in (200, 201), r.text[:400]
        booking = r.json().get("booking") or r.json()
        bid = booking.get("id") or booking.get("booking_id")
        assert bid, f"no booking id: {r.text[:300]}"
        TestFix1_SubmitQuoteBreakdown.booking_id = bid

    def test_submit_quote_returns_full_breakdown(self, tokens):
        bid = TestFix1_SubmitQuoteBreakdown.booking_id
        assert bid, "prerequisite: booking must exist"

        r = requests.post(
            f"{API}/operator/submit-quote",
            headers=H(tokens["operator"]),
            json={"booking_id": bid, "amount": 100000, "aircraft_id": "test-ac-iter59", "validity_hours": 24, "notes": "TEST_iter59"},
            timeout=30,
        )
        assert r.status_code == 200, f"submit-quote {r.status_code}: {r.text[:400]}"
        body = r.json()

        # Check required fields are present in response
        required = ["operator_payout", "platform_fee", "platform_fee_rule", "urgency_percent", "urgency_surcharge", "customer_total"]
        missing = [k for k in required if k not in body]
        assert not missing, f"submit-quote response missing keys {missing}. Got keys: {list(body.keys())}"

        # Value assertions
        assert body["operator_payout"] == 100000, body
        # global default 15%, no route rule for Mumbai-Pune expected (unless iter57 created one - handle both)
        assert body["platform_fee"] in (10000, 15000), f"platform_fee unexpected: {body['platform_fee']}"
        # urgency 0 since departure is 30 days out
        assert body["urgency_percent"] == 0, f"expected urgency 0 (>12h out), got {body['urgency_percent']}"
        assert body["urgency_surcharge"] == 0, body
        # math check
        expected_total = body["operator_payout"] + body["platform_fee"] + body["urgency_surcharge"]
        assert abs(body["customer_total"] - expected_total) < 0.01, f"math wrong: {body}"


class TestFix2_InvoiceEmailLog:
    def test_admin_can_get_invoice_email_log(self, tokens):
        r = requests.get(f"{API}/admin/pricing/invoice-email-log", headers=H(tokens["admin"]), timeout=15)
        assert r.status_code == 200, f"admin got {r.status_code}: {r.text[:300]}"
        data = r.json()
        for key in ("logs", "total", "sent"):
            assert key in data, f"missing key '{key}' in response: {list(data.keys())}"
        assert isinstance(data["logs"], list), data
        assert isinstance(data["total"], int), data
        assert isinstance(data["sent"], int), data
        # If any logs exist, each should have booking_id/status keys
        if data["logs"]:
            entry = data["logs"][0]
            has_key = any(k in entry for k in ("booking_id", "status", "email", "recipient"))
            assert has_key, f"log entry has none of the expected keys: {entry}"

    def test_customer_forbidden(self, tokens):
        r = requests.get(f"{API}/admin/pricing/invoice-email-log", headers=H(tokens["customer"]), timeout=15)
        assert r.status_code == 403, f"customer expected 403, got {r.status_code}: {r.text[:200]}"


@pytest.fixture(scope="module", autouse=True)
def cleanup(tokens):
    yield
    bid = TestFix1_SubmitQuoteBreakdown.booking_id
    if bid:
        try:
            requests.delete(f"{API}/bookings/{bid}", headers=H(tokens["customer"]), timeout=10)
        except Exception:
            pass
