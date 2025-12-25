"""
Landing Infrastructure Models
Comprehensive models for airports, helipads, village lands, and landing management
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date, time
from enum import Enum


# ============== ENUMS ==============

class LandingPointType(str, Enum):
    """Types of landing points"""
    AIRPORT = "airport"
    GOVT_HELIPAD = "govt_helipad"
    PRIVATE_HELIPAD = "private_helipad"
    VILLAGE_LAND = "village_land"


class LandingOwnerType(str, Enum):
    """Owner types for landing points"""
    GOVERNMENT = "government"
    PRIVATE = "private"
    TRUST = "trust"
    HOTEL = "hotel"
    HOSPITAL = "hospital"
    CORPORATE = "corporate"
    INDIVIDUAL = "individual"


class HelipadCategory(str, Enum):
    """Categories for helipads"""
    PILGRIMAGE = "pilgrimage"
    HOSPITAL = "hospital"
    HOTEL_RESORT = "hotel_resort"
    CORPORATE = "corporate"
    STATE_GOVERNMENT = "state_government"
    CENTRAL_GOVERNMENT = "central_government"
    MILITARY = "military"
    PRIVATE_ESTATE = "private_estate"


class RentType(str, Enum):
    """Rent calculation types"""
    PER_LANDING = "per_landing"
    PER_HOUR = "per_hour"
    PER_DAY = "per_day"
    FIXED = "fixed"


class AvailabilityStatus(str, Enum):
    """Availability status"""
    AVAILABLE = "available"
    BLOCKED = "blocked"
    MAINTENANCE = "maintenance"
    BOOKED = "booked"


class DocumentType(str, Enum):
    """Village landing document types"""
    COLLECTOR_NOC = "collector_noc"
    SP_NOC = "sp_noc"
    FIRE_NOC = "fire_noc"
    GRAM_PANCHAYAT = "gram_panchayat"
    LAND_OWNERSHIP = "land_ownership"
    SITE_PHOTOS = "site_photos"
    GPS_COORDINATES = "gps_coordinates"
    OTHER = "other"


class DocumentStatus(str, Enum):
    """Document verification status"""
    PENDING = "pending"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


class LandingPermissionStatus(str, Enum):
    """Overall landing permission status"""
    DOCUMENTS_PENDING = "documents_pending"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


# ============== MODELS ==============

class LandingPointBase(BaseModel):
    """Base model for landing points"""
    name: str
    type: LandingPointType
    owner_type: LandingOwnerType
    category: Optional[str] = None
    
    # Location
    city: str
    district: str
    state: str
    address: Optional[str] = None
    pincode: Optional[str] = None
    latitude: float
    longitude: float
    
    # Contact
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    
    # Permissions & Rent
    permission_required: bool = False
    rent_applicable: bool = False
    availability_calendar_required: bool = False
    
    # Status
    is_active: bool = True
    is_verified: bool = False
    
    # Additional info
    facilities: Optional[List[str]] = []
    operating_hours: Optional[str] = None
    notes: Optional[str] = None


class LandingPointCreate(LandingPointBase):
    """Model for creating landing point"""
    pass


class LandingPoint(LandingPointBase):
    """Full landing point model"""
    id: str
    code: Optional[str] = None  # ICAO code for airports
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None
    
    class Config:
        from_attributes = True


class HelipadAvailabilityBase(BaseModel):
    """Base model for helipad availability"""
    landing_point_id: str
    date: date
    from_time: time
    to_time: time
    status: AvailabilityStatus = AvailabilityStatus.AVAILABLE
    reason: Optional[str] = None
    booking_id: Optional[str] = None  # If booked


class HelipadAvailabilityCreate(HelipadAvailabilityBase):
    """Model for creating availability slot"""
    pass


class HelipadAvailability(HelipadAvailabilityBase):
    """Full availability model"""
    id: str
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None


class LandingRentBase(BaseModel):
    """Base model for landing rent configuration"""
    landing_point_id: str
    rent_type: RentType
    base_rent_amount: float
    max_hours: Optional[int] = None  # For per_hour type
    overnight_charge: Optional[float] = None
    parking_charge_per_hour: Optional[float] = None
    gst_applicable: bool = True
    gst_percentage: float = 18.0
    
    # Aircraft type specific pricing
    helicopter_rate: Optional[float] = None
    fixed_wing_rate: Optional[float] = None
    
    # Time-based pricing
    peak_hours_multiplier: float = 1.0
    weekend_multiplier: float = 1.0
    
    notes: Optional[str] = None


class LandingRentCreate(LandingRentBase):
    """Model for creating rent config"""
    pass


class LandingRent(LandingRentBase):
    """Full rent model"""
    id: str
    is_active: bool = True
    effective_from: datetime
    effective_to: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class LandingDocumentBase(BaseModel):
    """Base model for landing documents"""
    landing_permission_id: str
    doc_type: DocumentType
    file_name: str
    file_url: Optional[str] = None
    s3_key: Optional[str] = None
    
    # Verification
    status: DocumentStatus = DocumentStatus.PENDING
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    
    # Validity
    expiry_date: Optional[date] = None
    
    notes: Optional[str] = None


class LandingDocumentCreate(LandingDocumentBase):
    """Model for creating document"""
    pass


class LandingDocument(LandingDocumentBase):
    """Full document model"""
    id: str
    uploaded_by: str
    uploaded_at: datetime
    updated_at: datetime


class VillageLandingPermissionBase(BaseModel):
    """Base model for village landing permissions"""
    booking_id: Optional[str] = None
    inquiry_id: Optional[str] = None
    customer_id: str
    
    # Location details
    location_name: str
    village_name: Optional[str] = None
    district: str
    state: str
    pincode: Optional[str] = None
    latitude: float
    longitude: float
    
    # Land details
    land_owner_name: Optional[str] = None
    land_owner_phone: Optional[str] = None
    land_area_sqft: Optional[float] = None
    land_type: Optional[str] = None  # agricultural, residential, etc.
    
    # Status
    status: LandingPermissionStatus = LandingPermissionStatus.DOCUMENTS_PENDING
    
    # Review
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_notes: Optional[str] = None
    
    notes: Optional[str] = None


class VillageLandingPermissionCreate(VillageLandingPermissionBase):
    """Model for creating permission"""
    pass


class VillageLandingPermission(VillageLandingPermissionBase):
    """Full permission model"""
    id: str
    permission_number: str
    documents: List[str] = []  # Document IDs
    created_at: datetime
    updated_at: datetime


# ============== API REQUEST/RESPONSE MODELS ==============

class LandingPointSearchRequest(BaseModel):
    """Request for searching landing points"""
    latitude: float
    longitude: float
    radius_km: float = 100
    type: Optional[LandingPointType] = None
    state: Optional[str] = None
    available_date: Optional[date] = None


class LandingPointSearchResponse(BaseModel):
    """Response for landing point search"""
    landing_points: List[dict]
    total: int
    radius_km: float


class AvailabilityCheckRequest(BaseModel):
    """Request for checking availability"""
    landing_point_id: str
    date: date
    from_time: Optional[time] = None
    to_time: Optional[time] = None


class AvailabilityCheckResponse(BaseModel):
    """Response for availability check"""
    available: bool
    slots: List[dict] = []
    alternatives: List[dict] = []


class RentCalculationRequest(BaseModel):
    """Request for calculating landing rent"""
    landing_point_id: str
    landing_date: date
    landing_time: time
    duration_hours: float = 1
    aircraft_type: str = "helicopter"


class RentCalculationResponse(BaseModel):
    """Response for rent calculation"""
    base_rent: float
    parking_charge: float
    gst_amount: float
    total_rent: float
    breakdown: dict


class DocumentUploadRequest(BaseModel):
    """Request for document upload"""
    permission_id: str
    doc_type: DocumentType
    file_name: str
    content_type: str


class DocumentVerificationRequest(BaseModel):
    """Request for document verification"""
    document_id: str
    action: str  # approve / reject
    reason: Optional[str] = None
    expiry_date: Optional[date] = None
