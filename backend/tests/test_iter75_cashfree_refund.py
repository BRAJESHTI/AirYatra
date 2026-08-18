"""Iter-75: Cashfree Auto Refund wiring into 2-of-5 OTP refund approval chain.

Two layers:

A. UNIT/INTEGRATION (async): Directly awaits routes.refund_approval_routes._trigger_gateway_refund
   with monkeypatched cashfree_service.create_refund + payment_service.create_refund.
   Scenarios:
     (1) Single-order full refund via Cashfree
     (2) Split across two paid Cashfree orders (capped per order)
     (3) Failure on 2nd order then RESUME with success (no double-refund on 1st)
     (4) Idempotency: already-refunded returns triggered=False reason=already_refunded
     (5) Razorpay priority: booking with razorpay_payment_id -> razorpay path only
     (6) No gateway at all -> triggered=False reason=no_payment_id + manual txn row

B. E2E API-level: seed synthetic paid vertical booking + a FAKE cashfree_order (so
   REAL Cashfree API rejects it gracefully -> gateway_refund_status=failed).
   Runs the 2-of-5 OTP approval chain over HTTP using finance+admin, then retry-gateway
   (still expected to fail), then mark-processed to close it out. Also regression on
   /refunds/pending, /refunds/care-view, /refunds/my.
"""
import os
import sys
import uuid
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


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ==================== PART A: UNIT/INTEGRATION with monkeypatch ====================


def _seed_booking_and_request(db, *, paid_amount=5000.0, refundable=None,
                              razorpay_payment_id=None, cashfree_orders=None,
                              booking_ref_prefix="TEST_CFR"):
    """Insert synthetic vertical booking + refund_request + optional cashfree_orders docs.
    Returns (booking_id, req_dict).
    """
    booking_id = f"TEST-{uuid.uuid4().hex[:12]}"
    booking = {
        "id": booking_id,
        "booking_number": f"{booking_ref_prefix}-{booking_id[:6]}",
        "vertical": "yacht",
        "customer_id": "TEST-CUST",
        "amount": paid_amount,
        "payment_status": "paid",
        "status": "confirmed",
        "start_date": "2028-12-31",
    }
    if razorpay_payment_id:
        booking["razorpay_payment_id"] = razorpay_payment_id
    refundable = refundable if refundable is not None else paid_amount
    req = {
        "id": str(uuid.uuid4()),
        "booking_id": booking_id,
        "booking_ref": booking["booking_number"],
        "customer_id": "TEST-CUST",
        "refund_type": "full",
        "amount_paid": paid_amount,
        "deduction_pct": 0.0,
        "deduction_amount": 0.0,
        "refundable_amount": refundable,
        "initiated_by": "manual_staff",
        "status": "approved",
        "approvals": [],
        "created_at": "2026-07-01T00:00:00+00:00",
    }
    return booking, req, cashfree_orders or []


async def _apply_seed(db, booking, req, cf_orders):
    await db.vertical_bookings.insert_one({**booking})
    await db.refund_requests.insert_one({**req})
    for o in cf_orders:
        await db.cashfree_orders.insert_one({**o})


async def _cleanup(db, booking_id, request_id):
    await db.vertical_bookings.delete_many({"id": booking_id})
    await db.bookings.delete_many({"id": booking_id})
    await db.inquiries.delete_many({"id": booking_id})
    await db.refund_requests.delete_many({"id": request_id})
    await db.refund_transactions.delete_many({"refund_request_id": request_id})
    await db.cashfree_orders.delete_many({"booking_id": booking_id})
    await db.payment_orders.delete_many({"booking_id": booking_id})


async def _import_routes():
    from database import connect_to_mongo, get_database
    await connect_to_mongo()
    db = get_database()
    from routes import refund_approval_routes as R
    return db, R


class _StubCF:
    """Records calls to create_refund and returns queued responses."""
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    async def create_refund(self, order_id, refund_amount, refund_note, refund_speed="STANDARD"):
        self.calls.append({"order_id": order_id, "refund_amount": refund_amount, "note": refund_note})
        if not self.responses:
            return {"success": False, "error": "no_stub_response"}
        return self.responses.pop(0)


