"""
Iteration 53 - Profile Settings, Change Password, Delete Account, Emergent Google Auth verification.

Tests:
  - Google OAuth backend: fake session_token -> 401 (not 500), missing emergent_user field is OK
  - Profile: PUT /api/auth/profile updates persist
  - Change password flow (loyaltytest@) + restoration to Loyalty@123
  - Delete account: throwaway user registration, wrong-password 401, unauth 401,
      success -> old token revoked, login rejected
  - Regression: normal login for seed accounts still works
"""

import os
import time
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL", "")).rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL missing"

SEED_ACCOUNTS = [
    ("customer@airyatra.co.in", "Customer@123"),
    ("admin@airyatra.co.in", "Admin123!"),
    ("operator@airyatra.co.in", "Operator@123456"),
]

LOYALTY_EMAIL = "loyaltytest@airyatra.co.in"
LOYALTY_ORIG_PW = "Loyalty@123"
LOYALTY_NEW_PW = "Loyalty@1234"


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=20)
    return r


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ------------ Google Emergent Auth ------------
class TestEmergentGoogleAuth:
    def test_settings_endpoint(self):
        r = requests.get(f"{BASE_URL}/api/auth/google/settings", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "enabled" in data

    def test_fake_session_token_returns_401_not_500(self):
        """Fake session_token must be REJECTED by server-side verification, not 500 error."""
        fake_token = f"fake_session_{uuid.uuid4().hex}"
        r = requests.post(
            f"{BASE_URL}/api/auth/google/emergent-callback",
            json={"session_token": fake_token, "device_info": {"platform": "test"}},
            timeout=30,
        )
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text[:300]}"
        body = r.json()
        assert "detail" in body

    def test_request_without_emergent_user_field_accepted(self):
        """Backend model should NOT 422 for missing emergent_user (it's Optional)."""
        fake_token = f"fake_session_{uuid.uuid4().hex}"
        # No emergent_user field
        r = requests.post(
            f"{BASE_URL}/api/auth/google/emergent-callback",
            json={"session_token": fake_token},
            timeout=30,
        )
        assert r.status_code != 422, f"Should not be 422 validation error: {r.text[:300]}"
        assert r.status_code == 401  # rejected because fake token can't be verified

    def test_missing_session_token_is_422(self):
        """Missing required session_token should be 422 validation error."""
        r = requests.post(
            f"{BASE_URL}/api/auth/google/emergent-callback",
            json={"device_info": {}},
            timeout=15,
        )
        assert r.status_code == 422


# ------------ Regression: Normal Login ------------
class TestRegressionLogin:
    @pytest.mark.parametrize("email,password", SEED_ACCOUNTS)
    def test_login_seed_accounts(self, email, password):
        r = _login(email, password)
        assert r.status_code == 200, f"{email} login failed: {r.status_code} {r.text[:200]}"
        data = r.json()
        assert "access_token" in data
        assert data["user"]["email"] == email
        time.sleep(1)  # be gentle on rate limit


# ------------ Profile Update ------------
class TestProfileUpdate:
    def test_get_me_and_update_profile(self):
        r = _login("customer@airyatra.co.in", "Customer@123")
        assert r.status_code == 200
        token = r.json()["access_token"]

        me = requests.get(f"{BASE_URL}/api/auth/me", headers=_auth_headers(token), timeout=15)
        assert me.status_code == 200
        original = me.json()

        new_city = f"TEST_CITY_{uuid.uuid4().hex[:6]}"
        upd = requests.put(
            f"{BASE_URL}/api/auth/profile",
            headers=_auth_headers(token),
            json={"city": new_city, "full_name": original.get("full_name") or "Customer Demo"},
            timeout=15,
        )
        assert upd.status_code == 200, upd.text
        body = upd.json()
        assert body["user"]["city"] == new_city

        # Verify persistence via GET /me
        me2 = requests.get(f"{BASE_URL}/api/auth/me", headers=_auth_headers(token), timeout=15)
        assert me2.status_code == 200
        assert me2.json()["city"] == new_city


