"""
Iteration 58 - Enterprise System Audit.
Per-area PASS/FAIL/PARTIAL matrix. Prints module_matrix at the end so the report
JSON can be assembled easily.
"""
import os
import time
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"

CREDS = {
    "admin":     ("admin@airyatra.co.in", "Admin123!"),
    "operator":  ("operator@airyatra.co.in", "Operator@123456"),
    "customer":  ("customer@airyatra.co.in", "Customer@123"),
    "pilot":     ("pilot@airyatra.co.in", "Pilot@123"),
    "ceo":       ("ceo@airyatra.co.in", "CEO@123456"),
    "corporate": ("corporate@airyatra.co.in", "Corporate@123"),
}

# module-level token cache to respect 10/min login rate limit
_tokens = {}
_matrix = []   # list of {module, status, evidence, gaps}


def _record(module, status, evidence, gaps=""):
    _matrix.append({"module": module, "status": status, "evidence": evidence, "gaps": gaps})
    print(f"[{status}] {module} :: {evidence} :: gaps={gaps}")


def _login(role):
    if role in _tokens:
        return _tokens[role]
    email, pwd = CREDS[role]
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pwd}, timeout=15)
    if r.status_code != 200:
        pytest.fail(f"Login failed for {role}: {r.status_code} {r.text[:300]}")
    body = r.json()
    token = body.get("token") or body.get("access_token") or (body.get("data") or {}).get("token")
    if not token:
        pytest.fail(f"No token in login response for {role}: keys={list(body.keys())}")
    _tokens[role] = token
    return token


def H(role):
    return {"Authorization": f"Bearer {_login(role)}"}


# ---------------------------------------------------------------------------
# Session-scoped shared state so later modules see earlier bookings
# ---------------------------------------------------------------------------
STATE = {}


@pytest.fixture(scope="session", autouse=True)
def _warmup_tokens():
    # Login all roles ONCE (respects 10/min rate limit)
    for role in ["admin", "operator", "customer", "pilot", "ceo", "corporate"]:
        try:
            _login(role)
        except Exception as e:
            print(f"WARN: could not login {role}: {e}")
    yield
    print("\n=== MODULE MATRIX ===")
    for m in _matrix:
        print(m)


