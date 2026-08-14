from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime, timezone
from enum import Enum

class UserRole(str, Enum):
    CUSTOMER = "customer"
    OPERATOR = "operator"
    REGIONAL_MANAGER = "regional_manager"
    HELIPAD_OWNER = "helipad_owner"
    YACHT_OWNER = "yacht_owner"
    CRUISE_OPERATOR = "cruise_operator"
    HR = "hr"
    FINANCE = "finance"
    MARKETING = "marketing"
    SALES = "sales"
    SUPPORT = "support"
    OPERATIONS = "operations"
    EMPLOYEE = "employee"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"
    # Finance ERP Roles (₹100 Cr+ Operations)
    CFO = "cfo"                       # Chief Financial Officer - Full treasury access
    FINANCE_HEAD = "finance_head"     # Finance Head - Bank & payment management
    ACCOUNTS_MANAGER = "accounts_manager"  # Accounts Manager - Daily transactions
    TREASURY_ANALYST = "treasury_analyst"  # Treasury Analyst - View & report access

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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str
    roles: Optional[List[UserRole]] = None  # Ignored server-side, always set to ["customer"]
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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Quote(BaseModel):
    id: Optional[str] = None
    booking_id: str
    operator_id: str
    aircraft_id: str
    quoted_price: float
    validity_hours: int = 24
    special_notes: Optional[str] = None
    is_accepted: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AuditLog(BaseModel):
    id: Optional[str] = None
    user_id: str
    action: str
    entity_type: str
    entity_id: str
    changes: dict
    ip_address: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


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
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
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
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
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
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
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
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None



# ============================================================
# PHASE 1: PREMIUM SERVICES MODELS
# ============================================================

# ============ MEMBERSHIP MODELS ============

class MembershipTier(str, Enum):
    SILVER = "silver"
    GOLD = "gold"
    PLATINUM = "platinum"
    BLACK = "black"

