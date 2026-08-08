"""
Iteration 51 — code-review fix verification.
Covers:
  FIX 1 (MEDIUM): scheduler.send_boarding_reminders correctly counts checked items
  FIX 2 (LOW):    wallet atomic conditional debit + 409/400/403 branches
  FIX 3 (LOW):    preflight owner fallback (customer_id OR user_id) in all 3 guards

Notes:
- Backend URL comes from REACT_APP_BACKEND_URL.
- Login rate-limit is 5/min. All logins run once (session-scoped) up front → 4 logins total.
- Scheduler test runs in-process (imports scheduler + connects Mongo directly).
- All seeded/mutated data is restored in teardown.
"""
import os
import sys
import asyncio
import time
from pathlib import Path
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, AsyncMock

import pytest
import requests
from dotenv import dotenv_values

# ---- make backend importable
sys.path.insert(0, "/app/backend")

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL", "")).rstrip("/")
if not BASE_URL:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")

CUSTOMER = {"email": "customer@airyatra.co.in", "password": "Customer@123"}
LOYALTY  = {"email": "loyaltytest@airyatra.co.in", "password": "Loyalty@123"}
OPERATOR = {"email": "operator@airyatra.co.in", "password": "Operator@123456"}
ADMIN    = {"email": "admin@airyatra.co.in", "password": "Admin123!"}

TEST_BOOKING_ID = "paytest-inquiry-001"


# ---------- session-scoped fixtures ----------

@pytest.fixture(scope="session")
def tokens():
    """Log in all users ONCE (respect 5/min rate limit)."""
    out = {}
    for label, creds in [("customer", CUSTOMER), ("loyalty", LOYALTY),
                         ("operator", OPERATOR), ("admin", ADMIN)]:
        r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
        if r.status_code != 200:
            pytest.fail(f"Login {label} failed {r.status_code}: {r.text[:250]}")
        j = r.json()
        tok = j.get("access_token") or j.get("token") or (j.get("data") or {}).get("access_token")
        uid = (j.get("user") or {}).get("id") or j.get("user_id") or (j.get("data") or {}).get("user", {}).get("id")
        if not tok:
            pytest.fail(f"No token in login response for {label}: {j}")
        out[label] = {"token": tok, "user_id": uid, "email": creds["email"]}
    return out


def _auth(tok):
    return {"Authorization": f"Bearer {tok}"}


# ==================================================================
# FIX 3 — Preflight owner fallback + auth guards
# ==================================================================

class TestPreflightOwnerFallback:

    def test_get_checklist_401_without_token(self):
        r = requests.get(f"{BASE_URL}/api/preflight/checklist/{TEST_BOOKING_ID}",
                         params={"checklist_type": "passenger"}, timeout=20)
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}: {r.text[:200]}"

    def test_get_checklist_owner_ok(self, tokens):
        r = requests.get(f"{BASE_URL}/api/preflight/checklist/{TEST_BOOKING_ID}",
                         params={"checklist_type": "passenger"},
                         headers=_auth(tokens["customer"]["token"]), timeout=20)
        assert r.status_code == 200, f"owner should read: {r.status_code} {r.text[:250]}"
        data = r.json()
        assert data.get("success") is True
        assert data.get("booking_id") == TEST_BOOKING_ID
        assert isinstance(data.get("items"), list) and len(data["items"]) == 12
        # items carry template ids p1..p12
        ids = {i["id"] for i in data["items"]}
        assert {"p1", "p2", "p12"}.issubset(ids)

    def test_get_checklist_403_other_customer(self, tokens):
        r = requests.get(f"{BASE_URL}/api/preflight/checklist/{TEST_BOOKING_ID}",
                         params={"checklist_type": "passenger"},
                         headers=_auth(tokens["loyalty"]["token"]), timeout=20)
        assert r.status_code == 403, f"other customer must be 403, got {r.status_code} {r.text[:250]}"

    def test_update_aircraft_forbidden_for_customer(self, tokens):
        r = requests.post(f"{BASE_URL}/api/preflight/checklist/update",
                          json={"booking_id": TEST_BOOKING_ID, "checklist_type": "aircraft",
                                "item_id": "a1", "checked": True},
                          headers=_auth(tokens["customer"]["token"]), timeout=20)
        assert r.status_code == 403, f"customer should not update aircraft: {r.status_code} {r.text[:250]}"

    def test_update_aircraft_ok_for_operator(self, tokens):
        # toggle on
        r = requests.post(f"{BASE_URL}/api/preflight/checklist/update",
                          json={"booking_id": TEST_BOOKING_ID, "checklist_type": "aircraft",
                                "item_id": "a1", "checked": True},
                          headers=_auth(tokens["operator"]["token"]), timeout=20)
        assert r.status_code == 200, f"operator should update aircraft: {r.status_code} {r.text[:250]}"
        assert r.json().get("success") is True

    def test_update_passenger_ok_for_owner(self, tokens):
        # ensure at least one item toggles; used later by scheduler test if run standalone
        r = requests.post(f"{BASE_URL}/api/preflight/checklist/update",
                          json={"booking_id": TEST_BOOKING_ID, "checklist_type": "passenger",
                                "item_id": "p1", "checked": True},
                          headers=_auth(tokens["customer"]["token"]), timeout=20)
        assert r.status_code == 200
        assert r.json().get("success") is True


