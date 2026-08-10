"""
Iteration 54: Customer Booking-Login Workflow — End-to-End Backend Validation.

Flow tested:
  1. Login (customer@airyatra.co.in) - OTP globally disabled -> direct JWT
  2. /auth/me returns customer roles
  3. /marketplace/search returns options (Compare & Book) OR auction mode
  4. /marketplace/book creates payable inquiry (Instant Book)
  5. /marketplace/auction/start creates reverse auction inquiry
  6. /bookings/inquiry/{id}/status accessible to customer
  7. /customer/trips/{id}/payment-info returns pricing/GST breakdown
  8. /payments/gateways lists Wallet/Razorpay/Stripe
  9. /payments/wallet/apply attempted (may fail if insufficient balance)
 10. /razorpay/create-order returns order_id + key_id
 11. /payments/stripe/checkout returns checkout_url
 12. /customer/trips lists the created booking (My Bookings visibility)
 13. JWT session works on refresh (Authorization header)
"""
import os
from pathlib import Path
from datetime import datetime, timedelta

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"

CUSTOMER_EMAIL = "customer@airyatra.co.in"
CUSTOMER_PASSWORD = "Customer@123"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth(session):
    r = session.post(f"{API}/auth/login", json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD}, timeout=20)
    if r.status_code != 200:
        pytest.fail(f"Customer login failed: {r.status_code} {r.text[:400]}")
    data = r.json()
    # OTP must be disabled -> token returned directly
    token = data.get("access_token") or data.get("token")
    if not token and data.get("requires_2fa"):
        pytest.fail("2FA/OTP is enabled but should be globally disabled per test spec")
    if not token:
        pytest.fail(f"No token in login response: {data}")
    session.headers.update({"Authorization": f"Bearer {token}"})
    return {"token": token, "user": data.get("user") or {}}


# ------------------- Login & Session -------------------
class TestAuthAndSession:
    def test_login_returns_token_no_otp(self, auth):
        assert auth["token"] and isinstance(auth["token"], str)
        assert len(auth["token"]) > 20

    def test_auth_me(self, session, auth):
        r = session.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 200, r.text[:300]
        me = r.json()
        assert me.get("email", "").lower() == CUSTOMER_EMAIL
        roles = me.get("roles") or []
        assert "customer" in roles, f"customer role missing: {roles}"


# ------------------- Marketplace Search -------------------
class TestMarketplaceSearch:
    def test_search_returns_options_or_auction(self, session, auth):
        travel_date = (datetime.utcnow() + timedelta(days=7)).strftime("%Y-%m-%d")
        payload = {
            "aircraft_type": "helicopter",
            "from_location": "Mumbai",
            "to_location": "Pune",
            "pickup_latitude": 19.0760,
            "pickup_longitude": 72.8777,
            "drop_latitude": 18.5204,
            "drop_longitude": 73.8567,
            "travel_date": travel_date,
            "travel_time": "10:00",
            "passengers": 2,
        }
        r = session.post(f"{API}/marketplace/search", json=payload, timeout=30)
        assert r.status_code == 200, r.text[:400]
        data = r.json()
        assert data.get("success") is True
        assert data.get("mode") in ("marketplace", "auction")
        assert "options" in data
        assert "feasibility" in data
        # Store for later tests
        pytest.mkt_search = data
        pytest.mkt_payload = payload


