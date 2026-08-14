from fastapi import APIRouter, HTTPException, Depends, status, Request, Response, UploadFile, File
from database import get_database
from models import UserCreate, UserLogin, Token, User
from auth import verify_password, get_password_hash, create_access_token
from middleware import get_current_user, hash_token
from security_middleware import limiter, RATE_LIMITS, AuditLogger
from services.otp_service import otp_service, hash_device_fingerprint
from services.email_service import EmailService
from services.login_shield_service import login_shield
from services.totp_service import totp_service
from services.account_lockout_service import account_lockout_service
import uuid
import os
import hmac
import logging

logger = logging.getLogger(__name__)
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["Authentication"])
email_service = EmailService()

# Security settings
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "true").lower() == "true"  # Set to False for local HTTP dev
COOKIE_SAMESITE = os.environ.get("COOKIE_SAMESITE", "lax")  # "strict", "lax", or "none"
COOKIE_MAX_AGE = 60 * 60 * 24 * 7  # 7 days in seconds


class OTPRequest(BaseModel):
    email: str
    password: str
    trust_device: Optional[bool] = False


class OTPVerify(BaseModel):
    email: str
    otp_code: str
    trust_device: Optional[bool] = False


# ========== TOTP 2FA Models ==========
class TOTPSetupRequest(BaseModel):
    """Request to start 2FA setup"""
    pass  # User ID comes from authenticated token


class TOTPVerifyRequest(BaseModel):
    """Request to verify TOTP code"""
    code: str  # 6-digit code from authenticator app


class TOTPDisableRequest(BaseModel):
    """Request to disable 2FA"""
    password: str  # Current password for verification


def set_auth_cookie(response: Response, token: str, max_age: int = COOKIE_MAX_AGE):
    """
    SEC-003 FIX: Set JWT in httpOnly cookie instead of returning in response body.
    This prevents XSS attacks from stealing the token.
    """
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,           # Cannot be accessed by JavaScript
        secure=COOKIE_SECURE,    # HTTPS only in production
        samesite=COOKIE_SAMESITE,  # CSRF protection
        max_age=max_age,
        path="/api"              # Only sent to API routes
    )


def clear_auth_cookie(response: Response):
    """Clear the auth cookie on logout"""
    response.delete_cookie(
        key="access_token",
        path="/api",
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE
    )


@router.post("/register", response_model=Token)
@limiter.limit(RATE_LIMITS["register"])
async def register(request: Request, user_data: UserCreate):
    """Register a new user (Rate limited: 3/minute)"""
    db = get_database()
    
    existing_user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    user_dict = user_data.model_dump()
    user_dict["id"] = str(uuid.uuid4())
    user_dict["password_hash"] = get_password_hash(user_dict.pop("password"))
    user_dict["is_active"] = True
    user_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    user_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # SECURITY FIX: Force role to "customer" for self-registration
    # Admin/operator/pilot roles can only be assigned via admin-authenticated endpoint
    user_dict["roles"] = ["customer"]
    
    # Create a copy for insertion to avoid MongoDB adding _id to original dict
    insert_dict = user_dict.copy()
    await db.users.insert_one(insert_dict)
    
    # Welcome bonus: 500 loyalty points for new customers
    if "customer" in user_dict.get("roles", []):
        try:
            now_iso = datetime.now(timezone.utc).isoformat()
            await db.loyalty_profiles.insert_one({
                "user_id": user_dict["id"],
                "total_points": 500,
                "available_points": 500,
                "lifetime_points": 500,
                "tier": "bronze",
                "total_bookings": 0,
                "total_spent": 0,
                "joined_at": now_iso,
            })
            await db.points_history.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user_dict["id"],
                "type": "bonus",
                "points": 500,
                "description": "🎉 Welcome bonus - Thank you for joining AirYatra!",
                "reference_id": "welcome_bonus",
                "created_at": now_iso,
            })
        except Exception as e:
            print(f"Welcome bonus failed: {e}")
    
    access_token = create_access_token(data={"sub": user_dict["id"], "roles": user_dict["roles"]})
    
    user_response = {k: v for k, v in user_dict.items() if k != "password_hash"}
    
    # Audit log: Successful registration
    try:
        audit = AuditLogger(db)
        await audit.log(
            action=AuditLogger.ACTION_LOGIN,
            category=AuditLogger.CATEGORY_AUTH,
            user_id=user_dict["id"],
            user_email=user_dict["email"],
            user_roles=user_dict.get("roles", []),
            details={"event": "registration"},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("User-Agent"),
            status="success"
        )
    except Exception:
        pass
    
    return Token(access_token=access_token, user=user_response)


# ========== SMS OTP LOGIN ROUTES ==========

class PhoneOTPRequest(BaseModel):
    """Request to send OTP to phone"""
    phone: str
    
class PhoneOTPVerify(BaseModel):
    """Request to verify phone OTP and login"""
    phone: str
    otp_code: str

@router.post("/phone/send-otp")
@limiter.limit("5/minute")
async def send_phone_otp(request: Request, data: PhoneOTPRequest):
    """
    Send OTP to phone number for passwordless login
    
    Usage:
    POST /api/auth/phone/send-otp
    {"phone": "+919999999999"}
    """
    from services.sms_otp_service import sms_otp_service
    
    result = await sms_otp_service.send_otp(data.phone)
    
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Failed to send OTP")
        )
    
    # SECURITY: Never return OTP in production response
    response_data = {
        "success": True,
        "message": result.get("message", "OTP sent"),
        "message_hi": result.get("message_hi", "OTP भेजा गया"),
        "phone": result.get("phone"),
    }
    
    # Only include mock info in explicit development mode (for frontend dev testing)
    # This should NEVER be true in production
    if result.get("mock_mode") and os.environ.get("SHOW_MOCK_OTP_IN_RESPONSE", "false").lower() == "true":
        response_data["mock_mode"] = True
        response_data["mock_otp"] = result.get("mock_otp")
    
    return response_data

@router.post("/phone/verify-otp")
@limiter.limit("10/minute")
async def verify_phone_otp(request: Request, data: PhoneOTPVerify):
    """
    Verify phone OTP and login/create user
    
    Usage:
    POST /api/auth/phone/verify-otp
    {"phone": "+919999999999", "otp_code": "123456"}
    """
    from services.sms_otp_service import sms_otp_service
    
    db = get_database()
    
    # Verify OTP first
    verify_result = await sms_otp_service.verify_otp(data.phone, data.otp_code)
    
    if not verify_result.get("success") or not verify_result.get("valid"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=verify_result.get("message", "Invalid OTP")
        )
    
    # Format phone number
    phone = verify_result.get("phone", data.phone)
    
    # Find or create user by phone
    existing_user = await db.users.find_one(
        {"phone": phone},
        {"_id": 0}
    )
    
    now = datetime.now(timezone.utc).isoformat()
    is_new_user = False
    
    if existing_user:
        # Update last login
        await db.users.update_one(
            {"phone": phone},
            {"$set": {
                "last_login": now,
                "phone_verified": True,
                "updated_at": now
            }}
        )
        user_id = existing_user.get("id")
        roles = existing_user.get("roles", ["customer"])
        email = existing_user.get("email")
        full_name = existing_user.get("full_name", "")
    else:
        # Create new user with phone
        is_new_user = True
        user_id = str(uuid.uuid4())
        roles = ["customer"]
        email = None
        full_name = ""
        
        new_user = {
            "id": user_id,
            "phone": phone,
            "email": None,
            "full_name": full_name,
            "roles": roles,
            "is_active": True,
            "is_verified": True,
            "phone_verified": True,
            "auth_provider": "phone_otp",
            "created_at": now,
            "updated_at": now,
            "last_login": now,
            "login_shield_enabled": False,
            "two_factor_enabled": False
        }
        
        await db.users.insert_one(new_user)
    
    # Generate token
    token_data = {
        "sub": user_id,
        "email": email or phone,
        "roles": roles,
        "login_method": "phone_otp"
    }
    
    access_token = create_access_token(data=token_data)
    
    return {
        "success": True,
        "access_token": access_token,
        "token_type": "bearer",
        "is_new_user": is_new_user,
        "user": {
            "id": user_id,
            "email": email,
            "phone": phone,
            "full_name": full_name,
            "roles": roles,
            "phone_verified": True
        },
        "message": "Phone verified & logged in" if not is_new_user else "Account created & logged in",
        "message_hi": "फोन सत्यापित और लॉग इन" if not is_new_user else "खाता बनाया गया और लॉग इन"
    }


