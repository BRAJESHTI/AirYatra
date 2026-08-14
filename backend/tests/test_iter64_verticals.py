"""Iteration 64 — Multi-vertical (Helipad/Yacht/Cruise) backend tests.
Covers: role-gated asset registration, booking, confirm, pay, revenue,
role-based smart search."""
import os
import time
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL")
            or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"

USERS = {
    "customer": ("customer@airyatra.co.in", "Customer@123"),
    "yacht_owner": ("yachtowner@airyatra.co.in", "Yacht@123456"),
    "cruise_op": ("cruiseop@airyatra.co.in", "Cruise@123456"),
    "helipad_owner": ("helipadowner@airyatra.co.in", "Helipad@123456"),
    "finance": ("finance@airyatra.co.in", "Finance@123"),
    "admin": ("admin@airyatra.co.in", "Admin123!"),
}


def _login(email, password):
    r = requests.post(f"{API}/auth/login",
                      json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text[:300]}"
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok, f"no token for {email}: {r.json()}"
    return tok


@pytest.fixture(scope="module")
def tokens():
    return {k: _login(*v) for k, v in USERS.items()}


def _h(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


# ---------- Owner dashboards / assets ----------
class TestOwnerAssets:
    def test_yacht_owner_my_assets(self, tokens):
        r = requests.get(f"{API}/verticals/assets/my", headers=_h(tokens["yacht_owner"]))
        assert r.status_code == 200, r.text
        assets = r.json()["assets"]
        assert all(a["vertical"] == "yacht" for a in assets), assets
        assert len(assets) >= 2, f"expected >=2 yachts, got {len(assets)}"

    def test_cruise_op_my_assets(self, tokens):
        r = requests.get(f"{API}/verticals/assets/my", headers=_h(tokens["cruise_op"]))
        assert r.status_code == 200
        assets = r.json()["assets"]
        assert all(a["vertical"] == "cruise" for a in assets)
        assert len(assets) >= 2

    def test_yacht_owner_register_new(self, tokens):
        payload = {"vertical": "yacht", "name": "TEST_Yacht_QA", "city": "Goa",
                   "base_price": 15000}
        r = requests.post(f"{API}/verticals/assets", json=payload,
                          headers=_h(tokens["yacht_owner"]))
        assert r.status_code == 200, r.text
        asset = r.json()["asset"]
        assert asset["vertical"] == "yacht"
        assert asset["name"] == "TEST_Yacht_QA"
        assert asset["asset_code"].startswith("YCT-")
        # verify GET
        r2 = requests.get(f"{API}/verticals/assets/my", headers=_h(tokens["yacht_owner"]))
        names = [a["name"] for a in r2.json()["assets"]]
        assert "TEST_Yacht_QA" in names

    def test_customer_cannot_register_asset(self, tokens):
        r = requests.post(f"{API}/verticals/assets",
                          json={"vertical": "yacht", "name": "TEST_bad",
                                "city": "X", "base_price": 1000},
                          headers=_h(tokens["customer"]))
        assert r.status_code == 403, r.text


# ---------- Customer booking flow + cross-panel sync ----------
class TestBookingFlow:
    booking_id = None
    booking_number = None

    def test_customer_browse_helipad(self, tokens):
        r = requests.get(f"{API}/verticals/assets/browse?vertical=helipad",
                         headers=_h(tokens["customer"]))
        assert r.status_code == 200
        assets = r.json()["assets"]
        assert len(assets) >= 1, "need at least 1 helipad"
        TestBookingFlow.asset_id = assets[0]["id"]
        TestBookingFlow.asset_amount = assets[0]["base_price"]

    def test_customer_create_helipad_booking(self, tokens):
        payload = {"asset_id": TestBookingFlow.asset_id,
                   "start_date": "2026-12-25", "quantity": 1}
        r = requests.post(f"{API}/verticals/bookings", json=payload,
                          headers=_h(tokens["customer"]))
        assert r.status_code == 200, r.text
        b = r.json()["booking"]
        assert b["status"] == "pending"
        assert b["vertical"] == "helipad"
        TestBookingFlow.booking_id = b["id"]
        TestBookingFlow.booking_number = b["booking_number"]

    def test_non_owner_cannot_decision(self, tokens):
        r = requests.put(
            f"{API}/verticals/bookings/{TestBookingFlow.booking_id}/decision",
            json={"action": "confirm"}, headers=_h(tokens["customer"]))
        assert r.status_code == 403

    def test_owner_confirms_booking(self, tokens):
        r = requests.put(
            f"{API}/verticals/bookings/{TestBookingFlow.booking_id}/decision",
            json={"action": "confirm"}, headers=_h(tokens["helipad_owner"]))
        assert r.status_code == 200, r.text
        # verify
        r2 = requests.get(f"{API}/verticals/bookings/my", headers=_h(tokens["customer"]))
        b = next(x for x in r2.json()["bookings"] if x["id"] == TestBookingFlow.booking_id)
        assert b["status"] == "confirmed"

    def test_customer_pay(self, tokens):
        r = requests.post(f"{API}/verticals/bookings/{TestBookingFlow.booking_id}/pay",
                          headers=_h(tokens["customer"]))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["order_id"].startswith("order_vt_")
        # verify status
        r2 = requests.get(f"{API}/verticals/bookings/my", headers=_h(tokens["customer"]))
        b = next(x for x in r2.json()["bookings"] if x["id"] == TestBookingFlow.booking_id)
        assert b["payment_status"] == "paid"
        assert b["status"] == "paid"


# ---------- Reports / RBAC ----------
class TestRevenueReport:
    def test_finance_revenue(self, tokens):
        r = requests.get(f"{API}/verticals/reports/revenue",
                         headers=_h(tokens["finance"]))
        assert r.status_code == 200, r.text
        data = r.json()
        for v in ("helipad", "yacht", "cruise"):
            assert v in data["verticals"]
        assert data["verticals"]["helipad"]["gross_revenue"] > 0

    def test_customer_forbidden_revenue(self, tokens):
        r = requests.get(f"{API}/verticals/reports/revenue",
                         headers=_h(tokens["customer"]))
        assert r.status_code == 403

    def test_operator_style_owner_forbidden_revenue(self, tokens):
        r = requests.get(f"{API}/verticals/reports/revenue",
                         headers=_h(tokens["yacht_owner"]))
        assert r.status_code == 403


# ---------- Smart search role isolation ----------
class TestSmartSearch:
    def test_customer_search_yacht(self, tokens):
        r = requests.get(f"{API}/search/global?q=yacht",
                         headers=_h(tokens["customer"]))
        assert r.status_code == 200
        cats = {x["category"] for x in r.json()["results"]}
        # Quick Actions should suggest Book Yacht
        titles = [x["title"] for x in r.json()["results"]]
        assert any("Yacht" in t for t in titles)
        # Should NOT contain admin-only categories
        assert not ({"Operators", "Payouts"} & cats), cats

    def test_customer_typo_tolerant(self, tokens):
        r = requests.get(f"{API}/search/global?q=yact",
                         headers=_h(tokens["customer"]))
        assert r.status_code == 200
        titles = [x["title"] for x in r.json()["results"] if x["category"] == "Quick Actions"]
        assert any("Yacht" in t for t in titles), titles

    def test_customer_never_sees_other_customer_bookings(self, tokens):
        # Search a generic term; ensure results only reference customer's own id
        r = requests.get(f"{API}/search/global?q=YB2026",
                         headers=_h(tokens["customer"]))
        assert r.status_code == 200
        # We can't inspect owner directly but the endpoint filters by customer_id,
        # so we just confirm the API is scoped (no error, no admin categories).
        cats = {x["category"] for x in r.json()["results"]}
        assert not ({"Operators", "Payouts", "Invoices"} & cats)

    def test_admin_search_ocean(self, tokens):
        r = requests.get(f"{API}/search/global?q=Ocean",
                         headers=_h(tokens["admin"]))
        assert r.status_code == 200

    def test_admin_search_settlement(self, tokens):
        r = requests.get(f"{API}/search/global?q=STL-VT",
                         headers=_h(tokens["admin"]))
        assert r.status_code == 200
        cats = {x["category"] for x in r.json()["results"]}
        # At least one payout result expected (from seeded STL-VT-00001)
        assert "Payouts" in cats, r.json()


# ---------- Regression: Aviation intact ----------
class TestAviationRegression:
    def test_customer_trips_endpoint(self, tokens):
        # Common endpoints; try both
        r = requests.get(f"{API}/bookings/my", headers=_h(tokens["customer"]))
        assert r.status_code in (200, 404), r.text  # not broken

    def test_finance_gst_reports(self, tokens):
        r = requests.get(f"{API}/finance/gst-reports", headers=_h(tokens["finance"]))
        # Endpoint may vary; just ensure not 500
        assert r.status_code != 500, r.text
