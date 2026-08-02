"""
Security Middleware and Utilities
- Rate Limiting
- Audit Logging
- Session Management
- File Encryption
"""
from fastapi import Request, HTTPException
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64
import os
import json
import hashlib
from typing import Optional
from functools import wraps

# =============================================================================
# RATE LIMITING
# =============================================================================

def get_client_ip(request: Request) -> str:
    """
    Get client IP from request, handling proxies securely.
    SEC-003 FIX: Validate X-Forwarded-For to prevent IP spoofing
    """
    # Private/internal IP ranges that should be trusted as proxies
    TRUSTED_PROXIES = [
        "10.",      # Class A private
        "172.16.", "172.17.", "172.18.", "172.19.", "172.20.",
        "172.21.", "172.22.", "172.23.", "172.24.", "172.25.",
        "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31.",  # Class B private
        "192.168.",  # Class C private
        "127.",      # Loopback
        "::1",       # IPv6 loopback
        "fc00:",     # IPv6 private
        "fe80:",     # IPv6 link-local
    ]
    
    def is_trusted_proxy(ip: str) -> bool:
        """Check if IP is from a trusted proxy/internal network"""
        if not ip:
            return False
        return any(ip.startswith(prefix) for prefix in TRUSTED_PROXIES)
    
    # Get direct client IP
    direct_ip = request.client.host if request.client else None
    
    # Only trust X-Forwarded-For if request comes from trusted proxy
    if direct_ip and is_trusted_proxy(direct_ip):
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            # Take the leftmost non-trusted IP (actual client)
            ips = [ip.strip() for ip in forwarded.split(",")]
            for ip in ips:
                if ip and not is_trusted_proxy(ip):
                    return ip
            # If all are trusted, return the first one
            return ips[0] if ips else direct_ip
        
        # Check X-Real-IP header
        real_ip = request.headers.get("X-Real-IP")
        if real_ip and not is_trusted_proxy(real_ip):
            return real_ip
    
    # Fall back to direct client IP
    return direct_ip or "unknown"

# Create limiter instance
limiter = Limiter(key_func=get_client_ip)

# Rate limit configurations
RATE_LIMITS = {
    "login": "10/minute",           # 10 login attempts per minute per IP (above 5-attempt lockout threshold)
    "password_reset": "3/minute",   # 3 password reset requests per minute
    "register": "3/minute",         # 3 registration attempts per minute
    "api_general": "100/minute",    # 100 general API calls per minute
    "file_upload": "10/minute",     # 10 file uploads per minute
    "verification": "5/minute"      # 5 document verification attempts per minute
}

def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    """Custom handler for rate limit exceeded"""
    return HTTPException(
        status_code=429,
        detail={
            "error": "rate_limit_exceeded",
            "message": "Too many requests. Please try again later.",
            "retry_after": exc.detail
        }
    )

# =============================================================================
# AUDIT LOGGING
# =============================================================================

