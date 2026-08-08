"""
AirYatra OTP Service
Enterprise-grade OTP generation, validation, and management
Features: Email OTP, Device Trust, Rate Limiting
"""

import os
import secrets
import hashlib
import hmac
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, Tuple
from database import get_database

logger = logging.getLogger(__name__)

# OTP Configuration
OTP_CONFIG = {
    "length": 6,
    "expiry_minutes": 5,
    "max_attempts": 3,
    "resend_cooldown_seconds": 60,
    "device_trust_days": 30,
}


def generate_otp(length: int = 6) -> str:
    """Generate a secure numeric OTP"""
    return ''.join([str(secrets.randbelow(10)) for _ in range(length)])


def hash_device_fingerprint(user_agent: str, ip_address: str, user_id: str, extra_entropy: str = "") -> str:
    """
    Create a unique device fingerprint hash
    Note: This is used for device recognition, not as sole authentication.
    The trust system should ideally use a secure cookie-based token.
    """
    # Include timestamp-based component for uniqueness
    raw = f"{user_agent}:{ip_address}:{user_id}:{extra_entropy}"
    return hashlib.sha256(raw.encode()).hexdigest()


class OTPService:
    """Enterprise OTP Management Service"""
    
    def __init__(self):
        self.config = OTP_CONFIG
    
    async def create_otp(
        self,
        user_id: str,
        email: str,
        purpose: str = "login",
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Create a new OTP for user
        Returns: (otp_code, otp_record)
        """
        db = get_database()
        now = datetime.now(timezone.utc)
        
        # Check for recent OTP (cooldown)
        recent_otp = await db.otp_codes.find_one({
            "user_id": user_id,
            "purpose": purpose,
            "created_at": {"$gte": (now - timedelta(seconds=self.config["resend_cooldown_seconds"])).isoformat()}
        })
        
        if recent_otp:
            remaining = self.config["resend_cooldown_seconds"] - (now - datetime.fromisoformat(recent_otp["created_at"].replace("Z", "+00:00"))).seconds
            return None, {
                "error": "cooldown",
                "message": f"Please wait {remaining} seconds before requesting a new OTP",
                "remaining_seconds": remaining
            }
        
        # Invalidate any existing OTPs for this user/purpose
        await db.otp_codes.update_many(
            {"user_id": user_id, "purpose": purpose, "is_used": False},
            {"$set": {"is_used": True, "invalidated_at": now.isoformat()}}
        )
        
        # Generate new OTP
        otp_code = generate_otp(self.config["length"])
        expiry = now + timedelta(minutes=self.config["expiry_minutes"])
        
        otp_record = {
            "id": f"otp_{secrets.token_hex(8)}",
            "user_id": user_id,
            "email": email,
            "otp_hash": hashlib.sha256(otp_code.encode()).hexdigest(),
            "purpose": purpose,
            "attempts": 0,
            "max_attempts": self.config["max_attempts"],
            "is_used": False,
            "is_verified": False,
            "created_at": now.isoformat(),
            "expires_at": expiry.isoformat(),
            "ip_address": ip_address,
            "user_agent": user_agent[:200] if user_agent else None,
        }
        
        await db.otp_codes.insert_one(otp_record)
        
        logger.info(f"OTP created for user {user_id[:8]}... purpose={purpose}")
        
        return otp_code, {
            "otp_id": otp_record["id"],
            "expires_at": expiry.isoformat(),
            "expiry_minutes": self.config["expiry_minutes"],
        }
    
    async def verify_otp(
        self,
        user_id: str,
        otp_code: str,
        purpose: str = "login"
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Verify OTP code
        Returns: (is_valid, result_info)
        """
        db = get_database()
        now = datetime.now(timezone.utc)
        
        # Find active OTP
        otp_hash = hashlib.sha256(otp_code.encode()).hexdigest()
        
        otp_record = await db.otp_codes.find_one({
            "user_id": user_id,
            "purpose": purpose,
            "is_used": False,
        }, sort=[("created_at", -1)])
        
        if not otp_record:
            return False, {"error": "no_otp", "message": "No active OTP found. Please request a new one."}
        
        # Check expiry
        expiry = datetime.fromisoformat(otp_record["expires_at"].replace("Z", "+00:00"))
        if now > expiry:
            await db.otp_codes.update_one(
                {"id": otp_record["id"]},
                {"$set": {"is_used": True, "expired_at": now.isoformat()}}
            )
            return False, {"error": "expired", "message": "OTP has expired. Please request a new one."}
        
        # Check attempts
        if otp_record["attempts"] >= otp_record["max_attempts"]:
            await db.otp_codes.update_one(
                {"id": otp_record["id"]},
                {"$set": {"is_used": True, "locked_at": now.isoformat()}}
            )
            return False, {"error": "max_attempts", "message": "Too many incorrect attempts. Please request a new OTP."}
        
        # Verify OTP using constant-time comparison
        if not hmac.compare_digest(otp_record["otp_hash"], otp_hash):
            # Increment attempts
            await db.otp_codes.update_one(
                {"id": otp_record["id"]},
                {"$inc": {"attempts": 1}}
            )
            remaining = otp_record["max_attempts"] - otp_record["attempts"] - 1
            return False, {
                "error": "invalid",
                "message": f"Invalid OTP. {remaining} attempts remaining.",
                "attempts_remaining": remaining
            }
        
        # OTP is valid - mark as used
        await db.otp_codes.update_one(
            {"id": otp_record["id"]},
            {"$set": {
                "is_used": True,
                "is_verified": True,
                "verified_at": now.isoformat()
            }}
        )
        
        logger.info(f"OTP verified for user {user_id[:8]}... purpose={purpose}")
        
        return True, {"message": "OTP verified successfully", "otp_id": otp_record["id"]}
    
    async def is_device_trusted(
        self,
        user_id: str,
        user_agent: str,
        ip_address: str
    ) -> Tuple[bool, Optional[Dict[str, Any]]]:
        """
        Check if device is trusted (skip OTP)
        Returns: (is_trusted, device_info)
        """
        db = get_database()
        now = datetime.now(timezone.utc)
        
        device_hash = hash_device_fingerprint(user_agent, ip_address, user_id)
        
        trusted_device = await db.trusted_devices.find_one({
            "user_id": user_id,
            "device_hash": device_hash,
            "is_active": True,
            "expires_at": {"$gt": now.isoformat()}
        })
        
        if trusted_device:
            # Update last used
            await db.trusted_devices.update_one(
                {"id": trusted_device["id"]},
                {"$set": {"last_used_at": now.isoformat()}}
            )
            return True, {
                "device_id": trusted_device["id"],
                "device_name": trusted_device.get("device_name", "Unknown Device"),
                "trusted_since": trusted_device.get("created_at"),
            }
        
        return False, None
    
    async def trust_device(
        self,
        user_id: str,
        user_agent: str,
        ip_address: str,
        device_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Mark a device as trusted for 30 days
        """
        db = get_database()
        now = datetime.now(timezone.utc)
        
        device_hash = hash_device_fingerprint(user_agent, ip_address, user_id)
        
        # Parse device info from user agent
        if not device_name:
            device_name = self._parse_device_name(user_agent)
        
        # Check if already trusted
        existing = await db.trusted_devices.find_one({
            "user_id": user_id,
            "device_hash": device_hash
        })
        
        if existing:
            # Extend trust period
            await db.trusted_devices.update_one(
                {"id": existing["id"]},
                {"$set": {
                    "expires_at": (now + timedelta(days=self.config["device_trust_days"])).isoformat(),
                    "is_active": True,
                    "last_used_at": now.isoformat(),
                    "renewed_at": now.isoformat(),
                }}
            )
            return {
                "device_id": existing["id"],
                "message": "Device trust extended",
                "expires_at": (now + timedelta(days=self.config["device_trust_days"])).isoformat()
            }
        
        # Create new trusted device
        device_record = {
            "id": f"device_{secrets.token_hex(8)}",
            "user_id": user_id,
            "device_hash": device_hash,
            "device_name": device_name,
            "user_agent": user_agent[:500] if user_agent else None,
            "ip_address": ip_address,
            "is_active": True,
            "created_at": now.isoformat(),
            "expires_at": (now + timedelta(days=self.config["device_trust_days"])).isoformat(),
            "last_used_at": now.isoformat(),
        }
        
        await db.trusted_devices.insert_one(device_record)
        
        logger.info(f"Device trusted for user {user_id[:8]}... device={device_name}")
        
        return {
            "device_id": device_record["id"],
            "device_name": device_name,
            "message": "Device marked as trusted",
            "expires_at": device_record["expires_at"],
            "trust_days": self.config["device_trust_days"]
        }
    
    async def revoke_device_trust(self, user_id: str, device_id: str) -> bool:
        """Revoke trust for a specific device"""
        db = get_database()
        now = datetime.now(timezone.utc)
        
        result = await db.trusted_devices.update_one(
            {"id": device_id, "user_id": user_id},
            {"$set": {"is_active": False, "revoked_at": now.isoformat()}}
        )
        
        return result.modified_count > 0
    
    async def get_trusted_devices(self, user_id: str) -> list:
        """Get all trusted devices for a user"""
        db = get_database()
        now = datetime.now(timezone.utc)
        
        devices = await db.trusted_devices.find(
            {
                "user_id": user_id,
                "is_active": True,
                "expires_at": {"$gt": now.isoformat()}
            },
            {"_id": 0, "device_hash": 0}
        ).sort("last_used_at", -1).to_list(20)
        
        return devices
    
    async def revoke_all_device_trust(self, user_id: str) -> int:
        """Revoke trust for all devices (e.g., on password change)"""
        db = get_database()
        now = datetime.now(timezone.utc)
        
        result = await db.trusted_devices.update_many(
            {"user_id": user_id, "is_active": True},
            {"$set": {"is_active": False, "revoked_at": now.isoformat()}}
        )
        
        return result.modified_count
    
    async def should_require_otp(
        self,
        user_id: str,
        user_agent: str,
        ip_address: str,
        user_data: Dict[str, Any]
    ) -> Tuple[bool, str]:
        """
        Determine if OTP is required for this login
        Returns: (requires_otp, reason)
        """
        db = get_database()
        
        # GLOBAL BYPASS: Check if user has login_shield_bypass flag
        if user_data.get("login_shield_bypass", False):
            return False, "bypass_enabled"
        
        # Check if user has 2FA enabled
        if not user_data.get("otp_enabled", True):
            return False, "otp_disabled"
        
        # Admin and operator roles always require OTP
        roles = user_data.get("roles", [])
        if "admin" in roles or "operator" in roles:
            # But check if device is trusted first
            is_trusted, _ = await self.is_device_trusted(user_id, user_agent, ip_address)
            if is_trusted:
                return False, "trusted_device"
            return True, "privileged_role"
        
        # Check if device is trusted
        is_trusted, _ = await self.is_device_trusted(user_id, user_agent, ip_address)
        if is_trusted:
            return False, "trusted_device"
        
        # Check if first login
        login_count = await db.audit_logs.count_documents({
            "user_id": user_id,
            "action": "login",
            "status": "success"
        })
        if login_count == 0:
            return True, "first_login"
        
        # New device/browser detection
        device_hash = hash_device_fingerprint(user_agent, ip_address, user_id)
        known_device = await db.user_sessions.find_one({
            "user_id": user_id,
            "device_hash": device_hash
        })
        if not known_device:
            return True, "new_device"
        
        return True, "default_security"
    
    def _parse_device_name(self, user_agent: str) -> str:
        """Parse device name from user agent string"""
        if not user_agent:
            return "Unknown Device"
        
        ua = user_agent.lower()
        
        # Mobile devices
        if "iphone" in ua:
            return "iPhone"
        elif "ipad" in ua:
            return "iPad"
        elif "android" in ua:
            if "mobile" in ua:
                return "Android Phone"
            return "Android Tablet"
        
        # Desktop browsers
        if "windows" in ua:
            os_name = "Windows"
        elif "macintosh" in ua or "mac os" in ua:
            os_name = "Mac"
        elif "linux" in ua:
            os_name = "Linux"
        else:
            os_name = "Unknown"
        
        if "chrome" in ua and "edg" not in ua:
            browser = "Chrome"
        elif "firefox" in ua:
            browser = "Firefox"
        elif "safari" in ua and "chrome" not in ua:
            browser = "Safari"
        elif "edg" in ua:
            browser = "Edge"
        else:
            browser = "Browser"
        
        return f"{browser} on {os_name}"


# Singleton instance
otp_service = OTPService()
