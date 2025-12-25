"""
Google OAuth Authentication Service
Customer signup/login via Gmail with profile auto-fetch
"""
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import RedirectResponse
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import httpx
import os
from datetime import datetime, timezone
from uuid import uuid4
from database import get_database
from auth import create_access_token
import logging
import json

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth/google", tags=["Google OAuth"])

# Google OAuth Configuration
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", "")

# For Emergent managed Google Auth - use callback URL from Emergent
EMERGENT_GOOGLE_AUTH_URL = "https://auth.emergentagent.com/google"
EMERGENT_CALLBACK_URL = os.environ.get("EMERGENT_CALLBACK_URL", "")


@router.get("/settings")
async def get_google_auth_settings():
    """Get Google Auth settings for frontend"""
    db = get_database()
    settings = await db.settings.find_one({"type": "google_auth"}, {"_id": 0})
    
    if not settings:
        return {"enabled": True, "use_emergent_auth": True}
    
    return {
        "enabled": settings.get("enabled", True),
        "use_emergent_auth": settings.get("use_emergent_auth", True)
    }


@router.get("/login")
async def google_login(request: Request):
    """
    Initiate Google OAuth login
    Customer ko Google login page pe redirect karega
    """
    db = get_database()
    
    # Check if Emergent Google Auth is configured
    settings = await db.settings.find_one({"type": "google_auth"}, {"_id": 0})
    
    if settings and settings.get("use_emergent_auth"):
        # Use Emergent managed Google Auth
        callback_url = f"{request.base_url}api/auth/google/callback"
        return RedirectResponse(
            f"{EMERGENT_GOOGLE_AUTH_URL}?callback={callback_url}"
        )
    
    # Standard Google OAuth
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")
    
    google_auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={GOOGLE_CLIENT_ID}&"
        f"redirect_uri={GOOGLE_REDIRECT_URI}&"
        "response_type=code&"
        "scope=openid%20email%20profile%20https://www.googleapis.com/auth/user.birthday.read%20https://www.googleapis.com/auth/user.phonenumbers.read&"
        "access_type=offline&"
        "prompt=consent"
    )
    
    return RedirectResponse(google_auth_url)