# ==================================================================
# FIX 2 — Wallet atomic debit
# ==================================================================

def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro) if asyncio.get_event_loop().is_running() is False \
        else asyncio.new_event_loop().run_until_complete(coro)


@pytest.fixture(scope="class")
def wallet_env(tokens):
    """
    Seed wallet=5000 for customer + capture original booking state so we can restore.
    """
    from database import connect_to_mongo, get_database_sync, close_mongo_connection

    async def setup():
        await connect_to_mongo()
        db = get_database_sync()
        cust_id = tokens["customer"]["user_id"]
        # snapshot wallet + booking
        wallet_before = await db.wallets.find_one({"user_id": cust_id}, {"_id": 0})
        booking_before = await db.inquiries.find_one({"id": TEST_BOOKING_ID}, {"_id": 0})
        txns_before = await db.payment_transactions.find(
            {"booking_id": TEST_BOOKING_ID}, {"_id": 0, "id": 1}).to_list(200)
        wtxns_before = await db.wallet_transactions.find(
            {"user_id": cust_id, "booking_id": TEST_BOOKING_ID}, {"_id": 0, "id": 1}).to_list(200)

        # Seed wallet = 5000 (overwrite fresh)
        await db.wallets.update_one(
            {"user_id": cust_id},
            {"$set": {"user_id": cust_id, "balance": 5000.0, "total_used": 0.0, "test_seeded": True}},
            upsert=True,
        )
        # Ensure booking has an accepted_quote so _payment_ledger has a total (>0)
        # And clear any prior wallet-paid state so first apply succeeds
        # Preserve status/departure_date exactly — we only add accepted_quote if missing
        set_fields = {"payment_status": "pending"}
        if not (booking_before or {}).get("accepted_quote"):
            set_fields["accepted_quote"] = {"amount": 20000, "operator_id": "test", "quoted_at": datetime.now(timezone.utc).isoformat()}
        await db.inquiries.update_one({"id": TEST_BOOKING_ID}, {"$set": set_fields})
        # remove prior paid wallet txns for this booking so ledger is empty
        await db.payment_transactions.delete_many(
            {"booking_id": TEST_BOOKING_ID, "gateway": "wallet"})
        return {
            "cust_id": cust_id,
            "wallet_before": wallet_before,
            "booking_before": booking_before,
            "txn_ids_before": {t["id"] for t in txns_before},
            "wtxn_ids_before": {t["id"] for t in wtxns_before},
        }

    ctx = _run(setup())
    yield ctx

    async def teardown():
        db = get_database_sync()
        cust_id = ctx["cust_id"]
        # remove all wallet-gateway txns we created
        await db.payment_transactions.delete_many(
            {"booking_id": TEST_BOOKING_ID, "gateway": "wallet",
             "id": {"$nin": list(ctx["txn_ids_before"])}})
        await db.wallet_transactions.delete_many(
            {"user_id": cust_id, "booking_id": TEST_BOOKING_ID,
             "id": {"$nin": list(ctx["wtxn_ids_before"])}})
        # restore wallet
        if ctx["wallet_before"]:
            await db.wallets.replace_one({"user_id": cust_id}, ctx["wallet_before"])
        else:
            await db.wallets.delete_one({"user_id": cust_id})
        # restore booking (only fields we touched)
        bb = ctx["booking_before"] or {}
        restore = {
            "payment_status": bb.get("payment_status", None),
            "status": bb.get("status", "confirmed"),
        }
        unset = {}
        if "accepted_quote" not in bb:
            unset["accepted_quote"] = ""
        update = {"$set": {k: v for k, v in restore.items() if v is not None}}
        if unset:
            update["$unset"] = unset
        await db.inquiries.update_one({"id": TEST_BOOKING_ID}, update)
        await close_mongo_connection()

    _run(teardown())


