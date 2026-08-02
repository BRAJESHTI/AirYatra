"""Backend tests for Emergency Booking Priority System (Phase 6)."""

import os
import sys
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

sys.path.insert(0, "/app/backend")
from auth import create_access_token  # noqa: E402

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"

# Reuse the users tagged in iteration_27 that already exist in DB
CUSTOMER = {"id": "d8bf6df5-360b-4a8e-b665-43d09a3e8626",
            "email": "loyaltytest@airyatra.com", "roles": ["customer"]}
OPERATOR = {"id": "88e05bf4-57fc-43b3-82cb-18252892026b",
            "email": "operator8fkf0x@airyatra.com", "roles": ["operator"]}
ADMIN = {"id": "601a4741-f347-4ce8-845e-6cbd91bf9a78",
         "email": "admin@airyatra.com", "roles": ["admin"]}


def _tok(u):
    return create_access_token({"sub": u["id"], "id": u["id"], "email": u["email"], "roles": u["roles"]})


def _h(u):
    return {"Authorization": f"Bearer {_tok(u)}", "Content-Type": "application/json"}


# ============ /api/emergency/config ============
class TestEmergencyConfig:
    def test_config_public(self):
        r = requests.get(f"{API}/emergency/config", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "urgency_levels" in data
        assert "urgency_reasons" in data
        for lvl in ("critical", "high", "medium"):
            assert lvl in data["urgency_levels"]
            for key in ("label", "priority", "surcharge_percent",
                        "max_response_minutes", "broadcast_radius_km", "color"):
                assert key in data["urgency_levels"][lvl]
        assert data["urgency_levels"]["critical"]["priority"] == 1
        assert data["urgency_levels"]["critical"]["surcharge_percent"] == 50
        for r_key in ("medical_emergency", "time_critical", "vip_travel",
                      "disaster_relief", "organ_transport"):
            assert r_key in data["urgency_reasons"]


# ============ /api/emergency/create ============
class TestEmergencyCreate:
    created_ids = []

    def test_create_requires_auth(self):
        payload = {
            "from_location": "Mumbai", "from_latitude": 19.07, "from_longitude": 72.87,
            "to_location": "Pune", "to_latitude": 18.52, "to_longitude": 73.85,
            "urgency_level": "high", "urgency_reason": "medical_emergency",
            "passengers": 2,
            "emergency_contact_name": "N", "emergency_contact_phone": "+911111111111",
        }
        r = requests.post(f"{API}/emergency/create", json=payload, timeout=30)
        assert r.status_code in (401, 403), r.text

    def test_create_invalid_urgency_level(self):
        payload = {
            "from_location": "Mumbai", "from_latitude": 19.07, "from_longitude": 72.87,
            "to_location": "Pune", "to_latitude": 18.52, "to_longitude": 73.85,
            "urgency_level": "bogus", "urgency_reason": "medical_emergency",
            "emergency_contact_name": "N", "emergency_contact_phone": "+911111111111",
        }
        r = requests.post(f"{API}/emergency/create", json=payload, headers=_h(CUSTOMER), timeout=30)
        assert r.status_code == 400, r.text

    def test_create_success_critical(self):
        payload = {
            "from_location": "Mumbai (BOM)",
            "from_latitude": 19.0896, "from_longitude": 72.8656,
            "to_location": "Pune (PNQ)",
            "to_latitude": 18.5822, "to_longitude": 73.9197,
            "urgency_level": "critical",
            "urgency_reason": "medical_emergency",
            "passengers": 2,
            "aircraft_type": "any",
            "special_requirements": "TEST_ Medical stretcher",
            "emergency_contact_name": "TEST Contact",
            "emergency_contact_phone": "+919999900000",
        }
        r = requests.post(f"{API}/emergency/create", json=payload, headers=_h(CUSTOMER), timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        assert "emergency_booking_id" in data
        assert data["emergency_number"].startswith("EMR")
        # critical(1) - medical_emergency boost(1) = 0
        assert data["priority_score"] == 0
        assert data["surcharge_percent"] == 50
        assert data["broadcast_radius_km"] == 500
        assert data["response_deadline_minutes"] == 5
        assert data["operators_notified"] >= 0
        TestEmergencyCreate.created_ids.append(data["emergency_booking_id"])

    def test_create_medium_urgency(self):
        payload = {
            "from_location": "Delhi",
            "from_latitude": 28.5562, "from_longitude": 77.1000,
            "to_location": "Jaipur",
            "to_latitude": 26.8242, "to_longitude": 75.8122,
            "urgency_level": "medium",
            "urgency_reason": "vip_travel",
            "passengers": 4,
            "emergency_contact_name": "TEST VIP",
            "emergency_contact_phone": "+919999900001",
        }
        r = requests.post(f"{API}/emergency/create", json=payload, headers=_h(CUSTOMER), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        # medium(3) - vip boost(0) = 3
        assert d["priority_score"] == 3
        assert d["surcharge_percent"] == 10
        TestEmergencyCreate.created_ids.append(d["emergency_booking_id"])


# ============ /api/emergency/my-requests ============
class TestMyRequests:
    def test_customer_my_requests(self):
        r = requests.get(f"{API}/emergency/my-requests", headers=_h(CUSTOMER), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "emergency_bookings" in d
        assert "count" in d
        # Must include one we just created
        if TestEmergencyCreate.created_ids:
            ids = {e["id"] for e in d["emergency_bookings"]}
            assert any(cid in ids for cid in TestEmergencyCreate.created_ids)

    def test_my_requests_requires_auth(self):
        r = requests.get(f"{API}/emergency/my-requests", timeout=30)
        assert r.status_code in (401, 403)


# ============ /api/emergency/operator/pending ============
class TestOperatorPending:
    def test_operator_pending_requires_role(self):
        r = requests.get(f"{API}/emergency/operator/pending", headers=_h(CUSTOMER), timeout=30)
        assert r.status_code == 403, r.text

    def test_operator_pending_ok(self):
        r = requests.get(f"{API}/emergency/operator/pending", headers=_h(OPERATOR), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "pending_emergencies" in d and "count" in d
        assert isinstance(d["pending_emergencies"], list)


# ============ /api/emergency/respond ============
class TestOperatorRespond:
    def test_respond_requires_operator_role(self):
        payload = {"emergency_booking_id": "nonexistent", "can_fulfill": False}
        r = requests.post(f"{API}/emergency/respond", json=payload,
                          headers=_h(CUSTOMER), timeout=30)
        assert r.status_code == 403, r.text

    def test_respond_404_for_unknown(self):
        payload = {"emergency_booking_id": "no-such-id", "can_fulfill": False}
        r = requests.post(f"{API}/emergency/respond", json=payload,
                          headers=_h(OPERATOR), timeout=30)
        assert r.status_code == 404, r.text

    def test_respond_cannot_fulfill_ok(self):
        # Need a live emergency
        if not TestEmergencyCreate.created_ids:
            pytest.skip("No emergency created")
        eid = TestEmergencyCreate.created_ids[0]
        # Force status to broadcasting in case no operators matched by radius
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient
        env = dotenv_values("/app/backend/.env")
        mongo_url = os.environ.get("MONGO_URL") or env.get("MONGO_URL")
        db_name = os.environ.get("DB_NAME") or env.get("DB_NAME")

        async def _set():
            c = AsyncIOMotorClient(mongo_url)
            await c[db_name].emergency_bookings.update_one(
                {"id": eid}, {"$set": {"status": "broadcasting"}})
            c.close()
        asyncio.get_event_loop().run_until_complete(_set())

        payload = {"emergency_booking_id": eid, "can_fulfill": False,
                   "notes": "TEST_ unable to fulfill"}
        r = requests.post(f"{API}/emergency/respond", json=payload,
                          headers=_h(OPERATOR), timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["success"] is True


# ============ /api/emergency/queue (admin) ============
class TestAdminQueue:
    def test_queue_requires_admin(self):
        r = requests.get(f"{API}/emergency/queue", headers=_h(CUSTOMER), timeout=30)
        assert r.status_code == 403, r.text
        r2 = requests.get(f"{API}/emergency/queue", headers=_h(OPERATOR), timeout=30)
        assert r2.status_code == 403, r2.text

    def test_queue_admin_ok_sorted(self):
        r = requests.get(f"{API}/emergency/queue", headers=_h(ADMIN), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "emergency_queue" in d
        assert "priority_levels" in d
        q = d["emergency_queue"]
        # Sorted ascending by priority_score
        scores = [e.get("priority_score", 99) for e in q]
        assert scores == sorted(scores), f"Queue not priority-sorted: {scores}"


# ============ Cleanup ============
@pytest.fixture(scope="session", autouse=True)
def _cleanup():
    yield
    # Best-effort DB cleanup via direct Mongo
    try:
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient
        env = dotenv_values("/app/backend/.env")
        mongo_url = os.environ.get("MONGO_URL") or env.get("MONGO_URL")
        db_name = os.environ.get("DB_NAME") or env.get("DB_NAME")
        if not (mongo_url and db_name and TestEmergencyCreate.created_ids):
            return

        async def _clean():
            client = AsyncIOMotorClient(mongo_url)
            db = client[db_name]
            ids = TestEmergencyCreate.created_ids
            await db.emergency_bookings.delete_many({"id": {"$in": ids}})
            await db.emergency_alerts.delete_many({"emergency_booking_id": {"$in": ids}})
            await db.notifications.delete_many({"data.emergency_booking_id": {"$in": ids}})
            client.close()

        asyncio.get_event_loop().run_until_complete(_clean())
    except Exception:
        pass
