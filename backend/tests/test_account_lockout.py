"""
Backend tests for Account Lockout Security (P0)
Covers:
  - POST /api/auth/login: 5 failed attempts -> 423 LOCKED (+ remaining_attempts countdown on 401)
  - GET  /api/auth/lockout-status: locked flag + remaining_seconds
  - POST /api/auth/unlock-account: email+token unlock
  - GET  /api/auth/admin/locked-accounts: admin-only listing
  - POST /api/auth/admin/unlock-account/{email}: admin force-unlock
  - Email service: account_locked template renders
"""
import os
import re
import time
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")

backend_env = dotenv_values("/app/backend/.env")
MONGO_URL = os.environ.get("MONGO_URL") or backend_env.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME") or backend_env.get("DB_NAME")


# ---------- Fixtures ----------

@pytest.fixture(scope="module")
def db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="module")
def lockout_email(db):
    """Unique, non-existent email so we can safely trigger 5 failures without harming a real user."""
    email = f"TEST_lockout_{uuid.uuid4().hex[:8]}@example.com"
    yield email
    # cleanup
    db.account_lockouts.delete_many({"email": email.lower()})


@pytest.fixture(scope="module")
def admin_token(db):
    """Mint an admin JWT directly (avoids 5/min login rate limit clash with lockout tests)."""
    import sys
    sys.path.insert(0, "/app/backend")
    from auth import create_access_token
    admin = db.users.find_one({"email": "testadmin@airyatra.com"}) \
        or db.users.find_one({"email": "admin@airyatra.com"})
    if not admin:
        pytest.skip("testadmin@airyatra.com not seeded; skipping admin endpoint tests")
    roles = admin.get("roles", [])
    if "admin" not in roles:
        pytest.skip(f"testadmin lacks admin role: {roles}")
    return create_access_token(data={"sub": admin["id"], "roles": roles})


# ---------- Lockout flow: 5 failed attempts -> 423 ----------

class TestAccountLockoutFlow:

    def test_lockout_status_initial_unlocked(self, lockout_email):
        resp = requests.get(f"{BASE_URL}/api/auth/lockout-status",
                            params={"email": lockout_email}, timeout=15)
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data.get("locked") is False
        assert data.get("remaining_attempts") == 5

    def test_five_failed_attempts_lock_account(self, lockout_email, db):
        """
        1st..4th → 401 with descending remaining_attempts
        5th      → 423 LOCKED (lockout triggered on this very attempt per code)
        """
        remaining_seen = []
        last_status = None
        last_body = None
        for i in range(1, 6):
            resp = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": lockout_email,
                "password": f"wrong-pass-{i}"
            }, timeout=15)
            last_status = resp.status_code
            try:
                last_body = resp.json()
            except Exception:
                last_body = {"raw": resp.text}

            # If we hit the IP rate limit (5/min), skip - real 5/min limit interfering
            if resp.status_code == 429:
                pytest.skip(f"Rate limited at attempt {i}; cannot fully verify lockout flow this run.")

            if i < 5:
                assert resp.status_code == 401, f"attempt {i}: expected 401, got {resp.status_code}: {last_body}"
                # detail = "Incorrect email or password. X attempts remaining."
                detail = last_body.get("detail", "")
                m = re.search(r"(\d+)\s+attempts remaining", str(detail))
                assert m, f"attempt {i}: remaining_attempts missing in detail: {detail}"
                remaining_seen.append(int(m.group(1)))
            else:
                # 5th attempt should be 423 with structured detail
                assert resp.status_code == 423, f"5th attempt should lock: got {resp.status_code}: {last_body}"
                detail = last_body.get("detail", {})
                # detail may be dict or str
                if isinstance(detail, dict):
                    assert detail.get("error") == "account_locked"
                    assert "lockout_until" in detail

        # Countdown 4,3,2,1
        assert remaining_seen == [4, 3, 2, 1], f"remaining_attempts countdown wrong: {remaining_seen}"

        # DB record verification
        rec = db.account_lockouts.find_one({"email": lockout_email.lower()})
        assert rec is not None
        assert rec.get("locked") is True
        assert rec.get("failed_attempts") >= 5
        assert rec.get("unlock_token"), "unlock_token should be set for email link"

    def test_lockout_status_shows_locked(self, lockout_email):
        resp = requests.get(f"{BASE_URL}/api/auth/lockout-status",
                            params={"email": lockout_email}, timeout=15)
        assert resp.status_code == 200
        data = resp.json()
        if not data.get("locked"):
            pytest.skip("Account not locked (previous test likely skipped due to rate limit).")
        assert data.get("locked") is True
        assert data.get("remaining_seconds", 0) > 0
        assert data.get("remaining_seconds") <= 30 * 60 + 5
        assert "lockout_until" in data

    def test_login_while_locked_returns_423(self, lockout_email):
        # Should be blocked BEFORE credential check (pre-check)
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": lockout_email,
            "password": "anything"
        }, timeout=15)
        if resp.status_code == 429:
            pytest.skip("Rate limited; can't verify pre-lock check.")
        assert resp.status_code == 423, f"got {resp.status_code}: {resp.text[:300]}"
        detail = resp.json().get("detail", {})
        if isinstance(detail, dict):
            assert detail.get("error") == "account_locked"
            assert "remaining_seconds" in detail


