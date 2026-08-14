"""Iter60: Refund Approval Chain — 2-of-5 approvals with email OTP, policy auto-deduction, operator reason gating."""
import os
import time
import uuid
import pytest
import requests
from datetime import datetime, timedelta, timezone
from dotenv import dotenv_values
from pymongo import MongoClient

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = "airyatra_db"

CREDS = {
    "admin": ("admin@airyatra.co.in", "Admin123!"),
    "sales": ("sales@airyatra.co.in", "Sales@123456"),
    "operator": ("operator@airyatra.co.in", "Operator@123456"),
    "customer": ("customer@airyatra.co.in", "Customer@123"),
}


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"Login {email}: {r.status_code} {r.text[:200]}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def tokens():
    """Login each role once (rate-limit friendly)."""
    t = {}
    for k, (e, p) in CREDS.items():
        t[k] = _login(e, p)
        time.sleep(1.5)
    return t


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def db_sync():
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    yield db
    client.close()


@pytest.fixture(scope="module")
def sales_user_id(db_sync):
    doc = db_sync.users.find_one({"email": "sales@airyatra.co.in"})
    return doc["id"]


@pytest.fixture(scope="module")
def customer_user_id(db_sync):
    doc = db_sync.users.find_one({"email": "customer@airyatra.co.in"})
    return doc["id"]


@pytest.fixture(scope="module")
def admin_user_id(db_sync):
    doc = db_sync.users.find_one({"email": "admin@airyatra.co.in"})
    return doc["id"]


# Cleanup registry
_created = {"bookings": [], "refund_requests": [], "reasons": [], "invoice_logs": []}


@pytest.fixture(scope="module", autouse=True)
def cleanup(db_sync, sales_user_id):
    # Note original sales roles; if only sales (no admin), no reset needed
    original = db_sync.users.find_one({"email": "sales@airyatra.co.in"})
    original_roles = original.get("roles", [])
    # For admin-only gate test we need sales user to NOT be admin. Temporarily strip 'admin'/'super_admin'/'ceo'.
    if any(r in original_roles for r in ["admin", "super_admin", "ceo"]):
        stripped = [r for r in original_roles if r not in ("admin", "super_admin", "ceo")]
        if "sales" not in stripped:
            stripped.append("sales")
        db_sync.users.update_one({"email": "sales@airyatra.co.in"}, {"$set": {"roles": stripped}})
        print(f"[SETUP] Temporarily set sales roles to {stripped} (was {original_roles})")
    yield
    # Restore
    db_sync.users.update_one({"email": "sales@airyatra.co.in"}, {"$set": {"roles": original_roles}})
    for bid in _created["bookings"]:
        db_sync.bookings.delete_many({"id": bid})
        db_sync.inquiries.delete_many({"id": bid})
    for rid in _created["refund_requests"]:
        db_sync.refund_requests.delete_many({"id": rid})
        db_sync.refund_transactions.delete_many({"refund_request_id": rid})
    for rid in _created["reasons"]:
        db_sync.cancellation_reasons.delete_many({"id": rid})
    for key in _created["invoice_logs"]:
        db_sync.invoice_email_log.delete_many({"key": key})
    # remove refund_otps for test users
    db_sync.refund_otps.delete_many({})
    print(f"[TEARDOWN] Cleaned {len(_created['bookings'])} bookings, {len(_created['refund_requests'])} refunds")


def _create_booking(customer_token, db_sync, days_ahead=30, amount_paid=100000):
    dep = (datetime.now(timezone.utc) + timedelta(days=days_ahead)).strftime("%Y-%m-%d")
    payload = {
        "from_location": "Mumbai", "to_location": "Pune",
        "from_latitude": 19.076, "from_longitude": 72.877,
        "to_latitude": 18.520, "to_longitude": 73.856,
        "trip_type": "one_way", "flight_type": "helicopter",
        "departure_date": dep, "pickup_time": "09:00",
        "passengers": 2, "booking_type": "custom_quote",
        "estimated_price": amount_paid,
    }
    r = requests.post(f"{BASE_URL}/api/bookings/", json=payload, headers=_h(customer_token), timeout=20)
    assert r.status_code in (200, 201), f"Create booking: {r.status_code} {r.text[:300]}"
    bid = r.json()["booking"]["id"]
    _created["bookings"].append(bid)
    # mark as paid
    db_sync.bookings.update_one(
        {"id": bid},
        {"$set": {"amount_paid": amount_paid, "final_price": amount_paid, "payment_status": "paid"}}
    )
    return bid


# ==================== 1. REASONS CRUD ====================

