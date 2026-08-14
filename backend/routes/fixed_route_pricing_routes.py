"""
AirYatra - Fixed Route Pricing & Instant Booking System
Operators can pre-set route-wise pricing for instant customer booking
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field
from database import get_database
from middleware import get_current_user, require_roles
from models import UserRole
import uuid

router = APIRouter(prefix="/routes", tags=["Fixed Route Pricing"])


def serialize_doc(doc: dict) -> dict:
    """Remove MongoDB _id and convert datetime objects"""
    if doc is None:
        return None
    result = {k: v for k, v in doc.items() if k != "_id"}
    for k, v in result.items():
        if isinstance(v, datetime):
            result[k] = v.isoformat()
    return result


# ==================== MODELS ====================

class TimeSlot(BaseModel):
    start_time: str  # "06:00"
    end_time: str    # "18:00"

class FixedRouteCreate(BaseModel):
    origin: str = Field(..., description="Origin location (e.g., Pune)")
    origin_helipad: Optional[str] = None
    destination: str = Field(..., description="Destination location (e.g., Mumbai)")
    destination_helipad: Optional[str] = None
    aircraft_id: str = Field(..., description="Aircraft ID")
    
    # Pricing
    base_price: float = Field(..., gt=0, description="Base charter price in INR")
    landing_charges: float = Field(default=0, description="Landing/helipad charges")
    parking_charges: float = Field(default=0, description="Parking charges if any")
    operational_charges: float = Field(default=0, description="Other operational charges")
    offer_price: Optional[float] = Field(None, description="Special offer price (optional)")
    
    # Availability
    available_days: List[str] = Field(default_factory=lambda: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])
    time_slots: List[TimeSlot] = Field(default_factory=lambda: [TimeSlot(start_time="06:00", end_time="18:00")])
    blackout_dates: List[str] = Field(default_factory=list, description="Dates when not available (YYYY-MM-DD)")
    minimum_notice_hours: int = Field(default=24, description="Minimum booking notice in hours")
    
    # Flight details
    estimated_flight_time_minutes: int = Field(default=60, description="Estimated flight duration")
    distance_km: Optional[float] = None
    
    # Crew (optional - can be assigned per booking)
    default_pilot_id: Optional[str] = None
    default_crew_ids: List[str] = Field(default_factory=list)
    
    # Settings
    max_passengers: Optional[int] = None
    baggage_included_kg: float = Field(default=10)
    extra_baggage_per_kg: float = Field(default=500)
    is_active: bool = Field(default=True)
    notes: Optional[str] = None


class FixedRouteUpdate(BaseModel):
    base_price: Optional[float] = None
    landing_charges: Optional[float] = None
    parking_charges: Optional[float] = None
    operational_charges: Optional[float] = None
    offer_price: Optional[float] = None
    available_days: Optional[List[str]] = None
    time_slots: Optional[List[TimeSlot]] = None
    blackout_dates: Optional[List[str]] = None
    minimum_notice_hours: Optional[int] = None
    estimated_flight_time_minutes: Optional[int] = None
    default_pilot_id: Optional[str] = None
    default_crew_ids: Optional[List[str]] = None
    max_passengers: Optional[int] = None
    baggage_included_kg: Optional[float] = None
    extra_baggage_per_kg: Optional[float] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


# ==================== OPERATOR ROUTES ====================

@router.post("/fixed")
async def create_fixed_route(
    route: FixedRouteCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Operator creates a fixed route with pricing
    """
    db = get_database()
    
    # Check if user is operator
    user_roles = current_user.get("roles", [])
    if "operator" not in user_roles and "admin" not in user_roles:
        raise HTTPException(status_code=403, detail="Only operators can create fixed routes")
    
    # Get operator profile
    operator = await db.operators.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if not operator and "admin" not in user_roles:
        raise HTTPException(status_code=404, detail="Operator profile not found")
    
    operator_id = operator["id"] if operator else "admin"
    
    # Verify aircraft belongs to operator
    aircraft = await db.aircraft.find_one({"id": route.aircraft_id}, {"_id": 0})
    if not aircraft:
        raise HTTPException(status_code=404, detail="Aircraft not found")
    if operator and aircraft.get("operator_id") != operator_id:
        raise HTTPException(status_code=403, detail="Aircraft does not belong to your fleet")
    
    # Check for duplicate route
    existing = await db.fixed_routes.find_one({
        "operator_id": operator_id,
        "origin": route.origin.strip().title(),
        "destination": route.destination.strip().title(),
        "aircraft_id": route.aircraft_id,
        "is_deleted": {"$ne": True}
    })
    if existing:
        raise HTTPException(status_code=400, detail="This route already exists for this aircraft")
    
    # Calculate total price
    subtotal = route.base_price + route.landing_charges + route.parking_charges + route.operational_charges
    
    route_doc = {
        "id": str(uuid.uuid4()),
        "operator_id": operator_id,
        "operator_name": operator.get("company_name") if operator else "AirYatra",
        
        # Route
        "origin": route.origin.strip().title(),
        "origin_helipad": route.origin_helipad,
        "destination": route.destination.strip().title(),
        "destination_helipad": route.destination_helipad,
        
        # Aircraft
        "aircraft_id": route.aircraft_id,
        "aircraft_name": aircraft.get("name", ""),
        "aircraft_type": aircraft.get("type", "helicopter"),
        "aircraft_model": aircraft.get("model", ""),
        "aircraft_registration": aircraft.get("registration", ""),
        "max_passengers": route.max_passengers or aircraft.get("passenger_capacity", 6),
        
        # Pricing (Operator's price)
        "base_price": route.base_price,
        "landing_charges": route.landing_charges,
        "parking_charges": route.parking_charges,
        "operational_charges": route.operational_charges,
        "subtotal": subtotal,
        "offer_price": route.offer_price,
        
        # Availability
        "available_days": route.available_days,
        "time_slots": [ts.dict() for ts in route.time_slots],
        "blackout_dates": route.blackout_dates,
        "minimum_notice_hours": route.minimum_notice_hours,
        
        # Flight details
        "estimated_flight_time_minutes": route.estimated_flight_time_minutes,
        "distance_km": route.distance_km,
        
        # Crew
        "default_pilot_id": route.default_pilot_id,
        "default_crew_ids": route.default_crew_ids,
        
        # Baggage
        "baggage_included_kg": route.baggage_included_kg,
        "extra_baggage_per_kg": route.extra_baggage_per_kg,
        
        # Status
        "is_active": route.is_active,
        "is_verified": False,  # Admin verification pending
        "notes": route.notes,
        
        # Metadata
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "booking_count": 0,
        "rating": None
    }
    
    await db.fixed_routes.insert_one(route_doc)
    
    return {
        "success": True,
        "message": "Fixed route created successfully",
        "route": serialize_doc(route_doc)
    }


