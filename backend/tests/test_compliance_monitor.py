"""Backend tests for AI Compliance Monitor endpoints (Phase: Document Vault & Compliance).

Endpoints covered:
- GET /api/compliance/categories (public)
- GET /api/compliance/dashboard (admin/ceo)
- GET /api/compliance/alerts (admin)
- GET /api/compliance/aircraft/{id}/score (admin/operator)
- GET /api/compliance/operator/{id}/score (admin/operator)
- POST /api/compliance/run-daily-check (admin)
- GET /api/compliance/reports (admin)
"""

import os
import sys
import time
from datetime import datetime, timedelta
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


ADMIN = {"id": "601a4741-f347-4ce8-845e-6cbd91bf9a78", "email": "admin@airyatra.com", "roles": ["admin"]}
OPERATOR = {"id": "88e05bf4-57fc-43b3-82cb-18252892026b", "email": "operator8fkf0x@airyatra.com", "roles": ["operator"]}
CUSTOMER = {"id": "d8bf6df5-360b-4a8e-b665-43d09a3e8626", "email": "loyaltytest@airyatra.com", "roles": ["customer"]}


def _token(u):
    return create_access_token({"sub": u["id"], "id": u["id"], "email": u["email"], "roles": u["roles"]})


def _h(u):
    return {"Authorization": f"Bearer {_token(u)}", "Content-Type": "application/json"}


STATE = {"aircraft_ids": []}


# ============ /categories (public) ============
class TestCategories:
    def test_categories_public_ok(self):
        r = requests.get(f"{API}/compliance/categories")
        assert r.status_code == 200, r.text
        d = r.json()
        # Presence of top-level keys
        for k in ["document_categories", "photo_categories", "tracked_documents",
                  "reminder_schedule", "verification_levels"]:
            assert k in d, f"missing {k}"

        # Document category counts per spec
        dc = d["document_categories"]
        assert set(dc.keys()) == {"operator", "dgca", "aircraft", "crew", "agreements"}
        assert len(dc["operator"]["types"]) == 6
        assert len(dc["dgca"]["types"]) == 3
        assert len(dc["aircraft"]["types"]) == 8
        assert len(dc["crew"]["types"]) == 4
        assert len(dc["agreements"]["types"]) == 3

        # Photo categories: exactly 10
        assert len(d["photo_categories"]) == 10
        photo_ids = {p["id"] for p in d["photo_categories"]}
        assert photo_ids == {"front", "rear", "left", "right", "cockpit", "cabin",
                             "interior", "vip_cabin", "emergency_equipment", "safety_equipment"}

        # Reminder schedule per spec
        assert d["reminder_schedule"] == [90, 60, 30, 15, 7, 3, 1, 0]

        # Verification levels: 5 statuses
        statuses = {v["status"] for v in d["verification_levels"]}
        assert statuses == {"pending", "under_review", "verified", "premium_verified", "suspended"}

        # Tracked documents - must include the critical ones
        td = d["tracked_documents"]
        for key in ["insurance_policy", "certificate_of_airworthiness", "maintenance_release",
                    "aoc", "pilot_licence", "medical_certificate"]:
            assert key in td
            assert td[key]["critical"] is True


# ============ /dashboard (admin) ============
class TestDashboard:
    def test_dashboard_admin_ok(self):
        r = requests.get(f"{API}/compliance/dashboard", headers=_h(ADMIN))
        assert r.status_code == 200, r.text
        d = r.json()
        # Structure
        assert "aircraft" in d and "compliance_alerts" in d and "last_check" in d
        ac = d["aircraft"]
        for k in ["total", "verified", "pending", "suspended", "published"]:
            assert k in ac
            assert isinstance(ac[k], int)
            assert ac[k] >= 0
        ca = d["compliance_alerts"]
        for k in ["insurance_expiring_30d", "maintenance_due_30d", "total_alerts"]:
            assert k in ca
            assert isinstance(ca[k], int)
        # total_alerts = sum of the two
        assert ca["total_alerts"] == ca["insurance_expiring_30d"] + ca["maintenance_due_30d"]

    def test_dashboard_unauthorized(self):
        r = requests.get(f"{API}/compliance/dashboard", headers=_h(CUSTOMER))
        assert r.status_code in (401, 403)

    def test_dashboard_no_auth(self):
        r = requests.get(f"{API}/compliance/dashboard")
        assert r.status_code in (401, 403)