class _StubPayment:
    def __init__(self, response):
        self.response = response
        self.calls = []

    async def create_refund(self, payment_id, amount, reason, db=None):
        self.calls.append({"payment_id": payment_id, "amount": amount, "reason": reason})
        return self.response


async def _run_scenario_1_single_order():
    db, R = await _import_routes()
    booking, req, _ = _seed_booking_and_request(db, paid_amount=5000, refundable=5000)
    cf_order = {
        "id": str(uuid.uuid4()), "booking_id": booking["id"],
        "cashfree_order_id": "CF_TEST_1", "status": "paid",
        "amount": 5000, "refunded_amount": 0, "refund_ids": [],
        "paid_at": "2026-06-01T00:00:00+00:00",
    }
    await _apply_seed(db, booking, req, [cf_order])
    try:
        stub_cf = _StubCF([{"success": True, "refund_id": "r1", "cf_refund_id": "cfr_1",
                            "refund_status": "SUCCESS"}])
        # Monkeypatch the singleton used inside _refund_via_cashfree
        from services import cashfree_service as cfmod
        orig = cfmod.cashfree_service
        cfmod.cashfree_service = stub_cf
        try:
            gw = await R._trigger_gateway_refund(db, req)
        finally:
            cfmod.cashfree_service = orig
        assert gw["triggered"] is True, gw
        assert gw["gateway"] == "cashfree"
        assert len(stub_cf.calls) == 1
        assert stub_cf.calls[0]["refund_amount"] == 5000
        # Verify refund_requests doc updated
        fresh = await db.refund_requests.find_one({"id": req["id"]}, {"_id": 0})
        assert fresh["gateway_refund_status"] == "processed"
        assert fresh["gateway_refund_id"], "gateway_refund_id must be set"
        assert fresh["cashfree_refunded_total"] == 5000
        assert len(fresh["cashfree_refund_ids"]) == 1
        # cashfree_orders doc updated
        cf = await db.cashfree_orders.find_one({"id": cf_order["id"]}, {"_id": 0})
        assert cf["refunded_amount"] == 5000
        assert len(cf["refund_ids"]) == 1
        # refund_transactions row
        txns = await db.refund_transactions.find(
            {"refund_request_id": req["id"]}, {"_id": 0}).to_list(10)
        assert len(txns) == 1
        assert txns[0]["method"] == "cashfree"
        assert txns[0]["amount"] == 5000
        # Booking updated
        b = await db.vertical_bookings.find_one({"id": booking["id"]}, {"_id": 0})
        assert b["refund_status"] == "processed"
        assert b.get("cashfree_refund_ids")
    finally:
        await _cleanup(db, booking["id"], req["id"])


def test_scenario_1_single_order_full_refund():
    _run(_run_scenario_1_single_order())


async def _run_scenario_2_split():
    db, R = await _import_routes()
    # refundable=5000, order1=2000, order2=4000. Expect refund1=2000, refund2=3000.
    booking, req, _ = _seed_booking_and_request(db, paid_amount=5000, refundable=5000)
    cf1 = {"id": str(uuid.uuid4()), "booking_id": booking["id"],
           "cashfree_order_id": "CF_TEST_ADV", "status": "paid",
           "amount": 2000, "refunded_amount": 0, "refund_ids": [],
           "paid_at": "2026-06-01T00:00:00+00:00"}
    cf2 = {"id": str(uuid.uuid4()), "booking_id": booking["id"],
           "cashfree_order_id": "CF_TEST_BAL", "status": "paid",
           "amount": 4000, "refunded_amount": 0, "refund_ids": [],
           "paid_at": "2026-06-02T00:00:00+00:00"}
    await _apply_seed(db, booking, req, [cf1, cf2])
    try:
        stub_cf = _StubCF([
            {"success": True, "refund_id": "r_adv", "cf_refund_id": "cfr_adv",
             "refund_status": "SUCCESS"},
            {"success": True, "refund_id": "r_bal", "cf_refund_id": "cfr_bal",
             "refund_status": "SUCCESS"},
        ])
        from services import cashfree_service as cfmod
        orig = cfmod.cashfree_service
        cfmod.cashfree_service = stub_cf
        try:
            gw = await R._trigger_gateway_refund(db, req)
        finally:
            cfmod.cashfree_service = orig
        assert gw["triggered"] is True, gw
        assert len(stub_cf.calls) == 2, stub_cf.calls
        assert stub_cf.calls[0]["refund_amount"] == 2000
        assert stub_cf.calls[1]["refund_amount"] == 3000  # remainder capped to refundable
        fresh = await db.refund_requests.find_one({"id": req["id"]}, {"_id": 0})
        assert fresh["cashfree_refunded_total"] == 5000
        assert len(fresh["cashfree_refund_ids"]) == 2
        assert "," in fresh["gateway_refund_id"]
        txns = await db.refund_transactions.find(
            {"refund_request_id": req["id"]}, {"_id": 0}).to_list(10)
        assert len(txns) == 2
        assert {t["amount"] for t in txns} == {2000, 3000}
    finally:
        await _cleanup(db, booking["id"], req["id"])