@router.post("/login")
@limiter.limit(RATE_LIMITS["login"])
async def login(request: Request, credentials: UserLogin):
    """
    Login user - Step 1: Validate credentials
    If OTP required, returns otp_required=True
    If device trusted or OTP disabled, returns token directly
    
    SECURITY: Account lockout after 5 failed attempts
    """
    db = get_database()
    ip_address = request.client.host if request.client else "unknown"
    
    # Check if account is locked BEFORE attempting login
    lockout_status = await account_lockout_service.check_lockout_status(credentials.email)
    if lockout_status.get("locked"):
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail={
                "error": "account_locked",
                "message": f"Account is locked due to too many failed login attempts. Try again in {lockout_status.get('remaining_seconds', 0) // 60} minutes or use the unlock link sent to your email.",
                "lockout_until": lockout_status.get("lockout_until"),
                "remaining_seconds": lockout_status.get("remaining_seconds", 0)
            }
        )
    
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    
    # Audit logging for failed attempts
    if not user or not verify_password(credentials.password, user["password_hash"]):
        # Record failed attempt
        lockout_result = await account_lockout_service.record_failed_attempt(
            email=credentials.email,
            ip_address=ip_address
        )
        
        # If account just got locked, send unlock email
        if lockout_result.get("locked") and lockout_result.get("unlock_token"):
            try:
                # Send account locked email with unlock link
                await email_service.send_account_locked_email(
                    to_email=credentials.email,
                    unlock_token=lockout_result["unlock_token"],
                    lockout_minutes=30,
                    ip_address=ip_address
                )
            except Exception as e:
                print(f"Failed to send lockout email: {e}")
        
        # Log failed login attempt
        try:
            audit = AuditLogger(db)
            await audit.log(
                action=AuditLogger.ACTION_LOGIN_FAILED,
                category=AuditLogger.CATEGORY_AUTH,
                user_email=credentials.email,
                details={
                    "reason": "invalid_credentials",
                    "remaining_attempts": lockout_result.get("remaining_attempts", 0),
                    "locked": lockout_result.get("locked", False)
                },
                ip_address=ip_address,
                user_agent=request.headers.get("User-Agent"),
                status="failure",
                risk_level="medium"
            )
        except Exception:
            pass
        
        # Return appropriate error message
        if lockout_result.get("locked"):
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail={
                    "error": "account_locked",
                    "message": "Account locked due to too many failed attempts. Check your email for unlock instructions.",
                    "lockout_until": lockout_result.get("lockout_until")
                }
            )
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Incorrect email or password. {lockout_result.get('remaining_attempts', 0)} attempts remaining."
        )
    
    if not user.get("is_active", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    
    # Login Shield AI - Calculate risk score
    ip_address = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("User-Agent", "")
    
    risk_assessment = await login_shield.calculate_risk_score(
        user_id=user["id"],
        email=user["email"],
        ip_address=ip_address,
        user_agent=user_agent,
        login_successful=True
    )
    
    # Check if login should be blocked
    if risk_assessment["action"]["block_login"]:
        # Send alert email to user
        try:
            await email_service.send_new_device_alert(
                to_email=user["email"],
                user_name=user.get("full_name", user["email"].split("@")[0]),
                device_name=otp_service._parse_device_name(user_agent),
                ip_address=ip_address,
                location="Unknown"
            )
        except Exception:
            pass
        
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Login blocked due to suspicious activity (Risk Score: {risk_assessment['score']}). Please contact support."
        )
    
    # Determine if OTP is required (either by policy or by risk level)
    force_otp_by_risk = risk_assessment["action"]["force_otp"]
    
    # SEC-002 FIX: Check if user has TOTP 2FA enabled
    totp_enabled = user.get("totp_enabled", False)
    
    requires_otp, reason = await otp_service.should_require_otp(
        user_id=user["id"],
        user_agent=user_agent,
        ip_address=ip_address,
        user_data=user
    )
    
    # GLOBAL OTP DISABLE: set LOGIN_OTP_ENABLED="true" in .env to re-enable login OTP
    if os.environ.get("LOGIN_OTP_ENABLED", "true").lower() != "true":
        requires_otp = False
        force_otp_by_risk = False
        reason = "otp_globally_disabled"

    # BYPASS CHECK: If user has login_shield_bypass, skip all OTP
    if user.get("login_shield_bypass", False):
        requires_otp = False
        force_otp_by_risk = False
        reason = "bypass_enabled"
    
    # Force OTP if risk level demands it
    if force_otp_by_risk and not requires_otp:
        requires_otp = True
        reason = f"risk_level_{risk_assessment['level'].lower()}"
    
    # If TOTP is enabled, always require 2FA verification
    if totp_enabled:
        # Return special response indicating TOTP is required
        return {
            "totp_required": True,
            "otp_required": False,
            "temp_token": create_access_token(
                data={"sub": user["id"], "roles": user["roles"], "pending_2fa": True},
                expires_delta=timedelta(minutes=5)  # Short-lived token for 2FA
            ),
            "message": "Google Authenticator code required",
            "risk_score": risk_assessment["score"],
            "risk_level": risk_assessment["level"]
        }
    
    if requires_otp:
        # Generate and send OTP
        otp_code, otp_result = await otp_service.create_otp(
            user_id=user["id"],
            email=user["email"],
            purpose="login",
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        if otp_code is None:
            # Cooldown active
            return {
                "otp_required": True,
                "otp_sent": False,
                "cooldown": True,
                "message": otp_result.get("message"),
                "remaining_seconds": otp_result.get("remaining_seconds", 60)
            }
        
        # Send OTP email
        device_name = otp_service._parse_device_name(user_agent)
        await email_service.send_otp_email(
            to_email=user["email"],
            user_name=user.get("full_name", user["email"].split("@")[0]),
            otp_code=otp_code,
            expiry_minutes=5,
            device_info=device_name,
            ip_address=ip_address
        )
        
        # Log OTP sent
        try:
            audit = AuditLogger(db)
            await audit.log(
                action="otp_sent",
                category=AuditLogger.CATEGORY_AUTH,
                user_id=user["id"],
                user_email=user["email"],
                details={"reason": reason, "otp_id": otp_result.get("otp_id")},
                ip_address=ip_address,
                user_agent=user_agent,
                status="success"
            )
        except Exception:
            pass
        
        return {
            "otp_required": True,
            "otp_sent": True,
            "message": f"OTP sent to {user['email'][:3]}***{user['email'].split('@')[0][-1]}@{user['email'].split('@')[1]}",
            "reason": reason,
            "expires_in_minutes": 5,
            "risk_score": risk_assessment["score"],
            "risk_level": risk_assessment["level"]
        }
    
    # No OTP required - issue token directly
    access_token = create_access_token(data={"sub": user["id"], "roles": user["roles"]})
    
    # Reset lockout counter on successful login
    await account_lockout_service.record_successful_login(user["email"])
    
    # Create session record
    try:
        token_hash = hash_token(access_token)
        device_hash = otp_service.hash_device_fingerprint(user_agent, ip_address, user["id"]) if user_agent else None
        await db.user_sessions.insert_one({
            "user_id": user["id"],
            "token_hash": token_hash,
            "device_hash": device_hash,
            "ip_address": ip_address,
            "user_agent": user_agent[:200] if user_agent else None,
            "created_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "last_activity": datetime.now(timezone.utc),
            "is_active": True
        })
    except Exception:
        pass
    
    # Audit log: Successful login
    try:
        audit = AuditLogger(db)
        await audit.log(
            action=AuditLogger.ACTION_LOGIN,
            category=AuditLogger.CATEGORY_AUTH,
            user_id=user["id"],
            user_email=user["email"],
            user_roles=user.get("roles", []),
            details={"otp_skipped": True, "reason": reason},
            ip_address=ip_address,
            user_agent=user_agent,
            status="success"
        )
    except Exception:
        pass
    
    user_response = {k: v for k, v in user.items() if k != "password_hash"}
    
    return Token(access_token=access_token, user=user_response)


@router.post("/login/verify-otp")
@limiter.limit(RATE_LIMITS["login"])
async def verify_login_otp(request: Request, data: OTPVerify):
    """
    Login Step 2: Verify OTP and issue token
    """
    db = get_database()
    
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user:
        # Return generic error to prevent account enumeration
        raise HTTPException(status_code=401, detail="Invalid OTP or credentials")
    
    ip_address = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("User-Agent", "")
    
    # Verify OTP
    is_valid, result = await otp_service.verify_otp(
        user_id=user["id"],
        otp_code=data.otp_code,
        purpose="login"
    )
    
    if not is_valid:
        # Log failed OTP attempt
        try:
            audit = AuditLogger(db)
            await audit.log(
                action="otp_failed",
                category=AuditLogger.CATEGORY_AUTH,
                user_id=user["id"],
                user_email=user["email"],
                details={"error": result.get("error"), "message": result.get("message")},
                ip_address=ip_address,
                user_agent=user_agent,
                status="failure",
                risk_level="medium"
            )
        except Exception:
            pass
        
        raise HTTPException(
            status_code=401,
            detail=result.get("message", "Invalid OTP")
        )
    
    # OTP verified - issue token
    access_token = create_access_token(data={"sub": user["id"], "roles": user["roles"]})
    
    # Trust device if requested
    device_info = None
    if data.trust_device:
        device_info = await otp_service.trust_device(
            user_id=user["id"],
            user_agent=user_agent,
            ip_address=ip_address
        )
        
        # Send device trusted email
        try:
            await email_service.send_device_trusted_email(
                to_email=user["email"],
                user_name=user.get("full_name", user["email"].split("@")[0]),
                device_name=device_info.get("device_name", "Unknown Device"),
                trust_days=30,
                expires_at=device_info.get("expires_at", "")[:10]
            )
        except Exception:
            pass
    
    # Create session record
    try:
        token_hash = hash_token(access_token)
        device_hash = otp_service.hash_device_fingerprint(user_agent, ip_address, user["id"]) if user_agent else None
        await db.user_sessions.insert_one({
            "user_id": user["id"],
            "token_hash": token_hash,
            "device_hash": device_hash,
            "ip_address": ip_address,
            "user_agent": user_agent[:200] if user_agent else None,
            "device_trusted": data.trust_device,
            "created_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "last_activity": datetime.now(timezone.utc),
            "is_active": True
        })
    except Exception:
        pass
    
    # Audit log
    try:
        audit = AuditLogger(db)
        await audit.log(
            action=AuditLogger.ACTION_LOGIN,
            category=AuditLogger.CATEGORY_AUTH,
            user_id=user["id"],
            user_email=user["email"],
            user_roles=user.get("roles", []),
            details={"otp_verified": True, "device_trusted": data.trust_device},
            ip_address=ip_address,
            user_agent=user_agent,
            status="success"
        )
    except Exception:
        pass
    
    # Send new device alert if not trusted before
    if not data.trust_device:
        try:
            device_name = otp_service._parse_device_name(user_agent)
            await email_service.send_new_device_alert(
                to_email=user["email"],
                user_name=user.get("full_name", user["email"].split("@")[0]),
                device_name=device_name,
                ip_address=ip_address
            )
        except Exception:
            pass
    
    user_response = {k: v for k, v in user.items() if k != "password_hash"}
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_response,
        "device_trusted": device_info is not None,
        "message": "Login successful"
    }


