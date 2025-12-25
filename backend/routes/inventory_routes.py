from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from database import get_database
from routes.auth_routes import get_current_user

router = APIRouter(prefix="/inventory", tags=["Inventory Management"])

# Models
class SlotDefinition(BaseModel):
    aircraft_id: str
    date: str
    start_time: str
    end_time: str
    origin_helipad: str
    max_bookings: int = 1
    price_per_slot: float
    slot_type: str = "regular"  # regular, premium, charter

class SlotBlock(BaseModel):
    slot_id: str
    reason: str  # maintenance, weather, private, other
    blocked_by: Optional[str] = None
    notes: Optional[str] = None

class WaitlistEntry(BaseModel):
    slot_id: str
    customer_name: str
    customer_phone: str
    customer_email: str
    passengers: int = 1
    notes: Optional[str] = None

class OverbookingConfig(BaseModel):
    aircraft_id: str
    max_overbook_percent: float = 10.0  # 10% overbooking allowed
    auto_waitlist: bool = True

# API Endpoints
@router.post("/slots/create")
async def create_slot(slot: SlotDefinition, current_user: dict = Depends(get_current_user)):
    """Create an availability slot"""
    if "admin" not in current_user.get("roles", []) and "operator" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    db = get_database()
    
    # Check for conflicts
    existing = await db.inventory_slots.find_one({
        "aircraft_id": slot.aircraft_id,
        "date": slot.date,
        "start_time": slot.start_time,
        "is_active": True
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Slot already exists for this time")
    
    slot_data = {
        "id": str(uuid4()),
        **slot.dict(),
        "bookings_count": 0,
        "booked_by": [],
        "is_blocked": False,
        "block_reason": None,
        "waitlist": [],
        "is_active": True,
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.inventory_slots.insert_one(slot_data)
    slot_data.pop("_id", None)
    
    return {"message": "Slot created", "slot": slot_data}

@router.post("/slots/bulk-create")
async def bulk_create_slots(aircraft_id: str, start_date: str, end_date: str, daily_slots: List[dict], current_user: dict = Depends(get_current_user)):
    """Bulk create slots for a date range"""
    if "admin" not in current_user.get("roles", []) and "operator" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    db = get_database()
    
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    
    created_count = 0
    current = start
    
    while current <= end:
        date_str = current.strftime("%Y-%m-%d")
        
        for slot_template in daily_slots:
            slot_data = {
                "id": str(uuid4()),
                "aircraft_id": aircraft_id,
                "date": date_str,
                "start_time": slot_template.get("start_time"),
                "end_time": slot_template.get("end_time"),
                "origin_helipad": slot_template.get("origin_helipad"),
                "max_bookings": slot_template.get("max_bookings", 1),
                "price_per_slot": slot_template.get("price_per_slot", 25000),
                "slot_type": slot_template.get("slot_type", "regular"),
                "bookings_count": 0,
                "booked_by": [],
                "is_blocked": False,
                "waitlist": [],
                "is_active": True,
                "created_by": current_user["id"],
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Check for existing
            existing = await db.inventory_slots.find_one({
                "aircraft_id": aircraft_id,
                "date": date_str,
                "start_time": slot_data["start_time"],
                "is_active": True
            })
            
            if not existing:
                await db.inventory_slots.insert_one(slot_data)
                created_count += 1
        
        current += timedelta(days=1)
    
    return {"message": f"Created {created_count} slots", "date_range": f"{start_date} to {end_date}"}

@router.get("/slots/available")
async def get_available_slots(date: str, origin: Optional[str] = None, aircraft_id: Optional[str] = None):
    """Get available slots for a date"""
    db = get_database()
    
    query = {
        "date": date,
        "is_active": True,
        "is_blocked": False,
        "$expr": {"$lt": ["$bookings_count", "$max_bookings"]}
    }
    
    if origin:
        query["origin_helipad"] = {"$regex": origin, "$options": "i"}
    if aircraft_id:
        query["aircraft_id"] = aircraft_id
    
    slots = await db.inventory_slots.find(query, {"_id": 0}).to_list(100)
    
    # Enrich with aircraft info
    for slot in slots:
        aircraft = await db.aircraft.find_one({"id": slot["aircraft_id"]}, {"_id": 0, "registration": 1, "type": 1, "model": 1})
        slot["aircraft"] = aircraft
        slot["available_seats"] = slot["max_bookings"] - slot["bookings_count"]
    
    return {"available_slots": slots, "count": len(slots)}

@router.post("/slots/{slot_id}/book")
async def book_slot(slot_id: str, booking_id: str, passengers: int = 1, current_user: dict = Depends(get_current_user)):
    """Book a slot"""
    db = get_database()
    
    slot = await db.inventory_slots.find_one({"id": slot_id, "is_active": True})
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    
    if slot["is_blocked"]:
        raise HTTPException(status_code=400, detail="Slot is blocked")
    
    available = slot["max_bookings"] - slot["bookings_count"]
    
    if passengers > available:
        # Check if waitlist is enabled
        config = await db.overbooking_config.find_one({"aircraft_id": slot["aircraft_id"]})
        if config and config.get("auto_waitlist"):
            # Add to waitlist
            waitlist_entry = {
                "id": str(uuid4()),
                "booking_id": booking_id,
                "user_id": current_user["id"],
                "passengers": passengers,
                "added_at": datetime.now(timezone.utc).isoformat(),
                "status": "waiting"
            }
            await db.inventory_slots.update_one(
                {"id": slot_id},
                {"$push": {"waitlist": waitlist_entry}}
            )
            return {"status": "waitlisted", "message": "Added to waitlist", "position": len(slot.get("waitlist", [])) + 1}
        else:
            raise HTTPException(status_code=400, detail=f"Only {available} seats available")
    
    # Book the slot
    booking_entry = {
        "booking_id": booking_id,
        "user_id": current_user["id"],
        "passengers": passengers,
        "booked_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.inventory_slots.update_one(
        {"id": slot_id},
        {
            "$inc": {"bookings_count": passengers},
            "$push": {"booked_by": booking_entry}
        }
    )
    
    return {"status": "booked", "message": "Slot booked successfully"}

@router.post("/slots/{slot_id}/block")
async def block_slot(slot_id: str, block: SlotBlock, current_user: dict = Depends(get_current_user)):
    """Block a slot"""
    if "admin" not in current_user.get("roles", []) and "operator" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    db = get_database()
    
    await db.inventory_slots.update_one(
        {"id": slot_id},
        {
            "$set": {
                "is_blocked": True,
                "block_reason": block.reason,
                "blocked_by": current_user["id"],
                "block_notes": block.notes,
                "blocked_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {"message": "Slot blocked"}

@router.post("/slots/{slot_id}/unblock")
async def unblock_slot(slot_id: str, current_user: dict = Depends(get_current_user)):
    """Unblock a slot"""
    if "admin" not in current_user.get("roles", []) and "operator" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    db = get_database()
    
    await db.inventory_slots.update_one(
        {"id": slot_id},
        {
            "$set": {
                "is_blocked": False,
                "block_reason": None,
                "unblocked_by": current_user["id"],
                "unblocked_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {"message": "Slot unblocked"}

@router.post("/waitlist/add")
async def add_to_waitlist(entry: WaitlistEntry, current_user: dict = Depends(get_current_user)):
    """Manually add to waitlist"""
    db = get_database()
    
    waitlist_data = {
        "id": str(uuid4()),
        "slot_id": entry.slot_id,
        "user_id": current_user["id"],
        "customer_name": entry.customer_name,
        "customer_phone": entry.customer_phone,
        "customer_email": entry.customer_email,
        "passengers": entry.passengers,
        "notes": entry.notes,
        "status": "waiting",
        "added_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.inventory_slots.update_one(
        {"id": entry.slot_id},
        {"$push": {"waitlist": waitlist_data}}
    )
    
    # Get position
    slot = await db.inventory_slots.find_one({"id": entry.slot_id})
    position = len(slot.get("waitlist", []))
    
    return {"message": "Added to waitlist", "position": position}

@router.get("/waitlist/{slot_id}")
async def get_waitlist(slot_id: str, current_user: dict = Depends(get_current_user)):
    """Get waitlist for a slot"""
    db = get_database()
    
    slot = await db.inventory_slots.find_one({"id": slot_id}, {"_id": 0, "waitlist": 1})
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    
    return {"waitlist": slot.get("waitlist", [])}

@router.get("/dashboard")
async def get_inventory_dashboard(current_user: dict = Depends(get_current_user)):
    """Get inventory dashboard"""
    if "admin" not in current_user.get("roles", []) and "operator" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    db = get_database()
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    week_end = (datetime.now(timezone.utc) + timedelta(days=7)).strftime("%Y-%m-%d")
    
    # Today's stats
    today_slots = await db.inventory_slots.count_documents({"date": today, "is_active": True})
    today_booked = await db.inventory_slots.count_documents({"date": today, "is_active": True, "bookings_count": {"$gt": 0}})
    today_blocked = await db.inventory_slots.count_documents({"date": today, "is_blocked": True})
    
    # This week
    week_slots = await db.inventory_slots.find(
        {"date": {"$gte": today, "$lte": week_end}, "is_active": True},
        {"_id": 0, "date": 1, "bookings_count": 1, "max_bookings": 1}
    ).to_list(500)
    
    # Calculate utilization
    total_capacity = sum(s.get("max_bookings", 0) for s in week_slots)
    total_booked = sum(s.get("bookings_count", 0) for s in week_slots)
    utilization = (total_booked / total_capacity * 100) if total_capacity > 0 else 0
    
    # Waitlist count
    pipeline = [
        {"$unwind": "$waitlist"},
        {"$match": {"waitlist.status": "waiting"}},
        {"$count": "total"}
    ]
    waitlist_result = await db.inventory_slots.aggregate(pipeline).to_list(1)
    waitlist_count = waitlist_result[0]["total"] if waitlist_result else 0
    
    return {
        "today": {
            "total_slots": today_slots,
            "booked_slots": today_booked,
            "blocked_slots": today_blocked,
            "available_slots": today_slots - today_booked - today_blocked
        },
        "this_week": {
            "total_capacity": total_capacity,
            "total_booked": total_booked,
            "utilization_percent": round(utilization, 1)
        },
        "waitlist_count": waitlist_count
    }
