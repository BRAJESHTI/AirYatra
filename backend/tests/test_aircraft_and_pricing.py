"""Backend tests for Phase 3-5: Aircraft Catalog, Price Breakup, Price Lock."""

import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

sys.path.insert(0, "/app/backend")
from auth import create_access_token  # noqa: E402

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"


CUSTOMER = {"id": "d8bf6df5-360b-4a8e-b665-43d09a3e8626", "email": "loyaltytest@airyatra.com", "roles": ["customer"]}
OPERATOR = {"id": "88e05bf4-57fc-43b3-82cb-18252892026b", "email": "operator8fkf0x@airyatra.com", "roles": ["operator"]}
ADMIN = {"id": "601a4741-f347-4ce8-845e-6cbd91bf9a78", "email": "admin@airyatra.com", "roles": ["admin"]}


def _token(u):
    return create_access_token({"sub": u["id"], "id": u["id"], "email": u["email"], "roles": u["roles"]})


def _h(u):
    return {"Authorization": f"Bearer {_token(u)}", "Content-Type": "application/json"}


# Shared state across tests
STATE = {}


# ============ Aircraft Catalog ============

class TestAircraftCatalog:
    def test_create_aircraft(self):
        reg = f"VT-TEST{int(time.time())}"
        payload = {
            "basic_info": {
                "aircraft_type": "helicopter",
                "manufacturer": "Bell",
                "model": "407",
                "year_of_manufacture": 2020,
                "registration_number": reg,
                "serial_number": "SN123"
            },
            "features": {"total_seats": 6, "vip_seats": 2, "wifi": True, "lavatory": False},
            "pricing": {"one_way_price": 100000, "hourly_price": 80000, "landing_charges": 5000},
            "description": "TEST aircraft",
            "highlights": ["VIP", "Fast"]
        }
        r = requests.post(f"{API}/aircraft/create", json=payload, headers=_h(OPERATOR))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        assert data["registration"] == reg
        assert "aircraft_id" in data
        STATE["aircraft_id"] = data["aircraft_id"]
        STATE["reg"] = reg

    def test_create_duplicate_reg_fails(self):
        payload = {
            "basic_info": {
                "aircraft_type": "helicopter", "manufacturer": "Bell", "model": "407",
                "year_of_manufacture": 2020, "registration_number": STATE["reg"]
            },
            "features": {"total_seats": 4},
            "pricing": {"hourly_price": 50000}
        }
        r = requests.post(f"{API}/aircraft/create", json=payload, headers=_h(OPERATOR))
        assert r.status_code == 400

    def test_get_my_fleet(self):
        r = requests.get(f"{API}/aircraft/my-fleet", headers=_h(OPERATOR))
        assert r.status_code == 200, r.text
        data = r.json()
        assert "aircraft" in data and "stats" in data
        stats = data["stats"]
        for k in ["total", "verified", "pending", "published"]:
            assert k in stats
        # Our new aircraft should be in fleet
        ids = [a["id"] for a in data["aircraft"]]
        assert STATE["aircraft_id"] in ids

    def test_get_aircraft_details(self):
        aid = STATE["aircraft_id"]
        r = requests.get(f"{API}/aircraft/{aid}", headers=_h(OPERATOR))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["id"] == aid
        assert "verification_badge" in data
        assert data["verification_badge"]["status"] == "pending"
        assert "expiry_alerts" in data
        assert "insurance" in data["expiry_alerts"]

    def test_update_documents(self):
        aid = STATE["aircraft_id"]
        expiry = (datetime.now() + timedelta(days=45)).strftime("%Y-%m-%d")
        maint_due = (datetime.now() + timedelta(days=10)).strftime("%Y-%m-%d")
        docs = {
            "registration_certificate": "https://x/reg.pdf",
            "insurance_policy": "https://x/ins.pdf",
            "insurance_expiry": expiry,
            "next_maintenance_due": maint_due,
        }
        r = requests.put(f"{API}/aircraft/{aid}/documents", json=docs, headers=_h(OPERATOR))
        assert r.status_code == 200, r.text
        # GET verify persistence + expiry alerts
        r2 = requests.get(f"{API}/aircraft/{aid}", headers=_h(OPERATOR))
        d = r2.json()
        assert d["documents"]["insurance_expiry"] == expiry
        assert d["expiry_alerts"]["insurance"]["status"] in ["attention", "warning", "notice"]
        assert d["expiry_alerts"]["maintenance"]["urgent"] is True

    def test_update_availability(self):
        aid = STATE["aircraft_id"]
        r = requests.put(f"{API}/aircraft/{aid}/availability?status=maintenance", headers=_h(OPERATOR))
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "maintenance"
        # Verify persisted
        r2 = requests.get(f"{API}/aircraft/{aid}", headers=_h(OPERATOR))
        assert r2.json()["availability_status"] == "maintenance"

    def test_update_availability_invalid(self):
        aid = STATE["aircraft_id"]
        r = requests.put(f"{API}/aircraft/{aid}/availability?status=bogus", headers=_h(OPERATOR))
        assert r.status_code == 400

    def test_admin_verify_aircraft(self):
        aid = STATE["aircraft_id"]
        payload = {
            "verification_status": "verified",
            "verification_notes": "All docs OK",
            "documents_verified": True,
            "photos_verified": True,
            "pricing_verified": True,
            "publish": True
        }
        r = requests.put(f"{API}/aircraft/admin/{aid}/verify", json=payload, headers=_h(ADMIN))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        assert data["is_published"] is True
        # Verify persistence
        r2 = requests.get(f"{API}/aircraft/{aid}", headers=_h(ADMIN))
        d = r2.json()
        assert d["verification"]["status"] == "verified"
        assert d["is_published"] is True
        assert d["verification_badge"]["is_verified"] is True
        assert "Verified by AirYatra" in d["verification_badge"]["badge_text"]

    def test_admin_verify_invalid_status(self):
        aid = STATE["aircraft_id"]
        r = requests.put(f"{API}/aircraft/admin/{aid}/verify",
                         json={"verification_status": "bogus"}, headers=_h(ADMIN))
        assert r.status_code == 400

    def test_admin_stats(self):
        r = requests.get(f"{API}/aircraft/admin/stats", headers=_h(ADMIN))
        assert r.status_code == 200, r.text
        data = r.json()
        assert "total" in data and "by_status" in data
        for k in ["verified", "premium_verified", "pending", "under_review", "suspended"]:
            assert k in data["by_status"]
        assert "expiring_soon" in data
        assert data["total"] >= 1

    def test_admin_expiring_documents(self):
        r = requests.get(f"{API}/aircraft/admin/expiring-documents?days=60", headers=_h(ADMIN))
        assert r.status_code == 200, r.text
        data = r.json()
        assert "insurance_expiring" in data
        assert "maintenance_due" in data
        assert "total_alerts" in data
        # Our aircraft insurance expires in ~45 days
        ins_ids = [i["id"] for i in data["insurance_expiring"]]
        assert STATE["aircraft_id"] in ins_ids

    def test_operator_cannot_verify(self):
        aid = STATE["aircraft_id"]
        r = requests.put(f"{API}/aircraft/admin/{aid}/verify",
                         json={"verification_status": "verified"}, headers=_h(OPERATOR))
        assert r.status_code == 403

    def test_cleanup(self):
        # Delete directly via mongo (no delete endpoint exists)
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient
        async def _c():
            c = AsyncIOMotorClient(os.environ.get("MONGO_URL") or dotenv_values("/app/backend/.env")["MONGO_URL"])
            db = c[os.environ.get("DB_NAME") or dotenv_values("/app/backend/.env")["DB_NAME"]]
            await db.aircraft_catalog.delete_one({"id": STATE["aircraft_id"]})
            await db.verification_logs.delete_many({"aircraft_id": STATE["aircraft_id"]})
        asyncio.get_event_loop().run_until_complete(_c())


