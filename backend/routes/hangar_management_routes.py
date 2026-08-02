"""
Smart Hangar Management
Hangar slot booking, inventory tracking, aircraft parking
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from database import get_database
from middleware import get_current_user, require_roles

router = APIRouter(prefix="/hangar", tags=["Smart Hangar Management"])


# ============== MODELS ==============

class HangarSlotBooking(BaseModel):
    hangar_id: str
    aircraft_id: str
    start_date: str  # YYYY-MM-DD
    end_date: str
    purpose: str = "parking"  # parking, maintenance, inspection
    notes: Optional[str] = None

class InventoryItem(BaseModel):
    name: str
    part_number: str
    category: str  # spare_parts, consumables, tools, safety_equipment
    quantity: int
    min_quantity: int = 5
    unit_cost: float
    location: str
    supplier: Optional[str] = None

class HangarCreate(BaseModel):
    name: str
    location: str
    capacity: int  # Number of aircraft slots
    hourly_rate: float
    daily_rate: float
    facilities: List[str] = []  # maintenance_bay, fuel_station, wash_bay, etc.


# ============== HANGAR MANAGEMENT ==============

@router.get("/list")
async def get_hangars(
    current_user: dict = Depends(require_roles(["admin", "operator"]))
):
    """Get all hangars"""
    db = get_database()
    
    hangars = await db.hangars.find({}, {"_id": 0}).to_list(100)
    
    # If no hangars, seed default data
    if not hangars:
        default_hangars = [
            {
                "id": f"hangar_{ObjectId()}",
                "name": "Mumbai Heliport Hangar A",
                "location": "Mumbai",
                "capacity": 8,
                "available_slots": 5,
                "hourly_rate": 5000,
                "daily_rate": 40000,
                "facilities": ["maintenance_bay", "fuel_station", "wash_bay", "pilot_lounge"],
                "status": "active",
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": f"hangar_{ObjectId()}",
                "name": "Delhi Heliport Main Hangar",
                "location": "Delhi",
                "capacity": 12,
                "available_slots": 8,
                "hourly_rate": 6000,
                "daily_rate": 50000,
                "facilities": ["maintenance_bay", "fuel_station", "24x7_security", "fire_safety"],
                "status": "active",
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": f"hangar_{ObjectId()}",
                "name": "Bangalore HAL Hangar",
                "location": "Bangalore",
                "capacity": 6,
                "available_slots": 4,
                "hourly_rate": 4500,
                "daily_rate": 35000,
                "facilities": ["maintenance_bay", "avionics_lab", "paint_shop"],
                "status": "active",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        ]
        await db.hangars.insert_many(default_hangars)
        hangars = default_hangars
    
    return {"hangars": hangars, "total": len(hangars)}


@router.post("/create")
async def create_hangar(
    data: HangarCreate,
    current_user: dict = Depends(require_roles(["admin"]))
):
    """Create a new hangar"""
    db = get_database()
    
    hangar = {
        "id": f"hangar_{ObjectId()}",
        "name": data.name,
        "location": data.location,
        "capacity": data.capacity,
        "available_slots": data.capacity,
        "hourly_rate": data.hourly_rate,
        "daily_rate": data.daily_rate,
        "facilities": data.facilities,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.get("id")
    }
    
    await db.hangars.insert_one(hangar)
    
    return {"message": "Hangar created successfully", "hangar": hangar}


# ============== SLOT BOOKING ==============

@router.get("/slots")
async def get_hangar_slots(
    hangar_id: Optional[str] = None,
    date: Optional[str] = None,
    current_user: dict = Depends(require_roles(["admin", "operator"]))
):
    """Get hangar slot bookings"""
    db = get_database()
    
    query = {}
    if hangar_id:
        query["hangar_id"] = hangar_id
    if date:
        query["$or"] = [
            {"start_date": {"$lte": date}, "end_date": {"$gte": date}}
        ]
    
    bookings = await db.hangar_bookings.find(query, {"_id": 0}).sort("start_date", 1).to_list(500)
    
    # Enrich with aircraft info
    for booking in bookings:
        aircraft = await db.fleet.find_one({"id": booking.get("aircraft_id")}, {"_id": 0, "registration": 1, "type": 1})
        if aircraft:
            booking["aircraft_registration"] = aircraft.get("registration")
            booking["aircraft_type"] = aircraft.get("type")
    
    return {"bookings": bookings, "total": len(bookings)}


@router.post("/slots/book")
async def book_hangar_slot(
    data: HangarSlotBooking,
    current_user: dict = Depends(require_roles(["admin", "operator"]))
):
    """Book a hangar slot for an aircraft"""
    db = get_database()
    
    # Check hangar exists
    hangar = await db.hangars.find_one({"id": data.hangar_id})
    if not hangar:
        raise HTTPException(status_code=404, detail="Hangar not found")
    
    # Check aircraft exists
    aircraft = await db.fleet.find_one({"id": data.aircraft_id})
    if not aircraft:
        raise HTTPException(status_code=404, detail="Aircraft not found")
    
    # Check for conflicting bookings
    conflict = await db.hangar_bookings.find_one({
        "hangar_id": data.hangar_id,
        "aircraft_id": data.aircraft_id,
        "status": "active",
        "$or": [
            {"start_date": {"$lte": data.end_date}, "end_date": {"$gte": data.start_date}}
        ]
    })
    
    if conflict:
        raise HTTPException(status_code=400, detail="Aircraft already has a booking in this period")
    
    # Calculate cost
    start = datetime.fromisoformat(data.start_date)
    end = datetime.fromisoformat(data.end_date)
    days = max(1, (end - start).days)
    total_cost = days * hangar.get("daily_rate", 40000)
    
    booking = {
        "id": f"hb_{ObjectId()}",
        "hangar_id": data.hangar_id,
        "hangar_name": hangar.get("name"),
        "aircraft_id": data.aircraft_id,
        "aircraft_registration": aircraft.get("registration"),
        "start_date": data.start_date,
        "end_date": data.end_date,
        "days": days,
        "purpose": data.purpose,
        "notes": data.notes,
        "total_cost": total_cost,
        "status": "active",
        "booked_by": current_user.get("id"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.hangar_bookings.insert_one(booking)
    
    # Update available slots
    await db.hangars.update_one(
        {"id": data.hangar_id},
        {"$inc": {"available_slots": -1}}
    )
    
    return {"message": "Slot booked successfully", "booking": booking}


@router.delete("/slots/{booking_id}")
async def cancel_hangar_booking(
    booking_id: str,
    current_user: dict = Depends(require_roles(["admin", "operator"]))
):
    """Cancel a hangar booking"""
    db = get_database()
    
    booking = await db.hangar_bookings.find_one({"id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    await db.hangar_bookings.update_one(
        {"id": booking_id},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Restore available slot
    await db.hangars.update_one(
        {"id": booking["hangar_id"]},
        {"$inc": {"available_slots": 1}}
    )
    
    return {"message": "Booking cancelled successfully"}


# ============== INVENTORY MANAGEMENT ==============

@router.get("/inventory")
async def get_inventory(
    category: Optional[str] = None,
    low_stock: bool = False,
    current_user: dict = Depends(require_roles(["admin", "operator"]))
):
    """Get hangar inventory"""
    db = get_database()
    
    query = {}
    if category:
        query["category"] = category
    if low_stock:
        query["$expr"] = {"$lte": ["$quantity", "$min_quantity"]}
    
    items = await db.hangar_inventory.find(query, {"_id": 0}).sort("name", 1).to_list(500)
    
    # If no items, seed default inventory
    if not items and not category and not low_stock:
        default_items = [
            {"id": f"inv_{ObjectId()}", "name": "Engine Oil 15W-40", "part_number": "OIL-15W40-5L", "category": "consumables", "quantity": 50, "min_quantity": 20, "unit_cost": 1500, "location": "Storage A", "supplier": "Shell Aviation"},
            {"id": f"inv_{ObjectId()}", "name": "Hydraulic Fluid MIL-H-5606", "part_number": "HYD-5606-1L", "category": "consumables", "quantity": 30, "min_quantity": 15, "unit_cost": 800, "location": "Storage A", "supplier": "Castrol"},
            {"id": f"inv_{ObjectId()}", "name": "Spark Plug - Champion RHB32E", "part_number": "SP-RHB32E", "category": "spare_parts", "quantity": 24, "min_quantity": 12, "unit_cost": 2500, "location": "Parts Shelf B", "supplier": "Champion"},
            {"id": f"inv_{ObjectId()}", "name": "Air Filter Element", "part_number": "AF-H125-001", "category": "spare_parts", "quantity": 8, "min_quantity": 4, "unit_cost": 15000, "location": "Parts Shelf B", "supplier": "Airbus"},
            {"id": f"inv_{ObjectId()}", "name": "Fire Extinguisher 2kg", "part_number": "FE-2KG-DRY", "category": "safety_equipment", "quantity": 10, "min_quantity": 5, "unit_cost": 3500, "location": "Safety Bay", "supplier": "Cease Fire"},
            {"id": f"inv_{ObjectId()}", "name": "Torque Wrench Set", "part_number": "TW-SET-01", "category": "tools", "quantity": 5, "min_quantity": 2, "unit_cost": 25000, "location": "Tool Cabinet", "supplier": "Snap-On"},
            {"id": f"inv_{ObjectId()}", "name": "Main Rotor Blade", "part_number": "MRB-H125-01", "category": "spare_parts", "quantity": 2, "min_quantity": 2, "unit_cost": 500000, "location": "High-Value Storage", "supplier": "Airbus"},
            {"id": f"inv_{ObjectId()}", "name": "Tail Rotor Blade", "part_number": "TRB-H125-01", "category": "spare_parts", "quantity": 4, "min_quantity": 2, "unit_cost": 150000, "location": "High-Value Storage", "supplier": "Airbus"},
        ]
        for item in default_items:
            item["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.hangar_inventory.insert_many(default_items)
        items = default_items
    
    # Summary
    total_items = len(items)
    total_value = sum(i.get("quantity", 0) * i.get("unit_cost", 0) for i in items)
    low_stock_count = len([i for i in items if i.get("quantity", 0) <= i.get("min_quantity", 5)])
    
    return {
        "items": items,
        "summary": {
            "total_items": total_items,
            "total_value": total_value,
            "low_stock_count": low_stock_count
        },
        "categories": ["spare_parts", "consumables", "tools", "safety_equipment"]
    }


@router.post("/inventory/add")
async def add_inventory_item(
    data: InventoryItem,
    current_user: dict = Depends(require_roles(["admin", "operator"]))
):
    """Add new inventory item"""
    db = get_database()
    
    item = {
        "id": f"inv_{ObjectId()}",
        **data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.get("id")
    }
    
    await db.hangar_inventory.insert_one(item)
    
    return {"message": "Item added successfully", "item": item}


@router.put("/inventory/{item_id}/stock")
async def update_stock(
    item_id: str,
    quantity_change: int,
    reason: str = "manual_adjustment",
    current_user: dict = Depends(require_roles(["admin", "operator"]))
):
    """Update inventory stock level"""
    db = get_database()
    
    item = await db.hangar_inventory.find_one({"id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    new_quantity = max(0, item.get("quantity", 0) + quantity_change)
    
    await db.hangar_inventory.update_one(
        {"id": item_id},
        {"$set": {"quantity": new_quantity, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Log stock movement
    await db.inventory_movements.insert_one({
        "id": f"mov_{ObjectId()}",
        "item_id": item_id,
        "item_name": item.get("name"),
        "change": quantity_change,
        "new_quantity": new_quantity,
        "reason": reason,
        "user_id": current_user.get("id"),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Stock updated", "new_quantity": new_quantity}


# ============== PARKING & OCCUPANCY ==============

@router.get("/occupancy")
async def get_hangar_occupancy(
    current_user: dict = Depends(require_roles(["admin", "operator"]))
):
    """Get current hangar occupancy overview"""
    db = get_database()
    
    hangars = await db.hangars.find({"status": "active"}, {"_id": 0}).to_list(100)
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    occupancy_data = []
    total_capacity = 0
    total_occupied = 0
    
    for hangar in hangars:
        # Count active bookings for today
        active_bookings = await db.hangar_bookings.count_documents({
            "hangar_id": hangar["id"],
            "status": "active",
            "start_date": {"$lte": today},
            "end_date": {"$gte": today}
        })
        
        capacity = hangar.get("capacity", 0)
        occupied = min(active_bookings, capacity)
        available = capacity - occupied
        occupancy_pct = round((occupied / capacity) * 100) if capacity > 0 else 0
        
        total_capacity += capacity
        total_occupied += occupied
        
        # Get parked aircraft
        parked_aircraft = await db.hangar_bookings.find({
            "hangar_id": hangar["id"],
            "status": "active",
            "start_date": {"$lte": today},
            "end_date": {"$gte": today}
        }, {"_id": 0, "aircraft_registration": 1, "purpose": 1, "end_date": 1}).to_list(20)
        
        occupancy_data.append({
            "hangar_id": hangar["id"],
            "name": hangar.get("name"),
            "location": hangar.get("location"),
            "capacity": capacity,
            "occupied": occupied,
            "available": available,
            "occupancy_percentage": occupancy_pct,
            "daily_rate": hangar.get("daily_rate", 0),
            "parked_aircraft": parked_aircraft,
            "facilities": hangar.get("facilities", [])
        })
    
    overall_occupancy = round((total_occupied / total_capacity) * 100) if total_capacity > 0 else 0
    
    return {
        "occupancy": occupancy_data,
        "summary": {
            "total_hangars": len(occupancy_data),
            "total_capacity": total_capacity,
            "total_occupied": total_occupied,
            "total_available": total_capacity - total_occupied,
            "overall_occupancy_percentage": overall_occupancy
        },
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


@router.get("/dashboard")
async def get_hangar_dashboard(
    current_user: dict = Depends(require_roles(["admin", "operator"]))
):
    """Complete hangar management dashboard"""
    db = get_database()
    
    # Get occupancy
    occupancy = await get_hangar_occupancy(current_user)
    
    # Get inventory summary
    inventory = await get_inventory(current_user=current_user)
    
    # Get upcoming bookings (next 7 days)
    today = datetime.now(timezone.utc)
    week_later = (today + timedelta(days=7)).strftime("%Y-%m-%d")
    today_str = today.strftime("%Y-%m-%d")
    
    upcoming_bookings = await db.hangar_bookings.find({
        "status": "active",
        "start_date": {"$gte": today_str, "$lte": week_later}
    }, {"_id": 0}).sort("start_date", 1).to_list(20)
    
    # Revenue calculation (this month)
    month_start = today.replace(day=1).strftime("%Y-%m-%d")
    month_bookings = await db.hangar_bookings.find({
        "status": "active",
        "start_date": {"$gte": month_start}
    }).to_list(500)
    
    monthly_revenue = sum(b.get("total_cost", 0) for b in month_bookings)
    
    return {
        "occupancy": occupancy,
        "inventory": inventory,
        "upcoming_bookings": upcoming_bookings,
        "revenue": {
            "this_month": monthly_revenue,
            "total_bookings": len(month_bookings)
        },
        "generated_at": today.isoformat()
    }
