"""Backend tests for One Rupee Gateway Test (iteration 68).

Covers:
- Admin/staff can create ₹1 test order (200, correct response, gateway_tests row).
- Customer role 403 on create + verify.
- Unauthenticated 401/403.
- Fake signature verify returns 400 and DOES NOT mark record paid.
"""
import os
import sys
import asyncio
import pytest
import requests
from dotenv import dotenv_values

sys.path.insert(0, "/app/backend")

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")

ADMIN = {"email": "admin@airyatra.co.in", "password": "Admin123!"}
CUSTOMER = {"email": "customer@airyatra.co.in", "password": "Customer@123"}


async def _mint_otp_and_verify(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    if not data.get("otp_required"):
        return data["access_token"]
    from database import connect_to_mongo, get_database
    from services.otp_service import OTPService
    await connect_to_mongo()
    db = get_database()
    user = await db.users.find_one({"email": email})
    assert user, f"User {email} not found"
    await db.otp_codes.delete_many({"user_id": user["id"], "purpose": "login"})
    code, _rec = await OTPService().create_otp(user["id"], email, purpose="login",
                                               ip_address="127.0.0.1", user_agent="pytest")
    assert code, "Could not mint OTP"
    v = requests.post(f"{BASE_URL}/api/auth/login/verify-otp",
                      json={"email": email, "otp_code": code}, timeout=30)
    assert v.status_code == 200, f"OTP verify failed: {v.status_code} {v.text[:300]}"
    return v.json()["access_token"]


def _login(email, password):
    return asyncio.get_event_loop().run_until_complete(_mint_otp_and_verify(email, password))


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN["email"], ADMIN["password"])


@pytest.fixture(scope="module")
def customer_token():
    return _login(CUSTOMER["email"], CUSTOMER["password"])


class TestOneRupeeCreate:
    def test_unauth_create_forbidden(self):
        r = requests.post(f"{BASE_URL}/api/razorpay/one-rupee-test", timeout=15)
        assert r.status_code in (401, 403), f"Expected 401/403 unauth got {r.status_code}: {r.text[:200]}"

    def test_customer_create_forbidden(self, customer_token):
        r = requests.post(
            f"{BASE_URL}/api/razorpay/one-rupee-test",
            headers={"Authorization": f"Bearer {customer_token}"},
            timeout=15,
        )
        assert r.status_code == 403, f"Expected 403 for customer, got {r.status_code}: {r.text[:200]}"

    def test_admin_create_order(self, admin_token):
        r = requests.post(
            f"{BASE_URL}/api/razorpay/one-rupee-test",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=20,
        )
        assert r.status_code == 200, f"Admin create failed: {r.status_code} {r.text[:300]}"
        data = r.json()
        assert data.get("amount_paise") == 100
        assert data.get("currency") == "INR"
        assert data.get("order_id", "").startswith("order_"), f"Bad order_id: {data.get('order_id')}"
        assert data.get("key_id"), "Missing key_id"
        assert data.get("mode") in ("test", "live")
        # Persist for later verify test
        pytest.one_rupee_order_id = data["order_id"]


class TestOneRupeeVerify:
    def test_unauth_verify_forbidden(self):
        r = requests.post(
            f"{BASE_URL}/api/razorpay/one-rupee-test/verify",
            json={"razorpay_order_id": "order_x", "razorpay_payment_id": "pay_x", "razorpay_signature": "sig"},
            timeout=15,
        )
        assert r.status_code in (401, 403)

    def test_customer_verify_forbidden(self, customer_token):
        r = requests.post(
            f"{BASE_URL}/api/razorpay/one-rupee-test/verify",
            headers={"Authorization": f"Bearer {customer_token}"},
            json={"razorpay_order_id": "order_x", "razorpay_payment_id": "pay_x", "razorpay_signature": "sig"},
            timeout=15,
        )
        assert r.status_code == 403

    def test_admin_fake_signature_400(self, admin_token):
        order_id = getattr(pytest, "one_rupee_order_id", "order_TPkGIpc5YZftmR")
        r = requests.post(
            f"{BASE_URL}/api/razorpay/one-rupee-test/verify",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "razorpay_order_id": order_id,
                "razorpay_payment_id": "pay_fake123",
                "razorpay_signature": "invalid_signature_hex",
            },
            timeout=15,
        )
        assert r.status_code == 400, f"Expected 400 fake sig, got {r.status_code}: {r.text[:300]}"
        assert "Signature verification failed" in r.text

    def test_gateway_tests_record_not_marked_paid(self, admin_token):
        """After fake-sig verify, ensure the gateway_tests record stays 'created' (not 'paid')."""
        # Query via mongo directly
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient
        mongo_url = os.environ.get("MONGO_URL") or dotenv_values("/app/backend/.env").get("MONGO_URL")
        db_name = os.environ.get("DB_NAME") or dotenv_values("/app/backend/.env").get("DB_NAME")

        async def _check():
            client = AsyncIOMotorClient(mongo_url)
            db = client[db_name]
            order_id = getattr(pytest, "one_rupee_order_id", None)
            if not order_id:
                return None
            doc = await db.gateway_tests.find_one({"order_id": order_id})
            client.close()
            return doc

        doc = asyncio.get_event_loop().run_until_complete(_check())
        assert doc is not None, "gateway_tests record not persisted for created order"
        assert doc.get("status") == "created", f"Record wrongly marked paid: {doc.get('status')}"
        assert doc.get("amount") == 1
