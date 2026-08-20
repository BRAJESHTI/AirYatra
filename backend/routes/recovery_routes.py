"""
Emergency Admin Recovery Routes — token-gated (X-Recovery-Token header).
Disabled entirely when ADMIN_RECOVERY_TOKEN env is unset (returns 404).
For production support/testing when SMTP OTP delivery is unavailable.
"""
from fastapi import APIRouter, HTTPException, Request, Header
from pydantic import BaseModel
from typing import Optional
from database import get_database
from auth import get_password_hash
from services.otp_service import otp_service
import os
import hmac
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/recovery", tags=["Emergency Recovery"])

STAFF_ROLES = {"admin", "super_admin", "finance", "ceo", "cfo", "sales", "operator", "hr", "support"}


def _check_token(provided: Optional[str]):
    expected = os.environ.get("ADMIN_RECOVERY_TOKEN", "").strip()
    if not expected:
        raise HTTPException(status_code=404, detail="Not found")
    if not provided or not hmac.compare_digest(provided.strip(), expected):
        raise HTTPException(status_code=403, detail="Invalid recovery token")


async def _audit(db, action, email, request, extra=None):
    try:
        await db.recovery_audit.insert_one({
            "action": action, "target_email": email,
            "ip": request.client.host if request.client else None,
            "user_agent": (request.headers.get("user-agent") or "")[:200],
            "extra": extra or {}, "at": datetime.now(timezone.utc).isoformat()})
    except Exception:
        pass


class ResetReq(BaseModel):
    email: str
    new_password: str


class OTPReq(BaseModel):
    email: str


EMPLOYEE_SEED = [
    {"email": "ceo@airyatra.co.in", "password": "Ceo@Air123", "full_name": "Vikram Sharma",
     "roles": ["ceo", "admin", "super_admin"], "phone": "+91-9876543210"},
    {"email": "admin@airyatra.co.in", "password": "Adm@Air123", "full_name": "Admin User",
     "roles": ["admin"], "phone": "9876543210"},
    {"email": "noreply@airyatra.co.in", "password": "Nor@Air123", "full_name": "No-Reply System",
     "roles": ["support"], "phone": "+919000000010"},
    {"email": "finance@airyatra.co.in", "password": "Fin@Air123", "full_name": "Finance Manager",
     "roles": ["finance", "cfo"], "phone": "9876543210"},
    {"email": "hr@airyatra.co.in", "password": "Hr@Air123", "full_name": "HR Manager",
     "roles": ["hr", "admin"], "phone": "9876543210"},
    {"email": "booking@airyatra.co.in", "password": "Boo@Air123", "full_name": "Booking AirYatra",
     "roles": ["booking"], "phone": "+919000000010"},
    {"email": "sales@airyatra.co.in", "password": "Sal@Air123", "full_name": "Sales Manager",
     "roles": ["sales", "admin"], "phone": "9876543211"},
]


async def _seed_employees(db, request):
    """Upsert all 7 corporate employee accounts (idempotent, resets passwords + clears lockouts)"""
    import uuid
    results = []
    for emp in EMPLOYEE_SEED:
        email = emp["email"]
        existing = await db.users.find_one({"email": email}, {"_id": 0, "id": 1})
        doc = {
            "email": email, "full_name": emp["full_name"], "phone": emp["phone"],
            "roles": emp["roles"], "is_active": True, "is_verified": True,
            "password_hash": get_password_hash(emp["password"]),
            "failed_login_attempts": 0, "locked_until": None,
            "password_updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if existing:
            await db.users.update_one({"id": existing["id"]}, {"$set": doc})
            results.append({"email": email, "action": "updated"})
        else:
            doc["id"] = str(uuid.uuid4())
            doc["created_at"] = datetime.now(timezone.utc).isoformat()
            await db.users.insert_one(doc)
            results.append({"email": email, "action": "created"})
        await db.login_attempts.delete_many({"identifier": {"$regex": email}})
    await _audit(db, "seed_employees", "all-7", request, {"results": results})
    logger.warning("[RECOVERY] All 7 employee accounts seeded/reset")
    return results


@router.post("/seed-employees")
async def recovery_seed_employees(request: Request,
                                  x_recovery_token: Optional[str] = Header(None)):
    """Seed/reset all 7 corporate employee accounts. Gated by X-Recovery-Token header."""
    _check_token(x_recovery_token)
    db = get_database()
    results = await _seed_employees(db, request)
    return {"success": True, "message": "All 7 employee accounts ready. Login OTP via email still applies.",
            "accounts": results}


@router.get("/seed-employees")
async def recovery_seed_employees_get(request: Request, token: Optional[str] = None):
    """Browser-friendly: open /api/recovery/seed-employees?token=RECOVERY_TOKEN to seed accounts."""
    _check_token(token)
    db = get_database()
    results = await _seed_employees(db, request)
    return {"success": True, "message": "All 7 employee accounts ready. Login OTP via email still applies.",
            "accounts": results}


@router.post("/reset-password")
async def recovery_reset_password(data: ResetReq, request: Request,
                                  x_recovery_token: Optional[str] = Header(None)):
    """Reset a staff account password. Gated by X-Recovery-Token."""
    _check_token(x_recovery_token)
    db = get_database()
    email = data.email.strip().lower()
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not (STAFF_ROLES & set(user.get("roles", []))):
        raise HTTPException(status_code=403, detail="Recovery only allowed for staff accounts")
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"password_hash": get_password_hash(data.new_password),
                  "failed_login_attempts": 0, "locked_until": None,
                  "password_updated_at": datetime.now(timezone.utc).isoformat()}})
    # Clear lockout records
    await db.login_attempts.delete_many({"identifier": {"$regex": email}})
    await _audit(db, "reset_password", email, request, {"roles": user.get("roles")})
    logger.warning(f"[RECOVERY] Password reset for staff account {email}")
    return {"success": True, "message": f"Password reset for {email}. Login OTP may still be required.",
            "roles": user.get("roles", [])}


@router.post("/mint-otp")
async def recovery_mint_otp(data: OTPReq, request: Request,
                            x_recovery_token: Optional[str] = Header(None)):
    """Mint a fresh login OTP and return it directly (SMTP-independent). Gated."""
    _check_token(x_recovery_token)
    db = get_database()
    email = data.email.strip().lower()
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not (STAFF_ROLES & set(user.get("roles", []))):
        raise HTTPException(status_code=403, detail="Recovery only allowed for staff accounts")
    # Clear cooldown + existing OTPs then mint fresh
    await db.otp_codes.delete_many({"user_id": user["id"], "purpose": "login"})
    code, rec = await otp_service.create_otp(
        user["id"], email, purpose="login",
        ip_address=request.client.host if request.client else None,
        user_agent=(request.headers.get("user-agent") or "")[:200])
    if not code:
        raise HTTPException(status_code=429, detail=rec.get("message", "OTP cooldown"))
    await _audit(db, "mint_otp", email, request)
    logger.warning(f"[RECOVERY] Login OTP minted for staff account {email}")
    return {"success": True, "email": email, "otp_code": code,
            "expires_in_minutes": otp_service.config.get("expiry_minutes", 5),
            "message": "Use this OTP at /api/auth/login/verify-otp"}
