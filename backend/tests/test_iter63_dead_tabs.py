"""Iteration 63 - Dead tab fixes: Finance transactions, HR leave/all, HR leave approve"""
import os
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")


def login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text[:200]}"
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def finance_token():
    return login("finance@airyatra.co.in", "Finance@123")


@pytest.fixture(scope="module")
def hr_token():
    return login("hr@airyatra.co.in", "HR@123456")


@pytest.fixture(scope="module")
def customer_token():
    return login("customer@airyatra.co.in", "Customer@123")


# ============= Finance Razorpay Transactions =============
class TestFinanceTransactions:
    def test_transactions_finance(self, finance_token):
        r = requests.get(f"{BASE_URL}/api/razorpay/transactions",
                         headers={"Authorization": f"Bearer {finance_token}"}, timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        data = r.json()
        assert "transactions" in data and "totals" in data
        assert isinstance(data["transactions"], list)
        assert isinstance(data["totals"], dict)

    def test_transactions_customer_forbidden(self, customer_token):
        r = requests.get(f"{BASE_URL}/api/razorpay/transactions",
                         headers={"Authorization": f"Bearer {customer_token}"}, timeout=30)
        assert r.status_code == 403, f"Expected 403, got {r.status_code}"


# ============= HR Leaves =============
class TestHRLeaves:
    def test_leave_all_hr(self, hr_token):
        r = requests.get(f"{BASE_URL}/api/hr/leave/all",
                         headers={"Authorization": f"Bearer {hr_token}"}, timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        data = r.json()
        assert "leaves" in data and "counts" in data
        assert isinstance(data["leaves"], list)
        assert isinstance(data["counts"], dict)
        for k in ("pending", "approved", "rejected"):
            assert k in data["counts"]

    def test_leave_pending_hr(self, hr_token):
        r = requests.get(f"{BASE_URL}/api/hr/leave/pending",
                         headers={"Authorization": f"Bearer {hr_token}"}, timeout=30)
        assert r.status_code == 200
        assert "pending_leaves" in r.json()

    def test_leave_approve_one(self, hr_token):
        # Get one pending leave and approve it
        r = requests.get(f"{BASE_URL}/api/hr/leave/all?status=pending",
                         headers={"Authorization": f"Bearer {hr_token}"}, timeout=30)
        assert r.status_code == 200
        leaves = r.json().get("leaves", [])
        if not leaves:
            pytest.skip("No pending leaves to approve")
        leave_id = leaves[0]["id"]
        r2 = requests.put(f"{BASE_URL}/api/hr/leave/{leave_id}/approve",
                          headers={"Authorization": f"Bearer {hr_token}"}, timeout=30)
        assert r2.status_code == 200, f"{r2.status_code} {r2.text[:300]}"
        # Verify status changed
        r3 = requests.get(f"{BASE_URL}/api/hr/leave/all",
                          headers={"Authorization": f"Bearer {hr_token}"}, timeout=30)
        found = next((l for l in r3.json().get("leaves", []) if l.get("id") == leave_id), None)
        assert found is not None
        assert found["status"] == "approved", f"Status was {found['status']}"