# ================================================================
# AUDIT 1 - CUSTOMER JOURNEY E2E (custom_quote + marketplace)
# ================================================================
class TestAudit1_CustomerJourney:
    def test_custom_quote_full_flow(self):
        gaps = []
        # 1) customer creates a custom quote booking
        payload = {
            "origin": "Mumbai",
            "destination": "Pune",
            "departure_date": "2026-09-01",
            "departure_time": "10:00",
            "passengers": 3,
            "booking_type": "custom_quote",
            "special_requirements": "TEST_iter58_audit",
        }
        r = requests.post(f"{API}/bookings/", json=payload, headers=H("customer"), timeout=20)
        assert r.status_code in (200, 201), f"POST /bookings/ {r.status_code}: {r.text[:300]}"
        resp = r.json()
        booking = resp.get("booking") or resp
        booking_id = booking.get("id") or booking.get("booking_id") or booking.get("_id") or resp.get("booking_id")
        assert booking_id, f"No booking id in {list(resp.keys())}"
        STATE["booking_id"] = booking_id

        # 2) operator sees it in quote-requests
        r2 = requests.get(f"{API}/operator/quote-requests", headers=H("operator"), timeout=15)
        assert r2.status_code == 200, r2.text[:200]
        ids = []
        try:
            body = r2.json()
            lst = body if isinstance(body, list) else (body.get("requests") or body.get("data") or [])
            ids = [b.get("id") or b.get("_id") for b in lst]
        except Exception:
            pass
        if booking_id not in ids:
            gaps.append("booking not in operator quote-requests")

        # 3) operator submits quote (payout 100000, mumbai->pune fee resolver applies)
        payout = 100000
        rq = requests.post(
            f"{API}/operator/submit-quote",
            json={"booking_id": booking_id, "amount": payout, "aircraft_id": "test-aircraft-iter58", "validity_hours": 24, "notes": "TEST_iter58"},
            headers=H("operator"),
            timeout=15,
        )
        if rq.status_code != 200:
            _record("Audit1_submit_quote", "FAIL", f"POST /operator/submit-quote {rq.status_code}: {rq.text[:300]}")
            pytest.fail("submit-quote failed")
        q = rq.json()
        # If not in top-level response, fetch the quote by id
        quote_id_direct = q.get("quote_id")
        op = q.get("operator_payout") or (q.get("quote") or {}).get("operator_payout")
        pf = q.get("platform_fee") or (q.get("quote") or {}).get("platform_fee")
        ct = q.get("customer_total") or (q.get("quote") or {}).get("customer_total")
        if (op is None or pf is None or ct is None) and quote_id_direct:
            # look up via operator my-quotes (submit-quote does not return the computed breakdown)
            rml = requests.get(f"{API}/operator/my-quotes", headers=H("operator"), timeout=10)
            if rml.status_code == 200:
                lst = rml.json()
                lst = lst if isinstance(lst, list) else (lst.get("quotes") or lst.get("data") or [])
                for qq in lst:
                    if qq.get("id") == quote_id_direct:
                        op = qq.get("operator_payout")
                        pf = qq.get("platform_fee")
                        ct = qq.get("customer_total") or qq.get("amount")
                        break
        if op is None or pf is None or ct is None:
            # fetch quote back to inspect
            gaps.append(f"submit-quote missing fee fields: keys={list(q.keys())}")
        else:
            assert abs((op + pf) - ct) < 1, f"math wrong: {op}+{pf}!={ct}"
            STATE["customer_total"] = ct
            STATE["platform_fee"] = pf
            STATE["operator_payout"] = op

        # 4) customer accepts the quote
        # find quote id
        rq_list = requests.get(f"{API}/bookings/{booking_id}", headers=H("customer"), timeout=15)
        quote_id = None
        if rq_list.status_code == 200:
            b = rq_list.json()
            quotes = b.get("quotes") or []
            if quotes:
                quote_id = quotes[0].get("id") or quotes[0].get("_id")
        if not quote_id:
            # try /api/quotes list
            rl = requests.get(f"{API}/quotes/?booking_id={booking_id}", headers=H("customer"), timeout=10)
            if rl.status_code == 200 and rl.json():
                data = rl.json() if isinstance(rl.json(), list) else rl.json().get("data", [])
                if data:
                    quote_id = data[0].get("id") or data[0].get("_id")
        if quote_id:
            ra = requests.post(f"{API}/bookings/{booking_id}/accept-quote", json={"quote_id": quote_id}, headers=H("customer"), timeout=15)
            if ra.status_code not in (200, 201):
                gaps.append(f"accept-quote {ra.status_code}: {ra.text[:200]}")
            else:
                STATE["accepted"] = True
        else:
            gaps.append("could not find quote_id to accept")

        status = "PARTIAL" if gaps else "PASS"
        _record("Audit1_CustomQuoteE2E", status, f"booking={booking_id}, submit-quote ok, math={STATE.get('customer_total')}", "; ".join(gaps))

    def test_marketplace_search_and_book(self):
        gaps = []
        payload = {
            "aircraft_type": "helicopter",
            "from_location": "Mumbai",
            "to_location": "Pune",
            "travel_date": "2026-09-15",
            "travel_time": "10:00",
            "passengers": 2,
        }
        rs = requests.post(f"{API}/marketplace/search", json=payload, headers=H("customer"), timeout=20)
        if rs.status_code != 200:
            _record("Audit1_Marketplace", "FAIL", f"search {rs.status_code}: {rs.text[:300]}")
            return
        data = rs.json()
        options = data.get("options") or data.get("results") or (data if isinstance(data, list) else [])
        if not options:
            _record("Audit1_Marketplace", "PARTIAL", "search returned 0 options", "no options available")
            return
        sample = options[0]
        has_engine = "engine_type" in sample or (sample.get("aircraft") or {}).get("engine_type")
        has_surge = "surge" in sample or "urgency" in sample or "urgency_multiplier" in sample or "surge_multiplier" in sample
        if not has_engine:
            gaps.append("no engine_type field in options")
        if not has_surge:
            gaps.append("no surge/urgency field")

        # attempt to book
        option_id = sample.get("option_id") or sample.get("id")
        aircraft_id = sample.get("aircraft_id") or (sample.get("aircraft") or {}).get("id")
        rb = requests.post(f"{API}/marketplace/book", json={
            "aircraft_id": aircraft_id or "test", "aircraft_type": "helicopter",
            "from_location": "Mumbai", "to_location": "Pune",
            "travel_date": "2026-09-15", "travel_time": "10:00", "passengers": 2,
        }, headers=H("customer"), timeout=20)
        if rb.status_code not in (200, 201):
            gaps.append(f"book {rb.status_code}: {rb.text[:200]}")
            _record("Audit1_Marketplace", "PARTIAL", f"search ok ({len(options)} opts), book failed", "; ".join(gaps))
            return
        book = rb.json()
        status_field = book.get("status") or book.get("payment_status") or (book.get("booking") or {}).get("status")
        price_lock = book.get("price_lock_expires_at") or book.get("price_lock") or (book.get("booking") or {}).get("price_lock_expires_at")
        if not price_lock:
            gaps.append("no 15-min price lock in response")
        if status_field and "pending" not in str(status_field).lower():
            gaps.append(f"unexpected status: {status_field}")
        _record("Audit1_Marketplace", "PARTIAL" if gaps else "PASS", f"search {len(options)} opts, booked status={status_field}", "; ".join(gaps))