# ========== TOTP LOGIN VERIFICATION (SEC-002 FIX) ==========

class TOTPLoginVerify(BaseModel):
    """Request to verify TOTP code during login"""
    temp_token: str  # The temporary token from login step 1
    code: str  # 6-digit TOTP code


@router.post("/login/verify-totp")
@limiter.limit(RATE_LIMITS["login"])
async def verify_login_totp(request: Request, data: TOTPLoginVerify):
    """
    Login Step 2 (TOTP): Verify Google Authenticator code and issue full token
    This endpoint is called when user has TOTP 2FA enabled
    """
    from auth import decode_token
    
    db = get_database()
    ip_address = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("User-Agent", "")
    
    # Decode the temporary token
    payload = decode_token(data.temp_token)
    if not payload or not payload.get("pending_2fa"):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired temporary token. Please login again."
        )
    
    user_id = payload.get("sub")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Verify the TOTP code
    result = await totp_service.verify_code(user_id=user_id, code=data.code)
    
    if not result.get("success"):
        # Log failed TOTP attempt
        try:
            audit = AuditLogger(db)
            await audit.log(
                action="totp_login_failed",
                category=AuditLogger.CATEGORY_AUTH,
                user_id=user_id,
                user_email=user.get("email"),
                details={"error": result.get("error")},
                ip_address=ip_address,
                user_agent=user_agent,
                status="failure",
                risk_level="high"
            )
        except Exception:
            pass
        
        raise HTTPException(
            status_code=401,
            detail=result.get("error", "Invalid TOTP code")
        )
    
    # TOTP verified - issue FULL access token (without pending_2fa flag)
    access_token = create_access_token(data={"sub": user["id"], "roles": user["roles"]})
    
    # Create session record
    try:
        token_hash = hash_token(access_token)
        device_hash = otp_service.hash_device_fingerprint(user_agent, ip_address, user["id"]) if user_agent else None
        await db.user_sessions.insert_one({
            "user_id": user["id"],
            "token_hash": token_hash,
            "device_hash": device_hash,
            "ip_address": ip_address,
            "user_agent": user_agent[:200] if user_agent else None,
            "created_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "last_activity": datetime.now(timezone.utc),
            "is_active": True,
            "auth_method": "totp_2fa"
        })
    except Exception:
        pass
    
    # Audit log: Successful TOTP login
    try:
        audit = AuditLogger(db)
        await audit.log(
            action="totp_login_success",
            category=AuditLogger.CATEGORY_AUTH,
            user_id=user["id"],
            user_email=user.get("email"),
            user_roles=user.get("roles", []),
            details={"totp_verified": True, "is_recovery": result.get("is_recovery", False)},
            ip_address=ip_address,
            user_agent=user_agent,
            status="success"
        )
    except Exception:
        pass
    
    user_response = {k: v for k, v in user.items() if k != "password_hash"}
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_response,
        "message": "Login successful with 2FA"
    }



# ========== ACCOUNT LOCKOUT ENDPOINTS ==========

class UnlockAccountRequest(BaseModel):
    email: str
    token: str


@router.post("/unlock-account")
async def unlock_account(request: Request, data: UnlockAccountRequest):
    """
    Unlock account using the token sent via email.
    Called when user clicks the unlock link in their email.
    """
    success, message = await account_lockout_service.unlock_with_token(
        email=data.email,
        token=data.token
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )
    
    # Log the unlock
    db = get_database()
    try:
        audit = AuditLogger(db)
        await audit.log(
            action="account_unlocked",
            category=AuditLogger.CATEGORY_AUTH,
            user_email=data.email,
            details={"method": "email_token"},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("User-Agent"),
            status="success"
        )
    except Exception:
        pass
    
    return {
        "success": True,
        "message": message
    }


@router.get("/lockout-status")
async def get_lockout_status(email: str):
    """
    Check if an account is currently locked (public endpoint for login form)
    SECURITY: Returns generic response to prevent email enumeration
    """
    status = await account_lockout_service.check_lockout_status(email)
    
    # SECURITY FIX: Return generic response - don't reveal if email exists
    # Only reveal lockout info, not account existence
    if status.get("is_locked"):
        return {
            "is_locked": True,
            "message": "Account temporarily locked due to multiple failed attempts",
            "remaining_seconds": status.get("remaining_seconds", 300)
        }
    else:
        # Generic response - don't reveal account existence
        return {
            "is_locked": False,
            "message": "Account is not locked"
        }


