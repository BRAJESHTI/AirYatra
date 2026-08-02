"""
TOTP Two-Factor Authentication Service
Implements Google Authenticator compatible 2FA using PyOTP
"""

import pyotp
import secrets
import hashlib
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from database import get_database

class TOTPService:
    """
    Service for managing TOTP-based 2FA with Google Authenticator
    """
    
    def __init__(self, issuer: str = "AirYatra"):
        self.issuer = issuer
        self.interval = 30  # 30-second window (standard TOTP)
        self.valid_window = 1  # Allow +/- 1 window for clock drift
    
    async def setup_2fa(self, user_id: str, user_email: str) -> Dict[str, Any]:
        """
        Generate a new TOTP secret and provisioning URI for user
        Returns QR code data for Google Authenticator setup
        """
        db = get_database()
        
        # Check if 2FA is already enabled
        user = await db.users.find_one({"id": user_id})
        if not user:
            return {"error": "User not found", "success": False}
        
        if user.get("totp_enabled"):
            return {"error": "2FA पहले से enabled है / 2FA is already enabled", "success": False}
        
        # Generate a new secret
        secret = pyotp.random_base32()
        
        # Create provisioning URI for Google Authenticator
        totp = pyotp.TOTP(secret, interval=self.interval)
        provisioning_uri = totp.provisioning_uri(
            name=user_email,
            issuer_name=self.issuer
        )
        
        # Generate recovery codes (one-time use)
        recovery_codes = self._generate_recovery_codes(8)
        
        # Store pending setup (not yet verified)
        await db.users.update_one(
            {"id": user_id},
            {
                "$set": {
                    "totp_secret_pending": self._encrypt_secret(secret),
                    "totp_recovery_codes_pending": [self._hash_code(c) for c in recovery_codes],
                    "totp_setup_started_at": datetime.now(timezone.utc).isoformat(),
                }
            }
        )
        
        # Log setup attempt
        await db.audit_logs.insert_one({
            "id": f"audit_{secrets.token_hex(8)}",
            "user_id": user_id,
            "user_email": user_email,
            "action": "2fa_setup_started",
            "category": "security",
            "status": "pending",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "details": {"method": "totp_google_authenticator"}
        })
        
        return {
            "success": True,
            "provisioning_uri": provisioning_uri,
            "secret": secret,  # Show this only for manual entry option
            "recovery_codes": recovery_codes,
            "message": "QR code scan करें Google Authenticator में / Scan QR code in Google Authenticator"
        }
    
    async def verify_setup(self, user_id: str, code: str) -> Dict[str, Any]:
        """
        Verify the TOTP code during initial setup to enable 2FA
        """
        db = get_database()
        
        user = await db.users.find_one({"id": user_id})
        if not user:
            return {"error": "User not found", "success": False}
        
        pending_secret = user.get("totp_secret_pending")
        if not pending_secret:
            return {"error": "2FA setup नहीं शुरू हुआ / 2FA setup not started", "success": False}
        
        # Decrypt and verify
        secret = self._decrypt_secret(pending_secret)
        totp = pyotp.TOTP(secret, interval=self.interval)
        
        if not totp.verify(code, valid_window=self.valid_window):
            # Log failed attempt
            await db.audit_logs.insert_one({
                "id": f"audit_{secrets.token_hex(8)}",
                "user_id": user_id,
                "action": "2fa_setup_verify_failed",
                "category": "security",
                "status": "failed",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            return {"error": "Invalid code / गलत कोड", "success": False}
        
        # Enable 2FA
        await db.users.update_one(
            {"id": user_id},
            {
                "$set": {
                    "totp_enabled": True,
                    "totp_secret": pending_secret,
                    "totp_recovery_codes": user.get("totp_recovery_codes_pending", []),
                    "totp_enabled_at": datetime.now(timezone.utc).isoformat(),
                    "totp_last_used_timecode": totp.timecode(datetime.now(timezone.utc)),
                },
                "$unset": {
                    "totp_secret_pending": "",
                    "totp_recovery_codes_pending": "",
                    "totp_setup_started_at": "",
                }
            }
        )
        
        # Log success
        await db.audit_logs.insert_one({
            "id": f"audit_{secrets.token_hex(8)}",
            "user_id": user_id,
            "action": "2fa_enabled",
            "category": "security",
            "status": "success",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "details": {"method": "totp_google_authenticator"}
        })
        
        return {
            "success": True,
            "message": "2FA successfully enabled / 2FA सफलतापूर्वक enable हुआ"
        }
    
    async def verify_code(self, user_id: str, code: str) -> Dict[str, Any]:
        """
        Verify TOTP code during login
        Includes replay protection
        """
        db = get_database()
        
        user = await db.users.find_one({"id": user_id})
        if not user or not user.get("totp_enabled"):
            return {"error": "2FA is not enabled", "success": False}
        
        secret = self._decrypt_secret(user["totp_secret"])
        totp = pyotp.TOTP(secret, interval=self.interval)
        now = datetime.now(timezone.utc)
        current_timecode = totp.timecode(now)
        
        # Verify code
        if not totp.verify(code, valid_window=self.valid_window):
            # Check if it's a recovery code
            recovery_result = await self._verify_recovery_code(user_id, code, user)
            if recovery_result["success"]:
                return recovery_result
            
            return {"error": "Invalid or expired code / गलत या expired कोड", "success": False}
        
        # Replay protection: same timecode cannot be used twice
        last_timecode = user.get("totp_last_used_timecode")
        if last_timecode and current_timecode <= last_timecode:
            return {"error": "Code already used / कोड पहले ही इस्तेमाल हो चुका है", "success": False}
        
        # Update last used timecode
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"totp_last_used_timecode": current_timecode}}
        )
        
        return {"success": True, "message": "Code verified"}
    
    async def _verify_recovery_code(self, user_id: str, code: str, user: dict) -> Dict[str, Any]:
        """
        Verify a recovery code (one-time use)
        """
        db = get_database()
        recovery_codes = user.get("totp_recovery_codes", [])
        code_hash = self._hash_code(code.upper().replace("-", "").replace(" ", ""))
        
        if code_hash in recovery_codes:
            # Remove used recovery code
            recovery_codes.remove(code_hash)
            await db.users.update_one(
                {"id": user_id},
                {"$set": {"totp_recovery_codes": recovery_codes}}
            )
            
            # Log recovery code usage
            await db.audit_logs.insert_one({
                "id": f"audit_{secrets.token_hex(8)}",
                "user_id": user_id,
                "action": "2fa_recovery_code_used",
                "category": "security",
                "status": "success",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "details": {"remaining_codes": len(recovery_codes)}
            })
            
            return {
                "success": True,
                "is_recovery": True,
                "remaining_recovery_codes": len(recovery_codes),
                "message": f"Recovery code used. {len(recovery_codes)} codes remaining."
            }
        
        return {"success": False}
    
    async def disable_2fa(self, user_id: str, password_verified: bool = False) -> Dict[str, Any]:
        """
        Disable 2FA for a user (requires password verification in real implementation)
        """
        if not password_verified:
            return {"error": "Password verification required", "success": False}
        
        db = get_database()
        
        result = await db.users.update_one(
            {"id": user_id},
            {
                "$set": {"totp_enabled": False},
                "$unset": {
                    "totp_secret": "",
                    "totp_recovery_codes": "",
                    "totp_enabled_at": "",
                    "totp_last_used_timecode": "",
                }
            }
        )
        
        if result.modified_count > 0:
            await db.audit_logs.insert_one({
                "id": f"audit_{secrets.token_hex(8)}",
                "user_id": user_id,
                "action": "2fa_disabled",
                "category": "security",
                "status": "success",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            return {"success": True, "message": "2FA disabled / 2FA बंद कर दिया गया"}
        
        return {"error": "Failed to disable 2FA", "success": False}
    
    async def get_2fa_status(self, user_id: str) -> Dict[str, Any]:
        """
        Get 2FA status for a user
        """
        db = get_database()
        user = await db.users.find_one({"id": user_id})
        
        if not user:
            return {"enabled": False, "setup_pending": False}
        
        return {
            "enabled": user.get("totp_enabled", False),
            "setup_pending": "totp_secret_pending" in user,
            "enabled_at": user.get("totp_enabled_at"),
            "recovery_codes_remaining": len(user.get("totp_recovery_codes", [])) if user.get("totp_enabled") else 0
        }
    
    async def regenerate_recovery_codes(self, user_id: str) -> Dict[str, Any]:
        """
        Generate new recovery codes (invalidates old ones)
        """
        db = get_database()
        user = await db.users.find_one({"id": user_id})
        
        if not user or not user.get("totp_enabled"):
            return {"error": "2FA is not enabled", "success": False}
        
        recovery_codes = self._generate_recovery_codes(8)
        
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"totp_recovery_codes": [self._hash_code(c) for c in recovery_codes]}}
        )
        
        await db.audit_logs.insert_one({
            "id": f"audit_{secrets.token_hex(8)}",
            "user_id": user_id,
            "action": "2fa_recovery_codes_regenerated",
            "category": "security",
            "status": "success",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        
        return {
            "success": True,
            "recovery_codes": recovery_codes,
            "message": "नए recovery codes generate हुए / New recovery codes generated"
        }
    
    def _generate_recovery_codes(self, count: int = 8) -> list:
        """Generate human-readable recovery codes"""
        codes = []
        for _ in range(count):
            # Format: XXXX-XXXX (easy to read and type)
            code = f"{secrets.token_hex(2).upper()}-{secrets.token_hex(2).upper()}"
            codes.append(code)
        return codes
    
    def _encrypt_secret(self, secret: str) -> str:
        """
        Simple encoding for storage (in production, use proper encryption with KMS)
        """
        # For demo, just base64 encode. In production, use AWS KMS, HashiCorp Vault, etc.
        import base64
        return base64.b64encode(secret.encode()).decode()
    
    def _decrypt_secret(self, encrypted: str) -> str:
        """Decrypt the stored secret"""
        import base64
        return base64.b64decode(encrypted.encode()).decode()
    
    def _hash_code(self, code: str) -> str:
        """Hash recovery code for storage"""
        return hashlib.sha256(code.encode()).hexdigest()


# Singleton instance
totp_service = TOTPService()
