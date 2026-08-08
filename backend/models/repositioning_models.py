"""
AirYatra - AI Smart Repositioning Engine (ASRE) Models
Pricing modes: Fixed Route, AI Reverse Auction, Hybrid, Dynamic
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
import uuid


# ============ ENUMS ============
class PricingMode(str, Enum):
    FIXED_ROUTE = "fixed_route"  # Pre-set pricing for specific routes
    AI_REVERSE_AUCTION = "ai_reverse_auction"  # AI matches operators with best quote
    HYBRID = "hybrid"  # Fixed routes + AI auction fallback
    DYNAMIC = "dynamic"  # Real-time demand-based pricing


class BookingType(str, Enum):
    ONE_WAY = "one_way"
    ROUND_TRIP = "round_trip"
    CHARTER = "charter"
    SUBSCRIPTION = "subscription"
    MULTI_CITY = "multi_city"
    EMERGENCY = "emergency"


class OperatorBidStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    AUTO_REJECTED = "auto_rejected"
    NO_RESPONSE = "no_response"
    EXPIRED = "expired"


class DemandLevel(str, Enum):
    LOW = "low"  # <30% bookings
    MEDIUM = "medium"  # 30-60% bookings
    HIGH = "high"  # 60-90% bookings
    VERY_HIGH = "very_high"  # >90% bookings (peak)


class AuctionStatus(str, Enum):
    ACTIVE = "active"
    CLOSED = "closed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_BIDS = "no_bids"


# ============ EMBEDDED MODELS ============
class Coordinates(BaseModel):
    lat: float = 0.0
    lng: float = 0.0


class ChargesBreakdown(BaseModel):
    """Detailed cost breakdown for pricing"""
    # Base Pricing
    base_price: float = 0
    price_per_km: float = 0
    distance_km: float = 0
    distance_cost: float = 0
    
    # Ferry/Repositioning Charges
    repositioning_distance_km: float = 0
    fuel_burn_per_hour: float = 0  # Liters per hour
    fuel_price_per_liter: float = 0
    fuel_cost: float = 0
    
    # Crew Costs
    pilot_hourly_rate: float = 0
    co_pilot_hourly_rate: float = 0
    flight_hours: float = 0
    crew_cost: float = 0
    
    # Landing & Ground Charges
    landing_charges_departure: float = 0
    landing_charges_arrival: float = 0
    parking_charges: float = 0
    ground_handling: float = 0
    
    # Additional Charges
    special_requests_cost: float = 0
    repositioning_fee: float = 0
    catering_cost: float = 0
    insurance_cost: float = 0
    
    # Taxes
    gst_percentage: float = 18
    gst_amount: float = 0
    
    # Discounts
    discount_percent: float = 0
    discount_amount: float = 0
    discount_reason: Optional[str] = None
    
    # Final Total
    subtotal: float = 0
    commission: float = 0
    platform_fee: float = 0
    total_price: float = 0


class AviationDistance(BaseModel):
    """Aviation distance calculation"""
    from_airport_code: str
    from_city: str
    from_coordinates: Coordinates = Coordinates()
    
    to_airport_code: str
    to_city: str
    to_coordinates: Coordinates = Coordinates()
    
    straight_line_distance_km: float = 0
    aviation_route_distance_km: float = 0
    
    aircraft_cruise_speed_kmh: float = 0
    flight_time_hours: float = 0
    flight_time_minutes: int = 0
    
    waypoints: List[Dict] = []
    altitude_profile: str = "standard"
    
    calculated_at: datetime = Field(default_factory=datetime.utcnow)


class OperatorBid(BaseModel):
    """Individual operator bid in reverse auction"""
    bid_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    operator_id: str
    operator_name: str
    aircraft_id: str
    aircraft_registration: str
    aircraft_type: str
    
    # Bid Details
    quoted_price: float
    currency: str = "INR"
    charges_breakdown: Optional[ChargesBreakdown] = None
    
    # Bid Status
    bid_status: OperatorBidStatus = OperatorBidStatus.PENDING
    bid_placed_at: datetime = Field(default_factory=datetime.utcnow)
    response_time_seconds: int = 0
    
    # Operator Info
    operator_rating: float = 0
    operator_response_rate: float = 0
    aircraft_availability: bool = True
    
    # Special Notes
    special_conditions: Optional[str] = None
    includes_catering: bool = False
    includes_crew: bool = True
    valid_till: Optional[datetime] = None
    
    # Acceptance
    accepted_by_customer: bool = False
    accepted_at: Optional[datetime] = None


class FleetLocation(BaseModel):
    """Real-time aircraft location and availability"""
    aircraft_id: str
    aircraft_registration: str
    aircraft_type: str
    operator_id: str
    
    current_location: Dict[str, Any]  # {airport_code, lat, lng, city, state}
    
    is_available: bool = False
    available_from: Optional[datetime] = None
    next_booking_at: Optional[datetime] = None
    
    booking_count_today: int = 0
    utilization_rate: float = 0  # % of day booked
    
    last_updated: datetime = Field(default_factory=datetime.utcnow)


class DemandForecast(BaseModel):
    """AI demand forecasting by city/route"""
    from_location: str
    to_location: str
    
    # Historical data
    avg_bookings_per_day: float = 0
    avg_bookings_per_week: float = 0
    peak_hours: List[int] = []  # 9, 12, 18 etc
    peak_days: List[str] = []  # Mon, Fri, Sat
    seasonal_multiplier: float = 1.0
    
    # AI Prediction
    forecasted_demand: DemandLevel = DemandLevel.MEDIUM
    forecast_confidence: float = 0  # 0-100%
    forecast_date: datetime = Field(default_factory=datetime.utcnow)
    
    # Suggested Actions
    suggested_aircraft_count: int = 0
    suggested_pricing_multiplier: float = 1.0
    expected_utilization: float = 0


# ============ MAIN MODELS ============
class FixedRoutePricingCreate(BaseModel):
    """Create fixed route pricing"""
    operator_id: str
    aircraft_id: Optional[str] = None
    
    # Route Definition
    from_airport_code: str
    from_city: str
    from_coordinates: Coordinates = Coordinates()
    
    to_airport_code: str
    to_city: str
    to_coordinates: Coordinates = Coordinates()
    
    route_distance_km: float
    flight_time_hours: float
    
    # Pricing
    base_price: float
    price_per_additional_km: float = 0
    minimum_price: Optional[float] = None
    maximum_price: Optional[float] = None
    
    # Capacity & Availability
    seats_available: int
    available_from_time: Optional[str] = None  # HH:MM
    available_till_time: Optional[str] = None
    available_days: List[str] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    
    # Inclusions
    includes_crew: bool = True
    includes_fuel: bool = True
    includes_landing_charges: bool = True
    includes_catering: bool = False
    includes_ground_handling: bool = False
    
    # Validity
    effective_from: datetime
    effective_till: Optional[datetime] = None


class FixedRoutePricing(FixedRoutePricingCreate):
    """Fixed route pricing document"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    pricing_id: str = Field(default_factory=lambda: f"FRP-{uuid.uuid4().hex[:8].upper()}")
    
    # Pricing Variations
    pricing_by_time: Dict[str, float] = {
        "morning_6_9": 1.0,
        "daytime_9_17": 1.0,
        "evening_17_21": 1.1,
        "night_21_6": 1.2
    }
    
    booking_type_pricing: Dict[str, float] = {
        "one_way": 1.0,
        "round_trip": 0.85,
        "charter": 1.0,
        "subscription": 0.75
    }
    
    # Special Pricing Rules
    advance_booking_discount: float = 0  # % discount if booked 7+ days before
    same_day_booking_premium: float = 1.2
    
    # GST
    gst_percentage: float = 18
    
    # Status
    is_active: bool = True
    
    # Usage Statistics
    bookings_made: int = 0
    total_revenue: float = 0
    average_response_time: int = 0
    customer_rating: float = 0
    
    # Approval
    approved_by_airyatra: bool = False
    approved_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class AIReverseAuctionCreate(BaseModel):
    """Create AI reverse auction"""
    booking_id: str
    customer_id: str
    customer_name: str
    customer_email: str
    
    # Route Details
    from_location: str
    from_airport_code: Optional[str] = None
    from_coordinates: Optional[Coordinates] = None
    
    to_location: str
    to_airport_code: Optional[str] = None
    to_coordinates: Optional[Coordinates] = None
    
    booking_type: BookingType = BookingType.ONE_WAY
    departure_date: datetime
    return_date: Optional[datetime] = None
    
    passenger_count: int
    special_requirements: Optional[str] = None
    
    # Auction Parameters
    bid_timeout_seconds: int = 300  # 5 minutes
    max_eligible_operators: int = 10
    minimum_acceptable_price: Optional[float] = None
    maximum_budget: Optional[float] = None


