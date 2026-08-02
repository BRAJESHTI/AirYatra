from fastapi import APIRouter, HTTPException, Depends, status, Request
from database import get_database
from models import UserCreate, UserLogin, Token, User
from auth import verify_password, get_password_hash, create_access_token
from middleware import get_current_user, hash_token
from security_middleware import limiter, RATE_LIMITS, AuditLogger
from services.otp_service import otp_service, hash_device_fingerprint
from services.email_service import EmailService
from services.login_shield_service import login_shield
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["Authentication"])
email_service = EmailService()


class OTPRequest(BaseModel):
    email: str
    password: str
    trust_device: Optional[bool] = False


class OTPVerify(BaseModel):
    email: str
    otp_code: str
    trust_device: Optional[bool] = False

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
    user_dict["created_at"] = datetime.utcnow().isoformat()
    user_dict["updated_at"] = datetime.utcnow().isoformat()
    
    # SECURITY FIX: Force role to "customer" for self-registration
    # Admin/operator/pilot roles can only be assigned via admin-authenticated endpoint
    user_dict["roles"] = ["customer"]
    
    # Create a copy for insertion to avoid MongoDB adding _id to original dict
    insert_dict = user_dict.copy()
    await db.users.insert_one(insert_dict)
    
    # Welcome bonus: 500 loyalty points for new customers
    if "customer" in user_dict.get("roles", []):
        try:
            now_iso = datetime.utcnow().isoformat()
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

@router.post("/login")
@limiter.limit(RATE_LIMITS["login"])
async def login(request: Request, credentials: UserLogin):
    """
    Login user - Step 1: Validate credentials
    If OTP required, returns otp_required=True
    If device trusted or OTP disabled, returns token directly
    """
    db = get_database()
    
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    
    # Audit logging for failed attempts
    if not user or not verify_password(credentials.password, user["password_hash"]):
        # Log failed login attempt
        try:
            audit = AuditLogger(db)
            await audit.log(
                action=AuditLogger.ACTION_LOGIN_FAILED,
                category=AuditLogger.CATEGORY_AUTH,
                user_email=credentials.email,
                details={"reason": "invalid_credentials"},
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("User-Agent"),
                status="failure",
                risk_level="medium"
            )
        except Exception:
            pass
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
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
    
    requires_otp, reason = await otp_service.should_require_otp(
        user_id=user["id"],
        user_agent=user_agent,
        ip_address=ip_address,
        user_data=user
    )
    
    # Force OTP if risk level demands it
    if force_otp_by_risk and not requires_otp:
        requires_otp = True
        reason = f"risk_level_{risk_assessment['level'].lower()}"
    
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
    
    update_data["updated_at"] = datetime.utcnow().isoformat()
    
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
