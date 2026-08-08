"""
Tests for Google OAuth double-verification fix.
Verifies:
1. /api/auth/google/emergent-callback returns 200 with valid emergent_user (no double verify)
2. Rejects missing/invalid emergent_user
3. Normal email/password login still works
4. /api/auth/google/settings works
"""
import os
import time
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


class TestGoogleOAuthCallbackFix:
    """SEC verification: emergent-callback should trust frontend-verified data (no double verify)."""

    def test_settings_endpoint_available(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/auth/google/settings")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:300]}"
        data = r.json()
        assert "enabled" in data

    def test_emergent_callback_success_with_valid_user_data(self, api_client):
        """Should return 200 with access_token when given valid emergent_user (no server verify)."""
        unique = f"test_gauth_{int(time.time()*1000)}@example.com"
        payload = {
            "emergent_user": {
                "id": f"emergent_id_{int(time.time())}",
                "email": unique,
                "name": "OAuth Fix Test",
                "picture": "https://example.com/p.png"
            },
            "session_token": "fake-session-token-frontend-already-consumed",
            "device_info": {"platform": "test"}
        }
        r = api_client.post(f"{BASE_URL}/api/auth/google/emergent-callback", json=payload)
        assert r.status_code == 200, (
            f"Expected 200 (double-verify removed), got {r.status_code}: {r.text[:500]}"
        )
        data = r.json()
        assert data.get("access_token"), f"Missing access_token: {data}"
        assert isinstance(data["access_token"], str) and len(data["access_token"]) > 20
        assert data.get("user", {}).get("email") == unique

        # Verify persistence via /auth/me
        me = api_client.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {data['access_token']}"}
        )
        assert me.status_code == 200, f"/auth/me failed: {me.status_code} {me.text[:300]}"
        assert me.json().get("email") == unique

        # Cleanup
        try:
            from pymongo import MongoClient
            backend_env = dotenv_values("/app/backend/.env")
            client = MongoClient(backend_env.get("MONGO_URL"))
            db = client[backend_env.get("DB_NAME")]
            db.users.delete_one({"email": unique})
            db.user_sessions.delete_many({"user_id": data["user"]["id"]})
        except Exception as e:
            print(f"cleanup skipped: {e}")

    def test_emergent_callback_existing_user_updates(self, api_client):
        """Second call with same email should update the existing user (not error)."""
        email = f"test_gauth_existing_{int(time.time()*1000)}@example.com"
        payload = {
            "emergent_user": {"id": "eid_1", "email": email, "name": "First Name"},
            "session_token": "s1",
            "device_info": {}
        }
        r1 = api_client.post(f"{BASE_URL}/api/auth/google/emergent-callback", json=payload)
        assert r1.status_code == 200, r1.text[:300]
        uid1 = r1.json()["user"]["id"]

        payload["emergent_user"]["name"] = "Updated Name"
        r2 = api_client.post(f"{BASE_URL}/api/auth/google/emergent-callback", json=payload)
        assert r2.status_code == 200, r2.text[:300]
        uid2 = r2.json()["user"]["id"]
        assert uid1 == uid2, "Same email should map to same user id"

        # Cleanup
        try:
            from pymongo import MongoClient
            backend_env = dotenv_values("/app/backend/.env")
            client = MongoClient(backend_env.get("MONGO_URL"))
            db = client[backend_env.get("DB_NAME")]
            db.users.delete_one({"email": email})
            db.user_sessions.delete_many({"user_id": uid1})
        except Exception:
            pass

    def test_emergent_callback_rejects_missing_email(self, api_client):
        payload = {
            "emergent_user": {"id": "x", "name": "No Email"},
            "session_token": "s",
            "device_info": {}
        }
        r = api_client.post(f"{BASE_URL}/api/auth/google/emergent-callback", json=payload)
        assert r.status_code in (400, 422), f"Expected 4xx, got {r.status_code}: {r.text[:300]}"

    def test_emergent_callback_rejects_empty_emergent_user(self, api_client):
        payload = {"emergent_user": {}, "session_token": "s", "device_info": {}}
        r = api_client.post(f"{BASE_URL}/api/auth/google/emergent-callback", json=payload)
        assert r.status_code in (400, 422), f"Expected 4xx, got {r.status_code}: {r.text[:300]}"


class TestNormalLoginRegression:
    """Ensure normal email/password login is not broken by the fix."""

    def test_customer_login_success(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "customer@airyatra.co.in",
            "password": "Customer@123"
        })
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:400]}"
        data = r.json()
        # Either direct token, or otp_required (should be False per test_credentials note)
        if data.get("otp_required") or data.get("totp_required"):
            pytest.skip(f"Login gated by OTP/TOTP: {data}")
        assert data.get("access_token"), f"No access_token: {data}"
        assert data.get("user", {}).get("email") == "customer@airyatra.co.in"

    def test_customer_login_invalid_password(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "customer@airyatra.co.in",
            "password": "WrongPassword!"
        })
        assert r.status_code in (401, 423), f"Expected 401/423, got {r.status_code}: {r.text[:300]}"