class AIReverseAuction(AIReverseAuctionCreate):
    """AI Reverse Auction document"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    auction_id: str = Field(default_factory=lambda: f"AUC-{uuid.uuid4().hex[:8].upper()}")
    
    # Auction Status
    auction_status: AuctionStatus = AuctionStatus.ACTIVE
    started_at: datetime = Field(default_factory=datetime.utcnow)
    closes_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    
    # Bidding
    eligible_operators: List[str] = []
    notified_operators: List[str] = []
    total_bids_received: int = 0
    operator_bids: List[OperatorBid] = []
    
    # Winner
    winning_bid_id: Optional[str] = None
    winning_operator_id: Optional[str] = None
    winning_aircraft_id: Optional[str] = None
    winning_price: Optional[float] = None
    
    # Customer
    customer_viewed_bids: bool = False
    viewed_at: Optional[datetime] = None
    
    # Auto-acceptance
    auto_accept_enabled: bool = True
    auto_accept_criteria: Dict[str, Any] = {
        "rating_minimum": 4.0,
        "response_time_max": 300,
        "price_within_percent": 20
    }
    
    created_at: datetime = Field(default_factory=datetime.utcnow)


class HybridPricingEngine(BaseModel):
    """Hybrid pricing engine configuration"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    engine_id: str = Field(default_factory=lambda: f"HPE-{uuid.uuid4().hex[:8].upper()}")
    
    # Mode
    mode: PricingMode = PricingMode.HYBRID
    
    # Fixed Route Settings
    fixed_route_minimum_utilization: float = 0.3
    fixed_route_availability_threshold: int = 3
    
    # AI Auction Settings
    auction_timeout: int = 300
    auction_enabled: bool = True
    auto_accept_bids: bool = True
    
    # Demand-based Pricing Multipliers
    enable_demand_based_pricing: bool = True
    demand_multipliers: Dict[str, float] = {
        "low": 0.9,
        "medium": 1.0,
        "high": 1.2,
        "very_high": 1.5
    }
    
    # Repositioning Settings
    repositioning_charge_factor: float = 1.0
    insurance_markup_percent: float = 10
    
    # Platform Fees
    platform_fee_percent: float = 15
    gst_percent: float = 18
    
    # Status
    is_production: bool = False
    test_mode_enabled: bool = True
    
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class AIFleetPositioning(BaseModel):
    """AI Fleet Positioning recommendations"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    positioning_id: str = Field(default_factory=lambda: f"AFP-{uuid.uuid4().hex[:8].upper()}")
    
    # Forecast Period
    forecast_date: datetime
    forecast_period_days: int = 7
    
    # Forecasts
    route_forecasts: List[DemandForecast] = []
    
    # Fleet Locations
    fleet_locations: List[FleetLocation] = []
    
    # Recommendations
    recommendations: List[Dict[str, Any]] = []
    
    # Status
    status: str = "draft"  # draft, published, in_progress, completed
    published_at: Optional[datetime] = None
    
    # Notifications
    operators_notified: List[str] = []
    notifications_sent_at: Optional[datetime] = None
    
    # Performance
    recommendations_accepted: int = 0
    recommendations_rejected: int = 0
    actual_revenue_impact: float = 0
    
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PricingTransaction(BaseModel):
    """Tracks all pricing decisions"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    transaction_id: str = Field(default_factory=lambda: f"PTX-{uuid.uuid4().hex[:8].upper()}")
    booking_id: str
    
    # Customer
    customer_id: str
    customer_name: Optional[str] = None
    
    # Route
    from_location: str
    to_location: str
    booking_type: str
    
    # Pricing Decision
    pricing_mode_used: PricingMode
    
    # Fixed Route (if used)
    fixed_route_id: Optional[str] = None
    fixed_route_price: Optional[float] = None
    
    # AI Auction (if used)
    auction_id: Optional[str] = None
    auction_winning_price: Optional[float] = None
    auction_bids_count: int = 0
    
    # Final Pricing
    base_price: float
    charges_breakdown: ChargesBreakdown
    final_price: float
    gst_amount: float
    total_with_gst: float
    
    # Demand
    demand_level: DemandLevel = DemandLevel.MEDIUM
    demand_multiplier: float = 1.0
    
    # Operator Selected
    operator_id: Optional[str] = None
    aircraft_id: Optional[str] = None
    
    # Status
    status: str = "quote_generated"  # quote_generated, accepted, cancelled, completed
    
    quote_generated_at: datetime = Field(default_factory=datetime.utcnow)
    accepted_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None


