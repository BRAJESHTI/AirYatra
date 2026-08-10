"""
Document Vault Models - AirYatra Aviation Platform
Digital Document Storage with Compliance Features

Based on Document [4] requirements:
- AirYatra owns and controls vault access
- Operator cannot request deletion
- Documents retained for minimum 5 years
"""

from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from enum import Enum

# ============= ENUMS =============

class DocumentCategory(str, Enum):
    DGCA = "dgca"
    INSURANCE = "insurance"
    AIRCRAFT = "aircraft"
    PILOT = "pilot"
    OPERATOR = "operator"
    CORPORATE = "corporate"
    PERSONAL = "personal"
    CONTRACT = "contract"
    INVOICE = "invoice"
    OTHER = "other"


class VaultDocumentType(str, Enum):
    # Aircraft Documents
    REGISTRATION = "registration"
    AIRWORTHINESS = "airworthiness"
    MAINTENANCE_RECORD = "maintenance_record"
    
    # Company Documents
    GST_CERTIFICATE = "gst_certificate"
    PAN_CARD = "pan_card"
    COMPANY_REGISTRATION = "company_registration"
    
    # Personal ID Documents
    AADHAAR = "aadhaar"
    PASSPORT = "passport"
    VOTER_ID = "voter_id"
    DRIVING_LICENSE = "driving_license"
    
    # DGCA Documents
    AOC_CERTIFICATE = "aoc_certificate"
    PPC = "ppc"
    MEDICAL = "medical"
    PILOT_LICENSE = "pilot_license"
    TYPE_RATING = "type_rating"
    
    # Insurance Documents
    HULL_INSURANCE = "hull_insurance"
    LIABILITY_INSURANCE = "liability_insurance"
    PASSENGER_INSURANCE = "passenger_insurance"
    
    # Other
    MAINTENANCE_RELEASE = "maintenance_release"
    SERVICE_AGREEMENT = "service_agreement"
    NDA = "nda"
    BOOKING_CONTRACT = "booking_contract"
    OTHER = "other"


class DocumentVaultStatus(str, Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    EXPIRING_SOON = "expiring_soon"
    ARCHIVED = "archived"
    PENDING_VERIFICATION = "pending_verification"
    VERIFIED = "verified"
    REJECTED = "rejected"


class SharePermission(str, Enum):
    VIEW = "view"
    DOWNLOAD = "download"
    EDIT = "edit"


# ============= MONGODB DOCUMENT SCHEMAS =============

class DocumentVaultSchema:
    """
    MongoDB schema for Document Vault
    Collection: document_vault
    """
    
    @staticmethod
    def get_schema():
        return {
            "document_id": str,  # Unique ID
            "owner_id": str,  # User ID of owner
            "owner_type": str,  # operator, customer, corporate, pilot, helipad_owner
            
            # Document Details
            "document_name": str,
            "category": str,  # DocumentCategory enum
            "document_type": str,  # VaultDocumentType enum
            "description": str,
            
            # File Information
            "file_url": str,
            "file_size": int,  # in bytes
            "file_format": str,  # pdf, jpg, png, etc
            "file_hash": str,  # SHA256 for integrity
            
            # Document Metadata
            "reference_number": str,  # Certificate number, Licence number, etc
            "issued_by": str,
            "issued_date": datetime,
            "expiry_date": datetime,
            
            # Status & Verification
            "status": str,  # DocumentVaultStatus
            "is_verified": bool,
            "verified_by": str,
            "verified_at": datetime,
            "verification_notes": str,
            
            # Security
            "is_sensitive": bool,
            "encryption_key": str,
            
            # Tags & Organization
            "tags": list,
            "folder_id": str,
            
            # Expiry Reminders
            "reminder_days": int,
            "reminder_sent": bool,
            "reminder_sent_at": datetime,
            
            # Sharing
            "shared_with": list,  # [{"email": str, "permission": str, "shared_at": datetime}]
            
            # Audit Trail
            "created_at": datetime,
            "created_by": str,
            "updated_at": datetime,
            "updated_by": str,
            "deleted_at": datetime,  # Soft delete
            
            # Compliance (Document [4])
            "retention_expiry_date": datetime,  # Min 5 years
            "can_be_deleted": bool,  # Always False for compliance
        }


class DocumentFolderSchema:
    """MongoDB schema for Document Folders"""
    
    @staticmethod
    def get_schema():
        return {
            "folder_id": str,
            "owner_id": str,
            "parent_folder_id": str,
            "folder_name": str,
            "description": str,
            "color": str,
            "icon": str,
            "document_count": int,
            "created_at": datetime,
            "updated_at": datetime,
        }


class DocumentAuditLogSchema:
    """MongoDB schema for Document Audit Logs"""
    
    @staticmethod
    def get_schema():
        return {
            "audit_id": str,
            "document_id": str,
            "action": str,  # upload, download, view, share, delete, verify, update
            "performed_by": str,
            "performed_by_role": str,
            "ip_address": str,
            "user_agent": str,
            "timestamp": datetime,
            "shared_with_email": str,
            "permission_granted": str,
        }


# ============= PYDANTIC SCHEMAS FOR API =============

class DocumentUploadModel(BaseModel):
    """Schema for document upload"""
    name: str
    category: DocumentCategory
    document_type: VaultDocumentType
    description: Optional[str] = None
    expiry_date: Optional[datetime] = None
    reference_number: Optional[str] = None
    issued_by: Optional[str] = None
    issued_date: Optional[datetime] = None
    tags: List[str] = []
    is_sensitive: bool = False
    reminder_days: int = 30


class DocumentUpdateModel(BaseModel):
    """Schema for document update"""
    name: Optional[str] = None
    description: Optional[str] = None
    expiry_date: Optional[datetime] = None
    reference_number: Optional[str] = None
    tags: Optional[List[str]] = None
    reminder_days: Optional[int] = None
    status: Optional[DocumentVaultStatus] = None


class DocumentShareCreate(BaseModel):
    """Schema for sharing document"""
    document_id: str
    shared_with_email: EmailStr
    permission: SharePermission
    expiry_date: Optional[datetime] = None
    message: Optional[str] = None
    requires_otp: bool = False


class DocumentVerificationModel(BaseModel):
    """Schema for document verification"""
    document_id: str
    verification_status: DocumentVaultStatus
    verified_by: str
    verification_notes: Optional[str] = None
    verification_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class FolderCreate(BaseModel):
    """Schema for folder creation"""
    name: str
    parent_id: Optional[str] = None
    description: Optional[str] = None
    color: str = "#3B82F6"
    icon: str = "folder"


class BulkDocumentAction(BaseModel):
    """Schema for bulk document operations"""
    document_ids: List[str]
    action: str  # archive, delete, share, etc


class DocumentVaultResponse(BaseModel):
    """Response model for document vault"""
    document_id: str
    document_name: str
    category: str
    document_type: str
    file_url: str
    status: str
    is_verified: bool
    expiry_date: Optional[datetime]
    created_at: datetime
    tags: List[str] = []


class DocumentStatsResponse(BaseModel):
    """Document statistics response"""
    total_documents: int
    verified_documents: int
    pending_verification: int
    expired_documents: int
    expiring_soon: int
    total_size_mb: float
    by_category: Dict[str, int]
    by_type: Dict[str, int]