class AuditLogger:
    """Audit logging for compliance and security monitoring"""
    
    # Action categories
    CATEGORY_AUTH = "authentication"
    CATEGORY_DATA_ACCESS = "data_access"
    CATEGORY_DATA_MODIFY = "data_modification"
    CATEGORY_ADMIN = "admin_action"
    CATEGORY_SECURITY = "security_event"
    CATEGORY_FILE = "file_operation"
    
    # Action types
    ACTION_LOGIN = "login"
    ACTION_LOGOUT = "logout"
    ACTION_LOGIN_FAILED = "login_failed"
    ACTION_PASSWORD_CHANGE = "password_change"
    ACTION_PASSWORD_RESET = "password_reset"
    ACTION_TOKEN_REVOKE = "token_revoke"
    
    ACTION_VIEW_PII = "view_pii"
    ACTION_EXPORT_DATA = "export_data"
    ACTION_DOWNLOAD_DOC = "download_document"
    
    ACTION_CREATE = "create"
    ACTION_UPDATE = "update"
    ACTION_DELETE = "delete"
    ACTION_APPROVE = "approve"
    ACTION_REJECT = "reject"
    
    ACTION_UPLOAD = "file_upload"
    ACTION_ENCRYPT = "file_encrypt"
    ACTION_DECRYPT = "file_decrypt"
    
    def __init__(self, db):
        self.db = db
        self.collection = db.audit_logs
    
    async def log(
        self,
        action: str,
        category: str,
        user_id: Optional[str] = None,
        user_email: Optional[str] = None,
        user_roles: list = None,
        resource_type: str = None,
        resource_id: str = None,
        details: dict = None,
        ip_address: str = None,
        user_agent: str = None,
        status: str = "success",
        risk_level: str = "low"
    ):
        """
        Log an audit event
        
        Args:
            action: What action was performed
            category: Category of the action
            user_id: ID of user performing action
            user_email: Email of user (for display)
            user_roles: Roles of the user
            resource_type: Type of resource affected (e.g., "kyc_document", "user", "booking")
            resource_id: ID of the affected resource
            details: Additional details about the action
            ip_address: Client IP address
            user_agent: Browser/client user agent
            status: "success", "failure", "blocked"
            risk_level: "low", "medium", "high", "critical"
        """
        
        # Mask sensitive data in details
        safe_details = self._mask_sensitive_data(details) if details else {}
        
        log_entry = {
            "id": f"audit_{ObjectId()}",
            "timestamp": datetime.now(timezone.utc),
            "action": action,
            "category": category,
            "user": {
                "id": user_id,
                "email": self._mask_email(user_email) if user_email else None,
                "roles": user_roles or []
            },
            "resource": {
                "type": resource_type,
                "id": resource_id
            },
            "details": safe_details,
            "client": {
                "ip_address": ip_address,
                "user_agent": user_agent[:200] if user_agent else None
            },
            "status": status,
            "risk_level": risk_level,
            # For compliance queries
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "hour": datetime.now(timezone.utc).hour
        }
        
        await self.collection.insert_one(log_entry)
        
        # If high-risk action, also log to separate alerts collection
        if risk_level in ["high", "critical"]:
            await self._create_security_alert(log_entry)
        
        return log_entry["id"]
    
    def _mask_sensitive_data(self, data: dict) -> dict:
        """Mask sensitive fields in audit log details"""
        if not data:
            return {}
        
        sensitive_fields = [
            "password", "api_key", "api_secret", "token", "secret",
            "aadhaar", "aadhar", "pan", "passport_number", "bank_account"
        ]
        
        masked = {}
        for key, value in data.items():
            key_lower = key.lower()
            if any(sf in key_lower for sf in sensitive_fields):
                if isinstance(value, str) and len(value) > 4:
                    masked[key] = f"***{value[-4:]}"
                else:
                    masked[key] = "***"
            elif isinstance(value, dict):
                masked[key] = self._mask_sensitive_data(value)
            else:
                masked[key] = value
        return masked
    
    def _mask_email(self, email: str) -> str:
        """Partially mask email for privacy"""
        if not email or "@" not in email:
            return email
        local, domain = email.split("@", 1)
        if len(local) > 2:
            masked_local = f"{local[0]}***{local[-1]}"
        else:
            masked_local = "***"
        return f"{masked_local}@{domain}"
    
    async def _create_security_alert(self, log_entry: dict):
        """Create a security alert for high-risk actions"""
        alert = {
            "id": f"alert_{ObjectId()}",
            "audit_log_id": log_entry["id"],
            "timestamp": log_entry["timestamp"],
            "severity": log_entry["risk_level"],
            "action": log_entry["action"],
            "user_id": log_entry["user"]["id"],
            "ip_address": log_entry["client"]["ip_address"],
            "status": "new",
            "reviewed_by": None,
            "reviewed_at": None
        }
        await self.db.security_alerts.insert_one(alert)
    
    async def get_logs(
        self,
        user_id: str = None,
        category: str = None,
        action: str = None,
        date_from: datetime = None,
        date_to: datetime = None,
        risk_level: str = None,
        limit: int = 100
    ) -> list:
        """Query audit logs with filters"""
        query = {}
        
        if user_id:
            query["user.id"] = user_id
        if category:
            query["category"] = category
        if action:
            query["action"] = action
        if risk_level:
            query["risk_level"] = risk_level
        if date_from:
            query["timestamp"] = {"$gte": date_from}
        if date_to:
            if "timestamp" in query:
                query["timestamp"]["$lte"] = date_to
            else:
                query["timestamp"] = {"$lte": date_to}
        
        logs = await self.collection.find(
            query, {"_id": 0}
        ).sort("timestamp", -1).limit(limit).to_list(limit)
        
        return logs


# =============================================================================
# SESSION/TOKEN MANAGEMENT
# =============================================================================