def test_scenario_2_split_two_orders():
    _run(_run_scenario_2_split())


async def _run_scenario_3_fail_then_resume():
    db, R = await _import_routes()
    booking, req, _ = _seed_booking_and_request(db, paid_amount=5000, refundable=5000)
    cf1 = {"id": str(uuid.uuid4()), "booking_id": booking["id"],
           "cashfree_order_id": "CF_TEST_A", "status": "paid",
           "amount": 2000, "refunded_amount": 0, "refund_ids": [],
           "paid_at": "2026-06-01T00:00:00+00:00"}
    cf2 = {"id": str(uuid.uuid4()), "booking_id": booking["id"],
           "cashfree_order_id": "CF_TEST_B", "status": "paid",
           "amount": 3000, "refunded_amount": 0, "refund_ids": [],
           "paid_at": "2026-06-02T00:00:00+00:00"}
    await _apply_seed(db, booking, req, [cf1, cf2])
    try:
        from services import cashfree_service as cfmod
        # First run: order1 succeeds, order2 fails with error 'boom'
        stub_cf = _StubCF([
            {"success": True, "refund_id": "r_a", "cf_refund_id": "cfr_a",
             "refund_status": "SUCCESS"},
            {"success": False, "error": "boom"},
        ])
        orig = cfmod.cashfree_service
        cfmod.cashfree_service = stub_cf
        try:
            gw = await R._trigger_gateway_refund(db, req)
        finally:
            cfmod.cashfree_service = orig
        assert gw["triggered"] is False, gw
        assert gw["reason"] == "boom" or "boom" in str(gw.get("reason", "")), gw
        fresh = await db.refund_requests.find_one({"id": req["id"]}, {"_id": 0})
        assert fresh["cashfree_refunded_total"] == 2000
        assert fresh["gateway_refund_status"] == "failed"
        assert "gateway_refund_id" not in fresh
        assert fresh.get("gateway_refund_error")

        # Second run: only remaining 3000 refund, must NOT re-refund order1.
        stub2 = _StubCF([
            {"success": True, "refund_id": "r_b", "cf_refund_id": "cfr_b",
             "refund_status": "SUCCESS"},
        ])
        # refetch req to get up-to-date state (since _trigger_gateway_refund reads db state)
        req2 = await db.refund_requests.find_one({"id": req["id"]}, {"_id": 0})
        cfmod.cashfree_service = stub2
        try:
            gw2 = await R._trigger_gateway_refund(db, req2)
        finally:
            cfmod.cashfree_service = orig
        assert gw2["triggered"] is True, gw2
        assert len(stub2.calls) == 1, f"Should only refund remaining once, got {stub2.calls}"
        assert stub2.calls[0]["refund_amount"] == 3000
        assert stub2.calls[0]["order_id"] == "CF_TEST_B"
        final = await db.refund_requests.find_one({"id": req["id"]}, {"_id": 0})
        assert final["cashfree_refunded_total"] == 5000
        assert final["gateway_refund_status"] == "processed"
        assert final["gateway_refund_id"]
        assert len(final["cashfree_refund_ids"]) == 2
    finally:
        await _cleanup(db, booking["id"], req["id"])


def test_scenario_3_failure_then_resume_no_double_refund():
    _run(_run_scenario_3_fail_then_resume())