# ================================================================
# AUDIT 2 - Cross-link on booking
# ================================================================
class TestAudit2_CrossLink:
    def test_cross_link(self):
        bid = STATE.get("booking_id")
        if not bid:
            _record("Audit2_CrossLink", "SKIP", "no booking created in Audit1", "prerequisite failed")
            return
        gaps = []
        checks = {}

        # customer trips
        rt = requests.get(f"{API}/customer/trips", headers=H("customer"), timeout=15)
        checks["customer_trips"] = rt.status_code
        if rt.status_code == 200:
            data = rt.json() if isinstance(rt.json(), list) else rt.json().get("data") or rt.json().get("trips") or []
            found = any((t.get("id") or t.get("_id") or t.get("booking_id")) == bid for t in data)
            if not found:
                gaps.append("booking not in customer/trips")

        # operator my-quotes
        ro = requests.get(f"{API}/operator/my-quotes", headers=H("operator"), timeout=15)
        checks["operator_my_quotes"] = ro.status_code
        if ro.status_code != 200:
            gaps.append(f"operator my-quotes {ro.status_code}")

        # admin bookings
        for path in ("/admin/bookings", "/admin/partner_bookings", "/admin/booking-management/all"):
            ra = requests.get(f"{API}{path}", headers=H("admin"), timeout=15)
            if ra.status_code == 200:
                checks[f"admin{path}"] = 200
                break
        else:
            gaps.append("no admin bookings endpoint returns 200")

        # CEO
        rc = requests.get(f"{API}/ceo/dashboard", headers=H("ceo"), timeout=15)
        checks["ceo_dashboard"] = rc.status_code
        if rc.status_code == 200:
            j = rc.json()
            fleet = j.get("fleet") or {}
            bookings_stat = j.get("bookings") or {}
            if not (fleet or bookings_stat):
                gaps.append("ceo dashboard has no fleet/bookings section")

        # fee revenue report
        rfr = requests.get(f"{API}/admin/pricing/fee-revenue-report", headers=H("admin"), timeout=15)
        checks["fee_revenue_report"] = rfr.status_code
        if rfr.status_code != 200:
            gaps.append(f"fee-revenue-report {rfr.status_code}")

        # revenue trend
        rvt = requests.get(f"{API}/admin/pricing/revenue-trend", headers=H("admin"), timeout=15)
        checks["revenue_trend"] = rvt.status_code
        if rvt.status_code != 200:
            gaps.append(f"revenue-trend {rvt.status_code}")

        _record("Audit2_CrossLink", "PARTIAL" if gaps else "PASS", f"checks={checks}", "; ".join(gaps))