@router.get("/admin/locked-accounts")
async def get_locked_accounts(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get all currently locked accounts (Admin only)"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    accounts = await account_lockout_service.get_locked_accounts(limit)
    return {"accounts": accounts, "total": len(accounts)}


@router.post("/admin/unlock-account/{email}")
async def admin_unlock_account(
    email: str,
    current_user: dict = Depends(get_current_user)
):
    """Force unlock an account (Admin only)"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    success, message = await account_lockout_service.admin_unlock(
        email=email,
        admin_id=current_user["id"]
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    # Log admin action
    db = get_database()
    try:
        audit = AuditLogger(db)
        await audit.log(
            action="admin_account_unlock",
            category=AuditLogger.CATEGORY_AUTH,
            user_id=current_user["id"],
            user_email=current_user.get("email"),
            details={"unlocked_email": email},
            status="success",
            risk_level="medium"
        )
    except Exception:
        pass
    
    return {"success": True, "message": message}



@router.post("/login/resend-otp")
@limiter.limit("3/minute")
async def resend_login_otp(request: Request, data: OTPRequest):
    """Resend OTP for login"""
    db = get_database()
    
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    ip_address = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("User-Agent", "")
    
    # Generate new OTP
    otp_code, otp_result = await otp_service.create_otp(
        user_id=user["id"],
        email=user["email"],
        purpose="login",
        ip_address=ip_address,
        user_agent=user_agent
    )
    
    if otp_code is None:
        return {
            "success": False,
            "cooldown": True,
            "message": otp_result.get("message"),
            "remaining_seconds": otp_result.get("remaining_seconds", 60)
        }
    
    # Send OTP email
    device_name = otp_service._parse_device_name(user_agent)
    await email_service.send_otp_email(
        to_email=user["email"],
        user_name=user.get("full_name", user["email"].split("@")[0]),
        otp_code=otp_code,
        expiry_minutes=5,
        device_info=device_name,
        ip_address=ip_address
    )
    
    return {
        "success": True,
        "message": f"OTP resent to {user['email'][:3]}***@{user['email'].split('@')[1]}",
        "expires_in_minutes": 5
    }

@router.get("/me")
async def get_current_user_info(user: dict = Depends(get_current_user)):
    """Get current user information"""
    return {k: v for k, v in user.items() if k != "password_hash"}

@router.put("/profile")
async def update_profile(
    profile_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update user profile"""
    db = get_database()
    
    # Fields that can be updated
    allowed_fields = ["full_name", "phone", "address", "city", "state", "pincode"]
    
    update_data = {
        k: v for k, v in profile_data.items() 
        if k in allowed_fields and v is not None
    }
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Fetch updated user
    updated_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password_hash": 0})
    
    return {
        "message": "Profile updated successfully",
        "user": updated_user
    }


@router.put("/change-password")
async def change_password(
    request: Request,
    password_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Change password and invalidate all other sessions.
    
    Body: {"current_password": "...", "new_password": "..."}
    """
    db = get_database()
    
    current_password = password_data.get("current_password")
    new_password = password_data.get("new_password")
    
    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="Both current_password and new_password required")
    
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    
    # Verify current password
    user = await db.users.find_one({"id": current_user["id"]})
    if not user or not verify_password(current_password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    
    # Update password
    new_password_hash = get_password_hash(new_password)
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "password_hash": new_password_hash,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "password_changed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # SESSION INVALIDATION: Revoke all other sessions except current
    current_token_hash = current_user.get("_current_token_hash")
    
    # Find all active sessions for this user
    sessions = await db.user_sessions.find({
        "user_id": current_user["id"],
        "is_active": True
    }).to_list(100)
    
    revoked_count = 0
    for session in sessions:
        if session.get("token_hash") != current_token_hash:
            # Mark session as inactive
            await db.user_sessions.update_one(
                {"_id": session["_id"]},
                {"$set": {
                    "is_active": False,
                    "revoked_at": datetime.now(timezone.utc),
                    "revoke_reason": "password_change"
                }}
            )
            # Add token to revoked list
            await db.revoked_tokens.insert_one({
                "token_hash": session["token_hash"],
                "revoked_at": datetime.now(timezone.utc),
                "reason": "password_change",
                "user_id": current_user["id"],
                "expires_at": datetime.now(timezone.utc) + timedelta(days=30)
            })
            revoked_count += 1
    
    # Audit log
    try:
        audit = AuditLogger(db)
        await audit.log(
            action=AuditLogger.ACTION_PASSWORD_CHANGE,
            category=AuditLogger.CATEGORY_AUTH,
            user_id=current_user["id"],
            user_email=current_user.get("email"),
            user_roles=current_user.get("roles", []),
            details={"sessions_revoked": revoked_count},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("User-Agent"),
            status="success",
            risk_level="medium"
        )
    except Exception:
        pass
    
    return {
        "message": "Password changed successfully",
        "sessions_revoked": revoked_count
    }


class DeleteAccountRequest(BaseModel):
    password: Optional[str] = None
    confirm_text: Optional[str] = None


@router.post("/delete-account")
async def delete_account(
    body: DeleteAccountRequest,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Permanently deactivate the user's own account (soft delete) and revoke all sessions."""
    db = get_database()
    user = await db.users.find_one({"id": current_user["id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Require password whenever one exists (covers hybrid Google+password accounts)
    if user.get("password_hash"):
        if not body.password or not verify_password(body.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Password is incorrect")
    else:
        if (body.confirm_text or "").strip().upper() != "DELETE":
            raise HTTPException(status_code=400, detail="Type DELETE to confirm account deletion")

    now = datetime.now(timezone.utc)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "is_active": False,
            "account_deleted": True,
            "deleted_at": now.isoformat(),
            "updated_at": now.isoformat()
        }}
    )

    # Revoke ALL sessions including the current one
    sessions = await db.user_sessions.find({
        "user_id": user["id"],
        "is_active": True
    }).to_list(200)
    revoked_count = 0
    for session in sessions:
        await db.user_sessions.update_one(
            {"_id": session["_id"]},
            {"$set": {"is_active": False, "revoked_at": now, "revoke_reason": "account_deleted"}}
        )
        if session.get("token_hash"):
            await db.revoked_tokens.insert_one({
                "token_hash": session["token_hash"],
                "revoked_at": now,
                "reason": "account_deleted",
                "user_id": user["id"],
                "expires_at": now + timedelta(days=30)
            })
        revoked_count += 1

    try:
        audit = AuditLogger(db)
        await audit.log(
            action="account_deleted",
            category=AuditLogger.CATEGORY_AUTH,
            user_id=user["id"],
            user_email=user.get("email"),
            user_roles=user.get("roles", []),
            details={"sessions_revoked": revoked_count},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("User-Agent"),
            status="success",
            risk_level="high"
        )
    except Exception:
        pass

    return {
        "success": True,
        "message": "Your account has been deleted. We're sorry to see you go.",
        "sessions_revoked": revoked_count
    }


ALLOWED_AVATAR_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}
MAX_AVATAR_SIZE = 2 * 1024 * 1024  # 2 MB


@router.post("/profile-picture")
async def upload_profile_picture(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload a custom profile picture to Emergent object storage."""
    from services.object_storage import put_object, APP_NAME
    db = get_database()

    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_AVATAR_TYPES:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, WEBP or GIF images are allowed")
    data = await file.read()
    if len(data) > MAX_AVATAR_SIZE:
        raise HTTPException(status_code=400, detail="Image must be under 2 MB")
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")

    ext = ALLOWED_AVATAR_TYPES[content_type]
    path = f"{APP_NAME}/avatars/{current_user['id']}/{uuid.uuid4().hex}.{ext}"
    try:
        result = put_object(path, data, content_type)
    except Exception as e:
        logger.error(f"Avatar upload failed for {current_user['id']}: {e}")
        raise HTTPException(status_code=502, detail="Upload failed, please try again")

    avatar_url = f"/api/auth/avatar/{current_user['id']}"
    now = datetime.now(timezone.utc).isoformat()
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "avatar_storage_path": result["path"],
            "avatar_content_type": content_type,
            "profile_picture": avatar_url,
            "updated_at": now,
        }}
    )
    return {"success": True, "profile_picture": avatar_url}


@router.get("/avatar/{user_id}")
async def get_avatar(user_id: str):
    """Serve a user's uploaded avatar (public — avatars are non-sensitive)."""
    from services.object_storage import get_object
    db = get_database()
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "avatar_storage_path": 1, "avatar_content_type": 1})
    if not user or not user.get("avatar_storage_path"):
        raise HTTPException(status_code=404, detail="Avatar not found")
    try:
        data, ct = get_object(user["avatar_storage_path"])
    except Exception:
        raise HTTPException(status_code=404, detail="Avatar not found")
    return Response(
        content=data,
        media_type=user.get("avatar_content_type") or ct,
        headers={"Cache-Control": "public, max-age=300"},
    )


@router.post("/logout-all-devices")
async def logout_all_devices(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Logout from all devices (revoke all tokens)"""
    db = get_database()
    
    current_token_hash = current_user.get("_current_token_hash")
    
    # Find all active sessions
    sessions = await db.user_sessions.find({
        "user_id": current_user["id"],
        "is_active": True
    }).to_list(100)
    
    revoked_count = 0
    for session in sessions:
        # Optionally keep current session active
        # if session.get("token_hash") == current_token_hash:
        #     continue
        
        await db.user_sessions.update_one(
            {"_id": session["_id"]},
            {"$set": {
                "is_active": False,
                "revoked_at": datetime.now(timezone.utc),
                "revoke_reason": "logout_all"
            }}
        )
        await db.revoked_tokens.insert_one({
            "token_hash": session["token_hash"],
            "revoked_at": datetime.now(timezone.utc),
            "reason": "logout_all",
            "user_id": current_user["id"],
            "expires_at": datetime.now(timezone.utc) + timedelta(days=30)
        })
        revoked_count += 1
    
    # Audit log
    try:
        audit = AuditLogger(db)
        await audit.log(
            action=AuditLogger.ACTION_TOKEN_REVOKE,
            category=AuditLogger.CATEGORY_AUTH,
            user_id=current_user["id"],
            user_email=current_user.get("email"),
            details={"sessions_revoked": revoked_count, "reason": "logout_all_devices"},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("User-Agent"),
            status="success"
        )
    except Exception:
        pass
    
    return {
        "message": "Logged out from all devices",
        "sessions_revoked": revoked_count
    }


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    current_user: dict = Depends(get_current_user)
):
    """
    Logout current session - clears httpOnly cookie and revokes token
    SEC-003 FIX: Proper session termination
    """
    db = get_database()
    
    current_token_hash = current_user.get("_current_token_hash")
    
    # Revoke current session
    if current_token_hash:
        await db.user_sessions.update_one(
            {"token_hash": current_token_hash, "user_id": current_user["id"]},
            {"$set": {
                "is_active": False,
                "revoked_at": datetime.now(timezone.utc),
                "revoke_reason": "logout"
            }}
        )
        await db.revoked_tokens.insert_one({
            "token_hash": current_token_hash,
            "revoked_at": datetime.now(timezone.utc),
            "reason": "logout",
            "user_id": current_user["id"],
            "expires_at": datetime.now(timezone.utc) + timedelta(days=30)
        })
    
    # Clear the auth cookie
    clear_auth_cookie(response)
    
    # Audit log
    try:
        audit = AuditLogger(db)
        await audit.log(
            action=AuditLogger.ACTION_LOGOUT,
            category=AuditLogger.CATEGORY_AUTH,
            user_id=current_user["id"],
            user_email=current_user.get("email"),
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("User-Agent"),
            status="success"
        )
    except Exception:
        pass
    
    return {"message": "Logged out successfully"}


@router.get("/sessions")
async def get_user_sessions(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Get all active sessions for current user with device info"""
    db = get_database()
    
    current_user_agent = request.headers.get("User-Agent", "")
    current_ip = request.client.host if request.client else "unknown"
    current_device_hash = hash_device_fingerprint(current_user_agent, current_ip, current_user["id"])
    
    sessions = await db.user_sessions.find(
        {"user_id": current_user["id"], "is_active": True},
        {"_id": 0, "token_hash": 0}
    ).sort("last_activity", -1).to_list(20)
    
    # Enhance session data
    for session in sessions:
        session["is_current"] = session.get("device_hash") == current_device_hash
        session["device_name"] = otp_service._parse_device_name(session.get("user_agent", ""))
        # Convert datetime to string if needed
        if hasattr(session.get("created_at"), 'isoformat'):
            session["created_at"] = session["created_at"].isoformat()
        if hasattr(session.get("last_activity"), 'isoformat'):
            session["last_activity"] = session["last_activity"].isoformat()
    
    return {"sessions": sessions, "total": len(sessions)}


@router.delete("/sessions/{session_id}")
async def revoke_session(
    session_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Logout from a specific session/device"""
    db = get_database()
    
    # Find the session
    session = await db.user_sessions.find_one({
        "user_id": current_user["id"],
        "_id": {"$exists": True}  # We need to match by some identifier
    })
    
    # Update by device_hash or ip_address combo
    result = await db.user_sessions.update_one(
        {
            "user_id": current_user["id"],
            "is_active": True,
            "$or": [
                {"device_hash": session_id},
                {"ip_address": session_id}
            ]
        },
        {"$set": {
            "is_active": False,
            "revoked_at": datetime.now(timezone.utc),
            "revoke_reason": "user_requested"
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {"message": "Session revoked successfully"}


# ===== TRUSTED DEVICES MANAGEMENT =====

@router.get("/trusted-devices")
async def get_trusted_devices(current_user: dict = Depends(get_current_user)):
    """Get all trusted devices for current user"""
    devices = await otp_service.get_trusted_devices(current_user["id"])
    return {"devices": devices, "total": len(devices)}


@router.delete("/trusted-devices/{device_id}")
async def revoke_trusted_device(
    device_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove a device from trusted list"""
    success = await otp_service.revoke_device_trust(current_user["id"], device_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Device not found")
    
    return {"message": "Device trust revoked", "device_id": device_id}


@router.delete("/trusted-devices")
async def revoke_all_trusted_devices(current_user: dict = Depends(get_current_user)):
    """Remove all devices from trusted list"""
    count = await otp_service.revoke_all_device_trust(current_user["id"])
    return {"message": f"Revoked trust for {count} devices", "devices_revoked": count}


@router.post("/trust-current-device")
async def trust_current_device(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Trust the current device (skip OTP for 30 days)"""
    ip_address = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("User-Agent", "")
    
    result = await otp_service.trust_device(
        user_id=current_user["id"],
        user_agent=user_agent,
        ip_address=ip_address
    )
    
    # Send confirmation email
    try:
        await email_service.send_device_trusted_email(
            to_email=current_user["email"],
            user_name=current_user.get("full_name", current_user["email"].split("@")[0]),
            device_name=result.get("device_name", "Unknown Device"),
            trust_days=30,
            expires_at=result.get("expires_at", "")[:10]
        )
    except Exception:
        pass
    
    return result


# ===== SECURITY SETTINGS =====

@router.get("/security-settings")
async def get_security_settings(current_user: dict = Depends(get_current_user)):
    """Get user's security settings"""
    db = get_database()
    
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    
    # Count active sessions and trusted devices
    active_sessions = await db.user_sessions.count_documents({
        "user_id": current_user["id"],
        "is_active": True
    })
    
    trusted_devices = await db.trusted_devices.count_documents({
        "user_id": current_user["id"],
        "is_active": True,
        "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}
    })
    
    return {
        "otp_enabled": user.get("otp_enabled", True),
        "active_sessions": active_sessions,
        "trusted_devices": trusted_devices,
        "last_password_change": user.get("password_changed_at"),
        "account_created": user.get("created_at"),
    }


@router.put("/security-settings")
async def update_security_settings(
    settings: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update user's security settings"""
    db = get_database()
    
    allowed_fields = ["otp_enabled"]
    update_data = {k: v for k, v in settings.items() if k in allowed_fields}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid settings to update")
    
    # SECURITY: privileged roles cannot self-disable mandatory login OTP
    PRIVILEGED_OTP_ROLES = {"admin", "super_admin", "ceo", "operator",
                            "finance", "cfo", "finance_head", "accounts_manager", "treasury_analyst"}
    if update_data.get("otp_enabled") is False and PRIVILEGED_OTP_ROLES & set(current_user.get("roles", [])):
        raise HTTPException(status_code=403, detail="OTP is mandatory for privileged roles and cannot be disabled")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": update_data}
    )
    
    return {"message": "Security settings updated", "settings": update_data}



# ===== LOGIN SHIELD AI ADMIN ENDPOINTS =====

def require_admin_role(current_user: dict = Depends(get_current_user)):
    """Dependency to ensure user has admin, ceo, or hr role"""
    allowed_roles = ["admin", "ceo", "hr"]
    user_roles = current_user.get("roles", [])
    if not any(role in allowed_roles for role in user_roles):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@router.get("/login-shield/stats")
async def get_login_shield_stats(current_user: dict = Depends(require_admin_role)):
    """Get Login Shield security statistics"""
    stats = await login_shield.get_security_stats()
    return stats


@router.get("/login-shield/high-risk-logins")
async def get_high_risk_logins(
    hours: int = 24,
    min_level: str = "MEDIUM",
    current_user: dict = Depends(require_admin_role)
):
    """Get recent high-risk login attempts"""
    logins = await login_shield.get_high_risk_logins(hours=hours, min_level=min_level)
    return {"logins": logins, "total": len(logins), "period_hours": hours}


@router.get("/login-shield/alerts")
async def get_security_alerts(
    unread_only: bool = False,
    limit: int = 50,
    current_user: dict = Depends(require_admin_role)
):
    """Get security alerts for admin"""
    alerts = await login_shield.get_admin_alerts(unread_only=unread_only, limit=limit)
    return {"alerts": alerts, "total": len(alerts)}


@router.put("/login-shield/alerts/{alert_id}/read")
async def mark_alert_read(
    alert_id: str,
    current_user: dict = Depends(require_admin_role)
):
    """Mark a security alert as read"""
    success = await login_shield.mark_alert_read(alert_id)
    if not success:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"message": "Alert marked as read", "alert_id": alert_id}


@router.get("/login-shield/incidents")
async def get_security_incidents(
    status: Optional[str] = None,
    limit: int = 50,
    current_user: dict = Depends(require_admin_role)
):
    """Get security incidents"""
    db = get_database()
    
    query = {}
    if status:
        query["status"] = status
    
    incidents = await db.security_incidents.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"incidents": incidents, "total": len(incidents)}


@router.put("/login-shield/incidents/{incident_id}/resolve")
async def resolve_security_incident(
    incident_id: str,
    resolution: dict,
    current_user: dict = Depends(require_admin_role)
):
    """Resolve a security incident"""
    success = await login_shield.resolve_incident(
        incident_id=incident_id,
        resolution=resolution.get("resolution", ""),
        resolved_by=current_user["email"]
    )
    
    if not success:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    return {"message": "Incident resolved", "incident_id": incident_id}


@router.get("/login-shield/user-risk-history/{user_id}")
async def get_user_risk_history(
    user_id: str,
    limit: int = 20,
    current_user: dict = Depends(require_admin_role)
):
    """Get risk assessment history for a specific user"""
    history = await login_shield.get_user_risk_history(user_id=user_id, limit=limit)
    return {"history": history, "total": len(history)}


# ========== LOGIN ACTIVITY LOG ==========

@router.get("/login-activity")
async def get_login_activity(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """
    Get user's own login activity history
    Shows recent logins with device, browser, IP, location, and status
    """
    db = get_database()
    
    # Fetch login attempts from audit_logs
    activities = await db.audit_logs.find(
        {
            "user_id": current_user["id"],
            "action": {"$in": ["login", "login_failed", "otp_verified", "logout"]}
        },
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    # Enrich with device info parsing
    enriched_activities = []
    for activity in activities:
        # Parse user agent for device/browser info
        user_agent = activity.get("user_agent", "")
        device_info = _parse_user_agent(user_agent)
        
        # Get location from IP if available
        location = activity.get("details", {}).get("location", {})
        location_str = _format_location(location)
        
        enriched_activities.append({
            "id": activity.get("id", ""),
            "action": activity.get("action", ""),
            "status": activity.get("status", "unknown"),
            "timestamp": activity.get("timestamp", ""),
            "ip_address": activity.get("ip_address", "Unknown"),
            "device": device_info.get("device", "Unknown Device"),
            "browser": device_info.get("browser", "Unknown Browser"),
            "os": device_info.get("os", "Unknown OS"),
            "location": location_str,
            "risk_level": activity.get("details", {}).get("risk_level", ""),
            "reason": activity.get("details", {}).get("reason", ""),
        })
    
    return {
        "activities": enriched_activities,
        "total": len(enriched_activities),
        "user_id": current_user["id"]
    }


def _parse_user_agent(user_agent: str) -> dict:
    """Parse user agent string to extract device, browser, and OS info"""
    if not user_agent:
        return {"device": "Unknown", "browser": "Unknown", "os": "Unknown"}
    
    ua = user_agent.lower()
    
    # Detect OS
    if "windows nt 10" in ua:
        os_name = "Windows 10/11"
    elif "windows" in ua:
        os_name = "Windows"
    elif "macintosh" in ua or "mac os" in ua:
        os_name = "macOS"
    elif "iphone" in ua:
        os_name = "iOS"
    elif "ipad" in ua:
        os_name = "iPadOS"
    elif "android" in ua:
        os_name = "Android"
    elif "linux" in ua:
        os_name = "Linux"
    else:
        os_name = "Unknown OS"
    
    # Detect Browser
    if "edg/" in ua or "edge" in ua:
        browser = "Microsoft Edge"
    elif "chrome" in ua and "safari" in ua:
        browser = "Chrome"
    elif "firefox" in ua:
        browser = "Firefox"
    elif "safari" in ua and "chrome" not in ua:
        browser = "Safari"
    elif "opera" in ua or "opr/" in ua:
        browser = "Opera"
    else:
        browser = "Unknown Browser"
    
    # Detect Device Type
    if "mobile" in ua or "iphone" in ua:
        device = "Mobile"
    elif "tablet" in ua or "ipad" in ua:
        device = "Tablet"
    else:
        device = "Desktop"
    
    return {"device": device, "browser": browser, "os": os_name}


def _format_location(location: dict) -> str:
    """Format location dict to readable string"""
    if not location:
        return "Unknown Location"
    
    city = location.get("city", "")
    region = location.get("region", "")
    country = location.get("country", "")
    
    parts = [p for p in [city, region, country] if p]
    return ", ".join(parts) if parts else "Unknown Location"



# ========== TOTP TWO-FACTOR AUTHENTICATION (Google Authenticator) ==========

@router.get("/2fa/status")
async def get_2fa_status(current_user: dict = Depends(get_current_user)):
    """
    Get 2FA status for current user
    Returns: enabled, setup_pending, recovery_codes_remaining
    """
    status = await totp_service.get_2fa_status(current_user["id"])
    return status


@router.post("/2fa/setup")
async def setup_2fa(current_user: dict = Depends(get_current_user)):
    """
    Start 2FA setup - generates QR code and recovery codes
    User must scan QR in Google Authenticator and verify with a code
    """
    result = await totp_service.setup_2fa(
        user_id=current_user["id"],
        user_email=current_user["email"]
    )
    
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Failed to setup 2FA")
        )
    
    return result


@router.post("/2fa/verify-setup")
async def verify_2fa_setup(
    request: TOTPVerifyRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Verify TOTP code to complete 2FA setup
    Must be called after /2fa/setup with a valid 6-digit code
    """
    # Validate code format
    if not request.code or len(request.code) != 6 or not request.code.isdigit():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid code format. Must be 6 digits."
        )
    
    result = await totp_service.verify_setup(
        user_id=current_user["id"],
        code=request.code
    )
    
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Verification failed")
        )
    
    return result


@router.post("/2fa/verify")
async def verify_2fa_code(
    request: TOTPVerifyRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Verify TOTP code during login or sensitive operations
    Also accepts recovery codes
    """
    result = await totp_service.verify_code(
        user_id=current_user["id"],
        code=request.code
    )
    
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=result.get("error", "Invalid code")
        )
    
    return result


@router.post("/2fa/disable")
async def disable_2fa(
    request: TOTPDisableRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Disable 2FA for current user
    Requires password verification for security
    """
    db = get_database()
    user = await db.users.find_one({"id": current_user["id"]})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify password
    if not verify_password(request.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password"
        )
    
    result = await totp_service.disable_2fa(
        user_id=current_user["id"],
        password_verified=True
    )
    
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Failed to disable 2FA")
        )
    
    return result


@router.post("/2fa/regenerate-recovery")
async def regenerate_recovery_codes(current_user: dict = Depends(get_current_user)):
    """
    Generate new recovery codes (invalidates old ones)
    """
    result = await totp_service.regenerate_recovery_codes(current_user["id"])
    
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Failed to regenerate codes")
        )
    
    return result



# ========== EMERGENT-MANAGED GOOGLE OAUTH ==========

class EmergentAuthRequest(BaseModel):
    """Request from frontend after Emergent OAuth callback"""
    emergent_user: Optional[dict] = None  # Deprecated: backend verifies session_token itself
    device_info: Optional[dict] = None
    session_token: str  # Emergent session token


@router.post("/google/emergent-callback")
async def emergent_google_callback(
    request: EmergentAuthRequest,
    response: Response,
    fastapi_request: Request
):
    """
    Handle Emergent-managed Google OAuth callback.
    Creates/updates user and returns JWT token.
    
    SECURITY: Server-side verification with Emergent API is REQUIRED.
    We NEVER trust client-provided email - always verify session_token.
    """
    import httpx
    
    db = get_database()
    
    try:
        session_token = request.session_token
        device_info = request.device_info or {}
        
        # SECURITY: Require session_token for verification
        if not session_token:
            logger.warning("Google OAuth: Missing session_token")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Session token required for authentication"
            )
        
        # SECURITY: Server-side verification with Emergent API
        # We MUST verify the session_token to get trusted user data
        # NEVER trust client-provided data - always require server verification
        verified_user = None
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                verify_response = await client.get(
                    'https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data',
                    headers={'X-Session-ID': session_token}
                )
                
                if verify_response.status_code == 200:
                    verified_user = verify_response.json()
                    logger.info(f"Google OAuth: Server-verified email: {verified_user.get('email')}")
                elif verify_response.status_code == 404:
                    # SECURITY FIX (SEC-001): 404 means session not found/expired/invalid
                    # This can happen when:
                    # 1. Session was already consumed (legitimate, but we can't verify)
                    # 2. Session never existed (attacker with fake token)
                    # 3. Session expired
                    # In ALL cases, we MUST reject - we cannot trust client-provided data
                    # because an attacker could craft any session_token and provide any email
                    logger.warning(f"Google OAuth: Session {session_token[:8]}... not found (404). Cannot verify - rejecting.")
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Session expired or invalid. Please try logging in again."
                    )
                else:
                    logger.warning(f"Google OAuth: Verification failed with status {verify_response.status_code}")
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid session. Please try logging in again."
                    )
        except httpx.RequestError as e:
            logger.error(f"Google OAuth: Emergent API request failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication service temporarily unavailable. Please try again."
            )
        
        if not verified_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not verify authentication. Please try again."
            )
        
        # Extract user info from VERIFIED response only
        google_email = verified_user.get("email")
        google_name = verified_user.get("name", "")
        google_picture = verified_user.get("picture", "")
        emergent_id = verified_user.get("id")
        
        if not google_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No email in verified user data"
            )
        
        # Log security event
        logger.info(f"Google OAuth: Proceeding with verified email: {google_email}, emergent_id: {emergent_id}")
        
        now = datetime.now(timezone.utc).isoformat()
        is_new_user = False
        
        # Check if user exists by email
        existing_user = await db.users.find_one(
            {"email": google_email},
            {"_id": 0}
        )
        
        if existing_user:
            # Update existing user with Google info
            await db.users.update_one(
                {"email": google_email},
                {
                    "$set": {
                        "google_id": emergent_id,
                        "profile_picture": google_picture or existing_user.get("profile_picture"),
                        "full_name": google_name or existing_user.get("full_name"),
                        "last_login": now,
                        "last_device_info": device_info,
                        "auth_provider": "google_emergent",
                        "updated_at": now
                    }
                }
            )
            user_id = existing_user.get("id")
            roles = existing_user.get("roles", ["customer"])
        else:
            # Create new user
            is_new_user = True
            user_id = str(uuid.uuid4())
            roles = ["customer"]  # Default role for Google sign-up
            
            new_user = {
                "id": user_id,
                "email": google_email,
                "full_name": google_name,
                "profile_picture": google_picture,
                "google_id": emergent_id,
                "auth_provider": "google_emergent",
                "roles": roles,
                "is_active": True,
                "is_verified": True,  # Google email is pre-verified
                "otp_enabled": False,  # No OTP for Google users
                "totp_enabled": False,
                "login_shield_enabled": False,
                "created_at": now,
                "updated_at": now,
                "last_login": now,
                "last_device_info": device_info
            }
            
            await db.users.insert_one(new_user)
        
        # Get final user data
        user = await db.users.find_one(
            {"id": user_id},
            {"_id": 0, "password_hash": 0}
        )
        
        # Create JWT token
        token_data = {
            "sub": user_id,
            "email": google_email,
            "roles": roles
        }
        access_token = create_access_token(token_data)
        
        # Set httpOnly cookie
        set_auth_cookie(response, access_token)
        
        # Store session in database
        await db.user_sessions.insert_one({
            "user_id": user_id,
            "session_token": hash_token(access_token),
            "emergent_session_token": request.session_token,
            "auth_provider": "google_emergent",
            "device_info": device_info,
            "ip_address": fastapi_request.client.host if fastapi_request.client else None,
            "created_at": now,
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        })
        
        # Log audit event
        try:
            audit = AuditLogger(db)
            await audit.log(
                action="google_oauth_login",
                category=AuditLogger.CATEGORY_AUTH,
                user_id=user_id,
                user_email=google_email,
                user_roles=roles,
                details={
                    "email": google_email,
                    "is_new_user": is_new_user,
                    "auth_provider": "google_emergent"
                },
                ip_address=fastapi_request.client.host if fastapi_request.client else None,
                user_agent=fastapi_request.headers.get("User-Agent"),
                status="success"
            )
        except Exception as _audit_err:
            logger.warning(f"Audit log failed for google_oauth_login: {_audit_err}")
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user,
            "is_new_user": is_new_user,
            "message": "Google login successful"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Emergent OAuth error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication failed"
        )


@router.get("/google/settings")
async def get_google_auth_settings():
    """
    Get Google auth settings for frontend.
    Returns whether Google auth is enabled and which method to use.
    """
    return {
        "enabled": True,
        "use_emergent_auth": True,
        "provider": "emergent",
        "features": {
            "auto_login": True,
            "profile_sync": True,
            "otp_bypass": True  # Google users skip OTP
        }
    }



# ========== ROLE SELECTION FOR NEW USERS ==========

class SetRoleRequest(BaseModel):
    """Request to set user role after OAuth signup"""
    role: str  # customer, operator


@router.post("/set-role")
async def set_user_role(
    request: SetRoleRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Set role for new Google sign-up users.
    Only works if user hasn't already selected a role (is_role_selected = false).
    """
    db = get_database()
    
    valid_roles = ["customer", "operator"]
    if request.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {valid_roles}"
        )
    
    user_id = current_user.get("id")
    
    # Check if role already selected
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Allow role change only for new users or if explicitly allowed
    is_role_selected = user.get("is_role_selected", False)
    if is_role_selected and user.get("auth_provider") != "google_emergent":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role already selected. Contact support to change."
        )
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Update user role
    await db.users.update_one(
        {"id": user_id},
        {
            "$set": {
                "roles": [request.role],
                "is_role_selected": True,
                "role_selected_at": now,
                "updated_at": now
            }
        }
    )
    
    # Fetch updated user
    updated_user = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "password_hash": 0}
    )
    
    # Create operator profile if selected operator role
    if request.role == "operator":
        existing_operator = await db.operators.find_one({"user_id": user_id})
        if not existing_operator:
            await db.operators.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "email": user.get("email"),
                "company_name": user.get("full_name", "") + "'s Aviation",
                "status": "pending_verification",
                "created_at": now,
                "updated_at": now
            })
    
    # Log audit event
    await AuditLogger.log(
        db=db,
        action="role_selected",
        user_id=user_id,
        resource_type="user",
        details={
            "role": request.role,
            "auth_provider": user.get("auth_provider", "email")
        }
    )
    
    return {
        "success": True,
        "user": updated_user,
        "message": f"Role set to {request.role}",
        "redirect": f"/{request.role}" if request.role == "operator" else "/customer"
    }


