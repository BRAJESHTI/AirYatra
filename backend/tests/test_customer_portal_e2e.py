"""Backend tests for customer portal + new service-category booking inquiry (iteration 46).

Covers:
 - Customer login (no OTP)
 - Booking inquiry POST for each of the 6 new aircraft_type values
 - Inquiry status GET
 - Customer trip listing + KPI/dashboard endpoints
 - City search (destination autosuggest) for booking Step 3
"""

import os
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")

CUSTOMER = {"email": "customer@airyatra.co.in", "password": "Customer@123"}

AIRCRAFT_TYPES = [
    "helicopter",
    "chartered_plane",
    "air_ambulance",
    "yacht_cruiser",
    "cargo",
    "joy_ride",
]


# --- fixtures ---
@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth(session):
    r = session.post(f"{BASE_URL}/api/auth/login", json=CUSTOMER, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"Customer login failed: {r.status_code} {r.text[:300]}")
    data = r.json()
    token = data.get("access_token") or data.get("token")
    if not token:
        pytest.fail(f"No token in login response: {list(data.keys())}")
    session.headers.update({"Authorization": f"Bearer {token}"})
    return {"token": token, "user": data.get("user", {})}


@pytest.fixture(scope="module")
def created_inquiry_ids():
    return []


# --- Auth ---
def test_login(auth):
    assert auth["token"]
    assert auth["user"].get("email", "").lower() == CUSTOMER["email"]


# --- City search (destination autosuggest) ---
@pytest.mark.parametrize("q", ["mumbai", "delhi"])
def test_city_search(session, auth, q):
    # Try common endpoints for city / pincode search
    endpoints = [
        f"{BASE_URL}/api/landing/public/search?query={q}",
    ]
    last = None
    for url in endpoints:
        r = session.get(url, timeout=30)
        last = (url, r.status_code, r.text[:200])
        if r.status_code == 200:
            body = r.json()
            # Accept list or {results: [...]}
            items = body if isinstance(body, list) else body.get("results") or body.get("data") or body.get("items") or body.get("landing_points") or []
            assert isinstance(items, list)
            assert len(items) >= 1, f"No suggestions from {url} for {q}"
            return
    pytest.fail(f"No city search endpoint returned 200. Last tried: {last}")


# --- Inquiry creation for all 6 aircraft_type ---
@pytest.mark.parametrize("aircraft_type", AIRCRAFT_TYPES)
def test_create_inquiry_all_service_types(session, auth, created_inquiry_ids, aircraft_type):
    payload = {
        "aircraft_type": aircraft_type,
        "total_passengers": 2,
        "adults_male": 1,
        "adults_female": 1,
        "children_count": 0,
        "udan_prakar": "one_way",
        "booking_for": "self",
        "booking_purpose": "business",
        "pickup_pincode": "400001",
        "pickup_location": "TEST_Mumbai Airport",
        "pickup_state": "Maharashtra",
        "pickup_district": "Mumbai",
        "pickup_latitude": 19.0896,
        "pickup_longitude": 72.8656,
        "drop_pincode": "110001",
        "drop_location": "TEST_Delhi Airport",
        "drop_state": "Delhi",
        "drop_district": "New Delhi",
        "drop_latitude": 28.5562,
        "drop_longitude": 77.1000,
        "departure_date": "2026-09-15",
        "pickup_time": "10:00",
        "distance_km": 1150,
        "estimated_price": 500000,
        "special_requirements": f"TEST_{aircraft_type}_{uuid.uuid4().hex[:6]}",
    }
    r = session.post(f"{BASE_URL}/api/bookings/inquiry", json=payload, timeout=45)
    assert r.status_code == 200, f"{aircraft_type}: {r.status_code} {r.text[:400]}"
    body = r.json()
    assert body.get("success") is True
    inquiry_id = body.get("inquiry_id")
    assert inquiry_id
    created_inquiry_ids.append(inquiry_id)

    # GET status and verify aircraft_type was persisted correctly
    r2 = session.get(f"{BASE_URL}/api/bookings/inquiry/{inquiry_id}/status", timeout=30)
    assert r2.status_code == 200, r2.text[:300]
    st = r2.json()
    inquiry = st.get("inquiry") or st
    assert inquiry.get("aircraft_type") == aircraft_type, f"Persisted aircraft_type mismatch: {inquiry.get('aircraft_type')}"


# --- Customer portal endpoints ---
class TestCustomerPortalEndpoints:
    endpoints = [
        ("/api/customer/trips", "trips list"),
        ("/api/customer/booking-stats", "booking stats"),
        ("/api/customer/refunds", "refunds list"),
        ("/api/customer/quotes/pending", "pending quotes"),
        ("/api/customer/route-suggestions", "route suggestions"),
    ]

    @pytest.mark.parametrize("path,label", endpoints)
    def test_endpoint_ok(self, session, auth, path, label):
        r = session.get(f"{BASE_URL}{path}", timeout=30)
        assert r.status_code in (200, 204), f"{label} -> {r.status_code} {r.text[:300]}"
        if r.status_code == 200 and r.text.strip():
            body = r.json()
            assert isinstance(body, (dict, list))