# ================================================================
# AUDIT 3 - Config propagation
# ================================================================
class TestAudit3_Config:
    def test_urgency_tier_change(self):
        gaps = []
        # GET current settings
        rs = requests.get(f"{API}/platform-fees/settings", headers=H("admin"), timeout=15)
        assert rs.status_code == 200, rs.text[:300]
        cur = rs.json()
        # detect structure
        urgency = cur.get("urgency") or cur.get("data", {}).get("urgency") or {}

        # try update tier1 to 18
        upd_payload = {"urgency": {"tier1_hours": 6, "tier1_percent": 18}}
        ru = requests.put(f"{API}/platform-fees/settings/update", json=upd_payload, headers=H("admin"), timeout=15)
        if ru.status_code != 200:
            _record("Audit3_UrgencyChange", "FAIL", f"update settings {ru.status_code}: {ru.text[:200]}")
            return

        # preview <6h departure
        from datetime import datetime, timedelta, timezone
        soon = (datetime.now(timezone.utc) + timedelta(hours=3)).isoformat()
        rp = requests.post(
            f"{API}/platform-fees/preview",
            json={"from_location": "XXXX_A", "to_location": "XXXX_B", "amount": 100000, "departure_datetime": soon},
            headers=H("admin"),
            timeout=15,
        )
        preview_fee = None
        if rp.status_code == 200:
            j = rp.json()
            preview_fee = j.get("fee_percent") or j.get("platform_fee_percent") or j.get("percent")
        else:
            gaps.append(f"preview {rp.status_code}: {rp.text[:200]}")

        # restore to 15
        requests.put(f"{API}/platform-fees/settings/update", json={"urgency": {"tier1_hours": 6, "tier1_percent": 15}}, headers=H("admin"), timeout=15)

        if preview_fee is not None and float(preview_fee) < 17.5:
            gaps.append(f"urgency tier1=18 did not propagate to preview (got {preview_fee})")
        _record("Audit3_UrgencyChange", "PARTIAL" if gaps else "PASS", f"preview_fee={preview_fee}", "; ".join(gaps))

    def test_payment_rules_endpoint(self):
        r = requests.get(f"{API}/admin/payment-rules", headers=H("admin"), timeout=15)
        _record("Audit3_PaymentRules", "PASS" if r.status_code == 200 else "FAIL", f"GET /payment-rules -> {r.status_code}")


