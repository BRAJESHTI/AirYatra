"""
AirYatra - PII Field-Level Encryption Service
Encrypts sensitive PII fields before storing in MongoDB
Uses AES-256-GCM for authenticated encryption
"""

import os
import base64
import hashlib
import logging
from typing import Any, Dict, List, Optional, Union
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
import secrets

logger = logging.getLogger(__name__)

# Encryption key from environment (32 bytes for AES-256)
PII_ENCRYPTION_KEY = os.environ.get("PII_ENCRYPTION_KEY", "")
PII_ENCRYPTION_ENABLED = os.environ.get("PII_ENCRYPTION_ENABLED", "true").lower() == "true"

# Fields that contain PII and should be encrypted
PII_FIELDS = {
    "users": ["phone", "aadhaar_number", "pan_number", "bank_account", "ifsc_code"],
    "customers": ["phone", "email", "address", "aadhaar_number", "pan_number"],
    "kyc_documents": ["document_number", "aadhaar_number", "pan_number", "passport_number", "dl_number"],
    "pilots": ["phone", "aadhaar_number", "license_number", "medical_certificate_number"],
    "operators": ["contact_phone", "gst_number", "pan_number", "bank_account"],
    "employees": ["phone", "aadhaar_number", "pan_number", "bank_account", "address"],
    "payments": ["card_last_four", "upi_id"],
    "bookings": ["passenger_phone", "passenger_email", "passenger_aadhaar"],
}

# Prefix for encrypted values (to identify encrypted data)
ENCRYPTED_PREFIX = "enc:v1:"


