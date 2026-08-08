from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from typing import Optional
from config import settings
from models import User, UserRole
import os

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Security Constants
JWT_ISSUER = os.environ.get("JWT_ISSUER", "airyatra.co.in")
JWT_AUDIENCE = os.environ.get("JWT_AUDIENCE", "airyatra-api")
# SECURITY: Reduced from 7 days to 24 hours for better security
JWT_DEFAULT_EXPIRE_HOURS = int(os.environ.get("JWT_EXPIRE_HOURS", "24"))

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create JWT access token with security hardening
    - Includes issuer (iss) claim
    - Includes audience (aud) claim  
    - Includes issued-at (iat) claim
    - Default expiry: 24 hours (reduced from 7 days)
    """
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    
    if expires_delta:
        expire = now + expires_delta
    else:
        # Default: 24 hours instead of 7 days
        expire = now + timedelta(hours=JWT_DEFAULT_EXPIRE_HOURS)
    
    # Add security claims
    to_encode.update({
        "exp": expire,
        "iat": now,  # Issued at
        "iss": JWT_ISSUER,  # Issuer
        "aud": JWT_AUDIENCE,  # Audience
    })
    
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return encoded_jwt

def decode_token(token: str) -> Optional[dict]:
    """
    Decode JWT token with security validation
    - Validates issuer (iss) claim
    - Validates audience (aud) claim
    """
    try:
        payload = jwt.decode(
            token, 
            settings.jwt_secret_key, 
            algorithms=[settings.jwt_algorithm],
            issuer=JWT_ISSUER,
            audience=JWT_AUDIENCE,
            options={
                "require_exp": True,
                "require_iat": True,
            }
        )
        return payload
    except JWTError:
        return None

def create_refresh_token(user_id: str) -> str:
    """
    Create a refresh token with longer validity (7 days)
    Used to get new access tokens without re-login
    """
    data = {
        "sub": user_id,
        "type": "refresh"
    }
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    data.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "iss": JWT_ISSUER,
        "aud": f"{JWT_AUDIENCE}-refresh",
    })
    return jwt.encode(data, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)