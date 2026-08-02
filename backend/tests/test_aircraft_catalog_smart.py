"""Backend tests for Phase 5 Smart Inventory Aircraft Catalog:
- GET /api/aircraft/booking-types
- GET /api/aircraft/public/featured
- POST /api/aircraft/compare
- POST /api/aircraft/create (with new fields)
"""

import os
import sys
import time
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

sys.path.insert(0, "/app/backend")
from auth import create_access_token  # noqa: E402

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"


CUSTOMER = {"id": "d8bf6df5-360b-4a8e-b665-43d09a3e8626", "email": "loyaltytest@airyatra.com", "roles": ["customer"]}
OPERATOR = {"id": "88e05bf4-57fc-43b3-82cb-18252892026b", "email": "operator8fkf0x@airyatra.com", "roles": ["operator"]}


def _tok(u):
    return create_access_token({"sub": u["id"], "id": u["id"], "email": u["email"], "roles": u["roles"]})


def _h(u):
    return {"Authorization": f"Bearer {_tok(u)}", "Content-Type": "application/json"}


# ============ Booking Types ============

class TestBookingTypes:
    def test_returns_9_booking_types(self):
        r = requests.get(f"{API}/aircraft/booking-types")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["count"] == 9
        expected = {"one_way", "round_trip", "multi_city", "hourly_charter",
                    "daily_charter", "multi_day", "group_booking", "emergency", "event_based"}
        assert set(data["booking_types"].keys()) == expected
        for k, v in data["booking_types"].items():
            assert "label" in v and "description" in v


# ============ Public Featured ============

class TestPublicFeatured:
    def test_featured_returns_scored_verified_aircraft(self):
        r = requests.get(f"{API}/aircraft/public/featured")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "aircraft" in data and "count" in data
        assert data["count"] >= 1, "Expected at least 1 verified featured aircraft (3 seeded)"
        for a in data["aircraft"]:
            assert a.get("is_published") is True
            assert a["verification"]["status"] in ["verified", "premium_verified"]
            # New enrichments
            assert "verification_badge" in a
            assert a["verification_badge"]["is_verified"] is True
            assert "safety_score" in a
            for k in ("score", "max_score", "percentage", "rating", "has_tcas", "has_oxygen", "has_parachute"):
                assert k in a["safety_score"], f"safety_score missing {k}"
            assert 0 <= a["safety_score"]["percentage"] <= 100
            assert "amenity_score" in a
            for k in ("score", "max_score", "percentage", "rating", "has_wifi", "has_meals", "has_lavatory"):
                assert k in a["amenity_score"], f"amenity_score missing {k}"
            assert 0 <= a["amenity_score"]["percentage"] <= 100
            # Mongo _id excluded
            assert "_id" not in a

    def test_featured_limit_capped(self):
        r = requests.get(f"{API}/aircraft/public/featured", params={"limit": 12})
        assert r.status_code == 200
        # limit above 12 should reject
        r2 = requests.get(f"{API}/aircraft/public/featured", params={"limit": 50})
        assert r2.status_code == 422


# ============ Compare ============

class TestAircraftCompare:
    @pytest.fixture(scope="class")
    def featured_ids(self):
        r = requests.get(f"{API}/aircraft/public/featured")
        assert r.status_code == 200
        ids = [a["id"] for a in r.json()["aircraft"]]
        if len(ids) < 2:
            pytest.skip("Need at least 2 verified aircraft seeded")
        return ids

    def test_requires_auth(self, featured_ids):
        r = requests.post(f"{API}/aircraft/compare", json=featured_ids[:2])
        assert r.status_code in (401, 403), r.text

    def test_requires_min_2(self, featured_ids):
        r = requests.post(f"{API}/aircraft/compare", json=featured_ids[:1], headers=_h(CUSTOMER))
        assert r.status_code == 400
        assert "at least 2" in r.json().get("detail", "").lower()

    def test_max_4(self, featured_ids):
        # Even with fewer ids seeded, sending 5 dummies must 400
        r = requests.post(f"{API}/aircraft/compare",
                          json=["a", "b", "c", "d", "e"], headers=_h(CUSTOMER))
        assert r.status_code == 400
        assert "maximum 4" in r.json().get("detail", "").lower()

    def test_compare_returns_highlights(self, featured_ids):
        payload = featured_ids[:min(3, len(featured_ids))]
        r = requests.post(f"{API}/aircraft/compare", json=payload, headers=_h(CUSTOMER))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["count"] == len(payload)
        assert len(data["comparison"]) == len(payload)
        for item in data["comparison"]:
            for key in ("id", "name", "registration", "specs", "capacity", "crew",
                        "safety", "amenities", "key_features", "pricing", "verification"):
                assert key in item, f"comparison item missing {key}"
            # specs from new fields
            assert "engine_type" in item["specs"]
            assert "cruise_speed" in item["specs"]
            assert "range" in item["specs"]
            # No commission surfaced in customer-facing comparison pricing
            assert "commission" not in item["pricing"]
        # Highlights
        assert "highlights" in data
        for k in ("best_safety", "best_amenities", "best_value"):
            assert k in data["highlights"]
            assert "id" in data["highlights"][k] and "name" in data["highlights"][k]
        # best_safety must be an id present in the comparison
        ids_in = {c["id"] for c in data["comparison"]}
        assert data["highlights"]["best_safety"]["id"] in ids_in
        assert data["highlights"]["best_amenities"]["id"] in ids_in
        assert data["highlights"]["best_value"]["id"] in ids_in
        # comparison_categories
        assert isinstance(data.get("comparison_categories"), list)
        assert len(data["comparison_categories"]) >= 5

    def test_compare_unknown_ids_404(self):
        r = requests.post(f"{API}/aircraft/compare",
                          json=["nope-1", "nope-2"], headers=_h(CUSTOMER))
        assert r.status_code == 404


