from fastapi import APIRouter, HTTPException, Depends, status, Request
from database import get_database
from models import UserCreate, UserLogin, Token, User
from auth import verify_password, get_password_hash, create_access_token
from middleware import get_current_user, hash_token
from security_middleware import limiter, RATE_LIMITS, AuditLogger
import uuid
from datetime import datetime, timezone, timedelta

router = APIRouter(prefix="/auth", tags=["Authentication"])

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

@router.post("/login", response_model=Token)
@limiter.limit(RATE_LIMITS["login"])
async def login(request: Request, credentials: UserLogin):
    """Login user (Rate limited: 5/minute per IP to prevent brute force)"""
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
    
    access_token = create_access_token(data={"sub": user["id"], "roles": user["roles"]})
    
    # Create session record
    try:
        token_hash = hash_token(access_token)
        await db.user_sessions.insert_one({
            "user_id": user["id"],
            "token_hash": token_hash,
            "ip_address": request.client.host if request.client else None,
            "user_agent": request.headers.get("User-Agent", "")[:200],
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
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("User-Agent"),
            status="success"
        )
    except Exception:
        pass
    
    user_response = {k: v for k, v in user.items() if k != "password_hash"}
    
    return Token(access_token=access_token, user=user_response)

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
async def get_user_sessions(current_user: dict = Depends(get_current_user)):
    """Get all active sessions for current user"""
    db = get_database()
    
    sessions = await db.user_sessions.find(
        {"user_id": current_user["id"], "is_active": True},
        {"_id": 0, "token_hash": 0}  # Don't expose token hashes
    ).sort("last_activity", -1).to_list(20)
    
    current_token_hash = current_user.get("_current_token_hash")
    
    # Mark current session
    for session in sessions:
        session["is_current"] = False
    
    return {"sessions": sessions, "total": len(sessions)}