@router.get("/check-role-selection")
async def check_role_selection(current_user: dict = Depends(get_current_user)):
    """
    Check if user needs to select a role (for new Google sign-ups)
    """
    db = get_database()
    
    user = await db.users.find_one(
        {"id": current_user.get("id")},
        {"_id": 0, "password_hash": 0}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    is_google_user = user.get("auth_provider") == "google_emergent"
    is_role_selected = user.get("is_role_selected", False)
    
    return {
        "needs_role_selection": is_google_user and not is_role_selected,
        "current_roles": user.get("roles", []),
        "is_role_selected": is_role_selected,
        "auth_provider": user.get("auth_provider")
    }



# ========== QUICK ADMIN LOGIN (DEV/TEST ONLY) ==========

class QuickAdminRequest(BaseModel):
    secret_key: str  # Must match QUICK_LOGIN_SECRET from env
    user_email: Optional[str] = None  # Optional: specify which admin

# Quick login secret - MUST be explicitly set in env, no default fallback
# Set QUICK_LOGIN_ENABLED=true AND QUICK_LOGIN_SECRET in .env to enable
QUICK_LOGIN_SECRET = os.environ.get("QUICK_LOGIN_SECRET")  # No default - must be set
QUICK_LOGIN_ENABLED = os.environ.get("QUICK_LOGIN_ENABLED", "false").lower() == "true"  # Default: DISABLED


@router.post("/dev/quick-admin-token")
async def get_quick_admin_token(request: QuickAdminRequest):
    """
    🔒 DEV ONLY: Generate admin token without OTP/TOTP verification
    
    SECURITY: 
    - DISABLED BY DEFAULT (QUICK_LOGIN_ENABLED must be explicitly set to "true")
    - Requires QUICK_LOGIN_SECRET to be explicitly set in environment (no hardcoded default)
    - MUST be disabled in production
    
    To enable (DEV ONLY):
    1. Set QUICK_LOGIN_ENABLED=true in backend/.env
    2. Set QUICK_LOGIN_SECRET=<your-secure-random-secret> in backend/.env
    """
    # SECURITY: Check if quick login is enabled (default: DISABLED)
    if not QUICK_LOGIN_ENABLED:
        raise HTTPException(
            status_code=403, 
            detail="Quick admin login is DISABLED. This endpoint is for development only."
        )
    
    # SECURITY: Secret must be explicitly configured (no hardcoded default)
    if not QUICK_LOGIN_SECRET:
        raise HTTPException(
            status_code=403,
            detail="QUICK_LOGIN_SECRET not configured. Set it in environment variables."
        )
    
    # Verify secret key
    if not hmac.compare_digest(request.secret_key, QUICK_LOGIN_SECRET):
        raise HTTPException(
            status_code=401,
            detail="Invalid secret key"
        )
    
    db = get_database()
    
    # Find admin user
    if request.user_email:
        user = await db.users.find_one(
            {"email": request.user_email, "roles": {"$in": ["admin", "super_admin"]}},
            {"_id": 0, "password_hash": 0}
        )
    else:
        # Find any super_admin first, then admin
        user = await db.users.find_one(
            {"roles": "super_admin"},
            {"_id": 0, "password_hash": 0}
        )
        if not user:
            user = await db.users.find_one(
                {"roles": "admin"},
                {"_id": 0, "password_hash": 0}
            )
    
    if not user:
        raise HTTPException(
            status_code=404,
            detail="No admin user found in database"
        )
    
    # Generate token (no 2FA check)
    token_data = {
        "sub": user["id"],
        "roles": user.get("roles", ["admin"]),
        "email": user.get("email"),
        "quick_login": True  # Flag to identify quick login tokens
    }
    
    access_token = create_access_token(data=token_data)
    
    # Log this action for audit (simplified for dev endpoint)
    try:
        from security_middleware import AuditLogger
        audit_logger = AuditLogger()
        await audit_logger.log(
            action="quick_admin_login",
            category="authentication",
            user_id=user["id"],
            user_email=user.get("email"),
            resource_type="auth",
            details={
                "method": "dev_bypass",
                "warning": "DEV ONLY - should be disabled in production"
            },
            ip_address="dev-bypass",
            status="success",
            risk_level="medium"
        )
    except Exception as e:
        # Don't fail if audit logging fails
        print(f"Audit log warning: {e}")
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user.get("email"),
            "name": user.get("full_name"),
            "roles": user.get("roles", [])
        },
        "message": "🔓 Quick admin token generated (DEV ONLY)",
        "message_hi": "🔓 त्वरित एडमिन टोकन जनरेट हुआ (केवल DEV के लिए)",
        "warning": "This endpoint should be disabled in production!",
        "expires_in": "24 hours"
    }