# ============ /alerts (admin) ============
class TestAlerts:
    def test_alerts_default_threshold_30(self):
        r = requests.get(f"{API}/compliance/alerts", headers=_h(ADMIN))
        assert r.status_code == 200, r.text
        d = r.json()
        assert "alerts" in d and "count" in d and "by_severity" in d
        assert d["count"] == len(d["alerts"])
        # by_severity must have all keys
        for k in ["expired", "critical", "high", "warning", "attention", "info"]:
            assert k in d["by_severity"]

    def test_alerts_with_threshold_90(self):
        r = requests.get(f"{API}/compliance/alerts?days_threshold=90", headers=_h(ADMIN))
        assert r.status_code == 200
        d = r.json()
        assert d["count"] >= 0

    def test_alerts_threshold_over_max_rejected(self):
        # Query is capped by le=90
        r = requests.get(f"{API}/compliance/alerts?days_threshold=200", headers=_h(ADMIN))
        assert r.status_code == 422

    def test_alerts_filter_by_severity(self):
        r = requests.get(f"{API}/compliance/alerts?severity=critical", headers=_h(ADMIN))
        assert r.status_code == 200
        for a in r.json()["alerts"]:
            assert a["severity"] == "critical"

    def test_alerts_forbidden_for_operator(self):
        r = requests.get(f"{API}/compliance/alerts", headers=_h(OPERATOR))
        assert r.status_code in (401, 403)


# ============ /aircraft/{id}/score & /operator/{id}/score ============
class TestScores:
    def test_create_seed_aircraft_for_scoring(self):
        """Create an aircraft with full documents, photos, crew, pricing to score well."""
        reg = f"VT-CMP{int(time.time())}"
        # Future dates (>60d) - should be 'info' severity
        future_ins = (datetime.now() + timedelta(days=120)).strftime("%Y-%m-%d")
        future_mnt = (datetime.now() + timedelta(days=120)).strftime("%Y-%m-%d")
        payload = {
            "basic_info": {
                "aircraft_type": "helicopter",
                "manufacturer": "Bell",
                "model": "407",
                "year_of_manufacture": 2021,
                "registration_number": reg,
                "serial_number": f"SNCMP{int(time.time())}"
            },
            "features": {"total_seats": 6, "vip_seats": 2},
            "pricing": {"one_way_price": 100000, "hourly_price": 80000},
            "description": "TEST compliance aircraft"
        }
        r = requests.post(f"{API}/aircraft/create", json=payload, headers=_h(OPERATOR))
        assert r.status_code == 200, r.text
        aid = r.json()["aircraft_id"]
        STATE["aircraft_ids"].append(aid)
        STATE["good_aircraft_id"] = aid

        # Upload documents via separate endpoint
        r = requests.put(f"{API}/aircraft/{aid}/documents", headers=_h(OPERATOR), json={
            "registration_certificate": "https://example.com/rc.pdf",
            "insurance_policy": "https://example.com/ins.pdf",
            "insurance_expiry": future_ins,
            "maintenance_release": "https://example.com/mr.pdf",
            "next_maintenance_due": future_mnt
        })
        assert r.status_code == 200, r.text

        # Upload photos
        r = requests.put(f"{API}/aircraft/{aid}/photos", headers=_h(OPERATOR), json={
            "front": "https://example.com/f.jpg",
            "rear": "https://example.com/r.jpg",
            "left": "https://example.com/l.jpg",
            "right": "https://example.com/ri.jpg",
            "cockpit": "https://example.com/cp.jpg",
            "cabin": "https://example.com/cb.jpg"
        })
        assert r.status_code == 200, r.text

        # Add crew pilot
        r = requests.post(f"{API}/aircraft/{aid}/crew", headers=_h(OPERATOR), json={
            "role": "pilot", "name": "Test Pilot", "licence_number": "CPL-TEST"
        })
        assert r.status_code == 200, r.text

    def test_aircraft_score_high(self):
        aid = STATE["good_aircraft_id"]
        r = requests.get(f"{API}/compliance/aircraft/{aid}/score", headers=_h(ADMIN))
        assert r.status_code == 200, r.text
        d = r.json()
        cs = d["compliance_score"]
        # Weighted breakdown structure
        det = cs["details"]
        for k in ["documents_valid", "documents_uploaded", "photos_complete",
                  "crew_complete", "pricing_set", "verified"]:
            assert k in det
        # With all docs valid + uploaded + photos + pilot + pricing: 30+20+15+15+10 = 90 (verified=0 since pending)
        assert cs["total_score"] == 90, f"Expected 90, got {cs['total_score']} details={det}"
        assert cs["max_score"] == 100
        assert cs["percentage"] == cs["total_score"]
        assert cs["grade"] == "A"
        # Recommendations should include verification submission
        assert any("verification" in rec.lower() or "verified" in rec.lower()
                   for rec in d["recommendations"])

    def test_aircraft_score_not_found(self):
        r = requests.get(f"{API}/compliance/aircraft/nonexistent-id-xyz/score", headers=_h(ADMIN))
        assert r.status_code == 404

    def test_aircraft_score_access_denied_other_operator(self):
        aid = STATE["good_aircraft_id"]
        other = {"id": "someone-else-uuid", "email": "x@x.com", "roles": ["operator"]}
        r = requests.get(f"{API}/compliance/aircraft/{aid}/score",
                         headers={"Authorization": f"Bearer {_token(other)}"})
        assert r.status_code in (401, 403)

    def test_operator_score_cross_access_denied(self):
        r = requests.get(f"{API}/compliance/operator/{OPERATOR['id']}/score", headers=_h(ADMIN))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["operator_id"] == OPERATOR["id"]
        assert d["aircraft_count"] >= 1
        assert "overall_score" in d and "overall_grade" in d
        assert 0 <= d["overall_score"] <= 100
        # Overall grade valid
        assert d["overall_grade"] in {"A", "B", "C", "D", "F"}
        # Aircraft breakdown present
        assert len(d["aircraft_scores"]) == d["aircraft_count"]

    def test_operator_score_operator_self_access(self):
        r = requests.get(f"{API}/compliance/operator/{OPERATOR['id']}/score", headers=_h(OPERATOR))
        assert r.status_code == 200

    def test_operator_score_cross_access_denied(self):
        r = requests.get(f"{API}/compliance/operator/{OPERATOR['id']}/score",
                         headers=_h({"id": "another-op", "email": "a@a.com", "roles": ["operator"]}))
        assert r.status_code in (401, 403)

    def test_operator_score_no_aircraft(self):
        fake_op = "no-aircraft-operator-uuid-xxx"
        r = requests.get(f"{API}/compliance/operator/{fake_op}/score", headers=_h(ADMIN))
        assert r.status_code == 200
        d = r.json()
        assert d["aircraft_count"] == 0
        assert d["overall_score"] == 0