class MembershipStatus(str, Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    SUSPENDED = "suspended"
    PENDING = "pending"

# Tier Benefits Configuration
TIER_BENEFITS = {
    "silver": {
        "name": "Silver",
        "annual_fee": 25000,
        "discount_percent": 5,
        "priority_booking": False,
        "dedicated_pilot": False,
        "lounge_access": False,
        "concierge_24x7": False,
        "free_cancellation": False,
        "loyalty_multiplier": 1.25,
        "upgrade_available": True,
        "max_guests": 2,
        "benefits": [
            "5% discount on all bookings",
            "Priority customer support",
            "Exclusive member newsletter",
            "Birthday special offers",
            "1.25x loyalty points"
        ]
    },
    "gold": {
        "name": "Gold",
        "annual_fee": 75000,
        "discount_percent": 10,
        "priority_booking": True,
        "dedicated_pilot": False,
        "lounge_access": True,
        "concierge_24x7": False,
        "free_cancellation": False,
        "loyalty_multiplier": 1.5,
        "upgrade_available": True,
        "max_guests": 4,
        "benefits": [
            "10% discount on all bookings",
            "Priority booking queue",
            "VIP lounge access at partner helipads",
            "Complimentary refreshments",
            "1.5x loyalty points",
            "Free date changes (48hrs notice)",
            "Dedicated relationship manager"
        ]
    },
    "platinum": {
        "name": "Platinum",
        "annual_fee": 200000,
        "discount_percent": 15,
        "priority_booking": True,
        "dedicated_pilot": True,
        "lounge_access": True,
        "concierge_24x7": True,
        "free_cancellation": True,
        "loyalty_multiplier": 2.0,
        "upgrade_available": True,
        "max_guests": 6,
        "benefits": [
            "15% discount on all bookings",
            "Zero-wait priority booking",
            "Dedicated pilot on request",
            "Premium VIP lounge access",
            "24x7 concierge service",
            "Free cancellation anytime",
            "2x loyalty points",
            "Complimentary airport transfers",
            "Partner hotel upgrades"
        ]
    },
    "black": {
        "name": "BLACK",
        "annual_fee": 500000,
        "discount_percent": 20,
        "priority_booking": True,
        "dedicated_pilot": True,
        "lounge_access": True,
        "concierge_24x7": True,
        "free_cancellation": True,
        "loyalty_multiplier": 3.0,
        "upgrade_available": False,
        "max_guests": 10,
        "benefits": [
            "20% discount on all bookings",
            "Guaranteed aircraft availability",
            "Personal dedicated pilot",
            "Exclusive BLACK lounge access",
            "24x7 personal travel planner",
            "Zero cancellation fees",
            "3x loyalty points",
            "Luxury car service included",
            "5-star hotel suite upgrades",
            "Priority medical evacuation",
            "Family membership (up to 10 guests)",
            "Invitation to exclusive events",
            "Annual complimentary charter"
        ]
    }
}

class MembershipCreate(BaseModel):
    user_id: str
    tier: MembershipTier
    payment_method: str = "online"
    auto_renew: bool = True

class MembershipUpdate(BaseModel):
    tier: Optional[MembershipTier] = None
    auto_renew: Optional[bool] = None
    status: Optional[MembershipStatus] = None

class MembershipUpgrade(BaseModel):
    new_tier: MembershipTier
    payment_method: str = "online"

class MemberBenefitUsage(BaseModel):
    membership_id: str
    benefit_type: str
    booking_id: Optional[str] = None
    used_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    value: float = 0

# ============ CORPORATE MODELS ============

class CorporateStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    SUSPENDED = "suspended"
    REJECTED = "rejected"

class EmployeeRole(str, Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    APPROVER = "approver"
    BOOKER = "booker"
    TRAVELER = "traveler"

class CorporateApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    AUTO_APPROVED = "auto_approved"

class BudgetPeriod(str, Enum):
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"

class CorporateCreate(BaseModel):
    company_name: str
    registration_number: str
    gst_number: str
    industry: str
    company_size: str
    address: str
    city: str
    state: str
    pincode: str
    primary_contact_name: str
    primary_contact_email: EmailStr
    primary_contact_phone: str
    admin_email: EmailStr
    admin_name: str
    billing_address: Optional[str] = None
    credit_limit_requested: float = 0

class CorporateUpdate(BaseModel):
    company_name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    primary_contact_name: Optional[str] = None
    primary_contact_email: Optional[EmailStr] = None
    primary_contact_phone: Optional[str] = None
    billing_address: Optional[str] = None
    status: Optional[CorporateStatus] = None

class EmployeeCreate(BaseModel):
    corporate_id: str
    name: str
    email: EmailStr
    phone: str
    department: str
    designation: str
    role: EmployeeRole
    travel_budget: float = 0
    can_book_for_others: bool = False
    requires_approval: bool = True
    approval_limit: float = 50000

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    role: Optional[EmployeeRole] = None
    travel_budget: Optional[float] = None
    can_book_for_others: Optional[bool] = None
    requires_approval: Optional[bool] = None
    approval_limit: Optional[float] = None
    is_active: Optional[bool] = None

class DepartmentBudget(BaseModel):
    corporate_id: str
    department: str
    budget_amount: float
    period: BudgetPeriod
    start_date: datetime
    alert_threshold: float = 80

class BookingApprovalCreate(BaseModel):
    corporate_id: str
    booking_id: str
    employee_id: str
    amount: float
    purpose: str
    urgency: str = "normal"

class ApprovalAction(BaseModel):
    approval_id: str
    action: str
    comments: Optional[str] = None

class TravelPolicy(BaseModel):
    corporate_id: str
    max_booking_amount: float = 500000
    advance_booking_days: int = 7
    requires_purpose: bool = True
    allowed_aircraft_types: List[str] = []
    blackout_dates: List[str] = []
    auto_approve_below: float = 25000
    weekend_booking_allowed: bool = True
    international_allowed: bool = False

# ============ DOCUMENT VAULT MODELS ============

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

class VaultDocumentType(str, Enum):
    AOC = "aoc"
    PPC = "ppc"
    MEDICAL = "medical"
    LICENSE = "license"
    TYPE_RATING = "type_rating"
    HULL_INSURANCE = "hull_insurance"
    LIABILITY_INSURANCE = "liability_insurance"
    PASSENGER_INSURANCE = "passenger_insurance"
    REGISTRATION = "registration"
    AIRWORTHINESS = "airworthiness"
    MAINTENANCE_RECORD = "maintenance_record"
    GST_CERTIFICATE = "gst_certificate"
    PAN_CARD = "pan_card"
    COMPANY_REGISTRATION = "company_registration"
    AADHAAR = "aadhaar"
    PASSPORT = "passport"
    VOTER_ID = "voter_id"
    DRIVING_LICENSE = "driving_license"
    SERVICE_AGREEMENT = "service_agreement"
    NDA = "nda"
    BOOKING_CONTRACT = "booking_contract"
    OTHER = "other"

class DocumentUploadModel(BaseModel):
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
    name: Optional[str] = None
    description: Optional[str] = None
    expiry_date: Optional[datetime] = None
    reference_number: Optional[str] = None
    tags: Optional[List[str]] = None
    reminder_days: Optional[int] = None
    status: Optional[DocumentVaultStatus] = None

class DocumentShareCreate(BaseModel):
    document_id: str
    shared_with_email: str
    permission: SharePermission
    expiry_date: Optional[datetime] = None
    message: Optional[str] = None
    requires_otp: bool = False

class FolderCreate(BaseModel):
    name: str
    parent_id: Optional[str] = None
    description: Optional[str] = None
    color: str = "#3B82F6"
    icon: str = "folder"

class DocumentVerification(BaseModel):
    document_id: Optional[str] = None  # Optional since it's in the URL path
    verification_status: str
    verified_by: str
    verification_notes: Optional[str] = None
    verification_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BulkDocumentAction(BaseModel):
    document_ids: List[str]
    action: str
    destination_folder_id: Optional[str] = None
    tags: Optional[List[str]] = None



# ============================================================
# CENTRALIZED MODELS - Emergency, Payment, Invoice, Discount
# ============================================================

# ============ EMERGENCY BOOKING MODELS ============

class UrgencyLevel(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"

class UrgencyReason(str, Enum):
    MEDICAL_EMERGENCY = "medical_emergency"
    TIME_CRITICAL = "time_critical"
    VIP_TRAVEL = "vip_travel"
    DISASTER_RELIEF = "disaster_relief"
    ORGAN_TRANSPORT = "organ_transport"

class EmergencyStatus(str, Enum):
    BROADCASTING = "broadcasting"
    AWAITING_RESPONSES = "awaiting_responses"
    RESPONSES_RECEIVED = "responses_received"
    OPERATOR_ASSIGNED = "operator_assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_OPERATORS_FOUND = "no_operators_found"

class EmergencyBookingRequest(BaseModel):
    """Emergency booking request - gets priority processing"""
    # Location
    from_location: str
    from_latitude: float
    from_longitude: float
    to_location: str
    to_latitude: float
    to_longitude: float
    
    # Urgency
    urgency_level: str = "high"  # critical, high, medium
    urgency_reason: str  # medical_emergency, time_critical, vip_travel, disaster_relief
    required_by: Optional[str] = None  # ISO datetime - when flight must happen
    
    # Flight details
    passengers: int = 1
    aircraft_type: Optional[str] = None  # helicopter, light_jet, any
    special_requirements: Optional[str] = None
    
    # Contact
    emergency_contact_name: str
    emergency_contact_phone: str

class EmergencyResponse(BaseModel):
    """Response from operator to emergency request"""
    emergency_booking_id: str
    can_fulfill: bool
    aircraft_id: Optional[str] = None
    estimated_arrival_minutes: Optional[int] = None
    price: Optional[float] = None
    notes: Optional[str] = None


# ============ DISCOUNT & REFERRAL MODELS ============

class DiscountType(str, Enum):
    PERCENT = "percent"
    FIXED = "fixed"

class DiscountCode(BaseModel):
    """Discount code for bookings"""
    code: str
    discount_type: str  # "percent" or "fixed"
    discount_value: float
    max_uses: int = 100
    min_booking_amount: float = 5000.0
    max_discount_amount: Optional[float] = None  # Cap for percentage discounts
    valid_from: str
    valid_until: str
    is_active: bool = True
    description: str = ""
    applicable_purposes: List[str] = []  # Empty means all purposes

class DiscountCodeCreate(BaseModel):
    """Create new discount code"""
    code: Optional[str] = None  # Auto-generate if not provided
    discount_type: str = "percent"
    discount_value: float
    max_uses: int = 100
    min_booking_amount: float = 5000.0
    max_discount_amount: Optional[float] = None
    valid_from: str
    valid_until: str
    description: str = ""
    applicable_purposes: List[str] = []

class BulkDiscountUpload(BaseModel):
    """Bulk upload discount codes via CSV"""
    codes: List[DiscountCodeCreate]


# ============ INVOICE MODELS ============

class InvoiceType(str, Enum):
    TAX_INVOICE = "tax_invoice"
    PROFORMA = "proforma"
    CREDIT_NOTE = "credit_note"
    DEBIT_NOTE = "debit_note"

class InvoiceStatus(str, Enum):
    DRAFT = "draft"
    SENT = "sent"
    PAID = "paid"
    PARTIALLY_PAID = "partially_paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"

class InvoiceItem(BaseModel):
    """Single line item in an invoice"""
    description: str
    hsn_code: Optional[str] = None
    quantity: int = 1
    unit_price: float
    discount_percent: float = 0
    gst_percent: float = 18

class InvoiceCreate(BaseModel):
    """Create new invoice"""
    booking_id: Optional[str] = None
    customer_id: str
    customer_name: str
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_gstin: Optional[str] = None
    customer_address: Optional[str] = None
    billing_address: Optional[str] = None
    items: List[InvoiceItem]
    notes: Optional[str] = None
    due_days: int = 30
    invoice_type: str = "tax_invoice"

class InvoiceUpdate(BaseModel):
    """Update invoice"""
    status: Optional[str] = None
    notes: Optional[str] = None
    due_days: Optional[int] = None


# ============ PRICING MODELS ============

class PricingRequest(BaseModel):
    """Request for price calculation"""
    origin: str
    destination: str
    journey_date: str
    journey_time: Optional[str] = None
    aircraft_type: Optional[str] = None
    passengers: int = 1
    base_price: float

class PricingRuleUpdate(BaseModel):
    """Update pricing rule"""
    rule_name: str
    value: float

class PricingSettings(BaseModel):
    """Platform pricing settings"""
    platform_commission_percent: float = 10.0
    platform_fixed_fee: float = 500.0
    gst_rate: float = 18.0
    tds_rate: float = 2.0
    price_lock_duration_minutes: int = 15
    price_lock_max_minutes: int = 30


# ============ PAYMENT MODELS ============

class PaymentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"
    PARTIALLY_REFUNDED = "partially_refunded"

class PaymentMethod(str, Enum):
    CARD = "card"
    UPI = "upi"
    NETBANKING = "netbanking"
    WALLET = "wallet"
    BANK_TRANSFER = "bank_transfer"

class PaymentCreate(BaseModel):
    """Create payment request"""
    booking_id: str
    amount: float
    currency: str = "INR"
    payment_method: Optional[str] = None
    return_url: Optional[str] = None

class PaymentVerify(BaseModel):
    """Verify payment"""
    payment_id: str
    gateway_payment_id: str
    gateway_signature: Optional[str] = None

class RefundRequest(BaseModel):
    """Request refund"""
    payment_id: str
    amount: Optional[float] = None  # Partial refund if specified
    reason: str


# ============ MULTI-CITY BOOKING MODELS ============

class RouteLeg(BaseModel):
    """Single leg in multi-city route"""
    from_location: str
    from_latitude: float
    from_longitude: float
    to_location: str
    to_latitude: float
    to_longitude: float
    distance_km: float = 0
    estimated_price: float = 0

class MultiCityBookingCreate(BaseModel):
    """Create multi-city booking"""
    legs: List[RouteLeg]
    departure_date: str
    passengers: int = 1
    aircraft_type: Optional[str] = None
    special_requirements: Optional[str] = None


# ============ AIRCRAFT CATALOG MODELS ============

class AircraftVerificationStatus(str, Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"
    EXPIRED = "expired"

class AircraftSafetyFeatures(BaseModel):
    """Aircraft safety equipment"""
    tcas: bool = False  # Traffic Collision Avoidance System
    terrain_awareness: bool = False
    weather_radar: bool = False
    autopilot: bool = False
    defibrillator: bool = False
    oxygen_kit: bool = False
    fire_extinguisher: bool = True
    first_aid: bool = True
    life_jackets: bool = False
    emergency_locator: bool = False

class AircraftAmenities(BaseModel):
    """Aircraft amenities"""
    wifi_type: str = "none"  # none, basic, high_speed
    leather_seats: bool = False
    pressurized_cabin: bool = False
    air_conditioning: bool = True
    entertainment_system: bool = False
    meals_available: bool = False
    lavatory: bool = False
    conference_table: bool = False
    power_outlets: bool = False

class AircraftCrewInfo(BaseModel):
    """Crew information"""
    min_crew: int = 1
    max_crew: int = 2
    flight_attendant_available: bool = False

class AircraftCatalogCreate(BaseModel):
    """Create aircraft in catalog"""
    model: str
    manufacturer: str
    aircraft_type: str  # helicopter, light_jet, turbo_prop
    registration_number: str
    year_of_manufacture: Optional[int] = None
    passenger_capacity: int
    max_range_km: Optional[int] = None
    cruise_speed_kmh: Optional[int] = None
    engine_type: Optional[str] = None
    hourly_rate: float
    safety_features: Optional[AircraftSafetyFeatures] = None
    amenities: Optional[AircraftAmenities] = None
    crew_info: Optional[AircraftCrewInfo] = None



# ============================================================
# VERIFICATION RULE ENGINE - Admin Configurable System
# From Document [2] & [5]
# ============================================================

class VerificationMode(str, Enum):
    """Verification requirement mode"""
    DISABLED = "disabled"       # No verification required
    OPTIONAL = "optional"       # Verification optional, badges earned
    MANDATORY = "mandatory"     # Must verify to operate

class VerificationProvider(str, Enum):
    """Supported verification API providers"""
    SANDBOX = "sandbox"         # Test mode - always passes
    SUREPASS = "surepass"       # SurePass API
    SIGNZY = "signzy"           # Signzy API
    IDFY = "idfy"               # IDFY API
    HYPERVERGE = "hyperverge"   # HyperVerge API
    DIGILOCKER = "digilocker"   # DigiLocker Integration
    CUSTOM = "custom"           # Custom API endpoint

class VerificationBadge(str, Enum):
    """Verification badge levels based on score"""
    GOLD = "gold"               # 90-100 score
    SILVER = "silver"           # 70-89 score
    BASIC = "basic"             # 50-69 score
    PENDING = "pending"         # <50 score or incomplete
    SUSPENDED = "suspended"     # Failed verification or rule violation

class VerificationType(str, Enum):
    """Types of verification checks"""
    PAN = "pan"
    GST = "gst"
    BANK = "bank"
    AADHAAR = "aadhaar"
    FACE = "face"
    COMPANY_REG = "company_reg"
    AOC = "aoc"                 # Air Operator Certificate
    INSURANCE = "insurance"
    PILOT_LICENSE = "pilot_license"

class ServiceStatus(str, Enum):
    """Verification service status"""
    NORMAL = "normal"           # APIs working normally
    MANUAL = "manual"           # Manual verification mode (APIs down)
    DISABLED = "disabled"       # Service completely disabled

class AutoRuleAction(str, Enum):
    """Actions for auto rules"""
    SUSPEND_OPERATOR = "suspend_operator"
    DOWNGRADE_BADGE = "downgrade_badge"
    NOTIFY_ADMIN = "notify_admin"
    REQUIRE_REVERIFICATION = "require_reverification"
    BLOCK_BOOKINGS = "block_bookings"
    SEND_WARNING = "send_warning"


# ============ VERIFICATION SCORING CONFIG ============

class VerificationScoreConfig(BaseModel):
    """Scoring weights for different verification types"""
    pan_score: int = 20
    gst_score: int = 20
    bank_score: int = 20
    aadhaar_score: int = 20
    face_score: int = 20
    # Additional scores
    company_reg_score: int = 15
    aoc_score: int = 25
    insurance_score: int = 20
    pilot_license_score: int = 15
    
    # Badge thresholds
    gold_threshold: int = 90
    silver_threshold: int = 70
    basic_threshold: int = 50


class BookingVerificationRule(BaseModel):
    """Verification rules based on booking amount"""
    min_amount: float
    max_amount: Optional[float] = None
    required_verifications: List[str]  # ["otp", "pan", "aadhaar", etc.]
    description: str


class AutoVerificationRule(BaseModel):
    """Auto rule: condition → action"""
    rule_id: str
    rule_name: str
    condition_type: str  # "gst_status", "insurance_expiry", "document_expired"
    condition_value: str  # "cancelled", "expired", etc.
    action: AutoRuleAction
    notify_roles: List[str] = []  # ["admin", "compliance"]
    grace_period_days: int = 0
    is_active: bool = True


class ProviderConfig(BaseModel):
    """Configuration for verification API provider"""
    provider: VerificationProvider
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    base_url: Optional[str] = None
    webhook_url: Optional[str] = None
    timeout_seconds: int = 30
    retry_count: int = 3
    is_active: bool = True
    supported_verifications: List[VerificationType] = []


# ============ MAIN VERIFICATION RULE ENGINE ============

class VerificationRuleEngine(BaseModel):
    """
    Admin-configurable Verification Rule Engine
    Complete implementation from Document [2] & [5]
    """
    id: Optional[str] = None
    
    # === CORE SETTINGS ===
    verification_mode: VerificationMode = VerificationMode.OPTIONAL
    service_status: ServiceStatus = ServiceStatus.NORMAL
    
    # === ENVIRONMENT ===
    production_mode: bool = False
    sandbox_mode: bool = True
    test_mode_message: str = "Test mode - verifications simulated"
    
    # === API PROVIDER ===
    primary_provider: VerificationProvider = VerificationProvider.SANDBOX
    fallback_provider: Optional[VerificationProvider] = None
    provider_configs: List[ProviderConfig] = []
    
    # === SCORING SYSTEM ===
    scoring_config: VerificationScoreConfig = VerificationScoreConfig()
    
    # === BOOKING-BASED RULES ===
    # From [5]: ₹50k→OTP, ₹2L→PAN+Aadhaar
    booking_rules: List[BookingVerificationRule] = [
        BookingVerificationRule(
            min_amount=0,
            max_amount=50000,
            required_verifications=["email"],
            description="Basic email verification"
        ),
        BookingVerificationRule(
            min_amount=50000,
            max_amount=200000,
            required_verifications=["email", "otp", "phone"],
            description="OTP verification required"
        ),
        BookingVerificationRule(
            min_amount=200000,
            max_amount=500000,
            required_verifications=["email", "otp", "phone", "pan"],
            description="PAN verification required"
        ),
        BookingVerificationRule(
            min_amount=500000,
            max_amount=None,
            required_verifications=["email", "otp", "phone", "pan", "aadhaar"],
            description="Full KYC required"
        )
    ]
    
    # === AUTO RULES ===
    # From [2]: If GST cancelled → Suspend Operator
    auto_rules: List[AutoVerificationRule] = [
        AutoVerificationRule(
            rule_id="gst_cancelled",
            rule_name="GST Cancellation Check",
            condition_type="gst_status",
            condition_value="cancelled",
            action=AutoRuleAction.SUSPEND_OPERATOR,
            notify_roles=["admin", "compliance"],
            grace_period_days=0
        ),
        AutoVerificationRule(
            rule_id="insurance_expired",
            rule_name="Insurance Expiry Check",
            condition_type="insurance_expiry",
            condition_value="expired",
            action=AutoRuleAction.BLOCK_BOOKINGS,
            notify_roles=["admin", "operator"],
            grace_period_days=7
        ),
        AutoVerificationRule(
            rule_id="aoc_expiring",
            rule_name="AOC Expiring Soon",
            condition_type="aoc_expiry",
            condition_value="expiring_30_days",
            action=AutoRuleAction.SEND_WARNING,
            notify_roles=["operator"],
            grace_period_days=30
        )
    ]
    
    # === DAILY CHECKS ===
    daily_gst_check: bool = True
    daily_insurance_check: bool = True
    expiry_alert_days: List[int] = [30, 15, 7, 3, 1]  # Days before expiry to alert
    
    # === ROLE PERMISSIONS ===
    # From [5]: CEO/Finance/Compliance roles
    role_permissions: dict = {
        "super_admin": ["view", "edit", "override", "audit"],
        "admin": ["view", "edit", "override"],
        "compliance": ["view", "edit", "verify"],
        "finance": ["view", "verify"],
        "cfo": ["view", "override"],
        "operator": ["view"]
    }
    
    # === EMERGENCY OVERRIDE ===
    # From [2]: Manual verification when APIs fail
    override_enabled: bool = False
    override_reason: Optional[str] = None
    override_by: Optional[str] = None
    override_at: Optional[str] = None
    override_expires_at: Optional[str] = None
    
    # === AUDIT ===
    audit_all_changes: bool = True
    require_otp_for_changes: bool = True
    
    # === METADATA ===
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    updated_by: Optional[str] = None


class VerificationRuleUpdate(BaseModel):
    """Update verification rules - partial update"""
    verification_mode: Optional[VerificationMode] = None
    service_status: Optional[ServiceStatus] = None
    production_mode: Optional[bool] = None
    sandbox_mode: Optional[bool] = None
    primary_provider: Optional[VerificationProvider] = None
    fallback_provider: Optional[VerificationProvider] = None
    scoring_config: Optional[VerificationScoreConfig] = None
    daily_gst_check: Optional[bool] = None
    daily_insurance_check: Optional[bool] = None
    expiry_alert_days: Optional[List[int]] = None


class EmergencyOverrideRequest(BaseModel):
    """Request to enable emergency override"""
    reason: str
    duration_hours: int = 24
    otp: str  # OTP verification required


class VerificationAuditLog(BaseModel):
    """Audit log for verification changes"""
    id: Optional[str] = None
    action: str  # "mode_changed", "provider_changed", "rule_added", "override_enabled"
    changed_by: str
    changed_at: str
    old_value: Optional[dict] = None
    new_value: Optional[dict] = None
    ip_address: Optional[str] = None
    otp_verified: bool = False
    reason: Optional[str] = None


class VerificationResult(BaseModel):
    """Result of a verification check"""
    verification_type: VerificationType
    status: str  # "success", "failed", "pending", "skipped"
    provider_used: VerificationProvider
    score_earned: int = 0
    response_data: Optional[dict] = None
    error_message: Optional[str] = None
    verified_at: Optional[str] = None
    expires_at: Optional[str] = None


class EntityVerificationStatus(BaseModel):
    """Complete verification status for an entity (user/operator)"""
    entity_id: str
    entity_type: str  # "user", "operator"
    total_score: int = 0
    badge: VerificationBadge = VerificationBadge.PENDING
    verifications: List[VerificationResult] = []
    last_checked_at: Optional[str] = None
    next_check_due: Optional[str] = None
    is_compliant: bool = False
    compliance_issues: List[str] = []



# ============================================================
# AI SMART COMPARISON - Aircraft Comparison System
# From Document [1] - "Customer को पूरा Comparison दिखे"
# ============================================================

class ComparisonFilledBy(str, Enum):
    """Who filled the comparison data"""
    OPERATOR = "operator"
    ADMIN = "admin"
    AI = "ai"
    SYSTEM = "system"

class ComparisonCategory(str, Enum):
    """Categories for comparison"""
    FEATURES = "features"
    PRICE = "price"
    SAFETY = "safety"
    AMENITIES = "amenities"
    OPERATOR = "operator"
    PERFORMANCE = "performance"

class FeatureComparisonItem(BaseModel):
    """Single feature comparison between aircraft"""
    feature_name: str
    feature_name_hi: str  # Hindi name
    aircraft_1_value: str
    aircraft_2_value: str
    aircraft_3_value: Optional[str] = None
    winner: Optional[str] = None  # aircraft_id of winner
    importance: str = "medium"  # low, medium, high, critical

class PriceComparisonItem(BaseModel):
    """Price comparison item"""
    component: str  # base_price, landing_charges, etc.
    component_hi: str
    aircraft_1_amount: float
    aircraft_2_amount: float
    aircraft_3_amount: Optional[float] = None
    cheapest: Optional[str] = None

class SafetyComparisonItem(BaseModel):
    """Safety feature comparison"""
    feature: str
    feature_hi: str
    aircraft_1_has: bool
    aircraft_2_has: bool
    aircraft_3_has: Optional[bool] = None
    weight: int = 10  # Importance weight for scoring

class AmenityComparisonItem(BaseModel):
    """Amenity comparison"""
    amenity: str
    amenity_hi: str
    aircraft_1_has: bool
    aircraft_2_has: bool
    aircraft_3_has: Optional[bool] = None
    category: str = "comfort"  # comfort, entertainment, business

class OperatorComparisonItem(BaseModel):
    """Operator comparison"""
    metric: str
    metric_hi: str
    aircraft_1_value: str
    aircraft_2_value: str
    aircraft_3_value: Optional[str] = None

class AircraftComparisonCreate(BaseModel):
    """Create new aircraft comparison"""
    aircraft_ids: List[str]  # 2-3 aircraft IDs
    route_origin: Optional[str] = None
    route_destination: Optional[str] = None
    journey_date: Optional[str] = None
    passengers: int = 1

class AircraftComparison(BaseModel):
    """
    AI Smart Comparison for customers
    From Document [1] - Complete comparison view
    """
    id: Optional[str] = None
    comparison_id: str
    
    # Aircraft being compared (2-3)
    aircraft_ids: List[str]
    aircraft_details: List[dict] = []  # Cached aircraft info
    
    # Route context
    route_origin: Optional[str] = None
    route_destination: Optional[str] = None
    journey_date: Optional[str] = None
    distance_km: float = 0
    passengers: int = 1
    
    # Comparison data
    feature_comparison: List[FeatureComparisonItem] = []
    price_comparison: List[PriceComparisonItem] = []
    safety_comparison: List[SafetyComparisonItem] = []
    amenities_comparison: List[AmenityComparisonItem] = []
    operator_comparison: List[OperatorComparisonItem] = []
    
    # Scores (out of 100)
    scores: dict = {}  # {aircraft_id: {safety: 85, comfort: 70, value: 90, overall: 82}}
    
    # AI Recommendation
    ai_recommendation: Optional[str] = None  # aircraft_id
    ai_recommendation_reason: Optional[str] = None
    ai_recommendation_reason_hi: Optional[str] = None
    
    # Winner by category
    winners: dict = {}  # {safety: aircraft_id, price: aircraft_id, overall: aircraft_id}
    
    # Metadata
    filled_by: ComparisonFilledBy = ComparisonFilledBy.SYSTEM
    created_by: Optional[str] = None
    created_at: Optional[str] = None
    expires_at: Optional[str] = None  # Comparison valid for limited time
    view_count: int = 0


# ============================================================
# AI REPOSITIONING ENGINE - Hybrid Smart Pricing & Dispatch
# From Document [4] - Mode-1 Fixed Route + Mode-2 Reverse Auction
# ============================================================

class PricingMode(str, Enum):
    """Pricing modes"""
    FIXED_ROUTE = "fixed_route"      # Mode-1: Instant booking at fixed price
    REVERSE_AUCTION = "reverse_auction"  # Mode-2: Operators bid
    HYBRID = "hybrid"                # Both modes available
    CHARTER = "charter"              # Custom quote only

class RepositioningType(str, Enum):
    """Types of repositioning/ferry flights"""
    EMPTY_LEG = "empty_leg"          # Aircraft returning empty
    POSITIONING = "positioning"       # Moving to pickup location
    MAINTENANCE = "maintenance"       # Going for maintenance
    BASE_RETURN = "base_return"      # Returning to home base

class FerryChargeType(str, Enum):
    """How ferry charges are applied"""
    INCLUDED = "included"            # No extra charge
    PERCENTAGE = "percentage"        # % of base price
    FIXED = "fixed"                  # Fixed amount
    PER_KM = "per_km"               # Per kilometer rate
    SPLIT = "split"                 # Split between bookings

class FixedRouteStatus(str, Enum):
    """Status of fixed route"""
    ACTIVE = "active"
    PAUSED = "paused"
    SOLD_OUT = "sold_out"
    EXPIRED = "expired"

class AuctionStatus(str, Enum):
    """Auction status"""
    DRAFT = "draft"
    ACTIVE = "active"
    BIDDING = "bidding"
    AWAITING_SELECTION = "awaiting_selection"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    EXPIRED = "expired"

class BidStatus(str, Enum):
    """Bid status"""
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"
    EXPIRED = "expired"


# === FIXED ROUTE MODELS (Mode-1) ===

class FixedRouteCreate(BaseModel):
    """Create fixed route for instant booking"""
    route_name: str
    route_name_hi: Optional[str] = None
    origin: str
    origin_coordinates: dict  # {lat, lng}
    destination: str
    destination_coordinates: dict
    distance_km: float
    
    # Pricing
    base_price: float
    price_per_seat: Optional[float] = None
    min_passengers: int = 1
    max_passengers: int = 6
    
    # Schedule
    available_days: List[str] = []  # ["monday", "wednesday", "friday"]
    departure_times: List[str] = []  # ["09:00", "14:00", "18:00"]
    advance_booking_hours: int = 24
    
    # Aircraft
    aircraft_type: str
    operator_id: Optional[str] = None
    aircraft_ids: List[str] = []  # Specific aircraft for this route
    
    # Validity
    valid_from: str
    valid_until: str
    
    # Ferry handling
    ferry_included: bool = True
    ferry_charge_type: FerryChargeType = FerryChargeType.INCLUDED
    ferry_charge_value: float = 0

class FixedRoute(BaseModel):
    """
    Fixed Route for Instant Booking (Mode-1)
    From Document [4]
    """
    id: Optional[str] = None
    route_code: str  # AUTO: FXR-DEL-MUM-001
    route_name: str
    route_name_hi: Optional[str] = None
    
    # Route details
    origin: str
    origin_coordinates: dict
    destination: str
    destination_coordinates: dict
    distance_km: float
    estimated_duration_minutes: int = 0
    
    # Pricing
    base_price: float
    price_per_seat: Optional[float] = None
    current_price: float = 0  # Dynamic price after multipliers
    min_passengers: int = 1
    max_passengers: int = 6
    
    # Dynamic pricing factors
    demand_multiplier: float = 1.0
    seasonal_multiplier: float = 1.0
    time_multiplier: float = 1.0
    
    # Schedule
    available_days: List[str] = []
    departure_times: List[str] = []
    advance_booking_hours: int = 24
    
    # Aircraft assignment
    aircraft_type: str
    operator_id: Optional[str] = None
    aircraft_ids: List[str] = []
    assigned_aircraft: Optional[dict] = None
    
    # Availability
    seats_available: int = 6
    bookings_today: int = 0
    total_bookings: int = 0
    
    # Ferry handling
    ferry_included: bool = True
    ferry_charge_type: FerryChargeType = FerryChargeType.INCLUDED
    ferry_charge_value: float = 0
    
    # Status
    status: FixedRouteStatus = FixedRouteStatus.ACTIVE
    valid_from: str
    valid_until: str
    
    # Metadata
    created_by: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    
    # Analytics
    popularity_score: float = 0
    average_rating: float = 0
    total_revenue: float = 0


# === REVERSE AUCTION MODELS (Mode-2) ===

class AuctionBidCreate(BaseModel):
    """Operator submits bid for auction"""
    auction_id: str
    aircraft_id: str
    bid_amount: float
    estimated_arrival_minutes: Optional[int] = None
    notes: Optional[str] = None
    valid_for_minutes: int = 30

class AuctionBid(BaseModel):
    """Bid in reverse auction"""
    id: Optional[str] = None
    bid_id: str
    auction_id: str
    
    # Bidder
    operator_id: str
    operator_name: Optional[str] = None
    aircraft_id: str
    aircraft_details: Optional[dict] = None
    
    # Bid details
    bid_amount: float
    original_amount: float  # Before any auto-adjustments
    estimated_arrival_minutes: Optional[int] = None
    ferry_distance_km: float = 0
    ferry_cost_included: bool = True
    
    # Status
    status: BidStatus = BidStatus.PENDING
    rank: int = 0  # 1 = lowest bid
    
    # Timestamps
    bid_at: str
    valid_until: str
    responded_at: Optional[str] = None
    
    notes: Optional[str] = None

class ReverseAuctionCreate(BaseModel):
    """Customer creates reverse auction"""
    origin: str
    origin_coordinates: dict
    destination: str
    destination_coordinates: dict
    
    journey_date: str
    preferred_time: Optional[str] = None
    flexible_time: bool = True
    
    passengers: int = 1
    aircraft_type: Optional[str] = None  # Any if not specified
    
    max_budget: Optional[float] = None  # Customer's max budget
    
    special_requirements: Optional[str] = None
    
    # Auction settings
    auction_duration_minutes: int = 60  # How long auction runs
    auto_accept_lowest: bool = False
    notify_all_operators: bool = True

class ReverseAuction(BaseModel):
    """
    Reverse Auction for Custom Routes (Mode-2)
    From Document [4] - Operators bid, customer selects
    """
    id: Optional[str] = None
    auction_id: str
    auction_number: str  # AUC-20260802-A1B2C3
    
    # Customer
    customer_id: str
    customer_name: Optional[str] = None
    
    # Route
    origin: str
    origin_coordinates: dict
    destination: str
    destination_coordinates: dict
    distance_km: float = 0
    
    # Journey
    journey_date: str
    preferred_time: Optional[str] = None
    flexible_time: bool = True
    passengers: int = 1
    aircraft_type: Optional[str] = None
    
    # Budget
    max_budget: Optional[float] = None
    
    # Auction timing
    auction_duration_minutes: int = 60
    started_at: str
    ends_at: str
    
    # Bids
    bids: List[AuctionBid] = []
    total_bids: int = 0
    lowest_bid: Optional[float] = None
    highest_bid: Optional[float] = None
    
    # Selection
    auto_accept_lowest: bool = False
    selected_bid_id: Optional[str] = None
    selected_operator_id: Optional[str] = None
    
    # Status
    status: AuctionStatus = AuctionStatus.ACTIVE
    
    # Notifications
    operators_notified: int = 0
    operators_eligible: int = 0
    
    # Result
    final_price: Optional[float] = None
    booking_id: Optional[str] = None
    
    # Metadata
    special_requirements: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    completed_at: Optional[str] = None


# === AI REPOSITIONING ENGINE ===

class RepositioningEngineSettings(BaseModel):
    """Settings for AI repositioning engine"""
    # Mode settings
    default_mode: PricingMode = PricingMode.HYBRID
    fixed_route_enabled: bool = True
    reverse_auction_enabled: bool = True
    
    # Auction settings
    default_auction_duration_minutes: int = 60
    min_auction_duration_minutes: int = 15
    max_auction_duration_minutes: int = 480
    bid_timeout_seconds: int = 300  # 5 minutes from [4]
    auto_extend_on_late_bid: bool = True
    extend_minutes: int = 5
    
    # Notification settings
    notify_operators_within_km: int = 500
    notify_by_aircraft_type: bool = True
    notify_by_availability: bool = True
    
    # Ferry calculation
    ferry_rate_per_km: float = 50  # ₹50/km default
    max_ferry_distance_km: int = 300
    include_ferry_in_bid: bool = True
    
    # Pricing rules
    min_price_threshold: float = 10000
    max_markup_percent: float = 100
    
    # AI settings
    ai_price_suggestion_enabled: bool = True
    ai_operator_ranking_enabled: bool = True
    
class AIRepositioningEngine(BaseModel):
    """
    Hybrid Smart Pricing & AI Dispatch Engine
    From Document [4]
    """
    id: Optional[str] = None
    engine_id: str = "default_repositioning_engine"
    
    # Settings
    settings: RepositioningEngineSettings = RepositioningEngineSettings()
    
    # Fixed Routes (Mode-1)
    fixed_routes_count: int = 0
    active_fixed_routes: int = 0
    
    # Auctions (Mode-2)
    active_auctions_count: int = 0
    completed_auctions_today: int = 0
    
    # Performance metrics
    total_bookings_via_fixed: int = 0
    total_bookings_via_auction: int = 0
    average_auction_duration_minutes: float = 0
    average_bids_per_auction: float = 0
    customer_satisfaction_score: float = 0
    
    # Ferry analytics
    total_ferry_km_saved: float = 0
    total_ferry_cost_optimized: float = 0
    
    # Metadata
    last_updated: Optional[str] = None
    updated_by: Optional[str] = None


class FerryCalculationRequest(BaseModel):
    """Request to calculate ferry charges"""
    aircraft_current_location: dict  # {lat, lng}
    pickup_location: dict
    drop_location: dict
    return_to_base: bool = True
    base_location: Optional[dict] = None

class FerryCalculationResult(BaseModel):
    """Result of ferry calculation"""
    positioning_distance_km: float
    return_distance_km: float
    total_ferry_km: float
    ferry_cost: float
    ferry_time_minutes: int
    recommendation: str  # "include_in_price", "charge_separately", "waive"
    recommendation_hi: str
