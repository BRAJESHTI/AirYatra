from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from database import get_database
from routes.auth_routes import get_current_user

router = APIRouter(prefix="/maintenance", tags=["Fleet Maintenance"])

# Models
class MaintenanceSchedule(BaseModel):
    aircraft_id: str
    type: str  # scheduled, unscheduled, inspection, overhaul
    description: str
    scheduled_date: str
    estimated_hours: float = 0
    estimated_cost: float = 0
    assigned_technician: Optional[str] = None
    parts_required: List[dict] = []  # [{part_id, name, quantity}]
    priority: str = "medium"  # low, medium, high, critical

class MaintenanceUpdate(BaseModel):
    status: Optional[str] = None  # scheduled, in_progress, completed, cancelled
    actual_hours: Optional[float] = None
    actual_cost: Optional[float] = None
    notes: Optional[str] = None
    completion_date: Optional[str] = None

class PartCreate(BaseModel):
    name: str
    part_number: str
    category: str  # engine, avionics, airframe, rotors, instruments
    quantity: int = 0
    min_quantity: int = 5
    unit_cost: float = 0
    supplier: Optional[str] = None
    aircraft_compatibility: List[str] = []  # list of aircraft types

class ComplianceItem(BaseModel):
    aircraft_id: str
    type: str  # airworthiness, insurance, registration, pilot_license
    description: str
    issue_date: str
    expiry_date: str
    document_url: Optional[str] = None

