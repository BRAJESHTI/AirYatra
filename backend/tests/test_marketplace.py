"""Phase 1: Hybrid Marketplace Booking - backend E2E tests
Covers: search modes, ferry/repositioning math, instant book + Stripe checkout,
reverse auction e2e (start -> operator quote -> live poll -> accept), 403 security.
"""
import os
import re
from datetime import datetime, timedelta
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")

CUSTOMER = {"email": "customer@airyatra.co.in", "password": "Customer@123"}
OPERATOR = {"email": "operator@airyatra.co.in", "password": "Operator@123456"}
SECOND_CUSTOMER = {"email": "loyaltytest@airyatra.co.in", "password": "Loyalty@123"}

TRAVEL_DATE = (datetime.utcnow() + timedelta(days=15)).strftime("%Y-%m-%d")
AUCTION_TRAVEL_DATE = (datetime.utcnow() + timedelta(days=17)).strftime("%Y-%m-%d")


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"Login {email} failed: {r.status_code} {r.text[:200]}")
    data = r.json()
    token = data.get("access_token") or data.get("token")
    if not token:
        pytest.fail(f"No token in login response for {email}: {data}")
    return token


@pytest.fixture(scope="module")
def customer_token():
    return _login(**CUSTOMER)


@pytest.fixture(scope="module")
def operator_token():
    return _login(**OPERATOR)


@pytest.fixture(scope="module")
def second_customer_token():
    return _login(**SECOND_CUSTOMER)


