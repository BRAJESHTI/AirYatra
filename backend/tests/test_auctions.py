"""Backend tests for Phase 2 AI Reverse Auction System."""

import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

# Ensure backend is importable for JWT signing
sys.path.insert(0, "/app/backend")
from auth import create_access_token  # noqa: E402

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"

# Real user ids from Mongo (verified before test run)
CUSTOMER = {
    "id": "d8bf6df5-360b-4a8e-b665-43d09a3e8626",
    "email": "loyaltytest@airyatra.com",
    "name": "Loyalty Test",
    "roles": ["customer"],
}
OPERATOR = {
    "id": "88e05bf4-57fc-43b3-82cb-18252892026b",
    "email": "operator8fkf0x@airyatra.com",
    "name": "Operator Test",
    "roles": ["operator"],
}
OPERATOR2 = {
    "id": "07106ab5-2e85-49ab-b731-28f9f64fc8a9",
    "email": "testoperator1766366216@test.com",
    "name": "Operator2",
    "roles": ["operator"],
}
ADMIN = {
    "id": "601a4741-f347-4ce8-845e-6cbd91bf9a78",
    "email": "admin@airyatra.com",
    "name": "Admin",
    "roles": ["admin"],
}


def _token(user):
    return create_access_token({
        "sub": user["id"],
        "id": user["id"],
        "email": user["email"],
        "roles": user["roles"],
    })


@pytest.fixture(scope="session")
def customer_headers():
    return {"Authorization": f"Bearer {_token(CUSTOMER)}"}


@pytest.fixture(scope="session")
def operator_headers():
    return {"Authorization": f"Bearer {_token(OPERATOR)}"}


@pytest.fixture(scope="session")
def operator2_headers():
    return {"Authorization": f"Bearer {_token(OPERATOR2)}"}


@pytest.fixture(scope="session")
def admin_headers():
    return {"Authorization": f"Bearer {_token(ADMIN)}"}


@pytest.fixture(scope="module")
def created_auction_ids():
    ids = []
    yield ids
    # Cleanup: cancel any leftover active auctions
    ch = {"Authorization": f"Bearer {_token(CUSTOMER)}"}
    for aid in ids:
        try:
            requests.post(f"{API}/auctions/{aid}/cancel", headers=ch, timeout=10)
        except Exception:
            pass


def _future_date(days=7):
    return (datetime.now(timezone.utc) + timedelta(days=days)).strftime("%Y-%m-%d")


def _auction_payload(**overrides):
    payload = {
        "origin": "TEST_Mumbai",
        "origin_type": "city",
        "destination": "TEST_Pune",
        "destination_type": "city",
        "travel_date": _future_date(7),
        "travel_time": "09:00",
        "flight_type": "one_way",
        "passengers": 4,
        "aircraft_category": "helicopter",
        "luggage_kg": 20,
        "purpose": "business",
        "auction_duration_minutes": 5,
        "max_budget": 500000,
        "contact_name": "TEST Customer",
        "contact_phone": "+919999999999",
        "contact_email": "loyaltytest@airyatra.com",
    }
    payload.update(overrides)
    return payload


def _quote_payload(**overrides):
    q = {
        "aircraft_type": "helicopter",
        "aircraft_model": "Bell 407",
        "aircraft_registration": "VT-TEST",
        "base_price": 100000,
        "landing_charges": 5000,
        "handling_charges": 2000,
        "crew_charges": 8000,
        "fuel_surcharge": 10000,
        "other_charges": 0,
        "discount": 0,
        "estimated_flight_time": "1h 30m",
        "departure_time": "09:30",
        "quote_valid_hours": 24,
        "operator_notes": "TEST quote",
    }
    q.update(overrides)
    return q


# ============ AUCTION CREATION ============

