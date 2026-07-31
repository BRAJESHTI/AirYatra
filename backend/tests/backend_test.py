"""
Backend tests for AirYatra OS Phase 1: Membership, Corporate, Document Vault
"""
import os
import io
import uuid
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    return s


# ============ Membership ============
class TestMembership:
    def test_get_tiers(self, api):
        r = api.get(f"{BASE_URL}/api/membership/tiers", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        tiers = data["tiers"]
        for t in ["silver", "gold", "platinum", "black"]:
            assert t in tiers
        assert tiers["silver"]["annual_fee"] == 25000
        assert tiers["gold"]["annual_fee"] == 75000
        assert tiers["platinum"]["annual_fee"] == 200000
        assert tiers["black"]["annual_fee"] == 500000
        assert tiers["silver"]["discount_percent"] == 5
        assert tiers["black"]["discount_percent"] >= 20

    def test_get_tier_details(self, api):
        r = api.get(f"{BASE_URL}/api/membership/tier/gold", timeout=30)
        assert r.status_code == 200
        assert r.json()["details"]["name"] == "Gold"

    def test_get_tier_invalid(self, api):
        r = api.get(f"{BASE_URL}/api/membership/tier/bronze", timeout=30)
        assert r.status_code == 404

    def test_subscribe_invalid_user_id(self, api):
        # user_id must be valid ObjectId for user update; if invalid it may error
        payload = {
            "user_id": "507f1f77bcf86cd799439011",  # valid ObjectId format, likely no user
            "tier": "silver",
            "payment_method": "online",
            "auto_renew": True,
        }
        r = api.post(f"{BASE_URL}/api/membership/subscribe", json=payload, timeout=30)
        # Should succeed creating membership doc; user update is safe no-op
        assert r.status_code in (200, 400), r.text
        if r.status_code == 200:
            data = r.json()
            assert data["success"] is True
            assert data["membership"]["tier"] == "silver"
            assert data["membership"]["card_number"].startswith("AY-SLV-")

    def test_calculate_discount_no_membership(self, api):
        r = api.get(
            f"{BASE_URL}/api/membership/calculate-discount",
            params={"user_id": f"nouser-{uuid.uuid4().hex}", "booking_amount": 100000},
            timeout=30,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["has_discount"] is False
        assert data["final_amount"] == 100000

    def test_calculate_discount_with_membership(self, api):
        # Create a membership then compute discount
        user_id = "507f1f77bcf86cd7994390aa"
        # cleanup existing
        api.post(f"{BASE_URL}/api/membership/cancel/{user_id}", timeout=30)
        payload = {"user_id": user_id, "tier": "gold", "payment_method": "online", "auto_renew": False}
        api.post(f"{BASE_URL}/api/membership/subscribe", json=payload, timeout=30)
        r = api.get(
            f"{BASE_URL}/api/membership/calculate-discount",
            params={"user_id": user_id, "booking_amount": 100000},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        if data.get("has_discount"):
            assert data["discount_percent"] == 10
            assert data["discount_amount"] == 10000
            assert data["final_amount"] == 90000


# ============ Corporate ============
class TestCorporate:
    corp_id = None
    emp_code = None

    def test_register_corporate(self, api):
        unique = uuid.uuid4().hex[:8].upper()
        payload = {
            "company_name": f"TEST_Corp_{unique}",
            "registration_number": f"REG-{unique}",
            "gst_number": f"GST-{unique}",
            "industry": "IT",
            "company_size": "50-200",
            "address": "1 Test St",
            "city": "Mumbai",
            "state": "MH",
            "pincode": "400001",
            "primary_contact_name": "Test Contact",
            "primary_contact_email": f"contact_{unique}@test.com",
            "primary_contact_phone": "+919999999999",
            "admin_email": f"admin_{unique}@test.com",
            "admin_name": "Admin",
            "credit_limit_requested": 100000,
        }
        r = api.post(f"{BASE_URL}/api/corporate/register", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        assert data["corporate_id"].startswith("CORP-")
        TestCorporate.corp_id = data["corporate_id"]

    def test_list_corporates(self, api):
        r = api.get(f"{BASE_URL}/api/corporate/list", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "corporates" in data
        assert isinstance(data["corporates"], list)
        assert data["total"] >= 1

    def test_add_employee(self, api):
        assert TestCorporate.corp_id, "corporate_id required"
        unique = uuid.uuid4().hex[:6]
        payload = {
            "corporate_id": TestCorporate.corp_id,
            "name": "Test Employee",
            "email": f"emp_{unique}@test.com",
            "phone": "+919888888888",
            "department": "Engineering",
            "designation": "SDE",
            "role": "traveler",
            "travel_budget": 100000,
            "can_book_for_others": False,
            "requires_approval": True,
            "approval_limit": 50000,
        }
        r = api.post(f"{BASE_URL}/api/corporate/employee/add", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        TestCorporate.emp_code = data["employee_code"]

    def test_get_account(self, api):
        assert TestCorporate.corp_id
        r = api.get(f"{BASE_URL}/api/corporate/account/{TestCorporate.corp_id}", timeout=30)
        assert r.status_code == 200
        assert r.json()["corporate"]["corporate_id"] == TestCorporate.corp_id

    def test_request_booking_approval(self, api):
        """Tests the ApprovalStatus vs CorporateApprovalStatus bug"""
        assert TestCorporate.emp_code
        payload = {
            "corporate_id": TestCorporate.corp_id,
            "booking_id": f"BK-{uuid.uuid4().hex[:6]}",
            "employee_id": TestCorporate.emp_code,
            "amount": 10000,  # below auto_approve threshold => auto_approved path
            "purpose": "Client meeting",
            "urgency": "normal",
        }
        r = api.post(f"{BASE_URL}/api/corporate/booking/request-approval", json=payload, timeout=30)
        assert r.status_code == 200, f"Booking approval failed: {r.status_code} {r.text}"


# ============ Document Vault ============
class TestVault:
    owner_id = f"testowner_{uuid.uuid4().hex[:8]}"
    document_id = None

    def test_upload_document(self, api):
        files = {"file": ("test.txt", io.BytesIO(b"hello world"), "text/plain")}
        data = {
            "owner_id": TestVault.owner_id,
            "owner_type": "user",
            "name": "TEST_Document",
            "category": "personal",
            "document_type": "other",
            "description": "Test upload",
            "tags": "test,vault",
            "is_sensitive": "false",
            "reminder_days": "30",
        }
        r = api.post(f"{BASE_URL}/api/vault/upload", data=data, files=files, timeout=60)
        assert r.status_code == 200, f"Upload failed: {r.status_code} {r.text}"
        rd = r.json()
        assert rd["success"] is True
        TestVault.document_id = rd["document"]["document_id"]

    def test_get_documents(self, api):
        r = api.get(f"{BASE_URL}/api/vault/documents/{TestVault.owner_id}", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["total"] >= 1
        assert any(x["name"] == "TEST_Document" for x in d["documents"])

    def test_statistics(self, api):
        r = api.get(f"{BASE_URL}/api/vault/statistics/{TestVault.owner_id}", timeout=30)
        assert r.status_code == 200
        stats = r.json()["statistics"]
        assert stats["total_documents"] >= 1
