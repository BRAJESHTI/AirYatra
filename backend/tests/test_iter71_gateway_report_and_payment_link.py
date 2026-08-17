"""Iter-71 tests: Gateway Test Report + Cashfree Payment Link + regression."""
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
ADMIN = {"email": "admin@airyatra.co.in", "password": "Admin123!"}


def _login_direct(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    if d.get("otp_required"):
        return None, d
    return d["access_token"], d


async def _mint_otp_and_verify(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    d = r.json()
    if not d.get("otp_required"):
        return d["access_token"]
    from database import connect_to_mongo, get_database
    from services.otp_service import OTPService
    await connect_to_mongo()
    db = get_database()
    user = await db.users.find_one({"email": email})
    await db.otp_codes.delete_many({"user_id": user["id"], "purpose": "login"})
    code, _ = await OTPService().create_otp(user["id"], email, purpose="login",
                                            ip_address="127.0.0.1", user_agent="pytest")
    v = requests.post(f"{API}/auth/login/verify-otp",
                     json={"email": email, "otp_code": code}, timeout=30)
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


@pytest.fixture(scope="module")
def customer_token():
    tok, d = _login_direct(**CUSTOMER)
    assert tok, d
    return tok


@pytest.fixture(scope="module")
def admin_token():
    return _run(_mint_otp_and_verify(ADMIN["email"], ADMIN["password"]))


@pytest.fixture(scope="module")
def confirmed_booking(customer_token):
    r = requests.get(f"{API}/verticals/bookings/my",
                     headers={"Authorization": f"Bearer {customer_token}"}, timeout=30)
    assert r.status_code == 200, r.text
    for b in r.json().get("bookings", []):
        if b.get("status") == "confirmed" and b.get("payment_status") in ("unpaid", None):
            return b
    pytest.skip("no confirmed unpaid vertical booking available")


# ==================== GATEWAY TEST REPORT ====================
class TestGatewayReport:
    def test_admin_gets_report(self, admin_token):
        r = requests.get(f"{API}/payments/cashfree/test-report",
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "rows" in d and isinstance(d["rows"], list)
        assert "summary" in d
        assert set(d["summary"].keys()) >= {"razorpay", "cashfree"}
        for gw in ("razorpay", "cashfree"):
            s = d["summary"][gw]
            assert set(s.keys()) >= {"total", "pass", "fail", "pending", "verdict", "mode"}
            assert s["total"] == s["pass"] + s["fail"] + s["pending"]
            assert s["verdict"] in ("PASS", "FAIL", "PENDING")

        # Row structure validation
        for row in d["rows"]:
            assert row.get("gateway") in ("razorpay", "cashfree")
            assert row.get("verdict") in ("PASS", "FAIL", "PENDING")
            amt = row.get("amount")
            if amt is not None:
                assert amt <= 50, f"row amount not ≤ 50: {row}"
            assert "order_id" in row

    def test_customer_forbidden(self, customer_token):
        r = requests.get(f"{API}/payments/cashfree/test-report",
                         headers={"Authorization": f"Bearer {customer_token}"}, timeout=30)
        assert r.status_code == 403, r.text

    def test_unauthenticated_401(self):
        r = requests.get(f"{API}/payments/cashfree/test-report", timeout=30)
        assert r.status_code in (401, 403), r.text


# ==================== PAYMENT LINK ====================
class TestPaymentLink:
    def test_payment_link_returns_400_feature_not_enabled(self, customer_token, confirmed_booking):
        """Merchant does not have link_creation_api enabled → 400 with clear error;
        NO record should be inserted into db.cashfree_orders for failed link creation."""
        # Snapshot count of link_created records BEFORE
        async def count_before():
            from database import connect_to_mongo, get_database
            await connect_to_mongo()
            db = get_database()
            return await db.cashfree_orders.count_documents({"channel": "payment_link"})
        before = _run(count_before())

        r = requests.post(f"{API}/payments/cashfree/payment-link",
                          headers={"Authorization": f"Bearer {customer_token}"},
                          json={"booking_id": confirmed_booking["id"]}, timeout=45)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:400]}"
        detail = (r.json().get("detail") or "").lower()
        assert "link_creation_api" in detail or "not enabled" in detail or \
               "feature_not_enabled" in detail, f"unexpected detail: {detail}"

        # Verify NO row inserted
        after = _run(count_before())
        assert after == before, f"Expected no new cashfree_orders row for failed link creation; before={before} after={after}"

    def test_payment_link_missing_booking_404(self, customer_token):
        r = requests.post(f"{API}/payments/cashfree/payment-link",
                          headers={"Authorization": f"Bearer {customer_token}"},
                          json={"booking_id": "nonexistent-id-1234"}, timeout=30)
        assert r.status_code == 404, r.text

    def test_payment_link_unauthenticated(self, confirmed_booking):
        r = requests.post(f"{API}/payments/cashfree/payment-link",
                          json={"booking_id": confirmed_booking["id"]}, timeout=30)
        assert r.status_code in (401, 403), r.text
