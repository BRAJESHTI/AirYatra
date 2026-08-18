"""Iter-77: Customer Portal FINAL UI & Workflow Correction — backend coverage.

Covers:
- /verticals/service-categories GET (customer) + PUT admin (403 for customer)
- /verticals/assets/{id}/availability shape (all new fields)
- /verticals/assets/{id} PUT as owner persists booking-setup fields
- /verticals/assets/{id}/quote math (operator + package + additional + total)
- /verticals/assets/{id}/check-availability + double-booking lock via POST /bookings
- min_duration enforcement on POST /bookings
- Booking response contains start_time/guests/package + price_breakup, amount==total
- /refunds/my details object for completed refund (YB2026080009) + shape validation
"""
import os
import sys
import asyncio
import uuid
from datetime import datetime, timezone, timedelta
import pytest
import requests
from dotenv import dotenv_values

sys.path.insert(0, "/app/backend")

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env["REACT_APP_BACKEND_URL"]).rstrip("/")
API = f"{BASE_URL}/api"

CUSTOMER = {"email": "customer@airyatra.co.in", "password": "Customer@123"}
ADMIN = {"email": "admin@airyatra.co.in", "password": "Adm@Air123"}
OWNER = {"email": "yachtowner@airyatra.co.in", "password": "Yacht@123456"}


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


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def customer_token():
    data = _login_direct(**CUSTOMER)
    assert not data.get("otp_required")
    return data["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return _run(_mint_otp_and_verify(ADMIN["email"], ADMIN["password"]))


@pytest.fixture(scope="module")
def owner_token():
    data = _login_direct(**OWNER)
    assert not data.get("otp_required"), f"Owner unexpectedly required OTP: {data}"
    return data["access_token"]


@pytest.fixture(scope="module")
def a_yacht_asset(customer_token):
    r = requests.get(f"{API}/verticals/assets/browse?vertical=yacht",
                     headers=_h(customer_token), timeout=30)
    assert r.status_code == 200
    assets = r.json()["assets"]
    assert assets, "No yacht assets seeded"
    # Prefer the yacht owned by yachtowner (Ocean Pearl 55ft)
    for a in assets:
        if "Ocean Pearl" in a.get("name", ""):
            return a
    return assets[0]


# ==================== SERVICE CATEGORIES ====================

class TestServiceCategories:
    def test_customer_get_defaults_all_true(self, customer_token):
        r = requests.get(f"{API}/verticals/service-categories", headers=_h(customer_token), timeout=30)
        assert r.status_code == 200, r.text
        cats = r.json()["categories"]
        for k in ("helicopter", "private_jet", "yacht", "cruise", "helipad"):
            assert k in cats, f"missing category {k}"
            assert cats[k] is True, f"{k} default not true"

    def test_customer_cannot_update(self, customer_token):
        r = requests.put(f"{API}/verticals/admin/service-categories",
                         headers=_h(customer_token),
                         json={"categories": {"cruise": False}}, timeout=30)
        assert r.status_code == 403, f"Customer PUT expected 403, got {r.status_code}"

    def test_admin_update_persists_and_customer_sees(self, admin_token, customer_token):
        # Toggle cruise off
        r = requests.put(f"{API}/verticals/admin/service-categories",
                         headers=_h(admin_token),
                         json={"categories": {"helicopter": True, "private_jet": True,
                                              "yacht": True, "cruise": False, "helipad": True}},
                         timeout=30)
        assert r.status_code == 200, r.text
        try:
            r2 = requests.get(f"{API}/verticals/service-categories", headers=_h(customer_token), timeout=30)
            cats = r2.json()["categories"]
            assert cats["cruise"] is False
            assert cats["yacht"] is True
        finally:
            # Restore all true
            requests.put(f"{API}/verticals/admin/service-categories",
                         headers=_h(admin_token),
                         json={"categories": {"helicopter": True, "private_jet": True,
                                              "yacht": True, "cruise": True, "helipad": True}},
                         timeout=30)


# ==================== ASSET AVAILABILITY SHAPE ====================

class TestAssetAvailabilityShape:
    def test_availability_returns_all_fields(self, customer_token, a_yacht_asset):
        r = requests.get(f"{API}/verticals/assets/{a_yacht_asset['id']}/availability",
                         headers=_h(customer_token), timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("blocked_dates", "booked_ranges", "fully_booked_dates", "max_capacity",
                  "available_slots", "packages", "additional_charges", "facilities",
                  "special_conditions"):
            assert k in body, f"missing {k} in availability response"


# ==================== OWNER BOOKING SETUP PERSIST ====================

class TestOwnerBookingSetupPersist:
    def test_owner_update_setup_fields_persists(self, owner_token, customer_token):
        # Fetch owner's own asset
        r = requests.get(f"{API}/verticals/assets/my", headers=_h(owner_token), timeout=30)
        assert r.status_code == 200, r.text
        my_assets = r.json()["assets"]
        yacht = next((a for a in my_assets if a["vertical"] == "yacht"), None)
        assert yacht, "yachtowner has no yacht asset"
        asset_id = yacht["id"]

        # Update setup
        payload = {
            "available_slots": ["06:00", "09:00"],
            "min_duration": 2,
            "max_capacity": 1,
            "packages": [{"name": "Party Package", "price": 500}],
            "additional_charges": [{"label": "Port Charges", "amount": 100}],
            "facilities": ["Crew", "BBQ"],
            "special_conditions": "Weather dependent",
        }
        u = requests.put(f"{API}/verticals/assets/{asset_id}",
                         headers=_h(owner_token), json=payload, timeout=30)
        assert u.status_code == 200, u.text

        # Verify via availability endpoint (customer view)
        av = requests.get(f"{API}/verticals/assets/{asset_id}/availability",
                          headers=_h(customer_token), timeout=30).json()
        assert av["available_slots"] == ["06:00", "09:00"]
        assert av["min_duration"] == 2
        assert av["max_capacity"] == 1
        assert any(p.get("name") == "Party Package" and float(p.get("price")) == 500
                   for p in av["packages"])
        assert any(c.get("label") == "Port Charges" and float(c.get("amount")) == 100
                   for c in av["additional_charges"])
        assert "Crew" in av["facilities"] and "BBQ" in av["facilities"]
        assert av["special_conditions"] == "Weather dependent"


# ==================== QUOTE MATH ====================

class TestQuoteMath:
    def test_quote_breakup_math(self, customer_token, owner_token):
        # Use owner's yacht (with setup applied above): base_price=15000
        r = requests.get(f"{API}/verticals/assets/my", headers=_h(owner_token), timeout=30)
        yacht = next(a for a in r.json()["assets"] if a["vertical"] == "yacht")
        asset_id = yacht["id"]
        base = float(yacht["base_price"])

        # Use far-future date to avoid deal + seasonal complications
        future = (datetime.now(timezone.utc) + timedelta(days=120)).strftime("%Y-%m-%d")
        q = requests.get(f"{API}/verticals/assets/{asset_id}/quote",
                         params={"start_date": future, "quantity": 2, "package": "Party Package"},
                         headers=_h(customer_token), timeout=30)
        assert q.status_code == 200, q.text
        b = q.json()["breakup"]
        assert b["operator_charges"] == round(base * 2, 2), \
            f"operator_charges expected {base*2}, got {b['operator_charges']}"
        assert b["package_price"] == 500.0
        assert b["additional_total"] == 100.0
        # platform_fee/taxes default to 0 in this setup
        expected_pre = round(b["operator_charges"] + b["seasonal_adjustment"] +
                             b["deal_discount"] + 500 + 100, 2)
        expected_total = round(expected_pre + b["platform_fee"] + b["taxes"], 2)
        assert b["total"] == expected_total, \
            f"total mismatch: got {b['total']}, expected {expected_total}"


# ==================== CHECK-AVAILABILITY + DOUBLE-BOOKING LOCK ====================

class TestAvailabilityAndDoubleBookingLock:
    def test_free_future_date_available(self, customer_token, owner_token):
        r = requests.get(f"{API}/verticals/assets/my", headers=_h(owner_token), timeout=30)
        yacht = next(a for a in r.json()["assets"] if a["vertical"] == "yacht")
        future = (datetime.now(timezone.utc) + timedelta(days=200)).strftime("%Y-%m-%d")
        ck = requests.get(f"{API}/verticals/assets/{yacht['id']}/check-availability",
                          params={"start_date": future},
                          headers=_h(customer_token), timeout=30)
        assert ck.status_code == 200, ck.text
        body = ck.json()
        assert body["available"] is True
        assert "Available" in body["message"]

    def test_blocked_date_returns_unavailable(self, customer_token, owner_token):
        # Fetch asset, add a blocked date, check, then clean up
        r = requests.get(f"{API}/verticals/assets/my", headers=_h(owner_token), timeout=30)
        yacht = next(a for a in r.json()["assets"] if a["vertical"] == "yacht")
        asset_id = yacht["id"]
        blocked_date = (datetime.now(timezone.utc) + timedelta(days=250)).strftime("%Y-%m-%d")
        # Set blocked_dates via owner PUT (blocked_dates is in allowed set)
        u = requests.put(f"{API}/verticals/assets/{asset_id}",
                         headers=_h(owner_token),
                         json={"blocked_dates": [blocked_date]}, timeout=30)
        assert u.status_code == 200
        try:
            ck = requests.get(f"{API}/verticals/assets/{asset_id}/check-availability",
                              params={"start_date": blocked_date},
                              headers=_h(customer_token), timeout=30).json()
            assert ck["available"] is False
            assert "blocked" in (ck.get("reason") or "").lower()
        finally:
            requests.put(f"{API}/verticals/assets/{asset_id}",
                         headers=_h(owner_token),
                         json={"blocked_dates": []}, timeout=30)

    def test_min_duration_enforcement_on_booking(self, customer_token, owner_token):
        r = requests.get(f"{API}/verticals/assets/my", headers=_h(owner_token), timeout=30)
        yacht = next(a for a in r.json()["assets"] if a["vertical"] == "yacht")
        # min_duration=2 was set earlier — booking with quantity=1 must fail
        future = (datetime.now(timezone.utc) + timedelta(days=210)).strftime("%Y-%m-%d")
        b = requests.post(f"{API}/verticals/bookings",
                          headers=_h(customer_token),
                          json={"asset_id": yacht["id"], "start_date": future,
                                "quantity": 1}, timeout=30)
        assert b.status_code == 400, f"expected 400 for min_duration violation, got {b.status_code}"
        assert "minimum" in b.text.lower() or "duration" in b.text.lower()

    def test_booking_persists_all_fields_and_double_booking_lock(self, customer_token, owner_token):
        r = requests.get(f"{API}/verticals/assets/my", headers=_h(owner_token), timeout=30)
        yacht = next(a for a in r.json()["assets"] if a["vertical"] == "yacht")
        asset_id = yacht["id"]
        # max_capacity=1 (set earlier)
        future = (datetime.now(timezone.utc) + timedelta(days=230)).strftime("%Y-%m-%d")

        payload = {"asset_id": asset_id, "start_date": future, "quantity": 2,
                   "start_time": "06:00", "guests": 8, "package": "Party Package"}
        b1 = requests.post(f"{API}/verticals/bookings",
                           headers=_h(customer_token), json=payload, timeout=30)
        assert b1.status_code == 200, f"First booking failed: {b1.status_code} {b1.text[:300]}"
        booking = b1.json()["booking"]
        booking_id = booking["id"]
        try:
            # Verify persisted fields
            assert booking["start_time"] == "06:00"
            assert booking["guests"] == 8
            assert booking["package"] == "Party Package"
            assert "price_breakup" in booking and isinstance(booking["price_breakup"], dict)
            assert booking["amount"] == booking["price_breakup"]["total"], \
                "booking.amount must equal breakup.total"

            # Second booking same date — max_capacity=1 → must fail
            b2 = requests.post(f"{API}/verticals/bookings",
                               headers=_h(customer_token), json=payload, timeout=30)
            assert b2.status_code == 400, \
                f"Double-booking lock failed: got {b2.status_code} {b2.text[:300]}"
            assert "not available" in b2.text.lower() or "fully booked" in b2.text.lower()
        finally:
            # Cleanup: delete the created booking directly via Mongo
            _run(_delete_booking(booking_id))


async def _delete_booking(booking_id):
    from database import connect_to_mongo, get_database
    await connect_to_mongo()
    db = get_database()
    await db.vertical_bookings.delete_one({"id": booking_id})


# ==================== REFUND /my DETAILS SHAPE ====================

class TestRefundMyDetails:
    def test_refund_my_has_details_object(self, customer_token):
        r = requests.get(f"{API}/refunds/my", headers=_h(customer_token), timeout=30)
        assert r.status_code == 200, r.text
        refunds = r.json()["refunds"]
        assert refunds, "customer has no refunds — cannot validate details shape"
        for ref in refunds:
            assert "details" in ref, f"details missing for {ref.get('booking_ref')}"
            d = ref["details"]
            for k in ("request_id", "requested_at", "reason", "requested_by",
                      "amount_paid", "cancellation_charges", "deduction_pct",
                      "refund_eligible_amount", "refund_status", "refund_method",
                      "approvals", "decision", "expected_timeline",
                      "refund_credited_at", "refund_reference_id"):
                assert k in d, f"details.{k} missing in refund for {ref.get('booking_ref')}"
            assert isinstance(d["approvals"], list)

    def test_completed_refund_yb2026080009_status(self, customer_token):
        r = requests.get(f"{API}/refunds/my", headers=_h(customer_token), timeout=30)
        refunds = r.json()["refunds"]
        target = next((x for x in refunds if x.get("booking_ref") == "YB2026080009"), None)
        if not target:
            pytest.skip("YB2026080009 not in customer refunds")
        d = target["details"]
        assert d["refund_status"] == "Refund Completed", \
            f"Expected 'Refund Completed', got {d['refund_status']}"
        assert d["decision"] == "Approved"
        assert d["refund_credited_at"] is not None