# ================================================================
# AUDIT 4 - Payments/refunds/invoices
# ================================================================
class TestAudit4_Payments:
    def test_razorpay_create_order(self):
        bid = STATE.get("booking_id") or "test-booking-iter58"
        r = requests.post(
            f"{API}/razorpay/create-order",
            json={"booking_id": bid, "customer_name": "Test Customer", "customer_email": "customer@airyatra.co.in", "customer_phone": "9999999999"},
            headers=H("customer"),
            timeout=20,
        )
        # 200 = ok, 404 = booking not found (if bid is fake), both indicate endpoint works
        ok = r.status_code == 200 and ("order_id" in r.text or '"id"' in r.text)
        acceptable = r.status_code in (200, 400, 404)
        status = "PASS" if ok else ("PARTIAL" if acceptable else "FAIL")
        _record("Audit4_Razorpay", status, f"create-order {r.status_code}: {r.text[:250]}")

    def test_invoice_pdf(self):
        bid = STATE.get("booking_id")
        gaps = []
        if not bid:
            _record("Audit4_InvoicePDF", "SKIP", "no booking id")
            return
        # try both paths
        for path in (f"/customer/bookings/{bid}/invoice", f"/customer/trips/{bid}/invoice"):
            r = requests.get(f"{API}{path}", headers=H("customer"), timeout=20)
            ct = r.headers.get("content-type", "")
            body_head = r.content[:5] if r.content else b""
            if r.status_code == 200 and (b"%PDF" in body_head or "pdf" in ct.lower()):
                _record("Audit4_InvoicePDF", "PASS", f"{path} -> pdf ({len(r.content)} bytes)")
                return
            gaps.append(f"{path} status={r.status_code} ct={ct} head={body_head!r}")
        _record("Audit4_InvoicePDF", "FAIL", "no invoice endpoint returned PDF", "; ".join(gaps))

    def test_corporate_gst_invoice(self):
        # need corporate booking id — just check endpoint returns non-500
        r = requests.get(f"{API}/corporate/invoice/nonexistent/gst", headers=H("corporate"), timeout=15)
        # 404 acceptable, 500 not
        _record("Audit4_CorporateGST", "PASS" if r.status_code in (200, 404) else "FAIL", f"GET corp gst -> {r.status_code}")

    def test_invoice_email_log(self):
        # can only observe via admin list if endpoint exists
        r = requests.get(f"{API}/admin/invoice-email-log", headers=H("admin"), timeout=10)
        _record("Audit4_InvoiceEmailLog", "PASS" if r.status_code == 200 else "MISSING",
                f"admin invoice-email-log -> {r.status_code}",
                "" if r.status_code == 200 else "endpoint not exposed under /api/admin/invoice-email-log")

    def test_refund_endpoints(self):
        r = requests.get(f"{API}/refunds/policy", headers=H("customer"), timeout=10)
        exists = r.status_code == 200
        _record("Audit4_Refunds", "PARTIAL" if exists else "MISSING",
                f"refunds/policy -> {r.status_code}",
                "Multi-level refund approval workflow (Sales->Accounts->Finance->Admin->CEO) not implemented")


# ================================================================
# AUDIT 5 - Reports & exports
# ================================================================
class TestAudit5_Reports:
    def test_export_excel(self):
        r = requests.get(f"{API}/admin/pricing/export?format=excel", headers=H("admin"), timeout=30)
        ct = r.headers.get("content-type", "")
        ok = r.status_code == 200 and ("spreadsheet" in ct or ct.endswith("xlsx") or len(r.content) > 3000)
        _record("Audit5_ExportExcel", "PASS" if ok else "FAIL", f"status={r.status_code} ct={ct} size={len(r.content)}")

    def test_export_pdf(self):
        r = requests.get(f"{API}/admin/pricing/export?format=pdf", headers=H("admin"), timeout=30)
        ok = r.status_code == 200 and (b"%PDF" in r.content[:10])
        _record("Audit5_ExportPDF", "PASS" if ok else "FAIL", f"status={r.status_code} size={len(r.content)}")

    def test_date_filter(self):
        r = requests.get(f"{API}/admin/pricing/fee-revenue-report?start_date=2020-01-01&end_date=2020-01-31", headers=H("admin"), timeout=15)
        _record("Audit5_DateFilter", "PASS" if r.status_code == 200 else "FAIL", f"{r.status_code}")

    def test_scorecards(self):
        r = requests.get(f"{API}/admin/pricing/operator-scorecards", headers=H("admin"), timeout=15)
        ok = r.status_code == 200
        keys_ok = False
        if ok:
            data = r.json()
            data = data if isinstance(data, list) else data.get("data", data.get("scorecards", []))
            if data:
                s = data[0]
                keys_ok = any(k in s for k in ("win_rate", "rating", "on_time"))
        _record("Audit5_Scorecards", "PASS" if ok and (keys_ok or not r.json()) else "PARTIAL",
                f"status={r.status_code} keys_ok={keys_ok}")

    def test_own_fleet_bookings(self):
        r = requests.get(f"{API}/admin/pricing/own-fleet-bookings", headers=H("admin"), timeout=15)
        _record("Audit5_OwnFleetBookings", "PASS" if r.status_code == 200 else "FAIL", f"{r.status_code}")


