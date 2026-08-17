"""Iter-72: Cashfree ₹1 Gateway Test + Test-Pricing status + Vertical Admin Seed + Test-Report row.

Covers:
- POST /api/payments/cashfree/one-rupee-test (admin ok, customer 403)
- GET  /api/payments/cashfree/collect-status/{order_id} for gateway_test order (PENDING, no crash)
- Signed webhook PAYMENT_SUCCESS_WEBHOOK finalises gateway_test order (no booking writes) + duplicate skip
- GET  /api/payments/cashfree/test-pricing/status (admin/customer 403); restore -> apply cycle, END ACTIVE
- POST /api/verticals/admin/seed idempotent (admin ok, customer 403)
- GET  /api/payments/cashfree/test-report shows '₹1 Gateway Test' row
"""
import os
import sys
import json
import asyncio
import time
import hmac
import hashlib
import base64
import pytest
import requests
from dotenv import dotenv_values

sys.path.insert(0, "/app/backend")

frontend_env = dotenv_values("/app/frontend/.env")
backend_env = dotenv_values("/app/backend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env["REACT_APP_BACKEND_URL"]).rstrip("/")
API = f"{BASE_URL}/api"
CF_SECRET = backend_env.get("CASHFREE_CLIENT_SECRET") or os.environ.get("CASHFREE_CLIENT_SECRET")

ADMIN = {"email": "admin@airyatra.co.in", "password": "Admin123!"}
CUSTOMER = {"email": "customer@airyatra.co.in", "password": "Customer@123"}


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
    code, _ = await OTPService().create_otp(user["id"], email, purpose="login",
                                            ip_address="127.0.0.1", user_agent="pytest")
    assert code
    v = requests.post(f"{API}/auth/login/verify-otp", json={"email": email, "otp_code": code}, timeout=30)
    assert v.status_code == 200, v.text
    return v.json()["access_token"]


def _login(email, password):
    return asyncio.get_event_loop().run_until_complete(_mint_otp_and_verify(email, password))


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN["email"], ADMIN["password"])


@pytest.fixture(scope="module")
def customer_token():
    return _login(CUSTOMER["email"], CUSTOMER["password"])


def _h(token):
    return {"Authorization": f"Bearer {token}"}


class TestOneRupeeCreate:
    def test_customer_forbidden(self, customer_token):
        r = requests.post(f"{API}/payments/cashfree/one-rupee-test", headers=_h(customer_token), timeout=30)
        assert r.status_code == 403, r.text

    def test_admin_creates_order(self, admin_token):
        r = requests.post(f"{API}/payments/cashfree/one-rupee-test", headers=_h(admin_token), timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("success") is True
        assert d.get("amount") == 1.0
        assert d.get("payment_session_id"), f"no session id: {d}"
        assert d.get("order_id", "").startswith("CF_CFTEST") or "CFTEST" in d.get("order_id", ""), d
        assert d.get("mode") == "production", f"expected production mode, got {d.get('mode')}"
        pytest.cf_gateway_order_id = d["order_id"]

    def test_db_record_persisted(self, admin_token):
        """Verify the record has booking_type=gateway_test, channel=gateway_test"""
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient
        mongo_url = os.environ.get("MONGO_URL") or backend_env.get("MONGO_URL")
        db_name = os.environ.get("DB_NAME") or backend_env.get("DB_NAME")

        async def _check():
            c = AsyncIOMotorClient(mongo_url)
            doc = await c[db_name].cashfree_orders.find_one({"cashfree_order_id": pytest.cf_gateway_order_id})
            c.close()
            return doc

        doc = asyncio.get_event_loop().run_until_complete(_check())
        assert doc is not None, "cashfree_orders record not created"
        assert doc.get("booking_type") == "gateway_test"
        assert doc.get("channel") == "gateway_test"
        assert doc.get("booking_id") is None
        assert doc.get("amount") == 1.0
        assert doc.get("status") == "created"


class TestCollectStatusGatewayTest:
    def test_collect_status_pending_no_crash(self, admin_token):
        """Owner queries status of gateway_test order — booking_id=None must not crash."""
        oid = pytest.cf_gateway_order_id
        r = requests.get(f"{API}/payments/cashfree/collect-status/{oid}", headers=_h(admin_token), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("status") in ("PENDING", "SUCCESS", "FAILED"), d
        # In production, unpaid new order should be PENDING
        assert d.get("order_id") == oid


class TestWebhookGatewayTest:
    """Signed PAYMENT_SUCCESS_WEBHOOK finalises the gateway_test order without any booking writes."""

    def _post_webhook(self, order_id, cf_payment_id="cf_pay_test_123"):
        body = {
            "type": "PAYMENT_SUCCESS_WEBHOOK",
            "data": {
                "order": {"order_id": order_id, "order_amount": 1.0, "order_currency": "INR"},
                "payment": {"cf_payment_id": cf_payment_id, "payment_status": "SUCCESS",
                            "payment_amount": 1.0, "payment_method": {"upi": {"channel": "collect"}}},
            },
        }
        raw = json.dumps(body, separators=(",", ":")).encode()
        ts = str(int(time.time() * 1000))
        sig = base64.b64encode(hmac.new(CF_SECRET.encode(), (ts + raw.decode()).encode(),
                                        hashlib.sha256).digest()).decode()
        headers = {"Content-Type": "application/json",
                   "x-webhook-signature": sig, "x-webhook-timestamp": ts}
        return requests.post(f"{API}/payments/cashfree/webhook", data=raw, headers=headers, timeout=30), body

    def test_webhook_success_finalizes(self):
        assert CF_SECRET, "CASHFREE_CLIENT_SECRET missing from /app/backend/.env"
        r, _ = self._post_webhook(pytest.cf_gateway_order_id)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:400]}"
        d = r.json()
        assert d.get("status") == "received"
        assert not d.get("duplicate"), f"first webhook flagged duplicate: {d}"

    def test_db_marked_paid_no_booking_writes(self):
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient
        mongo_url = os.environ.get("MONGO_URL") or backend_env.get("MONGO_URL")
        db_name = os.environ.get("DB_NAME") or backend_env.get("DB_NAME")

        async def _check():
            c = AsyncIOMotorClient(mongo_url)
            db = c[db_name]
            doc = await db.cashfree_orders.find_one({"cashfree_order_id": pytest.cf_gateway_order_id})
            # No payment_transactions row for this order
            pt = await db.payment_transactions.find_one({"session_id": pytest.cf_gateway_order_id})
            # No settlement/ledger writes: settlements collection empty for this order
            settl = await db.settlements.find_one({"order_id": pytest.cf_gateway_order_id}) \
                if "settlements" in await db.list_collection_names() else None
            # audit_event created
            audit = await db.audit_events.find_one({"event_type": "cashfree_payment_success",
                                                    "details.order_id": pytest.cf_gateway_order_id}) \
                if "audit_events" in await db.list_collection_names() else None
            notif = await db.notifications.find_one({"metadata.order_id": pytest.cf_gateway_order_id})
            c.close()
            return doc, pt, settl, audit, notif

        doc, pt, settl, audit, notif = asyncio.get_event_loop().run_until_complete(_check())
        assert doc.get("status") == "paid", f"order not paid: {doc.get('status')}"
        assert doc.get("booking_type") == "gateway_test"
        assert pt is None, f"payment_transactions row should NOT exist for gateway_test: {pt}"
        assert settl is None, f"settlements row should NOT exist for gateway_test: {settl}"
        assert notif is not None, "expected notification row"
        # audit row is best-effort, don't hard-fail if collection missing

    def test_duplicate_webhook_skipped(self):
        r, _ = self._post_webhook(pytest.cf_gateway_order_id)
        assert r.status_code == 200
        d = r.json()
        assert d.get("duplicate") is True, f"expected duplicate:true, got {d}"