# Maintenance Schedule Endpoints
@router.post("/schedule")
async def create_maintenance(schedule: MaintenanceSchedule, current_user: dict = Depends(get_current_user)):
    """Create a maintenance schedule"""
    if not any(role in current_user.get("roles", []) for role in ["admin", "operator"]):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    db = get_database()
    
    # Get aircraft details
    aircraft = await db.aircraft.find_one({"id": schedule.aircraft_id})
    
    maintenance_data = {
        "id": str(uuid4()),
        "maintenance_number": f"MNT{datetime.now().strftime('%Y%m%d')}{str(uuid4())[:4].upper()}",
        "aircraft_id": schedule.aircraft_id,
        "aircraft_registration": aircraft.get("registration", "N/A") if aircraft else "N/A",
        "aircraft_type": aircraft.get("type", "N/A") if aircraft else "N/A",
        "type": schedule.type,
        "description": schedule.description,
        "scheduled_date": schedule.scheduled_date,
        "estimated_hours": schedule.estimated_hours,
        "estimated_cost": schedule.estimated_cost,
        "actual_hours": 0,
        "actual_cost": 0,
        "assigned_technician": schedule.assigned_technician,
        "parts_required": schedule.parts_required,
        "parts_used": [],
        "priority": schedule.priority,
        "status": "scheduled",
        "notes": "",
        "completion_date": None,
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.maintenance_schedules.insert_one(maintenance_data)
    maintenance_data.pop("_id", None)
    
    # Update aircraft status if high priority
    if schedule.priority in ["high", "critical"]:
        await db.aircraft.update_one(
            {"id": schedule.aircraft_id},
            {"$set": {"maintenance_pending": True}}
        )
    
    return {"message": "Maintenance scheduled", "maintenance": maintenance_data}

@router.get("/schedule")
async def get_maintenance_schedules(
    aircraft_id: Optional[str] = None,
    status: Optional[str] = None,
    type: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all maintenance schedules"""
    db = get_database()
    
    query = {}
    if aircraft_id:
        query["aircraft_id"] = aircraft_id
    if status:
        query["status"] = status
    if type:
        query["type"] = type
    if from_date:
        query["scheduled_date"] = {"$gte": from_date}
    if to_date:
        query.setdefault("scheduled_date", {})["$lte"] = to_date
    
    schedules = await db.maintenance_schedules.find(query, {"_id": 0}).sort("scheduled_date", 1).to_list(100)
    return {"schedules": schedules}

@router.put("/schedule/{maintenance_id}")
async def update_maintenance(
    maintenance_id: str,
    update: MaintenanceUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update maintenance record"""
    db = get_database()
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if update.status:
        update_data["status"] = update.status
    if update.actual_hours is not None:
        update_data["actual_hours"] = update.actual_hours
    if update.actual_cost is not None:
        update_data["actual_cost"] = update.actual_cost
    if update.notes:
        update_data["notes"] = update.notes
    if update.completion_date:
        update_data["completion_date"] = update.completion_date
    
    result = await db.maintenance_schedules.update_one(
        {"id": maintenance_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Maintenance record not found")
    
    # If completed, update aircraft
    if update.status == "completed":
        maintenance = await db.maintenance_schedules.find_one({"id": maintenance_id})
        if maintenance:
            await db.aircraft.update_one(
                {"id": maintenance["aircraft_id"]},
                {
                    "$set": {
                        "last_maintenance_date": datetime.now(timezone.utc).isoformat(),
                        "maintenance_pending": False
                    },
                    "$inc": {"total_maintenance_count": 1}
                }
            )
    
    return {"message": "Maintenance updated"}

@router.get("/dashboard")
async def get_maintenance_dashboard(current_user: dict = Depends(get_current_user)):
    """Get maintenance dashboard"""
    db = get_database()
    
    now = datetime.now(timezone.utc)
    next_week = (now + timedelta(days=7)).isoformat()
    
    # Upcoming maintenance
    upcoming = await db.maintenance_schedules.count_documents({
        "status": "scheduled",
        "scheduled_date": {"$lte": next_week}
    })
    
    # In progress
    in_progress = await db.maintenance_schedules.count_documents({"status": "in_progress"})
    
    # Overdue
    overdue = await db.maintenance_schedules.count_documents({
        "status": "scheduled",
        "scheduled_date": {"$lt": now.isoformat()}
    })
    
    # Critical priority
    critical = await db.maintenance_schedules.count_documents({
        "status": {"$in": ["scheduled", "in_progress"]},
        "priority": "critical"
    })
    
    # Low stock parts
    low_stock_pipeline = [
        {"$match": {"$expr": {"$lte": ["$quantity", "$min_quantity"]}}},
        {"$count": "count"}
    ]
    low_stock_result = await db.parts_inventory.aggregate(low_stock_pipeline).to_list(1)
    low_stock = low_stock_result[0]["count"] if low_stock_result else 0
    
    # Expiring compliance
    thirty_days = (now + timedelta(days=30)).isoformat()
    expiring_compliance = await db.compliance_items.count_documents({
        "expiry_date": {"$lte": thirty_days, "$gte": now.isoformat()}
    })
    
    # Recent maintenance
    recent = await db.maintenance_schedules.find(
        {},
        {"_id": 0, "maintenance_number": 1, "aircraft_registration": 1, "type": 1, "status": 1, "scheduled_date": 1, "priority": 1}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    return {
        "upcoming_maintenance": upcoming,
        "in_progress": in_progress,
        "overdue": overdue,
        "critical_priority": critical,
        "low_stock_parts": low_stock,
        "expiring_compliance": expiring_compliance,
        "recent_maintenance": recent
    }

# Parts Inventory
@router.post("/parts")
async def add_part(part: PartCreate, current_user: dict = Depends(get_current_user)):
    """Add part to inventory"""
    if not any(role in current_user.get("roles", []) for role in ["admin", "operator"]):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    db = get_database()
    
    part_data = {
        "id": str(uuid4()),
        **part.dict(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.parts_inventory.insert_one(part_data)
    part_data.pop("_id", None)
    
    return {"message": "Part added", "part": part_data}

@router.get("/parts")
async def get_parts(
    category: Optional[str] = None,
    low_stock: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get parts inventory"""
    db = get_database()
    
    query = {}
    if category:
        query["category"] = category
    if low_stock:
        query["$expr"] = {"$lte": ["$quantity", "$min_quantity"]}
    
    parts = await db.parts_inventory.find(query, {"_id": 0}).to_list(200)
    return {"parts": parts}

@router.put("/parts/{part_id}/stock")
async def update_stock(
    part_id: str,
    quantity_change: int,
    reason: str = "adjustment",
    current_user: dict = Depends(get_current_user)
):
    """Update part stock"""
    db = get_database()
    
    part = await db.parts_inventory.find_one({"id": part_id})
    if not part:
        raise HTTPException(status_code=404, detail="Part not found")
    
    new_quantity = part["quantity"] + quantity_change
    if new_quantity < 0:
        raise HTTPException(status_code=400, detail="Insufficient stock")
    
    await db.parts_inventory.update_one(
        {"id": part_id},
        {"$set": {"quantity": new_quantity, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Log transaction
    await db.stock_transactions.insert_one({
        "id": str(uuid4()),
        "part_id": part_id,
        "part_number": part["part_number"],
        "quantity_change": quantity_change,
        "new_quantity": new_quantity,
        "reason": reason,
        "updated_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Stock updated", "new_quantity": new_quantity}

# Compliance Tracking
@router.post("/compliance")
async def add_compliance_item(item: ComplianceItem, current_user: dict = Depends(get_current_user)):
    """Add compliance item"""
    if not any(role in current_user.get("roles", []) for role in ["admin", "operator"]):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    db = get_database()
    
    compliance_data = {
        "id": str(uuid4()),
        **item.dict(),
        "status": "valid",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.compliance_items.insert_one(compliance_data)
    compliance_data.pop("_id", None)
    
    return {"message": "Compliance item added", "item": compliance_data}

@router.get("/compliance")
async def get_compliance_items(
    aircraft_id: Optional[str] = None,
    type: Optional[str] = None,
    expiring_soon: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get compliance items"""
    db = get_database()
    
    query = {}
    if aircraft_id:
        query["aircraft_id"] = aircraft_id
    if type:
        query["type"] = type
    if expiring_soon:
        thirty_days = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        query["expiry_date"] = {"$lte": thirty_days}
    
    items = await db.compliance_items.find(query, {"_id": 0}).sort("expiry_date", 1).to_list(100)
    
    # Update status based on expiry
    now = datetime.now(timezone.utc).isoformat()
    for item in items:
        if item["expiry_date"] < now:
            item["status"] = "expired"
        elif item["expiry_date"] < (datetime.now(timezone.utc) + timedelta(days=30)).isoformat():
            item["status"] = "expiring_soon"
        else:
            item["status"] = "valid"
    
    return {"items": items}

@router.get("/aircraft/{aircraft_id}/history")
async def get_aircraft_maintenance_history(
    aircraft_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get maintenance history for an aircraft"""
    db = get_database()
    
    history = await db.maintenance_schedules.find(
        {"aircraft_id": aircraft_id},
        {"_id": 0}
    ).sort("scheduled_date", -1).to_list(50)
    
    # Get aircraft details
    aircraft = await db.aircraft.find_one({"id": aircraft_id}, {"_id": 0})
    
    # Calculate stats
    total_maintenance = len(history)
    total_cost = sum(h.get("actual_cost", 0) for h in history)
    total_hours = sum(h.get("actual_hours", 0) for h in history)
    
    return {
        "aircraft": aircraft,
        "history": history,
        "stats": {
            "total_maintenance": total_maintenance,
            "total_cost": total_cost,
            "total_hours": total_hours
        }
    }
