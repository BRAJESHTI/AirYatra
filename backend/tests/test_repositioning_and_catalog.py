"""
Tests for AirYatra iteration 29 review:
  1) Fixed Route seeding (8 routes incl. Delhi-Mumbai, Kedarnath Yatra, Tirupati Darshan)
  2) Public aircraft browse endpoint with filters
  3) Notification status endpoint (in_app=true, email=true, sms=false)
"""
import os
import requests
from dotenv import dotenv_values

_env = dotenv_values("/app/frontend/.env")
BASE = (os.environ.get("REACT_APP_BACKEND_URL") or _env.get("REACT_APP_BACKEND_URL")).rstrip("/")


# ---- Fixed Routes ----
class TestFixedRoutes:
    def test_list_returns_at_least_8_seeded(self):
        r = requests.get(f"{BASE}/api/repositioning/fixed-routes", params={"limit": 50})
        assert r.status_code == 200
        d = r.json()
        assert d["total"] >= 8
        codes = {rt["route_code"] for rt in d["routes"]}
        for expected in [
            "FXR-DEL-BOM-001",
            "FXR-BOM-DEL-001",
            "FXR-DHR-KED-001",
            "FXR-HYD-TIR-001",
        ]:
            assert expected in codes, f"missing seeded route {expected}"

    def test_get_by_code_delhi_mumbai(self):
        r = requests.get(f"{BASE}/api/repositioning/fixed-routes/FXR-DEL-BOM-001")
        assert r.status_code == 200
        d = r.json()
        assert d["origin"].lower().startswith("delhi")
        assert "mumbai" in d["destination"].lower()
        assert d["base_price"] > 0
        assert d["max_passengers"] >= 1

    def test_origin_filter(self):
        r = requests.get(f"{BASE}/api/repositioning/fixed-routes", params={"origin": "Delhi"})
        assert r.status_code == 200
        assert r.json()["total"] >= 2

    def test_route_not_found_404(self):
        r = requests.get(f"{BASE}/api/repositioning/fixed-routes/FXR-DOES-NOT-EXIST")
        assert r.status_code == 404


# ---- Public Aircraft Browse ----
class TestPublicBrowse:
    def test_browse_returns_published_aircraft(self):
        r = requests.get(f"{BASE}/api/aircraft/public/browse", params={"limit": 20})
        assert r.status_code == 200
        d = r.json()
        assert d["count"] >= 1
        first = d["aircraft"][0]
        # Sensitive fields excluded
        assert "documents" not in first
        assert "operator_email" not in first
        # Enriched fields present
        assert "verification_badge" in first
        assert "safety_score" in first
        assert "amenity_score" in first
        assert "_id" not in first

    def test_browse_filter_aircraft_type(self):
        r = requests.get(f"{BASE}/api/aircraft/public/browse", params={"aircraft_type": "helicopter"})
        assert r.status_code == 200
        for a in r.json()["aircraft"]:
            assert a["basic_info"]["aircraft_type"] == "helicopter"

    def test_browse_filter_min_seats(self):
        r = requests.get(f"{BASE}/api/aircraft/public/browse", params={"min_seats": 8})
        assert r.status_code == 200
        for a in r.json()["aircraft"]:
            assert a["features"]["total_seats"] >= 8

    def test_browse_filter_max_hourly_price(self):
        r = requests.get(f"{BASE}/api/aircraft/public/browse", params={"max_hourly_price": 200000})
        assert r.status_code == 200
        for a in r.json()["aircraft"]:
            price = a["pricing"].get("hourly_price")
            assert price is None or price <= 200000

    def test_browse_no_auth_required(self):
        # No Authorization header
        s = requests.Session()
        r = s.get(f"{BASE}/api/aircraft/public/browse")
        assert r.status_code == 200


# ---- Notification Status ----
class TestNotificationStatus:
    def test_status_flags(self):
        r = requests.get(f"{BASE}/api/repositioning/notifications/status")
        assert r.status_code == 200
        d = r.json()
        assert d["in_app"] is True
        assert d["email"] is True         # SMTP configured per env
        assert d["sms"] is False          # Twilio not configured
        assert d["whatsapp"] is False
        assert d["twilio_configured"] is False
        assert d["smtp_configured"] is True