class PIIEncryptionService:
    """
    Field-level encryption for PII data in MongoDB
    Uses AES-256-GCM with random nonces
    """
    
    def __init__(self):
        self.enabled = PII_ENCRYPTION_ENABLED
        self._key = None
        self._aesgcm = None
        
        if self.enabled:
            self._initialize_key()
    
    def _initialize_key(self):
        """Initialize encryption key from environment or generate"""
        if PII_ENCRYPTION_KEY:
            # Derive key from provided secret
            key_bytes = PII_ENCRYPTION_KEY.encode('utf-8')
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=b"airyatra_pii_salt",  # Static salt (key should be random enough)
                iterations=100000,
                backend=default_backend()
            )
            self._key = kdf.derive(key_bytes)
        else:
            # Generate a random key (should be persisted in production)
            self._key = secrets.token_bytes(32)
            logger.warning("PII_ENCRYPTION_KEY not set - using random key (will not persist across restarts)")
        
        self._aesgcm = AESGCM(self._key)
    
    def encrypt_value(self, plaintext: str) -> str:
        """
        Encrypt a single value using AES-256-GCM
        Returns base64-encoded ciphertext with prefix
        """
        if not self.enabled or not plaintext:
            return plaintext
        
        if plaintext.startswith(ENCRYPTED_PREFIX):
            # Already encrypted
            return plaintext
        
        try:
            # Generate random 12-byte nonce
            nonce = secrets.token_bytes(12)
            
            # Encrypt
            plaintext_bytes = plaintext.encode('utf-8')
            ciphertext = self._aesgcm.encrypt(nonce, plaintext_bytes, None)
            
            # Combine nonce + ciphertext and base64 encode
            combined = nonce + ciphertext
            encoded = base64.b64encode(combined).decode('utf-8')
            
            return f"{ENCRYPTED_PREFIX}{encoded}"
        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            return plaintext
    
    def decrypt_value(self, ciphertext: str) -> str:
        """
        Decrypt a single value encrypted with AES-256-GCM
        """
        if not self.enabled or not ciphertext:
            return ciphertext
        
        if not ciphertext.startswith(ENCRYPTED_PREFIX):
            # Not encrypted
            return ciphertext
        
        try:
            # Remove prefix and decode
            encoded = ciphertext[len(ENCRYPTED_PREFIX):]
            combined = base64.b64decode(encoded)
            
            # Extract nonce (first 12 bytes) and ciphertext
            nonce = combined[:12]
            ct = combined[12:]
            
            # Decrypt
            plaintext_bytes = self._aesgcm.decrypt(nonce, ct, None)
            return plaintext_bytes.decode('utf-8')
        except Exception as e:
            logger.error(f"Decryption failed: {e}")
            return ciphertext
    
    def encrypt_document(self, collection: str, document: Dict[str, Any]) -> Dict[str, Any]:
        """
        Encrypt PII fields in a document before storing
        """
        if not self.enabled:
            return document
        
        pii_fields = PII_FIELDS.get(collection, [])
        if not pii_fields:
            return document
        
        encrypted_doc = document.copy()
        
        for field in pii_fields:
            if field in encrypted_doc and encrypted_doc[field]:
                value = encrypted_doc[field]
                if isinstance(value, str):
                    encrypted_doc[field] = self.encrypt_value(value)
        
        return encrypted_doc
    
    def decrypt_document(self, collection: str, document: Dict[str, Any]) -> Dict[str, Any]:
        """
        Decrypt PII fields in a document after retrieval
        """
        if not self.enabled or not document:
            return document
        
        pii_fields = PII_FIELDS.get(collection, [])
        if not pii_fields:
            return document
        
        decrypted_doc = document.copy()
        
        for field in pii_fields:
            if field in decrypted_doc and decrypted_doc[field]:
                value = decrypted_doc[field]
                if isinstance(value, str) and value.startswith(ENCRYPTED_PREFIX):
                    decrypted_doc[field] = self.decrypt_value(value)
        
        return decrypted_doc
    
    def encrypt_documents(self, collection: str, documents: List[Dict]) -> List[Dict]:
        """Encrypt PII in multiple documents"""
        return [self.encrypt_document(collection, doc) for doc in documents]
    
    def decrypt_documents(self, collection: str, documents: List[Dict]) -> List[Dict]:
        """Decrypt PII in multiple documents"""
        return [self.decrypt_document(collection, doc) for doc in documents]
    
    def hash_for_search(self, value: str) -> str:
        """
        Create a searchable hash for encrypted fields
        Allows searching without decryption (exact match only)
        """
        if not value:
            return ""
        
        # Use SHA-256 with salt for deterministic hashing
        salted = f"airyatra_search_salt:{value}"
        return hashlib.sha256(salted.encode()).hexdigest()
    
    def mask_pii(self, value: str, field_type: str = "default") -> str:
        """
        Mask PII for display (e.g., in logs or limited views)
        """
        if not value:
            return ""
        
        # Decrypt if encrypted
        if value.startswith(ENCRYPTED_PREFIX):
            value = self.decrypt_value(value)
        
        if field_type == "phone":
            # Show last 4 digits: ******7890
            return f"******{value[-4:]}" if len(value) >= 4 else "****"
        
        elif field_type == "email":
            # Show first 2 and domain: ab***@domain.com
            parts = value.split("@")
            if len(parts) == 2:
                local = parts[0][:2] + "***" if len(parts[0]) > 2 else "***"
                return f"{local}@{parts[1]}"
            return "***@***"
        
        elif field_type == "aadhaar":
            # Show last 4 digits: XXXX-XXXX-1234
            return f"XXXX-XXXX-{value[-4:]}" if len(value) >= 4 else "XXXX-XXXX-XXXX"
        
        elif field_type == "pan":
            # Show first 2 and last 2: AB***12X
            if len(value) >= 4:
                return f"{value[:2]}***{value[-2:]}"
            return "***"
        
        elif field_type == "bank_account":
            # Show last 4 digits
            return f"XXXX-XXXX-{value[-4:]}" if len(value) >= 4 else "****"
        
        else:
            # Default: show first 2 and last 2
            if len(value) > 4:
                return f"{value[:2]}{'*' * (len(value) - 4)}{value[-2:]}"
            return "*" * len(value)
    
    def get_status(self) -> Dict[str, Any]:
        """Get encryption service status"""
        return {
            "enabled": self.enabled,
            "algorithm": "AES-256-GCM",
            "key_configured": bool(PII_ENCRYPTION_KEY),
            "protected_collections": list(PII_FIELDS.keys()),
            "protected_fields_count": sum(len(fields) for fields in PII_FIELDS.values())
        }


# Singleton instance
pii_encryption = PIIEncryptionService()


# MongoDB wrapper functions for easy integration
async def encrypt_before_insert(collection: str, document: Dict) -> Dict:
    """Encrypt PII before inserting into MongoDB"""
    return pii_encryption.encrypt_document(collection, document)


async def decrypt_after_find(collection: str, document: Dict) -> Dict:
    """Decrypt PII after finding from MongoDB"""
    return pii_encryption.decrypt_document(collection, document)


async def decrypt_after_find_many(collection: str, documents: List[Dict]) -> List[Dict]:
    """Decrypt PII after finding multiple documents"""
    return pii_encryption.decrypt_documents(collection, documents)