# ---------- Unlock via email token ----------

class TestUnlockAccount:

    def test_unlock_with_invalid_token_returns_400(self, lockout_email):
        resp = requests.post(f"{BASE_URL}/api/auth/unlock-account", json={
            "email": lockout_email,
            "token": "invalid-token-xyz"
        }, timeout=15)
        # If not locked (skipped earlier), API returns True/200 with "not locked"
        rec_status = requests.get(f"{BASE_URL}/api/auth/lockout-status",
                                  params={"email": lockout_email}, timeout=10).json()
        if not rec_status.get("locked"):
            pytest.skip("Account not locked; can't test invalid token path.")
        assert resp.status_code == 400
        assert "Invalid unlock token" in resp.json().get("detail", "")

    def test_unlock_with_valid_token_succeeds(self, lockout_email, db):
        rec = db.account_lockouts.find_one({"email": lockout_email.lower()})
        if not rec or not rec.get("locked"):
            pytest.skip("Account not locked; can't test valid-token unlock.")
        token = rec.get("unlock_token")
        assert token, "unlock_token missing in DB"

        resp = requests.post(f"{BASE_URL}/api/auth/unlock-account", json={
            "email": lockout_email,
            "token": token
        }, timeout=15)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body.get("success") is True
        assert "unlocked" in body.get("message", "").lower()

        # DB reflects unlock
        rec2 = db.account_lockouts.find_one({"email": lockout_email.lower()})
        assert rec2.get("locked") is False
        assert rec2.get("failed_attempts") == 0
        assert rec2.get("unlock_token") in (None, "")
        assert rec2.get("unlocked_via") == "email_token"

        # Status endpoint agrees
        s = requests.get(f"{BASE_URL}/api/auth/lockout-status",
                         params={"email": lockout_email}, timeout=10).json()
        assert s.get("locked") is False


# ---------- Admin endpoints ----------

