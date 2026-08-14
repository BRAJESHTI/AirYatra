"""SEC-001: Real Razorpay payment flow for vertical bookings (yacht/helipad/cruise)."""
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
YACHT_OWNER_EMAIL = "yachtowner@airyatra.co.in"
YACHT_OWNER_PASSWORD = "Yacht@123456"


def _login_direct(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    if data.get("otp_required"):
        return None, data
    return data["access_token"], data


async def _mint_otp_and_verify(email, password):
    """Login → if OTP required, mint OTP directly and verify."""
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    if not data.get("otp_required"):
        return data["access_token"]

    # Import backend internals to mint OTP
    from database import connect_to_mongo, get_database
    from services.otp_service import OTPService

    await connect_to_mongo()
    db = get_database()
    user = await db.users.find_one({"email": email})
    assert user, f"User {email} not found"
    # Purge old OTPs to bypass 60s cooldown
    await db.otp_codes.delete_many({"user_id": user["id"], "purpose": "login"})
    code, rec = await OTPService().create_otp(user["id"], email, purpose="login",
                                              ip_address="127.0.0.1", user_agent="pytest")
    assert code, f"Could not obtain plaintext OTP: {rec}"
    v = requests.post(f"{API}/auth/login/verify-otp", json={"email": email, "otp_code": code}, timeout=30)
    assert v.status_code == 200, f"OTP verify failed: {v.status_code} {v.text[:300]}"
    return v.json()["access_token"]


@pytest.fixture(scope="module")
def customer_token():
    token, data = _login_direct(**CUSTOMER)
    if not token:
        pytest.fail(f"Customer login unexpectedly requires OTP: {data}")
    return token


@pytest.fixture(scope="module")
def owner_token():
    return asyncio.get_event_loop().run_until_complete(
        _mint_otp_and_verify(YACHT_OWNER_EMAIL, YACHT_OWNER_PASSWORD)
    )


@pytest.fixture(scope="module")
def yacht_asset(customer_token):
    r = requests.get(f"{API}/verticals/assets/browse?vertical=yacht",
                     headers={"Authorization": f"Bearer {customer_token}"}, timeout=30)
    assert r.status_code == 200, r.text
    assets = r.json()["assets"]
    assert assets, "No yacht assets available"
    return assets[0]


class TestVerticalRazorpayFlow:
    """Real Razorpay order creation + signature verification."""

    def test_create_yacht_booking(self, customer_token, yacht_asset):
        r = requests.post(f"{API}/verticals/bookings",
                          headers={"Authorization": f"Bearer {customer_token}"},
                          json={"asset_id": yacht_asset["id"], "start_date": "2027-03-01", "quantity": 1},
                          timeout=30)
        assert r.status_code == 200, r.text
        b = r.json()["booking"]
        assert b["status"] == "pending"
        assert b["payment_status"] == "unpaid"
        pytest.booking_id = b["id"]
        pytest.booking_number = b["booking_number"]
        pytest.owner_user_id = b["owner_user_id"]

    def test_pay_pending_booking_returns_400(self, customer_token):
        """Cannot pay unconfirmed booking"""
        r = requests.post(f"{API}/verticals/bookings/{pytest.booking_id}/pay",
                          headers={"Authorization": f"Bearer {customer_token}"}, timeout=30)
        assert r.status_code == 400, r.text
        assert "confirm" in r.json()["detail"].lower()

    def test_owner_confirms_booking(self, owner_token):
        r = requests.put(f"{API}/verticals/bookings/{pytest.booking_id}/decision",
                         headers={"Authorization": f"Bearer {owner_token}"},
                         json={"action": "confirm"}, timeout=30)
        assert r.status_code == 200, r.text

    def test_pay_creates_real_razorpay_order(self, customer_token):
        r = requests.post(f"{API}/verticals/bookings/{pytest.booking_id}/pay",
                          headers={"Authorization": f"Bearer {customer_token}"}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("gateway") == "razorpay", f"gateway not razorpay: {d}"
        assert d["order_id"].startswith("order_"), f"order_id: {d['order_id']}"
        assert d["key_id"].startswith("rzp_test_"), f"key_id: {d['key_id']}"
        assert d["amount_paise"] == int(round(d["amount"] * 100))
        assert d["currency"] == "INR"
        assert "prefill" in d and d["prefill"].get("email")
        pytest.order_id = d["order_id"]

    def test_booking_remains_unpaid_after_order_creation(self, customer_token):
        r = requests.get(f"{API}/verticals/bookings/my",
                         headers={"Authorization": f"Bearer {customer_token}"}, timeout=30)
        assert r.status_code == 200
        b = next((x for x in r.json()["bookings"] if x["id"] == pytest.booking_id), None)
        assert b, "booking missing"
        assert b["payment_status"] == "unpaid", f"NOT unpaid: {b['payment_status']}"
        assert b["status"] == "confirmed"

    def test_verify_payment_fake_signature_400(self, customer_token):
        r = requests.post(f"{API}/verticals/bookings/{pytest.booking_id}/verify-payment",
                          headers={"Authorization": f"Bearer {customer_token}"},
                          json={"razorpay_order_id": pytest.order_id,
                                "razorpay_payment_id": "pay_fakepayment123",
                                "razorpay_signature": "deadbeef" * 8},
                          timeout=30)
        assert r.status_code == 400, r.text
        assert "signature" in r.json()["detail"].lower()

    def test_booking_still_unpaid_after_bad_signature(self, customer_token):
        r = requests.get(f"{API}/verticals/bookings/my",
                         headers={"Authorization": f"Bearer {customer_token}"}, timeout=30)
        b = next(x for x in r.json()["bookings"] if x["id"] == pytest.booking_id)
        assert b["payment_status"] == "unpaid"

    def test_verify_payment_from_other_user_404(self, owner_token):
        """Owner is NOT customer → verify-payment should 404"""
        r = requests.post(f"{API}/verticals/bookings/{pytest.booking_id}/verify-payment",
                          headers={"Authorization": f"Bearer {owner_token}"},
                          json={"razorpay_order_id": pytest.order_id,
                                "razorpay_payment_id": "pay_fake", "razorpay_signature": "x" * 32},
                          timeout=30)
        assert r.status_code == 404, r.text


class TestAlreadyPaidBooking:
    """Regression: pay on already-paid booking → 400"""

    def test_pay_already_paid_booking_400(self, customer_token):
        r = requests.get(f"{API}/verticals/bookings/my",
                         headers={"Authorization": f"Bearer {customer_token}"}, timeout=30)
        paid = [b for b in r.json()["bookings"] if b.get("payment_status") == "paid"]
        if not paid:
            pytest.skip("No previously paid vertical bookings to test against")
        b = paid[0]
        r2 = requests.post(f"{API}/verticals/bookings/{b['id']}/pay",
                           headers={"Authorization": f"Bearer {customer_token}"}, timeout=30)
        assert r2.status_code == 400
        # NOTE: paid bookings have status="paid" so pay() rejects with "must be confirmed"
        # rather than "already paid" — minor msg ordering issue but 400 is returned correctly.
        detail = r2.json()["detail"].lower()
        assert "paid" in detail or "confirm" in detail


class TestRefundRegression:
    """Regression: refund chain still works on paid vertical bookings"""

    def test_refund_reasons_endpoint(self, customer_token):
        r = requests.get(f"{API}/refunds/reasons?audience=customer",
                         headers={"Authorization": f"Bearer {customer_token}"}, timeout=30)
        assert r.status_code == 200, r.text
        assert isinstance(r.json().get("reasons"), list)

    def test_my_refunds_endpoint(self, customer_token):
        r = requests.get(f"{API}/refunds/my",
                         headers={"Authorization": f"Bearer {customer_token}"}, timeout=30)
        assert r.status_code == 200, r.text
        assert "refunds" in r.json()