class TestWalletAtomicDebit:

    def test_apply_wallet_success_and_persistence(self, tokens, wallet_env):
        from database import get_database_sync
        cust_id = wallet_env["cust_id"]

        r = requests.post(f"{BASE_URL}/api/payments/wallet/apply",
                          json={"booking_id": TEST_BOOKING_ID},
                          headers=_auth(tokens["customer"]["token"]), timeout=30)
        assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:250]}"
        body = r.json()
        assert body["success"] is True
        applied = float(body["applied"])
        # booking total is 20000; wallet 5000 → apply min(5000, 20000)=5000
        assert applied == 5000.0, f"expected 5000 applied, got {applied}"
        assert float(body["new_wallet_balance"]) == 0.0

        # verify wallet in DB decremented atomically
        async def check():
            db = get_database_sync()
            w = await db.wallets.find_one({"user_id": cust_id}, {"_id": 0})
            ptxns = await db.payment_transactions.find(
                {"booking_id": TEST_BOOKING_ID, "gateway": "wallet"}, {"_id": 0}).to_list(10)
            wtxns = await db.wallet_transactions.find(
                {"user_id": cust_id, "booking_id": TEST_BOOKING_ID, "type": "debit"}, {"_id": 0}).to_list(10)
            return w, ptxns, wtxns

        w, ptxns, wtxns = _run(check())
        assert w and float(w["balance"]) == 0.0
        assert float(w.get("total_used", 0)) == 5000.0
        assert len(ptxns) == 1 and float(ptxns[0]["amount"]) == 5000.0
        assert len(wtxns) == 1 and float(wtxns[0]["amount"]) == 5000.0

    def test_second_apply_zero_balance_returns_400(self, tokens, wallet_env):
        # wallet is now 0 → route raises 400 "No wallet/reward balance available"
        r = requests.post(f"{BASE_URL}/api/payments/wallet/apply",
                          json={"booking_id": TEST_BOOKING_ID},
                          headers=_auth(tokens["customer"]["token"]), timeout=30)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:250]}"

    def test_apply_wallet_forbidden_for_other_customer(self, tokens, wallet_env):
        r = requests.post(f"{BASE_URL}/api/payments/wallet/apply",
                          json={"booking_id": TEST_BOOKING_ID},
                          headers=_auth(tokens["loyalty"]["token"]), timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:250]}"


# ==================================================================
# FIX 1 — Boarding reminder checklist mismatch
# ==================================================================

