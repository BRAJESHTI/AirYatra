"""
Tests for payment gateway selection: GET /api/payments/gateways, wallet apply, razorpay guard.
Iteration 49.
"""
import os
import uuid
from datetime import datetime, timezone

import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")

backend_env = dotenv_values("/app/backend/.env")
MONGO_URL = backend_env.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = backend_env.get("DB_NAME", "airyatra_db")

CUSTOMER = {"email": "customer@airyatra.co.in", "password": "Customer@123"}
CUSTOMER2 = {"email": "loyaltytest@airyatra.co.in", "password": "Loyalty@123"}
ADMIN = {"email": "admin@airyatra.co.in", "password": "Admin123!"}


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login {creds['email']} failed: {r.status_code} {r.text[:200]}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def customer_token():
    return _login(CUSTOMER)


@pytest.fixture(scope="module")
def customer2_token():
    return _login(CUSTOMER2)


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def customer_user(customer_token):
    r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {customer_token}"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


# ----- Gateways listing -----
class TestGatewaysList:
    def test_gateways_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/payments/gateways", timeout=10)
        assert r.status_code in (401, 403)

    def test_gateways_customer(self, customer_token):
        r = requests.get(f"{BASE_URL}/api/payments/gateways",
                         headers={"Authorization": f"Bearer {customer_token}"}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "gateways" in data
        gws = {g["id"]: g for g in data["gateways"]}
        # All 5 expected
        for gid in ["razorpay", "stripe", "cashfree", "paypal", "wallet"]:
            assert gid in gws, f"missing gateway {gid}"

        # Stripe always enabled + badge
        assert gws["stripe"]["enabled"] is True
        assert gws["stripe"].get("badge") == "Test Mode"

        # Wallet always enabled + balance field
        assert gws["wallet"]["enabled"] is True
        assert "balance" in gws["wallet"]

        # cashfree/paypal disabled (no keys per .env)
        assert gws["cashfree"]["enabled"] is False
        assert gws["paypal"]["enabled"] is False

        # razorpay: reflects env keys presence
        expected_rzp_enabled = bool(os.environ.get("RAZORPAY_KEY_ID")) or bool(backend_env.get("RAZORPAY_KEY_ID"))
        assert gws["razorpay"]["enabled"] == expected_rzp_enabled


# ----- Wallet apply -----
class TestWalletApply:
    def _seed_booking(self, customer_id, amount=5000.0):
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        bid = f"TEST-WALLET-{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).isoformat()
        db.inquiries.insert_one({
            "id": bid,
            "customer_id": customer_id,
            "from_location": "Mumbai",
            "to_location": "Pune",
            "estimated_price": amount,
            "accepted_quote": {"amount": amount},
            "status": "quote_accepted",
            "payment_status": "unpaid",
            "booking_purpose": "other",
            "created_at": now,
            "updated_at": now,
            "_test": True,
        })
        client.close()
        return bid

    def _cleanup(self, customer_id, booking_ids):
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        db.inquiries.delete_many({"id": {"$in": booking_ids}})
        db.payment_transactions.delete_many({"booking_id": {"$in": booking_ids}})
        db.wallet_transactions.delete_many({"booking_id": {"$in": booking_ids}})
        db.wallets.delete_one({"user_id": customer_id, "_test": True})
        client.close()

    def _set_wallet(self, customer_id, balance):
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        db.wallets.update_one(
            {"user_id": customer_id},
            {"$set": {"user_id": customer_id, "balance": balance, "_test": True}},
            upsert=True,
        )
        client.close()

    def test_wallet_apply_404_invalid_booking(self, customer_token):
        r = requests.post(f"{BASE_URL}/api/payments/wallet/apply",
                          headers={"Authorization": f"Bearer {customer_token}"},
                          json={"booking_id": "does-not-exist-xxx"}, timeout=15)
        assert r.status_code == 404

    def test_wallet_apply_403_other_user(self, customer_token, customer2_token, customer_user):
        bid = self._seed_booking(customer_user["id"], 5000.0)
        try:
            r = requests.post(f"{BASE_URL}/api/payments/wallet/apply",
                              headers={"Authorization": f"Bearer {customer2_token}"},
                              json={"booking_id": bid}, timeout=15)
            assert r.status_code == 403, r.text
        finally:
            self._cleanup(customer_user["id"], [bid])

    def test_wallet_apply_400_no_balance(self, customer_token, customer_user):
        self._set_wallet(customer_user["id"], 0.0)
        bid = self._seed_booking(customer_user["id"], 5000.0)
        try:
            r = requests.post(f"{BASE_URL}/api/payments/wallet/apply",
                              headers={"Authorization": f"Bearer {customer_token}"},
                              json={"booking_id": bid}, timeout=15)
            assert r.status_code == 400, r.text
            assert "wallet" in r.text.lower() or "balance" in r.text.lower()
        finally:
            self._cleanup(customer_user["id"], [bid])

    def test_wallet_apply_success(self, customer_token, customer_user):
        self._set_wallet(customer_user["id"], 5000.0)
        bid = self._seed_booking(customer_user["id"], 5000.0)
        try:
            r = requests.post(f"{BASE_URL}/api/payments/wallet/apply",
                              headers={"Authorization": f"Bearer {customer_token}"},
                              json={"booking_id": bid}, timeout=15)
            assert r.status_code == 200, r.text
            data = r.json()
            assert data.get("success") is True
            assert data.get("applied") == 5000.0
            assert data.get("remaining_due") == 0.0
            assert data.get("fully_paid") is True
            client = MongoClient(MONGO_URL)
            db = client[DB_NAME]
            txn = db.payment_transactions.find_one({"booking_id": bid, "gateway": "wallet"}, {"_id": 0})
            assert txn is not None
            assert txn.get("payment_status") == "paid"
            assert txn.get("amount") == 5000.0
            w = db.wallets.find_one({"user_id": customer_user["id"]}, {"_id": 0})
            assert w and w.get("balance") == 0.0
            client.close()
        finally:
            self._cleanup(customer_user["id"], [bid])


# ----- Razorpay guard -----
class TestRazorpayGuard:
    def test_razorpay_create_order(self, customer_token):
        # Whether keys are configured or not, endpoint should not 5xx blank.
        # If no keys: 500 'Razorpay not configured'
        # If keys set: 404 (booking not found) since we pass fake booking_id
        r = requests.post(f"{BASE_URL}/api/razorpay/create-order",
                          headers={"Authorization": f"Bearer {customer_token}"},
                          json={
                              "booking_id": "does-not-exist-xxx",
                              "customer_name": "T", "customer_email": "t@t.co", "customer_phone": "9999999999"
                          }, timeout=15)
        assert r.status_code in (404, 500), r.text
        if r.status_code == 500:
            assert "not configured" in r.text.lower() or "razorpay" in r.text.lower()

    def test_razorpay_create_order_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/razorpay/create-order",
                          json={"booking_id": "x", "customer_name": "T",
                                "customer_email": "t@t.co", "customer_phone": "9999999999"},
                          timeout=15)
        assert r.status_code in (401, 403)
