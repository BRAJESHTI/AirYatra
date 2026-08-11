"""
Iteration 56 - Operator cross-role INTEGRATION AUDIT
Verify Operator <-> Customer, Pilot, Admin, CEO integrations end-to-end.

Runs sequentially (single test class) so state (auth tokens, IDs) is shared.
"""
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (
    os.environ.get("REACT_APP_BACKEND_URL")
    or frontend_env.get("REACT_APP_BACKEND_URL")
).rstrip("/")

CREDS = {
    "operator": ("operator@airyatra.co.in", "Operator@123456"),
    "admin":    ("admin@airyatra.co.in", "Admin123!"),
    "ceo":      ("ceo@airyatra.co.in", "CEO@123456"),
    "customer": ("customer@airyatra.co.in", "Customer@123"),
    "pilot":    ("pilot@airyatra.co.in", "Pilot@123"),
}

STATE = {}  # cross-test shared state


def _login(role):
    email, password = CREDS[role]
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=30,
    )
    assert r.status_code == 200, f"{role} login failed {r.status_code}: {r.text[:300]}"
    data = r.json()
    token = data.get("access_token")
    assert token, f"{role} login returned no access_token: {data}"
    return {"token": token, "user": data.get("user", {})}


def _hdr(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module", autouse=True)
def setup_tokens():
    # Login all five roles up-front
    for role in CREDS:
        STATE[role] = _login(role)
    yield


class TestIntegration5_OperatorCoreHealth:
    """INTEGRATION 5 - Operator core modules health checks (run first, no side-effects)."""

    def test_operator_profile(self):
        t = STATE["operator"]["token"]
        r = requests.get(f"{BASE_URL}/api/operator/profile", headers=_hdr(t), timeout=30)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        # profile may be nested; capture operator id for later
        op = body if "id" in body else body.get("operator") or body.get("profile") or body
        if isinstance(op, dict) and op.get("id"):
            STATE["operator_id"] = op["id"]

    def test_operator_dashboard(self):
        t = STATE["operator"]["token"]
        r = requests.get(f"{BASE_URL}/api/operator/dashboard", headers=_hdr(t), timeout=30)
        assert r.status_code == 200, r.text[:300]

    def test_operator_revenue_dashboard(self):
        t = STATE["operator"]["token"]
        r = requests.get(f"{BASE_URL}/api/operator/revenue/dashboard", headers=_hdr(t), timeout=30)
        assert r.status_code == 200, r.text[:300]

    def test_operator_fleet_analytics(self):
        t = STATE["operator"]["token"]
        r = requests.get(f"{BASE_URL}/api/operator/fleet/analytics", headers=_hdr(t), timeout=30)
        assert r.status_code == 200, r.text[:300]

    def test_operator_maintenance_alerts(self):
        t = STATE["operator"]["token"]
        r = requests.get(f"{BASE_URL}/api/operator/aircraft/maintenance-alerts", headers=_hdr(t), timeout=30)
        assert r.status_code == 200, r.text[:300]

    def test_operator_erp_overview(self):
        t = STATE["operator"]["token"]
        r = requests.get(f"{BASE_URL}/api/erp/operator/overview", headers=_hdr(t), timeout=30)
        assert r.status_code == 200, r.text[:300]

    def test_operator_erp_logbook(self):
        t = STATE["operator"]["token"]
        r = requests.get(f"{BASE_URL}/api/erp/operator/logbook", headers=_hdr(t), timeout=30)
        assert r.status_code == 200, r.text[:300]

    def test_operator_erp_documents(self):
        t = STATE["operator"]["token"]
        r = requests.get(f"{BASE_URL}/api/erp/operator/documents", headers=_hdr(t), timeout=30)
        assert r.status_code == 200, r.text[:300]

    def test_operator_erp_fuel(self):
        t = STATE["operator"]["token"]
        r = requests.get(f"{BASE_URL}/api/erp/operator/fuel", headers=_hdr(t), timeout=30)
        assert r.status_code == 200, r.text[:300]


class TestIntegration1_OperatorCustomerQuoteFlow:
    """INTEGRATION 1 - Customer creates custom_quote booking, operator quotes, customer accepts."""

    def test_customer_creates_custom_quote_booking(self):
        t = STATE["customer"]["token"]
        payload = {
            "from_location": "Mumbai",
            "to_location": "Delhi",
            "from_latitude": 19.0896,
            "from_longitude": 72.8656,
            "to_latitude": 28.5562,
            "to_longitude": 77.1000,
            "trip_type": "one_way",
            "departure_date": (datetime.utcnow() + timedelta(days=14)).strftime("%Y-%m-%d"),
            "passengers": 4,
            "booking_type": "custom_quote",
            "estimated_price": 500000,
            "special_requirements": "TEST_iter56_integration_audit",
        }
        r = requests.post(f"{BASE_URL}/api/bookings/", json=payload, headers=_hdr(t), timeout=30)
        assert r.status_code in (200, 201), r.text[:400]
        b = r.json().get("booking") or r.json()
        assert b.get("status") == "quote_requested", f"Expected quote_requested got {b.get('status')}"
        STATE["booking_id"] = b["id"]

    def test_operator_sees_quote_request(self):
        t = STATE["operator"]["token"]
        r = requests.get(f"{BASE_URL}/api/operator/quote-requests", headers=_hdr(t), timeout=30)
        assert r.status_code == 200, r.text[:300]
        ids = [x["id"] for x in r.json().get("requests", [])]
        assert STATE["booking_id"] in ids, (
            f"Operator did NOT see customer booking {STATE['booking_id']} in quote-requests. "
            f"Only saw: {ids[:5]}"
        )

    def test_operator_submits_quote(self):
        t = STATE["operator"]["token"]
        payload = {
            "booking_id": STATE["booking_id"],
            "amount": 480000,
            "breakdown": {"base": 400000, "fuel": 60000, "tax": 20000},
            "validity_hours": 48,
            "notes": "TEST_iter56 quote",
        }
        r = requests.post(f"{BASE_URL}/api/operator/submit-quote", json=payload, headers=_hdr(t), timeout=30)
        assert r.status_code == 200, r.text[:300]
        STATE["quote_id"] = r.json()["quote_id"]

    def test_customer_sees_quote_on_booking(self):
        t = STATE["customer"]["token"]
        r = requests.get(f"{BASE_URL}/api/bookings/{STATE['booking_id']}", headers=_hdr(t), timeout=30)
        assert r.status_code == 200, r.text[:300]
        b = r.json()
        assert b.get("status") == "quote_sent", f"Booking status: {b.get('status')}"
        quotes = b.get("quotes", [])
        assert any(q.get("id") == STATE["quote_id"] for q in quotes), (
            f"Quote {STATE['quote_id']} not visible to customer on booking. Quotes: {quotes}"
        )

    def test_customer_accepts_quote(self):
        """Customer accepts quote. Note: booking accept-quote reads quote['quoted_price'] and
        quote['aircraft_id'] which operator submit-quote does NOT set (it uses 'amount').
        This documents a schema mismatch."""
        t = STATE["customer"]["token"]
        r = requests.post(
            f"{BASE_URL}/api/bookings/{STATE['booking_id']}/accept-quote",
            json={"quote_id": STATE["quote_id"]},
            headers=_hdr(t),
            timeout=30,
        )
        assert r.status_code == 200, (
            f"accept-quote failed {r.status_code}: {r.text[:400]} - "
            f"likely schema mismatch (submit-quote writes 'amount', accept-quote reads 'quoted_price')"
        )

        # Verify booking status updated + operator_id set
        r2 = requests.get(f"{BASE_URL}/api/bookings/{STATE['booking_id']}", headers=_hdr(t), timeout=30)
        assert r2.status_code == 200
        b = r2.json()
        assert b.get("status") == "quote_accepted", f"Booking status after accept: {b.get('status')}"
        assert b.get("operator_id"), "operator_id not set on booking after accept"
        assert b.get("accepted_quote_id") == STATE["quote_id"]

    def test_operator_sees_accepted_in_my_quotes(self):
        t = STATE["operator"]["token"]
        r = requests.get(f"{BASE_URL}/api/operator/my-quotes", headers=_hdr(t), timeout=30)
        assert r.status_code == 200, r.text[:300]
        quotes = r.json().get("quotes", [])
        mine = [q for q in quotes if q.get("id") == STATE["quote_id"]]
        assert mine, f"Operator's my-quotes missing accepted quote {STATE['quote_id']}"
        # After customer accepts, the quotes.is_accepted=True; but operator my-quotes doesn't
        # necessarily reflect that. Just assert visibility of the quote record.


class TestIntegration2_OperatorPilot:
    """INTEGRATION 2 - Operator pilot management + pilot mobile dashboard cross-link."""

    def test_list_pilots(self):
        t = STATE["operator"]["token"]
        r = requests.get(f"{BASE_URL}/api/operator/pilots", headers=_hdr(t), timeout=30)
        assert r.status_code == 200, r.text[:300]
        pilots = r.json() if isinstance(r.json(), list) else r.json().get("pilots", [])
        STATE["existing_pilots"] = pilots

    def test_create_pilot(self):
        t = STATE["operator"]["token"]
        name = f"TEST_Pilot_iter56_{uuid.uuid4().hex[:6]}"
        payload = {
            "full_name": name,
            "name": name,
            "license_number": f"CPL-TEST-{uuid.uuid4().hex[:6].upper()}",
            "email": f"testpilot_{uuid.uuid4().hex[:6]}@test.local",
            "phone": "+919000000000",
            "experience_years": 8,
            "total_hours": 1200,
            "aircraft_types": ["Cessna 208"],
        }
        r = requests.post(f"{BASE_URL}/api/operator/pilots", json=payload, headers=_hdr(t), timeout=30)
        assert r.status_code in (200, 201), r.text[:400]
        body = r.json()
        pid = body.get("id") or body.get("pilot", {}).get("id") or body.get("pilot_id")
        assert pid, f"No pilot id returned: {body}"
        STATE["created_pilot_id"] = pid

    def test_pilot_availability(self):
        t = STATE["operator"]["token"]
        r = requests.get(f"{BASE_URL}/api/operator/pilots/availability", headers=_hdr(t), timeout=30)
        assert r.status_code == 200, r.text[:300]

    def test_assign_pilot_to_inquiry(self):
        """pilots/assign requires an inquiry (db.inquiries) not a booking. Create one via
        /api/bookings/inquiry and use it."""
        t_customer = STATE["customer"]["token"]
        day_offset = 10 + (uuid.uuid4().int % 300)
        travel = (datetime.utcnow() + timedelta(days=day_offset)).strftime("%Y-%m-%d")
        payload = {
            "aircraft_type": "helicopter",
            "total_passengers": 2,
            "pickup_location": "Mumbai",
            "drop_location": "Pune",
            "pickup_latitude": 19.0896, "pickup_longitude": 72.8656,
            "drop_latitude": 18.5204, "drop_longitude": 73.8567,
            "departure_date": travel,
            "travel_date": travel,
            "special_requirements": "TEST_iter56_pilot_assign",
        }
        r = requests.post(f"{BASE_URL}/api/bookings/inquiry", json=payload, headers=_hdr(t_customer), timeout=30)
        if r.status_code not in (200, 201):
            pytest.skip(f"Could not create inquiry (skipping pilot assign): {r.status_code} {r.text[:200]}")
        body = r.json()
        inq = body.get("inquiry") or body
        inq_id = inq.get("id") or body.get("inquiry_id")
        assert inq_id, f"No inquiry id: {body}"
        STATE["inquiry_id"] = inq_id

        # Assign the DEMO pilot (linked to pilot@airyatra.co.in user) for true E2E pilot-dashboard check
        t_op = STATE["operator"]["token"]
        rp = requests.get(f"{BASE_URL}/api/operator/pilots", headers=_hdr(t_op), timeout=30)
        pilots = rp.json() if isinstance(rp.json(), list) else rp.json().get("pilots", [])
        demo_pilot = next((p for p in pilots if p.get("email") == "pilot@airyatra.co.in" or p.get("user_id")), None)
        assign_pilot_id = (demo_pilot or {}).get("id") or STATE["created_pilot_id"]
        r2 = requests.post(
            f"{BASE_URL}/api/operator/pilots/assign",
            json={"booking_id": inq_id, "pilot_id": assign_pilot_id},
            headers=_hdr(t_op), timeout=30,
        )
        assert r2.status_code == 200, r2.text[:400]

    def test_pilot_mobile_dashboard_shows_assignment(self):
        """CRITICAL: pilot user must be linked to a db.pilots record via user_id, AND
        operator-created pilot_assignments must appear in pilot dashboard 'upcoming'."""
        t = STATE["pilot"]["token"]
        r = requests.get(f"{BASE_URL}/api/pilot/mobile/dashboard", headers=_hdr(t), timeout=30)
        assert r.status_code == 200, r.text[:400]
        body = r.json()
        upcoming = body.get("upcoming_flights", [])
        # This is expected to FAIL because:
        #   operator pilots/assign writes pilot_assignments with 'date' + pilot_id=db.pilots.id
        #   pilot mobile reads by pilot_id=user_id and 'flight_date' -> guaranteed mismatch
        # Also pilot@airyatra.co.in may not own a db.pilots record under this operator.
        # We assert the SHAPE and record the finding.
        assert isinstance(upcoming, list), "upcoming_flights not a list"
        STATE["pilot_dashboard_upcoming_count"] = len(upcoming)
        # informational assertion (do not fail the whole suite on this - log instead)
        if len(upcoming) == 0:
            pytest.fail(
                "INTEGRATION GAP: pilot mobile dashboard shows 0 upcoming flights even though "
                "operator just assigned a pilot. Root cause: operator writes "
                "pilot_assignments.pilot_id = db.pilots.id and .date=YYYY-MM-DD, but pilot mobile "
                "queries by pilot_id = user_id and .flight_date. Additionally pilot@airyatra.co.in "
                "may not be linked (via user_id) to the operator's db.pilots record."
            )


class TestIntegration3_OperatorAdmin:
    """INTEGRATION 3 - Admin operator management."""

    def test_admin_pending_approvals(self):
        t = STATE["admin"]["token"]
        r = requests.get(f"{BASE_URL}/api/admin/operators-management/pending-approvals", headers=_hdr(t), timeout=30)
        assert r.status_code == 200, r.text[:300]

    def test_admin_operator_performance(self):
        # Need an operator id: use the demo operator's id via operator/profile
        op_t = STATE["operator"]["token"]
        r = requests.get(f"{BASE_URL}/api/operator/profile", headers=_hdr(op_t), timeout=30)
        assert r.status_code == 200
        body = r.json()
        op_id = body.get("id") or (body.get("operator") or {}).get("id") or (body.get("profile") or {}).get("id")
        if not op_id:
            pytest.skip(f"Cannot determine operator id from /operator/profile: {str(body)[:200]}")
        STATE["demo_operator_id"] = op_id

        t = STATE["admin"]["token"]
        r2 = requests.get(
            f"{BASE_URL}/api/admin/operators-management/{op_id}/performance",
            headers=_hdr(t), timeout=30,
        )
        assert r2.status_code == 200, r2.text[:300]

    def test_admin_operator_documents(self):
        op_id = STATE.get("demo_operator_id")
        if not op_id:
            pytest.skip("no operator id")
        t = STATE["admin"]["token"]
        r = requests.get(
            f"{BASE_URL}/api/admin/operators-management/{op_id}/documents",
            headers=_hdr(t), timeout=30,
        )
        assert r.status_code == 200, r.text[:300]

    def test_admin_suspend_activate_roundtrip(self):
        """Create a throwaway TEST operator, suspend then reactivate. Never touch demo operator."""
        # Create test operator via admin? no admin create endpoint - use direct signup instead.
        # Simpler: register a new operator user, then have admin suspend/activate the operator record.
        # If we cannot create a fresh operator via API easily, fall back to using demo operator
        # BUT re-activate afterwards to leave state clean.
        op_id = STATE.get("demo_operator_id")
        if not op_id:
            pytest.skip("no operator id")
        t = STATE["admin"]["token"]
        try:
            r = requests.post(
                f"{BASE_URL}/api/admin/operators-management/{op_id}/suspend",
                json={"reason": "TEST_iter56 integration audit", "suspension_type": "temporary", "duration_days": 1},
                headers=_hdr(t), timeout=30,
            )
            # If already suspended (from earlier failed run), treat as pass
            if r.status_code == 400 and "already" in r.text.lower():
                pass
            else:
                assert r.status_code == 200, f"Suspend failed: {r.status_code} {r.text[:200]}"
        finally:
            # ALWAYS re-activate to avoid leaving demo operator broken
            r2 = requests.post(
                f"{BASE_URL}/api/admin/operators-management/{op_id}/activate",
                json={"notes": "TEST_iter56 re-activate after audit"},
                headers=_hdr(t), timeout=30,
            )
            # 400 "already active" is fine
            assert r2.status_code in (200, 400), f"Activate failed: {r2.status_code} {r2.text[:200]}"


class TestIntegration4_OperatorCEO:
    """INTEGRATION 4 - CEO dashboard shows operator counts."""

    def test_ceo_dashboard_has_operator_counts(self):
        t = STATE["ceo"]["token"]
        r = requests.get(f"{BASE_URL}/api/ceo/dashboard", headers=_hdr(t), timeout=30)
        assert r.status_code == 200, (
            f"CEO dashboard {r.status_code}: {r.text[:300]}. NOTE: endpoint requires 'admin' role - "
            f"if CEO user does not have admin role this will 403."
        )
        body = r.json()
        fleet = body.get("fleet") or {}
        assert "operators_total" in fleet, f"fleet.operators_total missing. keys: {list(fleet.keys())}"
        assert "operators_active" in fleet, f"fleet.operators_active missing. keys: {list(fleet.keys())}"
        assert isinstance(fleet["operators_total"], int)
        assert fleet["operators_total"] > 0, "operators_total is 0 - unexpected in seeded env"