@router.get("/dev/quick-admin-token")
async def get_quick_admin_token_info():
    """
    Info endpoint to check if quick admin login is available
    """
    return {
        "enabled": QUICK_LOGIN_ENABLED,
        "endpoint": "/api/auth/dev/quick-admin-token",
        "method": "POST",
        "required_body": {
            "secret_key": "string (must match QUICK_LOGIN_SECRET env var)",
            "user_email": "string (optional - specify admin email)"
        },
        "note": "This is a development-only feature for testing admin UI without OTP",
        "note_hi": "यह केवल विकास के लिए है - OTP के बिना एडमिन UI टेस्ट करने के लिए"
    }



# ========== PRODUCTION SEED ENDPOINT ==========
# SECURITY: This endpoint is DISABLED in production
# Only enabled when ENABLE_SEED_ENDPOINT=true in .env

SEED_ENDPOINT_ENABLED = os.environ.get("ENABLE_SEED_ENDPOINT", "false").lower() == "true"

class SeedRequest(BaseModel):
    """Request to seed production accounts"""
    secret_key: str
    
# Secret key MUST be set in environment - no default
SEED_SECRET = os.environ.get("SEED_SECRET_KEY", "")

@router.post("/seed-production-accounts")
async def seed_production_accounts(
    request: SeedRequest,
    db=Depends(get_database)
):
    """
    One-time endpoint to seed test accounts in production.
    SECURITY: Disabled by default. Enable via ENABLE_SEED_ENDPOINT=true
    
    NOTE: Passwords are randomly generated - check response or logs for credentials
    """
    import secrets
    import string
    
    # SECURITY CHECK 1: Endpoint must be explicitly enabled
    if not SEED_ENDPOINT_ENABLED:
        raise HTTPException(
            status_code=403, 
            detail="Seed endpoint is disabled in production. Set ENABLE_SEED_ENDPOINT=true to enable."
        )
    
    # SECURITY CHECK 2: Secret key must be configured (no default)
    if not SEED_SECRET:
        raise HTTPException(
            status_code=500, 
            detail="SEED_SECRET_KEY environment variable not configured"
        )
    
    # SECURITY CHECK 3: Validate secret key
    if request.secret_key != SEED_SECRET:
        raise HTTPException(status_code=403, detail="Invalid seed secret key")
    
    # Check if already seeded
    existing_admin = await db.users.find_one({"email": "admin@airyatra.co.in"})
    if existing_admin:
        return {
            "success": False,
            "message": "Production already seeded! Admin account exists.",
            "message_hi": "प्रोडक्शन पहले से सीड है! एडमिन अकाउंट मौजूद है।"
        }
    
    def generate_secure_password(length=16):
        """Generate a cryptographically secure random password"""
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        return ''.join(secrets.choice(alphabet) for _ in range(length))
    
    # Generate random passwords for each account (NOT hardcoded)
    account_configs = [
        {"email": "ceo@airyatra.co.in", "full_name": "CEO User", "roles": ["ceo", "admin", "super_admin"]},
        {"email": "admin@airyatra.co.in", "full_name": "System Admin", "roles": ["admin", "super_admin"]},
        {"email": "hr@airyatra.co.in", "full_name": "HR Manager", "roles": ["hr", "admin"]},
        {"email": "sales@airyatra.co.in", "full_name": "Sales Manager", "roles": ["sales", "admin"]},
        {"email": "finance@airyatra.co.in", "full_name": "Finance Manager", "roles": ["finance", "admin"]},
        {"email": "operator@airyatra.co.in", "full_name": "Operator", "roles": ["operator"]},
        {"email": "pilot@airyatra.co.in", "full_name": "Pilot", "roles": ["pilot"]},
        {"email": "customer@airyatra.co.in", "full_name": "Demo Customer", "roles": ["customer"]},
        {"email": "employee@airyatra.co.in", "full_name": "Employee", "roles": ["employee"]},
    ]
    
    created_users = []
    credentials_log = []
    
    for config in account_configs:
        try:
            user_id = str(uuid.uuid4())
            # Generate unique random password for each user
            random_password = generate_secure_password()
            password_hash = get_password_hash(random_password)
            
            user_doc = {
                "id": user_id,
                "email": config["email"],
                "password_hash": password_hash,
                "full_name": config["full_name"],
                "roles": config["roles"],
                "is_active": True,
                "is_verified": True,
                "phone": "+919999999999",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "login_shield_enabled": False,
                "two_factor_enabled": False,
                "failed_login_attempts": 0
            }
            
            if "pilot" in config["roles"]:
                user_doc["pilot_license"] = "CPL-2024-0001"
                user_doc["pilot_status"] = "active"
            
            await db.users.insert_one(user_doc)
            created_users.append({"email": config["email"], "roles": config["roles"]})
            credentials_log.append({"email": config["email"], "password": random_password, "roles": config["roles"]})
            
            # Log for admin reference (should be captured securely)
            logger.info(f"[SEED] Created user: {config['email']}")
            
        except Exception as e:
            logger.error(f"Error creating {config['email']}: {e}")
    
    return {
        "success": True,
        "message": f"Production seeded! Created {len(created_users)} accounts with random passwords.",
        "message_hi": f"प्रोडक्शन सीड हो गया! {len(created_users)} अकाउंट रैंडम पासवर्ड के साथ बनाए गए।",
        "accounts_created": created_users,
        "credentials": credentials_log,  # One-time display - save these!
        "warning": "SAVE THESE CREDENTIALS NOW! They will not be shown again."
    }