async def _run_scenario_4_idempotency():
    db, R = await _import_routes()
    booking, req, _ = _seed_booking_and_request(db, paid_amount=1000, refundable=1000)
    # Already-refunded state: gateway_refund_id set
    req["gateway_refund_id"] = "cfr_already"
    req["gateway_refund_status"] = "processed"
    cf = {"id": str(uuid.uuid4()), "booking_id": booking["id"],
          "cashfree_order_id": "CF_TEST_IDEM", "status": "paid",
          "amount": 1000, "refunded_amount": 1000, "refund_ids": ["cfr_already"],
          "paid_at": "2026-06-01T00:00:00+00:00"}
    await _apply_seed(db, booking, req, [cf])
    try:
        from services import cashfree_service as cfmod
        stub_cf = _StubCF([])
        orig = cfmod.cashfree_service
        cfmod.cashfree_service = stub_cf
        try:
            gw = await R._trigger_gateway_refund(db, req)
        finally:
            cfmod.cashfree_service = orig
        assert gw["triggered"] is False, gw
        assert gw["reason"] == "already_refunded", gw
        assert len(stub_cf.calls) == 0
    finally:
        await _cleanup(db, booking["id"], req["id"])


def test_scenario_4_idempotency_already_refunded():
    _run(_run_scenario_4_idempotency())


async def _run_scenario_5_razorpay_priority():
    db, R = await _import_routes()
    booking, req, _ = _seed_booking_and_request(
        db, paid_amount=1500, refundable=1500,
        razorpay_payment_id="pay_rzp_TEST_123")
    # Also add a cashfree_order to prove it's ignored.
    cf = {"id": str(uuid.uuid4()), "booking_id": booking["id"],
          "cashfree_order_id": "CF_TEST_IGNORE", "status": "paid",
          "amount": 1500, "refunded_amount": 0, "refund_ids": [],
          "paid_at": "2026-06-01T00:00:00+00:00"}
    await _apply_seed(db, booking, req, [cf])
    try:
        from services import cashfree_service as cfmod
        from services import payment_service as pmod
        stub_cf = _StubCF([])
        stub_pay = _StubPayment({"success": True, "refund_id": "rfnd_rzp_1",
                                 "status": "processed", "mock": False})
        orig_cf = cfmod.cashfree_service
        orig_pay = pmod.payment_service
        cfmod.cashfree_service = stub_cf
        pmod.payment_service = stub_pay
        try:
            gw = await R._trigger_gateway_refund(db, req)
        finally:
            cfmod.cashfree_service = orig_cf
            pmod.payment_service = orig_pay
        assert gw["triggered"] is True, gw
        assert len(stub_cf.calls) == 0, "cashfree must NOT be called when razorpay payment exists"
        assert len(stub_pay.calls) == 1
        assert stub_pay.calls[0]["payment_id"] == "pay_rzp_TEST_123"
        fresh = await db.refund_requests.find_one({"id": req["id"]}, {"_id": 0})
        assert fresh["gateway_refund_id"] == "rfnd_rzp_1"
    finally:
        await _cleanup(db, booking["id"], req["id"])


def test_scenario_5_razorpay_priority_unchanged():
    _run(_run_scenario_5_razorpay_priority())


async def _run_scenario_6_no_gateway():
    db, R = await _import_routes()
    booking, req, _ = _seed_booking_and_request(db, paid_amount=1000, refundable=1000)
    await _apply_seed(db, booking, req, [])  # no cashfree_orders, no razorpay
    try:
        from services import cashfree_service as cfmod
        stub_cf = _StubCF([])
        orig = cfmod.cashfree_service
        cfmod.cashfree_service = stub_cf
        try:
            gw = await R._trigger_gateway_refund(db, req)
        finally:
            cfmod.cashfree_service = orig
        assert gw["triggered"] is False, gw
        assert gw["reason"] == "no_payment_id", gw
        assert len(stub_cf.calls) == 0
        txns = await db.refund_transactions.find(
            {"refund_request_id": req["id"]}, {"_id": 0}).to_list(10)
        assert len(txns) == 1
        assert txns[0]["method"] == "pending_gateway"
        assert txns[0]["gateway_status"] == "no_payment_id"
    finally:
        await _cleanup(db, booking["id"], req["id"])


