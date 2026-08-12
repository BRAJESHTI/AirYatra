"""Iteration 57: City/Route Platform Fees - CRUD, preview, and auto-apply on quotes.

Tests:
- Admin CRUD on /api/platform-fees/ + validation + RBAC
- Preview endpoint (route rule, city rule, bidirectional match, global default fallback)
- Auto-apply on operator submit-quote (custom_quote booking end-to-end)
- Auto-apply on POST /api/quotes/ (InquiryInbox path)
- Regression: /api/marketplace/search still works
"""
import os
import time
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@airyatra.co.in", "password": "Admin123!"}
OPERATOR = {"email": "operator@airyatra.co.in", "password": "Operator@123456"}
CUSTOMER = {"email": "customer@airyatra.co.in", "password": "Customer@123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"Login failed for {creds['email']}: {r.status_code} {r.text[:400]}")
    data = r.json()
    token = data.get("access_token") or data.get("token")
    if not token:
        pytest.fail(f"No token in login response for {creds['email']}: {data}")
    return token


@pytest.fixture(scope="module")
def tokens():
    """Login each role once (rate limit friendly)."""
    t = {"admin": _login(ADMIN)}
    time.sleep(0.3)
    t["operator"] = _login(OPERATOR)
    time.sleep(0.3)
    t["customer"] = _login(CUSTOMER)
    return t


def _h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def created_rule_ids():
    return []


@pytest.fixture(scope="module", autouse=True)
def cleanup(request, tokens, created_rule_ids):
    yield
    admin_h = _h(tokens["admin"])
    for rid in created_rule_ids:
        try:
            requests.delete(f"{API}/platform-fees/{rid}", headers=admin_h, timeout=15)
        except Exception:
            pass


# ---------------------- Admin CRUD + validation ----------------------
class TestPlatformFeeCRUD:
    def test_list_requires_admin(self, tokens):
        r = requests.get(f"{API}/platform-fees/", headers=_h(tokens["customer"]), timeout=15)
        assert r.status_code == 403, f"Customer must get 403; got {r.status_code} {r.text[:300]}"

    def test_list_admin_ok(self, tokens):
        r = requests.get(f"{API}/platform-fees/", headers=_h(tokens["admin"]), timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "rules" in data and isinstance(data["rules"], list)
        assert "global_default_percent" in data
        assert isinstance(data["global_default_percent"], (int, float))

    def test_create_route_rule(self, tokens, created_rule_ids):
        # Delete any pre-existing Mumbai-Pune rules to avoid interference
        list_r = requests.get(f"{API}/platform-fees/", headers=_h(tokens["admin"]), timeout=15).json()
        for r in list_r.get("rules", []):
            if (r.get("from_city", "").lower() == "mumbai" and (r.get("to_city") or "").lower() == "pune"):
                requests.delete(f"{API}/platform-fees/{r['id']}", headers=_h(tokens["admin"]), timeout=15)

        payload = {"from_city": "Mumbai", "to_city": "Pune", "fee_type": "percent", "fee_value": 10}
        r = requests.post(f"{API}/platform-fees/", headers=_h(tokens["admin"]), json=payload, timeout=15)
        assert r.status_code == 200, r.text
        rule = r.json()["rule"]
        assert rule["from_city"] == "Mumbai"
        assert rule["to_city"] == "Pune"
        assert rule["fee_type"] == "percent"
        assert rule["fee_value"] == 10
        assert rule["active"] is True
        assert "id" in rule
        created_rule_ids.append(rule["id"])

        # Verify persistence via GET
        list_r = requests.get(f"{API}/platform-fees/", headers=_h(tokens["admin"]), timeout=15).json()
        assert any(x["id"] == rule["id"] for x in list_r["rules"])

    def test_create_city_wide_rule(self, tokens, created_rule_ids):
        payload = {"from_city": "TESTDelhi", "fee_type": "flat", "fee_value": 5000, "to_city": None}
        r = requests.post(f"{API}/platform-fees/", headers=_h(tokens["admin"]), json=payload, timeout=15)
        assert r.status_code == 200, r.text
        rule = r.json()["rule"]
        assert rule["to_city"] is None
        assert rule["fee_type"] == "flat"
        assert rule["fee_value"] == 5000
        created_rule_ids.append(rule["id"])

    def test_validation_invalid_fee_type(self, tokens):
        r = requests.post(f"{API}/platform-fees/", headers=_h(tokens["admin"]),
                          json={"from_city": "X", "fee_type": "banana", "fee_value": 5}, timeout=15)
        assert r.status_code == 400, r.text

    def test_validation_percent_over_100(self, tokens):
        r = requests.post(f"{API}/platform-fees/", headers=_h(tokens["admin"]),
                          json={"from_city": "X", "fee_type": "percent", "fee_value": 150}, timeout=15)
        assert r.status_code == 400

    def test_validation_negative_value(self, tokens):
        r = requests.post(f"{API}/platform-fees/", headers=_h(tokens["admin"]),
                          json={"from_city": "X", "fee_type": "flat", "fee_value": -100}, timeout=15)
        assert r.status_code == 400

    def test_non_admin_cannot_create(self, tokens):
        r = requests.post(f"{API}/platform-fees/", headers=_h(tokens["customer"]),
                          json={"from_city": "X", "fee_type": "percent", "fee_value": 5}, timeout=15)
        assert r.status_code == 403

    def test_toggle_active(self, tokens, created_rule_ids):
        rid = created_rule_ids[1]  # city rule
        r = requests.put(f"{API}/platform-fees/{rid}", headers=_h(tokens["admin"]),
                         json={"active": False}, timeout=15)
        assert r.status_code == 200, r.text
        # Verify persistence
        rules = requests.get(f"{API}/platform-fees/", headers=_h(tokens["admin"]), timeout=15).json()["rules"]
        target = next((x for x in rules if x["id"] == rid), None)
        assert target is not None
        assert target["active"] is False
        # Restore
        requests.put(f"{API}/platform-fees/{rid}", headers=_h(tokens["admin"]), json={"active": True}, timeout=15)


# ---------------------- Preview ----------------------
class TestPreview:
    def test_preview_route_match(self, tokens):
        r = requests.post(f"{API}/platform-fees/preview", headers=_h(tokens["operator"]),
                          json={"from_location": "Mumbai", "to_location": "Pune", "amount": 100000}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["operator_payout"] == 100000
        assert d["platform_fee"] == 10000, d
        assert d["customer_total"] == 110000
        assert d.get("rule_label") and "Mumbai" in d["rule_label"] and "Pune" in d["rule_label"]
        assert d.get("rule_source") == "route_rule"

    def test_preview_bidirectional(self, tokens):
        r = requests.post(f"{API}/platform-fees/preview", headers=_h(tokens["operator"]),
                          json={"from_location": "Pune", "to_location": "Mumbai", "amount": 100000}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["platform_fee"] == 10000, f"Bidirectional Pune->Mumbai should also match Mumbai-Pune rule: {d}"

    def test_preview_fallback_global_default(self, tokens):
        r = requests.post(f"{API}/platform-fees/preview", headers=_h(tokens["operator"]),
                          json={"from_location": "Chennai", "to_location": "Kochi", "amount": 100000}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("rule_source") == "global_default", d
        # Global default is 15% per spec
        assert d["platform_fee"] == 15000, d
        assert d["customer_total"] == 115000


# ---------------------- Auto-apply on operator submit-quote ----------------------
class TestAutoApplyOperatorQuote:
    booking_id = None
    quote_amount = 200000  # operator payout

    def test_customer_creates_custom_quote_booking(self, tokens):
        payload = {
            "from_location": "Mumbai", "to_location": "Pune",
            "trip_type": "one_way", "departure_date": "2026-10-01",
            "passengers": 2, "booking_type": "custom_quote"
        }
        r = requests.post(f"{API}/bookings/", headers=_h(tokens["customer"]), json=payload, timeout=30)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        booking = data.get("booking") or data
        assert booking.get("id"), f"Booking id missing: {data}"
        TestAutoApplyOperatorQuote.booking_id = booking["id"]

    def test_operator_submits_quote_fee_applied(self, tokens):
        assert TestAutoApplyOperatorQuote.booking_id
        r = requests.post(f"{API}/operator/submit-quote", headers=_h(tokens["operator"]),
                          json={"booking_id": TestAutoApplyOperatorQuote.booking_id,
                                "amount": TestAutoApplyOperatorQuote.quote_amount}, timeout=30)
        assert r.status_code == 200, r.text

        # Verify quote in DB via my-quotes
        my = requests.get(f"{API}/operator/my-quotes", headers=_h(tokens["operator"]), timeout=15).json()
        q = next((x for x in my.get("quotes", []) if x.get("booking_id") == TestAutoApplyOperatorQuote.booking_id), None)
        assert q is not None, f"Quote not found in my-quotes: {my}"
        # 10% fee for Mumbai-Pune
        assert q.get("operator_payout") == 200000, q
        assert q.get("platform_fee") == 20000, q
        assert q.get("amount") == 220000, q
        assert q.get("quoted_price") == 220000, q
        assert q.get("platform_fee_rule"), q


# ---------------------- Auto-apply on /api/quotes/ (InquiryInbox path) ----------------------
class TestAutoApplyQuotesRoute:
    def test_create_quote_via_quotes_route(self, tokens):
        # Create a booking (customer) so it exists in db.bookings
        r = requests.post(f"{API}/bookings/", headers=_h(tokens["customer"]),
                          json={"from_location": "Mumbai", "to_location": "Pune",
                                "trip_type": "one_way", "departure_date": "2026-11-15",
                                "passengers": 2, "booking_type": "custom_quote"}, timeout=30)
        assert r.status_code in (200, 201), r.text
        booking = (r.json().get("booking") or r.json())
        booking_id = booking["id"]

        r = requests.post(f"{API}/quotes/", headers=_h(tokens["operator"]),
                          json={"booking_id": booking_id, "aircraft_id": "mkt-ac-001",
                                "quoted_price": 100000, "validity_hours": 24}, timeout=30)
        # The endpoint may 500 if email notif errors; accept 200 as success
        assert r.status_code == 200, f"POST /api/quotes/ failed: {r.status_code} {r.text[:500]}"
        data = r.json()
        quote = data.get("quote") or {}
        assert quote.get("operator_payout") == 100000, quote
        assert quote.get("platform_fee") == 10000, quote
        assert quote.get("quoted_price") == 110000, quote
        assert quote.get("amount") == 110000, quote


# ---------------------- Regression: marketplace search ----------------------
class TestRegression:
    def test_marketplace_search(self, tokens):
        r = requests.post(f"{API}/marketplace/search", headers=_h(tokens["customer"]),
                          json={"from_location": "Mumbai", "to_location": "Pune",
                                "travel_date": "2026-10-01", "departure_date": "2026-10-01",
                                "passengers": 2, "aircraft_type": "helicopter"}, timeout=30)
        assert r.status_code == 200, f"marketplace search failed: {r.status_code} {r.text[:300]}"
