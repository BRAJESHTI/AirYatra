"""
Landing Infrastructure Routes
Complete API for managing airports, helipads, village lands, availability, rent, and permissions
"""
from fastapi import APIRouter, HTTPException, Depends, Query, File, UploadFile, Form
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from uuid import uuid4
import math
import logging

from database import get_database
from middleware import get_current_user, require_roles
from models import (
    UserRole, 
    LandingPoint, LandingPointType, LandingOwnerType, LandingPointStatus,
    LandingRent, RentType,
    LandingDocument, LandingDocType,
    VillageLandingPermission
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/landing", tags=["Landing Infrastructure"])


# ============== PUBLIC ENDPOINTS (No Auth Required) ==============

@router.get("/public/search")
async def public_search_landing_points(
    query: Optional[str] = None,
    type: Optional[str] = None,
    state: Optional[str] = None,
    limit: int = 20
):
    """Public search for landing points - for booking page"""
    db = get_database()
    
    search_query = {"is_active": True}
    
    if type:
        search_query["type"] = type
    if state:
        search_query["state"] = {"$regex": state, "$options": "i"}
    
    # Text search on name, city, state
    if query and len(query) >= 2:
        search_query["$or"] = [
            {"name": {"$regex": query, "$options": "i"}},
            {"city": {"$regex": query, "$options": "i"}},
            {"state": {"$regex": query, "$options": "i"}},
            {"code": {"$regex": query, "$options": "i"}}
        ]
    
    landing_points = await db.landing_points.find(
        search_query, {"_id": 0}
    ).limit(limit).to_list(limit)
    
    return {
        "landing_points": landing_points,
        "total": len(landing_points)
    }


@router.get("/public/airports")
async def get_public_airports(state: Optional[str] = None):
    """Get list of airports for public use"""
    db = get_database()
    query = {"type": "airport", "is_active": True}
    if state:
        query["state"] = {"$regex": state, "$options": "i"}
    
    airports = await db.landing_points.find(
        query, {"_id": 0, "id": 1, "name": 1, "code": 1, "city": 1, "state": 1, "latitude": 1, "longitude": 1}
    ).to_list(100)
    
    return {"airports": airports}


@router.get("/public/helipads")
async def get_public_helipads(state: Optional[str] = None, type: Optional[str] = None):
    """Get list of helipads for public use"""
    db = get_database()
    query = {"is_active": True}
    
    if type == "govt":
        query["type"] = "govt_helipad"
    elif type == "private":
        query["type"] = "private_helipad"
    else:
        query["type"] = {"$in": ["govt_helipad", "private_helipad"]}
    
    if state:
        query["state"] = {"$regex": state, "$options": "i"}
    
    helipads = await db.landing_points.find(
        query, {"_id": 0}
    ).to_list(100)
    
    return {"helipads": helipads}


# ============== HELPER FUNCTIONS ==============

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in km"""
    R = 6371
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat / 2) ** 2 + \
        math.cos(lat1_rad) * math.cos(lat2_rad) * \
        math.sin(delta_lon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


def generate_landing_point_code(point_type: str, state: str, city: str) -> str:
    """Generate unique code for landing point"""
    type_prefix = {
        "airport": "APT",
        "govt_helipad": "GHP",
        "private_helipad": "PHP",
        "village_land": "VLN"
    }
    prefix = type_prefix.get(point_type, "LND")
    state_code = state[:2].upper()
    city_code = city[:3].upper()
    random_suffix = str(uuid4())[:4].upper()
    return f"{prefix}-{state_code}-{city_code}-{random_suffix}"


# ============== LANDING POINTS MANAGEMENT ==============

@router.post("/points")
async def create_landing_point(
    point_data: dict,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.REGIONAL_MANAGER]))
):
    """Create a new landing point (Airport/Helipad/Village Land)"""
    db = get_database()
    
    point_id = str(uuid4())
    code = generate_landing_point_code(
        point_data.get("type"),
        point_data.get("state", ""),
        point_data.get("city", "")
    )
    
    # Determine default permission/rent requirements based on type
    point_type = point_data.get("type")
    permission_required = point_data.get("permission_required")
    rent_applicable = point_data.get("rent_applicable")
    availability_required = point_data.get("availability_calendar_required")
    
    if permission_required is None:
        permission_required = point_type == "village_land"
    
    if rent_applicable is None:
        rent_applicable = point_type in ["govt_helipad", "private_helipad"]
    
    if availability_required is None:
        availability_required = point_type == "private_helipad"
    
    landing_point = {
        "id": point_id,
        "code": code,
        "name": point_data.get("name"),
        "type": point_type,  # airport / govt_helipad / private_helipad / village_land
        "owner_type": point_data.get("owner_type", "govt"),  # govt / private / trust / hospital / hotel / individual
        "category": point_data.get("category"),
        
        # Location
        "city": point_data.get("city"),
        "district": point_data.get("district"),
        "state": point_data.get("state"),
        "address": point_data.get("address"),
        "pincode": point_data.get("pincode"),
        "latitude": point_data.get("latitude"),
        "longitude": point_data.get("longitude"),
        
        # Contact
        "contact_name": point_data.get("contact_name"),
        "contact_phone": point_data.get("contact_phone"),
        "contact_email": point_data.get("contact_email"),
        
        # Flags (as per schema)
        "permission_required": permission_required,  # BOOLEAN
        "rent_applicable": rent_applicable,  # BOOLEAN
        "calendar_enabled": availability_required,  # For private helipads
        
        # Status (active / inactive)
        "status": "active",
        "is_active": True,
        "is_verified": point_data.get("is_verified", False),
        
        # Ownership
        "owner_id": point_data.get("owner_id"),  # User ID if helipad owner
        
        # Additional
        "facilities": point_data.get("facilities", []),
        "operating_hours": point_data.get("operating_hours"),
        "icao_code": point_data.get("icao_code"),  # For airports
        "runway_length": point_data.get("runway_length_m"),
        "helipad_size_m": point_data.get("helipad_size_m"),
        "surface_type": point_data.get("surface_type"),
        "lighting_available": point_data.get("lighting_available", False),
        "fuel_available": point_data.get("fuel_available", False),
        "night_operations": point_data.get("night_operations", False),
        "notes": point_data.get("notes"),
        
        # Metadata
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["id"]
    }
    
    await db.landing_points.insert_one(landing_point.copy())
    
    logger.info(f"Landing point created: {code} - {landing_point['name']} by {user['email']}")
    
    return {
        "message": "Landing point created successfully",
        "landing_point": {k: v for k, v in landing_point.items() if k != "_id"}
    }


@router.get("/points")
async def get_landing_points(
    type: Optional[str] = None,
    state: Optional[str] = None,
    city: Optional[str] = None,
    is_active: bool = True,
    page: int = 1,
    limit: int = 50,
    user: dict = Depends(get_current_user)
):
    """Get all landing points with filters"""
    db = get_database()
    
    query = {"is_active": is_active}
    if type:
        query["type"] = type
    if state:
        query["state"] = {"$regex": state, "$options": "i"}
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    
    skip = (page - 1) * limit
    
    landing_points = await db.landing_points.find(
        query, {"_id": 0}
    ).skip(skip).limit(limit).to_list(limit)
    
    total = await db.landing_points.count_documents(query)
    
    return {
        "landing_points": landing_points,
        "total": total,
        "page": page,
        "pages": math.ceil(total / limit)
    }


@router.get("/points/search")
async def search_landing_points(
    latitude: float,
    longitude: float,
    radius_km: float = 100,
    type: Optional[str] = None,
    available_date: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """Search landing points within radius"""
    db = get_database()
    
    query = {"is_active": True}
    if type:
        query["type"] = type
    
    all_points = await db.landing_points.find(query, {"_id": 0}).to_list(1000)
    
    # Filter by distance
    nearby_points = []
    for point in all_points:
        if point.get("latitude") and point.get("longitude"):
            distance = haversine_distance(
                latitude, longitude,
                point["latitude"], point["longitude"]
            )
            if distance <= radius_km:
                point["distance_km"] = round(distance, 2)
                
                # Check availability if date provided
                if available_date and point.get("availability_calendar_required"):
                    availability = await db.helipad_availability.find_one({
                        "landing_point_id": point["id"],
                        "date": available_date,
                        "status": "blocked"
                    })
                    point["available_on_date"] = availability is None
                else:
                    point["available_on_date"] = True
                
                nearby_points.append(point)
    
    # Sort by distance
    nearby_points.sort(key=lambda x: x["distance_km"])
    
    return {
        "landing_points": nearby_points,
        "total": len(nearby_points),
        "search_radius_km": radius_km,
        "center": {"latitude": latitude, "longitude": longitude}
    }


@router.get("/points/{point_id}")
async def get_landing_point(point_id: str, user: dict = Depends(get_current_user)):
    """Get landing point details"""
    db = get_database()
    
    point = await db.landing_points.find_one({"id": point_id}, {"_id": 0})
    if not point:
        raise HTTPException(status_code=404, detail="Landing point not found")
    
    # Get rent configuration
    rent = await db.landing_rent.find_one(
        {"landing_point_id": point_id, "is_active": True},
        {"_id": 0}
    )
    point["rent_config"] = rent
    
    # Get upcoming availability (next 30 days)
    if point.get("availability_calendar_required"):
        today = datetime.now(timezone.utc).date().isoformat()
        availability = await db.helipad_availability.find(
            {"landing_point_id": point_id, "date": {"$gte": today}},
            {"_id": 0}
        ).sort("date", 1).limit(30).to_list(30)
        point["availability_calendar"] = availability
    
    return point


@router.put("/points/{point_id}")
async def update_landing_point(
    point_id: str,
    update_data: dict,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.REGIONAL_MANAGER]))
):
    """Update landing point"""
    db = get_database()
    
    existing = await db.landing_points.find_one({"id": point_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Landing point not found")
    
    # Remove fields that shouldn't be updated
    update_data.pop("id", None)
    update_data.pop("code", None)
    update_data.pop("created_at", None)
    update_data.pop("created_by", None)
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = user["id"]
    
    await db.landing_points.update_one(
        {"id": point_id},
        {"$set": update_data}
    )
    
    updated = await db.landing_points.find_one({"id": point_id}, {"_id": 0})
    
    return {"message": "Landing point updated", "landing_point": updated}


@router.delete("/points/{point_id}")
async def delete_landing_point(
    point_id: str,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Soft delete landing point"""
    db = get_database()
    
    result = await db.landing_points.update_one(
        {"id": point_id},
        {"$set": {
            "is_active": False,
            "deleted_at": datetime.now(timezone.utc).isoformat(),
            "deleted_by": user["id"]
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Landing point not found")
    
    return {"message": "Landing point deleted"}


# ============== HELIPAD AVAILABILITY CALENDAR ==============

@router.post("/availability")
async def create_availability_slot(
    slot_data: dict,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.REGIONAL_MANAGER]))
):
    """Create/Update availability slot for helipad"""
    db = get_database()
    
    # Verify landing point exists and requires availability
    point = await db.landing_points.find_one({"id": slot_data["landing_point_id"]})
    if not point:
        raise HTTPException(status_code=404, detail="Landing point not found")
    
    slot_id = str(uuid4())
    slot = {
        "id": slot_id,
        "landing_point_id": slot_data["landing_point_id"],
        "date": slot_data["date"],
        "from_time": slot_data.get("from_time", "00:00"),
        "to_time": slot_data.get("to_time", "23:59"),
        "status": slot_data.get("status", "available"),
        "reason": slot_data.get("reason"),
        "booking_id": slot_data.get("booking_id"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["id"]
    }
    
    # Check for existing slot on same date
    existing = await db.helipad_availability.find_one({
        "landing_point_id": slot_data["landing_point_id"],
        "date": slot_data["date"]
    })
    
    if existing:
        # Update existing
        await db.helipad_availability.update_one(
            {"id": existing["id"]},
            {"$set": {
                "status": slot["status"],
                "reason": slot["reason"],
                "from_time": slot["from_time"],
                "to_time": slot["to_time"],
                "updated_at": slot["updated_at"],
                "updated_by": user["id"]
            }}
        )
        return {"message": "Availability updated", "slot_id": existing["id"]}
    
    await db.helipad_availability.insert_one(slot.copy())
    
    return {"message": "Availability slot created", "slot_id": slot_id}


@router.post("/availability/bulk")
async def create_bulk_availability(
    bulk_data: dict,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Create availability slots for date range"""
    db = get_database()
    
    landing_point_id = bulk_data["landing_point_id"]
    start_date = bulk_data["start_date"]
    end_date = bulk_data["end_date"]
    status = bulk_data.get("status", "available")
    reason = bulk_data.get("reason")
    
    from datetime import timedelta
    
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    
    slots_created = 0
    current = start
    
    while current <= end:
        date_str = current.strftime("%Y-%m-%d")
        
        existing = await db.helipad_availability.find_one({
            "landing_point_id": landing_point_id,
            "date": date_str
        })
        
        if not existing:
            slot = {
                "id": str(uuid4()),
                "landing_point_id": landing_point_id,
                "date": date_str,
                "from_time": "00:00",
                "to_time": "23:59",
                "status": status,
                "reason": reason,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": user["id"]
            }
            await db.helipad_availability.insert_one(slot)
            slots_created += 1
        
        current += timedelta(days=1)
    
    return {"message": f"{slots_created} availability slots created", "start_date": start_date, "end_date": end_date}


@router.get("/availability/{landing_point_id}")
async def get_availability_calendar(
    landing_point_id: str,
    month: Optional[str] = None,  # Format: 2025-01
    user: dict = Depends(get_current_user)
):
    """Get availability calendar for a landing point"""
    db = get_database()
    
    query = {"landing_point_id": landing_point_id}
    
    if month:
        query["date"] = {"$regex": f"^{month}"}
    else:
        # Default to current and next month
        today = datetime.now(timezone.utc)
        current_month = today.strftime("%Y-%m")
        next_month = (today.replace(day=28) + timedelta(days=4)).strftime("%Y-%m")
        query["$or"] = [
            {"date": {"$regex": f"^{current_month}"}},
            {"date": {"$regex": f"^{next_month}"}}
        ]
    
    slots = await db.helipad_availability.find(
        query, {"_id": 0}
    ).sort("date", 1).to_list(100)
    
    # Get landing point name
    point = await db.landing_points.find_one({"id": landing_point_id}, {"_id": 0, "name": 1})
    
    return {
        "landing_point_id": landing_point_id,
        "landing_point_name": point.get("name") if point else None,
        "calendar": slots,
        "total_slots": len(slots)
    }


@router.get("/availability/check")
async def check_availability(
    landing_point_id: str,
    check_date: str,
    from_time: Optional[str] = None,
    to_time: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """Check if landing point is available on specific date/time"""
    db = get_database()
    
    # Get landing point
    point = await db.landing_points.find_one({"id": landing_point_id}, {"_id": 0})
    if not point:
        raise HTTPException(status_code=404, detail="Landing point not found")
    
    # If availability calendar not required, always available
    if not point.get("availability_calendar_required"):
        return {
            "available": True,
            "landing_point": point["name"],
            "message": "No availability restrictions"
        }
    
    # Check availability slot
    slot = await db.helipad_availability.find_one({
        "landing_point_id": landing_point_id,
        "date": check_date
    }, {"_id": 0})
    
    if not slot:
        # No slot defined = available by default
        return {
            "available": True,
            "landing_point": point["name"],
            "message": "Available (no restrictions set)"
        }
    
    is_available = slot["status"] == "available"
    
    # If not available, find alternatives
    alternatives = []
    if not is_available:
        nearby = await db.landing_points.find({
            "type": point["type"],
            "state": point["state"],
            "is_active": True,
            "id": {"$ne": landing_point_id}
        }, {"_id": 0}).limit(5).to_list(5)
        
        for alt in nearby:
            if alt.get("latitude") and point.get("latitude"):
                alt["distance_km"] = round(haversine_distance(
                    point["latitude"], point["longitude"],
                    alt["latitude"], alt["longitude"]
                ), 2)
            alternatives.append({
                "id": alt["id"],
                "name": alt["name"],
                "city": alt["city"],
                "distance_km": alt.get("distance_km")
            })
    
    return {
        "available": is_available,
        "landing_point": point["name"],
        "slot_status": slot["status"],
        "reason": slot.get("reason"),
        "alternatives": alternatives if not is_available else []
    }


# ============== LANDING RENT CONFIGURATION ==============

@router.post("/rent")
async def create_rent_config(
    rent_data: dict,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Create rent configuration for landing point"""
    db = get_database()
    
    # Verify landing point
    point = await db.landing_points.find_one({"id": rent_data["landing_point_id"]})
    if not point:
        raise HTTPException(status_code=404, detail="Landing point not found")
    
    # Deactivate existing rent config
    await db.landing_rent.update_many(
        {"landing_point_id": rent_data["landing_point_id"], "is_active": True},
        {"$set": {"is_active": False, "effective_to": datetime.now(timezone.utc).isoformat()}}
    )
    
    rent_id = str(uuid4())
    rent = {
        "id": rent_id,
        "landing_point_id": rent_data["landing_point_id"],
        "rent_type": rent_data.get("rent_type", "per_landing"),
        "base_rent_amount": rent_data["base_rent_amount"],
        "max_hours": rent_data.get("max_hours"),
        "overnight_charge": rent_data.get("overnight_charge", 0),
        "parking_charge_per_hour": rent_data.get("parking_charge_per_hour", 0),
        "gst_applicable": rent_data.get("gst_applicable", True),
        "gst_percentage": rent_data.get("gst_percentage", 18.0),
        "helicopter_rate": rent_data.get("helicopter_rate"),
        "fixed_wing_rate": rent_data.get("fixed_wing_rate"),
        "peak_hours_multiplier": rent_data.get("peak_hours_multiplier", 1.0),
        "weekend_multiplier": rent_data.get("weekend_multiplier", 1.0),
        "notes": rent_data.get("notes"),
        "is_active": True,
        "effective_from": datetime.now(timezone.utc).isoformat(),
        "effective_to": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["id"]
    }
    
    await db.landing_rent.insert_one(rent.copy())
    
    # Update landing point
    await db.landing_points.update_one(
        {"id": rent_data["landing_point_id"]},
        {"$set": {"rent_applicable": True, "rent_config_id": rent_id}}
    )
    
    return {"message": "Rent configuration created", "rent_id": rent_id, "rent": rent}


@router.get("/rent/{landing_point_id}")
async def get_rent_config(landing_point_id: str, user: dict = Depends(get_current_user)):
    """Get rent configuration for landing point"""
    db = get_database()
    
    rent = await db.landing_rent.find_one(
        {"landing_point_id": landing_point_id, "is_active": True},
        {"_id": 0}
    )
    
    if not rent:
        return {"message": "No rent configuration found", "rent": None}
    
    return rent


@router.post("/rent/calculate")
async def calculate_landing_rent(
    calc_data: dict,
    user: dict = Depends(get_current_user)
):
    """Calculate landing rent for a trip"""
    db = get_database()
    
    landing_point_id = calc_data["landing_point_id"]
    landing_date = calc_data.get("landing_date")
    duration_hours = calc_data.get("duration_hours", 1)
    aircraft_type = calc_data.get("aircraft_type", "helicopter")
    
    # Get landing point
    point = await db.landing_points.find_one({"id": landing_point_id}, {"_id": 0})
    if not point:
        raise HTTPException(status_code=404, detail="Landing point not found")
    
    # If no rent applicable
    if not point.get("rent_applicable"):
        return {
            "landing_point": point["name"],
            "rent_applicable": False,
            "base_rent": 0,
            "parking_charge": 0,
            "gst_amount": 0,
            "total_rent": 0
        }
    
    # Get rent config
    rent = await db.landing_rent.find_one(
        {"landing_point_id": landing_point_id, "is_active": True},
        {"_id": 0}
    )
    
    if not rent:
        return {
            "landing_point": point["name"],
            "rent_applicable": True,
            "error": "Rent configuration not set",
            "total_rent": 0
        }
    
    # Calculate base rent
    base_rent = rent["base_rent_amount"]
    
    # Aircraft type specific rate
    if aircraft_type == "helicopter" and rent.get("helicopter_rate"):
        base_rent = rent["helicopter_rate"]
    elif aircraft_type != "helicopter" and rent.get("fixed_wing_rate"):
        base_rent = rent["fixed_wing_rate"]
    
    # Duration based calculation
    if rent["rent_type"] == "per_hour":
        base_rent = base_rent * duration_hours
    elif rent["rent_type"] == "per_day":
        days = math.ceil(duration_hours / 24)
        base_rent = base_rent * days
    
    # Weekend multiplier
    if landing_date:
        try:
            dt = datetime.strptime(landing_date, "%Y-%m-%d")
            if dt.weekday() >= 5:  # Saturday or Sunday
                base_rent *= rent.get("weekend_multiplier", 1.0)
        except ValueError:
            pass
    
    # Parking charges
    parking_charge = 0
    if duration_hours > (rent.get("max_hours") or 2):
        extra_hours = duration_hours - (rent.get("max_hours") or 2)
        parking_charge = extra_hours * rent.get("parking_charge_per_hour", 0)
    
    # GST
    subtotal = base_rent + parking_charge
    gst_amount = 0
    if rent.get("gst_applicable"):
        gst_amount = subtotal * (rent.get("gst_percentage", 18) / 100)
    
    total = subtotal + gst_amount
    
    return {
        "landing_point": point["name"],
        "landing_point_id": landing_point_id,
        "rent_type": rent["rent_type"],
        "duration_hours": duration_hours,
        "aircraft_type": aircraft_type,
        "base_rent": round(base_rent, 2),
        "parking_charge": round(parking_charge, 2),
        "subtotal": round(subtotal, 2),
        "gst_percentage": rent.get("gst_percentage", 18),
        "gst_amount": round(gst_amount, 2),
        "total_rent": round(total, 2),
        "breakdown": {
            "base_rate": rent["base_rent_amount"],
            "rent_type": rent["rent_type"],
            "weekend_multiplier_applied": rent.get("weekend_multiplier", 1.0) if landing_date else 1.0
        }
    }


# ============== LANDING DOCUMENTS & COMPLIANCE ==============

@router.get("/documents/{landing_point_id}")
async def get_landing_documents(
    landing_point_id: str,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.REGIONAL_MANAGER]))
):
    """Get all compliance documents for a landing point"""
    db = get_database()
    
    # Verify landing point exists
    point = await db.landing_points.find_one({"id": landing_point_id}, {"_id": 0})
    if not point:
        raise HTTPException(status_code=404, detail="Landing point not found")
    
    documents = await db.landing_documents.find(
        {"landing_point_id": landing_point_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {
        "landing_point_id": landing_point_id,
        "landing_point_name": point.get("name"),
        "documents": documents,
        "total": len(documents)
    }


@router.post("/documents")
async def upload_landing_document(
    landing_point_id: str = Form(...),
    doc_type: str = Form(...),  # collector_noc / sp_noc / fire_noc / gram_panchayat / ownership
    file: UploadFile = File(...),
    expiry_date: Optional[str] = Form(None),
    remark: Optional[str] = Form(None),
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.REGIONAL_MANAGER]))
):
    """Upload compliance document for a landing point"""
    db = get_database()
    import os
    
    # Verify landing point exists
    point = await db.landing_points.find_one({"id": landing_point_id})
    if not point:
        raise HTTPException(status_code=404, detail="Landing point not found")
    
    # Validate doc_type
    valid_doc_types = ["collector_noc", "sp_noc", "fire_noc", "gram_panchayat", "ownership"]
    if doc_type not in valid_doc_types:
        raise HTTPException(status_code=400, detail=f"Invalid doc_type. Must be one of: {valid_doc_types}")
    
    # Validate file type
    allowed_types = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: PDF, JPG, PNG")
    
    # Read and validate file size
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:  # 10MB max
        raise HTTPException(status_code=400, detail="File size exceeds 10MB limit")
    
    # Save file
    file_extension = file.filename.split('.')[-1].lower()
    unique_filename = f"{doc_type}_{uuid4()}.{file_extension}"
    upload_dir = f"/app/uploads/landing_documents/{landing_point_id}"
    os.makedirs(upload_dir, exist_ok=True)
    file_path = f"{upload_dir}/{unique_filename}"
    
    with open(file_path, "wb") as f:
        f.write(contents)
    
    file_url = f"/api/uploads/landing_documents/{landing_point_id}/{unique_filename}"
    
    # Create document record
    doc_id = str(uuid4())
    document = {
        "id": doc_id,
        "landing_point_id": landing_point_id,
        "doc_type": doc_type,
        "doc_name": file.filename,
        "file_url": file_url,
        "file_path": file_path,
        
        # Verification status
        "verified": False,
        "verified_by": None,
        "verified_at": None,
        
        # Validity
        "expiry_date": expiry_date,
        
        # Remarks
        "remark": remark,
        
        # Status
        "status": "pending",  # pending, verified, rejected, expired
        
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "uploaded_by": user["id"]
    }
    
    await db.landing_documents.insert_one(document)
    
    logger.info(f"Landing document uploaded: {doc_type} for {landing_point_id} by {user['email']}")
    
    return {
        "message": "Document uploaded successfully",
        "document_id": doc_id,
        "doc_type": doc_type,
        "file_url": file_url
    }


