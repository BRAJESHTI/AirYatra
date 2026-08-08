"""Security audit verification tests for SEC-001, SEC-002, SEC-003."""
import os
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = (
    os.environ.get("REACT_APP_BACKEND_URL")
    or frontend_env.get("REACT_APP_BACKEND_URL")
)
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# SEC-001: Google OAuth server-side verification
class TestGoogleOAuthVerification:
    def test_missing_session_token_rejected(self, client):
        """No session_token should return 400."""
        r = client.post(
            f"{BASE_URL}/api/auth/google/emergent-callback",
            json={"emergent_user": {"email": "attacker@evil.com", "name": "Attacker"}},
        )
        assert r.status_code in (400, 401, 422), f"expected 400/401/422 got {r.status_code}: {r.text[:300]}"
        body = r.text.lower()
        # Should NOT have created a token/user
        assert "token" not in r.json() if r.headers.get("content-type", "").startswith("application/json") else True

    def test_invalid_session_token_rejected(self, client):
        """Fake session_token should fail verification against Emergent."""
        r = client.post(
            f"{BASE_URL}/api/auth/google/emergent-callback",
            json={
                "emergent_user": {"email": "attacker@evil.com", "name": "Attacker"},
                "session_token": "totally-fake-invalid-session-token-12345",
            },
        )
        # Emergent should reject → 401 (or 503 if network error)
        assert r.status_code in (401, 503), f"expected 401/503 got {r.status_code}: {r.text[:300]}"
        if r.status_code == 401:
            data = r.json()
            detail = str(data.get("detail", "")).lower()
            assert "invalid" in detail or "expired" in detail or "session" in detail

    def test_empty_session_token_rejected(self, client):
        r = client.post(
            f"{BASE_URL}/api/auth/google/emergent-callback",
            json={"emergent_user": {"email": "x@y.com"}, "session_token": ""},
        )
        assert r.status_code in (400, 401, 422), f"got {r.status_code}"


# SEC-002: Seed endpoint disabled
class TestSeedEndpointDisabled:
    def test_seed_endpoint_disabled_no_secret(self, client):
        r = client.post(f"{BASE_URL}/api/auth/seed-production-accounts", json={})
        # 422 (Pydantic body validation) or 403 (disabled) — both prove endpoint unusable
        assert r.status_code in (403, 422), f"expected 403/422 got {r.status_code}: {r.text[:300]}"

    def test_seed_endpoint_disabled_with_secret(self, client):
        r = client.post(
            f"{BASE_URL}/api/auth/seed-production-accounts",
            json={"secret_key": "any-secret-attempt"},
        )
        assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text[:300]}"
        detail = str(r.json().get("detail", "")).lower()
        assert "disabled" in detail


# SEC-003: Razorpay routes require auth
class TestRazorpayAuthRequired:
    def test_orders_requires_auth(self, client):
        r = requests.get(f"{BASE_URL}/api/razorpay/orders")
        assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}: {r.text[:300]}"

    def test_refund_requires_auth(self, client):
        r = requests.post(
            f"{BASE_URL}/api/razorpay/refund",
            json={"payment_id": "pay_fake", "amount": 100},
        )
        assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}: {r.text[:300]}"

    def test_stats_requires_auth(self, client):
        r = requests.get(f"{BASE_URL}/api/razorpay/stats")
        assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}: {r.text[:300]}"

    def test_order_status_requires_auth(self, client):
        r = requests.get(f"{BASE_URL}/api/razorpay/order/order_fake")
        assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}"

    def test_payment_status_requires_auth(self, client):
        r = requests.get(f"{BASE_URL}/api/razorpay/payment/pay_fake")
        assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}"

    def test_invalid_token_rejected(self, client):
        r = requests.get(
            f"{BASE_URL}/api/razorpay/orders",
            headers={"Authorization": "Bearer invalid.jwt.token"},
        )
        assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}"


# Regression: existing login still works
class TestExistingLoginWorks:
    def test_customer_login(self, client):
        r = client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "customer@airyatra.co.in", "password": "Customer@123"},
        )
        assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:300]}"
        data = r.json()
        # token could be 'access_token' or 'token'
        token = data.get("access_token") or data.get("token")
        assert token, f"no token in response: {data}"

    def test_customer_can_access_razorpay_orders_with_valid_token(self, client):
        """Positive: valid token should NOT get 401."""
        login = client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "customer@airyatra.co.in", "password": "Customer@123"},
        )
        assert login.status_code == 200
        token = login.json().get("access_token") or login.json().get("token")
        r = requests.get(
            f"{BASE_URL}/api/razorpay/orders",
            headers={"Authorization": f"Bearer {token}"},
        )
        # May be 200 (empty list) or 403 (role restriction) - but not 401
        assert r.status_code != 401, f"valid token got 401: {r.text[:300]}"
