"""Iter-76: Refund Webhook Sync — Cashfree refund credit auto-sync.

Coverage:
  A) Unit: apply_cashfree_refund_status SUCCESS (single) + idempotent replay
  B) Unit: apply_cashfree_refund_status partial multi-order
  C) Unit: apply_cashfree_refund_status CANCELLED → appears in /failed-gateway
  D) Unit: poll_cashfree_refund_status with monkeypatched get_refund
  E) API: /api/scheduler/trigger/cashfree-refund-sync auth
  F) API: /api/payments/cashfree/webhook signature enforcement + valid HMAC path
       + duplicate protection + different refund id NOT deduped
  G) Regression: /refunds/my customer view credited=True only when SUCCESS,
       /refunds/care-view stats.credited logic,
       older manual_processed refund still credited (YB2026080009 if present)

NEVER calls real Cashfree create_refund (monkeypatched or unused). get_refund is
monkeypatched in unit test D. All TEST_WHS-* docs cleaned up after.
"""
import os
import sys
import json
import uuid
import base64
import hmac
import hashlib
import asyncio
import pytest
import requests
from dotenv import dotenv_values

sys.path.insert(0, "/app/backend")

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env["REACT_APP_BACKEND_URL"]).rstrip("/")
API = f"{BASE_URL}/api"

backend_env = dotenv_values("/app/backend/.env")
WEBHOOK_SECRET = (backend_env.get("CASHFREE_WEBHOOK_SECRET")
                  or backend_env.get("CASHFREE_CLIENT_SECRET") or "")

CUSTOMER = {"email": "customer@airyatra.co.in", "password": "Customer@123"}
ADMIN = {"email": "admin@airyatra.co.in", "password": "Adm@Air123"}
FINANCE = {"email": "finance@airyatra.co.in", "password": "Fin@Air123"}