# ------------ Change Password (loyaltytest) ------------
class TestChangePassword:
    def test_change_password_and_restore(self):
        # 1. login with current pw
        r = _login(LOYALTY_EMAIL, LOYALTY_ORIG_PW)
        assert r.status_code == 200, f"Initial login failed: {r.text[:200]}"
        token = r.json()["access_token"]

        # 2. Wrong current password -> 401
        wrong = requests.put(
            f"{BASE_URL}/api/auth/change-password",
            headers=_auth_headers(token),
            json={"current_password": "WrongPass123!", "new_password": "SomethingNew@123"},
            timeout=15,
        )
        assert wrong.status_code == 401

        # 3. Correct change: Loyalty@123 -> Loyalty@1234
        chg = requests.put(
            f"{BASE_URL}/api/auth/change-password",
            headers=_auth_headers(token),
            json={"current_password": LOYALTY_ORIG_PW, "new_password": LOYALTY_NEW_PW},
            timeout=15,
        )
        assert chg.status_code == 200, chg.text

        time.sleep(2)

        # 4. Login with new pw works
        r_new = _login(LOYALTY_EMAIL, LOYALTY_NEW_PW)
        assert r_new.status_code == 200, f"New pw login failed: {r_new.text[:200]}"
        token_new = r_new.json()["access_token"]

        # 5. Restore original password via API
        restore = requests.put(
            f"{BASE_URL}/api/auth/change-password",
            headers=_auth_headers(token_new),
            json={"current_password": LOYALTY_NEW_PW, "new_password": LOYALTY_ORIG_PW},
            timeout=15,
        )
        assert restore.status_code == 200, f"Restore failed: {restore.text}"

        time.sleep(2)

        # 6. Confirm login with original pw again
        final = _login(LOYALTY_EMAIL, LOYALTY_ORIG_PW)
        assert final.status_code == 200, f"Final restore verification failed: {final.text[:200]}"


# ------------ Delete Account ------------
class TestDeleteAccount:
    def _register(self, email, password):
        return requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "password": password,
                "full_name": "Delete Test",
                "phone": "+919999999999",
            },
            timeout=20,
        )

    def test_delete_account_unauth_401(self):
        r = requests.post(f"{BASE_URL}/api/auth/delete-account", json={"password": "x"}, timeout=15)
        assert r.status_code in (401, 403)

    def test_delete_flow(self):
        ts = int(time.time() * 1000)
        email = f"deltest_{ts}@airyatra.co.in"
        password = "Delete@123"

        # Register throwaway user (register is rate-limited 3/min — sleep before if needed)
        time.sleep(2)
        reg = self._register(email, password)
        assert reg.status_code == 200, f"Register failed: {reg.status_code} {reg.text[:300]}"
        token = reg.json()["access_token"]

        # wrong password -> 401
        wrong = requests.post(
            f"{BASE_URL}/api/auth/delete-account",
            headers=_auth_headers(token),
            json={"password": "WrongPass!", "confirm_text": "DELETE"},
            timeout=15,
        )
        assert wrong.status_code == 401

        # correct delete
        ok = requests.post(
            f"{BASE_URL}/api/auth/delete-account",
            headers=_auth_headers(token),
            json={"password": password, "confirm_text": "DELETE"},
            timeout=20,
        )
        assert ok.status_code == 200, ok.text
        body = ok.json()
        assert body.get("success") or "deleted" in str(body).lower() or "message" in body

        # old token revoked -> /auth/me should reject
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=_auth_headers(token), timeout=15)
        assert me.status_code in (401, 403), f"Old token should be revoked: {me.status_code}"

        # cannot login with deleted account credentials
        time.sleep(2)
        relog = _login(email, password)
        assert relog.status_code in (401, 403), f"Deleted user login: {relog.status_code} {relog.text[:200]}"
