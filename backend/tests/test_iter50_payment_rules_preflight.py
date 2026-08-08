"""Iteration 50 tests: Payment Rules (admin) + Pre-flight Checklist (auth-guarded)."""
import os
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL")
            or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")

ADMIN = {"email": "admin@airyatra.co.in", "password": "Admin123!"}
CUSTOMER = {"email": "customer@airyatra.co.in", "password": "Customer@123"}
CUSTOMER2 = {"email": "loyaltytest@airyatra.co.in", "password": "Loyalty@123"}
OPERATOR = {"email": "operator@airyatra.co.in", "password": "Operator@123456"}


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"Login failed {creds['email']}: {r.status_code} {r.text[:300]}"
    data = r.json()
    token = data.get("access_token") or data.get("token") or (data.get("data") or {}).get("access_token")
    user = data.get("user") or (data.get("data") or {}).get("user") or {}
    assert token, f"No token in login response: {data}"
    return token, user


@pytest.fixture(scope="session")
def admin_auth():
    return _login(ADMIN)


@pytest.fixture(scope="session")
def customer_auth():
    return _login(CUSTOMER)


@pytest.fixture(scope="session")
def customer2_auth():
    return _login(CUSTOMER2)


@pytest.fixture(scope="session")
def operator_auth():
    return _login(OPERATOR)


