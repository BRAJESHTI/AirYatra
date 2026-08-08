"""
Security fixes verification tests:
SEC-001: Google OAuth requires session_token
SEC-002: Phone OTP does not leak mock_otp
SEC-003: Stripe create-payment-intent requires auth and derives amount from booking
SEC-004: Razorpay create-order requires auth
"""
import os
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")


@pytest.fixture(scope="module")
def customer_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "customer@airyatra.co.in",
        "password": "Customer@123"
    }, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"No token in login response: {data}"
    return token


# SEC-001: Google OAuth
class TestGoogleOAuthSessionToken:
    def test_empty_body_rejected(self):
        # Empty body -> Pydantic 422 (required fields missing) OR 400
        r = requests.post(f"{BASE_URL}/api/auth/google/emergent-callback", json={}, timeout=30)
        assert r.status_code in (400, 422), f"Expected 400/422, got {r.status_code}: {r.text[:300]}"

    def test_empty_session_token_returns_400(self):
        # Provide required emergent_user but empty session_token to hit the explicit guard
        r = requests.post(
            f"{BASE_URL}/api/auth/google/emergent-callback",
            json={"emergent_user": {}, "session_token": ""},
            timeout=30,
        )
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text[:300]}"
        detail = str(r.json().get("detail", "")).lower()
        assert "session token" in detail, f"Unexpected detail: {detail}"

    def test_invalid_session_token_rejected(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/google/emergent-callback",
            json={"emergent_user": {}, "session_token": "invalid_fake_token_xyz_1234567890"},
            timeout=30,
        )
        # Emergent will return 404 -> fallback checks emergent_user -> 401
        assert r.status_code in (401, 400, 503), f"Expected 401/400/503, got {r.status_code}: {r.text[:300]}"


# SEC-002: Phone OTP
class TestPhoneOTPNoLeak:
    def test_send_otp_no_mock_otp_field(self):
        r = requests.post(f"{BASE_URL}/api/auth/phone/send-otp",
                          json={"phone": "+919999999998"}, timeout=30)
        # Accept 200 or 400/429 depending on provider; but if 200, check no mock_otp
        assert r.status_code in (200, 400, 429), f"Unexpected status {r.status_code}: {r.text[:300]}"
        if r.status_code == 200:
            body = r.json()
            assert "mock_otp" not in body, f"mock_otp leaked in response: {body}"
            # mock_mode also should not be true unless dev flag on
            show_flag = os.environ.get("SHOW_MOCK_OTP_IN_RESPONSE", "false").lower() == "true"
            if not show_flag:
                assert not body.get("mock_mode"), f"mock_mode leaked: {body}"


# SEC-003: Stripe
class TestStripeAuth:
    def test_create_payment_intent_without_auth_401(self):
        r = requests.post(f"{BASE_URL}/api/stripe/create-payment-intent",
                          json={"booking_id": "nonexistent_booking"}, timeout=30)
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}: {r.text[:300]}"

    def test_create_payment_intent_auth_nonexistent_booking_404(self, customer_token):
        r = requests.post(
            f"{BASE_URL}/api/stripe/create-payment-intent",
            headers={"Authorization": f"Bearer {customer_token}"},
            json={"booking_id": "definitely_not_a_real_booking_id_9999"},
            timeout=30,
        )
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text[:300]}"


# SEC-004: Razorpay
class TestRazorpayAuth:
    def test_create_order_without_auth_401(self):
        r = requests.post(
            f"{BASE_URL}/api/razorpay/create-order",
            json={
                "booking_id": "test_booking_x",
                "amount": 1000,
                "customer_name": "Test",
                "customer_email": "t@example.com",
                "customer_phone": "+919999999999",
            },
            timeout=30,
        )
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}: {r.text[:300]}"


# Normal login sanity
class TestNormalLogin:
    def test_customer_login_works(self, customer_token):
        assert customer_token and len(customer_token) > 10
