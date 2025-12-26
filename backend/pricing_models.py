"""
Aviation-Grade Helicopter Pricing Engine
Complete pricing models for operators, admin controls, and price calculation
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime, date

# ==================== ENUMS ====================

class PricingType(str, Enum):
    HOURLY = "hourly"
    ROUTE = "route"
    HALF_DAY = "half_day"
    FULL_DAY = "full_day"
    MULTI_CITY = "multi_city"
    CHARTER = "charter"

class BookingPurpose(str, Enum):
    PERSONAL = "personal"
    BUSINESS = "business"
    WEDDING = "wedding"
    MEDICAL = "medical"
    PILGRIMAGE = "pilgrimage"
    ELECTION = "election"
    CORPORATE = "corporate"
    VIP = "vip"
    TOURISM = "tourism"
    AERIAL_SURVEY = "aerial_survey"
    FILM_SHOOTING = "film_shooting"

class DeadLegRateType(str, Enum):
    PER_KM = "per_km"
    PER_HOUR = "per_hour"
    PERCENTAGE = "percentage"
    FIXED = "fixed"

class CommissionType(str, Enum):
    PERCENTAGE = "percentage"
    FIXED = "fixed"

class FuelCostType(str, Enum):
    INCLUDED = "included"
    EXCLUDED = "excluded"
    SURCHARGE = "surcharge"

# ==================== OPERATOR PRICING MODELS ====================

class OperatorBasePricing(BaseModel):
    """Operator's base pricing configuration for each helicopter"""
    id: Optional[str] = None
    operator_id: Optional[str] = None  # Auto-populated from authenticated user
    helicopter_id: str = "default"
    helicopter_name: Optional[str] = None
    pricing_type: PricingType = PricingType.HOURLY
    
    # Hourly Pricing
    price_per_hour: float = 0
    min_billable_hours: float = 2  # Minimum Daily Guarantee (MDG)
    
    # Route Pricing (Point-to-Point)
    route_from: Optional[str] = None
    route_to: Optional[str] = None
    route_price: Optional[float] = None
    route_distance_km: Optional[float] = None
    
    # Day Package Pricing
    half_day_hours: float = 3
    half_day_price: Optional[float] = None
    full_day_hours: float = 6
    full_day_price: Optional[float] = None
    
    # Multi-City/Tour Pricing
    per_sector_price: Optional[float] = None
    per_day_price: Optional[float] = None
    
    # Purpose-Based Multipliers (operator configurable)
    purpose_multipliers: Dict[str, float] = Field(default_factory=lambda: {
        "personal": 1.0,
        "business": 1.0,
        "wedding": 1.3,
        "medical": 0.9,  # Discount for medical emergencies
        "pilgrimage": 1.1,
        "election": 1.5,
        "corporate": 1.2,
        "vip": 1.4,
        "tourism": 1.0,
        "aerial_survey": 1.2,
        "film_shooting": 1.5
    })
    
    is_active: bool = True
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class DeadLegPricing(BaseModel):
    """Dead-leg/Positioning cost configuration"""
    id: Optional[str] = None
    operator_id: Optional[str] = None  # Auto-populated from authenticated user
    helicopter_id: str = "default"
    
    enabled: bool = True
    rate_type: DeadLegRateType = DeadLegRateType.PER_KM
    rate_value: float = 500  # ₹500 per km OR percentage
    
    # Base location for dead-leg calculation
    base_latitude: Optional[float] = None
    base_longitude: Optional[float] = None
    base_city: Optional[str] = None
    
    # Maximum free positioning distance (km)
    free_positioning_km: float = 0
    
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class AdditionalCharges(BaseModel):
    """Additional charges configuration per helicopter/operator"""
    id: Optional[str] = None
    operator_id: Optional[str] = None  # Auto-populated from authenticated user
    helicopter_id: Optional[str] = None  # If null, applies to all
    
    # Night Halt Charges
    night_halt_per_night: float = 25000
    crew_accommodation_included: bool = False
    crew_accommodation_per_night: float = 5000
    crew_food_allowance_per_day: float = 1500
    
    # Waiting/Ground Holding Charges
    waiting_free_minutes: int = 30
    waiting_charge_per_minute: float = 500
    waiting_charge_per_hour: float = 25000
    
    # Fuel Configuration
    fuel_cost_type: FuelCostType = FuelCostType.INCLUDED
    fuel_surcharge_percent: float = 0  # If fuel excluded
    
    # Round Trip Discount
    round_trip_discount_percent: float = 10
    mandatory_return: bool = False
    
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