def _login_direct(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {email}: {r.status_code} {r.text[:300]}"
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
    await db.otp_codes.delete_many({"user_id": user["id"], "purpose": "login"})
    code, _rec = await OTPService().create_otp(user["id"], email, purpose="login",
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


def _h(t):
    return {"Authorization": f"Bearer {t}"}


# ========================= Fixtures =========================

@pytest.fixture(scope="module")
def customer_token():
    return _login_direct(**CUSTOMER)["access_token"]


@pytest.fixture(scope="module")
def finance_token():
    return _run(_mint_otp_and_verify(FINANCE["email"], FINANCE["password"]))


@pytest.fixture(scope="module")
def admin_token():
    return _run(_mint_otp_and_verify(ADMIN["email"], ADMIN["password"]))


# ========================= Seeding helpers =========================

async def _seed_request(*, refund_ids, txns_state, booking_ref="TEST_WHS-1",
                        customer_email="customer@airyatra.co.in",
                        cashfree_order_id="CF_TEST_WHS1"):
    """Seed a synthetic approved cashfree refund_request + refund_transactions +
    vertical_booking. txns_state: list of (gateway_refund_id, merchant_refund_id, status).
    Returns (booking_id, request_id, db)."""
    from database import connect_to_mongo, get_database
    await connect_to_mongo()
    db = get_database()
    cust = await db.users.find_one({"email": customer_email})
    assert cust, f"user {customer_email} missing"
    booking_id = f"TEST-WHS-{uuid.uuid4().hex[:10]}"
    request_id = str(uuid.uuid4())
    booking = {
        "id": booking_id, "booking_number": booking_ref, "vertical": "yacht",
        "customer_id": cust["id"], "user_id": cust["id"],
        "amount": 5000.0, "payment_status": "paid", "status": "confirmed",
        "start_date": "2028-12-31", "asset_name": "Test Yacht WHS", "city": "Mumbai",
    }
    req = {
        "id": request_id, "booking_id": booking_id, "booking_ref": booking_ref,
        "customer_id": cust["id"], "refund_type": "full",
        "amount_paid": 5000.0, "deduction_pct": 0.0, "deduction_amount": 0.0,
        "refundable_amount": 5000.0, "initiated_by": "manual_staff",
        "status": "approved", "approvals": [], "gateway": "cashfree",
        "gateway_refund_id": ", ".join(refund_ids),
        "cashfree_refund_ids": list(refund_ids),
        "gateway_refund_status": "processed",
        "gateway_refund_at": "2026-07-01T00:00:00+00:00",
        "created_at": "2026-07-01T00:00:00+00:00",
        "approved_at": "2026-07-01T00:00:00+00:00",
    }
    await db.vertical_bookings.insert_one({**booking})
    await db.refund_requests.insert_one({**req})
    for (grid, mrid, status) in txns_state:
        await db.refund_transactions.insert_one({
            "id": str(uuid.uuid4()), "refund_request_id": request_id, "booking_id": booking_id,
            "method": "cashfree", "cashfree_order_id": cashfree_order_id,
            "amount": 5000.0 / len(txns_state), "gateway_refund_id": grid,
            "merchant_refund_id": mrid, "gateway_status": status,
            "created_at": "2026-07-01T00:00:00+00:00",
        })
    return booking_id, request_id, db


async def _cleanup(db, booking_id, request_id):
    await db.vertical_bookings.delete_many({"id": booking_id})
    await db.bookings.delete_many({"id": booking_id})
    await db.inquiries.delete_many({"id": booking_id})
    await db.refund_requests.delete_many({"id": request_id})
    await db.refund_transactions.delete_many({"refund_request_id": request_id})
    await db.cashfree_webhook_events.delete_many({"event_key": {"$regex": "cfr_T"}})


# ========================= Scenario A: SUCCESS + idempotency =========================

async def _scenario_a():
    from routes.refund_approval_routes import apply_cashfree_refund_status
    booking_id, req_id, db = await _seed_request(
        refund_ids=["cfr_T1"],
        txns_state=[("cfr_T1", "refund_t1", "PENDING")],
        booking_ref="TEST_WHS-1")
    try:
        out = await apply_cashfree_refund_status(db, ["cfr_T1"], "SUCCESS", source="webhook")
        assert out["matched"] and out["changed"] and out["credited"], out

        txn = await db.refund_transactions.find_one({"gateway_refund_id": "cfr_T1"}, {"_id": 0})
        assert txn["gateway_status"] == "SUCCESS"
        assert txn.get("status_source") == "webhook"

        req = await db.refund_requests.find_one({"id": req_id}, {"_id": 0})
        assert req["refund_credit_status"] == "SUCCESS"
        assert req.get("refund_credited_at")
        assert req["gateway_refund_status"] == "SUCCESS"

        bk = await db.vertical_bookings.find_one({"id": booking_id}, {"_id": 0})
        assert bk["refund_status"] == "credited"

        audit = await db.audit_logs.find_one(
            {"action": "refund_credited", "entity_id": req_id})
        assert audit, "audit_logs missing refund_credited entry"

        # Re-apply → should be idempotent
        out2 = await apply_cashfree_refund_status(db, ["cfr_T1"], "SUCCESS", source="webhook")
        assert out2["matched"] and out2["changed"] is False, out2

        # Count audit rows for this req — should stay 1
        cnt = await db.audit_logs.count_documents(
            {"action": "refund_credited", "entity_id": req_id})
        assert cnt == 1, f"duplicate audit created: {cnt}"
    finally:
        await _cleanup(db, booking_id, req_id)


def test_a_success_and_idempotency():
    _run(_scenario_a())


# ========================= Scenario B: partial multi-order =========================

async def _scenario_b():
    from routes.refund_approval_routes import apply_cashfree_refund_status
    booking_id, req_id, db = await _seed_request(
        refund_ids=["cfr_T2a", "cfr_T2b"],
        txns_state=[("cfr_T2a", "refund_t2a", "PENDING"),
                    ("cfr_T2b", "refund_t2b", "PENDING")],
        booking_ref="TEST_WHS-2")
    try:
        # First txn SUCCESS — request must NOT be credited
        out1 = await apply_cashfree_refund_status(db, ["cfr_T2a"], "SUCCESS", source="webhook")
        assert out1["matched"] and out1["changed"] and out1["credited"] is False, out1
        req = await db.refund_requests.find_one({"id": req_id}, {"_id": 0})
        assert req.get("refund_credit_status") != "SUCCESS", \
            f"must not be credited yet: {req.get('refund_credit_status')}"

        # Second txn SUCCESS — NOW request should be credited
        out2 = await apply_cashfree_refund_status(db, ["cfr_T2b"], "SUCCESS", source="webhook")
        assert out2["matched"] and out2["changed"] and out2["credited"] is True, out2
        req2 = await db.refund_requests.find_one({"id": req_id}, {"_id": 0})
        assert req2["refund_credit_status"] == "SUCCESS"
    finally:
        await _cleanup(db, booking_id, req_id)


def test_b_partial_multi_order():
    _run(_scenario_b())


# ========================= Scenario C: CANCELLED + /failed-gateway =========================

async def _scenario_c():
    from routes.refund_approval_routes import apply_cashfree_refund_status
    booking_id, req_id, db = await _seed_request(
        refund_ids=["cfr_T3"],
        txns_state=[("cfr_T3", "refund_t3", "PENDING")],
        booking_ref="TEST_WHS-3")
    try:
        out = await apply_cashfree_refund_status(db, ["cfr_T3"], "CANCELLED", source="webhook")
        assert out["matched"] and out["changed"], out
        txn = await db.refund_transactions.find_one({"gateway_refund_id": "cfr_T3"}, {"_id": 0})
        assert txn["gateway_status"] == "CANCELLED"
        req = await db.refund_requests.find_one({"id": req_id}, {"_id": 0})
        assert req["refund_credit_status"] == "CANCELLED"
        assert req["gateway_refund_status"] == "failed"
        assert req.get("gateway_refund_error")
        return req_id
    except Exception:
        await _cleanup(db, booking_id, req_id)
        raise


def test_c_cancelled_and_failed_gateway_listing(finance_token):
    from database import get_database, connect_to_mongo
    req_id = _run(_scenario_c())
    try:
        r = requests.get(f"{API}/refunds/failed-gateway",
                         headers=_h(finance_token), timeout=30)
        assert r.status_code == 200, r.text[:300]
        ids = [x["id"] for x in r.json().get("requests", [])]
        assert req_id in ids, f"CANCELLED refund missing from /failed-gateway: first 5 = {ids[:5]}"
    finally:
        async def _c():
            await connect_to_mongo()
            db = get_database()
            req = await db.refund_requests.find_one({"id": req_id}, {"booking_id": 1})
            if req:
                await _cleanup(db, req["booking_id"], req_id)
        _run(_c())


# ========================= Scenario D: poller =========================

async def _scenario_d():
    from routes import refund_approval_routes as R
    from services import cashfree_service as cfmod
    booking_id, req_id, db = await _seed_request(
        refund_ids=["cfr_T4"],
        txns_state=[("cfr_T4", "refund_t4", "PENDING")],
        booking_ref="TEST_WHS-4", cashfree_order_id="CF_TEST_WHS4")

    # Also insert a txn that is ALREADY SUCCESS — should be skipped by poller
    already_id = str(uuid.uuid4())
    await db.refund_transactions.insert_one({
        "id": already_id, "refund_request_id": "unrelated-req-id",
        "booking_id": "unrelated-booking", "method": "cashfree",
        "cashfree_order_id": "CF_TEST_ALREADY", "amount": 100.0,
        "gateway_refund_id": "cfr_already_success", "merchant_refund_id": "refund_already",
        "gateway_status": "SUCCESS", "created_at": "2026-07-01T00:00:00+00:00"})

    try:
        calls = []

        class StubSvc:
            async def get_refund(self, order_id, refund_id):
                calls.append({"order_id": order_id, "refund_id": refund_id})
                return {"refund_status": "SUCCESS"}

        orig = cfmod.cashfree_service
        cfmod.cashfree_service = StubSvc()
        try:
            synced = await R.poll_cashfree_refund_status(db)
        finally:
            cfmod.cashfree_service = orig

        assert synced >= 1, f"expected synced>=1, got {synced}"
        # Poller must NOT touch the already-SUCCESS txn
        assert all(c["refund_id"] != "refund_already" for c in calls), \
            f"poller called get_refund on already-SUCCESS txn: {calls}"

        req = await db.refund_requests.find_one({"id": req_id}, {"_id": 0})
        assert req["refund_credit_status"] == "SUCCESS"
    finally:
        await db.refund_transactions.delete_one({"id": already_id})
        await _cleanup(db, booking_id, req_id)


def test_d_poller_syncs_and_skips_already_final():
    _run(_scenario_d())


# ========================= Scenario E: scheduler trigger auth =========================

def test_e_scheduler_trigger_admin_ok(admin_token):
    r = requests.post(f"{API}/scheduler/trigger/cashfree-refund-sync",
                      headers=_h(admin_token), timeout=60)
    assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
    body = r.json()
    assert "refunds_synced" in body, body


def test_e_scheduler_trigger_customer_forbidden(customer_token):
    r = requests.post(f"{API}/scheduler/trigger/cashfree-refund-sync",
                      headers=_h(customer_token), timeout=30)
    assert r.status_code == 403, f"customer should be 403, got {r.status_code}"


# ========================= Scenario F: webhook signature enforcement =========================

def _sign_webhook(raw_body: bytes, timestamp: str, secret: str) -> str:
    return base64.b64encode(
        hmac.new(secret.encode(), timestamp.encode() + raw_body, hashlib.sha256).digest()
    ).decode()


def test_f_webhook_rejects_unsigned():
    payload = {"type": "REFUND_STATUS_WEBHOOK",
               "data": {"refund": {"order_id": "CF_TEST_WHS5",
                                   "cf_refund_id": "cfr_T5",
                                   "refund_id": "refund_t5",
                                   "refund_status": "SUCCESS"}}}
    r = requests.post(f"{API}/payments/cashfree/webhook",
                      data=json.dumps(payload),
                      headers={"Content-Type": "application/json"}, timeout=30)
    # Signature enforced when configured — expect 401
    assert r.status_code == 401, f"unsigned webhook must be 401, got {r.status_code} {r.text[:200]}"


def test_f_webhook_valid_signature_end_to_end():
    """Seed a matching pending txn → send SIGNED webhook → assert 200 + request credited.
    Then duplicate webhook returns duplicate=true. Then a DIFFERENT refund id on same
    order is NOT deduped against the first."""
    if not WEBHOOK_SECRET:
        pytest.skip("CASHFREE_WEBHOOK_SECRET/CLIENT_SECRET missing from backend/.env")

    async def seed():
        b, r, db = await _seed_request(
            refund_ids=["cfr_T5"],
            txns_state=[("cfr_T5", "refund_t5", "PENDING")],
            booking_ref="TEST_WHS-5", cashfree_order_id="CF_TEST_WHS5")
        # Second pending txn on SAME order but different refund id → for dedupe check
        await db.refund_transactions.insert_one({
            "id": str(uuid.uuid4()), "refund_request_id": r, "booking_id": b,
            "method": "cashfree", "cashfree_order_id": "CF_TEST_WHS5", "amount": 1.0,
            "gateway_refund_id": "cfr_T5_alt", "merchant_refund_id": "refund_t5_alt",
            "gateway_status": "PENDING", "created_at": "2026-07-01T00:00:00+00:00"})
        return b, r, db

    booking_id, req_id, db = _run(seed())

    try:
        payload = {"type": "REFUND_STATUS_WEBHOOK",
                   "data": {"refund": {"order_id": "CF_TEST_WHS5",
                                       "cf_refund_id": "cfr_T5",
                                       "refund_id": "refund_t5",
                                       "refund_status": "SUCCESS"}}}
        raw = json.dumps(payload).encode()
        ts = "1720000000"
        sig = _sign_webhook(raw, ts, WEBHOOK_SECRET)
        headers = {"Content-Type": "application/json",
                   "x-webhook-signature": sig, "x-webhook-timestamp": ts}
        r1 = requests.post(f"{API}/payments/cashfree/webhook",
                           data=raw, headers=headers, timeout=30)
        assert r1.status_code == 200, f"signed webhook rejected: {r1.status_code} {r1.text[:300]}"
        j1 = r1.json()
        assert j1.get("duplicate") is not True, j1

        # Give async ops a beat then assert txn updated (one txn credited, still 1 pending → not credited)
        async def check():
            t = await db.refund_transactions.find_one({"gateway_refund_id": "cfr_T5"}, {"_id": 0})
            return t
        t = _run(check())
        assert t and t["gateway_status"] == "SUCCESS", f"txn not synced: {t}"

        # Duplicate: send same webhook again → duplicate=true
        r2 = requests.post(f"{API}/payments/cashfree/webhook",
                           data=raw, headers=headers, timeout=30)
        assert r2.status_code == 200, r2.text[:200]
        assert r2.json().get("duplicate") is True, f"duplicate not detected: {r2.json()}"

        # DIFFERENT refund id, same order → must NOT be deduped
        payload_alt = {"type": "REFUND_STATUS_WEBHOOK",
                       "data": {"refund": {"order_id": "CF_TEST_WHS5",
                                           "cf_refund_id": "cfr_T5_alt",
                                           "refund_id": "refund_t5_alt",
                                           "refund_status": "SUCCESS"}}}
        raw2 = json.dumps(payload_alt).encode()
        ts2 = "1720000100"
        sig2 = _sign_webhook(raw2, ts2, WEBHOOK_SECRET)
        r3 = requests.post(f"{API}/payments/cashfree/webhook",
                           data=raw2,
                           headers={"Content-Type": "application/json",
                                    "x-webhook-signature": sig2,
                                    "x-webhook-timestamp": ts2}, timeout=30)
        assert r3.status_code == 200, r3.text[:200]
        assert r3.json().get("duplicate") is not True, \
            f"different refund_id was incorrectly deduped: {r3.json()}"

        # Now BOTH txns SUCCESS → request should be credited
        async def final_check():
            req = await db.refund_requests.find_one({"id": req_id}, {"_id": 0})
            return req
        req = _run(final_check())
        assert req["refund_credit_status"] == "SUCCESS", \
            f"expected SUCCESS after both txns done, got {req.get('refund_credit_status')}"
    finally:
        async def cleanup_wh():
            await _cleanup(db, booking_id, req_id)
            await db.cashfree_webhook_events.delete_many(
                {"event_key": {"$regex": "CF_TEST_WHS5"}})
        _run(cleanup_wh())


# ========================= Scenario G: regression =========================

def test_g_customer_my_credited_logic(customer_token):
    """Seed 2 requests for customer: one initiated-but-unconfirmed, one SUCCESS.
    /refunds/my must show credited=False for first with 'initiated' sub, True for second."""
    async def seed_two():
        from database import connect_to_mongo, get_database
        await connect_to_mongo()
        db = get_database()
        cust = await db.users.find_one({"email": CUSTOMER["email"]})

        rid_pending = str(uuid.uuid4())
        rid_success = str(uuid.uuid4())
        common = {
            "customer_id": cust["id"], "refund_type": "full",
            "amount_paid": 1000.0, "deduction_pct": 0.0, "deduction_amount": 0.0,
            "refundable_amount": 1000.0, "initiated_by": "manual_staff",
            "status": "approved", "approvals": [], "gateway": "cashfree",
            "gateway_refund_id": "cfr_GX",
            "gateway_refund_status": "processed",
            "created_at": "2026-07-05T00:00:00+00:00",
            "approved_at": "2026-07-05T00:00:00+00:00",
        }
        await db.refund_requests.insert_one({
            **common, "id": rid_pending, "booking_id": "BK-WHS-GP",
            "booking_ref": "TEST_WHS-GP", "gateway_refund_id": "cfr_GP",
        })
        await db.refund_requests.insert_one({
            **common, "id": rid_success, "booking_id": "BK-WHS-GS",
            "booking_ref": "TEST_WHS-GS", "gateway_refund_id": "cfr_GS",
            "refund_credit_status": "SUCCESS",
            "refund_credited_at": "2026-07-05T01:00:00+00:00",
        })
        return db, rid_pending, rid_success

    db, rid_p, rid_s = _run(seed_two())
    try:
        r = requests.get(f"{API}/refunds/my", headers=_h(customer_token), timeout=30)
        assert r.status_code == 200, r.text[:200]
        refunds = {x["booking_ref"]: x for x in r.json()["refunds"]}
        assert "TEST_WHS-GP" in refunds and "TEST_WHS-GS" in refunds, list(refunds.keys())

        p_steps = {s["key"]: s for s in refunds["TEST_WHS-GP"]["steps"]}
        s_steps = {s["key"]: s for s in refunds["TEST_WHS-GS"]["steps"]}

        assert p_steps["credited"]["done"] is False, f"pending credited must be False: {p_steps['credited']}"
        assert "initiated" in (p_steps["credited"].get("sub") or "").lower(), \
            f"expected 'initiated' hint in sub: {p_steps['credited']}"

        assert s_steps["credited"]["done"] is True, f"success credited must be True: {s_steps['credited']}"
    finally:
        async def c():
            await db.refund_requests.delete_many({"id": {"$in": [rid_p, rid_s]}})
        _run(c())


def test_g_care_view_stats_credited_logic(admin_token):
    r = requests.get(f"{API}/refunds/care-view", headers=_h(admin_token), timeout=30)
    assert r.status_code == 200
    body = r.json()
    assert "stats" in body and "credited" in body["stats"]
    # Just structural — must be int >= 0
    assert isinstance(body["stats"]["credited"], int) and body["stats"]["credited"] >= 0


def test_g_older_manual_processed_regression(customer_token):
    """If YB2026080009 refund exists (iter74), it should still show credited=true."""
    r = requests.get(f"{API}/refunds/my", headers=_h(customer_token), timeout=30)
    assert r.status_code == 200
    found = None
    for x in r.json()["refunds"]:
        if x.get("booking_ref") == "YB2026080009":
            found = x
            break
    if not found:
        pytest.skip("YB2026080009 refund not in customer's list; skipping regression check")
    credited_step = next((s for s in found["steps"] if s["key"] == "credited"), None)
    assert credited_step and credited_step["done"] is True, \
        f"iter-74 manual_processed refund must still show credited=True: {credited_step}"