@router.get("/callback")
async def google_callback(
    request: Request,
    code: str = None,
    token: str = None,
    error: str = None
):
    """
    Google OAuth callback
    Google se user data receive karke profile create karega
    """
    if error:
        raise HTTPException(status_code=400, detail=f"Google auth error: {error}")
    
    db = get_database()
    
    # Extract device information from request
    device_info = extract_device_info(request)
    
    try:
        if token:
            # Emergent managed auth - token directly provided
            user_data = await verify_emergent_token(token)
        elif code:
            # Standard OAuth - exchange code for token
            user_data = await exchange_code_for_user_data(code)
        else:
            raise HTTPException(status_code=400, detail="No code or token provided")
        
        # Check if user exists
        existing_user = await db.users.find_one(
            {"email": user_data["email"]},
            {"_id": 0}
        )
        
        if existing_user:
            # Update existing user with latest Google data and device info
            update_data = {
                "google_profile_picture": user_data.get("picture"),
                "last_login_at": datetime.now(timezone.utc).isoformat(),
                "last_device_info": device_info,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Add to login history
            await db.users.update_one(
                {"id": existing_user["id"]},
                {
                    "$set": update_data,
                    "$push": {
                        "login_history": {
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            "device_info": device_info,
                            "login_type": "google"
                        }
                    }
                }
            )
            
            user = existing_user
            is_new_user = False
        else:
            # Create new user with Google data
            user_id = str(uuid4())
            
            user = {
                "id": user_id,
                "email": user_data["email"],
                "full_name": user_data.get("name", ""),
                "first_name": user_data.get("given_name", ""),
                "last_name": user_data.get("family_name", ""),
                "google_id": user_data.get("sub"),
                "google_profile_picture": user_data.get("picture"),
                "profile_picture": user_data.get("picture"),  # Use Google picture as default
                "date_of_birth": user_data.get("birthday"),
                "phone": user_data.get("phone_number"),
                "alternate_phone": user_data.get("alternate_phone"),
                "email_verified": user_data.get("email_verified", True),
                "auth_provider": "google",
                "roles": ["customer"],
                "status": "active",
                "device_info": device_info,
                "last_device_info": device_info,
                "login_history": [{
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "device_info": device_info,
                    "login_type": "google_signup"
                }],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.users.insert_one(user.copy())
            is_new_user = True
        
        # Create access token
        access_token = create_access_token({
            "sub": user["id"],
            "email": user["email"],
            "roles": user.get("roles", ["customer"])
        })
        
        # Redirect to frontend with token
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
        redirect_url = f"{frontend_url}/auth/google/success?token={access_token}&is_new={is_new_user}"
        
        return RedirectResponse(redirect_url)
        
    except Exception as e:
        logger.error(f"Google auth callback error: {e}")
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
        return RedirectResponse(f"{frontend_url}/auth/google/error?message={str(e)}")

@router.post("/verify-token")
async def verify_google_token(data: dict, request: Request):
    """
    Verify Google ID token from frontend
    Frontend se direct Google token verify karega
    """
    id_token_str = data.get("id_token")
    if not id_token_str:
        raise HTTPException(status_code=400, detail="ID token required")
    
    db = get_database()
    device_info = extract_device_info(request)
    
    # Add frontend-provided device info if available
    if data.get("device_info"):
        device_info.update(data["device_info"])
    
    try:
        # Verify Google ID token
        settings = await db.settings.find_one({"type": "google_auth"}, {"_id": 0})
        client_id = settings.get("client_id") if settings else GOOGLE_CLIENT_ID
        
        if not client_id:
            raise HTTPException(status_code=500, detail="Google OAuth not configured")
        
        idinfo = id_token.verify_oauth2_token(
            id_token_str,
            google_requests.Request(),
            client_id
        )
        
        email = idinfo.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="Email not found in token")
        
        # Check if user exists
        existing_user = await db.users.find_one({"email": email}, {"_id": 0})
        
        if existing_user:
            # Update user
            await db.users.update_one(
                {"id": existing_user["id"]},
                {
                    "$set": {
                        "google_profile_picture": idinfo.get("picture"),
                        "last_login_at": datetime.now(timezone.utc).isoformat(),
                        "last_device_info": device_info
                    },
                    "$push": {
                        "login_history": {
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            "device_info": device_info,
                            "login_type": "google"
                        }
                    }
                }
            )
            user = existing_user
            is_new_user = False
        else:
            # Create new user
            user_id = str(uuid4())
            user = {
                "id": user_id,
                "email": email,
                "full_name": idinfo.get("name", ""),
                "first_name": idinfo.get("given_name", ""),
                "last_name": idinfo.get("family_name", ""),
                "google_id": idinfo.get("sub"),
                "google_profile_picture": idinfo.get("picture"),
                "profile_picture": idinfo.get("picture"),
                "email_verified": idinfo.get("email_verified", True),
                "auth_provider": "google",
                "roles": ["customer"],
                "status": "active",
                "device_info": device_info,
                "last_device_info": device_info,
                "login_history": [{
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "device_info": device_info,
                    "login_type": "google_signup"
                }],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(user.copy())
            is_new_user = True
        
        # Create access token
        access_token = create_access_token({
            "sub": user["id"],
            "email": user["email"],
            "roles": user.get("roles", ["customer"])
        })
        
        # Remove sensitive fields
        safe_user = {k: v for k, v in user.items() if k not in ["password", "hashed_password", "_id"]}
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": safe_user,
            "is_new_user": is_new_user,
            "device_info": device_info
        }
        
    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

def extract_device_info(request: Request) -> dict:
    """
    Extract device information from request headers
    Mobile device ka pura details nikal ke dega
    """
    user_agent = request.headers.get("User-Agent", "")
    
    device_info = {
        "user_agent": user_agent,
        "ip_address": request.client.host if request.client else None,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    # Parse User-Agent for device details
    ua_lower = user_agent.lower()
    
    # Detect OS
    if "android" in ua_lower:
        device_info["os"] = "Android"
        # Try to extract Android version
        import re
        android_match = re.search(r'android\s*([\d.]+)', ua_lower)
        if android_match:
            device_info["os_version"] = android_match.group(1)
    elif "iphone" in ua_lower or "ipad" in ua_lower:
        device_info["os"] = "iOS"
        ios_match = re.search(r'os\s*([\d_]+)', ua_lower)
        if ios_match:
            device_info["os_version"] = ios_match.group(1).replace('_', '.')
    elif "windows" in ua_lower:
        device_info["os"] = "Windows"
    elif "mac" in ua_lower:
        device_info["os"] = "macOS"
    elif "linux" in ua_lower:
        device_info["os"] = "Linux"
    else:
        device_info["os"] = "Unknown"
    
    # Detect device type
    if "mobile" in ua_lower or "android" in ua_lower or "iphone" in ua_lower:
        device_info["device_type"] = "Mobile"
    elif "tablet" in ua_lower or "ipad" in ua_lower:
        device_info["device_type"] = "Tablet"
    else:
        device_info["device_type"] = "Desktop"
    
    # Detect browser
    if "chrome" in ua_lower and "edg" not in ua_lower:
        device_info["browser"] = "Chrome"
    elif "firefox" in ua_lower:
        device_info["browser"] = "Firefox"
    elif "safari" in ua_lower and "chrome" not in ua_lower:
        device_info["browser"] = "Safari"
    elif "edg" in ua_lower:
        device_info["browser"] = "Edge"
    elif "opera" in ua_lower:
        device_info["browser"] = "Opera"
    else:
        device_info["browser"] = "Unknown"
    
    # Try to extract device model (for mobile)
    import re
    
    # Android device model
    android_model = re.search(r'\(.*?;\s*([^;)]+)\s*build', ua_lower)
    if android_model:
        device_info["device_model"] = android_model.group(1).strip().title()
    
    # Samsung devices
    samsung_match = re.search(r'(sm-[a-z0-9]+)', ua_lower)
    if samsung_match:
        device_info["device_model"] = f"Samsung {samsung_match.group(1).upper()}"
        device_info["manufacturer"] = "Samsung"
    
    # iPhone models
    if "iphone" in ua_lower:
        device_info["device_model"] = "iPhone"
        device_info["manufacturer"] = "Apple"
    elif "ipad" in ua_lower:
        device_info["device_model"] = "iPad"
        device_info["manufacturer"] = "Apple"
    
    # Xiaomi devices
    if "mi " in ua_lower or "redmi" in ua_lower or "poco" in ua_lower:
        device_info["manufacturer"] = "Xiaomi"
        xiaomi_match = re.search(r'(mi\s*\w+|redmi\s*\w+|poco\s*\w+)', ua_lower)
        if xiaomi_match:
            device_info["device_model"] = xiaomi_match.group(1).title()
    
    # OnePlus devices
    if "oneplus" in ua_lower:
        device_info["manufacturer"] = "OnePlus"
        oneplus_match = re.search(r'(oneplus\s*\w+)', ua_lower)
        if oneplus_match:
            device_info["device_model"] = oneplus_match.group(1).title()
    
    # Oppo/Vivo/Realme
    for brand in ["oppo", "vivo", "realme"]:
        if brand in ua_lower:
            device_info["manufacturer"] = brand.title()
    
    return device_info

async def exchange_code_for_user_data(code: str) -> dict:
    """Exchange authorization code for user data"""
    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code"
            }
        )
        
        if token_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange code for token")
        
        tokens = token_response.json()
        access_token = tokens.get("access_token")
        
        # Get user info
        userinfo_response = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        if userinfo_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to get user info")
        
        user_data = userinfo_response.json()
        
        # Try to get additional data (birthday, phone) - requires additional scopes
        try:
            people_response = await client.get(
                "https://people.googleapis.com/v1/people/me?personFields=birthdays,phoneNumbers",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            if people_response.status_code == 200:
                people_data = people_response.json()
                
                # Extract birthday
                birthdays = people_data.get("birthdays", [])
                if birthdays:
                    for bday in birthdays:
                        date = bday.get("date", {})
                        if date.get("year"):
                            user_data["birthday"] = f"{date.get('year')}-{date.get('month', 1):02d}-{date.get('day', 1):02d}"
                            break
                
                # Extract phone numbers
                phone_numbers = people_data.get("phoneNumbers", [])
                if phone_numbers:
                    user_data["phone_number"] = phone_numbers[0].get("value")
                    if len(phone_numbers) > 1:
                        user_data["alternate_phone"] = phone_numbers[1].get("value")
        except:
            pass  # Additional data is optional
        
        return user_data

async def verify_emergent_token(token: str) -> dict:
    """Verify Emergent managed Google auth token"""
    # Emergent auth returns user data directly
    # Token is base64 encoded user data
    import base64
    try:
        decoded = base64.b64decode(token).decode('utf-8')
        return json.loads(decoded)
    except:
        raise HTTPException(status_code=401, detail="Invalid Emergent auth token")

@router.get("/settings")
async def get_google_auth_settings(request: Request):
    """Get Google Auth settings for frontend"""
    db = get_database()
    
    settings = await db.settings.find_one({"type": "google_auth"}, {"_id": 0})
    
    if not settings:
        # Return default settings - Emergent Auth is always enabled
        return {
            "enabled": True,
            "client_id": GOOGLE_CLIENT_ID,
            "use_emergent_auth": True
        }
    
    return {
        "enabled": settings.get("enabled", True),
        "client_id": settings.get("client_id", GOOGLE_CLIENT_ID),
        "use_emergent_auth": settings.get("use_emergent_auth", True)
    }

@router.post("/emergent-callback")
async def emergent_auth_callback(request: Request, data: dict):
    """
    Handle Emergent managed Google Auth callback
    Frontend se Emergent user data receive karke user create/login karega
    """
    db = get_database()
    
    emergent_user = data.get("emergent_user", {})
    device_info = data.get("device_info", {})
    session_token = data.get("session_token")
    
    if not emergent_user or not emergent_user.get("email"):
        raise HTTPException(status_code=400, detail="Invalid user data")
    
    # Merge device info from request with frontend-provided info
    server_device_info = extract_device_info(request)
    device_info = {**server_device_info, **device_info}
    
    try:
        email = emergent_user["email"]
        
        # Check if user exists
        existing_user = await db.users.find_one({"email": email}, {"_id": 0})
        
        if existing_user:
            # Update existing user
            update_data = {
                "google_profile_picture": emergent_user.get("picture"),
                "profile_picture": emergent_user.get("picture"),
                "last_login_at": datetime.now(timezone.utc).isoformat(),
                "last_device_info": device_info,
                "emergent_session_token": session_token,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.users.update_one(
                {"id": existing_user["id"]},
                {
                    "$set": update_data,
                    "$push": {
                        "login_history": {
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            "device_info": device_info,
                            "login_type": "emergent_google"
                        }
                    }
                }
            )
            
            user = existing_user
            user.update(update_data)
            is_new_user = False
        else:
            # Create new user
            user_id = str(uuid4())
            
            user = {
                "id": user_id,
                "email": email,
                "full_name": emergent_user.get("name", ""),
                "google_id": emergent_user.get("id"),
                "google_profile_picture": emergent_user.get("picture"),
                "profile_picture": emergent_user.get("picture"),
                "email_verified": True,
                "auth_provider": "emergent_google",
                "roles": ["customer"],
                "status": "active",
                "device_info": device_info,
                "last_device_info": device_info,
                "emergent_session_token": session_token,
                "login_history": [{
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "device_info": device_info,
                    "login_type": "emergent_google_signup"
                }],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.users.insert_one(user.copy())
            is_new_user = True
        
        # Create JWT access token
        access_token = create_access_token({
            "sub": user["id"],
            "email": user["email"],
            "roles": user.get("roles", ["customer"])
        })
        
        # Store session in database (for session management)
        session_data = {
            "user_id": user["id"],
            "session_token": session_token,
            "jwt_token": access_token,
            "expires_at": datetime.now(timezone.utc).isoformat(),  # Will be updated based on Emergent session
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.user_sessions.update_one(
            {"user_id": user["id"]},
            {"$set": session_data},
            upsert=True
        )
        
        # Remove sensitive fields
        safe_user = {k: v for k, v in user.items() if k not in ["password", "hashed_password", "_id", "emergent_session_token"]}
        
        logger.info(f"User {'created' if is_new_user else 'logged in'} via Emergent Google Auth: {email}")
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": safe_user,
            "is_new_user": is_new_user,
            "device_info": device_info
        }
        
    except Exception as e:
        logger.error(f"Emergent auth callback error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