class TestReasonsCRUD:
    def test_list_reasons_seeds_defaults(self, tokens):
        r = requests.get(f"{BASE_URL}/api/refunds/reasons?audience=operator", headers=_h(tokens["sales"]), timeout=10)
        assert r.status_code == 200, r.text[:200]
        reasons = r.json()["reasons"]
        labels = [x["label"] for x in reasons]
        assert any("Weather" in l or "weather" in l.lower() for l in labels), f"no weather in {labels}"
        assert any("Engine" in l or "engine" in l.lower() for l in labels)

    def test_admin_add_and_delete_reason(self, tokens):
        add = requests.post(f"{BASE_URL}/api/refunds/reasons",
                            json={"audience": "operator", "label": "TEST_Iter60_Reason"},
                            headers=_h(tokens["admin"]), timeout=10)
        assert add.status_code == 200, add.text[:200]
        rid = add.json()["reason"]["id"]
        _created["reasons"].append(rid)

        listing = requests.get(f"{BASE_URL}/api/refunds/reasons?audience=operator",
                               headers=_h(tokens["admin"]), timeout=10).json()["reasons"]
        assert any(r["id"] == rid for r in listing), "New reason not in list"

        dele = requests.delete(f"{BASE_URL}/api/refunds/reasons/{rid}", headers=_h(tokens["admin"]), timeout=10)
        assert dele.status_code == 200, dele.text[:200]

        listing2 = requests.get(f"{BASE_URL}/api/refunds/reasons?audience=operator",
                                headers=_h(tokens["admin"]), timeout=10).json()["reasons"]
        assert not any(r["id"] == rid for r in listing2), "Deleted reason still active"

    def test_customer_forbidden_to_add_reason(self, tokens):
        r = requests.post(f"{BASE_URL}/api/refunds/reasons",
                          json={"audience": "operator", "label": "TEST_Should_Fail"},
                          headers=_h(tokens["customer"]), timeout=10)
        assert r.status_code == 403, f"Expected 403, got {r.status_code}"


# ==================== 2. CUSTOMER CANCEL POLICY ====================

class TestCustomerCancel:
    @pytest.fixture(scope="class")
    def booking_id(self, tokens, db_sync):
        return _create_booking(tokens["customer"], db_sync, days_ahead=30, amount_paid=100000)

    def test_customer_cancel_applies_10pct_deduction(self, tokens, booking_id, db_sync):
        r = requests.post(f"{BASE_URL}/api/refunds/customer-cancel",
                          json={"booking_id": booking_id, "reason": "Change of plans"},
                          headers=_h(tokens["customer"]), timeout=15)
        assert r.status_code == 200, r.text[:300]
        req = r.json()["refund_request"]
        _created["refund_requests"].append(req["id"])
        assert req["deduction_pct"] == 10.0, f"expected 10%, got {req['deduction_pct']}"
        assert req["refundable_amount"] == 90000.0, f"expected 90000, got {req['refundable_amount']}"
        assert req["status"] == "pending_approval"
        assert req["initiated_by"] == "customer_cancel"
        # booking status
        b = db_sync.bookings.find_one({"id": booking_id})
        assert b["status"] == "cancellation_requested"

    def test_duplicate_customer_cancel_fails(self, tokens, booking_id):
        r = requests.post(f"{BASE_URL}/api/refunds/customer-cancel",
                          json={"booking_id": booking_id, "reason": "Change of plans"},
                          headers=_h(tokens["customer"]), timeout=10)
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text[:200]}"

    def test_other_customer_forbidden(self, tokens, db_sync):
        # Create booking under customer, try cancel with a non-owner (sales token)
        bid = _create_booking(tokens["customer"], db_sync, days_ahead=25, amount_paid=50000)
        r = requests.post(f"{BASE_URL}/api/refunds/customer-cancel",
                          json={"booking_id": bid},
                          headers=_h(tokens["sales"]), timeout=10)
        assert r.status_code == 403, f"Expected 403, got {r.status_code}"


# ==================== 3. OPERATOR CANCEL ====================