# ========== FORGOT PASSWORD FEATURE ==========

class ForgotPasswordRequest(BaseModel):
    """Request to initiate password reset via Email or Phone"""
    identifier: str  # Can be email or phone number
    method: str = "email"  # "email" or "phone"


class ForgotPasswordVerifyOTP(BaseModel):
    """Request to verify OTP for password reset"""
    identifier: str
    otp_code: str
    method: str = "email"


class ForgotPasswordReset(BaseModel):
    """Request to set new password after OTP verification"""
    identifier: str
    otp_code: Optional[str] = None
    reset_token: Optional[str] = None
    new_password: str
    method: str = "email"


@router.post("/forgot-password/send-otp")
@limiter.limit("5/minute")
async def forgot_password_send_otp(request: Request, data: ForgotPasswordRequest):
    """
    Step 1: Send OTP to email or phone for password reset
    
    Usage:
    POST /api/auth/forgot-password/send-otp
    {"identifier": "user@example.com", "method": "email"}
    OR
    {"identifier": "+919999999999", "method": "phone"}
    """
    db = get_database()
    ip_address = request.client.host if request.client else "unknown"
    
    # Determine if it's email or phone
    is_email = data.method == "email" or "@" in data.identifier
    
    if is_email:
        # Find user by email
        user = await db.users.find_one({"email": data.identifier}, {"_id": 0})
        if not user:
            # Security: Don't reveal if email exists
            return {
                "success": True,
                "message": "If an account exists with this email, OTP has been sent.",
                "method": "email"
            }
        
        # Generate OTP for password reset
        otp_code, otp_result = await otp_service.create_otp(
            user_id=user["id"],
            email=user["email"],
            purpose="password_reset",
            ip_address=ip_address,
            user_agent=request.headers.get("User-Agent", "")
        )
        
        if otp_code is None:
            return {
                "success": False,
                "cooldown": True,
                "message": otp_result.get("message", "Please wait before requesting another OTP"),
                "remaining_seconds": otp_result.get("remaining_seconds", 60)
            }
        
        # Send OTP email
        try:
            await email_service.send_password_reset_otp(
                to_email=user["email"],
                user_name=user.get("full_name", user["email"].split("@")[0]),
                otp_code=otp_code,
                expiry_minutes=5,
                ip_address=ip_address
            )
        except Exception as e:
            logger.error(f"Failed to send password reset email: {e}")
            # Still return success to prevent enumeration
        
        return {
            "success": True,
            "message": f"OTP sent to {data.identifier[:3]}***@{data.identifier.split('@')[1]}",
            "method": "email",
            "expires_in_minutes": 5
        }
    
    else:
        # Phone OTP
        from services.sms_otp_service import sms_otp_service
        
        # Find user by phone
        phone = data.identifier
        user = await db.users.find_one({"phone": phone}, {"_id": 0})
        
        if not user:
            # Security: Don't reveal if phone exists
            return {
                "success": True,
                "message": "If an account exists with this phone, OTP has been sent.",
                "method": "phone"
            }
        
        # Send SMS OTP
        result = await sms_otp_service.send_otp(phone, purpose="password_reset")
        
        if not result.get("success"):
            return {
                "success": False,
                "message": result.get("error", "Failed to send OTP"),
                "method": "phone"
            }
        
        return {
            "success": True,
            "message": f"OTP sent to {phone[:4]}****{phone[-4:]}",
            "method": "phone",
            "expires_in_minutes": 5
        }


