"""
Operator & Aircraft Verification Models - AirYatra Aviation Platform

Based on Document [1] & [3] requirements:
- Section A: Company Documents
- Section B: DGCA & Operator Documents
- Section C: Aircraft Documents (Basic, Airworthiness, Insurance, Maintenance, Crew, Safety)
"""

from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

# ============= ENUMS =============

class OperatorVerificationStatus(str, Enum):
    PENDING = "pending"
    DOCUMENTS_SUBMITTED = "documents_submitted"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    SUSPENDED = "suspended"
    DELISTED = "delisted"


class DocumentVerificationStatus(str, Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"
    EXPIRED = "expired"
    EXPIRING_SOON = "expiring_soon"


class AircraftStatus(str, Enum):
    ACTIVE = "active"
    GROUNDED = "grounded"
    MAINTENANCE = "maintenance"
    DELISTED = "delisted"
    PENDING_VERIFICATION = "pending_verification"


# ============= SECTION A: COMPANY DOCUMENTS =============

class OperatorCompanyDocuments(BaseModel):
    """
    SECTION A — Operator Verification (Company Documents) [Document 1]
    """
    # Certificate of Incorporation
    certificate_of_incorporation_url: Optional[str] = None
    certificate_verified: bool = False
    certificate_verified_at: Optional[datetime] = None
    
    # PAN Card
    pan_card_url: Optional[str] = None
    pan_number: Optional[str] = None
    pan_verified: bool = False
    pan_verified_at: Optional[datetime] = None
    
    # GST Registration
    gst_registration_url: Optional[str] = None
    gst_number: Optional[str] = None
    gst_verified: bool = False
    gst_verified_at: Optional[datetime] = None
    gst_expiry_date: Optional[datetime] = None
    
    # CIN/LLP Number
    cin_llp_url: Optional[str] = None
    cin_number: Optional[str] = None
    cin_verified: bool = False
    cin_verified_at: Optional[datetime] = None
    
    # Registered Office Address Proof
    registered_office_address_proof_url: Optional[str] = None  # utility bill, lease, property doc
    address_verified: bool = False
    address_verified_at: Optional[datetime] = None
    
    # Authorized Signatory ID
    authorized_signatory_id_url: Optional[str] = None  # Aadhaar/Passport/Driving Licence
    signatory_name: Optional[str] = None
    signatory_verified: bool = False
    signatory_verified_at: Optional[datetime] = None
    
    # Bank Account Details
    bank_account_url: Optional[str] = None  # cancelled cheque or bank letter
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_ifsc: Optional[str] = None
    bank_verified: bool = False
    bank_verified_at: Optional[datetime] = None
    
    # Personal Guarantee
    personal_guarantee_url: Optional[str] = None  # Director/owner surety document
    guarantee_verified: bool = False
    guarantee_verified_at: Optional[datetime] = None


# ============= SECTION B: DGCA DOCUMENTS =============

class OperatorDGCADocuments(BaseModel):
    """
    SECTION B — DGCA & Operator Documents [Document 1]
    """
    # Air Operator Certificate (AOC)
    aoc_certificate_url: Optional[str] = None
    aoc_number: Optional[str] = None
    aoc_valid: bool = False
    aoc_expiry_date: Optional[datetime] = None
    aoc_verified_at: Optional[datetime] = None
    
    # DGCA Permissions
    dgca_permissions_url: Optional[str] = None
    dgca_permissions_valid: bool = False
    dgca_permissions_expiry_date: Optional[datetime] = None
    
    # Operations Specifications
    operations_specifications_url: Optional[str] = None
    operations_specs_valid: bool = False
    
    # Category Justification (If AOC not required)
    category_justification_url: Optional[str] = None
    category_justification_notes: Optional[str] = None
    
    # DGCA Approval Letter
    dgca_approval_letter_url: Optional[str] = None
    dgca_approval_verified: bool = False
    dgca_approval_verified_at: Optional[datetime] = None


# ============= SECTION C: AIRCRAFT DOCUMENTS =============

class AircraftBasicInfo(BaseModel):
    """SECTION C — Aircraft Documents (Basic Information) [Document 1/3]"""
    
    registration_certificate_url: Optional[str] = None
    registration_verified: bool = False
    registration_verified_at: Optional[datetime] = None
    
    # Aircraft Details
    aircraft_type: Optional[str] = None  # Helicopter, Seaplane, etc
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    year_of_manufacture: Optional[int] = None
    registration_number: Optional[str] = None  # VT-XXX format
    serial_number: Optional[str] = None  # Manufacturer's serial
    total_seats_capacity: Optional[int] = None
    
    # Operating Category
    operating_category: Optional[str] = None  # VIP, Commercial, Charter
    base_location: Optional[str] = None


class AircraftAirworthiness(BaseModel):
    """SECTION C — Airworthiness Documents [Document 1/3]"""
    
    # Certificate of Airworthiness
    certificate_of_airworthiness_url: Optional[str] = None
    coa_number: Optional[str] = None
    coa_valid: bool = False
    coa_expiry_date: Optional[datetime] = None
    coa_verified_at: Optional[datetime] = None
    
    # Certificate of Registration
    certificate_of_registration_url: Optional[str] = None
    registration_verified: bool = False
    
    # Maintenance Release - CRITICAL
    maintenance_release_url: Optional[str] = None
    maintenance_release_current: bool = False  # CRITICAL: Lapsed = delisting
    maintenance_release_verified: bool = False
    maintenance_release_verified_at: Optional[datetime] = None
    maintenance_release_expiry_date: Optional[datetime] = None


class AircraftInsurance(BaseModel):
    """SECTION C — Insurance Documents [Document 1/3]"""
    
    # Insurance Certificate
    insurance_certificate_url: Optional[str] = None
    insurance_valid: bool = False
    insurance_expiry_date: Optional[datetime] = None
    
    # Insurer Details
    insurer_name: Optional[str] = None
    policy_number: Optional[str] = None
    
    # Coverage Details (in INR)
    passenger_liability_coverage: Optional[int] = None
    third_party_coverage: Optional[int] = None
    hull_coverage: Optional[int] = None
    
    # Insurer Verification
    insurer_contact_phone: Optional[str] = None
    insurer_contact_email: Optional[str] = None
    insurer_directly_verified: bool = False
    insurer_verification_date: Optional[datetime] = None


class AircraftMaintenance(BaseModel):
    """SECTION C — Maintenance Documents [Document 1/3]"""
    
    # Maintenance Release
    latest_maintenance_release_url: Optional[str] = None
    last_maintenance_date: Optional[datetime] = None
    next_scheduled_maintenance_date: Optional[datetime] = None
    
    # CAMO Provider
    camo_provider_name: Optional[str] = None  # Continuing Airworthiness Maintenance Organization
    camo_contact: Optional[str] = None
    
    # Maintenance Records
    maintenance_records_urls: List[str] = []  # Last 12 months
    maintenance_records_verified: bool = False
    maintenance_records_verified_at: Optional[datetime] = None
    
    # Flight Hours
    total_flight_hours: Optional[int] = None
    hours_since_last_overhaul: Optional[int] = None


class AircraftFlightCrew(BaseModel):
    """SECTION C — Flight Crew Documents [Document 1/3]"""
    
    # Primary Pilot Details
    pilot_name: Optional[str] = None
    pilot_license_number: Optional[str] = None
    pilot_license_url: Optional[str] = None
    pilot_ratings: List[str] = []  # Type ratings
    
    # Experience
    pilot_experience_total_hours: Optional[int] = None
    pilot_experience_type_specific_hours: Optional[int] = None
    
    # Medical
    pilot_medical_class: Optional[str] = None  # Class 1/2/3
    pilot_medical_validity: Optional[datetime] = None
    pilot_medical_certificate_url: Optional[str] = None
    pilot_medical_verified: bool = False
    
    # Emergency Training
    emergency_procedures_training_date: Optional[datetime] = None
    emergency_procedures_training_verified: bool = False
    
    # Co-pilot Details (if required)
    copilot_name: Optional[str] = None
    copilot_license_number: Optional[str] = None
    copilot_license_url: Optional[str] = None
    copilot_ratings: List[str] = []
    copilot_medical_validity: Optional[datetime] = None


class AircraftSafetyEquipment(BaseModel):
    """
    Emergency/Safety Equipment Declaration [Document 1/3]
    WARNING: False claims → penalty + delisting
    """
    
    # First Aid Kit
    first_aid_kit_present: bool = False
    first_aid_kit_certification_date: Optional[datetime] = None
    
    # Fire Extinguishers
    fire_extinguishers_present: bool = False
    fire_extinguisher_types: List[str] = []
    fire_extinguisher_certification_date: Optional[datetime] = None
    
    # Emergency Locator Transmitter (ELT)
    elt_present: bool = False
    elt_operational: bool = False
    elt_last_test_date: Optional[datetime] = None
    
    # Life Jackets
    life_jackets_present: bool = False
    life_jacket_type: Optional[str] = None
    life_jacket_quantity: Optional[int] = None
    life_jacket_inspection_date: Optional[datetime] = None
    
    # Oxygen Kit
    oxygen_kit_present: bool = False
    oxygen_kit_type: Optional[str] = None
    oxygen_kit_refill_status: Optional[str] = None
    oxygen_kit_last_refill_date: Optional[datetime] = None
    
    # Emergency Beacon
    emergency_beacon_present: bool = False
    
    # Life Raft (for overwater operations)
    life_raft_present: bool = False
    life_raft_capacity: Optional[int] = None
    life_raft_inspection_date: Optional[datetime] = None


class AircraftPhotos(BaseModel):
    """High-Resolution Aircraft Photos [Document 1/3]"""
    
    front_view_nose: Optional[str] = None
    rear_view_tail: Optional[str] = None
    left_side_exterior: Optional[str] = None
    right_side_exterior: Optional[str] = None
    cockpit_interior: Optional[str] = None
    cabin_interior_passenger_area: Optional[str] = None
    vip_cabin_section: Optional[str] = None
    emergency_exits_equipment: Optional[str] = None


# ============= COMPLETE OPERATOR VERIFICATION MODEL =============

class OperatorVerificationSchema:
    """
    MongoDB schema for complete Operator Verification
    Collection: operator_verifications
    """
    
    @staticmethod
    def get_schema():
        return {
            "verification_id": str,
            "operator_id": str,
            
            # Section A: Company Documents
            "company_documents": dict,  # OperatorCompanyDocuments
            
            # Section B: DGCA Documents
            "dgca_documents": dict,  # OperatorDGCADocuments
            
            # Overall Status
            "overall_status": str,  # OperatorVerificationStatus
            
            # Verification Tracking
            "company_docs_verified": bool,
            "company_docs_verified_at": datetime,
            "dgca_docs_verified": bool,
            "dgca_docs_verified_at": datetime,
            
            # Verified By
            "verified_by": str,
            "verified_at": datetime,
            "verification_notes": str,
            
            # Rejection
            "rejection_reason": str,
            "rejected_at": datetime,
            "rejected_by": str,
            
            # Suspension/Delisting
            "suspension_reason": str,
            "suspended_at": datetime,
            "delisting_reason": str,
            "delisted_at": datetime,
            
            # Re-verification
            "last_verification_date": datetime,
            "next_verification_due": datetime,
            "verification_frequency_days": int,
            
            # Timestamps
            "created_at": datetime,
            "updated_at": datetime,
        }


# ============= COMPLETE AIRCRAFT VERIFICATION MODEL =============

class AircraftVerificationSchema:
    """
    MongoDB schema for complete Aircraft Verification
    Collection: aircraft_verifications
    """
    
    @staticmethod
    def get_schema():
        return {
            "verification_id": str,
            "aircraft_id": str,
            "operator_id": str,
            
            # All Sections
            "basic_info": dict,  # AircraftBasicInfo
            "airworthiness": dict,  # AircraftAirworthiness
            "insurance": dict,  # AircraftInsurance
            "maintenance": dict,  # AircraftMaintenance
            "flight_crew": dict,  # AircraftFlightCrew
            "safety_equipment": dict,  # AircraftSafetyEquipment
            "photos": dict,  # AircraftPhotos
            
            # Overall Status
            "overall_status": str,  # DocumentVerificationStatus
            
            # Critical Items (instant delisting if expired)
            "maintenance_release_current": bool,
            "insurance_valid": bool,
            "pilot_medical_valid": bool,
            "all_documents_valid": bool,
            
            # Verification
            "fully_verified": bool,
            "fully_verified_at": datetime,
            "verified_by": str,
            
            # Delisting
            "delisting_reason": str,
            "delisted_at": datetime,
            
            # Timestamps
            "created_at": datetime,
            "updated_at": datetime,
        }


# ============= PYDANTIC API MODELS =============

class OperatorVerificationCreate(BaseModel):
    """Create operator verification request"""
    operator_id: str
    company_documents: Optional[OperatorCompanyDocuments] = None
    dgca_documents: Optional[OperatorDGCADocuments] = None


class OperatorVerificationUpdate(BaseModel):
    """Update operator verification"""
    company_documents: Optional[OperatorCompanyDocuments] = None
    dgca_documents: Optional[OperatorDGCADocuments] = None
    verification_notes: Optional[str] = None


class OperatorVerificationAction(BaseModel):
    """Admin action on operator verification"""
    action: str  # approve, reject, suspend, delist
    reason: Optional[str] = None
    notes: Optional[str] = None


class AircraftVerificationCreate(BaseModel):
    """Create aircraft verification request"""
    aircraft_id: str
    operator_id: str
    basic_info: Optional[AircraftBasicInfo] = None
    airworthiness: Optional[AircraftAirworthiness] = None
    insurance: Optional[AircraftInsurance] = None
    maintenance: Optional[AircraftMaintenance] = None
    flight_crew: Optional[AircraftFlightCrew] = None
    safety_equipment: Optional[AircraftSafetyEquipment] = None
    photos: Optional[AircraftPhotos] = None


class AircraftVerificationUpdate(BaseModel):
    """Update aircraft verification"""
    basic_info: Optional[AircraftBasicInfo] = None
    airworthiness: Optional[AircraftAirworthiness] = None
    insurance: Optional[AircraftInsurance] = None
    maintenance: Optional[AircraftMaintenance] = None
    flight_crew: Optional[AircraftFlightCrew] = None
    safety_equipment: Optional[AircraftSafetyEquipment] = None
    photos: Optional[AircraftPhotos] = None


class VerificationDashboardResponse(BaseModel):
    """Dashboard response for verification status"""
    operator_id: str
    operator_name: str
    company_docs_status: str
    dgca_docs_status: str
    overall_status: str
    aircraft_count: int
    verified_aircraft_count: int
    pending_items: List[str]
    expiring_soon: List[Dict[str, Any]]
    last_verified: Optional[datetime]
    next_verification_due: Optional[datetime]