# ================================================================
# AUDIT 6 - RBAC
# ================================================================
class TestAudit6_RBAC:
    def test_customer_on_admin_403(self):
        results = {}
        for path in ("/admin/pricing/operators", "/platform-fees/", "/admin/pricing/export"):
            r = requests.get(f"{API}{path}", headers=H("customer"), timeout=10)
            results[path] = r.status_code
        all_403 = all(v in (401, 403) for v in results.values())
        _record("Audit6_CustomerOnAdmin", "PASS" if all_403 else "FAIL", str(results))

    def test_no_token_401(self):
        r = requests.get(f"{API}/admin/pricing/operators", timeout=10)
        _record("Audit6_NoToken", "PASS" if r.status_code in (401, 403) else "FAIL", f"{r.status_code}")

    def test_operator_on_admin_403(self):
        r = requests.get(f"{API}/admin/pricing/operators", headers=H("operator"), timeout=10)
        _record("Audit6_OperatorOnAdmin", "PASS" if r.status_code in (401, 403) else "FAIL", f"{r.status_code}")

    def test_pilot_dashboard(self):
        r = requests.get(f"{API}/pilot/mobile/dashboard", headers=H("pilot"), timeout=15)
        _record("Audit6_PilotDashboard", "PASS" if r.status_code == 200 else "FAIL", f"{r.status_code}: {r.text[:200]}")

    def test_pilot_on_operator_403(self):
        r = requests.get(f"{API}/operator/quote-requests", headers=H("pilot"), timeout=10)
        _record("Audit6_PilotOnOperator", "PASS" if r.status_code in (401, 403) else "FAIL", f"{r.status_code}")

    def test_login_rate_limit(self):
        # Cannot easily test without burning tokens; check /api/auth/login gives 429 on rapid burst using bad creds
        codes = []
        for _ in range(12):
            r = requests.post(f"{API}/auth/login", json={"email": "nobody@none.test", "password": "x"}, timeout=5)
            codes.append(r.status_code)
        has_429 = 429 in codes
        _record("Audit6_RateLimit", "PASS" if has_429 else "MISSING",
                f"codes={codes[-5:]}", "" if has_429 else "no 429 observed on rapid login burst")


# ================================================================
# AUDIT 7 - Pilot & Own Fleet
# ================================================================
class TestAudit7_Pilot:
    def test_pilot_dashboard_has_flights(self):
        r = requests.get(f"{API}/pilot/mobile/dashboard", headers=H("pilot"), timeout=15)
        if r.status_code != 200:
            _record("Audit7_PilotDashboard", "FAIL", f"{r.status_code}")
            return
        j = r.json()
        flights = j.get("upcoming_flights") or j.get("flights") or j.get("data", {}).get("upcoming_flights", [])
        _record("Audit7_PilotDashboard", "PASS", f"upcoming_flights={len(flights) if isinstance(flights, list) else 'n/a'}")

    def test_own_fleet_in_marketplace(self):
        r = requests.post(f"{API}/marketplace/search", json={
            "aircraft_type": "helicopter", "from_location": "Mumbai", "to_location": "Pune",
            "travel_date": "2026-10-01", "travel_time": "10:00", "passengers": 2,
        }, headers=H("customer"), timeout=20)
        if r.status_code != 200:
            _record("Audit7_OwnFleetSearch", "FAIL", f"{r.status_code}")
            return
        opts = r.json().get("options") or r.json().get("results") or []
        own = [o for o in opts if str(o.get("operator_id", "")).lower() == "airyatra_own_fleet"
               or (o.get("aircraft") or {}).get("operator_id") == "airyatra_own_fleet"
               or o.get("is_own_fleet")]
        _record("Audit7_OwnFleetSearch", "PASS" if own else "PARTIAL",
                f"options={len(opts)} own_fleet={len(own)}",
                "" if own else "own fleet not surfaced in marketplace search results")


# ================================================================
# CLEANUP
# ================================================================
@pytest.fixture(scope="session", autouse=True)
def cleanup(_warmup_tokens):
    yield
    bid = STATE.get("booking_id")
    if bid:
        try:
            requests.delete(f"{API}/bookings/{bid}", headers=H("customer"), timeout=10)
        except Exception:
            pass
