"""VRE (Verification Rule Engine) Backend Tests."""
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

sys.path.insert(0, "/app/backend")
from auth import create_access_token  # noqa: E402

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")

VRE_ADMIN_USER_ID = "19d5b13f-dc86-4472-a1eb-a8a390cb4c0e"


@pytest.fixture(scope="module")
def admin_token():
    token = create_access_token(
        {"sub": VRE_ADMIN_USER_ID, "email": "vreadmin@airyatra.com", "roles": ["admin", "super_admin"]},
        expires_delta=timedelta(hours=2),
    )
    return token


@pytest.fixture(scope="module")
def client(admin_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"})
    return s


# ============ Initialization ============
class TestVREInit:
    def test_initialize(self, client):
        r = client.post(f"{BASE_URL}/api/vre/admin/initialize")
        assert r.status_code == 200, r.text
        data = r.json()
        # Either freshly initialized or "already initialized"
        assert ("success" in data) or ("already" in str(data).lower())


# ============ Global Config ============
class TestGlobalConfig:
    def test_global_config(self, client):
        r = client.get(f"{BASE_URL}/api/vre/admin/global-config")
        assert r.status_code == 200, r.text
        cfg = r.json()
        assert cfg["sandbox_mode"] is True
        assert cfg["gold_threshold"] == 90
        assert cfg["silver_threshold"] == 80
        assert cfg["basic_threshold"] == 60
        assert cfg.get("default_api_provider") == "sandbox"

    def test_global_config_unauth(self):
        r = requests.get(f"{BASE_URL}/api/vre/admin/global-config")
        assert r.status_code == 401


# ============ Booking Rules ============
class TestBookingRules:
    def test_get_booking_rules(self, client):
        r = client.get(f"{BASE_URL}/api/vre/admin/booking-rules")
        assert r.status_code == 200, r.text
        rules = r.json()["rules"]
        assert len(rules) >= 4
        ids = {rule["rule_id"] for rule in rules}
        assert {"rule_1", "rule_2", "rule_3", "rule_corporate"}.issubset(ids)

        by_id = {rule["rule_id"]: rule for rule in rules}
        assert by_id["rule_1"]["min_amount"] == 0 and by_id["rule_1"]["max_amount"] == 50000
        assert by_id["rule_1"]["required_verifications"] == ["mobile_otp"]
        assert by_id["rule_2"]["min_amount"] == 50000 and by_id["rule_2"]["max_amount"] == 200000
        assert set(by_id["rule_2"]["required_verifications"]) == {"mobile_otp", "pan"}
        assert by_id["rule_3"]["min_amount"] == 200000 and by_id["rule_3"]["max_amount"] is None
        assert set(by_id["rule_3"]["required_verifications"]) == {"mobile_otp", "pan", "aadhaar"}


# ============ Auto Rules ============
class TestAutoRules:
    def test_get_auto_rules(self, client):
        r = client.get(f"{BASE_URL}/api/vre/admin/auto-rules")
        assert r.status_code == 200, r.text
        rules = r.json()["rules"]
        assert len(rules) >= 4
        triggers = {rule["trigger"] for rule in rules}
        assert {"gst_cancelled", "bank_verification_failed", "insurance_expired", "pilot_medical_expired"}.issubset(triggers)
        for rule in rules:
            assert "actions" in rule and isinstance(rule["actions"], list) and len(rule["actions"]) > 0
            assert rule.get("is_active") is True


# ============ Dashboard ============
class TestDashboard:
    def test_dashboard(self, client):
        r = client.get(f"{BASE_URL}/api/vre/admin/dashboard")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "stats" in data
        assert "badge_distribution" in data
        assert "service_usage" in data
        for k in ("total_verifications", "verified", "failed", "success_rate"):
            assert k in data["stats"]
        for k in ("gold", "silver", "basic", "pending"):
            assert k in data["badge_distribution"]
        assert isinstance(data["service_usage"], list)
        assert data.get("global_config", {}).get("gold_threshold") == 90


# ============ Services Config ============
class TestServicesConfig:
    def test_customer_services(self, client):
        r = client.get(f"{BASE_URL}/api/vre/admin/services/customer")
        assert r.status_code == 200, r.text
        cfg = r.json()
        services = cfg["services"]
        types = {s["service_type"] for s in services}
        for expected in ("mobile_otp", "email_otp", "pan", "aadhaar", "bank_account"):
            assert expected in types, f"Missing service: {expected}"
        by_type = {s["service_type"]: s for s in services}
        assert by_type["mobile_otp"]["mode"] == "mandatory"
        assert by_type["email_otp"]["mode"] == "optional"
        assert by_type["bank_account"]["mode"] == "disabled"

    def test_operator_services(self, client):
        r = client.get(f"{BASE_URL}/api/vre/admin/services/operator")
        assert r.status_code == 200, r.text
        cfg = r.json()
        types = {s["service_type"] for s in cfg["services"]}
        for expected in ("mobile_otp", "email_otp", "pan", "gst", "bank_account"):
            assert expected in types

    def test_all_services(self, client):
        r = client.get(f"{BASE_URL}/api/vre/admin/services")
        assert r.status_code == 200
        cats = r.json()["categories"]
        cat_names = {c["category"] for c in cats}
        assert {"customer", "operator"}.issubset(cat_names)


# ============ Required Verifications for Booking ============
class TestRequiredVerifications:
    def _token_for(self, user_id):
        return create_access_token({"sub": user_id, "email": "vreadmin@airyatra.com", "roles": ["admin", "super_admin"]},
                                   expires_delta=timedelta(hours=1))

    def test_low_amount(self, admin_token):
        # <=50k should require only mobile_otp
        r = requests.get(f"{BASE_URL}/api/vre/booking/required-verifications",
                         params={"booking_amount": 25000},
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["required_verifications"] == ["mobile_otp"]

    def test_medium_amount(self, admin_token):
        # 50k-2L should require mobile_otp + pan
        r = requests.get(f"{BASE_URL}/api/vre/booking/required-verifications",
                         params={"booking_amount": 100000},
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert set(data["required_verifications"]) == {"mobile_otp", "pan"}

    def test_high_amount(self, admin_token):
        # >2L should require mobile_otp + pan + aadhaar
        r = requests.get(f"{BASE_URL}/api/vre/booking/required-verifications",
                         params={"booking_amount": 500000},
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert set(data["required_verifications"]) == {"mobile_otp", "pan", "aadhaar"}

    def test_corporate(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/vre/booking/required-verifications",
                         params={"booking_amount": 100000, "is_corporate": "true"},
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert set(data["required_verifications"]) == {"gst", "pan", "cin"}


# ============ PAN Verification ============
class TestPANVerification:
    def test_invalid_pan_format(self, client):
        r = client.post(f"{BASE_URL}/api/vre/verify/pan", params={"pan_number": "INVALID"})
        assert r.status_code == 400

    def test_valid_pan_format(self, client):
        # Valid format but sandbox test key may return insufficient privilege
        r = client.post(f"{BASE_URL}/api/vre/verify/pan", params={"pan_number": "ABCDE1234F", "name": "Test User"})
        # Accept 200 (verification attempted) - success or failure
        assert r.status_code == 200, r.text
        data = r.json()
        assert "success" in data


# ============ IFSC (public) ============
class TestIFSC:
    def test_ifsc_public(self):
        r = requests.get(f"{BASE_URL}/api/vre/verify/ifsc/HDFC0000001")
        # IFSC endpoint declared public; accept 200 or upstream API error
        assert r.status_code in (200, 400, 500, 502)


# ============ Audit Logs ============
class TestAuditLogs:
    def test_audit_logs(self, client):
        r = client.get(f"{BASE_URL}/api/vre/admin/audit-logs")
        assert r.status_code == 200
        data = r.json()
        assert "logs" in data and "total" in data
        assert isinstance(data["logs"], list)


# ============ Role Permissions ============
class TestRolePermissions:
    def test_get_permissions(self, client):
        r = client.get(f"{BASE_URL}/api/vre/admin/permissions")
        assert r.status_code == 200
        perms = r.json()["permissions"]
        roles = {p["role"] for p in perms}
        for expected in ("super_admin", "admin", "cfo", "finance_head", "compliance"):
            assert expected in roles


# ============ Emergency Override ============
class TestEmergencyOverride:
    def test_get_emergency_status(self, client):
        r = client.get(f"{BASE_URL}/api/vre/admin/emergency-status")
        assert r.status_code == 200
        data = r.json()
        assert "global_status" in data
        assert "service_overrides" in data


# ============ User Verification Status ============
class TestUserVerificationStatus:
    def test_status(self, client):
        r = client.get(f"{BASE_URL}/api/vre/user/verification-status")
        assert r.status_code == 200
        data = r.json()
        assert "score" in data
        assert "badge" in data
        assert "verifications" in data
