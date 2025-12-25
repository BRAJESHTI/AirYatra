from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
from uuid import uuid4
import secrets
import pyotp
import qrcode
import io
import base64
from database import get_database
from routes.auth_routes import get_current_user

router = APIRouter(prefix="/2fa", tags=["Two-Factor Authentication"])

# Models
class Enable2FARequest(BaseModel):
    method: str  # totp, sms, email

class Verify2FARequest(BaseModel):
    code: str
    method: str = "totp"

class Disable2FARequest(BaseModel):
    code: str
    password: str

# Helper Functions
def generate_totp_secret():
    """Generate TOTP secret"""
    return pyotp.random_base32()

def generate_totp_uri(secret: str, email: str):
    """Generate TOTP URI for QR code"""
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=email, issuer_name="AirYatra")

def verify_totp(secret: str, code: str) -> bool:
    """Verify TOTP code"""
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)

def generate_qr_code(data: str) -> str:
    """Generate QR code as base64"""
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    
    return base64.b64encode(buffer.getvalue()).decode()

def generate_backup_codes(count: int = 10) -> list:
    """Generate backup codes"""
    return [secrets.token_hex(4).upper() for _ in range(count)]

# API Endpoints
@router.get("/status")
async def get_2fa_status(current_user: dict = Depends(get_current_user)):
    """Get 2FA status for current user"""
    db = get_database()
    
    settings = await db.user_2fa_settings.find_one(
        {"user_id": current_user["id"]},
        {"_id": 0, "totp_secret": 0, "backup_codes": 0}
    )
    
    if not settings:
        return {
            "enabled": False,
            "methods": []
        }
    
    return {
        "enabled": settings.get("enabled", False),
        "methods": settings.get("enabled_methods", []),
        "backup_codes_remaining": len(settings.get("backup_codes_used", [])) if settings.get("backup_codes") else 0
    }

@router.post("/setup/totp")
async def setup_totp(current_user: dict = Depends(get_current_user)):
    """Setup TOTP 2FA"""
    db = get_database()
    
    # Check if already setup
    existing = await db.user_2fa_settings.find_one({"user_id": current_user["id"]})
    if existing and existing.get("totp_verified"):
        raise HTTPException(status_code=400, detail="TOTP already setup")
    
    # Generate secret
    secret = generate_totp_secret()
    uri = generate_totp_uri(secret, current_user.get("email", "user"))
    qr_code = generate_qr_code(uri)
    
    # Store temporarily (not verified yet)
    await db.user_2fa_settings.update_one(
        {"user_id": current_user["id"]},
        {
            "$set": {
                "user_id": current_user["id"],
                "totp_secret": secret,
                "totp_verified": False,
                "setup_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    return {
        "secret": secret,
        "qr_code": qr_code,
        "manual_entry_key": secret,
        "message": "Scan QR code with authenticator app, then verify with a code"
    }

@router.post("/verify/totp")
async def verify_totp_setup(request: Verify2FARequest, current_user: dict = Depends(get_current_user)):
    """Verify TOTP setup"""
    db = get_database()
    
    settings = await db.user_2fa_settings.find_one({"user_id": current_user["id"]})
    if not settings or not settings.get("totp_secret"):
        raise HTTPException(status_code=400, detail="TOTP not setup. Start setup first.")
    
    if not verify_totp(settings["totp_secret"], request.code):
        raise HTTPException(status_code=400, detail="Invalid code")
    
    # Generate backup codes
    backup_codes = generate_backup_codes()
    
    # Enable 2FA
    await db.user_2fa_settings.update_one(
        {"user_id": current_user["id"]},
        {
            "$set": {
                "enabled": True,
                "totp_verified": True,
                "enabled_methods": ["totp"],
                "backup_codes": backup_codes,
                "backup_codes_used": [],
                "verified_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Update user
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"two_factor_enabled": True}}
    )
    
    return {
        "message": "2FA enabled successfully",
        "backup_codes": backup_codes,
        "warning": "Save these backup codes securely. They won't be shown again!"
    }

@router.post("/verify")
async def verify_2fa_code(request: Verify2FARequest, current_user: dict = Depends(get_current_user)):
    """Verify 2FA code during login"""
    db = get_database()
    
    settings = await db.user_2fa_settings.find_one({"user_id": current_user["id"]})
    if not settings or not settings.get("enabled"):
        raise HTTPException(status_code=400, detail="2FA not enabled")
    
    if request.method == "totp":
        if not verify_totp(settings["totp_secret"], request.code):
            # Check backup codes
            if request.code.upper() in settings.get("backup_codes", []):
                # Mark backup code as used
                await db.user_2fa_settings.update_one(
                    {"user_id": current_user["id"]},
                    {"$push": {"backup_codes_used": request.code.upper()}}
                )
                return {"verified": True, "method": "backup_code"}
            
            raise HTTPException(status_code=400, detail="Invalid code")
        
        return {"verified": True, "method": "totp"}
    
    raise HTTPException(status_code=400, detail="Invalid method")

@router.post("/disable")
async def disable_2fa(request: Disable2FARequest, current_user: dict = Depends(get_current_user)):
    """Disable 2FA"""
    db = get_database()
    
    settings = await db.user_2fa_settings.find_one({"user_id": current_user["id"]})
    if not settings or not settings.get("enabled"):
        raise HTTPException(status_code=400, detail="2FA not enabled")
    
    # Verify code first
    if not verify_totp(settings["totp_secret"], request.code):
        raise HTTPException(status_code=400, detail="Invalid code")
    
    # Disable
    await db.user_2fa_settings.update_one(
        {"user_id": current_user["id"]},
        {
            "$set": {
                "enabled": False,
                "disabled_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"two_factor_enabled": False}}
    )
    
    return {"message": "2FA disabled successfully"}

@router.get("/backup-codes")
async def get_backup_codes_count(current_user: dict = Depends(get_current_user)):
    """Get remaining backup codes count"""
    db = get_database()
    
    settings = await db.user_2fa_settings.find_one({"user_id": current_user["id"]})
    if not settings:
        return {"remaining": 0, "total": 0}
    
    total = len(settings.get("backup_codes", []))
    used = len(settings.get("backup_codes_used", []))
    
    return {"remaining": total - used, "total": total}

@router.post("/regenerate-backup-codes")
async def regenerate_backup_codes(request: Verify2FARequest, current_user: dict = Depends(get_current_user)):
    """Regenerate backup codes"""
    db = get_database()
    
    settings = await db.user_2fa_settings.find_one({"user_id": current_user["id"]})
    if not settings or not settings.get("enabled"):
        raise HTTPException(status_code=400, detail="2FA not enabled")
    
    # Verify code first
    if not verify_totp(settings["totp_secret"], request.code):
        raise HTTPException(status_code=400, detail="Invalid code")
    
    # Generate new codes
    new_codes = generate_backup_codes()
    
    await db.user_2fa_settings.update_one(
        {"user_id": current_user["id"]},
        {
            "$set": {
                "backup_codes": new_codes,
                "backup_codes_used": [],
                "codes_regenerated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {
        "backup_codes": new_codes,
        "message": "New backup codes generated. Old codes are now invalid."
    }

@router.get("/admin/stats")
async def get_2fa_stats(current_user: dict = Depends(get_current_user)):
    """Get 2FA adoption statistics"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    total_users = await db.users.count_documents({})
    users_with_2fa = await db.user_2fa_settings.count_documents({"enabled": True})
    
    return {
        "total_users": total_users,
        "users_with_2fa": users_with_2fa,
        "adoption_rate": round(users_with_2fa / total_users * 100, 1) if total_users > 0 else 0
    }
