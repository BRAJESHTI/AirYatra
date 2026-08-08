"""Tests for Customer Portal Enhancement: Invoice PDF & Rating endpoints."""
import os
import uuid
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")

CUSTOMER_EMAIL = "customer@airyatra.co.in"
CUSTOMER_PASSWORD = "Customer@123"


@pytest.fixture(scope="module")
def customer_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD}, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"Login failed: {r.status_code} {r.text[:300]}")
    data = r.json()
    token = data.get("access_token") or data.get("token")
    if not token:
        pytest.fail(f"No token in login response: {data}")
    return token


@pytest.fixture(scope="module")
def auth_headers(customer_token):
    return {"Authorization": f"Bearer {customer_token}"}


# ===== Invoice PDF endpoint =====
class TestInvoiceEndpoint:
    def test_invoice_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/customer/bookings/nonexistent-id/invoice", timeout=30)
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}: {r.text[:200]}"

    def test_invoice_invalid_token_rejected(self):
        r = requests.get(
            f"{BASE_URL}/api/customer/bookings/nonexistent-id/invoice",
            headers={"Authorization": "Bearer invalid-token-xxx"}, timeout=30,
        )
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"

    def test_invoice_404_for_nonexistent_booking(self, auth_headers):
        fake_id = f"nonexistent-{uuid.uuid4()}"
        r = requests.get(f"{BASE_URL}/api/customer/bookings/{fake_id}/invoice",
                         headers=auth_headers, timeout=30)
        assert r.status_code == 404, f"Expected 404 for missing booking, got {r.status_code}: {r.text[:200]}"


# ===== Rating endpoints =====
class TestRatingEndpoints:
    def test_get_rating_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/customer/bookings/some-id/rating", timeout=30)
        assert r.status_code in (401, 403)

    def test_get_rating_returns_has_rating_false_for_nonexistent(self, auth_headers):
        fake_id = f"nonexistent-{uuid.uuid4()}"
        r = requests.get(f"{BASE_URL}/api/customer/bookings/{fake_id}/rating",
                         headers=auth_headers, timeout=30)
        # Endpoint doesn't verify booking ownership for GET; returns has_rating:false when no rating exists
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:200]}"
        data = r.json()
        assert data.get("has_rating") is False

    def test_post_rating_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/customer/bookings/some-id/rating?overall_rating=5", timeout=30)
        assert r.status_code in (401, 403)

    def test_post_rating_404_for_nonexistent_booking(self, auth_headers):
        fake_id = f"nonexistent-{uuid.uuid4()}"
        # Endpoint uses query params (not JSON body)
        r = requests.post(
            f"{BASE_URL}/api/customer/bookings/{fake_id}/rating",
            headers=auth_headers,
            params={"overall_rating": 5, "review": "Great flight", "would_recommend": True},
            timeout=30,
        )
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text[:200]}"