class SessionManager:
    """Manage user sessions and token revocation"""
    
    def __init__(self, db):
        self.db = db
        self.collection = db.user_sessions
        self.revoked_tokens = db.revoked_tokens
    
    async def create_session(
        self,
        user_id: str,
        token_hash: str,
        ip_address: str = None,
        user_agent: str = None,
        expires_at: datetime = None
    ) -> str:
        """Create a new session record"""
        session = {
            "id": f"session_{ObjectId()}",
            "user_id": user_id,
            "token_hash": token_hash,
            "ip_address": ip_address,
            "user_agent": user_agent[:200] if user_agent else None,
            "created_at": datetime.now(timezone.utc),
            "expires_at": expires_at or datetime.now(timezone.utc) + timedelta(days=7),
            "last_activity": datetime.now(timezone.utc),
            "is_active": True
        }
        await self.collection.insert_one(session)
        return session["id"]
    
    async def update_activity(self, token_hash: str):
        """Update last activity timestamp for a session"""
        await self.collection.update_one(
            {"token_hash": token_hash, "is_active": True},
            {"$set": {"last_activity": datetime.now(timezone.utc)}}
        )
    
    async def revoke_session(self, session_id: str, reason: str = None):
        """Revoke a specific session"""
        session = await self.collection.find_one({"id": session_id})
        if session:
            await self.collection.update_one(
                {"id": session_id},
                {"$set": {
                    "is_active": False,
                    "revoked_at": datetime.now(timezone.utc),
                    "revoke_reason": reason
                }}
            )
            # Add token to revoked list
            await self._add_to_revoked(session["token_hash"], reason)
    
    async def revoke_all_user_sessions(self, user_id: str, reason: str = None, except_current: str = None):
        """Revoke all sessions for a user (e.g., on password change)"""
        query = {"user_id": user_id, "is_active": True}
        if except_current:
            query["token_hash"] = {"$ne": except_current}
        
        sessions = await self.collection.find(query).to_list(100)
        
        for session in sessions:
            await self.collection.update_one(
                {"id": session["id"]},
                {"$set": {
                    "is_active": False,
                    "revoked_at": datetime.now(timezone.utc),
                    "revoke_reason": reason
                }}
            )
            await self._add_to_revoked(session["token_hash"], reason)
        
        return len(sessions)
    
    async def _add_to_revoked(self, token_hash: str, reason: str = None):
        """Add token hash to revoked tokens list"""
        await self.revoked_tokens.insert_one({
            "token_hash": token_hash,
            "revoked_at": datetime.now(timezone.utc),
            "reason": reason,
            # Auto-expire revoked tokens after 30 days (for cleanup)
            "expires_at": datetime.now(timezone.utc) + timedelta(days=30)
        })
    
    async def is_token_revoked(self, token_hash: str) -> bool:
        """Check if a token has been revoked"""
        revoked = await self.revoked_tokens.find_one({"token_hash": token_hash})
        return revoked is not None
    
    async def get_user_sessions(self, user_id: str, active_only: bool = True) -> list:
        """Get all sessions for a user"""
        query = {"user_id": user_id}
        if active_only:
            query["is_active"] = True
        
        sessions = await self.collection.find(
            query, {"_id": 0, "token_hash": 0}  # Don't expose token hash
        ).sort("last_activity", -1).to_list(50)
        
        return sessions
    
    @staticmethod
    def hash_token(token: str) -> str:
        """Create a hash of the token for storage"""
        return hashlib.sha256(token.encode()).hexdigest()


# =============================================================================
# FILE ENCRYPTION (AES-256)
# =============================================================================

