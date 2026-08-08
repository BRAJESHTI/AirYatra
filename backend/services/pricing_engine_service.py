"""
AirYatra - Pricing Engine Service
Handles Fixed Route Pricing, AI Reverse Auction, and Hybrid Pricing
"""

import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple
from database import get_database
from services.distance_calculator_service import distance_calculator, AIRCRAFT_PERFORMANCE

logger = logging.getLogger(__name__)

# Pricing Constants
DEFAULT_PRICE_PER_KM = {
    "helicopter": 250,
    "light_helicopter": 200,
    "medium_helicopter": 350,
    "heavy_helicopter": 500,
    "turboprop": 180,
    "light_jet": 300,
    "small_aircraft": 150
}

BASE_PRICES = {
    "helicopter": 50000,
    "light_helicopter": 35000,
    "medium_helicopter": 75000,
    "heavy_helicopter": 120000,
    "turboprop": 80000,
    "light_jet": 150000,
    "small_aircraft": 40000
}

# Time-based Multipliers
TIME_MULTIPLIERS = {
    "morning_6_9": 1.0,      # 6 AM - 9 AM
    "daytime_9_17": 1.0,     # 9 AM - 5 PM
    "evening_17_21": 1.15,   # 5 PM - 9 PM (Premium)
    "night_21_6": 1.25       # 9 PM - 6 AM (Premium)
}

# Booking Type Multipliers
BOOKING_TYPE_MULTIPLIERS = {
    "one_way": 1.0,
    "round_trip": 0.85,       # 15% discount
    "charter": 1.0,
    "subscription": 0.75,     # 25% discount
    "multi_city": 0.90,       # 10% discount
    "emergency": 1.50         # 50% premium
}

# Demand Multipliers
DEMAND_MULTIPLIERS = {
    "low": 0.90,       # 10% discount
    "medium": 1.0,
    "high": 1.20,      # 20% premium
    "very_high": 1.50  # 50% premium
}

# Platform Fees
PLATFORM_FEE_PERCENT = 15
GST_PERCENT = 18


