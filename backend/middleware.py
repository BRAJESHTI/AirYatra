from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List
from auth import decode_token
from database import get_database
from models import UserRole
import logging
import hashlib

logger = logging.getLogger(__name__)
security = HTTPBearer()

def hash_token(token: str) -> str:
    """Create a hash of the token for storage/lookup"""
    return hashlib.sha256(token.encode()).hexdigest()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current authenticated user with token revocation check"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token = credentials.credentials
    payload = decode_token(token)
    
    if payload is None:
        raise credentials_exception
    
    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    
    # SEC-002 FIX: Block pending_2fa tokens from accessing protected resources
    if payload.get("pending_2fa"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="2FA verification required. Please complete authentication.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    db = get_database()
    
    # SESSION INVALIDATION: Check if token is revoked (password changed, logout all devices)
    token_hash = hash_token(token)
    revoked = await db.revoked_tokens.find_one({"token_hash": token_hash})
    if revoked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please login again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    
    if user is None:
        raise credentials_exception
    
    # Check if user is active (support both is_active and status fields)
    is_active = user.get("is_active", True)  # Default to True if not present
    status_active = user.get("status", "active") == "active"
    
    if not (is_active and status_active):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is inactive"
        )
    
    # Attach token hash for potential session management
    user["_current_token_hash"] = token_hash
    
    return user

def require_roles(allowed_roles: List[UserRole]):
    """Dependency to check if user has required roles"""
    async def role_checker(user: dict = Depends(get_current_user)):
        user_roles = user.get("roles", [])
        if not any(role in allowed_roles for role in user_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        return user
    return role_checker