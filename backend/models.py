from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

class UserRole(str, Enum):
    CUSTOMER = "customer"
    OPERATOR = "operator"
    REGIONAL_MANAGER = "regional_manager"
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