def hdr(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ========== Payment Rules ==========
class TestPaymentRules:
    def test_get_requires_admin_403_for_customer(self, customer_auth):
        token, _ = customer_auth
        r = requests.get(f"{BASE_URL}/api/admin/payment-rules", headers=hdr(token), timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:200]}"

    def test_get_admin_ok(self, admin_auth):
        token, _ = admin_auth
        r = requests.get(f"{BASE_URL}/api/admin/payment-rules", headers=hdr(token), timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert "default_advance_percent" in data
        assert "payment_rules" in data
        assert isinstance(data["payment_rules"], list)

    def test_put_invalid_default_advance_400(self, admin_auth):
        token, _ = admin_auth
        r = requests.put(f"{BASE_URL}/api/admin/payment-rules",
                         json={"default_advance_percent": 30, "payment_rules": []},
                         headers=hdr(token), timeout=30)
        assert r.status_code == 400, r.text[:300]

    def test_put_invalid_rule_advance_400(self, admin_auth):
        token, _ = admin_auth
        r = requests.put(f"{BASE_URL}/api/admin/payment-rules",
                         json={"default_advance_percent": 50, "payment_rules": [
                             {"name": "TEST_bad_adv", "advance_percent": 30}
                         ]}, headers=hdr(token), timeout=30)
        assert r.status_code == 400, r.text[:300]

    def test_put_min_greater_than_max_400(self, admin_auth):
        token, _ = admin_auth
        r = requests.put(f"{BASE_URL}/api/admin/payment-rules",
                         json={"default_advance_percent": 50, "payment_rules": [
                             {"name": "TEST_bad_range", "advance_percent": 100,
                              "min_amount": 500000, "max_amount": 100000}
                         ]}, headers=hdr(token), timeout=30)
        assert r.status_code == 400, r.text[:300]

    def test_put_and_preview_resolution(self, admin_auth):
        token, _ = admin_auth
        # Set 3 rules: high-value route Mumbai->Pune 100%, medical 25%, priority ordering
        rules_payload = {
            "default_advance_percent": 50,
            "payment_rules": [
                {"name": "TEST_high_value_mum_pune", "active": True, "priority": 10,
                 "route_from": "Mumbai", "route_to": "Pune",
                 "min_amount": 500000, "advance_percent": 100, "allow_emi": False},
                {"name": "TEST_medical_25", "active": True, "priority": 20,
                 "purpose": "medical", "advance_percent": 25, "allow_emi": True},
                {"name": "TEST_lowprio_75", "active": True, "priority": 99,
                 "advance_percent": 75},
            ],
        }
        r = requests.put(f"{BASE_URL}/api/admin/payment-rules", json=rules_payload,
                         headers=hdr(token), timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert r.json().get("rules_count") == 3

        # Preview 1: Mumbai->Pune 600000 => rule 1 (100%)
        p = requests.post(f"{BASE_URL}/api/admin/payment-rules/preview",
                          json={"pickup_location": "Mumbai BOM", "drop_location": "Pune PNQ",
                                "booking_purpose": "leisure", "total_amount": 600000},
                          headers=hdr(token), timeout=30)
        assert p.status_code == 200, p.text[:300]
        d = p.json()
        assert d["advance_percent"] == 100, d
        assert d["rule_name"] == "TEST_high_value_mum_pune"
        assert d["advance_amount"] == 600000

        # Preview 2: medical booking => rule 2 (25%, EMI)
        p2 = requests.post(f"{BASE_URL}/api/admin/payment-rules/preview",
                           json={"pickup_location": "Delhi", "drop_location": "Jaipur",
                                 "booking_purpose": "medical", "total_amount": 100000},
                           headers=hdr(token), timeout=30)
        assert p2.status_code == 200
        d2 = p2.json()
        assert d2["advance_percent"] == 25, d2
        assert d2["allow_emi"] is True

        # Preview 3: no match to specific -> lowest priority active generic rule 75%
        p3 = requests.post(f"{BASE_URL}/api/admin/payment-rules/preview",
                           json={"pickup_location": "Chennai", "drop_location": "Bangalore",
                                 "booking_purpose": "leisure", "total_amount": 50000},
                           headers=hdr(token), timeout=30)
        assert p3.status_code == 200
        d3 = p3.json()
        # rule 3 has no criteria so it matches everything -> 75%
        assert d3["advance_percent"] == 75, d3

        # Priority: mumbai->pune 100k (below min_amount) -> should NOT match rule1 -> match rule3 (75%)
        p4 = requests.post(f"{BASE_URL}/api/admin/payment-rules/preview",
                           json={"pickup_location": "Mumbai", "drop_location": "Pune",
                                 "booking_purpose": "leisure", "total_amount": 100000},
                           headers=hdr(token), timeout=30)
        assert p4.status_code == 200
        assert p4.json()["advance_percent"] == 75

    def test_reset_rules_cleanup(self, admin_auth):
        """CRITICAL: reset rules to empty default 50% so live flows continue."""
        token, _ = admin_auth
        r = requests.put(f"{BASE_URL}/api/admin/payment-rules",
                         json={"default_advance_percent": 50, "payment_rules": []},
                         headers=hdr(token), timeout=30)
        assert r.status_code == 200
        # Verify
        g = requests.get(f"{BASE_URL}/api/admin/payment-rules", headers=hdr(token), timeout=30)
        assert g.status_code == 200
        gd = g.json()
        assert gd["default_advance_percent"] == 50
        assert gd["payment_rules"] == []

    def test_fallback_default_when_no_rules(self, admin_auth):
        token, _ = admin_auth
        p = requests.post(f"{BASE_URL}/api/admin/payment-rules/preview",
                          json={"pickup_location": "Mumbai", "drop_location": "Pune",
                                "booking_purpose": "leisure", "total_amount": 200000},
                          headers=hdr(token), timeout=30)
        assert p.status_code == 200
        assert p.json()["advance_percent"] == 50


# ========== Pre-flight Checklist ==========
def _get_customer_booking(token):
    """Fetch a booking id owned by the customer for testing."""
    r = requests.get(f"{BASE_URL}/api/customer/trips", headers=hdr(token), timeout=30)
    if r.status_code == 200:
        data = r.json()
        items = data if isinstance(data, list) else (data.get("trips") or data.get("bookings") or data.get("data") or [])
        # Prefer confirmed/payment_completed for realism, else any
        for b in items:
            if b.get("status") in ("confirmed", "payment_completed"):
                return b["id"]
        for b in items:
            if b.get("id"):
                return b["id"]
    return None


class TestPreflight:
    @pytest.fixture(scope="class")
    def booking_id(self, customer_auth):
        token, _ = customer_auth
        bid = _get_customer_booking(token)
        if not bid:
            pytest.skip("No booking available for customer; cannot test preflight")
        return bid

    def test_get_checklist_no_auth_401(self, booking_id):
        r = requests.get(f"{BASE_URL}/api/preflight/checklist/{booking_id}?checklist_type=passenger",
                         timeout=30)
        # PROBLEM: current code does NOT require auth on GET checklist.
        # Expected 401/403, actually returns 200. Assert and let it fail to report.
        assert r.status_code in (401, 403), f"GET /preflight/checklist missing auth guard! status={r.status_code}"

    def test_get_checklist_owner_ok(self, customer_auth, booking_id):
        token, _ = customer_auth
        r = requests.get(f"{BASE_URL}/api/preflight/checklist/{booking_id}?checklist_type=passenger",
                         headers=hdr(token), timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data.get("success") is True
        assert len(data["items"]) == 12
        assert "progress" in data
        cats = {i["category"] for i in data["items"]}
        assert {"Identity", "Baggage", "Health", "Safety", "Contact", "Special"} == cats

    def test_get_checklist_other_customer_403(self, customer2_auth, booking_id):
        token, _ = customer2_auth
        r = requests.get(f"{BASE_URL}/api/preflight/checklist/{booking_id}?checklist_type=passenger",
                         headers=hdr(token), timeout=30)
        # Currently endpoint has no auth so this will pass with 200 -> should be 403
        assert r.status_code == 403, f"Other-customer read should be 403, got {r.status_code}"

    def test_update_passenger_item_owner_ok(self, customer_auth, booking_id):
        token, _ = customer_auth
        r = requests.post(f"{BASE_URL}/api/preflight/checklist/update",
                          json={"booking_id": booking_id, "checklist_type": "passenger",
                                "item_id": "p1", "checked": True},
                          headers=hdr(token), timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert r.json().get("success") is True

        # Verify persistence
        g = requests.get(f"{BASE_URL}/api/preflight/checklist/{booking_id}?checklist_type=passenger",
                         headers=hdr(token), timeout=30)
        items = g.json()["items"]
        p1 = next(i for i in items if i["id"] == "p1")
        assert p1["checked"] is True

    def test_update_aircraft_type_customer_forbidden(self, customer_auth, booking_id):
        token, _ = customer_auth
        r = requests.post(f"{BASE_URL}/api/preflight/checklist/update",
                          json={"booking_id": booking_id, "checklist_type": "aircraft",
                                "item_id": "a1", "checked": True},
                          headers=hdr(token), timeout=30)
        assert r.status_code == 403, f"Customer should not update aircraft checklist, got {r.status_code}"

    def test_update_aircraft_operator_ok(self, operator_auth, booking_id):
        token, _ = operator_auth
        r = requests.post(f"{BASE_URL}/api/preflight/checklist/update",
                          json={"booking_id": booking_id, "checklist_type": "aircraft",
                                "item_id": "a1", "checked": True},
                          headers=hdr(token), timeout=30)
        assert r.status_code == 200, r.text[:300]

    def test_update_other_customer_passenger_forbidden(self, customer2_auth, booking_id):
        token, _ = customer2_auth
        r = requests.post(f"{BASE_URL}/api/preflight/checklist/update",
                          json={"booking_id": booking_id, "checklist_type": "passenger",
                                "item_id": "p2", "checked": True},
                          headers=hdr(token), timeout=30)
        assert r.status_code == 403, r.text[:300]

    def test_status_owner_ok(self, customer_auth, booking_id):
        token, _ = customer_auth
        r = requests.get(f"{BASE_URL}/api/preflight/status/{booking_id}",
                         headers=hdr(token), timeout=30)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert "passenger_checklist" in d and "aircraft_checklist" in d
        assert "overall_ready" in d

    def test_status_other_customer_403(self, customer2_auth, booking_id):
        token, _ = customer2_auth
        r = requests.get(f"{BASE_URL}/api/preflight/status/{booking_id}",
                         headers=hdr(token), timeout=30)
        assert r.status_code == 403, r.text[:300]

    def test_status_no_auth_401(self, booking_id):
        r = requests.get(f"{BASE_URL}/api/preflight/status/{booking_id}", timeout=30)
        assert r.status_code in (401, 403), r.text[:300]