@router.get("/fixed/my-routes")
async def get_my_fixed_routes(
    is_active: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get operator's fixed routes
    """
    db = get_database()
    
    # Get operator
    operator = await db.operators.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if not operator:
        # Check if admin
        if "admin" in current_user.get("roles", []):
            operator_id = "admin"
        else:
            raise HTTPException(status_code=404, detail="Operator profile not found")
    else:
        operator_id = operator["id"]
    
    query = {"operator_id": operator_id, "is_deleted": {"$ne": True}}
    if is_active is not None:
        query["is_active"] = is_active
    
    routes = await db.fixed_routes.find(query).sort("created_at", -1).to_list(500)
    
    return {
        "routes": [serialize_doc(r) for r in routes],
        "total": len(routes)
    }


@router.put("/fixed/{route_id}")
async def update_fixed_route(
    route_id: str,
    update: FixedRouteUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    Update a fixed route
    """
    db = get_database()
    
    route = await db.fixed_routes.find_one({"id": route_id}, {"_id": 0})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    # Verify ownership
    operator = await db.operators.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if operator and route["operator_id"] != operator["id"]:
        if "admin" not in current_user.get("roles", []):
            raise HTTPException(status_code=403, detail="Not authorized to update this route")
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    
    # Recalculate subtotal if pricing changed
    if any(k in update_data for k in ["base_price", "landing_charges", "parking_charges", "operational_charges"]):
        base = update_data.get("base_price", route["base_price"])
        landing = update_data.get("landing_charges", route["landing_charges"])
        parking = update_data.get("parking_charges", route["parking_charges"])
        operational = update_data.get("operational_charges", route["operational_charges"])
        update_data["subtotal"] = base + landing + parking + operational
    
    if update_data.get("time_slots"):
        update_data["time_slots"] = [ts.dict() if hasattr(ts, 'dict') else ts for ts in update_data["time_slots"]]
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.fixed_routes.update_one({"id": route_id}, {"$set": update_data})
    
    return {"success": True, "message": "Route updated successfully"}


@router.delete("/fixed/{route_id}")
async def delete_fixed_route(
    route_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Soft delete a fixed route
    """
    db = get_database()
    
    route = await db.fixed_routes.find_one({"id": route_id}, {"_id": 0})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    # Verify ownership
    operator = await db.operators.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if operator and route["operator_id"] != operator["id"]:
        if "admin" not in current_user.get("roles", []):
            raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.fixed_routes.update_one(
        {"id": route_id},
        {"$set": {"is_deleted": True, "deleted_at": datetime.now(timezone.utc)}}
    )
    
    return {"success": True, "message": "Route deleted"}


# ==================== CUSTOMER SEARCH ====================

@router.get("/search")
async def search_fixed_routes(
    origin: str,
    destination: str,
    date: str,  # YYYY-MM-DD
    passengers: int = 1,
    trip_type: str = "one_way"  # one_way, round_trip
):
    """
    Customer searches for available fixed routes
    Returns instant bookable options with full pricing
    """
    db = get_database()
    
    # Parse date
    try:
        travel_date = datetime.strptime(date, "%Y-%m-%d")
        day_name = travel_date.strftime("%a")  # Mon, Tue, etc.
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Check if date is in future
    if travel_date.date() < datetime.now(timezone.utc).date():
        raise HTTPException(status_code=400, detail="Travel date must be in the future")
    
    # Search for matching routes
    query = {
        "origin": {"$regex": f"^{origin.strip()}$", "$options": "i"},
        "destination": {"$regex": f"^{destination.strip()}$", "$options": "i"},
        "is_active": True,
        "is_deleted": {"$ne": True},
        "available_days": day_name,
        "blackout_dates": {"$nin": [date]},
        "max_passengers": {"$gte": passengers}
    }
    
    routes = await db.fixed_routes.find(query).to_list(50)
    
    if not routes:
        return {
            "found": False,
            "routes": [],
            "message": "No fixed routes available. You can submit a custom inquiry.",
            "suggest_auction": True
        }
    
    # Calculate final customer prices
    results = []
    
    # Get platform settings for commission
    settings = await db.platform_settings.find_one({"key": "pricing"}, {"_id": 0})
    commission_percent = settings.get("commission_percent", 15) if settings else 15
    platform_fee = settings.get("platform_fee", 2999) if settings else 2999
    gst_percent = 18  # GST on services
    
    for route in routes:
        # Check minimum notice period
        hours_until_travel = (travel_date - datetime.now(timezone.utc).replace(tzinfo=None)).total_seconds() / 3600
        if hours_until_travel < route.get("minimum_notice_hours", 24):
            continue
        
        # Get operator info
        operator = await db.operators.find_one({"id": route["operator_id"]}, {"_id": 0})
        
        # Get aircraft details
        aircraft = await db.aircraft.find_one({"id": route["aircraft_id"]}, {"_id": 0})
        
        # Calculate pricing
        operator_price = route.get("offer_price") or route["subtotal"]
        
        # AirYatra commission (hidden from customer)
        commission = operator_price * (commission_percent / 100)
        
        # Customer sees this breakdown:
        base_charges = route["base_price"]
        landing_charges = route["landing_charges"]
        operational_charges = route["operational_charges"] + platform_fee  # Platform fee included here
        
        subtotal_before_tax = base_charges + landing_charges + operational_charges
        gst_amount = subtotal_before_tax * (gst_percent / 100)
        final_customer_price = subtotal_before_tax + gst_amount
        
        # Round trip pricing
        round_trip_price = None
        if trip_type == "round_trip":
            # Check if return route exists
            return_route = await db.fixed_routes.find_one({
                "operator_id": route["operator_id"],
                "origin": route["destination"],
                "destination": route["origin"],
                "aircraft_id": route["aircraft_id"],
                "is_active": True,
                "is_deleted": {"$ne": True}
            }, {"_id": 0})
            
            if return_route:
                return_price = return_route.get("offer_price") or return_route["subtotal"]
                round_trip_subtotal = (base_charges * 2) + (landing_charges * 2) + (operational_charges * 2)
                round_trip_gst = round_trip_subtotal * (gst_percent / 100)
                round_trip_price = round_trip_subtotal + round_trip_gst
        
        result = {
            "route_id": route["id"],
            "operator_id": route["operator_id"],
            "operator_name": route.get("operator_name", ""),
            "operator_rating": operator.get("rating") if operator else None,
            "operator_verified": operator.get("is_verified", False) if operator else False,
            
            # Route
            "origin": route["origin"],
            "destination": route["destination"],
            "origin_helipad": route.get("origin_helipad"),
            "destination_helipad": route.get("destination_helipad"),
            
            # Aircraft
            "aircraft": {
                "id": route["aircraft_id"],
                "name": route.get("aircraft_name", ""),
                "type": route.get("aircraft_type", "helicopter"),
                "model": route.get("aircraft_model", ""),
                "max_passengers": route["max_passengers"],
                "image": aircraft.get("primary_image") if aircraft else None
            },
            
            # Flight details
            "estimated_flight_time_minutes": route["estimated_flight_time_minutes"],
            "distance_km": route.get("distance_km"),
            
            # Customer Price Breakdown (Commission NOT shown)
            "price_breakdown": {
                "base_charter_charges": base_charges,
                "landing_helipad_charges": landing_charges,
                "operational_charges": operational_charges,  # Includes platform fee
                "subtotal": subtotal_before_tax,
                "gst_percent": gst_percent,
                "gst_amount": round(gst_amount, 2),
                "total_payable": round(final_customer_price, 2)
            },
            
            # Round trip (if applicable)
            "round_trip_available": round_trip_price is not None,
            "round_trip_price": round(round_trip_price, 2) if round_trip_price else None,
            
            # Availability
            "time_slots": route.get("time_slots", []),
            "minimum_notice_hours": route["minimum_notice_hours"],
            
            # Baggage
            "baggage_included_kg": route.get("baggage_included_kg", 10),
            "extra_baggage_per_kg": route.get("extra_baggage_per_kg", 500),
            
            # Booking
            "instant_booking": True,
            "is_offer": route.get("offer_price") is not None
        }
        
        results.append(result)
    
    # Sort by price
    results.sort(key=lambda x: x["price_breakdown"]["total_payable"])
    
    return {
        "found": True,
        "count": len(results),
        "routes": results,
        "search_params": {
            "origin": origin,
            "destination": destination,
            "date": date,
            "passengers": passengers,
            "trip_type": trip_type
        }
    }


@router.get("/fixed/{route_id}")
async def get_route_details(route_id: str):
    """
    Get full details of a fixed route (for booking page)
    """
    db = get_database()
    
    route = await db.fixed_routes.find_one({"id": route_id, "is_deleted": {"$ne": True}}, {"_id": 0})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    # Get operator details
    operator = await db.operators.find_one({"id": route["operator_id"]}, {"_id": 0})
    
    # Get aircraft details
    aircraft = await db.aircraft.find_one({"id": route["aircraft_id"]}, {"_id": 0})
    
    return {
        "route": serialize_doc(route),
        "operator": serialize_doc(operator) if operator else None,
        "aircraft": serialize_doc(aircraft) if aircraft else None
    }


# ==================== ADMIN ROUTES ====================

@router.get("/admin/all")
async def admin_get_all_routes(
    operator_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    is_verified: Optional[bool] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(require_roles([UserRole.ADMIN]))
):
    """
    Admin: Get all fixed routes
    """
    db = get_database()
    
    query = {"is_deleted": {"$ne": True}}
    if operator_id:
        query["operator_id"] = operator_id
    if is_active is not None:
        query["is_active"] = is_active
    if is_verified is not None:
        query["is_verified"] = is_verified
    
    total = await db.fixed_routes.count_documents(query)
    routes = await db.fixed_routes.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "routes": [serialize_doc(r) for r in routes],
        "total": total,
        "page": skip // limit + 1
    }


@router.post("/admin/verify/{route_id}")
async def admin_verify_route(
    route_id: str,
    verified: bool = True,
    current_user: dict = Depends(require_roles([UserRole.ADMIN]))
):
    """
    Admin: Verify/unverify a route
    """
    db = get_database()
    
    result = await db.fixed_routes.update_one(
        {"id": route_id},
        {"$set": {
            "is_verified": verified,
            "verified_by": current_user["id"],
            "verified_at": datetime.now(timezone.utc)
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Route not found")
    
    return {"success": True, "message": f"Route {'verified' if verified else 'unverified'}"}


@router.put("/admin/pricing-settings")
async def update_pricing_settings(
    commission_percent: float = 15,
    platform_fee: float = 2999,
    current_user: dict = Depends(require_roles([UserRole.ADMIN]))
):
    """
    Admin: Update platform pricing settings
    """
    db = get_database()
    
    await db.platform_settings.update_one(
        {"key": "pricing"},
        {"$set": {
            "commission_percent": commission_percent,
            "platform_fee": platform_fee,
            "updated_by": current_user["id"],
            "updated_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )
    
    return {"success": True, "message": "Pricing settings updated"}


@router.get("/admin/pricing-settings")
async def get_pricing_settings(
    current_user: dict = Depends(require_roles([UserRole.ADMIN]))
):
    """
    Admin: Get platform pricing settings
    """
    db = get_database()
    
    settings = await db.platform_settings.find_one({"key": "pricing"}, {"_id": 0})
    
    return {
        "commission_percent": settings.get("commission_percent", 15) if settings else 15,
        "platform_fee": settings.get("platform_fee", 2999) if settings else 2999
    }