class InstantQuoteRequest(BaseModel):
    """Request for instant quote"""
    from_location: str
    from_airport_code: Optional[str] = None
    to_location: str
    to_airport_code: Optional[str] = None
    
    departure_date: datetime
    return_date: Optional[datetime] = None
    
    booking_type: BookingType = BookingType.ONE_WAY
    passenger_count: int = 1
    
    aircraft_type: Optional[str] = None
    special_requirements: Optional[str] = None
    
    customer_id: Optional[str] = None


class InstantQuoteResponse(BaseModel):
    """Response with instant quote"""
    success: bool
    pricing_mode: PricingMode
    
    # Quote Details
    quote_id: Optional[str] = None
    base_price: float = 0
    charges_breakdown: Optional[ChargesBreakdown] = None
    
    total_price: float = 0
    gst_amount: float = 0
    final_price: float = 0
    
    # Route Info
    distance_km: float = 0
    flight_time_minutes: int = 0
    
    # Availability
    aircraft_available: bool = False
    available_aircraft: List[Dict] = []
    
    # If no fixed route
    auction_required: bool = False
    auction_id: Optional[str] = None
    
    # Demand Info
    demand_level: DemandLevel = DemandLevel.MEDIUM
    demand_multiplier: float = 1.0
    
    # Valid Till
    quote_valid_till: Optional[datetime] = None
    
    message: str = ""
    message_hi: str = ""