def test_scenario_6_no_gateway_manual_queue():
    _run(_run_scenario_6_no_gateway())


# ==================== PART B: E2E API-level chain with fake CF order ====================


@pytest.fixture(scope="module")
def customer_token():
    data = _login_direct(**CUSTOMER)
    assert not data.get("otp_required")
    return data["access_token"]


@pytest.fixture(scope="module")
def finance_token():
    return _run(_mint_otp_and_verify(FINANCE["email"], FINANCE["password"]))


@pytest.fixture(scope="module")
def admin_token():
    return _run(_mint_otp_and_verify(ADMIN["email"], ADMIN["password"]))


async def _seed_synthetic_paid_yacht_booking():
    """Seed a synthetic paid yacht vertical booking owned by customer@ with a FAKE
    cashfree_orders doc so the real Cashfree API rejects the refund gracefully."""
    from database import connect_to_mongo, get_database
    await connect_to_mongo()
    db = get_database()
    cust = await db.users.find_one({"email": CUSTOMER["email"]})
    assert cust, "customer user missing"
    booking_id = f"TEST-E2E-{uuid.uuid4().hex[:10]}"
    booking = {
        "id": booking_id,
        "booking_number": f"TEST_CFE2E_{booking_id[-6:]}",
        "vertical": "yacht",
        "customer_id": cust["id"],
        "user_id": cust["id"],
        "asset_name": "Test Yacht E2E",
        "city": "Mumbai",
        "amount": 5000.0,
        "payment_status": "paid",
        "status": "confirmed",
        "start_date": "2028-12-31",
        "departure_time": "10:00",
        "owner_user_id": "TEST-OWNER",
        "created_at": "2026-07-01T00:00:00+00:00",
    }
    await db.vertical_bookings.insert_one({**booking})
    cf_order = {
        "id": str(uuid.uuid4()),
        "booking_id": booking_id,
        "cashfree_order_id": f"CF_FAKE_{uuid.uuid4().hex[:8]}",  # real API will reject
        "status": "paid",
        "amount": 5000.0,
        "refunded_amount": 0,
        "refund_ids": [],
        "paid_at": "2026-06-15T00:00:00+00:00",
    }
    await db.cashfree_orders.insert_one({**cf_order})
    return booking_id, cust["id"]


async def _cleanup_e2e(booking_id, request_id=None):
    from database import connect_to_mongo, get_database
    await connect_to_mongo()
    db = get_database()
    await db.vertical_bookings.delete_many({"id": booking_id})
    await db.cashfree_orders.delete_many({"booking_id": booking_id})
    if request_id:
        await db.refund_requests.delete_many({"id": request_id})
        await db.refund_transactions.delete_many({"refund_request_id": request_id})
        await db.refund_otps.delete_many({"request_id": request_id})


async def _get_otp_plaintext(request_id, user_email):
    from database import connect_to_mongo, get_database
    await connect_to_mongo()
    db = get_database()
    user = await db.users.find_one({"email": user_email})
    doc = await db.refund_otps.find_one({"user_id": user["id"], "request_id": request_id})
    return doc["code"] if doc else None


@pytest.fixture(scope="module")
def e2e_state():
    booking_id, cust_id = _run(_seed_synthetic_paid_yacht_booking())
    state = {"booking_id": booking_id, "customer_id": cust_id, "request_id": None}
    yield state
    _run(_cleanup_e2e(state["booking_id"], state.get("request_id")))


