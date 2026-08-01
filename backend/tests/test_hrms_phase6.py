"""
Phase 6 tests:
  A) HRMS: Attendance CSV Export, Employee Directory (+ photo upload)
  B) Operator ERP: overview, logbook, complete maintenance, add flight log, schedule maintenance
"""
import io
import os
from datetime import datetime, timedelta

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")

ADMIN = {"email": "admin@airyatra.com", "password": "Admin123!"}
EMP = {"email": "employee@airyatra.com", "password": "Employee@123"}
OPS = {"email": "operator@airyatra.com", "password": "Operator@123456"}
CUST = {"email": "loyaltytest@airyatra.com", "password": "Loyalty@123"}

OVERDUE_MAINT_ID = "9c021511-257c-47a3-bc10-bc67e9ed142d"


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed for {creds['email']}: {r.status_code} {r.text[:300]}"
    tok = r.json().get("access_token")
    assert tok, "no access_token in login response"
    return tok


@pytest.fixture(scope="module")
def tokens():
    return {
        "admin": _login(ADMIN),
        "emp": _login(EMP),
        "ops": _login(OPS),
        "cust": _login(CUST),
    }


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- ERP Overview / Logbook ----------
class TestOperatorERP:
    def test_overview_operator(self, tokens):
        r = requests.get(f"{BASE_URL}/api/erp/operator/overview", headers=_h(tokens["ops"]), timeout=30)
        assert r.status_code == 200, r.text[:400]
        data = r.json()
        kpis = data["kpis"]
        assert kpis["fleet_size"] == 2, f"fleet_size expected 2, got {kpis}"
        assert kpis["flights_this_month"] >= 4, f"flights_this_month>=4 expected, got {kpis}"
        assert kpis["critical_alerts"] >= 1, kpis
        severities = {a["severity"] for a in data["alerts"]}
        # request expects overdue + hours_due + hours_soon to appear
        assert "overdue" in severities, f"no overdue in {severities}"
        # hours_due / hours_soon depend on aircraft hours - at least one hours-based alert should exist
        assert severities & {"hours_due", "hours_soon"}, f"no hours alert: {severities}"
        assert data["fleet"] and all("health_pct" in f for f in data["fleet"])

    def test_overview_customer_forbidden(self, tokens):
        r = requests.get(f"{BASE_URL}/api/erp/operator/overview", headers=_h(tokens["cust"]), timeout=30)
        assert r.status_code == 403, f"customer should get 403, got {r.status_code}"

    def test_logbook_all_and_filter(self, tokens):
        r = requests.get(f"{BASE_URL}/api/erp/operator/logbook", headers=_h(tokens["ops"]), timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert len(data["records"]) >= 4
        for rec in data["records"]:
            assert "aircraft_label" in rec
            assert "pilot_name" in rec
        assert "totals" in data and "hours" in data["totals"]

        # filter by first aircraft_id
        ac_id = data["records"][0]["aircraft_id"]
        r2 = requests.get(f"{BASE_URL}/api/erp/operator/logbook", params={"aircraft_id": ac_id},
                          headers=_h(tokens["ops"]), timeout=30)
        assert r2.status_code == 200
        recs = r2.json()["records"]
        assert all(rec["aircraft_id"] == ac_id for rec in recs)


# ---------- Complete Maintenance ----------
class TestCompleteMaintenance:
    def test_complete_overdue_and_reset(self, tokens):
        # Fetch overview to find Bell 407 aircraft
        pre = requests.get(f"{BASE_URL}/api/erp/operator/overview", headers=_h(tokens["ops"])).json()
        bell = next((a for a in pre["fleet"] if "VT-AYB" in a["registration"]), None)
        assert bell, "Bell 407 VT-AYB not found in fleet"
        # It may already be completed if a prior iteration ran; be tolerant
        r = requests.post(f"{BASE_URL}/api/erp/operator/maintenance/{OVERDUE_MAINT_ID}/complete",
                          headers=_h(tokens["ops"]), json={}, timeout=30)
        assert r.status_code in (200, 404), r.text[:400]

        post = requests.get(f"{BASE_URL}/api/erp/operator/overview", headers=_h(tokens["ops"])).json()
        # Overdue alert with that maintenance_id must be gone
        assert not any(a.get("maintenance_id") == OVERDUE_MAINT_ID and a["severity"] == "overdue"
                       for a in post["alerts"]), "overdue alert for that maintenance still present"
        bell2 = next(a for a in post["fleet"] if "VT-AYB" in a["registration"])
        assert bell2["hours_since_maintenance"] == 0, bell2
        assert bell2["health_pct"] == 100, bell2


# ---------- Add flight log + schedule maintenance ----------
class TestFlightAndMaintenance:
    def test_add_flight_log_and_schedule_maintenance(self, tokens):
        ov = requests.get(f"{BASE_URL}/api/erp/operator/overview", headers=_h(tokens["ops"])).json()
        aircraft_id = ov["fleet"][0]["id"]
        pilots = requests.get(f"{BASE_URL}/api/operator/pilots", headers=_h(tokens["ops"])).json()["pilots"]
        assert pilots, "no pilots"
        pilot_id = pilots[0]["id"]

        pre_count = requests.get(f"{BASE_URL}/api/erp/operator/logbook",
                                 headers=_h(tokens["ops"])).json()["totals"]["flights"]

        record_payload = {
            "aircraft_id": aircraft_id,
            "pilot_id": pilot_id,
            "departure_location": "TEST_JUHU",
            "arrival_location": "TEST_PUNE",
            "departure_time": datetime.utcnow().isoformat(),
            "arrival_time": (datetime.utcnow() + timedelta(hours=1)).isoformat(),
            "distance_km": 150,
            "flight_duration_minutes": 60,
        }
        r = requests.post(f"{BASE_URL}/api/flight-records/", json=record_payload,
                          headers=_h(tokens["ops"]), timeout=30)
        assert r.status_code == 200, r.text[:400]

        post = requests.get(f"{BASE_URL}/api/erp/operator/logbook", headers=_h(tokens["ops"])).json()
        assert post["totals"]["flights"] == pre_count + 1
        assert any(rec["departure_location"] == "TEST_JUHU" for rec in post["records"])

        # Schedule maintenance for 2 days from now (due_soon)
        due_date = (datetime.utcnow() + timedelta(days=2)).date().isoformat()
        sched = {
            "aircraft_id": aircraft_id,
            "type": "inspection",
            "description": "TEST_Phase6 due-soon inspection",
            "scheduled_date": due_date,
            "priority": "medium",
        }
        r2 = requests.post(f"{BASE_URL}/api/maintenance/schedule", json=sched,
                           headers=_h(tokens["ops"]), timeout=30)
        assert r2.status_code == 200, r2.text[:400]
        new_maint_id = r2.json()["maintenance"]["id"]

        ov2 = requests.get(f"{BASE_URL}/api/erp/operator/overview", headers=_h(tokens["ops"])).json()
        found = next((a for a in ov2["alerts"] if a.get("maintenance_id") == new_maint_id), None)
        assert found, f"new scheduled maintenance not in alerts: {[a.get('maintenance_id') for a in ov2['alerts']]}"
        assert found["severity"] == "due_soon", found


# ---------- HRMS Attendance CSV Export ----------
class TestAttendanceExport:
    def test_admin_csv_export(self, tokens):
        r = requests.get(f"{BASE_URL}/api/hr/attendance/export",
                         params={"month": 8, "year": 2026}, headers=_h(tokens["admin"]), timeout=60)
        assert r.status_code == 200, r.text[:400]
        # BOM + heading
        content = r.content
        assert content.startswith(b"\xef\xbb\xbf"), "CSV must start with UTF-8 BOM"
        text = content.decode("utf-8-sig")
        assert "AirYatra HRMS - Attendance Report" in text
        assert "SUMMARY" in text
        assert "HOLIDAYS" in text
        # some records line beyond header
        assert len(text.splitlines()) > 5

    def test_export_employee_forbidden(self, tokens):
        r = requests.get(f"{BASE_URL}/api/hr/attendance/export",
                         params={"month": 8, "year": 2026}, headers=_h(tokens["emp"]), timeout=30)
        assert r.status_code == 403


# ---------- HRMS Directory + Photo ----------
class TestDirectory:
    def test_directory_employee_access(self, tokens):
        r = requests.get(f"{BASE_URL}/api/hr/directory", headers=_h(tokens["emp"]), timeout=30)
        assert r.status_code == 200, r.text[:400]
        data = r.json()
        # response could be list or {staff: []}
        staff = data if isinstance(data, list) else data.get("staff") or data.get("employees") or data.get("directory") or []
        assert len(staff) >= 8, f"expected 8+ staff, got {len(staff)}"
        rahul = next((s for s in staff if "Rahul" in (s.get("full_name") or s.get("name") or "")), None)
        assert rahul, "Rahul Verma not found"
        assert rahul.get("photo_url"), f"Rahul photo_url missing: {rahul}"

    def test_directory_customer_forbidden(self, tokens):
        r = requests.get(f"{BASE_URL}/api/hr/directory", headers=_h(tokens["cust"]), timeout=30)
        assert r.status_code == 403

    def test_photo_upload_and_serve(self, tokens):
        # Minimal 1x1 JPEG
        jpg = bytes.fromhex(
            "ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707"
            "07090908"  # abbreviated but functional-ish header
        )
        # Use a slightly more valid tiny JPEG
        jpg = (
            b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
            b"\xff\xdb\x00C\x00" + b"\x08" * 64 +
            b"\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00"
            b"\xff\xc4\x00\x14\x00\x01" + b"\x00" * 15 + b"\x00"
            b"\xff\xc4\x00\x14\x10\x01" + b"\x00" * 15 + b"\x00"
            b"\xff\xda\x00\x08\x01\x01\x00\x00?\x00\x37\xff\xd9"
        )
        files = {"file": ("tiny.jpg", jpg, "image/jpeg")}
        r = requests.post(f"{BASE_URL}/api/hr/employee/photo",
                          headers=_h(tokens["emp"]), files=files, timeout=30)
        assert r.status_code == 200, r.text[:400]
        photo_url = r.json().get("photo_url")
        assert photo_url and photo_url.startswith("/api/uploads/profile_photos/"), photo_url
        # Serve static
        full = f"{BASE_URL}{photo_url}"
        r2 = requests.get(full, timeout=30)
        assert r2.status_code == 200, f"GET {full} -> {r2.status_code}"
        assert len(r2.content) > 100
