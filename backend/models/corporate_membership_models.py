"""
Corporate Membership Model - AirYatra Aviation Platform

Based on Document [2] requirements:
- Corporate tie-ups and memberships
- Volume-based pricing
- Account management
"""

from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

# ============= ENUMS =============

class MembershipTier(str, Enum):
    BRONZE = "bronze"
    SILVER = "silver"
    GOLD = "gold"
    PLATINUM = "platinum"
    DIAMOND = "diamond"


class MembershipStatus(str, Enum):
    ACTIVE = "active"
    PENDING_APPROVAL = "pending_approval"
    SUSPENDED = "suspended"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class BillingCycle(str, Enum):
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    ANNUAL = "annual"
    PER_BOOKING = "per_booking"


class CorporateAccountStatus(str, Enum):
    ACTIVE = "active"
    PENDING_KYC = "pending_kyc"
    UNDER_REVIEW = "under_review"
    SUSPENDED = "suspended"
    BLACKLISTED = "blacklisted"


# ============= CORPORATE MEMBERSHIP MODEL =============

class CorporateMembershipSchema:
    """
    MongoDB schema for Corporate Memberships
    Collection: corporate_memberships
    """
    
    @staticmethod
    def get_schema():
        return {
            "membership_id": str,
            "corporate_id": str,  # Reference to corporate account
            
            # Company Details
            "company_name": str,
            "company_registration_number": str,
            "gst_number": str,
            "industry": str,
            
            # Contact Person
            "primary_contact_name": str,
            "primary_contact_email": str,
            "primary_contact_phone": str,
            "primary_contact_designation": str,
            
            # Billing Contact
            "billing_contact_name": str,
            "billing_contact_email": str,
            "billing_contact_phone": str,
            
            # Membership Details
            "membership_tier": str,  # MembershipTier
            "membership_status": str,  # MembershipStatus
            "membership_start_date": datetime,
            "membership_end_date": datetime,
            "auto_renewal": bool,
            
            # Pricing & Discounts
            "base_discount_percent": float,  # Fixed discount %
            "volume_discount_tiers": list,  # [{min_bookings: 10, discount: 5}, ...]
            "special_rates": dict,  # {route_id: rate, ...}
            
            # Credit & Billing
            "credit_limit": float,  # INR
            "current_credit_used": float,
            "billing_cycle": str,  # BillingCycle
            "payment_terms_days": int,  # Net 30, Net 45, etc
            
            # Usage Limits
            "monthly_booking_limit": int,
            "current_month_bookings": int,
            "annual_booking_quota": int,
            "bookings_this_year": int,
            
            # Employee Access
            "authorized_bookers": list,  # [{user_id, name, email, can_approve}]
            "approval_required_above": float,  # Amount threshold for approval
            "approvers": list,  # [{user_id, name, email}]
            
            # Account Manager
            "account_manager_id": str,
            "account_manager_name": str,
            "account_manager_email": str,
            "account_manager_phone": str,
            
            # Documents
            "agreement_url": str,
            "agreement_signed_date": datetime,
            "kyc_documents": list,
            "kyc_verified": bool,
            "kyc_verified_at": datetime,
            
            # Preferences
            "preferred_aircraft_types": list,
            "preferred_operators": list,
            "blacklisted_operators": list,
            "default_pickup_locations": list,
            
            # Notifications
            "invoice_email_recipients": list,
            "booking_notification_recipients": list,
            
            # Tracking
            "total_bookings": int,
            "total_spend": float,
            "last_booking_date": datetime,
            
            # Timestamps
            "created_at": datetime,
            "updated_at": datetime,
            "created_by": str,
        }


