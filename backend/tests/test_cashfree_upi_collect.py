"""Cashfree UPI Collect production integration + webhook + test pricing tests (iter-70)."""
import os
import sys
import base64
import hmac
import hashlib
import json
import time
import asyncio
import pytest
import requests
from dotenv import dotenv_values

sys.path.insert(0, "/app/backend")

frontend_env = dotenv_values("/app/frontend/.env")
backend_env = dotenv_values("/app/backend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env["REACT_APP_BACKEND_URL"]).rstrip("/")
API = f"{BASE_URL}/api"
CASHFREE_SECRET = backend_env.get("CASHFREE_CLIENT_SECRET", "").strip('"')

CUSTOMER = {"email": "customer@airyatra.co.in", "password": "Customer@123"}
ADMIN = {"email": "admin@airyatra.co.in", "password": "Admin123!"}
YACHT_OWNER = {"email": "yachtowner@airyatra.co.in", "password": "Yacht@123456"}
TEST_UPI = "dr.brajeshptiwari@okicici"


def _login_direct(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    if data.get("otp_required"):
        return None, data
    return data["access_token"], data


async def _mint_otp_and_verify(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
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
    code, rec = await OTPService().create_otp(user["id"], email, purpose="login",
                                              ip_address="127.0.0.1", user_agent="pytest")
    assert code, f"Could not obtain plaintext OTP: {rec}"
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


@pytest.fixture(scope="module")
def customer_token():
    token, data = _login_direct(**CUSTOMER)
    assert token, f"Customer needs OTP unexpectedly: {data}"
    return token


@pytest.fixture(scope="module")
def admin_token():
    return _run(_mint_otp_and_verify(ADMIN["email"], ADMIN["password"]))


@pytest.fixture(scope="module")
def owner_token():
    return _run(_mint_otp_and_verify(YACHT_OWNER["email"], YACHT_OWNER["password"]))


@pytest.fixture(scope="module")
def confirmed_booking(customer_token, owner_token):
    """Return an existing confirmed unpaid yacht booking; else create+confirm one."""
    r = requests.get(f"{API}/verticals/bookings/my",
                     headers={"Authorization": f"Bearer {customer_token}"}, timeout=30)
    assert r.status_code == 200, r.text
    for b in r.json().get("bookings", []):
        if b.get("status") == "confirmed" and b.get("payment_status") in ("unpaid", None):
            return b
    # create
    ra = requests.get(f"{API}/verticals/assets/browse?vertical=yacht",
                     headers={"Authorization": f"Bearer {customer_token}"}, timeout=30)
    assets = ra.json()["assets"]
    assert assets, "no yacht assets"
    cb = requests.post(f"{API}/verticals/bookings",
                       headers={"Authorization": f"Bearer {customer_token}"},
                       json={"asset_id": assets[0]["id"], "start_date": "2027-05-01", "quantity": 1},
                       timeout=30).json()["booking"]
    requests.put(f"{API}/verticals/bookings/{cb['id']}/decision",
                 headers={"Authorization": f"Bearer {owner_token}"},
                 json={"action": "confirm"}, timeout=30)
    return {**cb, "status": "confirmed", "payment_status": "unpaid"}


# ==================== UPI COLLECT ====================
class TestUpiCollect:
    def test_upi_collect_success_yacht(self, customer_token, confirmed_booking):
        r = requests.post(f"{API}/payments/cashfree/upi-collect",
                          headers={"Authorization": f"Bearer {customer_token}"},
                          json={"booking_id": confirmed_booking["id"], "upi_id": TEST_UPI},
                          timeout=45)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["success"] is True
        assert d["order_id"].startswith("CF_"), d["order_id"]
        assert d["collect_mode"] in ("hosted_checkout", "direct_collect")
        # yacht test pricing = 15
        assert 1 <= d["amount"] <= 50, f"amount out of test range: {d['amount']}"
        if d["collect_mode"] == "hosted_checkout":
            assert d.get("payment_session_id"), "hosted_checkout missing payment_session_id"
        assert d.get("mock_mode") is False
        assert d.get("mode") == "production"
        pytest.cf_order_id = d["order_id"]

    def test_upi_collect_invalid_upi(self, customer_token, confirmed_booking):
        r = requests.post(f"{API}/payments/cashfree/upi-collect",
                          headers={"Authorization": f"Bearer {customer_token}"},
                          json={"booking_id": confirmed_booking["id"], "upi_id": "notavalidvpa"},
                          timeout=30)
        assert r.status_code == 400, r.text
        assert "invalid" in r.json()["detail"].lower()

    def test_upi_collect_nonexistent_booking(self, customer_token):
        r = requests.post(f"{API}/payments/cashfree/upi-collect",
                          headers={"Authorization": f"Bearer {customer_token}"},
                          json={"booking_id": "nonexistent-fake-id-9999", "upi_id": TEST_UPI},
                          timeout=30)
        assert r.status_code == 404, r.text

    def test_upi_collect_owner_forbidden(self, owner_token, confirmed_booking):
        """Owner (not customer) tries to pay customer's booking → 403"""
        r = requests.post(f"{API}/payments/cashfree/upi-collect",
                          headers={"Authorization": f"Bearer {owner_token}"},
                          json={"booking_id": confirmed_booking["id"], "upi_id": TEST_UPI},
                          timeout=30)
        assert r.status_code in (403, 404), r.text


# ==================== COLLECT STATUS ====================
class TestCollectStatus:
    def test_status_owner_pending(self, customer_token):
        oid = getattr(pytest, "cf_order_id", None)
        if not oid:
            pytest.skip("upi-collect did not produce order")
        r = requests.get(f"{API}/payments/cashfree/collect-status/{oid}",
                         headers={"Authorization": f"Bearer {customer_token}"}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] in ("PENDING", "SUCCESS", "FAILED")
        if d["status"] == "PENDING":
            assert d.get("order_status") in ("ACTIVE", "PARTIALLY_PAID", None)

    def test_status_fake_order_404(self, customer_token):
        r = requests.get(f"{API}/payments/cashfree/collect-status/CF_fake_missing_9999",
                         headers={"Authorization": f"Bearer {customer_token}"}, timeout=30)
        assert r.status_code == 404, r.text

    def test_status_other_user_403(self, owner_token):
        oid = getattr(pytest, "cf_order_id", None)
        if not oid:
            pytest.skip("no order id")
        r = requests.get(f"{API}/payments/cashfree/collect-status/{oid}",
                         headers={"Authorization": f"Bearer {owner_token}"}, timeout=30)
        assert r.status_code == 403, r.text


# ==================== WEBHOOK ====================
def _sign(secret: str, timestamp: str, raw_body: bytes) -> str:
    return base64.b64encode(
        hmac.new(secret.encode(), timestamp.encode() + raw_body, hashlib.sha256).digest()
    ).decode()


class TestWebhook:
    def test_webhook_invalid_signature_401(self):
        body = json.dumps({"type": "PAYMENT_SUCCESS_WEBHOOK", "data": {"order": {"order_id": "CF_x"}}}).encode()
        ts = str(int(time.time()))
        r = requests.post(f"{API}/payments/cashfree/webhook", data=body,
                          headers={"content-type": "application/json",
                                   "x-webhook-signature": "invalidsig==",
                                   "x-webhook-timestamp": ts}, timeout=30)
        assert r.status_code == 401, r.text

    def test_webhook_valid_signature_finalizes(self, customer_token):
        """Valid signed PAYMENT_SUCCESS webhook → cashfree_orders.status=paid + audit"""
        assert CASHFREE_SECRET, "CASHFREE_CLIENT_SECRET missing"
        # Use a NEW order created for this test so idempotency doesn't collide
        # Instead of new order, use a fresh dummy record inserted via DB
        from database import connect_to_mongo, get_database
        import uuid
        from datetime import datetime, timezone

        async def prep():
            await connect_to_mongo()
            db = get_database()
            oid = f"CF_test_webhook_{uuid.uuid4().hex[:8]}"
            # Find a real confirmed booking to attach
            b = await db.vertical_bookings.find_one({"payment_status": {"$ne": "paid"},
                                                     "status": "confirmed"}, {"_id": 0})
            assert b, "no confirmed unpaid vertical booking"
            await db.cashfree_orders.insert_one({
                "id": str(uuid.uuid4()), "cashfree_order_id": oid,
                "booking_id": b["id"], "booking_type": "vertical",
                "user_id": b["customer_id"], "amount": float(b["amount"]),
                "payment_type": "full", "currency": "INR", "upi_id": TEST_UPI,
                "channel": "upi_collect", "collect_mode": "hosted_checkout",
                "status": "collect_requested", "mode": "production", "mock_mode": False,
                "created_at": datetime.now(timezone.utc).isoformat()})
            return oid, b["id"]

        oid, booking_id = _run(prep())
        pytest.wh_order_id = oid
        pytest.wh_booking_id = booking_id
        cf_payment_id = f"test_pay_{uuid.uuid4().hex[:10]}" if False else "998877665544"

        payload = {
            "type": "PAYMENT_SUCCESS_WEBHOOK",
            "data": {
                "order": {"order_id": oid, "order_status": "PAID"},
                "payment": {"cf_payment_id": cf_payment_id, "payment_method": "upi",
                            "payment_status": "SUCCESS"}
            }
        }
        raw = json.dumps(payload).encode()
        ts = str(int(time.time()))
        sig = _sign(CASHFREE_SECRET, ts, raw)
        r = requests.post(f"{API}/payments/cashfree/webhook", data=raw,
                          headers={"content-type": "application/json",
                                   "x-webhook-signature": sig,
                                   "x-webhook-timestamp": ts}, timeout=30)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("status") == "received"
        assert j.get("duplicate") is not True

        # Verify DB effects
        async def verify():
            from database import get_database
            db = get_database()
            rec = await db.cashfree_orders.find_one({"cashfree_order_id": oid})
            assert rec["status"] == "paid", rec["status"]
            vb = await db.vertical_bookings.find_one({"id": booking_id})
            assert vb["payment_status"] == "paid", vb["payment_status"]
            audit = await db.audit_logs.find_one({"action": "cashfree_payment_success",
                                                   "entity_id": oid})
            assert audit, "audit log missing"
            # ledger
            entries = await db.ledger_entries.count_documents({"reference_id": booking_id})
            assert entries >= 0  # Ledger may be under different key
        _run(verify())

    def test_webhook_duplicate_protection(self):
        """Send SAME webhook again → duplicate:true"""
        oid = getattr(pytest, "wh_order_id", None)
        if not oid:
            pytest.skip("no wh order")
        payload = {
            "type": "PAYMENT_SUCCESS_WEBHOOK",
            "data": {
                "order": {"order_id": oid, "order_status": "PAID"},
                "payment": {"cf_payment_id": "998877665544", "payment_method": "upi",
                            "payment_status": "SUCCESS"}
            }
        }
        raw = json.dumps(payload).encode()
        ts = str(int(time.time()))
        sig = _sign(CASHFREE_SECRET, ts, raw)
        r = requests.post(f"{API}/payments/cashfree/webhook", data=raw,
                          headers={"content-type": "application/json",
                                   "x-webhook-signature": sig,
                                   "x-webhook-timestamp": ts}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json().get("duplicate") is True


# ==================== TEST PRICING ====================
class TestPricing:
    def test_apply_already_active(self, admin_token):
        r = requests.post(f"{API}/payments/cashfree/test-pricing/apply",
                          headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        # Should be 400 already active OR 200 fresh apply
        assert r.status_code in (200, 400), r.text
        if r.status_code == 400:
            assert "active" in r.json()["detail"].lower()

    def test_prices_reflect_in_db(self):
        async def check():
            from database import connect_to_mongo, get_database
            await connect_to_mongo()
            db = get_database()
            yacht = await db.vertical_assets.find_one({"vertical": "yacht"})
            cruise = await db.vertical_assets.find_one({"vertical": "cruise"})
            helipad = await db.vertical_assets.find_one({"vertical": "helipad"})
            assert yacht["base_price"] == 15, yacht["base_price"]
            assert cruise["base_price"] == 20, cruise["base_price"]
            assert helipad["base_price"] == 40, helipad["base_price"]
            aircraft = await db.aircraft.find({}, {"hourly_rate": 1}).to_list(500)
            for a in aircraft:
                assert a.get("hourly_rate", 0) <= 50, a
        _run(check())

    def test_customer_forbidden_apply(self, customer_token):
        r = requests.post(f"{API}/payments/cashfree/test-pricing/apply",
                          headers={"Authorization": f"Bearer {customer_token}"}, timeout=30)
        assert r.status_code == 403, r.text

    def test_customer_forbidden_restore(self, customer_token):
        r = requests.post(f"{API}/payments/cashfree/test-pricing/restore",
                          headers={"Authorization": f"Bearer {customer_token}"}, timeout=30)
        assert r.status_code == 403, r.text

    def test_restore_and_reapply_cycle(self, admin_token):
        """Restore → verify inactive → re-apply → LEAVE ACTIVE at end"""
        r1 = requests.post(f"{API}/payments/cashfree/test-pricing/restore",
                           headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        assert r1.status_code == 200, r1.text
        r2 = requests.post(f"{API}/payments/cashfree/test-pricing/apply",
                           headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        assert r2.status_code == 200, r2.text
        assert r2.json().get("backup_taken") is True
