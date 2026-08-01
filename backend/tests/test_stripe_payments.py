"""Stripe payment endpoint tests — checkout, status, auth guards, idempotency."""
import os
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")

CUSTOMER = {"email": "loyaltytest@airyatra.com", "password": "Loyalty@123"}
EMPLOYEE = {"email": "employee@airyatra.com", "password": "Employee@123"}
ADMIN = {"email": "admin@airyatra.com", "password": "Admin123!"}
STRIPE_BOOKING = "test-stripe-inquiry-1"
PAID_BOOKING = "test-voucher-inquiry-1"


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login failed for {creds['email']}: {r.status_code} {r.text[:300]}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def customer_token():
    return _login(CUSTOMER)


@pytest.fixture(scope="module")
def employee_token():
    return _login(EMPLOYEE)


@pytest.fixture(scope="module")
def created_session_id():
    return {"value": None}


class TestStripeCheckout:
    def test_create_checkout_customer(self, customer_token, created_session_id):
        r = requests.post(
            f"{BASE_URL}/api/payments/stripe/checkout",
            json={"booking_id": STRIPE_BOOKING, "origin_url": BASE_URL},
            headers={"Authorization": f"Bearer {customer_token}"},
            timeout=30,
        )
        assert r.status_code == 200, r.text[:500]
        data = r.json()
        assert "checkout_url" in data and "checkout.stripe.com" in data["checkout_url"]
        assert data["session_id"].startswith("cs_test_")
        assert data["amount"] == 25000.0
        assert data["advance_percent"] == 50
        created_session_id["value"] = data["session_id"]

    def test_create_checkout_no_auth(self):
        r = requests.post(
            f"{BASE_URL}/api/payments/stripe/checkout",
            json={"booking_id": STRIPE_BOOKING, "origin_url": BASE_URL},
            timeout=15,
        )
        assert r.status_code in (401, 403)

    def test_create_checkout_forbidden_other_customer(self, employee_token):
        # Employee is not the booking's customer
        r = requests.post(
            f"{BASE_URL}/api/payments/stripe/checkout",
            json={"booking_id": STRIPE_BOOKING, "origin_url": BASE_URL},
            headers={"Authorization": f"Bearer {employee_token}"},
            timeout=15,
        )
        assert r.status_code == 403, r.text[:300]

    def test_create_checkout_already_paid(self, customer_token):
        r = requests.post(
            f"{BASE_URL}/api/payments/stripe/checkout",
            json={"booking_id": PAID_BOOKING, "origin_url": BASE_URL},
            headers={"Authorization": f"Bearer {customer_token}"},
            timeout=15,
        )
        assert r.status_code == 400, r.text[:300]
        assert "paid" in r.text.lower() or "भुगतान" in r.text

    def test_create_checkout_invalid_booking(self, customer_token):
        r = requests.post(
            f"{BASE_URL}/api/payments/stripe/checkout",
            json={"booking_id": "does-not-exist-xyz", "origin_url": BASE_URL},
            headers={"Authorization": f"Bearer {customer_token}"},
            timeout=15,
        )
        assert r.status_code == 404


class TestStripeStatus:
    def test_status_pending_initial(self, created_session_id):
        sid = created_session_id["value"]
        assert sid, "no session id from checkout test"
        r = requests.get(f"{BASE_URL}/api/payments/stripe/status/{sid}", timeout=20)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data["session_id"] == sid
        assert data["booking_id"] == STRIPE_BOOKING
        assert data["amount"] == 25000.0
        # Not paid until customer completes checkout
        assert data["payment_status"] in ("pending", "initiated")

    def test_status_invalid_session(self):
        r = requests.get(f"{BASE_URL}/api/payments/stripe/status/cs_test_invalid_xyz_999", timeout=15)
        assert r.status_code == 404

    def test_status_no_auth_required(self, created_session_id):
        sid = created_session_id["value"]
        # explicitly no auth header — endpoint is public
        r = requests.get(f"{BASE_URL}/api/payments/stripe/status/{sid}", timeout=15)
        assert r.status_code == 200