# ============ Price Breakup ============

class TestPriceBreakup:
    def test_customer_breakup(self):
        payload = {"base_price": 100000, "landing_charges": 5000, "handling_charges": 2000,
                   "crew_charges": 3000, "fuel_surcharge": 4000, "other_charges": 1000, "discount": 5000}
        r = requests.post(f"{API}/pricing/customer/breakup", json=payload, headers=_h(CUSTOMER))
        assert r.status_code == 200, r.text
        d = r.json()
        # Platform commission = 10% * 100000 = 10000; fixed = 500 -> total = 10500
        assert d["platform_fee"]["commission"] == 10000
        assert d["platform_fee"]["fixed_fee"] == 500
        assert d["platform_fee"]["amount"] == 10500
        # subtotal = 115000, discount 5000 -> discounted 110000
        assert d["subtotal"] == 115000
        assert d["discounted_subtotal"] == 110000
        # taxable = 110000 + 10500 = 120500
        assert d["taxable_amount"] == 120500
        # GST 18% -> 21690
        assert d["gst"]["rate"] == 18.0
        assert d["gst"]["amount"] == 21690
        # grand total = 120500 + 21690 = 142190
        assert d["grand_total"] == 142190

    def test_operator_settlement(self):
        payload = {"base_price": 100000, "landing_charges": 5000, "handling_charges": 2000,
                   "crew_charges": 3000, "fuel_surcharge": 4000, "other_charges": 1000, "discount": 5000}
        r = requests.post(f"{API}/pricing/operator/settlement-preview", json=payload, headers=_h(OPERATOR))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["quote_summary"]["total_quote"] == 110000
        # commission 10000, fixed 500 -> 10500 platform
        assert d["deductions"]["platform_commission"]["amount"] == 10000
        assert d["deductions"]["platform_fixed_fee"]["amount"] == 500
        # TDS 2% of 110000 = 2200
        assert d["deductions"]["tds"]["amount"] == 2200
        assert d["deductions"]["total_deductions"] == 12700
        # Net = 110000 - 10500 - 2200 = 97300
        assert d["net_payout"]["amount"] == 97300

    def test_customer_cannot_get_operator_settlement(self):
        r = requests.post(f"{API}/pricing/operator/settlement-preview",
                          json={"base_price": 1000}, headers=_h(CUSTOMER))
        assert r.status_code == 403