class TestAdminLockoutEndpoints:

    def test_admin_locked_accounts_requires_auth(self):
        resp = requests.get(f"{BASE_URL}/api/auth/admin/locked-accounts", timeout=15)
        assert resp.status_code in (401, 403), f"expected auth error, got {resp.status_code}"

    def test_admin_locked_accounts_list(self, admin_token, db, lockout_email):
        # Seed a locked row directly (bypasses rate limits) so listing has something to show
        from datetime import datetime, timezone, timedelta
        seed_email = f"TEST_adminseed_{uuid.uuid4().hex[:6]}@example.com"
        now = datetime.now(timezone.utc)
        db.account_lockouts.insert_one({
            "email": seed_email.lower(),
            "failed_attempts": 5,
            "locked": True,
            "locked_at": now,
            "lockout_until": now + timedelta(minutes=30),
            "unlock_token": "seed-token-abc",
            "unlock_token_expires": now + timedelta(minutes=60),
            "ip_addresses": ["127.0.0.1"],
            "created_at": now,
            "updated_at": now,
        })
        try:
            resp = requests.get(
                f"{BASE_URL}/api/auth/admin/locked-accounts",
                headers={"Authorization": f"Bearer {admin_token}"},
                timeout=15
            )
            assert resp.status_code == 200, resp.text
            body = resp.json()
            assert "accounts" in body and "total" in body
            assert isinstance(body["accounts"], list)
            emails = [a.get("email") for a in body["accounts"]]
            assert seed_email.lower() in emails, f"seeded locked email not returned: {emails}"
            # Security: unlock_token must be projected out
            for a in body["accounts"]:
                assert "unlock_token" not in a
                assert "_id" not in a
        finally:
            db.account_lockouts.delete_one({"email": seed_email.lower()})

    def test_admin_force_unlock(self, admin_token, db):
        from datetime import datetime, timezone, timedelta
        seed_email = f"TEST_adminunlock_{uuid.uuid4().hex[:6]}@example.com"
        now = datetime.now(timezone.utc)
        db.account_lockouts.insert_one({
            "email": seed_email.lower(),
            "failed_attempts": 5,
            "locked": True,
            "locked_at": now,
            "lockout_until": now + timedelta(minutes=30),
            "unlock_token": "seed-token-xyz",
            "unlock_token_expires": now + timedelta(minutes=60),
            "ip_addresses": ["127.0.0.1"],
            "created_at": now,
            "updated_at": now,
        })
        try:
            resp = requests.post(
                f"{BASE_URL}/api/auth/admin/unlock-account/{seed_email}",
                headers={"Authorization": f"Bearer {admin_token}"},
                timeout=15
            )
            assert resp.status_code == 200, resp.text
            assert resp.json().get("success") is True

            rec = db.account_lockouts.find_one({"email": seed_email.lower()})
            assert rec.get("locked") is False
            assert rec.get("unlocked_via") == "admin"
            assert rec.get("unlocked_by")
        finally:
            db.account_lockouts.delete_one({"email": seed_email.lower()})

    def test_admin_force_unlock_nonexistent_returns_400(self, admin_token):
        resp = requests.post(
            f"{BASE_URL}/api/auth/admin/unlock-account/nonexistent_{uuid.uuid4().hex}@example.com",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15
        )
        assert resp.status_code == 400
        assert "not" in resp.json().get("detail", "").lower()

    def test_non_admin_cannot_access_admin_endpoints(self):
        # Login as a non-admin (customer via /api/auth/register would need customer role;
        # use a bogus JWT to simulate no roles)
        resp = requests.get(
            f"{BASE_URL}/api/auth/admin/locked-accounts",
            headers={"Authorization": "Bearer invalid.jwt.token"},
            timeout=15
        )
        assert resp.status_code in (401, 403)


# ---------- Email template ----------

class TestAccountLockedEmailTemplate:

    def test_template_registered(self):
        from services.email_service import EMAIL_TEMPLATES
        assert "account_locked" in EMAIL_TEMPLATES
        tpl = EMAIL_TEMPLATES["account_locked"]
        assert "subject" in tpl and "body" in tpl
        # Required placeholders
        for ph in ["{{ email }}", "{{ unlock_url }}", "{{ lockout_minutes }}", "{{ max_attempts }}"]:
            assert ph in tpl["body"], f"missing placeholder {ph} in account_locked template"

    def test_send_account_locked_email_builds_correct_url(self, monkeypatch):
        """Verify unlock URL construction without actually sending SMTP."""
        import asyncio
        from services.email_service import EmailService

        svc = EmailService()

        captured = {}

        async def fake_send_template_email(template_name, to_email, data):
            captured["template"] = template_name
            captured["to"] = to_email
            captured["data"] = data
            return {"success": True, "mocked": True}

        monkeypatch.setattr(svc, "send_template_email", fake_send_template_email)

        result = asyncio.get_event_loop().run_until_complete(
            svc.send_account_locked_email(
                to_email="lockuser@example.com",
                unlock_token="tok-123",
                lockout_minutes=30,
                ip_address="10.0.0.1"
            )
        )
        assert result.get("success") is True
        assert captured["template"] == "account_locked"
        assert captured["to"] == "lockuser@example.com"
        d = captured["data"]
        assert d["email"] == "lockuser@example.com"
        assert d["lockout_minutes"] == 30
        assert d["max_attempts"] == 5
        assert d["ip_address"] == "10.0.0.1"
        assert "unlock-account" in d["unlock_url"]
        assert "email=lockuser@example.com" in d["unlock_url"]
        assert "token=tok-123" in d["unlock_url"]