@router.put("/documents/{document_id}/verify")
async def verify_landing_document(
    document_id: str,
    verification_data: dict,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Verify or reject a landing document"""
    db = get_database()
    
    document = await db.landing_documents.find_one({"id": document_id})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    action = verification_data.get("action", "verify")  # verify or reject
    remark = verification_data.get("remark", "")
    
    update_data = {
        "verified": action == "verify",
        "verified_by": user["id"],
        "verified_at": datetime.now(timezone.utc).isoformat(),
        "status": "verified" if action == "verify" else "rejected",
        "remark": remark,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.landing_documents.update_one(
        {"id": document_id},
        {"$set": update_data}
    )
    
    logger.info(f"Landing document {action}ed: {document_id} by {user['email']}")
    
    return {
        "message": f"Document {action}ed successfully",
        "document_id": document_id,
        "verified": action == "verify"
    }


@router.delete("/documents/{document_id}")
async def delete_landing_document(
    document_id: str,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Delete a landing document"""
    db = get_database()
    import os
    
    document = await db.landing_documents.find_one({"id": document_id})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Delete file
    if document.get("file_path") and os.path.exists(document["file_path"]):
        os.remove(document["file_path"])
    
    # Delete record
    await db.landing_documents.delete_one({"id": document_id})
    
    return {"message": "Document deleted successfully"}


# ============== VILLAGE LANDING PERMISSIONS ==============

@router.post("/village-permission")
async def create_village_landing_permission(
    permission_data: dict,
    user: dict = Depends(get_current_user)
):
    """Create village landing permission request"""
    db = get_database()
    
    permission_id = str(uuid4())
    permission_number = f"VLP{datetime.now(timezone.utc).strftime('%Y%m%d')}{permission_id[:6].upper()}"
    
    permission = {
        "id": permission_id,
        "permission_number": permission_number,
        "booking_id": permission_data.get("booking_id"),
        "inquiry_id": permission_data.get("inquiry_id"),
        "customer_id": user["id"],
        
        # Location
        "location_name": permission_data["location_name"],
        "village_name": permission_data.get("village_name"),
        "district": permission_data["district"],
        "state": permission_data["state"],
        "pincode": permission_data.get("pincode"),
        "latitude": permission_data["latitude"],
        "longitude": permission_data["longitude"],
        
        # Land details
        "land_owner_name": permission_data.get("land_owner_name"),
        "land_owner_phone": permission_data.get("land_owner_phone"),
        "land_area_sqft": permission_data.get("land_area_sqft"),
        "land_type": permission_data.get("land_type"),
        
        # Status
        "status": "documents_pending",
        "documents": [],
        
        # Required documents checklist
        "required_documents": {
            "collector_noc": {"required": True, "uploaded": False, "verified": False},
            "sp_noc": {"required": True, "uploaded": False, "verified": False},
            "fire_noc": {"required": True, "uploaded": False, "verified": False},
            "gram_panchayat": {"required": True, "uploaded": False, "verified": False},
            "land_ownership": {"required": True, "uploaded": False, "verified": False},
            "site_photos": {"required": True, "uploaded": False, "verified": False}
        },
        
        "notes": permission_data.get("notes"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.village_landing_permissions.insert_one(permission.copy())
    
    # Update booking/inquiry if provided
    if permission_data.get("booking_id"):
        await db.bookings.update_one(
            {"id": permission_data["booking_id"]},
            {"$set": {
                "village_landing_permission_id": permission_id,
                "landing_permission_status": "documents_pending"
            }}
        )
    
    if permission_data.get("inquiry_id"):
        await db.inquiries.update_one(
            {"id": permission_data["inquiry_id"]},
            {"$set": {
                "village_landing_permission_id": permission_id,
                "landing_permission_status": "documents_pending"
            }}
        )
    
    return {
        "message": "Village landing permission request created",
        "permission_id": permission_id,
        "permission_number": permission_number,
        "required_documents": list(permission["required_documents"].keys())
    }


@router.post("/village-permission/{permission_id}/upload-document")
async def upload_village_document(
    permission_id: str,
    doc_data: dict,
    user: dict = Depends(get_current_user)
):
    """Upload document for village landing permission - returns presigned URL"""
    db = get_database()
    from s3_service import s3_service
    
    permission = await db.village_landing_permissions.find_one(
        {"id": permission_id},
        {"_id": 0}
    )
    
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found")
    
    if permission["customer_id"] != user["id"] and "admin" not in user.get("roles", []):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    doc_type = doc_data["doc_type"]
    
    # Generate S3 key
    s3_key = f"village_landing/{permission_id}/{doc_type}_{uuid4()}_{doc_data['file_name']}"
    
    # Generate presigned upload URL
    upload_url = s3_service.generate_presigned_upload_url(
        s3_key,
        doc_data.get("content_type", "application/pdf")
    )
    
    doc_id = str(uuid4())
    document = {
        "id": doc_id,
        "doc_type": doc_type,
        "file_name": doc_data["file_name"],
        "s3_key": s3_key,
        "status": "pending",
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "uploaded_by": user["id"]
    }
    
    # Add document and update checklist
    await db.village_landing_permissions.update_one(
        {"id": permission_id},
        {
            "$push": {"documents": document},
            "$set": {
                f"required_documents.{doc_type}.uploaded": True,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Check if all required documents uploaded
    updated_permission = await db.village_landing_permissions.find_one(
        {"id": permission_id},
        {"_id": 0}
    )
    
    all_uploaded = all(
        doc_info.get("uploaded", False) 
        for doc_info in updated_permission.get("required_documents", {}).values()
        if doc_info.get("required", False)
    )
    
    if all_uploaded and updated_permission["status"] == "documents_pending":
        await db.village_landing_permissions.update_one(
            {"id": permission_id},
            {"$set": {"status": "under_review"}}
        )
    
    return {
        "message": "Document upload initiated",
        "document_id": doc_id,
        "upload_url": upload_url,
        "s3_key": s3_key,
        "expires_in": 600
    }


@router.post("/village-permission/{permission_id}/upload-document-direct")
async def upload_village_document_direct(
    permission_id: str,
    file: UploadFile = File(...),
    document_type: str = Form(...),
    user: dict = Depends(get_current_user)
):
    """Direct file upload for village landing permission documents"""
    db = get_database()
    import base64
    import os
    
    permission = await db.village_landing_permissions.find_one(
        {"id": permission_id},
        {"_id": 0}
    )
    
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found")
    
    if permission["customer_id"] != user["id"] and "admin" not in user.get("roles", []):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Validate file type
    allowed_types = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: PDF, JPG, PNG")
    
    # Validate file size (5MB max)
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds 5MB limit")
    
    # Reset file pointer
    await file.seek(0)
    
    # Generate unique filename
    file_extension = file.filename.split('.')[-1].lower()
    unique_filename = f"{document_type}_{uuid4()}.{file_extension}"
    
    # Store file locally (in production, use S3)
    upload_dir = f"/app/uploads/village_documents/{permission_id}"
    os.makedirs(upload_dir, exist_ok=True)
    file_path = f"{upload_dir}/{unique_filename}"
    
    with open(file_path, "wb") as f:
        f.write(contents)
    
    # Generate accessible URL
    file_url = f"/api/uploads/village_documents/{permission_id}/{unique_filename}"
    
    doc_id = str(uuid4())
    document = {
        "id": doc_id,
        "doc_type": document_type,
        "file_name": file.filename,
        "file_path": file_path,
        "file_url": file_url,
        "content_type": file.content_type,
        "file_size": len(contents),
        "status": "uploaded",
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "uploaded_by": user["id"]
    }
    
    # Update permission with document
    await db.village_landing_permissions.update_one(
        {"id": permission_id},
        {
            "$push": {"documents": document},
            "$set": {
                f"required_documents.{document_type}.uploaded": True,
                f"required_documents.{document_type}.document_id": doc_id,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Check if all required documents uploaded
    updated_permission = await db.village_landing_permissions.find_one(
        {"id": permission_id},
        {"_id": 0}
    )
    
    all_uploaded = all(
        doc_info.get("uploaded", False) 
        for doc_info in updated_permission.get("required_documents", {}).values()
        if doc_info.get("required", False)
    )
    
    new_status = updated_permission.get("status", "documents_pending")
    if all_uploaded and new_status == "documents_pending":
        new_status = "under_review"
        await db.village_landing_permissions.update_one(
            {"id": permission_id},
            {"$set": {"status": "under_review"}}
        )
    
    logger.info(f"Document uploaded: {document_type} for permission {permission_id} by user {user['id']}")
    
    return {
        "success": True,
        "message": "Document uploaded successfully",
        "document_id": doc_id,
        "file_url": file_url,
        "file_name": file.filename,
        "document_type": document_type,
        "status": "uploaded",
        "permission_status": new_status
    }


@router.get("/village-permission/{permission_id}")
async def get_village_permission(
    permission_id: str,
    user: dict = Depends(get_current_user)
):
    """Get village landing permission details"""
    db = get_database()
    from s3_service import s3_service
    
    permission = await db.village_landing_permissions.find_one(
        {"id": permission_id},
        {"_id": 0}
    )
    
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found")
    
    # Check access
    user_roles = user.get("roles", [])
    is_admin = any(r in user_roles for r in ["admin", "super_admin", "regional_manager"])
    is_owner = permission["customer_id"] == user["id"]
    
    if not is_admin and not is_owner:
        # Check if operator has access (for their booking)
        if "operator" in user_roles:
            operator = await db.operators.find_one({"user_id": user["id"]})
            if operator:
                booking = await db.bookings.find_one({
                    "village_landing_permission_id": permission_id,
                    "operator_id": operator["id"]
                })
                if not booking:
                    raise HTTPException(status_code=403, detail="Not authorized")
        else:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    # Generate download URLs for documents
    for doc in permission.get("documents", []):
        if doc.get("s3_key"):
            doc["download_url"] = s3_service.generate_presigned_download_url(doc["s3_key"])
    
    return permission


@router.get("/village-permissions")
async def get_customer_village_permissions(user: dict = Depends(get_current_user)):
    """Get all village permissions for current user"""
    db = get_database()
    
    query = {"customer_id": user["id"]}
    
    # Admin can see all
    if any(r in user.get("roles", []) for r in ["admin", "super_admin"]):
        query = {}
    
    permissions = await db.village_landing_permissions.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"permissions": permissions, "total": len(permissions)}


@router.get("/village-permission/inquiry/{inquiry_id}")
async def get_village_permission_by_inquiry(
    inquiry_id: str,
    user: dict = Depends(get_current_user)
):
    """Get village permission by inquiry ID"""
    db = get_database()
    
    permission = await db.village_landing_permissions.find_one(
        {"inquiry_id": inquiry_id},
        {"_id": 0}
    )
    
    if not permission:
        raise HTTPException(status_code=404, detail="Village permission not found for this inquiry")
    
    # Check access: customer, admin, or operator
    if (permission["customer_id"] != user["id"] and 
        not any(r in user.get("roles", []) for r in ["admin", "super_admin", "operator"])):
        raise HTTPException(status_code=403, detail="Access denied")
    
    return permission


# ============== ADMIN DOCUMENT VERIFICATION ==============

@router.post("/village-permission/{permission_id}/verify-document")
async def verify_village_document(
    permission_id: str,
    verify_data: dict,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.REGIONAL_MANAGER]))
):
    """Verify/Approve/Reject a village landing document"""
    db = get_database()
    
    doc_id = verify_data["document_id"]
    action = verify_data["action"]  # approve / reject
    
    permission = await db.village_landing_permissions.find_one(
        {"id": permission_id},
        {"_id": 0}
    )
    
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found")
    
    # Find and update document
    doc_found = False
    doc_type = None
    
    for doc in permission.get("documents", []):
        if doc["id"] == doc_id:
            doc_found = True
            doc_type = doc["doc_type"]
            break
    
    if not doc_found:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Update document status
    await db.village_landing_permissions.update_one(
        {"id": permission_id, "documents.id": doc_id},
        {"$set": {
            "documents.$.status": "approved" if action == "approve" else "rejected",
            "documents.$.verified_by": user["id"],
            "documents.$.verified_at": datetime.now(timezone.utc).isoformat(),
            "documents.$.rejection_reason": verify_data.get("reason") if action == "reject" else None,
            f"required_documents.{doc_type}.verified": action == "approve",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Check if all documents verified
    updated_permission = await db.village_landing_permissions.find_one(
        {"id": permission_id},
        {"_id": 0}
    )
    
    all_verified = all(
        doc_info.get("verified", False)
        for doc_info in updated_permission.get("required_documents", {}).values()
        if doc_info.get("required", False)
    )
    
    any_rejected = any(
        doc.get("status") == "rejected"
        for doc in updated_permission.get("documents", [])
    )
    
    new_status = updated_permission["status"]
    if any_rejected:
        new_status = "rejected"
    elif all_verified:
        new_status = "approved"
    
    if new_status != updated_permission["status"]:
        await db.village_landing_permissions.update_one(
            {"id": permission_id},
            {"$set": {
                "status": new_status,
                "reviewed_by": user["id"],
                "reviewed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Update booking/inquiry status
        if updated_permission.get("booking_id"):
            await db.bookings.update_one(
                {"id": updated_permission["booking_id"]},
                {"$set": {"landing_permission_status": new_status}}
            )
        
        if updated_permission.get("inquiry_id"):
            await db.inquiries.update_one(
                {"id": updated_permission["inquiry_id"]},
                {"$set": {"landing_permission_status": new_status}}
            )
    
    return {
        "message": f"Document {action}d successfully",
        "document_id": doc_id,
        "permission_status": new_status
    }


@router.post("/village-permission/{permission_id}/approve")
async def approve_village_permission(
    permission_id: str,
    approve_data: dict,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.REGIONAL_MANAGER]))
):
    """Approve entire village landing permission"""
    db = get_database()
    
    permission = await db.village_landing_permissions.find_one({"id": permission_id})
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found")
    
    await db.village_landing_permissions.update_one(
        {"id": permission_id},
        {"$set": {
            "status": "approved",
            "reviewed_by": user["id"],
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "review_notes": approve_data.get("notes"),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update related booking/inquiry
    if permission.get("booking_id"):
        await db.bookings.update_one(
            {"id": permission["booking_id"]},
            {"$set": {"landing_permission_status": "approved"}}
        )
    
    if permission.get("inquiry_id"):
        await db.inquiries.update_one(
            {"id": permission["inquiry_id"]},
            {"$set": {"landing_permission_status": "approved"}}
        )
    
    # Create audit log
    await db.audit_logs.insert_one({
        "id": str(uuid4()),
        "action": "village_permission_approved",
        "entity_type": "village_landing_permission",
        "entity_id": permission_id,
        "user_id": user["id"],
        "details": {"notes": approve_data.get("notes")},
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Village landing permission approved", "permission_id": permission_id}


@router.post("/village-permission/{permission_id}/reject")
async def reject_village_permission(
    permission_id: str,
    reject_data: dict,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.REGIONAL_MANAGER]))
):
    """Reject village landing permission"""
    db = get_database()
    
    if not reject_data.get("reason"):
        raise HTTPException(status_code=400, detail="Rejection reason required")
    
    permission = await db.village_landing_permissions.find_one({"id": permission_id})
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found")
    
    await db.village_landing_permissions.update_one(
        {"id": permission_id},
        {"$set": {
            "status": "rejected",
            "reviewed_by": user["id"],
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "review_notes": reject_data["reason"],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update related booking/inquiry
    if permission.get("booking_id"):
        await db.bookings.update_one(
            {"id": permission["booking_id"]},
            {"$set": {"landing_permission_status": "rejected"}}
        )
    
    if permission.get("inquiry_id"):
        await db.inquiries.update_one(
            {"id": permission["inquiry_id"]},
            {"$set": {"landing_permission_status": "rejected"}}
        )
    
    return {"message": "Village landing permission rejected", "permission_id": permission_id}


# ============== HELIPAD OWNER ENDPOINTS ==============

@router.get("/my-helipads")
async def get_my_helipads(
    user: dict = Depends(get_current_user)
):
    """Get all helipads owned by the current user"""
    db = get_database()
    
    # Find helipads where owner_id matches current user
    helipads = await db.landing_points.find(
        {
            "$or": [
                {"owner_id": user["id"]},
                {"contact_email": user.get("email")},
                {"type": {"$in": ["private_helipad", "govt_helipad"]}, "contact_email": user.get("email")}
            ]
        },
        {"_id": 0}
    ).to_list(50)
    
    return {"helipads": helipads, "total": len(helipads)}


@router.get("/helipad/{helipad_id}/stats")
async def get_helipad_stats(
    helipad_id: str,
    user: dict = Depends(get_current_user)
):
    """Get statistics for a specific helipad"""
    db = get_database()
    
    # Verify ownership
    helipad = await db.landing_points.find_one(
        {"id": helipad_id},
        {"_id": 0}
    )
    
    if not helipad:
        raise HTTPException(status_code=404, detail="Helipad not found")
    
    # Check ownership
    if helipad.get("owner_id") != user["id"] and helipad.get("contact_email") != user.get("email"):
        # Check if admin
        if "admin" not in user.get("roles", []):
            raise HTTPException(status_code=403, detail="Not authorized to view this helipad's stats")
    
    # Count bookings where this helipad is destination or pickup
    all_bookings = await db.bookings.find(
        {
            "$or": [
                {"pickup_landing_point_id": helipad_id},
                {"drop_landing_point_id": helipad_id}
            ]
        },
        {"_id": 0}
    ).to_list(1000)
    
    total_bookings = len(all_bookings)
    pending_bookings = len([b for b in all_bookings if b.get("status") == "pending"])
    confirmed_bookings = len([b for b in all_bookings if b.get("status") in ["confirmed", "completed"]])
    
    # Calculate revenue from landing rent
    total_revenue = 0
    this_month_revenue = 0
    current_month = datetime.now(timezone.utc).strftime("%Y-%m")
    
    for booking in all_bookings:
        if booking.get("status") in ["confirmed", "completed"]:
            landing_charges = booking.get("landing_charges", 0) or 0
            total_revenue += landing_charges
            
            # Check if this month
            booking_date = booking.get("created_at", "")
            if booking_date.startswith(current_month):
                this_month_revenue += landing_charges
    
    return {
        "total_bookings": total_bookings,
        "pending_bookings": pending_bookings,
        "confirmed_bookings": confirmed_bookings,
        "total_revenue": total_revenue,
        "this_month_revenue": this_month_revenue,
        "helipad_name": helipad.get("name"),
        "is_active": helipad.get("is_active", False)
    }


@router.get("/helipad/{helipad_id}/bookings")
async def get_helipad_bookings(
    helipad_id: str,
    status: Optional[str] = None,
    limit: int = 50,
    user: dict = Depends(get_current_user)
):
    """Get bookings for a specific helipad"""
    db = get_database()
    
    # Verify ownership
    helipad = await db.landing_points.find_one(
        {"id": helipad_id},
        {"_id": 0}
    )
    
    if not helipad:
        raise HTTPException(status_code=404, detail="Helipad not found")
    
    # Check ownership
    if helipad.get("owner_id") != user["id"] and helipad.get("contact_email") != user.get("email"):
        if "admin" not in user.get("roles", []):
            raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {
        "$or": [
            {"pickup_landing_point_id": helipad_id},
            {"drop_landing_point_id": helipad_id}
        ]
    }
    
    if status:
        query["status"] = status
    
    bookings = await db.bookings.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Enrich with operator info
    for booking in bookings:
        if booking.get("operator_id"):
            operator = await db.users.find_one(
                {"id": booking["operator_id"]},
                {"_id": 0, "id": 1, "full_name": 1, "company_name": 1}
            )
            if operator:
                booking["operator_name"] = operator.get("company_name") or operator.get("full_name")
    
    return {
        "bookings": bookings,
        "total": len(bookings),
        "helipad_name": helipad.get("name")
    }
