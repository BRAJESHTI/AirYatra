"""Backend tests for Finance ERP Phase 5 endpoints."""
import os
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL is missing")
BASE_URL = base_url.rstrip("/") + "/api/finance/phase5"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---- Audit Trail ----
class TestAudit:
    def test_create_audit_log(self, client):
        r = client.post(f"{BASE_URL}/audit/log", json={
            "action": "create",
            "module": "test",
            "entity_type": "test_entity",
            "entity_id": "TEST_ent_1",
            "description": "TEST_ audit log seed",
            "user_email": "TEST_qa@example.com"
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True
        assert "log_id" in data

    def test_get_audit_logs(self, client):
        r = client.get(f"{BASE_URL}/audit/logs?limit=10")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "logs" in data and isinstance(data["logs"], list)
        assert "total" in data
        assert "filters" in data
        assert set(["modules", "actions", "entity_types"]).issubset(data["filters"].keys())
        # ensure no _id leaking as ObjectId
        for log in data["logs"]:
            assert isinstance(log.get("_id", ""), str)

    def test_get_audit_logs_with_filter(self, client):
        r = client.get(f"{BASE_URL}/audit/logs?module=test&action=create&limit=5")
        assert r.status_code == 200, r.text
        data = r.json()
        for l in data["logs"]:
            assert l["module"] == "test"
            assert l["action"] == "create"

    def test_get_audit_stats(self, client):
        r = client.get(f"{BASE_URL}/audit/stats")
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ["total_logs", "today_count", "by_module", "by_action", "recent_users"]:
            assert k in data
        assert isinstance(data["total_logs"], int)
        assert isinstance(data["by_module"], dict)


# ---- PDF Invoice ----
class TestInvoice:
    def test_generate_pdf_invoice(self, client):
        payload = {
            "customer_name": "TEST_ Customer",
            "customer_address": "123 Test St\nMumbai",
            "customer_gst": "27AAAAA0000A1Z5",
            "items": [
                {"description": "Charter Flight", "hsn_code": "996311", "quantity": 1, "rate": 100000, "amount": 100000}
            ],
            "subtotal": 100000,
            "gst_rate": 18.0,
            "gst_amount": 18000,
            "total": 118000,
            "notes": "TEST_ invoice"
        }
        r = client.post(f"{BASE_URL}/invoice/generate", json=payload)
        assert r.status_code == 200, r.text[:500]
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:4] == b"%PDF"
        assert len(r.content) > 500

    def test_invoice_missing_required_field(self, client):
        r = client.post(f"{BASE_URL}/invoice/generate", json={"customer_name": "X"})
        assert r.status_code == 422


# ---- Expense Analytics ----
class TestAnalytics:
    @pytest.mark.parametrize("period", ["day", "week", "month", "quarter", "year"])
    def test_expense_analytics_periods(self, client, period):
        r = client.get(f"{BASE_URL}/analytics/expenses?period={period}")
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ["total_expense", "average_monthly", "expense_by_period",
                  "expense_by_category", "top_categories", "category_trend",
                  "growth_trend", "period"]:
            assert k in data, f"missing {k}"
        assert data["period"] == period
        assert isinstance(data["top_categories"], list)
        assert isinstance(data["expense_by_period"], dict)


# ---- Currency ----
class TestCurrency:
    def test_get_rates(self, client):
        r = client.get(f"{BASE_URL}/currency/rates")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["base"] == "INR"
        assert "rates" in data
        for cur in ["USD", "EUR", "GBP", "INR"]:
            assert cur in data["rates"]
        assert data["rates"]["INR"] == 1.0
        assert isinstance(data["rates"]["USD"], (int, float))

    def test_convert_usd_to_inr(self, client):
        r = client.post(f"{BASE_URL}/currency/convert", json={
            "from_currency": "USD", "to_currency": "INR", "amount": 100
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["from_currency"] == "USD"
        assert data["to_currency"] == "INR"
        assert data["original_amount"] == 100
        assert data["converted_amount"] > 0
        # Sanity: 100 USD -> should be > 5000 INR
        assert data["converted_amount"] > 5000

    def test_convert_inr_to_usd(self, client):
        r = client.post(f"{BASE_URL}/currency/convert", json={
            "from_currency": "INR", "to_currency": "USD", "amount": 8350
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert 50 < data["converted_amount"] < 200  # ~100 USD

    def test_convert_cross_currency(self, client):
        r = client.post(f"{BASE_URL}/currency/convert", json={
            "from_currency": "USD", "to_currency": "EUR", "amount": 100
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["converted_amount"] > 0

    def test_forex_vendor_payment(self, client):
        # Endpoint uses query params (function args, no Body model)
        r = client.post(
            f"{BASE_URL}/currency/vendor-payment",
            params={
                "vendor_name": "TEST_ Vendor Inc",
                "amount_foreign": 1000,
                "currency": "USD",
                "description": "TEST_ forex payment"
            }
        )
        assert r.status_code == 200, r.text[:500]
        data = r.json()
        assert data["success"] is True
        assert "payment" in data
        p = data["payment"]
        assert p["vendor_name"] == "TEST_ Vendor Inc"
        assert p["original_currency"] == "USD"
        assert p["original_amount"] == 1000
        assert p["inr_amount"] > 0
        assert "conversion" in data

    def test_forex_payments_list(self, client):
        r = client.get(f"{BASE_URL}/currency/payments")
        assert r.status_code == 200
        data = r.json()
        assert "payments" in data and isinstance(data["payments"], list)
        assert "total_inr" in data
        assert "by_currency" in data
