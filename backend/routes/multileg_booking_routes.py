from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from database import get_database
from routes.auth_routes import get_current_user

router = APIRouter(prefix="/multileg", tags=["Multi-leg Booking"])

# Models
class LegDetail(BaseModel):
    origin: str
    destination: str
    origin_coords: Optional[dict] = None  # {lat, lon}
    destination_coords: Optional[dict] = None
    journey_date: str
    journey_time: str
    passengers: int = 1
    aircraft_preference: Optional[str] = None
    special_requests: Optional[str] = None

class MultiLegBookingRequest(BaseModel):
    booking_type: str  # round_trip, multi_city, group
    legs: List[LegDetail]
    contact_name: str
    contact_phone: str
    contact_email: str
    total_passengers: int = 1
    group_name: Optional[str] = None  # For group bookings
    corporate_account_id: Optional[str] = None
    special_requirements: Optional[str] = None
    preferred_operators: List[str] = []

class GroupMember(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    id_type: Optional[str] = None  # aadhar, passport, etc.
    id_number: Optional[str] = None
    special_needs: Optional[str] = None

class GroupBookingUpdate(BaseModel):
    members: List[GroupMember]

class RecurringBookingTemplate(BaseModel):
    name: str
    description: Optional[str] = None
    legs: List[LegDetail]
    frequency: str  # daily, weekly, monthly
    day_of_week: Optional[int] = None  # 0-6 for weekly
    day_of_month: Optional[int] = None  # 1-31 for monthly
    start_date: str
    end_date: Optional[str] = None
    auto_confirm: bool = False

# Helper Functions
async def calculate_multileg_price(legs: List[dict], db) -> dict:
    """Calculate total price for multi-leg journey"""
    total_base = 0
    leg_prices = []
    
    for i, leg in enumerate(legs):
        # Get distance-based pricing (simplified)
        # In production, use actual distance calculation
        base_price = 25000  # Base per leg
        
        # Check for quotes if any
        quote = await db.quotes.find_one({
            "origin": {"$regex": leg["origin"], "$options": "i"},
            "destination": {"$regex": leg["destination"], "$options": "i"}
        })
        
        if quote:
            base_price = quote.get("price", base_price)
        
        # Passenger multiplier
        passenger_mult = 1 + (leg.get("passengers", 1) - 1) * 0.3
        leg_price = base_price * passenger_mult
        
        leg_prices.append({
            "leg": i + 1,
            "route": f"{leg['origin']} → {leg['destination']}",
            "base_price": base_price,
            "final_price": round(leg_price, 0)
        })
        total_base += leg_price
    
    # Multi-leg discount
    discount = 0
    if len(legs) == 2:  # Round trip
        discount = total_base * 0.05  # 5% discount
    elif len(legs) >= 3:  # Multi-city
        discount = total_base * 0.10  # 10% discount
    
    return {
        "leg_prices": leg_prices,
        "subtotal": round(total_base, 0),
        "multi_leg_discount": round(discount, 0),
        "total": round(total_base - discount, 0),
        "discount_percent": round((discount / total_base * 100) if total_base > 0 else 0, 1)
    }

# API Endpoints
@router.post("/create")
async def create_multileg_booking(booking: MultiLegBookingRequest, current_user: dict = Depends(get_current_user)):
    """Create a multi-leg booking"""
    db = get_database()
    
    if len(booking.legs) < 2:
        raise HTTPException(status_code=400, detail="Multi-leg booking requires at least 2 legs")
    
    # Calculate pricing
    pricing = await calculate_multileg_price([leg.dict() for leg in booking.legs], db)
    
    # Generate booking number
    booking_number = f"MLG{datetime.now().strftime('%Y%m%d')}{str(uuid4())[:6].upper()}"
    
    # Create individual leg bookings
    leg_booking_ids = []
    for i, leg in enumerate(booking.legs):
        leg_id = str(uuid4())
        leg_booking = {
            "id": leg_id,
            "booking_number": f"{booking_number}-L{i+1}",
            "parent_booking_id": None,  # Will be updated
            "leg_number": i + 1,
            "origin": leg.origin,
            "destination": leg.destination,
            "journey_date": leg.journey_date,
            "journey_time": leg.journey_time,
            "passengers": leg.passengers,
            "aircraft_preference": leg.aircraft_preference,
            "special_requests": leg.special_requests,
            "status": "pending_quotes",
            "estimated_price": pricing["leg_prices"][i]["final_price"],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.bookings.insert_one(leg_booking)
        leg_booking_ids.append(leg_id)
    
    # Create master booking
    master_booking = {
        "id": str(uuid4()),
        "booking_number": booking_number,
        "booking_type": booking.booking_type,
        "leg_booking_ids": leg_booking_ids,
        "total_legs": len(booking.legs),
        "legs_summary": [
            {"leg": i+1, "route": f"{leg.origin} → {leg.destination}", "date": leg.journey_date}
            for i, leg in enumerate(booking.legs)
        ],
        "contact": {
            "name": booking.contact_name,
            "phone": booking.contact_phone,
            "email": booking.contact_email
        },
        "total_passengers": booking.total_passengers,
        "group_name": booking.group_name,
        "group_members": [],
        "corporate_account_id": booking.corporate_account_id,
        "special_requirements": booking.special_requirements,
        "preferred_operators": booking.preferred_operators,
        "pricing": pricing,
        "status": "draft",
        "user_id": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.multileg_bookings.insert_one(master_booking)
    
    # Update leg bookings with parent ID
    await db.bookings.update_many(
        {"id": {"$in": leg_booking_ids}},
        {"$set": {"parent_booking_id": master_booking["id"]}}
    )
    
    master_booking.pop("_id", None)
    return {"message": "Multi-leg booking created", "booking": master_booking}

@router.get("/my-bookings")
async def get_my_multileg_bookings(current_user: dict = Depends(get_current_user)):
    """Get user's multi-leg bookings"""
    db = get_database()
    
    bookings = await db.multileg_bookings.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"bookings": bookings}

@router.get("/{booking_id}")
async def get_multileg_booking(booking_id: str, current_user: dict = Depends(get_current_user)):
    """Get multi-leg booking details"""
    db = get_database()
    
    booking = await db.multileg_bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Check access
    is_admin = "admin" in current_user.get("roles", [])
    is_owner = booking["user_id"] == current_user["id"]
    if not (is_admin or is_owner):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get leg details
    legs = await db.bookings.find(
        {"id": {"$in": booking["leg_booking_ids"]}},
        {"_id": 0}
    ).to_list(10)
    
    booking["legs_detail"] = sorted(legs, key=lambda x: x.get("leg_number", 0))
    
    return booking

@router.post("/{booking_id}/group-members")
async def update_group_members(booking_id: str, update: GroupBookingUpdate, current_user: dict = Depends(get_current_user)):
    """Update group members for a booking"""
    db = get_database()
    
    booking = await db.multileg_bookings.find_one({"id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking["user_id"] != current_user["id"] and "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    members_data = [member.dict() for member in update.members]
    
    await db.multileg_bookings.update_one(
        {"id": booking_id},
        {
            "$set": {
                "group_members": members_data,
                "total_passengers": len(members_data),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {"message": "Group members updated", "members_count": len(members_data)}

@router.post("/quick-round-trip")
async def create_round_trip(origin: str, destination: str, departure_date: str, return_date: str, passengers: int = 1, current_user: dict = Depends(get_current_user)):
    """Quick round trip booking"""
    request = MultiLegBookingRequest(
        booking_type="round_trip",
        legs=[
            LegDetail(origin=origin, destination=destination, journey_date=departure_date, journey_time="10:00", passengers=passengers),
            LegDetail(origin=destination, destination=origin, journey_date=return_date, journey_time="16:00", passengers=passengers)
        ],
        contact_name=current_user.get("full_name", ""),
        contact_phone=current_user.get("phone", ""),
        contact_email=current_user.get("email", ""),
        total_passengers=passengers
    )
    
    return await create_multileg_booking(request, current_user)

# Recurring Booking Templates
@router.post("/templates")
async def create_recurring_template(template: RecurringBookingTemplate, current_user: dict = Depends(get_current_user)):
    """Create a recurring booking template"""
    db = get_database()
    
    template_data = {
        "id": str(uuid4()),
        **template.dict(),
        "legs": [leg.dict() for leg in template.legs],
        "user_id": current_user["id"],
        "is_active": True,
        "created_bookings": [],
        "next_booking_date": template.start_date,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.booking_templates.insert_one(template_data)
    template_data.pop("_id", None)
    
    return {"message": "Recurring template created", "template": template_data}

@router.get("/templates/my")
async def get_my_templates(current_user: dict = Depends(get_current_user)):
    """Get user's booking templates"""
    db = get_database()
    
    templates = await db.booking_templates.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).to_list(50)
    
    return {"templates": templates}

@router.get("/admin/all")
async def get_all_multileg_bookings(status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get all multi-leg bookings (admin)"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    query = {}
    if status:
        query["status"] = status
    
    bookings = await db.multileg_bookings.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    return {"bookings": bookings, "count": len(bookings)}

@router.get("/calculate-price")
async def calculate_price_preview(legs: str = Query(..., description="JSON array of leg details")):
    """Calculate price preview for multi-leg journey"""
    import json
    try:
        legs_data = json.loads(legs)
    except:
        raise HTTPException(status_code=400, detail="Invalid legs JSON")
    
    db = get_database()
    pricing = await calculate_multileg_price(legs_data, db)
    
    return pricing