# ============ /run-daily-check (admin) ============
class TestRunDailyCheck:
    def test_run_daily_check_admin(self):
        # send_reminders=False to avoid email side effects; auto_hide_expired=False to keep seed data intact
        r = requests.post(
            f"{API}/compliance/run-daily-check?send_reminders=false&auto_hide_expired=false",
            headers=_h(ADMIN)
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["success"] is True
        assert "report_id" in d
        s = d["summary"]
        for k in ["aircraft_checked", "total_alerts", "expired_documents",
                  "critical_alerts", "reminders_sent", "aircraft_hidden"]:
            assert k in s
        assert s["reminders_sent"] == 0  # since send_reminders=false
        assert s["aircraft_hidden"] == 0  # since auto_hide_expired=false
        STATE["last_report_id"] = d["report_id"]

    def test_run_daily_check_forbidden_operator(self):
        r = requests.post(f"{API}/compliance/run-daily-check", headers=_h(OPERATOR))
        assert r.status_code in (401, 403)


# ============ /reports (admin) ============
class TestReports:
    def test_reports_list(self):
        r = requests.get(f"{API}/compliance/reports", headers=_h(ADMIN))
        assert r.status_code == 200, r.text
        d = r.json()
        assert "reports" in d and "count" in d
        # At least the one we just created
        assert d["count"] >= 1
        # Ensure last report we created is present
        ids = [rep.get("id") for rep in d["reports"]]
        assert STATE.get("last_report_id") in ids
        # alerts detail field should be excluded (per projection {alerts: 0})
        for rep in d["reports"]:
            assert "alerts" not in rep
            # But summary counters should be present
            assert "total_alerts" in rep or "alerts_by_severity" in rep

    def test_reports_limit_cap(self):
        r = requests.get(f"{API}/compliance/reports?limit=100", headers=_h(ADMIN))
        # limit is le=50
        assert r.status_code == 422

    def test_reports_forbidden_operator(self):
        r = requests.get(f"{API}/compliance/reports", headers=_h(OPERATOR))
        assert r.status_code in (401, 403)


# ============ Cleanup ============
class TestCleanup:
    def test_cleanup_seeded_aircraft(self):
        # No DELETE endpoint per prev report; leave records but note
        # Try to unpublish via update
        for aid in STATE.get("aircraft_ids", []):
            try:
                requests.put(f"{API}/aircraft/{aid}",
                             json={"is_published": False},
                             headers=_h(OPERATOR), timeout=10)
            except Exception:
                pass
        # Always pass
        assert True
