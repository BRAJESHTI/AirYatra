"""Tests for seeded customer bookings + invoice PDF + rating APIs."""
import os
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")

CUSTOMER_EMAIL = "customer@airyatra.com"
CUSTOMER_PASSWORD = "Customer@123"

SEEDED_BOOKING_NUMBERS = {"AY-2026-DEMO-001", "AY-2026-DEMO-002", "AY-2026-DEMO-003"}


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD})
    if r.status_code != 200:
        pytest.fail(f"login failed {r.status_code}: {r.text[:300]}")
    tok = r.json().get("access_token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def trips_data(headers):
    r = requests.get(f"{BASE_URL}/api/customer/trips", headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


# ---- Trips listing / seed verification ----
class TestTripsListing:
    def test_trips_contains_seeded_bookings(self, trips_data):
        trips = trips_data["trips"]
        booking_nums = {t.get("booking_number") for t in trips if t.get("booking_number")}
        missing = SEEDED_BOOKING_NUMBERS - booking_nums
        assert not missing, f"Missing seeded bookings: {missing}. Found: {booking_nums}"

    def test_statistics_total_and_completed(self, trips_data):
        stats = trips_data["statistics"]
        assert stats["total_trips"] >= 3, stats
        assert stats["completed_count"] >= 2, stats

    def test_completed_bookings_exist(self, trips_data):
        completed = [t for t in trips_data["trips"] if t.get("status") == "completed"]
        assert len(completed) >= 2


# ---- Invoice PDF ----
class TestInvoicePDF:
    def _get_booking(self, trips_data, booking_number):
        for t in trips_data["trips"]:
            if t.get("booking_number") == booking_number:
                return t
        pytest.fail(f"booking {booking_number} not found")

    @pytest.mark.parametrize("booking_number", list(SEEDED_BOOKING_NUMBERS))
    def test_invoice_pdf_download(self, trips_data, headers, booking_number):
        booking = self._get_booking(trips_data, booking_number)
        r = requests.get(f"{BASE_URL}/api/customer/bookings/{booking['id']}/invoice",
                         headers=headers)
        assert r.status_code == 200, f"{booking_number}: {r.status_code} {r.text[:200]}"
        assert r.headers.get("content-type") == "application/pdf", r.headers
        assert r.content[:4] == b"%PDF", "not a PDF file"
        assert len(r.content) > 1000
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd and ".pdf" in cd

    def test_invoice_requires_auth(self, trips_data):
        booking = trips_data["trips"][0]
        r = requests.get(f"{BASE_URL}/api/customer/bookings/{booking['id']}/invoice")
        assert r.status_code in (401, 403)

    def test_invoice_404_for_unknown_booking(self, headers):
        r = requests.get(f"{BASE_URL}/api/customer/bookings/nonexistent-xyz/invoice",
                         headers=headers)
        assert r.status_code == 404


# ---- Rating API ----
class TestRatingAPI:
    def _completed_booking(self, trips_data):
        for t in trips_data["trips"]:
            if t.get("status") == "completed":
                return t
        pytest.fail("no completed booking to rate")

    def test_get_rating_initially_empty(self, trips_data, headers):
        booking = self._completed_booking(trips_data)
        r = requests.get(f"{BASE_URL}/api/customer/bookings/{booking['id']}/rating",
                         headers=headers)
        assert r.status_code == 200
        # may already be rated by previous test run; either state is OK, just structure check
        body = r.json()
        assert "has_rating" in body

    def test_submit_rating(self, trips_data, headers):
        booking = self._completed_booking(trips_data)
        # Endpoint uses query params (documented in prior iteration)
        params = {"overall_rating": 5, "review": "Excellent flight - test", "would_recommend": True}
        r = requests.post(
            f"{BASE_URL}/api/customer/bookings/{booking['id']}/rating",
            headers=headers, params=params
        )
        # 200 first time, 400 if already rated
        assert r.status_code in (200, 400), r.text[:300]
        if r.status_code == 200:
            data = r.json()
            assert data.get("success") is True
            assert "rating_id" in data
            assert data.get("points_earned") in (25, 50)
        else:
            assert "already rated" in r.text.lower()

    def test_rating_missing_booking(self, headers):
        r = requests.post(f"{BASE_URL}/api/customer/bookings/nonexistent-xyz/rating",
                          headers=headers, params={"overall_rating": 5})
        assert r.status_code == 404

    def test_rating_requires_auth(self, trips_data):
        booking = self._completed_booking(trips_data)
        r = requests.post(f"{BASE_URL}/api/customer/bookings/{booking['id']}/rating",
                         params={"overall_rating": 4})
        assert r.status_code in (401, 403)
