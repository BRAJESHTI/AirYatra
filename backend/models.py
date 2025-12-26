from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

class UserRole(str, Enum):
    CUSTOMER = "customer"
    OPERATOR = "operator"
    REGIONAL_MANAGER = "regional_manager"
    HELIPAD_OWNER = "helipad_owner"
    HR = "hr"
    FINANCE = "finance"
    MARKETING = "marketing"
    SALES = "sales"
    SUPPORT = "support"
    OPERATIONS = "operations"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"

class BookingStatus(str, Enum):
    PENDING_QUOTES = "pending_quotes"
    QUOTES_RECEIVED = "quotes_received"
    QUOTE_ACCEPTED = "quote_accepted"
    PAYMENT_PENDING = "payment_pending"
    PAYMENT_COMPLETED = "payment_completed"
    CONFIRMED = "confirmed"
    PILOT_ASSIGNED = "pilot_assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class DocumentType(str, Enum):
    AOC_CERTIFICATE = "aoc_certificate"
    INSURANCE = "insurance"
    PILOT_LICENSE = "pilot_license"
    AIRCRAFT_DOCUMENT = "aircraft_document"
    NOC_DOCUMENT = "noc_document"
    LAND_OWNERSHIP = "land_ownership"

class ApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class OperatorStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    SUSPENDED = "suspended"

class User(BaseModel):
    id: Optional[str] = None
    email: EmailStr
    password_hash: str
    full_name: str
    phone: str
    roles: List[UserRole]
    region: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str
    roles: List[UserRole]
    region: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

class Operator(BaseModel):
    id: Optional[str] = None
    user_id: str
    company_name: str
    base_city: str
    contact_person: str
    contact_phone: str
    contact_email: EmailStr
    gstin: Optional[str] = None
    bank_account: Optional[dict] = None
    status: OperatorStatus = OperatorStatus.PENDING
    verification_status: ApprovalStatus = ApprovalStatus.PENDING
    documents: List[dict] = []
    commission_rate: float = 10.0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class Aircraft(BaseModel):
    id: Optional[str] = None
    operator_id: str
    aircraft_type: str
    registration_number: str
    capacity: int
    base_location: str
    hourly_rate: float
    is_available: bool = True
    maintenance_status: str = "operational"
    documents: List[dict] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class Pilot(BaseModel):
    id: Optional[str] = None
    operator_id: str
    full_name: str
    license_number: str
    phone: str
    email: EmailStr
    experience_years: int
    is_available: bool = True
    documents: List[dict] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class Booking(BaseModel):
    id: Optional[str] = None
    booking_number: str
    customer_id: str
    operator_id: Optional[str] = None
    aircraft_id: Optional[str] = None
    pilot_id: Optional[str] = None
    from_location: str
    to_location: str
    trip_type: str
    departure_date: datetime
    return_date: Optional[datetime] = None
    passengers: int
    status: BookingStatus = BookingStatus.PENDING_QUOTES
    quote_ids: List[str] = []
    accepted_quote_id: Optional[str] = None
    total_amount: float = 0.0
    commission_amount: float = 0.0
    payment_id: Optional[str] = None
    landing_permissions: List[dict] = []
    special_requirements: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class Quote(BaseModel):
    id: Optional[str] = None
    booking_id: str
    operator_id: str
    aircraft_id: str
    quoted_price: float
    validity_hours: int = 24
    special_notes: Optional[str] = None
    is_accepted: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime

class LandingPermission(BaseModel):
    id: Optional[str] = None
    booking_id: str
    customer_id: str
    location: str
    noc_type: str
    document_url: str
    approval_status: ApprovalStatus = ApprovalStatus.PENDING
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Settlement(BaseModel):
    id: Optional[str] = None
    operator_id: str
    booking_ids: List[str]
    total_booking_amount: float
    commission_amount: float
    payout_amount: float
    status: str = "pending"
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class AuditLog(BaseModel):
    id: Optional[str] = None
    user_id: str
    action: str
    entity_type: str
    entity_id: str
    changes: dict
    ip_address: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ============== LANDING INFRASTRUCTURE MODELS ==============

class LandingPointType(str, Enum):
    AIRPORT = "airport"
    GOVT_HELIPAD = "govt_helipad"
    PRIVATE_HELIPAD = "private_helipad"
    VILLAGE_LAND = "village_land"