class TestOperatorCancel:
    def test_operator_cancel_without_reason_400(self, tokens, db_sync):
        bid = _create_booking(tokens["customer"], db_sync, days_ahead=20, amount_paid=80000)
        r = requests.post(f"{BASE_URL}/api/refunds/operator-cancel",
                          json={"booking_id": bid, "reason_id": "invalid-fake-id"},
                          headers=_h(tokens["operator"]), timeout=10)
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text[:200]}"

    def test_operator_cancel_with_valid_reason_full_refund(self, tokens, db_sync):
        bid = _create_booking(tokens["customer"], db_sync, days_ahead=15, amount_paid=60000)
        # Link the booking to operator@airyatra so ownership check passes
        op_user = db_sync.users.find_one({"email": "operator@airyatra.co.in"})
        op_doc = db_sync.operators.find_one({"user_id": op_user["id"]})
        assert op_doc, "operator record missing for operator@airyatra.co.in"
        db_sync.bookings.update_one({"id": bid}, {"$set": {"operator_id": op_doc["id"]}})
        db_sync.inquiries.update_one({"id": bid}, {"$set": {"operator_id": op_doc["id"]}})
        reasons = requests.get(f"{BASE_URL}/api/refunds/reasons?audience=operator",
                               headers=_h(tokens["operator"]), timeout=10).json()["reasons"]
        assert reasons, "no operator reasons"
        rid = reasons[0]["id"]
        r = requests.post(f"{BASE_URL}/api/refunds/operator-cancel",
                          json={"booking_id": bid, "reason_id": rid, "remark": "test"},
                          headers=_h(tokens["operator"]), timeout=15)
        assert r.status_code == 200, r.text[:300]
        req = r.json()["refund_request"]
        _created["refund_requests"].append(req["id"])
        assert req["deduction_pct"] == 0.0
        assert req["refundable_amount"] == 60000.0
        assert req["operator_reason"] == reasons[0]["label"]
        b = db_sync.bookings.find_one({"id": bid})
        assert b.get("operator_cancel_reason") == reasons[0]["label"]


# ==================== 4. 2-OF-5 APPROVAL WITH OTP ====================

class TestApprovalFlow:
    @pytest.fixture(scope="class")
    def refund_req(self, tokens, db_sync):
        bid = _create_booking(tokens["customer"], db_sync, days_ahead=30, amount_paid=100000)
        r = requests.post(f"{BASE_URL}/api/refunds/customer-cancel",
                          json={"booking_id": bid, "reason": "test approval flow"},
                          headers=_h(tokens["customer"]), timeout=15)
        assert r.status_code == 200, r.text[:200]
        req = r.json()["refund_request"]
        _created["refund_requests"].append(req["id"])
        return req

    def test_sales_request_otp(self, tokens, refund_req, db_sync, sales_user_id):
        r = requests.post(f"{BASE_URL}/api/refunds/{refund_req['id']}/request-otp",
                          headers=_h(tokens["sales"]), timeout=15)
        assert r.status_code == 200, f"sales OTP: {r.status_code} {r.text[:300]}"
        otp_doc = db_sync.refund_otps.find_one(
            {"user_id": sales_user_id, "request_id": refund_req["id"]})
        assert otp_doc, "OTP not stored"
        assert len(otp_doc["code"]) == 6

    def test_wrong_otp_401(self, tokens, refund_req):
        r = requests.post(f"{BASE_URL}/api/refunds/{refund_req['id']}/approve",
                          json={"otp": "000000", "remark": "test", "action": "approve"},
                          headers=_h(tokens["sales"]), timeout=10)
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text[:200]}"

    def test_sales_first_approval(self, tokens, refund_req, db_sync, sales_user_id):
        # re-request OTP because previous 401 doesn't delete it, but the code is still valid
        otp_doc = db_sync.refund_otps.find_one(
            {"user_id": sales_user_id, "request_id": refund_req["id"]})
        assert otp_doc, "sales OTP missing"
        code = otp_doc["code"]
        r = requests.post(f"{BASE_URL}/api/refunds/{refund_req['id']}/approve",
                          json={"otp": code, "remark": "1st approval", "action": "approve"},
                          headers=_h(tokens["sales"]), timeout=15)
        assert r.status_code == 200, r.text[:300]
        assert r.json()["status"] == "pending_approval"
        assert len(r.json()["approvals"]) == 1

    def test_sales_double_approve_blocked(self, tokens, refund_req, db_sync, sales_user_id):
        # new OTP request
        requests.post(f"{BASE_URL}/api/refunds/{refund_req['id']}/request-otp",
                      headers=_h(tokens["sales"]), timeout=15)
        otp_doc = db_sync.refund_otps.find_one(
            {"user_id": sales_user_id, "request_id": refund_req["id"]})
        r = requests.post(f"{BASE_URL}/api/refunds/{refund_req['id']}/approve",
                          json={"otp": otp_doc["code"], "remark": "again", "action": "approve"},
                          headers=_h(tokens["sales"]), timeout=10)
        assert r.status_code == 400, f"Expected 400 already approved, got {r.status_code}: {r.text[:200]}"

    def test_admin_second_approval_finalizes(self, tokens, refund_req, db_sync, admin_user_id):
        r = requests.post(f"{BASE_URL}/api/refunds/{refund_req['id']}/request-otp",
                          headers=_h(tokens["admin"]), timeout=15)
        assert r.status_code == 200
        otp_doc = db_sync.refund_otps.find_one(
            {"user_id": admin_user_id, "request_id": refund_req["id"]})
        assert otp_doc
        r = requests.post(f"{BASE_URL}/api/refunds/{refund_req['id']}/approve",
                          json={"otp": otp_doc["code"], "remark": "final approve", "action": "approve"},
                          headers=_h(tokens["admin"]), timeout=15)
        assert r.status_code == 200, r.text[:300]
        assert r.json()["status"] == "approved"
        # booking updated
        b = db_sync.bookings.find_one({"id": refund_req["booking_id"]})
        assert b["status"] == "cancelled"
        assert b.get("refund_status") == "approved"
        assert b.get("refund_amount") == refund_req["refundable_amount"]
        # transaction record
        txn = db_sync.refund_transactions.find_one({"refund_request_id": refund_req["id"]})
        assert txn, "refund_transaction not created"
        assert txn["method"] == "pending_gateway"