# ============ Create Aircraft with new fields ============

class TestCreateWithNewFields:
    created_id = None

    def test_create_with_all_new_fields(self):
        reg = f"VT-SMRT{int(time.time()) % 100000}"
        payload = {
            "basic_info": {
                "aircraft_type": "light_jet",
                "manufacturer": "Cessna",
                "model": "Citation TEST",
                "year_of_manufacture": 2023,
                "registration_number": reg,
                "serial_number": "SN-TEST",
                "engine_type": "twin_turbine",
                "engine_model": "PW535A",
                "cruise_speed_kmh": 750,
                "max_range_km": 3400,
                "max_altitude_ft": 45000,
                "fuel_capacity_liters": 4500
            },
            "features": {
                "total_seats": 8, "vip_seats": 6, "wifi": True,
                "meals_available": True, "lavatory": True, "air_conditioning": True
            },
            "safety_equipment": {
                "first_aid_kit": True, "fire_extinguisher": True, "elt": True,
                "tcas": True, "tcas_version": "TCAS II",
                "oxygen_kit": True, "oxygen_kit_type": "Portable",
                "parachute_system": False,
                "terrain_awareness": True, "weather_radar": True
            },
            "crew_configuration": {
                "pilot_count": 2,
                "copilot_required": True,
                "cabin_crew_count": 1,
                "flight_engineer_required": False,
                "min_pilot_experience_hours": 1500,
                "crew_rest_facility": False
            },
            "pricing": {"hourly_price": 350000, "one_way_price": 280000, "daily_price": 2000000},
            "description": "TEST smart-inventory aircraft",
            "highlights": ["TCAS II", "Full Meals"]
        }
        r = requests.post(f"{API}/aircraft/create", json=payload, headers=_h(OPERATOR))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        assert data["registration"] == reg
        TestCreateWithNewFields.created_id = data["aircraft_id"]

        # Verify persisted new fields via my-fleet
        r2 = requests.get(f"{API}/aircraft/my-fleet", headers=_h(OPERATOR))
        assert r2.status_code == 200
        match = next((a for a in r2.json().get("aircraft", []) if a["id"] == data["aircraft_id"]), None)
        assert match is not None, "Newly created aircraft not returned in my-fleet"
        b = match["basic_info"]
        assert b["engine_type"] == "twin_turbine"
        assert b["cruise_speed_kmh"] == 750
        assert b["max_range_km"] == 3400
        assert b["max_altitude_ft"] == 45000
        s = match["safety_equipment"]
        assert s["tcas"] is True and s["oxygen_kit"] is True and s["parachute_system"] is False
        c = match["crew_configuration"]
        assert c["pilot_count"] == 2 and c["copilot_required"] is True and c["cabin_crew_count"] == 1

    def test_cleanup(self):
        # Best-effort cleanup via direct DB delete (no delete endpoint assumed)
        if TestCreateWithNewFields.created_id:
            try:
                import asyncio
                from database import get_database
                async def _del():
                    db = get_database()
                    await db.aircraft_catalog.delete_one({"id": TestCreateWithNewFields.created_id})
                asyncio.get_event_loop().run_until_complete(_del())
            except Exception as e:
                print(f"cleanup skipped: {e}")