class CorporateBookingPolicySchema:
    """
    MongoDB schema for Corporate Booking Policies
    Collection: corporate_booking_policies
    """
    
    @staticmethod
    def get_schema():
        return {
            "policy_id": str,
            "corporate_id": str,
            
            # Booking Rules
            "advance_booking_days_min": int,
            "advance_booking_days_max": int,
            "cancellation_allowed_hours_before": int,
            
            # Approval Workflow
            "require_approval_for_all": bool,
            "approval_threshold_amount": float,
            "multi_level_approval": bool,
            "approval_levels": list,  # [{level: 1, approver_ids: [], threshold: 100000}]
            
            # Restrictions
            "allowed_routes": list,  # Empty = all routes
            "blocked_routes": list,
            "allowed_aircraft_types": list,
            "weekend_booking_allowed": bool,
            "holiday_booking_allowed": bool,
            
            # Budget Controls
            "monthly_budget_limit": float,
            "per_booking_limit": float,
            "annual_budget": float,
            
            # Cost Centers
            "require_cost_center": bool,
            "cost_centers": list,  # [{code, name, budget}]
            "require_project_code": bool,
            
            # Timestamps
            "created_at": datetime,
            "updated_at": datetime,
        }


# ============= PYDANTIC API MODELS =============

class CorporateMembershipCreate(BaseModel):
    """Create corporate membership"""
    company_name: str
    company_registration_number: str
    gst_number: Optional[str] = None
    industry: Optional[str] = None
    
    primary_contact_name: str
    primary_contact_email: EmailStr
    primary_contact_phone: str
    primary_contact_designation: Optional[str] = None
    
    billing_contact_name: Optional[str] = None
    billing_contact_email: Optional[EmailStr] = None
    billing_contact_phone: Optional[str] = None
    
    membership_tier: MembershipTier = MembershipTier.BRONZE
    billing_cycle: BillingCycle = BillingCycle.MONTHLY
    payment_terms_days: int = 30
    
    credit_limit: float = 500000  # 5 Lakh default
    monthly_booking_limit: int = 50


class CorporateMembershipUpdate(BaseModel):
    """Update corporate membership"""
    membership_tier: Optional[MembershipTier] = None
    membership_status: Optional[MembershipStatus] = None
    
    credit_limit: Optional[float] = None
    base_discount_percent: Optional[float] = None
    
    monthly_booking_limit: Optional[int] = None
    payment_terms_days: Optional[int] = None
    
    account_manager_id: Optional[str] = None


class AuthorizedBookerCreate(BaseModel):
    """Add authorized booker"""
    user_id: str
    name: str
    email: EmailStr
    phone: Optional[str] = None
    can_approve: bool = False
    booking_limit: Optional[float] = None


class VolumeDiscountTier(BaseModel):
    """Volume discount tier"""
    min_bookings: int
    max_bookings: Optional[int] = None
    discount_percent: float


class CorporateBookingPolicyCreate(BaseModel):
    """Create booking policy"""
    corporate_id: str
    
    advance_booking_days_min: int = 1
    advance_booking_days_max: int = 90
    cancellation_allowed_hours_before: int = 24
    
    require_approval_for_all: bool = False
    approval_threshold_amount: float = 100000
    
    monthly_budget_limit: Optional[float] = None
    per_booking_limit: Optional[float] = None
    
    require_cost_center: bool = False


class CorporateDashboardResponse(BaseModel):
    """Corporate dashboard response"""
    membership_id: str
    company_name: str
    membership_tier: str
    membership_status: str
    
    credit_limit: float
    credit_used: float
    credit_available: float
    
    monthly_booking_limit: int
    bookings_this_month: int
    bookings_remaining: int
    
    total_spend_ytd: float
    total_bookings_ytd: int
    
    discount_percent: float
    upcoming_bookings: int
    pending_approvals: int


class CorporateInvoiceSummary(BaseModel):
    """Corporate invoice summary"""
    invoice_id: str
    corporate_id: str
    company_name: str
    
    invoice_period_start: datetime
    invoice_period_end: datetime
    
    total_bookings: int
    gross_amount: float
    discount_amount: float
    tax_amount: float
    net_amount: float
    
    due_date: datetime
    payment_status: str