# ==================== 5. ADMIN-ONLY GATE (invoice sent) ====================

class TestAdminOnlyGate:
    def test_invoice_sent_blocks_sales(self, tokens, db_sync):
        bid = _create_booking(tokens["customer"], db_sync, days_ahead=30, amount_paid=70000)
        # simulate invoice generated
        log_key = f"{bid}:advance"
        db_sync.invoice_email_log.insert_one(
            {"booking_id": bid, "status": "sent", "key": log_key,
             "created_at": datetime.now(timezone.utc).isoformat()})
        _created["invoice_logs"].append(log_key)

        r = requests.post(f"{BASE_URL}/api/refunds/customer-cancel",
                          json={"booking_id": bid, "reason": "test admin gate"},
                          headers=_h(tokens["customer"]), timeout=15)
        assert r.status_code == 200, r.text[:200]
        req = r.json()["refund_request"]
        _created["refund_requests"].append(req["id"])
        assert req["requires_admin_only"] is True

        # sales blocked
        r_sales = requests.post(f"{BASE_URL}/api/refunds/{req['id']}/request-otp",
                                headers=_h(tokens["sales"]), timeout=10)
        assert r_sales.status_code == 403, f"sales should be blocked: {r_sales.status_code} {r_sales.text[:200]}"
        assert "Admin/CEO" in r_sales.text or "admin" in r_sales.text.lower()

        # admin allowed
        r_admin = requests.post(f"{BASE_URL}/api/refunds/{req['id']}/request-otp",
                                headers=_h(tokens["admin"]), timeout=15)
        assert r_admin.status_code == 200, r_admin.text[:200]


# ==================== 6. MANUAL PARTIAL REFUND ====================

class TestManualRefund:
    def test_manual_partial(self, tokens, db_sync):
        bid = _create_booking(tokens["customer"], db_sync, days_ahead=45, amount_paid=100000)
        r = requests.post(f"{BASE_URL}/api/refunds/manual",
                          json={"booking_id": bid, "refund_type": "partial",
                                "amount": 5000, "remark": "goodwill"},
                          headers=_h(tokens["admin"]), timeout=15)
        assert r.status_code == 200, r.text[:300]
        req = r.json()["refund_request"]
        _created["refund_requests"].append(req["id"])
        assert req["refundable_amount"] == 5000.0
        assert req["refund_type"] == "partial"

    def test_manual_over_paid_400(self, tokens, db_sync):
        bid = _create_booking(tokens["customer"], db_sync, days_ahead=40, amount_paid=10000)
        r = requests.post(f"{BASE_URL}/api/refunds/manual",
                          json={"booking_id": bid, "refund_type": "partial",
                                "amount": 999999, "remark": "over"},
                          headers=_h(tokens["admin"]), timeout=15)
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text[:200]}"


# ==================== 7. PENDING LIST RBAC ====================

class TestPendingList:
    def test_staff_can_list(self, tokens):
        r = requests.get(f"{BASE_URL}/api/refunds/pending", headers=_h(tokens["admin"]), timeout=15)
        assert r.status_code == 200, r.text[:200]
        assert "requests" in r.json()
        assert "total" in r.json()

    def test_customer_forbidden(self, tokens):
        r = requests.get(f"{BASE_URL}/api/refunds/pending", headers=_h(tokens["customer"]), timeout=10)
        assert r.status_code == 403, f"Expected 403, got {r.status_code}"
