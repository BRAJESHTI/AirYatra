"""
Aviation-Grade Helicopter Pricing Engine Service
Complete price calculation with all aviation factors
"""

import logging
import math
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List, Tuple
from uuid import uuid4

from database import get_database
from pricing_models import (
    PricingType, BookingPurpose, DeadLegRateType, CommissionType, FuelCostType,
    PriceCalculationRequest, PriceBreakdown, PriceCalculationResponse
)

logger = logging.getLogger(__name__)

# ==================== UTILITY FUNCTIONS ====================

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in km"""
    R = 6371  # Earth's radius in km
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def estimate_flight_hours(distance_km: float, avg_speed_kmh: float = 200) -> float:
    """Estimate flight hours based on distance"""
    return round(distance_km / avg_speed_kmh, 2)


# ==================== PRICING ENGINE CLASS ====================

class HelicopterPricingEngine:
    """Complete aviation-grade pricing engine"""
    
    def __init__(self):
        self.db = None
        self._initialized = False
        
    async def initialize(self):
        """Initialize database connection"""
        if not self._initialized:
            self.db = get_database()
            self._initialized = True
        
    async def get_admin_controls(self) -> Dict:
        """Get admin pricing controls"""
        if self.db is None:
            await self.initialize()
            
        controls = await self.db.admin_pricing_controls.find_one(
            {"is_active": True}, {"_id": 0}
        )
        
        if not controls:
            # Return defaults
            return {
                "commission_type": "percentage",
                "commission_value": 10,
                "commission_overrides": {},
                "peak_season_enabled": True,
                "peak_surge_multiplier": 1.3,
                "peak_dates": [],
                "fuel_surcharge_enabled": True,
                "fuel_surcharge_percent": 5,
                "convenience_fee_percent": 5,
                "insurance_percent": 2,
                "insurance_enabled": True,
                "gst_percent": 18,
                "cgst_percent": 9,
                "sgst_percent": 9,
                "igst_percent": 18,
                "cancellation_slabs": [
                    {"hours_before": 72, "charge_percent": 10},
                    {"hours_before": 24, "charge_percent": 25},
                    {"hours_before": 12, "charge_percent": 50},
                    {"hours_before": 0, "charge_percent": 100}
                ],
                "weather_abort_refund_percent": 90
            }
        return controls
    
    async def get_operator_pricing(self, operator_id: str, helicopter_id: str = None) -> Dict:
        """Get operator's base pricing configuration"""
        if self.db is None:
            await self.initialize()
            
        query = {"operator_id": operator_id, "is_active": True}
        if helicopter_id:
            query["helicopter_id"] = helicopter_id
            
        pricing = await self.db.operator_pricing.find_one(query, {"_id": 0})
        
        if not pricing:
            # Return defaults
            return {
                "pricing_type": "hourly",
                "price_per_hour": 180000,  # ₹1.8L per hour default
                "min_billable_hours": 2,
                "purpose_multipliers": {
                    "personal": 1.0, "business": 1.0, "wedding": 1.3,
                    "medical": 0.9, "pilgrimage": 1.1, "election": 1.5,
                    "corporate": 1.2, "vip": 1.4, "tourism": 1.0
                }
            }
        return pricing
    
    async def get_dead_leg_config(self, operator_id: str, helicopter_id: str = None) -> Dict:
        """Get dead-leg/positioning configuration"""
        if self.db is None:
            await self.initialize()
            
        query = {"operator_id": operator_id}
        if helicopter_id:
            query["helicopter_id"] = helicopter_id
            
        config = await self.db.dead_leg_pricing.find_one(query, {"_id": 0})
        
        if not config:
            return {
                "enabled": True,
                "rate_type": "per_km",
                "rate_value": 500,
                "free_positioning_km": 0,
                "base_latitude": None,
                "base_longitude": None
            }
        return config
    
    async def get_additional_charges(self, operator_id: str, helicopter_id: str = None) -> Dict:
        """Get additional charges configuration"""
        if self.db is None:
            await self.initialize()
            
        query = {"operator_id": operator_id}
        if helicopter_id:
            query["helicopter_id"] = helicopter_id
            
        charges = await self.db.additional_charges.find_one(query, {"_id": 0})
        
        if not charges:
            return {
                "night_halt_per_night": 25000,
                "crew_accommodation_included": False,
                "crew_accommodation_per_night": 5000,
                "crew_food_allowance_per_day": 1500,
                "waiting_free_minutes": 30,
                "waiting_charge_per_minute": 500,
                "waiting_charge_per_hour": 25000,
                "fuel_cost_type": "included",
                "fuel_surcharge_percent": 0,
                "round_trip_discount_percent": 10,
                "mandatory_return": False
            }
        return charges
    
    async def get_route_pricing(self, from_city: str, to_city: str, operator_id: str = None) -> Optional[Dict]:
        """Check if route-based pricing exists"""
        if self.db is None:
            await self.initialize()
            
        route = await self.db.route_pricing.find_one({
            "route_from": {"$regex": from_city, "$options": "i"},
            "route_to": {"$regex": to_city, "$options": "i"},
            "is_active": True
        }, {"_id": 0})
        
        return route
    
    async def get_landing_rent(self, landing_point_id: str) -> Dict:
        """Get landing point rent"""
        if self.db is None:
            await self.initialize()
            
        if not landing_point_id:
            return {"rent": 0, "name": None}
        
        # Try multiple ID fields for compatibility
        landing = await self.db.landing_points.find_one(
            {"$or": [
                {"landing_point_id": landing_point_id},
                {"id": landing_point_id}
            ]}, 
            {"_id": 0, "landing_point_name": 1, "name": 1, "rent_per_landing": 1, "rent": 1}
        )
        
        if landing:
            rent = landing.get("rent_per_landing") or landing.get("rent") or 0
            name = landing.get("landing_point_name") or landing.get("name")
            return {"rent": rent, "name": name}
        return {"rent": 0, "name": None}
    
    async def check_peak_season(self, date_str: str, region: str = None) -> Tuple[bool, float]:
        """Check if date falls in peak season"""
        admin_controls = await self.get_admin_controls()
        
        if not admin_controls.get("peak_season_enabled"):
            return False, 1.0
            
        try:
            booking_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except:
            return False, 1.0
            
        peak_dates = admin_controls.get("peak_dates", [])
        
        for peak in peak_dates:
            try:
                start = datetime.strptime(peak.get("start", ""), "%Y-%m-%d").date()
                end = datetime.strptime(peak.get("end", ""), "%Y-%m-%d").date()
                
                if start <= booking_date <= end:
                    # Check region if specified
                    if peak.get("regions") and region:
                        if region.lower() not in [r.lower() for r in peak.get("regions", [])]:
                            continue
                    return True, peak.get("multiplier", admin_controls.get("peak_surge_multiplier", 1.3))
            except:
                continue
                
        return False, 1.0
    
    async def get_contract_pricing(self, customer_id: str = None, customer_email: str = None, contract_id: str = None) -> Optional[Dict]:
        """Check for corporate/government contract pricing"""
        if self.db is None:
            await self.initialize()
            
        if contract_id:
            contract = await self.db.corporate_contracts.find_one({
                "contract_id": contract_id,
                "is_active": True
            }, {"_id": 0})
            return contract
            
        if customer_id:
            contract = await self.db.corporate_contracts.find_one({
                "tagged_customer_ids": customer_id,
                "is_active": True
            }, {"_id": 0})
            if contract:
                return contract
                
        if customer_email:
            domain = customer_email.split("@")[-1] if "@" in customer_email else None
            if domain:
                contract = await self.db.corporate_contracts.find_one({
                    "tagged_email_domains": domain,
                    "is_active": True
                }, {"_id": 0})
                if contract:
                    return contract
                    
        return None
    
    async def calculate_price(self, request: PriceCalculationRequest) -> PriceCalculationResponse:
        """
        MASTER PRICE CALCULATION
        
        Formula:
        Operator Base Cost
        + Dead Leg Cost
        + MDG Adjustment
        + Waiting Charges
        + Night Halt / Crew Charges
        + Fuel Surcharge
        + Landing Rent (Pickup + Drop)
        = Operator Gross Cost
        
        + Platform Commission
        + Convenience Fee
        + Insurance
        + Peak / Date Surge
        - Contract Discount
        + GST
        = FINAL CUSTOMER PRICE
        """
        
        if self.db is None:
            await self.initialize()
            
        breakdown = PriceBreakdown()
        audit_log = []
        notes = []
        
        calculation_id = str(uuid4())[:8]
        audit_log.append(f"[{calculation_id}] Starting price calculation at {datetime.now(timezone.utc).isoformat()}")
        
        # ==================== STEP 1: Get Configurations ====================
        admin_controls = await self.get_admin_controls()
        audit_log.append(f"Loaded admin controls: commission={admin_controls.get('commission_value')}%")
        
        # Get operator pricing (use default if not specified)
        operator_id = request.operator_id or "default"
        operator_pricing = await self.get_operator_pricing(operator_id, request.helicopter_id)
        audit_log.append(f"Loaded operator pricing: type={operator_pricing.get('pricing_type')}, rate=₹{operator_pricing.get('price_per_hour')}/hr")
        
        dead_leg_config = await self.get_dead_leg_config(operator_id, request.helicopter_id)
        additional_charges = await self.get_additional_charges(operator_id, request.helicopter_id)
        
        # ==================== STEP 2: Calculate Base Flight Cost ====================
        
        # Check for route-based pricing first (highest priority)
        route_pricing = await self.get_route_pricing(request.pickup_city, request.drop_city, operator_id)
        
        if route_pricing and route_pricing.get("base_price"):
            # Route-based pricing
            breakdown.pricing_type_used = "route"
            breakdown.base_flight_cost = route_pricing.get("base_price")
            audit_log.append(f"Using route pricing: {request.pickup_city} → {request.drop_city} = ₹{breakdown.base_flight_cost}")
        else:
            # Hourly pricing
            breakdown.pricing_type_used = "hourly"
            
            # Estimate flight hours if not provided
            flight_hours = request.estimated_flight_hours
            if not flight_hours:
                flight_hours = estimate_flight_hours(request.distance_km)
                audit_log.append(f"Estimated flight hours: {flight_hours}h for {request.distance_km}km")
            
            breakdown.flight_hours = flight_hours
            breakdown.rate_per_hour = operator_pricing.get("price_per_hour", 180000)
            breakdown.base_flight_cost = breakdown.flight_hours * breakdown.rate_per_hour
            
            audit_log.append(f"Hourly pricing: {breakdown.flight_hours}h × ₹{breakdown.rate_per_hour} = ₹{breakdown.base_flight_cost}")
        
        # ==================== STEP 3: Dead Leg / Positioning Cost ====================
        
        if dead_leg_config.get("enabled"):
            base_lat = dead_leg_config.get("base_latitude")
            base_lon = dead_leg_config.get("base_longitude")
            
            if base_lat and base_lon:
                dead_leg_distance = haversine_distance(
                    base_lat, base_lon,
                    request.pickup_latitude, request.pickup_longitude
                )
                
                free_km = dead_leg_config.get("free_positioning_km", 0)
                billable_distance = max(0, dead_leg_distance - free_km)
                
                if billable_distance > 0:
                    breakdown.dead_leg_enabled = True
                    breakdown.dead_leg_distance_km = round(billable_distance, 2)
                    
                    rate_type = dead_leg_config.get("rate_type", "per_km")
                    rate_value = dead_leg_config.get("rate_value", 500)
                    
                    if rate_type == "per_km":
                        breakdown.dead_leg_cost = billable_distance * rate_value
                    elif rate_type == "per_hour":
                        dead_leg_hours = estimate_flight_hours(billable_distance)
                        breakdown.dead_leg_cost = dead_leg_hours * rate_value
                    elif rate_type == "percentage":
                        breakdown.dead_leg_cost = breakdown.base_flight_cost * (rate_value / 100)
                    elif rate_type == "fixed":
                        breakdown.dead_leg_cost = rate_value
                    
                    breakdown.dead_leg_cost = round(breakdown.dead_leg_cost)
                    audit_log.append(f"Dead leg: {breakdown.dead_leg_distance_km}km = ₹{breakdown.dead_leg_cost}")
        
        # ==================== STEP 4: Minimum Daily Guarantee (MDG) ====================
        
        mdg_hours = operator_pricing.get("min_billable_hours", 2)
        breakdown.mdg_hours = mdg_hours
        
        if breakdown.flight_hours < mdg_hours:
            mdg_adjustment = (mdg_hours - breakdown.flight_hours) * breakdown.rate_per_hour
            breakdown.mdg_adjustment = round(mdg_adjustment)
            audit_log.append(f"MDG adjustment: {mdg_hours}h minimum, adding ₹{breakdown.mdg_adjustment}")
            notes.append(f"Minimum {mdg_hours} hours billing applied")
        
        # ==================== STEP 5: Waiting / Ground Holding Charges ====================
        
        waiting_minutes = request.waiting_time_minutes
        free_minutes = additional_charges.get("waiting_free_minutes", 30)
        breakdown.waiting_minutes = waiting_minutes
        breakdown.waiting_free_minutes = free_minutes
        
        if waiting_minutes > free_minutes:
            billable_waiting = waiting_minutes - free_minutes
            breakdown.waiting_billable_minutes = billable_waiting
            
            # Use hourly rate if more than 60 minutes
            if billable_waiting >= 60:
                waiting_hours = billable_waiting / 60
                breakdown.waiting_charges = round(waiting_hours * additional_charges.get("waiting_charge_per_hour", 25000))
            else:
                breakdown.waiting_charges = round(billable_waiting * additional_charges.get("waiting_charge_per_minute", 500))
            
            audit_log.append(f"Waiting: {billable_waiting}min billable = ₹{breakdown.waiting_charges}")
        
        # ==================== STEP 6: Night Halt & Crew Charges ====================
        
        night_halts = request.night_halts
        breakdown.night_halts = night_halts
        
        if night_halts > 0:
            night_halt_cost = night_halts * additional_charges.get("night_halt_per_night", 25000)
            breakdown.night_halt_cost = round(night_halt_cost)
            
            if not additional_charges.get("crew_accommodation_included"):
                crew_cost = night_halts * (
                    additional_charges.get("crew_accommodation_per_night", 5000) +
                    additional_charges.get("crew_food_allowance_per_day", 1500)
                )
                breakdown.crew_charges = round(crew_cost)
            
            audit_log.append(f"Night halts: {night_halts} nights = ₹{breakdown.night_halt_cost + breakdown.crew_charges}")
        
        # ==================== STEP 7: Fuel Surcharge ====================
        
        fuel_type = additional_charges.get("fuel_cost_type", "included")
        breakdown.fuel_type = fuel_type
        
        if fuel_type == "excluded" or fuel_type == "surcharge":
            # Apply admin fuel surcharge
            if admin_controls.get("fuel_surcharge_enabled"):
                fuel_surcharge_percent = admin_controls.get("fuel_surcharge_percent", 5)
                breakdown.fuel_surcharge = round(breakdown.base_flight_cost * (fuel_surcharge_percent / 100))
                audit_log.append(f"Fuel surcharge: {fuel_surcharge_percent}% = ₹{breakdown.fuel_surcharge}")
        
        # ==================== STEP 8: Landing Rent ====================
        
        pickup_rent = await self.get_landing_rent(request.pickup_landing_point_id)
        drop_rent = await self.get_landing_rent(request.drop_landing_point_id)
        
        breakdown.pickup_landing_rent = pickup_rent.get("rent", 0)
        breakdown.pickup_landing_name = pickup_rent.get("name")
        breakdown.drop_landing_rent = drop_rent.get("rent", 0)
        breakdown.drop_landing_name = drop_rent.get("name")
        breakdown.total_landing_rent = breakdown.pickup_landing_rent + breakdown.drop_landing_rent
        
        if breakdown.total_landing_rent > 0:
            audit_log.append(f"Landing rent: Pickup=₹{breakdown.pickup_landing_rent}, Drop=₹{breakdown.drop_landing_rent}")
        
        # ==================== STEP 9: Purpose Multiplier ====================
        
        purpose = request.booking_purpose.value if hasattr(request.booking_purpose, 'value') else str(request.booking_purpose)
        breakdown.purpose = purpose
        
        purpose_multipliers = operator_pricing.get("purpose_multipliers", {})
        multiplier = purpose_multipliers.get(purpose, 1.0)
        breakdown.purpose_multiplier = multiplier
        
        if multiplier != 1.0:
            base_before_multiplier = breakdown.base_flight_cost + breakdown.dead_leg_cost + breakdown.mdg_adjustment
            breakdown.purpose_adjustment = round(base_before_multiplier * (multiplier - 1))
            audit_log.append(f"Purpose multiplier ({purpose}): {multiplier}x = +₹{breakdown.purpose_adjustment}")
        
        # ==================== STEP 10: Round Trip Discount ====================
        
        breakdown.is_round_trip = request.is_round_trip
        
        if request.is_round_trip:
            discount_percent = additional_charges.get("round_trip_discount_percent", 10)
            breakdown.round_trip_discount_percent = discount_percent
            
            # Apply discount to base cost only
            breakdown.round_trip_discount = round(breakdown.base_flight_cost * (discount_percent / 100))
            audit_log.append(f"Round trip discount: {discount_percent}% = -₹{breakdown.round_trip_discount}")
        
        # ==================== STEP 11: Calculate Operator Gross Cost ====================
        
        breakdown.operator_gross_cost = (
            breakdown.base_flight_cost +
            breakdown.dead_leg_cost +
            breakdown.mdg_adjustment +
            breakdown.waiting_charges +
            breakdown.night_halt_cost +
            breakdown.crew_charges +
            breakdown.fuel_surcharge +
            breakdown.total_landing_rent +
            breakdown.purpose_adjustment -
            breakdown.round_trip_discount
        )
        breakdown.operator_gross_cost = round(breakdown.operator_gross_cost)
        audit_log.append(f"Operator Gross Cost: ₹{breakdown.operator_gross_cost}")
        
        # ==================== STEP 12: Platform Commission ====================
        
        commission_percent = admin_controls.get("commission_value", 10)
        
        # Check for overrides
        overrides = admin_controls.get("commission_overrides", {})
        if operator_id in overrides.get("by_operator", {}):
            commission_percent = overrides["by_operator"][operator_id]
        elif purpose in overrides.get("by_purpose", {}):
            commission_percent = overrides["by_purpose"][purpose]
            
        breakdown.platform_commission_percent = commission_percent
        breakdown.platform_commission = round(breakdown.operator_gross_cost * (commission_percent / 100))
        audit_log.append(f"Platform commission: {commission_percent}% = ₹{breakdown.platform_commission}")
        
        # ==================== STEP 13: Convenience Fee & Insurance ====================
        
        breakdown.convenience_fee_percent = admin_controls.get("convenience_fee_percent", 5)
        breakdown.convenience_fee = round(breakdown.operator_gross_cost * (breakdown.convenience_fee_percent / 100))
        
        if admin_controls.get("insurance_enabled"):
            breakdown.insurance_percent = admin_controls.get("insurance_percent", 2)
            breakdown.insurance = round(breakdown.operator_gross_cost * (breakdown.insurance_percent / 100))
        
        audit_log.append(f"Convenience fee: {breakdown.convenience_fee_percent}% = ₹{breakdown.convenience_fee}")
        audit_log.append(f"Insurance: {breakdown.insurance_percent}% = ₹{breakdown.insurance}")
        
        # ==================== STEP 14: Peak Season Surge ====================
        
        is_peak, surge_multiplier = await self.check_peak_season(request.departure_date, request.pickup_city)
        breakdown.peak_surge_applied = is_peak
        breakdown.peak_surge_multiplier = surge_multiplier
        
        if is_peak and surge_multiplier > 1:
            subtotal = breakdown.operator_gross_cost + breakdown.platform_commission + breakdown.convenience_fee + breakdown.insurance
            breakdown.peak_surge_amount = round(subtotal * (surge_multiplier - 1))
            audit_log.append(f"Peak surge: {surge_multiplier}x = +₹{breakdown.peak_surge_amount}")
            notes.append(f"Peak season pricing applied ({surge_multiplier}x)")
        
        # ==================== STEP 15: Contract Discount ====================
        
        contract = await self.get_contract_pricing(request.customer_id, request.customer_email, request.contract_id)
        
        if contract:
            breakdown.contract_applied = True
            breakdown.contract_discount_percent = contract.get("discount_percent", 0)
            
            if contract.get("fixed_rate_per_hour"):
                # Override with fixed rate
                breakdown.base_flight_cost = breakdown.flight_hours * contract.get("fixed_rate_per_hour")
                audit_log.append(f"Contract fixed rate applied: ₹{contract.get('fixed_rate_per_hour')}/hr")
            else:
                subtotal = breakdown.operator_gross_cost + breakdown.platform_commission
                breakdown.contract_discount = round(subtotal * (breakdown.contract_discount_percent / 100))
                audit_log.append(f"Contract discount: {breakdown.contract_discount_percent}% = -₹{breakdown.contract_discount}")
        
        # ==================== STEP 16: Calculate Taxable Amount ====================
        
        breakdown.taxable_amount = (
            breakdown.operator_gross_cost +
            breakdown.platform_commission +
            breakdown.convenience_fee +
            breakdown.insurance +
            breakdown.peak_surge_amount -
            breakdown.contract_discount
        )
        breakdown.taxable_amount = round(breakdown.taxable_amount)
        
        # ==================== STEP 17: GST Calculation ====================
        
        # Determine if inter-state or intra-state
        pickup_state = request.pickup_city.split(",")[-1].strip() if "," in request.pickup_city else ""
        drop_state = request.drop_city.split(",")[-1].strip() if "," in request.drop_city else ""
        
        if pickup_state and drop_state and pickup_state.lower() != drop_state.lower():
            # Inter-state: IGST
            breakdown.gst_type = "inter_state"
            breakdown.igst_percent = admin_controls.get("igst_percent", 18)
            breakdown.igst = round(breakdown.taxable_amount * (breakdown.igst_percent / 100))
            breakdown.total_gst = breakdown.igst
            audit_log.append(f"IGST (inter-state): {breakdown.igst_percent}% = ₹{breakdown.igst}")
        else:
            # Intra-state: CGST + SGST
            breakdown.gst_type = "intra_state"
            breakdown.cgst_percent = admin_controls.get("cgst_percent", 9)
            breakdown.sgst_percent = admin_controls.get("sgst_percent", 9)
            breakdown.cgst = round(breakdown.taxable_amount * (breakdown.cgst_percent / 100))
            breakdown.sgst = round(breakdown.taxable_amount * (breakdown.sgst_percent / 100))
            breakdown.total_gst = breakdown.cgst + breakdown.sgst
            audit_log.append(f"CGST: {breakdown.cgst_percent}% = ₹{breakdown.cgst}, SGST: {breakdown.sgst_percent}% = ₹{breakdown.sgst}")
        
        # ==================== STEP 18: Final Customer Price ====================
        
        breakdown.final_customer_price = breakdown.taxable_amount + breakdown.total_gst
        audit_log.append(f"FINAL CUSTOMER PRICE: ₹{breakdown.final_customer_price}")
        
        # ==================== STEP 19: Operator Net Payout ====================
        
        # Operator gets: Gross Cost - Commission
        breakdown.operator_net_payout = breakdown.operator_gross_cost - breakdown.platform_commission
        breakdown.platform_earnings = (
            breakdown.platform_commission +
            breakdown.convenience_fee
        )
        
        audit_log.append(f"Operator payout: ₹{breakdown.operator_net_payout}")
        audit_log.append(f"Platform earnings: ₹{breakdown.platform_earnings}")
        
        # ==================== STEP 20: Set Meta ====================
        
        breakdown.calculated_at = datetime.now(timezone.utc).isoformat()
        breakdown.is_estimate = True
        breakdown.valid_until = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
        breakdown.notes = notes
        
        # ==================== BUILD RESPONSE ====================
        
        response = PriceCalculationResponse(
            success=True,
            calculation_id=calculation_id,
            
            booking_summary={
                "route": f"{request.pickup_city} → {request.drop_city}",
                "distance_km": request.distance_km,
                "date": request.departure_date,
                "time": request.departure_time,
                "passengers": request.passenger_count,
                "purpose": purpose,
                "is_round_trip": request.is_round_trip
            },
            
            price_breakdown=breakdown,
            
            # Customer sees final price with basic breakdown
            customer_view={
                "base_charges": breakdown.base_flight_cost + breakdown.dead_leg_cost + breakdown.mdg_adjustment,
                "waiting_charges": breakdown.waiting_charges,
                "night_halt_charges": breakdown.night_halt_cost + breakdown.crew_charges,
                "landing_charges": breakdown.total_landing_rent,
                "convenience_fee": breakdown.convenience_fee,
                "insurance": breakdown.insurance,
                "peak_surge": breakdown.peak_surge_amount,
                "discount": breakdown.round_trip_discount + breakdown.contract_discount,
                "subtotal": breakdown.taxable_amount,
                "gst": breakdown.total_gst,
                "gst_breakdown": {
                    "type": breakdown.gst_type,
                    "cgst": breakdown.cgst,
                    "sgst": breakdown.sgst,
                    "igst": breakdown.igst
                },
                "total": breakdown.final_customer_price,
                "currency": "INR"
            },
            
            # Operator sees their payout
            operator_view={
                "base_price": breakdown.base_flight_cost,
                "additional_charges": breakdown.dead_leg_cost + breakdown.mdg_adjustment + breakdown.waiting_charges + breakdown.night_halt_cost + breakdown.crew_charges,
                "landing_rent_collected": breakdown.total_landing_rent,
                "gross_amount": breakdown.operator_gross_cost,
                "platform_commission": breakdown.platform_commission,
                "commission_percent": breakdown.platform_commission_percent,
                "net_payout": breakdown.operator_net_payout,
                "payout_note": "Amount will be credited after booking completion"
            },
            
            # Admin sees everything
            admin_view={
                "full_breakdown": breakdown.dict(),
                "platform_commission": breakdown.platform_commission,
                "platform_convenience_fee": breakdown.convenience_fee,
                "total_platform_earnings": breakdown.platform_earnings,
                "operator_payout": breakdown.operator_net_payout,
                "gst_collected": breakdown.total_gst
            },
            
            audit_log=audit_log
        )
        
        # Store calculation in DB for audit
        await self.store_calculation(calculation_id, request, response)
        
        return response
    
    async def store_calculation(self, calculation_id: str, request: PriceCalculationRequest, response: PriceCalculationResponse):
        """Store calculation in DB for audit"""
        try:
            await self.db.price_calculations.insert_one({
                "calculation_id": calculation_id,
                "request": request.dict() if hasattr(request, 'dict') else dict(request),
                "response_summary": {
                    "final_price": response.price_breakdown.final_customer_price,
                    "operator_payout": response.price_breakdown.operator_net_payout,
                    "platform_earnings": response.price_breakdown.platform_earnings
                },
                "audit_log": response.audit_log,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        except Exception as e:
            logger.error(f"Failed to store calculation: {e}")


# Singleton instance
pricing_engine = HelicopterPricingEngine()