# ==================== ADMIN PRICING CONTROLS ====================

class AdminPricingControls(BaseModel):
    """Admin-controlled pricing factors (Operators cannot edit)"""
    id: Optional[str] = None
    
    # Platform Commission (Default)
    commission_type: CommissionType = CommissionType.PERCENTAGE
    commission_value: float = 10  # 10% default
    
    # Commission Overrides
    commission_overrides: Dict[str, Any] = Field(default_factory=lambda: {
        "by_operator": {},      # operator_id: commission_percent
        "by_helicopter_model": {},  # model: commission_percent
        "by_route": {},         # route_key: commission_percent
        "by_purpose": {}        # purpose: commission_percent
    })
    
    # Peak Season / Date-Based Surge
    peak_season_enabled: bool = True
    peak_surge_multiplier: float = 1.3
    peak_dates: List[Dict] = Field(default_factory=list)  # [{start, end, multiplier, regions}]
    
    # Fuel Surcharge (Admin controlled)
    fuel_surcharge_enabled: bool = True
    fuel_surcharge_percent: float = 5
    fuel_price_index: float = 100  # Base index
    
    # Convenience Fee
    convenience_fee_percent: float = 5
    
    # Insurance
    insurance_percent: float = 2
    insurance_enabled: bool = True
    
    # GST
    gst_percent: float = 18
    cgst_percent: float = 9
    sgst_percent: float = 9
    igst_percent: float = 18  # For inter-state
    
    # Cancellation Slabs
    cancellation_slabs: List[Dict] = Field(default_factory=lambda: [
        {"hours_before": 72, "charge_percent": 10, "label": "72+ hours"},
        {"hours_before": 24, "charge_percent": 25, "label": "24-72 hours"},
        {"hours_before": 12, "charge_percent": 50, "label": "12-24 hours"},
        {"hours_before": 0, "charge_percent": 100, "label": "Same day"}
    ])
    
    # Emergency/Weather Rules
    weather_abort_refund_percent: float = 90
    partial_flight_charge_percent: float = 50
    
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class RoutePricing(BaseModel):
    """Pre-defined route pricing (Admin or Operator defined)"""
    id: Optional[str] = None
    
    route_from: str  # City/Location name
    route_from_code: Optional[str] = None  # Airport/Helipad code
    route_to: str
    route_to_code: Optional[str] = None
    
    distance_km: float
    estimated_flight_time_minutes: int
    
    # Base price for this route
    base_price: float
    
    # Operator-specific pricing
    operator_prices: Dict[str, float] = Field(default_factory=dict)  # operator_id: price
    
    # Override flags
    is_popular: bool = False
    is_active: bool = True
    
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class CorporateContract(BaseModel):
    """Corporate/Government contract pricing"""
    id: Optional[str] = None
    contract_id: str
    company_name: str
    contract_type: str  # corporate, government, ngo
    
    # Discount structure
    discount_percent: float = 0
    fixed_rate_per_hour: Optional[float] = None
    
    # Validity
    valid_from: str
    valid_to: str
    
    # Tagged customers who can avail
    tagged_customer_ids: List[str] = Field(default_factory=list)
    tagged_email_domains: List[str] = Field(default_factory=list)  # e.g., @company.com
    
    is_active: bool = True
    created_at: Optional[str] = None


# ==================== PRICE CALCULATION MODELS ====================

