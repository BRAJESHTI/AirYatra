"""
Account Lockout Service
Implements progressive account lockout after failed login attempts
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Tuple
from database import get_database
import secrets


class AccountLockoutService:
    """
    Account Lockout Security Service
    - Tracks failed login attempts per user
    - Locks account after MAX_ATTEMPTS
    - Sends unlock email with secure token
    - Auto-unlocks after LOCKOUT_DURATION
    """
    
    MAX_ATTEMPTS = 5
    LOCKOUT_DURATION_MINUTES = 30
    UNLOCK_TOKEN_EXPIRY_MINUTES = 60
    
    def __init__(self):
        self.db = None
    
    def _get_db(self):
        if self.db is None:
            self.db = get_database()
        return self.db
    
    async def record_failed_attempt(self, email: str, ip_address: str = None) -> Dict:
        """
        Record a failed login attempt and check if account should be locked.
        Returns: {locked: bool, remaining_attempts: int, lockout_until: datetime or None}
        """
        db = self._get_db()
        now = datetime.now(timezone.utc)
        
        # Get or create lockout record
        record = await db.account_lockouts.find_one({"email": email.lower()})
        
        if record is None:
            # First failed attempt
            record = {
                "email": email.lower(),
                "failed_attempts": 1,
                "last_failed_at": now,
                "locked": False,
                "locked_at": None,
                "lockout_until": None,
                "unlock_token": None,
                "unlock_token_expires": None,
                "ip_addresses": [ip_address] if ip_address else [],
                "created_at": now,
                "updated_at": now
            }
            await db.account_lockouts.insert_one(record)
            return {
                "locked": False,
                "remaining_attempts": self.MAX_ATTEMPTS - 1,
                "lockout_until": None
            }
        
        # Check if currently locked
        if record.get("locked") and record.get("lockout_until"):
            lockout_until = record["lockout_until"]
            if isinstance(lockout_until, str):
                lockout_until = datetime.fromisoformat(lockout_until.replace('Z', '+00:00'))
            elif lockout_until.tzinfo is None:
                lockout_until = lockout_until.replace(tzinfo=timezone.utc)
            
            if now < lockout_until:
                # Still locked
                return {
                    "locked": True,
                    "remaining_attempts": 0,
                    "lockout_until": lockout_until.isoformat()
                }
            else:
                # Lockout expired, reset attempts
                await db.account_lockouts.update_one(
                    {"email": email.lower()},
                    {"$set": {
                        "failed_attempts": 1,
                        "locked": False,
                        "locked_at": None,
                        "lockout_until": None,
                        "last_failed_at": now,
                        "updated_at": now
                    }}
                )
                return {
                    "locked": False,
                    "remaining_attempts": self.MAX_ATTEMPTS - 1,
                    "lockout_until": None
                }
        
        # Increment failed attempts
        new_attempts = record.get("failed_attempts", 0) + 1
        ip_list = record.get("ip_addresses", [])
        if ip_address and ip_address not in ip_list:
            ip_list.append(ip_address)
        
        update_data = {
            "failed_attempts": new_attempts,
            "last_failed_at": now,
            "ip_addresses": ip_list[-10:],  # Keep last 10 IPs
            "updated_at": now
        }
        
        # Check if should lock
        if new_attempts >= self.MAX_ATTEMPTS:
            lockout_until = now + timedelta(minutes=self.LOCKOUT_DURATION_MINUTES)
            unlock_token = secrets.token_urlsafe(32)
            
            update_data.update({
                "locked": True,
                "locked_at": now,
                "lockout_until": lockout_until,
                "unlock_token": unlock_token,
                "unlock_token_expires": now + timedelta(minutes=self.UNLOCK_TOKEN_EXPIRY_MINUTES)
            })
            
            await db.account_lockouts.update_one(
                {"email": email.lower()},
                {"$set": update_data}
            )
            
            return {
                "locked": True,
                "remaining_attempts": 0,
                "lockout_until": lockout_until.isoformat(),
                "unlock_token": unlock_token  # Used for sending email
            }
        
        await db.account_lockouts.update_one(
            {"email": email.lower()},
            {"$set": update_data}
        )
        
        return {
            "locked": False,
            "remaining_attempts": self.MAX_ATTEMPTS - new_attempts,
            "lockout_until": None
        }
    
    async def record_successful_login(self, email: str) -> None:
        """Reset failed attempts on successful login"""
        db = self._get_db()
        
        await db.account_lockouts.update_one(
            {"email": email.lower()},
            {"$set": {
                "failed_attempts": 0,
                "locked": False,
                "locked_at": None,
                "lockout_until": None,
                "unlock_token": None,
                "unlock_token_expires": None,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
    
    async def check_lockout_status(self, email: str) -> Dict:
        """Check if account is currently locked"""
        db = self._get_db()
        now = datetime.now(timezone.utc)
        
        record = await db.account_lockouts.find_one({"email": email.lower()})
        
        if not record or not record.get("locked"):
            return {"locked": False, "remaining_attempts": self.MAX_ATTEMPTS}
        
        lockout_until = record.get("lockout_until")
        if isinstance(lockout_until, str):
            lockout_until = datetime.fromisoformat(lockout_until.replace('Z', '+00:00'))
        elif lockout_until and lockout_until.tzinfo is None:
            # Make naive datetime timezone-aware
            lockout_until = lockout_until.replace(tzinfo=timezone.utc)
        
        if lockout_until and now >= lockout_until:
            # Lockout expired
            return {"locked": False, "remaining_attempts": self.MAX_ATTEMPTS}
        
        remaining_seconds = int((lockout_until - now).total_seconds()) if lockout_until else 0
        
        return {
            "locked": True,
            "remaining_attempts": 0,
            "lockout_until": lockout_until.isoformat() if lockout_until else None,
            "remaining_seconds": remaining_seconds
        }
    
    async def unlock_with_token(self, email: str, token: str) -> Tuple[bool, str]:
        """
        Unlock account using the email token.
        Returns: (success: bool, message: str)
        """
        db = self._get_db()
        now = datetime.now(timezone.utc)
        
        record = await db.account_lockouts.find_one({"email": email.lower()})
        
        if not record:
            return False, "Account not found"
        
        if not record.get("locked"):
            return True, "Account is not locked"
        
        stored_token = record.get("unlock_token")
        token_expires = record.get("unlock_token_expires")
        
        if isinstance(token_expires, str):
            token_expires = datetime.fromisoformat(token_expires.replace('Z', '+00:00'))
        elif token_expires and token_expires.tzinfo is None:
            # Make naive datetime timezone-aware (Mongo returns naive UTC)
            token_expires = token_expires.replace(tzinfo=timezone.utc)
        
        if not stored_token or stored_token != token:
            return False, "Invalid unlock token"
        
        if token_expires and now > token_expires:
            return False, "Unlock token has expired. Please wait for auto-unlock or contact support."
        
        # Unlock the account
        await db.account_lockouts.update_one(
            {"email": email.lower()},
            {"$set": {
                "failed_attempts": 0,
                "locked": False,
                "locked_at": None,
                "lockout_until": None,
                "unlock_token": None,
                "unlock_token_expires": None,
                "unlocked_at": now,
                "unlocked_via": "email_token",
                "updated_at": now
            }}
        )
        
        return True, "Account unlocked successfully"
    
    async def admin_unlock(self, email: str, admin_id: str) -> Tuple[bool, str]:
        """Admin force unlock an account"""
        db = self._get_db()
        now = datetime.now(timezone.utc)
        
        result = await db.account_lockouts.update_one(
            {"email": email.lower()},
            {"$set": {
                "failed_attempts": 0,
                "locked": False,
                "locked_at": None,
                "lockout_until": None,
                "unlock_token": None,
                "unlock_token_expires": None,
                "unlocked_at": now,
                "unlocked_via": "admin",
                "unlocked_by": admin_id,
                "updated_at": now
            }}
        )
        
        if result.modified_count > 0:
            return True, "Account unlocked by admin"
        return False, "Account not found or not locked"
    
    async def get_locked_accounts(self, limit: int = 50) -> list:
        """Get list of currently locked accounts (Admin)"""
        db = self._get_db()
        now = datetime.now(timezone.utc)
        
        accounts = await db.account_lockouts.find(
            {
                "locked": True,
                "lockout_until": {"$gt": now}
            },
            {"_id": 0, "unlock_token": 0}
        ).sort("locked_at", -1).limit(limit).to_list(length=limit)
        
        return accounts


# Singleton instance
account_lockout_service = AccountLockoutService()