class TestE2ECashfreeChain:

    def test_a_customer_cancel(self, customer_token, e2e_state):
        r = requests.post(f"{API}/refunds/customer-cancel",
                          headers=_h(customer_token),
                          json={"booking_id": e2e_state["booking_id"],
                                "reason": "TEST_E2E cashfree wiring"}, timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        req = r.json()["refund_request"]
        e2e_state["request_id"] = req["id"]
        # >72h -> 10% deduction expected
        assert req["deduction_pct"] == 10.0
        assert req["refundable_amount"] == 4500.0
        assert req["status"] == "pending_approval"

    def test_b_finance_approve_via_otp(self, finance_token, e2e_state):
        rid = e2e_state["request_id"]
        assert rid
        r = requests.post(f"{API}/refunds/{rid}/request-otp",
                          headers=_h(finance_token), timeout=30)
        assert r.status_code == 200, r.text[:300]
        code = _run(_get_otp_plaintext(rid, FINANCE["email"]))
        assert code, "finance OTP not in db.refund_otps"
        r2 = requests.post(f"{API}/refunds/{rid}/approve",
                           headers=_h(finance_token),
                           json={"otp": code, "action": "approve",
                                 "remark": "TEST_E2E finance approval"}, timeout=30)
        assert r2.status_code == 200, r2.text[:300]
        body = r2.json()
        assert body["status"] == "pending_approval"
        assert len(body["approvals"]) == 1

    def test_c_admin_approve_triggers_cashfree_gateway_fail(self, admin_token, e2e_state):
        rid = e2e_state["request_id"]
        r = requests.post(f"{API}/refunds/{rid}/request-otp",
                          headers=_h(admin_token), timeout=30)
        assert r.status_code == 200, r.text[:300]
        code = _run(_get_otp_plaintext(rid, ADMIN["email"]))
        assert code
        r2 = requests.post(f"{API}/refunds/{rid}/approve",
                           headers=_h(admin_token),
                           json={"otp": code, "action": "approve",
                                 "remark": "TEST_E2E admin approval"}, timeout=60)
        assert r2.status_code == 200, r2.text[:400]
        body = r2.json()
        assert body["status"] == "approved"
        gw = body.get("gateway_refund") or {}
        # Real Cashfree API rejects fake order -> triggered False, gateway=cashfree
        assert gw.get("gateway") == "cashfree", f"expected cashfree gateway, got {gw}"
        assert gw.get("triggered") is False, f"fake order must fail: {gw}"

    def test_d_appears_in_failed_gateway(self, finance_token, e2e_state):
        r = requests.get(f"{API}/refunds/failed-gateway",
                         headers=_h(finance_token), timeout=30)
        assert r.status_code == 200
        ids = [x["id"] for x in r.json().get("requests", [])]
        assert e2e_state["request_id"] in ids, f"failed-gateway list missing our req: {ids[:5]}"

    def test_e_retry_gateway_still_fails(self, finance_token, e2e_state):
        rid = e2e_state["request_id"]
        r = requests.post(f"{API}/refunds/{rid}/retry-gateway",
                          headers=_h(finance_token), timeout=60)
        assert r.status_code == 200, r.text[:300]
        gw = r.json().get("gateway_refund") or {}
        assert gw.get("triggered") is False
        assert gw.get("gateway") == "cashfree"

    def test_f_mark_processed_closes_out(self, finance_token, e2e_state):
        rid = e2e_state["request_id"]
        r = requests.post(f"{API}/refunds/{rid}/mark-processed",
                          headers=_h(finance_token),
                          json={"remark": "TEST_E2E manual close"}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        # Now should no longer appear in failed-gateway
        r2 = requests.get(f"{API}/refunds/failed-gateway",
                          headers=_h(finance_token), timeout=30)
        ids = [x["id"] for x in r2.json().get("requests", [])]
        assert rid not in ids


# ==================== REGRESSION: panels still work ====================


class TestRegressionPanels:

    def test_admin_pending_ok(self, admin_token):
        r = requests.get(f"{API}/refunds/pending", headers=_h(admin_token), timeout=30)
        assert r.status_code == 200
        assert "requests" in r.json()

    def test_finance_pending_ok(self, finance_token):
        r = requests.get(f"{API}/refunds/pending", headers=_h(finance_token), timeout=30)
        assert r.status_code == 200

    def test_customer_my_ok(self, customer_token):
        r = requests.get(f"{API}/refunds/my", headers=_h(customer_token), timeout=30)
        assert r.status_code == 200
        assert "refunds" in r.json()

    def test_care_view_ok(self, admin_token):
        r = requests.get(f"{API}/refunds/care-view", headers=_h(admin_token), timeout=30)
        assert r.status_code == 200
        assert "stats" in r.json()