class FileEncryption:
    """AES-256 encryption for sensitive files"""
    
    def __init__(self, master_key: str = None):
        """
        Initialize with master key from environment or generate one
        
        In production, master_key should come from:
        - Environment variable
        - Secret manager (AWS KMS, Azure Key Vault, etc.)
        - Hardware Security Module (HSM)
        """
        self.master_key = master_key or os.environ.get(
            'FILE_ENCRYPTION_KEY',
            self._generate_key()
        )
        self.fernet = self._create_fernet()
    
    def _generate_key(self) -> str:
        """Generate a new encryption key (base64 encoded)"""
        return base64.urlsafe_b64encode(os.urandom(32)).decode()
    
    def _create_fernet(self) -> Fernet:
        """Create Fernet cipher from master key"""
        # Ensure key is proper length for Fernet (32 bytes, base64 encoded)
        key_bytes = self.master_key.encode() if isinstance(self.master_key, str) else self.master_key
        
        # If key is not already base64-encoded 32-byte key, derive one
        if len(key_bytes) != 44:  # Base64 encoded 32 bytes = 44 chars
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=b'airyatra_kyc_salt',  # In production, use unique salt per file
                iterations=100000,
            )
            key = base64.urlsafe_b64encode(kdf.derive(key_bytes))
        else:
            key = key_bytes
        
        return Fernet(key)
    
    def encrypt_file(self, file_content: bytes) -> tuple:
        """
        Encrypt file content
        
        Returns:
            tuple: (encrypted_content, metadata_dict)
        """
        encrypted = self.fernet.encrypt(file_content)
        
        metadata = {
            "encrypted": True,
            "algorithm": "AES-256-CBC",  # Fernet uses AES-128-CBC internally, but this is marketing name
            "encrypted_at": datetime.now(timezone.utc).isoformat(),
            "original_size": len(file_content),
            "encrypted_size": len(encrypted)
        }
        
        return encrypted, metadata
    
    def decrypt_file(self, encrypted_content: bytes) -> bytes:
        """
        Decrypt file content
        
        Returns:
            bytes: Decrypted file content
        
        Raises:
            InvalidToken: If decryption fails
        """
        return self.fernet.decrypt(encrypted_content)
    
    def encrypt_file_to_disk(self, source_path: str, dest_path: str = None) -> dict:
        """
        Encrypt a file and save to disk
        
        Args:
            source_path: Path to unencrypted file
            dest_path: Path for encrypted file (default: source_path + '.enc')
        
        Returns:
            dict: Encryption metadata
        """
        if not dest_path:
            dest_path = source_path + '.enc'
        
        with open(source_path, 'rb') as f:
            content = f.read()
        
        encrypted, metadata = self.encrypt_file(content)
        
        with open(dest_path, 'wb') as f:
            f.write(encrypted)
        
        # Optionally delete original
        # os.remove(source_path)
        
        metadata["source_path"] = source_path
        metadata["encrypted_path"] = dest_path
        
        return metadata
    
    def decrypt_file_from_disk(self, encrypted_path: str, dest_path: str = None) -> str:
        """
        Decrypt a file from disk
        
        Args:
            encrypted_path: Path to encrypted file
            dest_path: Path for decrypted file (default: remove .enc extension)
        
        Returns:
            str: Path to decrypted file
        """
        if not dest_path:
            if encrypted_path.endswith('.enc'):
                dest_path = encrypted_path[:-4]
            else:
                dest_path = encrypted_path + '.dec'
        
        with open(encrypted_path, 'rb') as f:
            encrypted = f.read()
        
        decrypted = self.decrypt_file(encrypted)
        
        with open(dest_path, 'wb') as f:
            f.write(decrypted)
        
        return dest_path


# =============================================================================
# HELPER DECORATORS
# =============================================================================

def audit_action(
    action: str,
    category: str,
    resource_type: str = None,
    risk_level: str = "low"
):
    """
    Decorator to automatically audit an endpoint
    
    Usage:
        @audit_action(AuditLogger.ACTION_DELETE, AuditLogger.CATEGORY_DATA_MODIFY, "document", "high")
        async def delete_document(doc_id: str, current_user: dict = Depends(get_current_user)):
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            request = kwargs.get('request')
            current_user = kwargs.get('current_user', {})
            
            # Get audit logger from app state or create new one
            from database import get_database
            db = get_database()
            audit = AuditLogger(db)
            
            # Extract user info
            user_id = current_user.get("id") or current_user.get("_id")
            user_email = current_user.get("email")
            user_roles = current_user.get("roles", [])
            
            # Extract client info
            ip_address = None
            user_agent = None
            if request:
                ip_address = get_client_ip(request)
                user_agent = request.headers.get("User-Agent")
            
            # Get resource ID from kwargs
            resource_id = None
            for key in ["doc_id", "document_id", "user_id", "id", "booking_id"]:
                if key in kwargs:
                    resource_id = kwargs[key]
                    break
            
            try:
                result = await func(*args, **kwargs)
                
                # Log successful action
                await audit.log(
                    action=action,
                    category=category,
                    user_id=str(user_id) if user_id else None,
                    user_email=user_email,
                    user_roles=user_roles,
                    resource_type=resource_type,
                    resource_id=str(resource_id) if resource_id else None,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    status="success",
                    risk_level=risk_level
                )
                
                return result
                
            except Exception as e:
                # Log failed action
                await audit.log(
                    action=action,
                    category=category,
                    user_id=str(user_id) if user_id else None,
                    user_email=user_email,
                    user_roles=user_roles,
                    resource_type=resource_type,
                    resource_id=str(resource_id) if resource_id else None,
                    details={"error": str(e)},
                    ip_address=ip_address,
                    user_agent=user_agent,
                    status="failure",
                    risk_level=risk_level
                )
                raise
        
        return wrapper
    return decorator


# =============================================================================
# INITIALIZATION
# =============================================================================

def init_security_middleware(app, db):
    """Initialize all security middleware"""
    
    # Add rate limiter
    app.state.limiter = limiter
    
    # Add audit logger
    app.state.audit_logger = AuditLogger(db)
    
    # Add session manager
    app.state.session_manager = SessionManager(db)
    
    # Add file encryption
    app.state.file_encryption = FileEncryption()
    
    return {
        "limiter": app.state.limiter,
        "audit_logger": app.state.audit_logger,
        "session_manager": app.state.session_manager,
        "file_encryption": app.state.file_encryption
    }
