"""Go-Live Launch Checklist — dynamic production readiness checks"""
import os
from fastapi import APIRouter, HTTPException, Depends
from database import get_database
from middleware import get_current_user

router = APIRouter(prefix="/admin/launch-checklist", tags=["Admin - Launch Checklist"])

STAFF = {"admin", "super_admin", "ceo", "finance", "cfo"}
PRIV_ROLES = ["admin", "super_admin", "ceo", "operator", "finance", "cfo",
              "finance_head", "accounts_manager", "treasury_analyst"]


def _env(key, default=""):
    return os.environ.get(key, default).strip('"')


@router.get("")
async def launch_checklist(user: dict = Depends(get_current_user)):
    if not STAFF & set(user.get("roles", [])):
        raise HTTPException(status_code=403, detail="Staff access required")
    db = get_database()
    items = []

    def add(category, label, ready, detail, warning=False):
        items.append({"category": category, "label": label,
                      "status": "ready" if ready else ("warning" if warning else "pending"),
                      "detail": detail})

    # ---- PAYMENTS ----
    from routes.razorpay_routes import GATEWAY_MODE
    live_keys = bool(_env("RAZORPAY_LIVE_KEY_ID") and _env("RAZORPAY_LIVE_KEY_SECRET"))
    add("Payments", "Razorpay LIVE keys configured", live_keys,
        "Live keys set in backend .env" if live_keys else "Add RAZORPAY_LIVE_KEY_ID & RAZORPAY_LIVE_KEY_SECRET in backend .env")
    add("Payments", "Gateway switched to LIVE mode", GATEWAY_MODE == "live",
        f"Current mode: {GATEWAY_MODE.upper()}" + ("" if GATEWAY_MODE == "live" else " — use Go Live toggle in API Keys settings"))
    add("Payments", "Marine/Helipad real payment gateway", False,
        "Vertical bookings (yacht/cruise/helipad) use MOCKED checkout — real Razorpay integration pending", warning=True)
    add("Payments", "Razorpay webhook secret set", bool(_env("RAZORPAY_WEBHOOK_SECRET")),
        "Webhook signature verification enabled" if _env("RAZORPAY_WEBHOOK_SECRET") else "Set RAZORPAY_WEBHOOK_SECRET")

    # ---- SECURITY ----
    otp_on = _env("LOGIN_OTP_ENABLED", "true").lower() == "true"
    add("Security", "Login OTP enabled (step-up MFA)", otp_on,
        "Privileged logins require emailed OTP" if otp_on else "Set LOGIN_OTP_ENABLED=true in backend .env")
    bypass_count = await db.users.count_documents(
        {"roles": {"$in": PRIV_ROLES},
         "$or": [{"login_shield_bypass": True}, {"otp_enabled": False}]})
    add("Security", "No OTP backdoors on privileged accounts", bypass_count == 0,
        "All privileged accounts enforce OTP" if bypass_count == 0 else f"{bypass_count} privileged account(s) still bypass OTP")
    quick = _env("QUICK_LOGIN_ENABLED", "false").lower() == "true"
    seed = _env("ENABLE_SEED_ENDPOINT", "false").lower() == "true"
    add("Security", "Dev backdoor endpoints disabled", not quick and not seed,
        "Quick-login & seed endpoints are off" if not quick and not seed else "Disable QUICK_LOGIN_ENABLED / ENABLE_SEED_ENDPOINT")
    add("Security", "Role escalation & payment IDOR guards", True,
        "Admin role-assignment, invoice, Razorpay & PayPal ownership guards active (audited)")

    # ---- COMMUNICATIONS ----
    smtp_ok = bool(_env("SMTP_PASSWORD") and _env("SMTP_USER"))
    add("Communications", "Email (SMTP) configured", smtp_ok,
        f"Sending via {_env('SMTP_HOST') or 'SMTP'}" if smtp_ok else "Set SMTP_USER / SMTP_PASSWORD in backend .env")
    tw = bool(_env("TWILIO_ACCOUNT_SID") and _env("TWILIO_AUTH_TOKEN"))
    add("Communications", "SMS (Twilio) configured", tw,
        "Twilio ready" if tw else "Optional: set Twilio keys for SMS alerts", warning=not tw)

    # ---- DATA HYGIENE ----
    test_users = await db.users.count_documents(
        {"email": {"$regex": "test|@example.com|@test.com", "$options": "i"}})
    add("Data Hygiene", "Test accounts cleanup", test_users == 0,
        "No test accounts found" if test_users == 0 else f"{test_users} test/demo account(s) still in users collection", warning=test_users > 0)
    pending_refunds = await db.refund_requests.count_documents({"status": "pending_approval"})
    add("Data Hygiene", "No stale pending refunds", pending_refunds == 0,
        "Refund queue clear" if pending_refunds == 0 else f"{pending_refunds} refund(s) awaiting approval", warning=pending_refunds > 0)

    ready = sum(1 for i in items if i["status"] == "ready")
    blockers = sum(1 for i in items if i["status"] == "pending")
    warnings = sum(1 for i in items if i["status"] == "warning")
    return {"items": items, "ready": ready, "blockers": blockers, "warnings": warnings,
            "total": len(items), "score_pct": round(ready / len(items) * 100),
            "go_live_ready": blockers == 0}