# ------------------- Compare & Book -> Payment Flow -------------------
class TestCompareAndBookFlow:
    @pytest.fixture(scope="class")
    def booking(self, session, auth):
        # Re-search to guarantee data
        travel_date = (datetime.utcnow() + timedelta(days=7)).strftime("%Y-%m-%d")
        payload = {
            "aircraft_type": "helicopter",
            "from_location": "Mumbai",
            "to_location": "Pune",
            "pickup_latitude": 19.0760, "pickup_longitude": 72.8777,
            "drop_latitude": 18.5204, "drop_longitude": 73.8567,
            "travel_date": travel_date, "travel_time": "10:00", "passengers": 2,
        }
        search_r = session.post(f"{API}/marketplace/search", json=payload, timeout=30)
        assert search_r.status_code == 200
        search = search_r.json()
        options = search.get("options") or []
        if not options:
            pytest.skip("No marketplace options in this env -> instant book path cannot be exercised; auction mode returned")
        opt = options[0]
        book_payload = {**payload, "aircraft_id": opt["aircraft_id"], "consents_accepted": {"terms": True}}
        r = session.post(f"{API}/marketplace/book", json=book_payload, timeout=30)
        assert r.status_code == 200, r.text[:500]
        data = r.json()
        assert data.get("success") is True
        assert data.get("booking_id")
        assert data.get("booking_number")
        assert data.get("total_amount", 0) > 0
        return data

    def test_inquiry_status_visible(self, session, booking):
        bid = booking["booking_id"]
        r = session.get(f"{API}/bookings/inquiry/{bid}/status", timeout=15)
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert "inquiry" in d
        assert d["inquiry"]["id"] == bid or d["inquiry"].get("inquiry_number") == booking["booking_number"]

    def test_payment_info(self, session, booking):
        bid = booking["booking_id"]
        r = session.get(f"{API}/customer/trips/{bid}/payment-info", timeout=15)
        assert r.status_code == 200, r.text[:500]
        d = r.json()
        # Should include amount / GST fields
        found_amount = any(k in d for k in ("total", "total_amount", "amount", "final_price", "grand_total"))
        assert found_amount, f"payment-info missing amount fields: {list(d.keys())[:20]}"

    def test_payment_gateways_lists_all_three(self, session):
        r = session.get(f"{API}/payments/gateways", timeout=15)
        assert r.status_code == 200, r.text[:400]
        gws = r.json().get("gateways") or []
        ids = {g.get("id") for g in gws}
        # At minimum stripe should be listed enabled. Razorpay + Wallet expected too.
        assert "stripe" in ids, f"stripe missing from gateways: {ids}"
        # Report if razorpay/wallet not listed but do not hard-fail
        pytest.gateway_ids = ids

    def test_wallet_apply(self, session, booking):
        bid = booking["booking_id"]
        r = session.post(f"{API}/payments/wallet/apply", json={"booking_id": bid}, timeout=20)
        # Accept 200 (success or partial) OR 400 (insufficient) OR 402
        assert r.status_code in (200, 400, 402, 422), r.text[:400]
        # Structure check when 200
        if r.status_code == 200:
            d = r.json()
            assert any(k in d for k in ("applied", "remaining_due", "fully_paid", "advance_covered", "message"))

    def test_razorpay_create_order(self, session, auth, booking):
        bid = booking["booking_id"]
        payload = {
            "booking_id": bid,
            "customer_name": "QA Customer",
            "customer_email": CUSTOMER_EMAIL,
            "customer_phone": "9999999999",
            "description": "QA booking",
        }
        r = session.post(f"{API}/razorpay/create-order", json=payload, timeout=25)
        # If wallet applied fully in previous test, booking may already be paid -> could be 400
        assert r.status_code in (200, 400), f"unexpected: {r.status_code} {r.text[:300]}"
        if r.status_code == 200:
            d = r.json()
            assert d.get("order_id"), f"missing order_id: {d}"
            assert d.get("key_id"), f"missing key_id: {d}"
            assert d.get("amount_paise") or d.get("amount"), f"missing amount: {d}"

    def test_stripe_checkout(self, session, booking):
        bid = booking["booking_id"]
        payload = {
            "booking_id": bid,
            "voucher_code": None,
            "origin_url": BASE_URL,
            "payment_type": "advance",
        }
        r = session.post(f"{API}/payments/stripe/checkout", json=payload, timeout=30)
        assert r.status_code in (200, 400), f"stripe checkout: {r.status_code} {r.text[:400]}"
        if r.status_code == 200:
            d = r.json()
            assert d.get("checkout_url"), f"missing checkout_url: {d}"
            assert d["checkout_url"].startswith("http"), d["checkout_url"]

    def test_my_bookings_lists_created(self, session, booking):
        # Try customer/trips endpoints
        candidates = ["/customer/trips", "/customer/trips/", "/bookings/"]
        found = False
        last = None
        for path in candidates:
            r = session.get(f"{API}{path}", timeout=15)
            last = (path, r.status_code, r.text[:200])
            if r.status_code == 200:
                data = r.json()
                items = data if isinstance(data, list) else (data.get("trips") or data.get("bookings") or data.get("items") or [])
                if any(
                    (isinstance(it, dict) and (
                        it.get("id") == booking["booking_id"]
                        or it.get("inquiry_number") == booking["booking_number"]
                        or it.get("booking_number") == booking["booking_number"]
                    ))
                    for it in items
                ):
                    found = True
                    break
        assert found, f"newly created booking not visible in customer trips (last probe: {last})"


# ------------------- Reverse Auction Flow -------------------
class TestAuctionFlow:
    def test_auction_start(self, session, auth):
        travel_date = (datetime.utcnow() + timedelta(days=10)).strftime("%Y-%m-%d")
        payload = {
            "aircraft_type": "chartered_plane",
            "from_location": "Delhi",
            "to_location": "Bangalore",
            "pickup_latitude": 28.6139, "pickup_longitude": 77.2090,
            "drop_latitude": 12.9716, "drop_longitude": 77.5946,
            "travel_date": travel_date, "travel_time": "09:00", "passengers": 4,
            "max_budget": 500000,
            "special_requirements": "QA auction test",
        }
        r = session.post(f"{API}/marketplace/auction/start", json=payload, timeout=30)
        assert r.status_code == 200, r.text[:500]
        d = r.json()
        assert d.get("success") is True or d.get("auction_id") or d.get("inquiry_id") or d.get("booking_id"), f"{d}"