# ============ Price Lock ============

class TestPriceLock:
    def test_create_lock(self):
        payload = {"base_price": 100000, "landing_charges": 5000, "lock_duration_minutes": 15}
        r = requests.post(f"{API}/pricing/lock", json=payload, headers=_h(CUSTOMER))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["success"] is True
        assert "lock_id" in d
        assert d["duration_minutes"] == 15
        assert d["locked_total"] > 0
        STATE["lock_id"] = d["lock_id"]
        STATE["locked_total"] = d["locked_total"]

    def test_get_lock(self):
        r = requests.get(f"{API}/pricing/lock/{STATE['lock_id']}", headers=_h(CUSTOMER))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "active"
        assert d["time_remaining"]["expired"] is False
        assert d["time_remaining"]["minutes"] >= 14
        assert d["locked_price"]["grand_total"] == STATE["locked_total"]

    def test_validate_lock(self):
        r = requests.get(f"{API}/pricing/lock/{STATE['lock_id']}/validate", headers=_h(CUSTOMER))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["valid"] is True
        assert d["locked_total"] == STATE["locked_total"]
        assert d["seconds_remaining"] > 0

    def test_other_user_cannot_access(self):
        r = requests.get(f"{API}/pricing/lock/{STATE['lock_id']}/validate", headers=_h(OPERATOR))
        assert r.status_code == 200
        assert r.json()["valid"] is False

    def test_use_lock(self):
        r = requests.post(f"{API}/pricing/lock/{STATE['lock_id']}/use?payment_id=PAY_TEST",
                          headers=_h(CUSTOMER))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["success"] is True
        assert d["locked_total"] == STATE["locked_total"]

    def test_reuse_used_lock_fails(self):
        r = requests.post(f"{API}/pricing/lock/{STATE['lock_id']}/use", headers=_h(CUSTOMER))
        assert r.status_code == 400

    def test_get_nonexistent_lock(self):
        r = requests.get(f"{API}/pricing/lock/nonexistent-id", headers=_h(CUSTOMER))
        assert r.status_code == 404

    def test_invalid_duration_rejected(self):
        # Pydantic constraint: duration between 5 and 30
        r = requests.post(f"{API}/pricing/lock",
                          json={"base_price": 1000, "lock_duration_minutes": 60}, headers=_h(CUSTOMER))
        assert r.status_code == 422

    def test_cleanup(self):
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient
        async def _c():
            c = AsyncIOMotorClient(os.environ.get("MONGO_URL") or dotenv_values("/app/backend/.env")["MONGO_URL"])
            db = c[os.environ.get("DB_NAME") or dotenv_values("/app/backend/.env")["DB_NAME"]]
            await db.price_locks.delete_one({"id": STATE.get("lock_id")})
        if STATE.get("lock_id"):
            asyncio.get_event_loop().run_until_complete(_c())