@router.post("/forgot-password/verify-otp")
@limiter.limit("10/minute")
async def forgot_password_verify_otp(request: Request, data: ForgotPasswordVerifyOTP):
    """
    Step 2: Verify OTP for password reset
    Returns a reset_token if valid
    
    Usage:
    POST /api/auth/forgot-password/verify-otp
    {"identifier": "user@example.com", "otp_code": "123456", "method": "email"}
    """
    db = get_database()
    
    is_email = data.method == "email" or "@" in data.identifier
    
    if is_email:
        user = await db.users.find_one({"email": data.identifier}, {"_id": 0})
    else:
        user = await db.users.find_one({"phone": data.identifier}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid request")
    
    # Verify OTP
    if is_email:
        is_valid, result = await otp_service.verify_otp(
            user_id=user["id"],
            otp_code=data.otp_code,
            purpose="password_reset"
        )
    else:
        from services.sms_otp_service import sms_otp_service
        verify_result = await sms_otp_service.verify_otp(data.identifier, data.otp_code)
        is_valid = verify_result.get("success") and verify_result.get("valid")
        result = verify_result
    
    if not is_valid:
        raise HTTPException(
            status_code=401,
            detail=result.get("message", "Invalid or expired OTP")
        )
    
    # Generate a temporary reset token (valid for 10 minutes)
    reset_token = create_access_token(
        data={"sub": user["id"], "purpose": "password_reset", "identifier": data.identifier},
        expires_delta=timedelta(minutes=10)
    )
    
    return {
        "success": True,
        "message": "OTP verified. You can now reset your password.",
        "reset_token": reset_token,
        "expires_in_minutes": 10
    }


@router.post("/forgot-password/reset")
@limiter.limit("5/minute")
async def forgot_password_reset(request: Request, data: ForgotPasswordReset):
    """
    Step 3: Set new password after OTP verification
    
    Usage:
    POST /api/auth/forgot-password/reset
    {"identifier": "user@example.com", "otp_code": "123456", "new_password": "NewPass@123", "method": "email"}
    """
    from auth import decode_token
    
    db = get_database()
    ip_address = request.client.host if request.client else "unknown"
    
    # Validate new password
    if len(data.new_password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters"
        )
    
    is_email = data.method == "email" or "@" in data.identifier
    
    # Find user
    if is_email:
        user = await db.users.find_one({"email": data.identifier}, {"_id": 0})
    else:
        user = await db.users.find_one({"phone": data.identifier}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid request")
    
    # Preferred path: validate the reset_token issued at OTP-verify step
    # (the OTP is single-use and already consumed by /verify-otp)
    is_valid = False
    if data.reset_token:
        payload = decode_token(data.reset_token)
        is_valid = bool(
            payload
            and payload.get("purpose") == "password_reset"
            and payload.get("sub") == user["id"]
            and payload.get("identifier") == data.identifier
        )
        if not is_valid:
            raise HTTPException(
                status_code=401,
                detail="Reset session expired. Please request a new OTP."
            )
    elif data.otp_code:
        # Fallback: direct OTP verification (for API clients skipping verify step)
        if is_email:
            is_valid, result = await otp_service.verify_otp(
                user_id=user["id"],
                otp_code=data.otp_code,
                purpose="password_reset"
            )
        else:
            from services.sms_otp_service import sms_otp_service
            verify_result = await sms_otp_service.verify_otp(data.identifier, data.otp_code)
            is_valid = verify_result.get("success") and verify_result.get("valid")
    
    if not is_valid:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired OTP. Please request a new one."
        )
    
    # Update password
    new_password_hash = get_password_hash(data.new_password)
    now = datetime.now(timezone.utc).isoformat()
    
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "password_hash": new_password_hash,
            "updated_at": now,
            "password_changed_at": now
        }}
    )
    
    # Invalidate all existing sessions for security
    await db.user_sessions.update_many(
        {"user_id": user["id"], "is_active": True},
        {"$set": {
            "is_active": False,
            "revoked_at": datetime.now(timezone.utc),
            "revoke_reason": "password_reset"
        }}
    )
    
    # Send confirmation email
    try:
        if user.get("email"):
            await email_service.send_password_changed_confirmation(
                to_email=user["email"],
                user_name=user.get("full_name", "User"),
                ip_address=ip_address
            )
    except Exception as e:
        logger.error(f"Failed to send password change confirmation: {e}")
    
    # Audit log
    try:
        audit = AuditLogger(db)
        await audit.log(
            action="password_reset",
            category=AuditLogger.CATEGORY_AUTH,
            user_id=user["id"],
            user_email=user.get("email"),
            details={"method": data.method},
            ip_address=ip_address,
            user_agent=request.headers.get("User-Agent"),
            status="success",
            risk_level="medium"
        )
    except Exception:
        pass
    
    return {
        "success": True,
        "message": "Password reset successful. Please login with your new password.",
        "message_hi": "पासवर्ड रीसेट सफल। कृपया अपने नए पासवर्ड से लॉगिन करें।"
    }