class LandingOwnerType(str, Enum):
    GOVT = "govt"
    PRIVATE = "private"
    TRUST = "trust"
    HOSPITAL = "hospital"
    HOTEL = "hotel"
    INDIVIDUAL = "individual"

class LandingPointStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"

class RentType(str, Enum):
    PER_LANDING = "per_landing"
    PER_HOUR = "per_hour"
    PER_DAY = "per_day"

class LandingDocType(str, Enum):
    COLLECTOR_NOC = "collector_noc"
    SP_NOC = "sp_noc"
    FIRE_NOC = "fire_noc"
    GRAM_PANCHAYAT = "gram_panchayat"
    OWNERSHIP = "ownership"


class LandingPoint(BaseModel):
    """
    LANDING_POINT MASTER TABLE
    Stores all landing locations - airports, helipads, village lands
    """
    id: Optional[str] = None
    code: Optional[str] = None  # Auto-generated code like DEL-APT-001
    name: str
    type: LandingPointType
    owner_type: LandingOwnerType = LandingOwnerType.GOVT
    
    # Location Details
    city: str
    district: str
    state: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    pincode: Optional[str] = None
    
    # Contact Info
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    
    # Flags
    permission_required: bool = False
    rent_applicable: bool = False
    calendar_enabled: bool = False  # For private helipads with availability calendar
    
    # Status
    status: LandingPointStatus = LandingPointStatus.ACTIVE
    is_active: bool = True
    
    # Ownership
    owner_id: Optional[str] = None  # User ID if registered helipad owner
    
    # Metadata
    facilities: List[str] = []  # parking, fuel, hangar, etc.
    runway_length: Optional[int] = None  # in meters
    icao_code: Optional[str] = None  # For airports
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None


class LandingRent(BaseModel):
    """
    LANDING RENT CONFIGURATION TABLE
    Stores rent configuration for landing points
    """
    id: Optional[str] = None
    landing_point_id: str
    
    # Rent Configuration
    rent_type: RentType = RentType.PER_LANDING
    base_rent_amount: float = 0.0
    
    # Time-based charges
    max_hours: Optional[int] = None  # Max hours included in base rent
    hourly_rate: Optional[float] = None  # Rate per additional hour
    daily_rate: Optional[float] = None  # Rate per day
    
    # Parking charges
    parking_per_hour: Optional[float] = None
    night_halt_charge: Optional[float] = None
    
    # Tax
    gst_applicable: bool = True
    gst_percentage: float = 18.0
    
    # Multipliers
    weekend_multiplier: float = 1.0  # 1.5 = 50% extra on weekends
    peak_season_multiplier: float = 1.0
    
    # Status
    is_active: bool = True
    
    # Remarks
    remarks: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None


class LandingDocument(BaseModel):
    """
    LANDING DOCUMENT & COMPLIANCE TABLE
    Stores documents for landing points (NOCs, ownership proofs, etc.)
    """
    id: Optional[str] = None
    landing_point_id: str
    
    # Document Info
    doc_type: LandingDocType
    doc_name: Optional[str] = None
    file_url: Optional[str] = None
    file_path: Optional[str] = None
    
    # Verification
    verified: bool = False
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    
    # Validity
    issue_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    
    # Remarks
    remark: Optional[str] = None
    rejection_reason: Optional[str] = None
    
    # Status
    status: str = "pending"  # pending, verified, rejected, expired
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    uploaded_by: Optional[str] = None


class VillageLandingPermission(BaseModel):
    """
    Village Landing Permission Request
    For tracking customer permission requests for village/private land landings
    """
    id: Optional[str] = None
    
    # References
    inquiry_id: Optional[str] = None
    booking_id: Optional[str] = None
    customer_id: str
    landing_point_id: Optional[str] = None
    
    # Location
    location_name: str
    district: str
    state: str
    pincode: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    
    # Required Documents Checklist
    required_documents: dict = {}  # {doc_type: {required: bool, uploaded: bool, document_id: str}}
    
    # Uploaded Documents
    documents: List[dict] = []  # List of uploaded documents
    
    # Status
    status: str = "documents_pending"  # documents_pending, under_review, approved, rejected
    
    # Approval
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    
    # Remarks
    admin_notes: Optional[str] = None
    customer_notes: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