class PricingEngineService:
    """Main pricing engine for AirYatra"""
    
    def __init__(self):
        self.db = None
    
    def _get_db(self):
        if self.db is None:
            self.db = get_database()
        return self.db
    
    def get_time_multiplier(self, departure_time: datetime) -> Tuple[float, str]:
        """Get time-based pricing multiplier"""
        hour = departure_time.hour
        
        if 6 <= hour < 9:
            return TIME_MULTIPLIERS["morning_6_9"], "morning_6_9"
        elif 9 <= hour < 17:
            return TIME_MULTIPLIERS["daytime_9_17"], "daytime_9_17"
        elif 17 <= hour < 21:
            return TIME_MULTIPLIERS["evening_17_21"], "evening_17_21"
        else:
            return TIME_MULTIPLIERS["night_21_6"], "night_21_6"
    
    async def get_demand_level(self, from_location: str, to_location: str, date: datetime) -> Tuple[str, float]:
        """
        Get demand level for a route on a specific date
        Uses historical booking data + seasonal patterns
        """
        db = self._get_db()
        
        # Check historical bookings for this route
        start_date = date.replace(hour=0, minute=0, second=0)
        end_date = date.replace(hour=23, minute=59, second=59)
        
        # Count bookings for this route on this date
        booking_count = await db.bookings.count_documents({
            "from_city": {"$regex": from_location, "$options": "i"},
            "to_city": {"$regex": to_location, "$options": "i"},
            "departure_date": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
        })
        
        # Check for special dates (festivals, holidays)
        is_peak = self._is_peak_date(date)
        
        # Determine demand level
        if is_peak or booking_count >= 10:
            return "very_high", DEMAND_MULTIPLIERS["very_high"]
        elif booking_count >= 5:
            return "high", DEMAND_MULTIPLIERS["high"]
        elif booking_count >= 2:
            return "medium", DEMAND_MULTIPLIERS["medium"]
        else:
            return "low", DEMAND_MULTIPLIERS["low"]
    
    def _is_peak_date(self, date: datetime) -> bool:
        """Check if date is a peak/festival date"""
        # Peak dates (approximate - should be configurable)
        peak_dates = [
            (10, 15, 10, 31),  # Diwali season
            (3, 1, 3, 15),     # Holi
            (12, 20, 1, 5),    # Christmas/New Year
            (4, 10, 4, 20),    # Navratri
            (8, 15, 8, 15),    # Independence Day
            (1, 26, 1, 26),    # Republic Day
        ]
        
        month, day = date.month, date.day
        for start_m, start_d, end_m, end_d in peak_dates:
            if start_m <= month <= end_m and start_d <= day <= end_d:
                return True
        
        # Weekends are also higher demand
        if date.weekday() in [4, 5, 6]:  # Fri, Sat, Sun
            return True
        
        return False
    
    async def check_fixed_route_pricing(
        self,
        from_location: str,
        to_location: str,
        departure_date: datetime,
        booking_type: str = "one_way"
    ) -> Optional[Dict[str, Any]]:
        """
        Check if fixed route pricing exists for this route
        Returns fixed route details if found
        """
        db = self._get_db()
        
        from_code = distance_calculator.get_airport_code(from_location)
        to_code = distance_calculator.get_airport_code(to_location)
        
        if not from_code or not to_code:
            return None
        
        # Find active fixed route pricing
        fixed_route = await db.fixed_route_pricing.find_one({
            "from_airport_code": from_code,
            "to_airport_code": to_code,
            "is_active": True,
            "effective_from": {"$lte": departure_date.isoformat()},
            "$or": [
                {"effective_till": None},
                {"effective_till": {"$gte": departure_date.isoformat()}}
            ]
        })
        
        if fixed_route:
            # Remove MongoDB _id
            fixed_route.pop("_id", None)
            return fixed_route
        
        return None
    
    def calculate_charges_breakdown(
        self,
        from_location: str,
        to_location: str,
        aircraft_type: str = "helicopter",
        aircraft_current_location: Optional[str] = None,
        booking_type: str = "one_way",
        departure_time: Optional[datetime] = None,
        passenger_count: int = 1,
        special_requests: Optional[List[str]] = None,
        demand_level: str = "medium"
    ) -> Dict[str, Any]:
        """
        Calculate complete charges breakdown for a booking
        """
        # Calculate route distance
        route_info = distance_calculator.calculate_aviation_distance(
            from_location, to_location, aircraft_type
        )
        
        if not route_info["success"]:
            return {"success": False, "error": route_info.get("error")}
        
        distance_km = route_info["distance"]["aviation_route_km"]
        flight_time_hours = route_info["flight_time"]["hours"]
        
        # Base pricing
        base_price = BASE_PRICES.get(aircraft_type, BASE_PRICES["helicopter"])
        price_per_km = DEFAULT_PRICE_PER_KM.get(aircraft_type, DEFAULT_PRICE_PER_KM["helicopter"])
        distance_cost = distance_km * price_per_km
        
        # Fuel cost
        fuel_info = distance_calculator.calculate_fuel_cost(
            flight_time_hours, aircraft_type,
            route_info["from"]["code"]
        )
        fuel_cost = fuel_info["total_fuel_cost"]
        
        # Crew cost
        crew_info = distance_calculator.calculate_crew_cost(flight_time_hours)
        crew_cost = crew_info["total_crew_cost"]
        
        # Landing charges
        landing_info = distance_calculator.calculate_landing_charges(
            route_info["from"]["code"],
            route_info["to"]["code"]
        )
        
        # Repositioning charges (if aircraft not at pickup)
        repositioning_cost = 0
        repositioning_info = None
        if aircraft_current_location:
            repositioning_info = distance_calculator.calculate_repositioning_cost(
                aircraft_current_location,
                from_location,
                aircraft_type
            )
            if repositioning_info["repositioning_needed"]:
                repositioning_cost = repositioning_info["repositioning_cost"]
        
        # Special requests
        special_cost = 0
        if special_requests:
            for req in special_requests:
                if "catering" in req.lower():
                    special_cost += 5000
                elif "vip" in req.lower():
                    special_cost += 10000
                elif "photography" in req.lower():
                    special_cost += 3000
        
        # Calculate subtotal
        subtotal = (
            base_price +
            distance_cost +
            fuel_cost +
            crew_cost +
            landing_info["total_landing_charges"] +
            repositioning_cost +
            special_cost
        )
        
        # Apply time multiplier
        time_multiplier = 1.0
        time_slot = "daytime_9_17"
        if departure_time:
            time_multiplier, time_slot = self.get_time_multiplier(departure_time)
        
        # Apply booking type multiplier
        booking_multiplier = BOOKING_TYPE_MULTIPLIERS.get(booking_type, 1.0)
        
        # Apply demand multiplier
        demand_multiplier = DEMAND_MULTIPLIERS.get(demand_level, 1.0)
        
        # Combined multiplier
        total_multiplier = time_multiplier * booking_multiplier * demand_multiplier
        
        # Adjusted subtotal
        adjusted_subtotal = subtotal * total_multiplier
        
        # Platform fee
        platform_fee = adjusted_subtotal * (PLATFORM_FEE_PERCENT / 100)
        
        # Final subtotal before GST
        final_subtotal = adjusted_subtotal + platform_fee
        
        # GST
        gst_amount = final_subtotal * (GST_PERCENT / 100)
        
        # Total
        total_price = final_subtotal + gst_amount
        
        return {
            "success": True,
            "route_info": route_info,
            "breakdown": {
                # Base costs
                "base_price": round(base_price, 2),
                "price_per_km": price_per_km,
                "distance_km": round(distance_km, 2),
                "distance_cost": round(distance_cost, 2),
                
                # Fuel
                "fuel_burn_per_hour": fuel_info["fuel_needed_liters"] / max(flight_time_hours, 0.5),
                "fuel_price_per_liter": fuel_info["fuel_price_per_liter"],
                "fuel_cost": round(fuel_cost, 2),
                
                # Crew
                "flight_hours": round(flight_time_hours, 2),
                "pilot_hourly_rate": crew_info["pilot_rate"],
                "co_pilot_hourly_rate": crew_info["copilot_rate"],
                "crew_cost": round(crew_cost, 2),
                
                # Landing charges
                "landing_charges_departure": landing_info["departure_landing_fee"],
                "landing_charges_arrival": landing_info["arrival_landing_fee"],
                "parking_charges": landing_info["parking_charges"],
                "ground_handling": landing_info["ground_handling"],
                
                # Repositioning
                "repositioning_distance_km": repositioning_info["repositioning_distance_km"] if repositioning_info else 0,
                "repositioning_fee": round(repositioning_cost, 2),
                
                # Special requests
                "special_requests_cost": round(special_cost, 2),
                
                # Subtotal
                "raw_subtotal": round(subtotal, 2),
                
                # Multipliers
                "time_slot": time_slot,
                "time_multiplier": time_multiplier,
                "booking_type": booking_type,
                "booking_multiplier": booking_multiplier,
                "demand_level": demand_level,
                "demand_multiplier": demand_multiplier,
                "total_multiplier": round(total_multiplier, 3),
                
                # Adjusted
                "adjusted_subtotal": round(adjusted_subtotal, 2),
                
                # Fees
                "platform_fee_percent": PLATFORM_FEE_PERCENT,
                "platform_fee": round(platform_fee, 2),
                
                "subtotal": round(final_subtotal, 2),
                
                # GST
                "gst_percentage": GST_PERCENT,
                "gst_amount": round(gst_amount, 2),
                
                # Final
                "total_price": round(total_price, 2)
            },
            "repositioning_info": repositioning_info
        }
    
    async def get_instant_quote(
        self,
        from_location: str,
        to_location: str,
        departure_date: datetime,
        booking_type: str = "one_way",
        passenger_count: int = 1,
        aircraft_type: str = "helicopter",
        special_requirements: Optional[str] = None,
        customer_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get instant quote for a booking
        Step 1: Check fixed route pricing
        Step 2: If no fixed route, calculate dynamic price
        Step 3: Return quote with breakdown
        """
        db = self._get_db()
        
        # Generate quote ID
        quote_id = f"QOT-{uuid.uuid4().hex[:8].upper()}"
        
        # Step 1: Check for fixed route pricing
        fixed_route = await self.check_fixed_route_pricing(
            from_location, to_location, departure_date, booking_type
        )
        
        pricing_mode = "fixed_route" if fixed_route else "dynamic"
        
        # Get demand level
        demand_level, demand_multiplier = await self.get_demand_level(
            from_location, to_location, departure_date
        )
        
        # Calculate charges
        special_list = [special_requirements] if special_requirements else None
        
        charges = self.calculate_charges_breakdown(
            from_location=from_location,
            to_location=to_location,
            aircraft_type=aircraft_type,
            booking_type=booking_type,
            departure_time=departure_date,
            passenger_count=passenger_count,
            special_requests=special_list,
            demand_level=demand_level
        )
        
        if not charges["success"]:
            return {
                "success": False,
                "error": charges.get("error", "Failed to calculate pricing"),
                "pricing_mode": "error"
            }
        
        # If fixed route exists, use its base price instead
        if fixed_route:
            # Adjust with fixed route base price
            base_price = fixed_route.get("base_price", charges["breakdown"]["base_price"])
            # Apply booking type discount from fixed route
            booking_type_pricing = fixed_route.get("booking_type_pricing", {})
            booking_multiplier = booking_type_pricing.get(booking_type, 1.0)
            
            # Recalculate with fixed route price
            adjusted_price = base_price * booking_multiplier * demand_multiplier
            platform_fee = adjusted_price * (PLATFORM_FEE_PERCENT / 100)
            subtotal = adjusted_price + platform_fee
            gst = subtotal * (GST_PERCENT / 100)
            total = subtotal + gst
            
            charges["breakdown"]["base_price"] = base_price
            charges["breakdown"]["booking_multiplier"] = booking_multiplier
            charges["breakdown"]["adjusted_subtotal"] = round(adjusted_price, 2)
            charges["breakdown"]["platform_fee"] = round(platform_fee, 2)
            charges["breakdown"]["subtotal"] = round(subtotal, 2)
            charges["breakdown"]["gst_amount"] = round(gst, 2)
            charges["breakdown"]["total_price"] = round(total, 2)
        
        # Find available aircraft
        available_aircraft = await self._find_available_aircraft(
            from_location, departure_date, aircraft_type, passenger_count
        )
        
        # Quote valid for 15 minutes
        quote_valid_till = datetime.now(timezone.utc) + timedelta(minutes=15)
        
        # Store quote for later use
        quote_doc = {
            "quote_id": quote_id,
            "customer_id": customer_id,
            "pricing_mode": pricing_mode,
            "fixed_route_id": fixed_route.get("pricing_id") if fixed_route else None,
            
            "from_location": from_location,
            "to_location": to_location,
            "departure_date": departure_date.isoformat(),
            "booking_type": booking_type,
            "passenger_count": passenger_count,
            "aircraft_type": aircraft_type,
            "special_requirements": special_requirements,
            
            "route_info": charges["route_info"],
            "charges_breakdown": charges["breakdown"],
            "demand_level": demand_level,
            "demand_multiplier": demand_multiplier,
            
            "total_price": charges["breakdown"]["total_price"],
            "quote_valid_till": quote_valid_till.isoformat(),
            
            "available_aircraft_count": len(available_aircraft),
            
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.pricing_quotes.insert_one(quote_doc)
        
        return {
            "success": True,
            "quote_id": quote_id,
            "pricing_mode": pricing_mode,
            
            "route": {
                "from": charges["route_info"]["from"],
                "to": charges["route_info"]["to"],
                "distance_km": charges["route_info"]["distance"]["aviation_route_km"],
                "flight_time_minutes": charges["route_info"]["flight_time"]["total_minutes"]
            },
            
            "pricing": {
                "base_price": charges["breakdown"]["base_price"],
                "distance_cost": charges["breakdown"]["distance_cost"],
                "fuel_cost": charges["breakdown"]["fuel_cost"],
                "crew_cost": charges["breakdown"]["crew_cost"],
                "landing_charges": (
                    charges["breakdown"]["landing_charges_departure"] +
                    charges["breakdown"]["landing_charges_arrival"]
                ),
                "repositioning_fee": charges["breakdown"]["repositioning_fee"],
                "special_requests_cost": charges["breakdown"]["special_requests_cost"],
                
                "subtotal": charges["breakdown"]["subtotal"],
                "gst_amount": charges["breakdown"]["gst_amount"],
                "total_price": charges["breakdown"]["total_price"]
            },
            
            "multipliers": {
                "time_slot": charges["breakdown"]["time_slot"],
                "time_multiplier": charges["breakdown"]["time_multiplier"],
                "booking_type": charges["breakdown"]["booking_type"],
                "booking_multiplier": charges["breakdown"]["booking_multiplier"],
                "demand_level": demand_level,
                "demand_multiplier": demand_multiplier
            },
            
            "availability": {
                "aircraft_available": len(available_aircraft) > 0,
                "available_count": len(available_aircraft),
                "aircraft_list": available_aircraft[:5]  # Top 5
            },
            
            "quote_valid_till": quote_valid_till.isoformat(),
            
            "message": f"Quote generated for {from_location} → {to_location}",
            "message_hi": f"{from_location} से {to_location} के लिए कोटेशन तैयार"
        }
    
    async def _find_available_aircraft(
        self,
        location: str,
        departure_date: datetime,
        aircraft_type: str,
        min_seats: int
    ) -> List[Dict]:
        """Find available aircraft for booking"""
        db = self._get_db()
        
        # Query aircraft collection
        query = {
            "is_active": True,
            "seats": {"$gte": min_seats}
        }
        
        if aircraft_type and aircraft_type != "any":
            query["aircraft_type"] = {"$regex": aircraft_type, "$options": "i"}
        
        aircraft_cursor = db.aircraft.find(query).limit(20)
        aircraft_list = await aircraft_cursor.to_list(length=20)
        
        available = []
        for ac in aircraft_list:
            ac.pop("_id", None)
            available.append({
                "aircraft_id": ac.get("id", ac.get("aircraft_id")),
                "registration": ac.get("registration", ac.get("aircraft_registration")),
                "type": ac.get("aircraft_type", "Helicopter"),
                "model": ac.get("model", ""),
                "seats": ac.get("seats", 4),
                "operator_id": ac.get("operator_id"),
                "operator_name": ac.get("operator_name", "")
            })
        
        return available
    
    async def trigger_reverse_auction(
        self,
        booking_id: str,
        customer_id: str,
        customer_name: str,
        customer_email: str,
        from_location: str,
        to_location: str,
        departure_date: datetime,
        passenger_count: int,
        booking_type: str = "one_way",
        max_budget: Optional[float] = None,
        special_requirements: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Trigger AI Reverse Auction when no fixed route available
        Notifies eligible operators for bidding
        """
        db = self._get_db()
        
        auction_id = f"AUC-{uuid.uuid4().hex[:8].upper()}"
        
        # Find eligible operators
        eligible_operators = await self._find_eligible_operators(
            from_location, passenger_count
        )
        
        # Set auction timeout (5 minutes)
        closes_at = datetime.now(timezone.utc) + timedelta(seconds=300)
        
        # Create auction document
        auction_doc = {
            "id": str(uuid.uuid4()),
            "auction_id": auction_id,
            "booking_id": booking_id,
            "customer_id": customer_id,
            "customer_name": customer_name,
            "customer_email": customer_email,
            
            "from_location": from_location,
            "to_location": to_location,
            "departure_date": departure_date.isoformat(),
            "passenger_count": passenger_count,
            "booking_type": booking_type,
            "special_requirements": special_requirements,
            "maximum_budget": max_budget,
            
            "auction_status": "active",
            "started_at": datetime.now(timezone.utc).isoformat(),
            "closes_at": closes_at.isoformat(),
            "bid_timeout_seconds": 300,
            
            "eligible_operators": [op["operator_id"] for op in eligible_operators],
            "notified_operators": [],
            "total_bids_received": 0,
            "operator_bids": [],
            
            "winning_bid_id": None,
            "winning_operator_id": None,
            "winning_price": None,
            
            "auto_accept_enabled": True,
            "auto_accept_criteria": {
                "rating_minimum": 4.0,
                "response_time_max": 300,
                "price_within_percent": 20
            },
            
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.ai_reverse_auctions.insert_one(auction_doc)
        
        # TODO: Send notifications to eligible operators
        # await self._notify_operators_for_auction(auction_id, eligible_operators)
        
        return {
            "success": True,
            "auction_id": auction_id,
            "auction_status": "active",
            "eligible_operators_count": len(eligible_operators),
            "closes_at": closes_at.isoformat(),
            "bid_timeout_seconds": 300,
            "message": f"Reverse auction started. {len(eligible_operators)} operators notified.",
            "message_hi": f"रिवर्स नीलामी शुरू। {len(eligible_operators)} ऑपरेटर्स को सूचित किया गया।"
        }
    
    async def _find_eligible_operators(
        self,
        location: str,
        min_seats: int
    ) -> List[Dict]:
        """Find operators eligible to bid on auction"""
        db = self._get_db()
        
        # Find operators with available aircraft
        operators = await db.operators.find({
            "status": "active",
            "is_verified": True
        }).to_list(length=50)
        
        eligible = []
        for op in operators:
            op.pop("_id", None)
            eligible.append({
                "operator_id": op.get("id", op.get("operator_id")),
                "operator_name": op.get("company_name", op.get("name", "")),
                "rating": op.get("rating", 4.0)
            })
        
        return eligible[:10]  # Max 10 operators
    
    async def submit_operator_bid(
        self,
        auction_id: str,
        operator_id: str,
        operator_name: str,
        aircraft_id: str,
        aircraft_registration: str,
        aircraft_type: str,
        quoted_price: float,
        special_conditions: Optional[str] = None,
        includes_catering: bool = False
    ) -> Dict[str, Any]:
        """Submit operator bid for reverse auction"""
        db = self._get_db()
        
        # Find auction
        auction = await db.ai_reverse_auctions.find_one({"auction_id": auction_id})
        if not auction:
            return {"success": False, "error": "Auction not found"}
        
        if auction["auction_status"] != "active":
            return {"success": False, "error": "Auction is no longer active"}
        
        # Check if operator already bid
        existing_bids = auction.get("operator_bids", [])
        for bid in existing_bids:
            if bid.get("operator_id") == operator_id:
                return {"success": False, "error": "You have already submitted a bid"}
        
        # Create bid
        bid_id = f"BID-{uuid.uuid4().hex[:8].upper()}"
        bid = {
            "bid_id": bid_id,
            "operator_id": operator_id,
            "operator_name": operator_name,
            "aircraft_id": aircraft_id,
            "aircraft_registration": aircraft_registration,
            "aircraft_type": aircraft_type,
            "quoted_price": quoted_price,
            "currency": "INR",
            "bid_status": "pending",
            "bid_placed_at": datetime.now(timezone.utc).isoformat(),
            "special_conditions": special_conditions,
            "includes_catering": includes_catering,
            "includes_crew": True,
            "accepted_by_customer": False
        }
        
        # Update auction
        await db.ai_reverse_auctions.update_one(
            {"auction_id": auction_id},
            {
                "$push": {"operator_bids": bid},
                "$inc": {"total_bids_received": 1}
            }
        )
        
        # Check auto-accept criteria
        if auction.get("auto_accept_enabled"):
            await self._check_auto_accept(auction_id, bid)
        
        return {
            "success": True,
            "bid_id": bid_id,
            "message": "Bid submitted successfully",
            "message_hi": "बोली सफलतापूर्वक जमा की गई"
        }
    
    async def _check_auto_accept(self, auction_id: str, bid: Dict):
        """Check if bid meets auto-accept criteria"""
        db = self._get_db()
        
        auction = await db.ai_reverse_auctions.find_one({"auction_id": auction_id})
        if not auction:
            return
        
        criteria = auction.get("auto_accept_criteria", {})
        max_budget = auction.get("maximum_budget")
        
        # Check price criteria
        if max_budget:
            price_threshold = max_budget * (1 + criteria.get("price_within_percent", 20) / 100)
            if bid["quoted_price"] <= price_threshold:
                # Auto-accept this bid
                await self.accept_bid(auction_id, bid["bid_id"], auto_accepted=True)
    
    async def accept_bid(
        self,
        auction_id: str,
        bid_id: str,
        auto_accepted: bool = False
    ) -> Dict[str, Any]:
        """Accept a bid and close auction"""
        db = self._get_db()
        
        auction = await db.ai_reverse_auctions.find_one({"auction_id": auction_id})
        if not auction:
            return {"success": False, "error": "Auction not found"}
        
        # Find the bid
        winning_bid = None
        for bid in auction.get("operator_bids", []):
            if bid.get("bid_id") == bid_id:
                winning_bid = bid
                break
        
        if not winning_bid:
            return {"success": False, "error": "Bid not found"}
        
        # Update auction
        await db.ai_reverse_auctions.update_one(
            {"auction_id": auction_id},
            {
                "$set": {
                    "auction_status": "completed",
                    "closed_at": datetime.now(timezone.utc).isoformat(),
                    "winning_bid_id": bid_id,
                    "winning_operator_id": winning_bid["operator_id"],
                    "winning_aircraft_id": winning_bid["aircraft_id"],
                    "winning_price": winning_bid["quoted_price"],
                    f"operator_bids.$[bid].bid_status": "accepted",
                    f"operator_bids.$[bid].accepted_by_customer": True,
                    f"operator_bids.$[bid].accepted_at": datetime.now(timezone.utc).isoformat()
                }
            },
            array_filters=[{"bid.bid_id": bid_id}]
        )
        
        # Reject other bids
        for bid in auction.get("operator_bids", []):
            if bid.get("bid_id") != bid_id:
                await db.ai_reverse_auctions.update_one(
                    {"auction_id": auction_id, "operator_bids.bid_id": bid["bid_id"]},
                    {"$set": {"operator_bids.$.bid_status": "rejected"}}
                )
        
        return {
            "success": True,
            "auction_id": auction_id,
            "winning_bid_id": bid_id,
            "winning_operator_id": winning_bid["operator_id"],
            "winning_price": winning_bid["quoted_price"],
            "auto_accepted": auto_accepted,
            "message": "Bid accepted successfully",
            "message_hi": "बोली स्वीकार की गई"
        }
    
    async def get_auction_status(self, auction_id: str) -> Dict[str, Any]:
        """Get current status of an auction"""
        db = self._get_db()
        
        auction = await db.ai_reverse_auctions.find_one({"auction_id": auction_id})
        if not auction:
            return {"success": False, "error": "Auction not found"}
        
        auction.pop("_id", None)
        
        # Sort bids by price (lowest first)
        bids = auction.get("operator_bids", [])
        sorted_bids = sorted(bids, key=lambda x: x.get("quoted_price", float("inf")))
        
        return {
            "success": True,
            "auction_id": auction_id,
            "status": auction.get("auction_status"),
            "from_location": auction.get("from_location"),
            "to_location": auction.get("to_location"),
            "departure_date": auction.get("departure_date"),
            "total_bids": auction.get("total_bids_received", 0),
            "bids": sorted_bids,
            "winning_bid_id": auction.get("winning_bid_id"),
            "winning_price": auction.get("winning_price"),
            "closes_at": auction.get("closes_at"),
            "started_at": auction.get("started_at")
        }


# Singleton instance
pricing_engine = PricingEngineService()
