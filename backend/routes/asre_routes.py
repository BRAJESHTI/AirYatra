"""
AirYatra - AI Smart Repositioning Engine (ASRE) Routes
Pricing, Distance Calculator, Reverse Auction APIs
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel
from database import get_database
from middleware import get_current_user
from services.distance_calculator_service import distance_calculator
from services.pricing_engine_service import pricing_engine
import uuid
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/asre", tags=["AI Smart Repositioning Engine"])


# ============ REQUEST MODELS ============
class InstantQuoteRequest(BaseModel):
    from_location: str
    to_location: str
    departure_date: datetime
    return_date: Optional[datetime] = None
    booking_type: str = "one_way"
    passenger_count: int = 1
    aircraft_type: str = "helicopter"
    special_requirements: Optional[str] = None


class FixedRoutePricingCreate(BaseModel):
    from_airport_code: str
    from_city: str
    to_airport_code: str
    to_city: str
    base_price: float
    route_distance_km: float
    flight_time_hours: float
    seats_available: int
    aircraft_type: str = "helicopter"
    includes_crew: bool = True
    includes_fuel: bool = True
    includes_landing_charges: bool = True
    includes_catering: bool = False
    effective_from: datetime
    effective_till: Optional[datetime] = None
    available_days: List[str] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


class ReverseAuctionRequest(BaseModel):
    booking_id: str
    from_location: str
    to_location: str
    departure_date: datetime
    passenger_count: int
    booking_type: str = "one_way"
    max_budget: Optional[float] = None
    special_requirements: Optional[str] = None


class OperatorBidRequest(BaseModel):
    auction_id: str
    aircraft_id: str
    aircraft_registration: str
    aircraft_type: str
    quoted_price: float
    special_conditions: Optional[str] = None
    includes_catering: bool = False


# ============ DISTANCE CALCULATOR ROUTES ============
@router.get("/distance/calculate")
async def calculate_distance(
    from_location: str = Query(..., description="Origin city or airport code"),
    to_location: str = Query(..., description="Destination city or airport code"),
    aircraft_type: str = Query("helicopter", description="Aircraft type")
):
    """
    Calculate aviation distance between two locations
    Returns distance, flight time, and route details
    """
    result = distance_calculator.calculate_aviation_distance(
        from_location, to_location, aircraft_type
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result


@router.get("/distance/airports")
async def get_all_airports():
    """Get list of all supported airports"""
    airports = distance_calculator.get_all_airports()
    return {
        "success": True,
        "count": len(airports),
        "airports": airports
    }


@router.get("/distance/airports/search")
async def search_airports(q: str = Query(..., min_length=2)):
    """Search airports by city name or code"""
    results = distance_calculator.search_airports(q)
    return {
        "success": True,
        "count": len(results),
        "results": results
    }


@router.get("/distance/repositioning")
async def calculate_repositioning(
    aircraft_location: str = Query(..., description="Current aircraft location"),
    pickup_location: str = Query(..., description="Customer pickup location"),
    aircraft_type: str = Query("helicopter")
):
    """
    Calculate repositioning/ferry cost if aircraft needs to move to pickup point
    """
    result = distance_calculator.calculate_repositioning_cost(
        aircraft_location, pickup_location, aircraft_type
    )
    return result


# ============ PRICING ROUTES ============
@router.post("/pricing/instant-quote")
async def get_instant_quote(request: InstantQuoteRequest):
    """
    Get instant quote for a booking
    Uses Fixed Route Pricing if available, otherwise Dynamic Pricing
    """
    try:
        result = await pricing_engine.get_instant_quote(
            from_location=request.from_location,
            to_location=request.to_location,
            departure_date=request.departure_date,
            booking_type=request.booking_type,
            passenger_count=request.passenger_count,
            aircraft_type=request.aircraft_type,
            special_requirements=request.special_requirements
        )
        return result
    except Exception as e:
        logger.error(f"Error getting instant quote: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pricing/quote/{quote_id}")
async def get_quote_details(quote_id: str):
    """Get details of a previously generated quote"""
    db = get_database()
    
    quote = await db.pricing_quotes.find_one({"quote_id": quote_id})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    quote.pop("_id", None)
    
    # Check if quote is still valid
    valid_till = datetime.fromisoformat(quote.get("quote_valid_till", ""))
    is_valid = datetime.now(timezone.utc) < valid_till
    quote["is_valid"] = is_valid
    
    return {"success": True, "quote": quote}


@router.get("/pricing/charges-breakdown")
async def get_charges_breakdown(
    from_location: str = Query(...),
    to_location: str = Query(...),
    aircraft_type: str = Query("helicopter"),
    aircraft_current_location: Optional[str] = Query(None),
    booking_type: str = Query("one_way"),
    passenger_count: int = Query(1),
    demand_level: str = Query("medium")
):
    """
    Get detailed charges breakdown for a route
    Includes all cost components
    """
    result = pricing_engine.calculate_charges_breakdown(
        from_location=from_location,
        to_location=to_location,
        aircraft_type=aircraft_type,
        aircraft_current_location=aircraft_current_location,
        booking_type=booking_type,
        passenger_count=passenger_count,
        demand_level=demand_level
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result


# ============ FIXED ROUTE PRICING ROUTES ============
@router.get("/pricing/fixed-routes")
async def get_fixed_routes(
    from_airport: Optional[str] = None,
    to_airport: Optional[str] = None,
    is_active: bool = True,
    limit: int = Query(50, le=100)
):
    """Get all fixed route pricing configurations"""
    db = get_database()
    
    query = {"is_active": is_active}
    if from_airport:
        query["from_airport_code"] = from_airport.upper()
    if to_airport:
        query["to_airport_code"] = to_airport.upper()
    
    routes = await db.fixed_route_pricing.find(query).limit(limit).to_list(length=limit)
    
    for route in routes:
        route.pop("_id", None)
    
    return {
        "success": True,
        "count": len(routes),
        "routes": routes
    }


@router.post("/pricing/fixed-routes")
async def create_fixed_route(
    request: FixedRoutePricingCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new fixed route pricing (Operator/Admin only)"""
    db = get_database()
    
    # Check permissions
    roles = current_user.get("roles", [])
    if not any(r in roles for r in ["admin", "super_admin", "operator"]):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Generate pricing ID
    pricing_id = f"FRP-{uuid.uuid4().hex[:8].upper()}"
    
    route_doc = {
        "id": str(uuid.uuid4()),
        "pricing_id": pricing_id,
        "operator_id": current_user.get("id"),
        
        "from_airport_code": request.from_airport_code.upper(),
        "from_city": request.from_city,
        "to_airport_code": request.to_airport_code.upper(),
        "to_city": request.to_city,
        
        "base_price": request.base_price,
        "route_distance_km": request.route_distance_km,
        "flight_time_hours": request.flight_time_hours,
        "seats_available": request.seats_available,
        "aircraft_type": request.aircraft_type,
        
        "includes_crew": request.includes_crew,
        "includes_fuel": request.includes_fuel,
        "includes_landing_charges": request.includes_landing_charges,
        "includes_catering": request.includes_catering,
        
        "effective_from": request.effective_from.isoformat(),
        "effective_till": request.effective_till.isoformat() if request.effective_till else None,
        "available_days": request.available_days,
        
        "pricing_by_time": {
            "morning_6_9": 1.0,
            "daytime_9_17": 1.0,
            "evening_17_21": 1.15,
            "night_21_6": 1.25
        },
        "booking_type_pricing": {
            "one_way": 1.0,
            "round_trip": 0.85,
            "charter": 1.0,
            "subscription": 0.75
        },
        
        "gst_percentage": 18,
        "is_active": True,
        "approved_by_airyatra": False,
        
        "bookings_made": 0,
        "total_revenue": 0,
        
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.fixed_route_pricing.insert_one(route_doc)
    route_doc.pop("_id", None)
    
    return {
        "success": True,
        "pricing_id": pricing_id,
        "message": "Fixed route pricing created successfully",
        "route": route_doc
    }


@router.put("/pricing/fixed-routes/{pricing_id}")
async def update_fixed_route(
    pricing_id: str,
    base_price: Optional[float] = None,
    is_active: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    """Update fixed route pricing"""
    db = get_database()
    
    route = await db.fixed_route_pricing.find_one({"pricing_id": pricing_id})
    if not route:
        raise HTTPException(status_code=404, detail="Fixed route not found")
    
    # Check ownership or admin
    roles = current_user.get("roles", [])
    is_admin = any(r in roles for r in ["admin", "super_admin"])
    is_owner = route.get("operator_id") == current_user.get("id")
    
    if not is_admin and not is_owner:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if base_price is not None:
        update_data["base_price"] = base_price
    if is_active is not None:
        update_data["is_active"] = is_active
    
    await db.fixed_route_pricing.update_one(
        {"pricing_id": pricing_id},
        {"$set": update_data}
    )
    
    return {"success": True, "message": "Fixed route updated"}


# ============ REVERSE AUCTION ROUTES ============
@router.post("/auction/start")
async def start_reverse_auction(
    request: ReverseAuctionRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Start a reverse auction for a booking
    Notifies eligible operators to submit bids
    """
    try:
        result = await pricing_engine.trigger_reverse_auction(
            booking_id=request.booking_id,
            customer_id=current_user.get("id"),
            customer_name=current_user.get("full_name", current_user.get("name", "")),
            customer_email=current_user.get("email"),
            from_location=request.from_location,
            to_location=request.to_location,
            departure_date=request.departure_date,
            passenger_count=request.passenger_count,
            booking_type=request.booking_type,
            max_budget=request.max_budget,
            special_requirements=request.special_requirements
        )
        return result
    except Exception as e:
        logger.error(f"Error starting auction: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/auction/bid")
async def submit_bid(
    request: OperatorBidRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Submit a bid for a reverse auction (Operators only)
    """
    roles = current_user.get("roles", [])
    if "operator" not in roles and "admin" not in roles:
        raise HTTPException(status_code=403, detail="Only operators can submit bids")
    
    try:
        result = await pricing_engine.submit_operator_bid(
            auction_id=request.auction_id,
            operator_id=current_user.get("id"),
            operator_name=current_user.get("full_name", current_user.get("company_name", "")),
            aircraft_id=request.aircraft_id,
            aircraft_registration=request.aircraft_registration,
            aircraft_type=request.aircraft_type,
            quoted_price=request.quoted_price,
            special_conditions=request.special_conditions,
            includes_catering=request.includes_catering
        )
        return result
    except Exception as e:
        logger.error(f"Error submitting bid: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/auction/{auction_id}")
async def get_auction_status(auction_id: str):
    """Get current status of a reverse auction"""
    result = await pricing_engine.get_auction_status(auction_id)
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result.get("error"))
    return result


@router.post("/auction/{auction_id}/accept/{bid_id}")
async def accept_auction_bid(
    auction_id: str,
    bid_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Accept a bid and close auction (Customer only)"""
    db = get_database()
    
    # Verify customer owns this auction
    auction = await db.ai_reverse_auctions.find_one({"auction_id": auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if auction.get("customer_id") != current_user.get("id"):
        roles = current_user.get("roles", [])
        if not any(r in roles for r in ["admin", "super_admin"]):
            raise HTTPException(status_code=403, detail="Only customer can accept bids")
    
    result = await pricing_engine.accept_bid(auction_id, bid_id)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result


@router.get("/auction/customer/active")
async def get_customer_active_auctions(current_user: dict = Depends(get_current_user)):
    """Get all active auctions for current customer"""
    db = get_database()
    
    auctions = await db.ai_reverse_auctions.find({
        "customer_id": current_user.get("id"),
        "auction_status": "active"
    }).to_list(length=20)
    
    for auction in auctions:
        auction.pop("_id", None)
    
    return {
        "success": True,
        "count": len(auctions),
        "auctions": auctions
    }


@router.get("/auction/operator/available")
async def get_operator_available_auctions(current_user: dict = Depends(get_current_user)):
    """Get auctions available for operator to bid on"""
    db = get_database()
    
    roles = current_user.get("roles", [])
    if "operator" not in roles:
        raise HTTPException(status_code=403, detail="Operators only")
    
    auctions = await db.ai_reverse_auctions.find({
        "auction_status": "active",
        "eligible_operators": current_user.get("id")
    }).to_list(length=20)
    
    for auction in auctions:
        auction.pop("_id", None)
        # Hide other operator bids
        auction["operator_bids"] = [
            b for b in auction.get("operator_bids", [])
            if b.get("operator_id") == current_user.get("id")
        ]
    
    return {
        "success": True,
        "count": len(auctions),
        "auctions": auctions
    }


# ============ DEMAND FORECAST ROUTES ============
@router.get("/demand/forecast")
async def get_demand_forecast(
    from_location: str = Query(...),
    to_location: str = Query(...),
    date: datetime = Query(...)
):
    """Get demand forecast for a route"""
    demand_level, multiplier = await pricing_engine.get_demand_level(
        from_location, to_location, date
    )
    
    return {
        "success": True,
        "route": f"{from_location} → {to_location}",
        "date": date.isoformat(),
        "demand_level": demand_level,
        "demand_multiplier": multiplier,
        "pricing_impact": f"{(multiplier - 1) * 100:+.0f}%" if multiplier != 1 else "No adjustment"
    }


# ============ FLEET POSITIONING ROUTES ============
@router.get("/fleet/locations")
async def get_fleet_locations(
    city: Optional[str] = None,
    aircraft_type: Optional[str] = None
):
    """Get current fleet locations"""
    db = get_database()
    
    query = {"is_active": True}
    if aircraft_type:
        query["aircraft_type"] = {"$regex": aircraft_type, "$options": "i"}
    
    aircraft = await db.aircraft.find(query).to_list(length=100)
    
    locations = []
    for ac in aircraft:
        ac.pop("_id", None)
        locations.append({
            "aircraft_id": ac.get("id"),
            "registration": ac.get("registration"),
            "type": ac.get("aircraft_type"),
            "current_location": ac.get("current_location", ac.get("base_location", "Unknown")),
            "operator_id": ac.get("operator_id"),
            "is_available": ac.get("is_available", True),
            "seats": ac.get("seats", 4)
        })
    
    # Filter by city if provided
    if city:
        city_lower = city.lower()
        locations = [
            loc for loc in locations
            if city_lower in str(loc.get("current_location", "")).lower()
        ]
    
    return {
        "success": True,
        "count": len(locations),
        "fleet": locations
    }


@router.get("/fleet/nearest")
async def find_nearest_aircraft(
    location: str = Query(..., description="Pickup location"),
    passenger_count: int = Query(1),
    aircraft_type: Optional[str] = Query(None)
):
    """Find nearest available aircraft to a location"""
    db = get_database()
    
    # Get airport info for the location
    location_info = distance_calculator.get_airport_info(location)
    if not location_info:
        raise HTTPException(status_code=400, detail=f"Unknown location: {location}")
    
    query = {
        "is_active": True,
        "seats": {"$gte": passenger_count}
    }
    if aircraft_type:
        query["aircraft_type"] = {"$regex": aircraft_type, "$options": "i"}
    
    aircraft = await db.aircraft.find(query).to_list(length=50)
    
    # Calculate distance for each aircraft
    results = []
    for ac in aircraft:
        ac_location = ac.get("current_location", ac.get("base_location"))
        if not ac_location:
            continue
        
        distance_result = distance_calculator.calculate_aviation_distance(
            ac_location, location
        )
        
        if distance_result["success"]:
            results.append({
                "aircraft_id": ac.get("id"),
                "registration": ac.get("registration"),
                "type": ac.get("aircraft_type"),
                "current_location": ac_location,
                "distance_km": distance_result["distance"]["aviation_route_km"],
                "flight_time_minutes": distance_result["flight_time"]["total_minutes"],
                "seats": ac.get("seats", 4),
                "operator_id": ac.get("operator_id"),
                "repositioning_needed": ac_location.lower() != location.lower()
            })
    
    # Sort by distance
    results.sort(key=lambda x: x["distance_km"])
    
    return {
        "success": True,
        "pickup_location": location,
        "count": len(results),
        "aircraft": results[:10]  # Top 10 nearest
    }