class PriceCalculationRequest(BaseModel):
    """Request model for price calculation"""
    # Basic booking info
    operator_id: Optional[str] = None  # If specific operator
    helicopter_id: Optional[str] = None
    
    # Route info
    pickup_city: str
    pickup_latitude: float
    pickup_longitude: float
    drop_city: str
    drop_latitude: float
    drop_longitude: float
    distance_km: float
    
    # Timing
    departure_date: str
    departure_time: str
    return_date: Optional[str] = None
    return_time: Optional[str] = None
    is_round_trip: bool = False
    
    # Duration
    estimated_flight_hours: Optional[float] = None
    waiting_time_minutes: int = 0
    night_halts: int = 0
    
    # Booking details
    pricing_type: PricingType = PricingType.HOURLY
    booking_purpose: BookingPurpose = BookingPurpose.PERSONAL
    passenger_count: int = 1
    
    # Customer info (for contract pricing)
    customer_id: Optional[str] = None
    customer_email: Optional[str] = None
    contract_id: Optional[str] = None
    
    # Landing points
    pickup_landing_point_id: Optional[str] = None
    drop_landing_point_id: Optional[str] = None


class PriceBreakdown(BaseModel):
    """Detailed price breakdown for transparency"""
    # Operator Base Cost
    base_flight_cost: float = 0
    pricing_type_used: str = "hourly"
    flight_hours: float = 0
    rate_per_hour: float = 0
    
    # Dead Leg
    dead_leg_enabled: bool = False
    dead_leg_distance_km: float = 0
    dead_leg_cost: float = 0
    
    # MDG Adjustment
    mdg_hours: float = 0
    mdg_adjustment: float = 0
    
    # Waiting Charges
    waiting_minutes: int = 0
    waiting_free_minutes: int = 0
    waiting_billable_minutes: int = 0
    waiting_charges: float = 0
    
    # Night Halt
    night_halts: int = 0
    night_halt_cost: float = 0
    crew_charges: float = 0
    
    # Fuel
    fuel_type: str = "included"
    fuel_surcharge: float = 0
    
    # Landing Rent
    pickup_landing_rent: float = 0
    pickup_landing_name: Optional[str] = None
    drop_landing_rent: float = 0
    drop_landing_name: Optional[str] = None
    total_landing_rent: float = 0
    
    # Purpose Multiplier
    purpose: str = "personal"
    purpose_multiplier: float = 1.0
    purpose_adjustment: float = 0
    
    # Round Trip Discount
    is_round_trip: bool = False
    round_trip_discount_percent: float = 0
    round_trip_discount: float = 0
    
    # Subtotals
    operator_gross_cost: float = 0
    
    # Platform Charges
    platform_commission_percent: float = 0
    platform_commission: float = 0
    convenience_fee_percent: float = 0
    convenience_fee: float = 0
    insurance_percent: float = 0
    insurance: float = 0
    
    # Peak/Surge
    peak_surge_applied: bool = False
    peak_surge_multiplier: float = 1.0
    peak_surge_amount: float = 0
    
    # Contract Discount
    contract_applied: bool = False
    contract_discount_percent: float = 0
    contract_discount: float = 0
    
    # GST
    taxable_amount: float = 0
    gst_type: str = "intra_state"  # intra_state or inter_state
    cgst_percent: float = 9
    cgst: float = 0
    sgst_percent: float = 9
    sgst: float = 0
    igst_percent: float = 18
    igst: float = 0
    total_gst: float = 0
    
    # Final Price
    final_customer_price: float = 0
    
    # Operator Payout
    operator_net_payout: float = 0
    platform_earnings: float = 0
    
    # Meta
    calculated_at: str = ""
    is_estimate: bool = True
    valid_until: Optional[str] = None
    notes: List[str] = Field(default_factory=list)


class PriceCalculationResponse(BaseModel):
    """Response model for price calculation"""
    success: bool = True
    booking_summary: Dict[str, Any] = Field(default_factory=dict)
    price_breakdown: PriceBreakdown = Field(default_factory=PriceBreakdown)
    
    # Visibility-based responses
    customer_view: Dict[str, Any] = Field(default_factory=dict)
    operator_view: Dict[str, Any] = Field(default_factory=dict)
    admin_view: Dict[str, Any] = Field(default_factory=dict)
    
    # Audit
    calculation_id: str = ""
    audit_log: List[str] = Field(default_factory=list)