@pytest.fixture(scope="module")
def customer_headers(customer_token):
    return {"Authorization": f"Bearer {customer_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def operator_headers(operator_token):
    return {"Authorization": f"Bearer {operator_token}", "Content-Type": "application/json"}


HELI_SEARCH = {
    "aircraft_type": "helicopter",
    "from_location": "Mumbai",
    "to_location": "Delhi",
    "pickup_latitude": 19.0989,
    "pickup_longitude": 72.8347,
    "drop_latitude": 28.5562,
    "drop_longitude": 77.1,
    "travel_date": TRAVEL_DATE,
    "passengers": 3,
}


class TestMarketplaceSearch:
    """Marketplace search + repositioning ferry math"""

    def test_helicopter_marketplace_search(self, customer_headers):
        r = requests.post(f"{BASE_URL}/api/marketplace/search", json=HELI_SEARCH, headers=customer_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["mode"] == "marketplace"
        assert data["options_count"] >= 4, f"Expected 4+ helicopter options, got {data['options_count']}"
        opts = data["options"]
        # exactly one AI recommended
        ai_flags = [o for o in opts if o.get("ai_recommended")]
        assert len(ai_flags) == 1, f"Expected 1 ai_recommended, got {len(ai_flags)}"
        assert ai_flags[0].get("ai_reason", "").startswith("AI Pick")
        # pricing fields
        for o in opts:
            p = o["pricing"]
            for k in ("base_fare", "ferry_km", "ferry_charge", "convenience_fee", "gst", "total"):
                assert k in p, f"Missing {k} in {o['aircraft_id']}"
        assert data["price_lock_minutes"] == 15
        assert data["auction_duration_minutes"] == 20

    def test_repositioning_ferry_charges(self, customer_headers):
        r = requests.post(f"{BASE_URL}/api/marketplace/search", json=HELI_SEARCH, headers=customer_headers, timeout=30)
        data = r.json()
        by_id = {o["aircraft_id"]: o for o in data["options"]}

        # mkt-ac-001 = Airbus H125 Mumbai-based -> ferry 0
        assert by_id["mkt-ac-001"]["pricing"]["ferry_charge"] == 0

        # mkt-ac-002 = Bell 407GXi Pune -> ~127km -> ~6350
        bell = by_id["mkt-ac-002"]["pricing"]
        assert 5500 <= bell["ferry_charge"] <= 7500, f"Bell ferry {bell['ferry_charge']}"

        # mkt-ac-003 = Agusta AW109 Delhi -> ~1137km * 50 = ~56865
        ag = by_id["mkt-ac-003"]["pricing"]
        assert 55000 <= ag["ferry_charge"] <= 58500, f"Agusta ferry {ag['ferry_charge']}"

    def test_invalid_aircraft_type_400(self, customer_headers):
        body = {**HELI_SEARCH, "aircraft_type": "rocket"}
        r = requests.post(f"{BASE_URL}/api/marketplace/search", json=body, headers=customer_headers, timeout=30)
        assert r.status_code == 400

    def test_cargo_forces_auction_mode(self, customer_headers):
        # capacity 2 only, so passengers=5 forces zero options -> auction mode
        body = {
            "aircraft_type": "cargo",
            "from_location": "Jaipur",
            "to_location": "Leh",
            "pickup_latitude": 26.9,
            "pickup_longitude": 75.8,
            "drop_latitude": 34.1,
            "drop_longitude": 77.5,
            "travel_date": TRAVEL_DATE,
            "passengers": 5,
        }
        r = requests.post(f"{BASE_URL}/api/marketplace/search", json=body, headers=customer_headers, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["mode"] == "auction", data
        assert data["options_count"] == 0


class TestInstantBooking:
    """Instant book -> Stripe checkout with 50% advance"""

    def test_instant_book_creates_MKT_booking_and_stripe_checkout(self, customer_headers):
        body = {**HELI_SEARCH, "aircraft_id": "mkt-ac-001",
                "consents_accepted": {"terms": True, "cancellation": True, "safety": True,
                                      "kyc": True, "payment": True}}
        r = requests.post(f"{BASE_URL}/api/marketplace/book", json=body, headers=customer_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        assert data["booking_number"].startswith("MKT")
        booking_id = data["booking_id"]
        assert data["total_amount"] > 0
        # 15 min lock
        expires = datetime.fromisoformat(data["price_lock_expires_at"].replace("Z", "+00:00"))
        delta = (expires - datetime.now(expires.tzinfo)).total_seconds() / 60
        assert 13 <= delta <= 16, f"Lock delta {delta} min"

        # Stripe checkout - 50% advance
        chk = requests.post(
            f"{BASE_URL}/api/payments/stripe/checkout",
            json={"booking_id": booking_id, "origin_url": BASE_URL},
            headers=customer_headers, timeout=45,
        )
        assert chk.status_code == 200, f"Stripe: {chk.status_code} {chk.text[:300]}"
        cd = chk.json()
        checkout_url = cd.get("checkout_url") or cd.get("url")
        assert checkout_url and "stripe" in checkout_url.lower(), cd
        # 50% advance heuristic: amount ~= total/2
        amt = cd.get("amount") or cd.get("amount_total")
        if amt:
            expected_half = data["total_amount"] / 2
            # amount may be in paise (integer) or rupees
            if amt > data["total_amount"]:
                amt = amt / 100
            assert abs(amt - expected_half) / expected_half < 0.05, f"advance {amt} vs half {expected_half}"


class TestAuctionE2E:
    """Reverse auction: start -> operator quote -> live poll -> accept"""

    auction_id = None
    quote_id = None
    unique_dest = "Kargil"  # avoid conflict with earlier Jaipur->Leh auction

    def test_1_start_auction(self, customer_headers):
        body = {
            "aircraft_type": "cargo",
            "from_location": "Jaipur",
            "to_location": self.__class__.unique_dest,
            "pickup_latitude": 26.9,
            "pickup_longitude": 75.8,
            "drop_latitude": 34.56,
            "drop_longitude": 76.13,
            "travel_date": AUCTION_TRAVEL_DATE,
            "passengers": 5,
        }
        r = requests.post(f"{BASE_URL}/api/marketplace/auction/start", json=body, headers=customer_headers, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["duration_minutes"] == 20
        self.__class__.auction_id = d["auction_id"]

    def test_2_operator_submits_quote(self, operator_headers):
        assert self.__class__.auction_id
        body = {
            "aircraft_type": "cargo",
            "aircraft_model": "Test Cargo Aircraft",
            "aircraft_registration": "VT-TEST",
            "base_price": 200000,
            "operator_notes": "Test quote",
        }
        r = requests.post(f"{BASE_URL}/api/auctions/{self.__class__.auction_id}/quote",
                          json=body, headers=operator_headers, timeout=30)
        assert r.status_code in (200, 201), r.text
        d = r.json()
        # Best-effort capture of quote_id
        qid = d.get("quote_id") or (d.get("quote") or {}).get("id") or d.get("id")
        self.__class__.quote_id = qid

    def test_3_live_state_has_quote_with_operator_name(self, customer_headers):
        assert self.__class__.auction_id
        r = requests.get(f"{BASE_URL}/api/marketplace/auction/{self.__class__.auction_id}/live",
                         headers=customer_headers, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "active"
        assert d["seconds_left"] > 0
        assert d["quotes_count"] >= 1, d
        q0 = d["quotes"][0]
        assert q0.get("operator_name") and q0["operator_name"] != "Unknown", q0
        if not self.__class__.quote_id:
            self.__class__.quote_id = q0.get("id")

    def test_4_second_customer_forbidden(self, second_customer_token):
        h = {"Authorization": f"Bearer {second_customer_token}"}
        r = requests.get(f"{BASE_URL}/api/marketplace/auction/{self.__class__.auction_id}/live",
                         headers=h, timeout=30)
        assert r.status_code == 403

        r2 = requests.post(
            f"{BASE_URL}/api/marketplace/auction/{self.__class__.auction_id}/accept/{self.__class__.quote_id}",
            json={"consents_accepted": {"terms": True}}, headers=h, timeout=30,
        )
        assert r2.status_code == 403

    def test_5_accept_quote_creates_payable_booking(self, customer_headers):
        assert self.__class__.quote_id
        r = requests.post(
            f"{BASE_URL}/api/marketplace/auction/{self.__class__.auction_id}/accept/{self.__class__.quote_id}",
            json={"consents_accepted": {"terms": True, "cancellation": True}},
            headers=customer_headers, timeout=30,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["success"] is True
        assert d["booking_number"].startswith("MKT")
        # Quote total_amount includes GST/fees layered by auction quote endpoint
        assert d["total_amount"] >= 200000
        assert "/customer/payment/" in d["payment_url"]

    def test_6_live_after_accept_shows_quote_selected(self, customer_headers):
        r = requests.get(f"{BASE_URL}/api/marketplace/auction/{self.__class__.auction_id}/live",
                         headers=customer_headers, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "quote_selected"
        assert d["selected_quote_id"] == self.__class__.quote_id