class TestBoardingReminderChecklistCount:
    """
    Directly exercise scheduler.send_boarding_reminders with:
      - datetime patched so IST hour is inside 17..22 (12:30 UTC → 18:00 IST)
      - target inquiry: departure_date = tomorrow-IST, status=confirmed, boarding_reminder_sent unset
      - preflight_checklists seeded with N checked items using the CORRECT storage shape
        ({'type':'passenger','items':[{item_id,checked,...}]})
      - email_service.send_email monkeypatched to capture subject → assert 'N/12 done'
    Then restores all mutations.
    """

    def test_scheduler_counts_checked_items(self, tokens):
        from database import connect_to_mongo, get_database_sync, close_mongo_connection
        import importlib
        import scheduler as sch

        cust_id = tokens["customer"]["user_id"]

        # class-level FakeDT that yields fixed UTC now (12:30 UTC = 18:00 IST)
        fake_utc = datetime.now(timezone.utc).replace(hour=12, minute=30, second=0, microsecond=0)
        tomorrow_ist_date = ((fake_utc + timedelta(hours=5, minutes=30)) + timedelta(days=1)).strftime("%Y-%m-%d")

        class FakeDT(datetime):
            @classmethod
            def now(cls, tz=None):
                return fake_utc if tz else fake_utc.replace(tzinfo=None)

        captured = {"count": 0, "subject": None, "html": None, "to": None}

        async def fake_send_email(**kwargs):
            captured["count"] += 1
            captured["subject"] = kwargs.get("subject")
            captured["html"] = kwargs.get("html_body") or kwargs.get("html_content")
            captured["to"] = kwargs.get("to_email")
            return {"success": True}

        async def run():
            await connect_to_mongo()
            db = get_database_sync()

            # snapshot inquiry
            before = await db.inquiries.find_one({"id": TEST_BOOKING_ID}, {"_id": 0})
            cl_before = await db.preflight_checklists.find_one(
                {"booking_id": TEST_BOOKING_ID, "type": "passenger"}, {"_id": 0})
            try:
                # seed inquiry: tomorrow-IST, confirmed, unset reminder-sent
                await db.inquiries.update_one(
                    {"id": TEST_BOOKING_ID},
                    {"$set": {"departure_date": tomorrow_ist_date, "status": "confirmed",
                              "customer_id": cust_id},
                     "$unset": {"boarding_reminder_sent": "", "boarding_reminder_sent_at": ""}}
                )
                # seed 3 checked items using the CORRECT stored shape
                now_iso = datetime.now(timezone.utc).isoformat()
                items = [
                    {"item_id": "p1", "checked": True, "checked_at": now_iso},
                    {"item_id": "p2", "checked": True, "checked_at": now_iso},
                    {"item_id": "p3", "checked": True, "checked_at": now_iso},
                    {"item_id": "p4", "checked": False, "checked_at": None},
                ]
                await db.preflight_checklists.update_one(
                    {"booking_id": TEST_BOOKING_ID, "type": "passenger"},
                    {"$set": {"booking_id": TEST_BOOKING_ID, "type": "passenger",
                              "items": items, "updated_at": datetime.now(timezone.utc)}},
                    upsert=True,
                )

                # patch scheduler.datetime + email_service.send_email
                with patch.object(sch, "datetime", FakeDT), \
                     patch("services.email_service.email_service.send_email",
                           new=AsyncMock(side_effect=fake_send_email)):
                    sent = await sch.send_boarding_reminders()

                # assertions
                assert sent == 1, f"expected sent==1, got {sent}"
                assert captured["count"] == 1
                assert captured["subject"], "no subject captured"
                assert "3/12 done" in (captured["subject"] or ""), \
                    f"subject should show 3/12 done, got: {captured['subject']!r}"
                # html body should also mention 3/12
                assert "3/12" in (captured["html"] or ""), "body missing 3/12 progress line"
                assert captured["to"] == "customer@airyatra.co.in"

                # verify the reminder-sent flag was set
                after = await db.inquiries.find_one({"id": TEST_BOOKING_ID}, {"_id": 0})
                assert after.get("boarding_reminder_sent") is True

            finally:
                # ----- restore -----
                restore_set = {}
                restore_unset = {"boarding_reminder_sent": "", "boarding_reminder_sent_at": ""}
                if before:
                    for k in ("departure_date", "status"):
                        if k in before:
                            restore_set[k] = before[k]
                await db.inquiries.update_one(
                    {"id": TEST_BOOKING_ID},
                    {"$set": restore_set, "$unset": restore_unset}
                )
                # restore preflight_checklists doc
                if cl_before:
                    await db.preflight_checklists.replace_one(
                        {"booking_id": TEST_BOOKING_ID, "type": "passenger"}, cl_before)
                else:
                    await db.preflight_checklists.delete_one(
                        {"booking_id": TEST_BOOKING_ID, "type": "passenger"})
                await close_mongo_connection()

        _run(run())
