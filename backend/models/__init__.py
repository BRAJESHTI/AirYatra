"""
AirYatra Backend Models Package
==============================

This package contains all Pydantic models and MongoDB schemas for the AirYatra platform.

Modules:
--------
- document_vault_models: Digital Document Vault (Document [4])
- operator_verification_models: Operator & Aircraft Verification (Document [1][3])
- complaint_penalty_models: Complaints, Penalties, CSS (Document [5])
- corporate_membership_models: Corporate Memberships (Document [2])
- vre_models: Verification Rule Engine
"""

# ============= BACKWARD COMPATIBILITY =============
# Import all models from the original models.py file (located at /app/backend/models.py)
# This ensures existing routes that use "from models import X" continue to work
import sys
import importlib.util

# Load the original models.py as a module
_original_models_path = "/app/backend/models.py"
_spec = importlib.util.spec_from_file_location("_original_models", _original_models_path)
_original_models = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_original_models)

# Export all public names from original models.py
for _name in dir(_original_models):
    if not _name.startswith('_'):
        globals()[_name] = getattr(_original_models, _name)

# Document Vault Models
from .document_vault_models import (
    # Enums
    DocumentCategory,
    VaultDocumentType,
    DocumentVaultStatus,
    SharePermission,
    
    # Schemas
    DocumentVaultSchema,
    DocumentFolderSchema,
    DocumentAuditLogSchema,
    
    # API Models
    DocumentUploadModel,
    DocumentUpdateModel,
    DocumentShareCreate,
    DocumentVerificationModel,
    FolderCreate,
    BulkDocumentAction,
    DocumentVaultResponse,
    DocumentStatsResponse,
)

# Operator & Aircraft Verification Models
from .operator_verification_models import (
    # Enums
    OperatorVerificationStatus,
    DocumentVerificationStatus,
    AircraftStatus,
    
    # Section Models
    OperatorCompanyDocuments,
    OperatorDGCADocuments,
    AircraftBasicInfo,
    AircraftAirworthiness,
    AircraftInsurance,
    AircraftMaintenance,
    AircraftFlightCrew,
    AircraftSafetyEquipment,
    AircraftPhotos,
    
    # Schemas
    OperatorVerificationSchema,
    AircraftVerificationSchema,
    
    # API Models
    OperatorVerificationCreate,
    OperatorVerificationUpdate,
    OperatorVerificationAction,
    AircraftVerificationCreate,
    AircraftVerificationUpdate,
    VerificationDashboardResponse,
)

# Complaint & Penalty Models
from .complaint_penalty_models import (
    # Enums
    ComplaintStatus,
    ComplaintSeverity,
    ComplaintCategory,
    ComplaintDecision,
    PenaltyType,
    PenaltyRule,
    PenaltyStatus,
    CSSAction,
    OperatorCooperationStatus,
    
    # Schemas
    ComplaintSchema,
    PenaltySchema,
    ForcedReschedulingSchema,
    CustomerSatisfactionScoreSchema,
    
    # API Models
    ComplaintCreate,
    ComplaintUpdate,
    ComplaintInvestigationCreate,
    OperatorResponseCreate,
    PenaltyCreate,
    ForcedReschedulingCreate,
    CSSCalculationRequest,
    ComplaintResponse,
    PenaltyResponse,
    CSSResponse,
    ComplaintDashboardStats,
    PenaltyDashboardStats,
)

# Corporate Membership Models
from .corporate_membership_models import (
    # Enums
    MembershipTier,
    MembershipStatus,
    BillingCycle,
    CorporateAccountStatus,
    
    # Schemas
    CorporateMembershipSchema,
    CorporateBookingPolicySchema,
    
    # API Models
    CorporateMembershipCreate,
    CorporateMembershipUpdate,
    AuthorizedBookerCreate,
    VolumeDiscountTier,
    CorporateBookingPolicyCreate,
    CorporateDashboardResponse,
    CorporateInvoiceSummary,
)

# Existing VRE Models (if present)
try:
    from .vre_models import (
        VerificationMode,
        DocumentType,
        VerificationService,
        VerificationConfigSchema,
        VREInit,
        VREConfigUpdate,
        VREDashboardResponse,
    )
except ImportError:
    pass

__all__ = [
    # Document Vault
    "DocumentCategory",
    "VaultDocumentType",
    "DocumentVaultStatus",
    "SharePermission",
    "DocumentVaultSchema",
    "DocumentFolderSchema",
    "DocumentAuditLogSchema",
    "DocumentUploadModel",
    "DocumentUpdateModel",
    "DocumentShareCreate",
    "DocumentVerificationModel",
    "FolderCreate",
    "BulkDocumentAction",
    "DocumentVaultResponse",
    "DocumentStatsResponse",
    
    # Operator & Aircraft Verification
    "OperatorVerificationStatus",
    "DocumentVerificationStatus",
    "AircraftStatus",
    "OperatorCompanyDocuments",
    "OperatorDGCADocuments",
    "AircraftBasicInfo",
    "AircraftAirworthiness",
    "AircraftInsurance",
    "AircraftMaintenance",
    "AircraftFlightCrew",
    "AircraftSafetyEquipment",
    "AircraftPhotos",
    "OperatorVerificationSchema",
    "AircraftVerificationSchema",
    "OperatorVerificationCreate",
    "OperatorVerificationUpdate",
    "OperatorVerificationAction",
    "AircraftVerificationCreate",
    "AircraftVerificationUpdate",
    "VerificationDashboardResponse",
    
    # Complaint & Penalty
    "ComplaintStatus",
    "ComplaintSeverity",
    "ComplaintCategory",
    "ComplaintDecision",
    "PenaltyType",
    "PenaltyRule",
    "PenaltyStatus",
    "CSSAction",
    "OperatorCooperationStatus",
    "ComplaintSchema",
    "PenaltySchema",
    "ForcedReschedulingSchema",
    "CustomerSatisfactionScoreSchema",
    "ComplaintCreate",
    "ComplaintUpdate",
    "ComplaintInvestigationCreate",
    "OperatorResponseCreate",
    "PenaltyCreate",
    "ForcedReschedulingCreate",
    "CSSCalculationRequest",
    "ComplaintResponse",
    "PenaltyResponse",
    "CSSResponse",
    "ComplaintDashboardStats",
    "PenaltyDashboardStats",
    
    # Corporate Membership
    "MembershipTier",
    "MembershipStatus",
    "BillingCycle",
    "CorporateAccountStatus",
    "CorporateMembershipSchema",
    "CorporateBookingPolicySchema",
    "CorporateMembershipCreate",
    "CorporateMembershipUpdate",
    "AuthorizedBookerCreate",
    "VolumeDiscountTier",
    "CorporateBookingPolicyCreate",
    "CorporateDashboardResponse",
    "CorporateInvoiceSummary",
]