# --- Additional customer-facing endpoints that the portal calls ---
class TestExtraCustomerEndpoints:
    @pytest.mark.parametrize("path", [
        "/api/loyalty/summary",
        "/api/notifications",
        "/api/reviews/my",
        "/api/kyc/status",
        "/api/customer-kyc/status",
        "/api/complaints/my",
        "/api/favorites",
        "/api/referrals/my",
        "/api/carbon/my-footprint",
    ])
    def test_endpoint_no_5xx(self, session, auth, path):
        r = session.get(f"{BASE_URL}{path}", timeout=30)
        # Purely audit: no 5xx allowed. 404 is acceptable (endpoint not implemented)
        assert r.status_code < 500, f"{path} returned {r.status_code}: {r.text[:300]}"


# --- Iteration 47 RETEST: verify fixes for critical/minor issues ---
class TestIteration47Fixes:
    def test_booking_stats_returns_200(self, session, auth):
        """FIX 1: booking-stats no longer 500s on inquiries with accepted_quote=None."""
        r = session.get(f"{BASE_URL}/api/customer/booking-stats", timeout=30)
        assert r.status_code == 200, f"booking-stats: {r.status_code} {r.text[:400]}"
        body = r.json()
        assert isinstance(body, dict)

    def test_payments_transactions_fresh_inquiry_no_500(self, session, auth):
        """FIX 2: /api/payments/transactions/{inquiry_id} returns 200 for unpaid inquiry."""
        # Create a fresh inquiry
        payload = {
            "aircraft_type": "helicopter", "total_passengers": 1,
            "adults_male": 1, "adults_female": 0, "children_count": 0,
            "udan_prakar": "one_way", "booking_for": "self", "booking_purpose": "business",
            "pickup_pincode": "400001", "pickup_location": "TEST_Mumbai",
            "pickup_state": "Maharashtra", "pickup_district": "Mumbai",
            "pickup_latitude": 19.09, "pickup_longitude": 72.87,
            "drop_pincode": "110001", "drop_location": "TEST_Delhi",
            "drop_state": "Delhi", "drop_district": "New Delhi",
            "drop_latitude": 28.55, "drop_longitude": 77.10,
            "departure_date": "2026-10-01", "pickup_time": "10:00",
            "distance_km": 1150, "estimated_price": 500000,
            "special_requirements": f"TEST_i47_{uuid.uuid4().hex[:6]}",
        }
        r = session.post(f"{BASE_URL}/api/bookings/inquiry", json=payload, timeout=45)
        assert r.status_code == 200, r.text[:300]
        inq_id = r.json()["inquiry_id"]

        r2 = session.get(f"{BASE_URL}/api/payments/transactions/{inq_id}", timeout=30)
        assert r2.status_code == 200, f"payments/transactions: {r2.status_code} {r2.text[:400]}"
        # cleanup
        try:
            from pymongo import MongoClient
            benv = dotenv_values("/app/backend/.env")
            MongoClient(benv["MONGO_URL"])[benv.get("DB_NAME", "airyatra_db")].inquiries.delete_one({"id": inq_id})
        except Exception:
            pass

    def test_customer_refunds_200(self, session, auth):
        """FIX 3: /api/customer/refunds returns 200 (frontend fallback endpoint)."""
        r = session.get(f"{BASE_URL}/api/customer/refunds", timeout=30)
        assert r.status_code == 200, f"customer/refunds: {r.status_code} {r.text[:300]}"

    def test_documents_types_customer_allowed(self, session, auth):
        """FIX 4: GET /api/admin/documents/types?category=customer now allows customer role."""
        r = session.get(f"{BASE_URL}/api/admin/documents/types?category=customer", timeout=30)
        assert r.status_code == 200, f"documents/types: {r.status_code} {r.text[:300]}"

    def test_invalid_service_type_rejected(self, session, auth):
        """FIX 8: POST /api/bookings/inquiry with aircraft_type='rocket' → 400."""
        payload = {
            "aircraft_type": "rocket", "total_passengers": 1,
            "adults_male": 1, "adults_female": 0, "children_count": 0,
            "udan_prakar": "one_way", "booking_for": "self", "booking_purpose": "business",
            "pickup_pincode": "400001", "pickup_location": "TEST_M",
            "pickup_state": "Maharashtra", "pickup_district": "Mumbai",
            "pickup_latitude": 19.09, "pickup_longitude": 72.87,
            "drop_pincode": "110001", "drop_location": "TEST_D",
            "drop_state": "Delhi", "drop_district": "New Delhi",
            "drop_latitude": 28.55, "drop_longitude": 77.10,
            "departure_date": "2026-10-01", "pickup_time": "10:00",
            "distance_km": 1150, "estimated_price": 500000,
        }
        r = session.post(f"{BASE_URL}/api/bookings/inquiry", json=payload, timeout=30)
        assert r.status_code == 400, f"expected 400 for rocket, got {r.status_code}: {r.text[:300]}"


# --- Cleanup ---
@pytest.fixture(scope="module", autouse=True)
def cleanup(created_inquiry_ids):
    yield
    # Best-effort cleanup via Mongo directly
    try:
        from pymongo import MongoClient
        backend_env = dotenv_values("/app/backend/.env")
        mongo = backend_env.get("MONGO_URL") or os.environ.get("MONGO_URL")
        dbname = backend_env.get("DB_NAME") or os.environ.get("DB_NAME") or "airyatra_db"
        if mongo and created_inquiry_ids:
            client = MongoClient(mongo)
            client[dbname].inquiries.delete_many({"id": {"$in": created_inquiry_ids}})
            client[dbname].operator_inquiries.delete_many({"inquiry_id": {"$in": created_inquiry_ids}})
    except Exception as e:
        print(f"cleanup warn: {e}")
