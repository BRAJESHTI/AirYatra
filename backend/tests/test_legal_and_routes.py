"""
Phase 1 - Hybrid Smart Pricing & Legal Consents tests
Tests: legal content endpoints, consent recording, fixed route pricing
"""
import os
import sys
from datetime import datetime, timedelta

import pytest
import requests
from dotenv import dotenv_values

# Ensure backend imports resolvable for JWT generation
sys.path.insert(0, "/app/backend")

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")

backend_env = dotenv_values("/app/backend/.env")
JWT_SECRET = backend_env.get("JWT_SECRET_KEY")
JWT_ALG = backend_env.get("JWT_ALGORITHM", "HS256")

from jose import jwt  # noqa: E402

OPERATOR_USER_ID = "80fd3f1d-b6de-48c7-adf4-48df7ea849d7"
ADMIN_USER_ID = "601a4741-f347-4ce8-845e-6cbd91bf9a78"
OPERATOR_ID = "648078cf-b730-4028-b1a3-2671655c4113"
OPERATOR_AIRCRAFT_ID = "06bd5533-c0af-4d63-89eb-3009e2d8f588"


def make_token(user_id, roles):
    payload = {
        "sub": user_id,
        "roles": roles,
        "exp": datetime.utcnow() + timedelta(hours=1),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def operator_headers():
    return {"Authorization": f"Bearer {make_token(OPERATOR_USER_ID, ['operator'])}"}


@pytest.fixture(scope="module")
def admin_headers():
    return {"Authorization": f"Bearer {make_token(ADMIN_USER_ID, ['admin'])}"}


# ============ Legal Content ============
class TestLegalContent:
    def test_terms_and_conditions(self, s):
        r = s.get(f"{BASE_URL}/api/legal/terms-and-conditions")
        assert r.status_code == 200
        d = r.json()
        assert d["version"] == "v1.0"
        assert d["effective_date"] == "03.08.2026"
        assert d["title"] == "Terms & Conditions"
        assert d["brand"] == "AirYatra"
        assert "AIRYATRA TERMS AND CONDITIONS" in d["content"]
        assert len(d["content"]) > 10000

    def test_cancellation_policy(self, s):
        r = s.get(f"{BASE_URL}/api/legal/cancellation-policy")
        assert r.status_code == 200
        d = r.json()
        assert d["version"] == "v1.0"
        assert d["effective_date"] == "03.08.2026"
        # Refund slabs present
        for pct in ["10%", "20%", "30%", "50%"]:
            assert pct in d["content"], f"Missing slab {pct}"

    def test_privacy_policy(self, s):
        r = s.get(f"{BASE_URL}/api/legal/privacy-policy")
        assert r.status_code == 200
        d = r.json()
        assert d["version"] == "v1.0"
        assert d["title"] == "Privacy Policy"
        assert "Information We Collect" in d["content"]


# ============ Consents ============
class TestConsents:
    def test_get_consents_default(self, s):
        r = s.get(f"{BASE_URL}/api/legal/consents")
        assert r.status_code == 200
        d = r.json()
        assert len(d["mandatory"]) == 5
        assert len(d["optional"]) == 2
        ids = [c["id"] for c in d["mandatory"]]
        for expected in ["terms_conditions", "flight_conditions", "platform_role",
                         "passenger_info", "electronic_consent"]:
            assert expected in ids
        # village_landing must NOT appear by default
        assert "village_landing" not in ids

    def test_get_consents_village_landing(self, s):
        r = s.get(f"{BASE_URL}/api/legal/consents?booking_type=village_landing")
        assert r.status_code == 200
        ids = [c["id"] for c in r.json()["mandatory"]]
        assert "village_landing" in ids
        assert len(ids) == 6

    def test_record_consent_requires_auth(self, s):
        r = s.post(f"{BASE_URL}/api/legal/consents/record",
                   json={"consents": ["terms_conditions"]})
        assert r.status_code in (401, 403)

    def test_record_consent_missing_mandatory(self, s, operator_headers):
        r = s.post(f"{BASE_URL}/api/legal/consents/record",
                   headers=operator_headers,
                   json={"consents": ["terms_conditions"]})
        assert r.status_code == 400
        assert "Missing mandatory consents" in r.json()["detail"]

    def test_record_consent_success(self, s, operator_headers):
        payload = {
            "booking_id": "TEST_booking_consent_1",
            "consents": [
                "terms_conditions", "flight_conditions", "platform_role",
                "passenger_info", "electronic_consent"
            ],
            "optional_consents": ["marketing_consent"],
            "ip_address": "127.0.0.1",
            "user_agent": "pytest",
        }
        r = s.post(f"{BASE_URL}/api/legal/consents/record",
                   headers=operator_headers, json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["success"] is True
        assert d["consent_id"]

        # Verify
        v = s.get(f"{BASE_URL}/api/legal/consents/verify/TEST_booking_consent_1",
                  headers=operator_headers)
        assert v.status_code == 200
        assert v.json()["has_consent"] is True


# ============ Fixed Route Pricing ============
class TestFixedRoutes:
    created_route_id = None

    def test_search_no_routes_suggests_auction(self, s):
        future = (datetime.utcnow() + timedelta(days=30)).strftime("%Y-%m-%d")
        r = s.get(f"{BASE_URL}/api/routes/search",
                  params={"origin": "NoWhereX", "destination": "NoPlaceY",
                          "date": future, "passengers": 2})
        assert r.status_code == 200
        d = r.json()
        assert d["found"] is False
        assert d.get("suggest_auction") is True

    def test_search_invalid_date_format(self, s):
        r = s.get(f"{BASE_URL}/api/routes/search",
                  params={"origin": "Pune", "destination": "Mumbai",
                          "date": "invalid", "passengers": 1})
        assert r.status_code == 400

    def test_search_past_date_rejected(self, s):
        r = s.get(f"{BASE_URL}/api/routes/search",
                  params={"origin": "Pune", "destination": "Mumbai",
                          "date": "2020-01-01", "passengers": 1})
        assert r.status_code == 400
        assert "future" in r.json()["detail"].lower()

    def test_create_fixed_route_requires_auth(self, s):
        r = s.post(f"{BASE_URL}/api/routes/fixed", json={
            "origin": "Pune", "destination": "Mumbai",
            "aircraft_id": OPERATOR_AIRCRAFT_ID, "base_price": 100000
        })
        assert r.status_code in (401, 403)

    def test_create_fixed_route_customer_forbidden(self, s):
        # Token with customer role
        token = make_token("fake-customer-id", ["customer"])
        r = s.post(f"{BASE_URL}/api/routes/fixed",
                   headers={"Authorization": f"Bearer {token}"},
                   json={"origin": "Pune", "destination": "Mumbai",
                         "aircraft_id": OPERATOR_AIRCRAFT_ID, "base_price": 100000})
        # Either 401 (user not found) or 403 (role check)
        assert r.status_code in (401, 403)

    def test_create_fixed_route_operator_success(self, s, operator_headers):
        # Use random unique origin to avoid duplicate
        unique_origin = f"TESTOrigin{datetime.utcnow().strftime('%H%M%S%f')}"
        payload = {
            "origin": unique_origin,
            "destination": "TESTDestination",
            "aircraft_id": OPERATOR_AIRCRAFT_ID,
            "base_price": 150000,
            "landing_charges": 5000,
            "parking_charges": 2000,
            "operational_charges": 3000,
            "available_days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            "estimated_flight_time_minutes": 45,
            "distance_km": 150,
            "max_passengers": 6,
        }
        r = s.post(f"{BASE_URL}/api/routes/fixed",
                   headers=operator_headers, json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["success"] is True
        route = d["route"]
        assert route["subtotal"] == 160000
        assert route["origin"] == unique_origin.title()
        TestFixedRoutes.created_route_id = route["id"]

        # Verify persistence via my-routes
        my = s.get(f"{BASE_URL}/api/routes/fixed/my-routes",
                   headers=operator_headers)
        assert my.status_code == 200
        assert any(r["id"] == route["id"] for r in my.json()["routes"])

    def test_search_finds_created_route(self, s):
        if not TestFixedRoutes.created_route_id:
            pytest.skip("Route creation failed")
        # Get the route to get the origin/dest
        details = requests.get(f"{BASE_URL}/api/routes/fixed/{TestFixedRoutes.created_route_id}")
        assert details.status_code == 200
        route = details.json()["route"]
        future = (datetime.utcnow() + timedelta(days=10)).strftime("%Y-%m-%d")
        r = s.get(f"{BASE_URL}/api/routes/search",
                  params={"origin": route["origin"],
                          "destination": route["destination"],
                          "date": future, "passengers": 2})
        assert r.status_code == 200
        d = r.json()
        assert d["found"] is True
        assert d["count"] >= 1
        first = d["routes"][0]
        assert "price_breakdown" in first
        assert first["price_breakdown"]["total_payable"] > 0

    def test_create_duplicate_route_rejected(self, s, operator_headers):
        if not TestFixedRoutes.created_route_id:
            pytest.skip("no route to duplicate")
        details = requests.get(f"{BASE_URL}/api/routes/fixed/{TestFixedRoutes.created_route_id}")
        route = details.json()["route"]
        r = s.post(f"{BASE_URL}/api/routes/fixed", headers=operator_headers, json={
            "origin": route["origin"], "destination": route["destination"],
            "aircraft_id": OPERATOR_AIRCRAFT_ID, "base_price": 200000
        })
        assert r.status_code == 400

    def test_cleanup_delete_created_route(self, s, operator_headers):
        if TestFixedRoutes.created_route_id:
            r = s.delete(f"{BASE_URL}/api/routes/fixed/{TestFixedRoutes.created_route_id}",
                         headers=operator_headers)
            assert r.status_code == 200
