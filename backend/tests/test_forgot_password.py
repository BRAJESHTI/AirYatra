"""Tests for Forgot Password flow (Email + Phone) and Google emergent-callback."""
import os
import time
import requests
import pytest
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")

CUSTOMER_EMAIL = "customer@airyatra.co.in"
CUSTOMER_PASSWORD = "Customer@123"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- Existing login still works ----------
class TestBaselineLogin:
    def test_customer_login(self, client):
        r = client.post(f"{BASE_URL}/api/auth/login", json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data or "token" in data


# ---------- Forgot Password: Email ----------
class TestForgotPasswordEmail:
    def test_send_otp_existing_email(self, client):
        r = client.post(f"{BASE_URL}/api/auth/forgot-password/send-otp",
                        json={"identifier": CUSTOMER_EMAIL, "method": "email"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True
        assert data.get("method") == "email"
        # message should be masked
        assert "***" in data.get("message", "") or "sent" in data.get("message", "").lower()

    def test_send_otp_unknown_email_no_enumeration(self, client):
        r = client.post(f"{BASE_URL}/api/auth/forgot-password/send-otp",
                        json={"identifier": f"nouser_{int(time.time())}@example.com", "method": "email"})
        assert r.status_code == 200, r.text
        data = r.json()
        # Do not reveal absence
        assert data.get("success") is True

    def test_verify_otp_invalid(self, client):
        # Ensure a fresh OTP exists first
        client.post(f"{BASE_URL}/api/auth/forgot-password/send-otp",
                    json={"identifier": CUSTOMER_EMAIL, "method": "email"})
        r = client.post(f"{BASE_URL}/api/auth/forgot-password/verify-otp",
                        json={"identifier": CUSTOMER_EMAIL, "otp_code": "000000", "method": "email"})
        assert r.status_code == 401, r.text

    def test_verify_otp_unknown_email(self, client):
        r = client.post(f"{BASE_URL}/api/auth/forgot-password/verify-otp",
                        json={"identifier": "nobody_xyz@example.com", "otp_code": "123456", "method": "email"})
        assert r.status_code == 400

    def test_reset_password_short(self, client):
        r = client.post(f"{BASE_URL}/api/auth/forgot-password/reset",
                        json={"identifier": CUSTOMER_EMAIL, "otp_code": "123456",
                              "new_password": "short", "method": "email"})
        assert r.status_code == 400
        assert "8" in r.json().get("detail", "")

    def test_reset_password_invalid_otp(self, client):
        r = client.post(f"{BASE_URL}/api/auth/forgot-password/reset",
                        json={"identifier": CUSTOMER_EMAIL, "otp_code": "000000",
                              "new_password": "NewPass@123", "method": "email"})
        assert r.status_code == 401


# ---------- Forgot Password: Phone ----------
class TestForgotPasswordPhone:
    def test_send_otp_unknown_phone_no_enumeration(self, client):
        r = client.post(f"{BASE_URL}/api/auth/forgot-password/send-otp",
                        json={"identifier": "+919000000001", "method": "phone"})
        # Accept 200 (no-enum) or an explicit provider failure. Route returns 200 for unknown phones.
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("method") == "phone"


# ---------- Google Emergent callback resilience ----------
class TestGoogleEmergentCallback:
    def test_empty_body_rejected(self, client):
        r = client.post(f"{BASE_URL}/api/auth/google/emergent-callback", json={})
        # Should NOT be 500; should be 400 or 422
        assert r.status_code in (400, 401, 422), r.text

    def test_invalid_session_rejected(self, client):
        r = client.post(f"{BASE_URL}/api/auth/google/emergent-callback",
                        json={"session_token": "invalid-token-xyz",
                              "emergent_user": {"email": "x@example.com", "name": "X"}})
        # Should not crash; expect 4xx
        assert 400 <= r.status_code < 500, r.text