class TestAuctionCreation:
    def test_create_auction_success(self, customer_headers, created_auction_ids):
        r = requests.post(f"{API}/auctions/create", json=_auction_payload(), headers=customer_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        assert "auction_id" in data
        assert data["auction_number"].startswith("AUC-")
        assert data["duration_minutes"] == 5
        created_auction_ids.append(data["auction_id"])

    def test_create_duplicate_auction_fails(self, customer_headers, created_auction_ids):
        # Use unique route to avoid clashing with the first test
        payload = _auction_payload(origin="TEST_Delhi_Dup", destination="TEST_Agra_Dup")
        r1 = requests.post(f"{API}/auctions/create", json=payload, headers=customer_headers, timeout=15)
        assert r1.status_code == 200
        created_auction_ids.append(r1.json()["auction_id"])

        r2 = requests.post(f"{API}/auctions/create", json=payload, headers=customer_headers, timeout=15)
        assert r2.status_code == 400
        assert "active auction" in r2.json()["detail"].lower()

    def test_create_past_date_fails(self, customer_headers):
        past = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
        r = requests.post(f"{API}/auctions/create", json=_auction_payload(travel_date=past), headers=customer_headers, timeout=15)
        assert r.status_code == 400

    def test_create_requires_auth(self):
        r = requests.post(f"{API}/auctions/create", json=_auction_payload(), timeout=10)
        assert r.status_code == 401

    def test_invalid_passenger_count(self, customer_headers):
        r = requests.post(f"{API}/auctions/create", json=_auction_payload(passengers=0), headers=customer_headers, timeout=10)
        assert r.status_code == 422


# ============ OPERATOR VIEWS & QUOTES ============

class TestOperatorFlow:
    @pytest.fixture(scope="class")
    def auction_id(self, customer_headers, created_auction_ids):
        payload = _auction_payload(origin="TEST_BOM_OP", destination="TEST_PNQ_OP")
        r = requests.post(f"{API}/auctions/create", json=payload, headers=customer_headers, timeout=15)
        assert r.status_code == 200
        aid = r.json()["auction_id"]
        created_auction_ids.append(aid)
        return aid

    def test_operator_sees_pending(self, operator_headers, auction_id):
        r = requests.get(f"{API}/auctions/operator/pending", headers=operator_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "auctions" in data
        assert any(a["id"] == auction_id for a in data["auctions"])
        target = next(a for a in data["auctions"] if a["id"] == auction_id)
        assert target["has_quoted"] is False
        assert target["time_remaining"]["expired"] is False

    def test_customer_cannot_access_operator_pending(self, customer_headers):
        r = requests.get(f"{API}/auctions/operator/pending", headers=customer_headers, timeout=10)
        assert r.status_code == 403

    def test_submit_quote_and_pricing(self, operator_headers, auction_id):
        payload = _quote_payload()
        r = requests.post(f"{API}/auctions/{auction_id}/quote", json=payload, headers=operator_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        # Verify GST calc: subtotal 125000, gst=22500, total=147500
        assert data["total_amount"] == 147500.0
        assert data["success"] is True
        assert "quote_id" in data

    def test_duplicate_quote_rejected(self, operator_headers, auction_id):
        r = requests.post(f"{API}/auctions/{auction_id}/quote", json=_quote_payload(), headers=operator_headers, timeout=15)
        assert r.status_code == 400
        assert "already" in r.json()["detail"].lower()

    def test_update_quote(self, operator_headers, auction_id):
        new_payload = _quote_payload(base_price=90000, discount=5000)
        # subtotal = 90000+5000+2000+8000+10000+0-5000 = 110000, gst=19800, total=129800
        r = requests.put(f"{API}/auctions/{auction_id}/quote", json=new_payload, headers=operator_headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["total_amount"] == 129800.0

    def test_customer_cannot_submit_quote(self, customer_headers, auction_id):
        r = requests.post(f"{API}/auctions/{auction_id}/quote", json=_quote_payload(), headers=customer_headers, timeout=10)
        assert r.status_code == 403

    def test_second_operator_submits_higher(self, operator2_headers, auction_id):
        payload = _quote_payload(base_price=150000)
        r = requests.post(f"{API}/auctions/{auction_id}/quote", json=payload, headers=operator2_headers, timeout=15)
        assert r.status_code == 200
        # subtotal = 150000+5000+2000+8000+10000 = 175000, gst=31500, total=206500
        assert r.json()["total_amount"] == 206500.0


# ============ CUSTOMER VIEW & SELECTION ============

class TestSelectionFlow:
    @pytest.fixture(scope="class")
    def setup(self, customer_headers, operator_headers, operator2_headers, created_auction_ids):
        payload = _auction_payload(origin="TEST_BLR_SEL", destination="TEST_MAA_SEL")
        r = requests.post(f"{API}/auctions/create", json=payload, headers=customer_headers, timeout=15)
        assert r.status_code == 200
        aid = r.json()["auction_id"]
        created_auction_ids.append(aid)

        r1 = requests.post(f"{API}/auctions/{aid}/quote", json=_quote_payload(base_price=100000), headers=operator_headers, timeout=15)
        assert r1.status_code == 200
        q1_id = r1.json()["quote_id"]

        r2 = requests.post(f"{API}/auctions/{aid}/quote", json=_quote_payload(base_price=80000), headers=operator2_headers, timeout=15)
        assert r2.status_code == 200
        q2_id = r2.json()["quote_id"]

        return {"auction_id": aid, "cheap_quote": q2_id, "expensive_quote": q1_id}

    def test_customer_sees_sorted_quotes(self, customer_headers, setup):
        r = requests.get(f"{API}/auctions/{setup['auction_id']}", headers=customer_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert len(data["quotes"]) == 2
        # Sorted by total_amount ascending
        assert data["quotes"][0]["total_amount"] < data["quotes"][1]["total_amount"]
        assert data["recommended_quote_id"] == setup["cheap_quote"]
        assert data["lowest_quote"] == data["quotes"][0]["total_amount"]

    def test_operator_sees_only_own_quote(self, operator_headers, setup):
        r = requests.get(f"{API}/auctions/{setup['auction_id']}", headers=operator_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert len(data["quotes"]) == 1
        assert data["quotes"][0]["operator_id"] == OPERATOR["id"]

    def test_select_quote(self, customer_headers, setup):
        r = requests.post(
            f"{API}/auctions/{setup['auction_id']}/select-quote",
            json={"quote_id": setup["cheap_quote"], "customer_notes": "TEST selection"},
            headers=customer_headers,
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        assert data["next_step"] == "payment"

    def test_verify_selection_persisted(self, customer_headers, setup):
        r = requests.get(f"{API}/auctions/{setup['auction_id']}", headers=customer_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "quote_selected"
        assert data["selected_quote_id"] == setup["cheap_quote"]
        selected = next(q for q in data["quotes"] if q["id"] == setup["cheap_quote"])
        rejected = next(q for q in data["quotes"] if q["id"] == setup["expensive_quote"])
        assert selected["status"] == "selected"
        assert rejected["status"] == "rejected"

    def test_cannot_select_after_selection(self, customer_headers, setup):
        r = requests.post(
            f"{API}/auctions/{setup['auction_id']}/select-quote",
            json={"quote_id": setup["expensive_quote"]},
            headers=customer_headers,
            timeout=10,
        )
        assert r.status_code == 400


# ============ WITHDRAW + CANCEL ============

class TestWithdrawAndCancel:
    def test_withdraw_quote(self, customer_headers, operator_headers, created_auction_ids):
        p = _auction_payload(origin="TEST_WDR_O", destination="TEST_WDR_D")
        aid = requests.post(f"{API}/auctions/create", json=p, headers=customer_headers, timeout=15).json()["auction_id"]
        created_auction_ids.append(aid)

        rq = requests.post(f"{API}/auctions/{aid}/quote", json=_quote_payload(), headers=operator_headers, timeout=15)
        assert rq.status_code == 200

        rd = requests.delete(f"{API}/auctions/{aid}/quote", headers=operator_headers, timeout=15)
        assert rd.status_code == 200

        # Verify quote no longer in customer active list
        r = requests.get(f"{API}/auctions/{aid}", headers=customer_headers, timeout=10)
        quotes = r.json()["quotes"]
        assert all(q["status"] == "withdrawn" for q in quotes)

    def test_cancel_auction(self, customer_headers, created_auction_ids):
        p = _auction_payload(origin="TEST_CXL_O", destination="TEST_CXL_D")
        aid = requests.post(f"{API}/auctions/create", json=p, headers=customer_headers, timeout=15).json()["auction_id"]

        r = requests.post(f"{API}/auctions/{aid}/cancel", headers=customer_headers, timeout=10)
        assert r.status_code == 200

        g = requests.get(f"{API}/auctions/{aid}", headers=customer_headers, timeout=10)
        assert g.json()["status"] == "cancelled"

    def test_non_owner_cannot_cancel(self, customer_headers, operator_headers, created_auction_ids):
        p = _auction_payload(origin="TEST_NOW_O", destination="TEST_NOW_D")
        aid = requests.post(f"{API}/auctions/create", json=p, headers=customer_headers, timeout=15).json()["auction_id"]
        created_auction_ids.append(aid)

        r = requests.post(f"{API}/auctions/{aid}/cancel", headers=operator_headers, timeout=10)
        assert r.status_code == 403


# ============ ADMIN ============

class TestAdmin:
    def test_admin_stats(self, admin_headers):
        r = requests.get(f"{API}/auctions/admin/stats", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "auctions" in data and "quotes" in data and "revenue" in data
        assert data["auctions"]["total"] >= 1
        assert data["revenue"]["currency"] == "INR"

    def test_admin_all(self, admin_headers):
        r = requests.get(f"{API}/auctions/admin/all", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert "auctions" in r.json() and "stats" in r.json()

    def test_non_admin_stats_forbidden(self, customer_headers):
        r = requests.get(f"{API}/auctions/admin/stats", headers=customer_headers, timeout=10)
        assert r.status_code == 403


# ============ NOT FOUND ============

class TestErrors:
    def test_get_unknown_auction(self, customer_headers):
        r = requests.get(f"{API}/auctions/does-not-exist-uuid", headers=customer_headers, timeout=10)
        assert r.status_code == 404

    def test_quote_on_unknown_auction(self, operator_headers):
        r = requests.post(f"{API}/auctions/nope-abcd/quote", json=_quote_payload(), headers=operator_headers, timeout=10)
        assert r.status_code == 404