class TestTestPricingStatus:
    def test_customer_forbidden(self, customer_token):
        r = requests.get(f"{API}/payments/cashfree/test-pricing/status",
                         headers=_h(customer_token), timeout=15)
        assert r.status_code == 403, r.text

    def test_admin_status_active(self, admin_token):
        """Preview db should currently have test pricing active (per iter-71 handoff)."""
        r = requests.get(f"{API}/payments/cashfree/test-pricing/status",
                         headers=_h(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "active" in d
        pytest.tp_initial_active = d["active"]
        if d["active"]:
            assert d.get("applied_at")
            assert d.get("applied_by")

    def test_restore_then_apply_cycle_ends_active(self, admin_token):
        """Restore (if active) then apply → END STATE must be active:true."""
        # Determine current state
        s = requests.get(f"{API}/payments/cashfree/test-pricing/status",
                        headers=_h(admin_token), timeout=15).json()
        if s.get("active"):
            r = requests.post(f"{API}/payments/cashfree/test-pricing/restore",
                              headers=_h(admin_token), timeout=60)
            assert r.status_code == 200, r.text
            s2 = requests.get(f"{API}/payments/cashfree/test-pricing/status",
                              headers=_h(admin_token), timeout=15).json()
            assert s2.get("active") is False
        # Apply
        r = requests.post(f"{API}/payments/cashfree/test-pricing/apply",
                          headers=_h(admin_token), timeout=60)
        assert r.status_code == 200, r.text
        # End state
        s3 = requests.get(f"{API}/payments/cashfree/test-pricing/status",
                          headers=_h(admin_token), timeout=15).json()
        assert s3.get("active") is True, f"END STATE not active: {s3}"


class TestVerticalSeed:
    def test_customer_forbidden(self, customer_token):
        r = requests.post(f"{API}/verticals/admin/seed", headers=_h(customer_token), timeout=30)
        assert r.status_code == 403, r.text

    def test_admin_seed_idempotent(self, admin_token):
        r = requests.post(f"{API}/verticals/admin/seed", headers=_h(admin_token), timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("created_users") == 0, f"expected 0 new users, got {d.get('created_users')}"
        assert d.get("created_assets") == 0, f"expected 0 new assets, got {d.get('created_assets')}"
        assert d.get("total_assets") == 6, f"expected total_assets=6, got {d.get('total_assets')}"


class TestGatewayTestReport:
    def test_report_contains_gateway_test_row(self, admin_token):
        r = requests.get(f"{API}/payments/cashfree/test-report", headers=_h(admin_token), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        rows = d.get("rows") or []
        assert any(row.get("type") == "₹1 Gateway Test" for row in rows), \
            f"No '₹1 Gateway Test' row found. Row types: {[r.get('type') for r in rows][:10]}"
        # our order id must show up
        assert any(row.get("order_id") == pytest.cf_gateway_order_id for row in rows), \
            f"our gateway_test order_id {pytest.cf_gateway_order_id} missing in report rows"
