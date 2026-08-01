from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File, Form
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


# ============== MAINTENANCE CALENDAR & iCAL EXPORT ==============

@router.get("/calendar")
async def get_maintenance_calendar(
    month: int = Query(None, description="Month (1-12)"),
    year: int = Query(None, description="Year"),
    current_user: dict = Depends(get_current_user)
):
    """Get maintenance calendar view for operator's fleet"""
    db = get_database()
    
    if not any(role in current_user.get("roles", []) for role in ["admin", "operator"]):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    now = datetime.now(timezone.utc)
    target_month = month or now.month
    target_year = year or now.year
    
    # Build date range for the month
    month_start = datetime(target_year, target_month, 1, tzinfo=timezone.utc)
    if target_month == 12:
        month_end = datetime(target_year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        month_end = datetime(target_year, target_month + 1, 1, tzinfo=timezone.utc)
    
    # Get operator's aircraft
    operator = await db.operators.find_one({"user_id": current_user["id"]}, {"_id": 0})
    
    query = {"scheduled_date": {"$gte": month_start.isoformat(), "$lt": month_end.isoformat()}}
    
    if operator:
        # Get operator's aircraft IDs
        aircraft_list = await db.aircraft.find(
            {"operator_id": operator["id"]},
            {"_id": 0, "id": 1}
        ).to_list(100)
        aircraft_ids = [a["id"] for a in aircraft_list]
        query["aircraft_id"] = {"$in": aircraft_ids}
    
    # Get maintenance schedules
    schedules = await db.maintenance_schedules.find(
        query,
        {"_id": 0}
    ).sort("scheduled_date", 1).to_list(500)
    
    # Group by date for calendar view
    calendar_data = {}
    for schedule in schedules:
        date_key = schedule.get("scheduled_date", "")[:10]  # YYYY-MM-DD
        if date_key not in calendar_data:
            calendar_data[date_key] = []
        calendar_data[date_key].append({
            "id": schedule.get("id"),
            "maintenance_number": schedule.get("maintenance_number"),
            "aircraft_registration": schedule.get("aircraft_registration"),
            "aircraft_type": schedule.get("aircraft_type"),
            "type": schedule.get("type"),
            "description": schedule.get("description"),
            "priority": schedule.get("priority"),
            "status": schedule.get("status"),
            "estimated_hours": schedule.get("estimated_hours"),
            "estimated_cost": schedule.get("estimated_cost"),
            "assigned_technician": schedule.get("assigned_technician")
        })
    
    # Get summary stats
    total_scheduled = len(schedules)
    by_status = {}
    by_priority = {}
    for s in schedules:
        status = s.get("status", "scheduled")
        priority = s.get("priority", "medium")
        by_status[status] = by_status.get(status, 0) + 1
        by_priority[priority] = by_priority.get(priority, 0) + 1
    
    return {
        "month": target_month,
        "year": target_year,
        "calendar": calendar_data,
        "schedules": schedules,
        "summary": {
            "total": total_scheduled,
            "by_status": by_status,
            "by_priority": by_priority
        }
    }


@router.get("/calendar/ical")
async def export_maintenance_ical(
    months_ahead: int = Query(3, description="Months to include"),
    current_user: dict = Depends(get_current_user)
):
    """Export maintenance calendar as iCal (.ics) file"""
    from fastapi.responses import Response
    
    db = get_database()
    
    if not any(role in current_user.get("roles", []) for role in ["admin", "operator"]):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    now = datetime.now(timezone.utc)
    end_date = now + timedelta(days=months_ahead * 30)
    
    # Get operator's aircraft
    operator = await db.operators.find_one({"user_id": current_user["id"]}, {"_id": 0})
    
    query = {
        "scheduled_date": {"$gte": now.isoformat(), "$lte": end_date.isoformat()},
        "status": {"$in": ["scheduled", "in_progress"]}
    }
    
    if operator:
        aircraft_list = await db.aircraft.find(
            {"operator_id": operator["id"]},
            {"_id": 0, "id": 1}
        ).to_list(100)
        aircraft_ids = [a["id"] for a in aircraft_list]
        query["aircraft_id"] = {"$in": aircraft_ids}
    
    schedules = await db.maintenance_schedules.find(
        query,
        {"_id": 0}
    ).sort("scheduled_date", 1).to_list(500)
    
    # Build iCal content
    ical_lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//AirYatra//Fleet Maintenance Calendar//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:AirYatra Fleet Maintenance",
        "X-WR-TIMEZONE:Asia/Kolkata"
    ]
    
    for schedule in schedules:
        try:
            scheduled_date = schedule.get("scheduled_date", "")
            if not scheduled_date:
                continue
            
            # Parse date
            dt = datetime.fromisoformat(scheduled_date.replace('Z', '+00:00'))
            dtstart = dt.strftime("%Y%m%dT%H%M%SZ")
            
            # End time based on estimated hours
            duration_hours = schedule.get("estimated_hours", 2) or 2
            dtend = (dt + timedelta(hours=duration_hours)).strftime("%Y%m%dT%H%M%SZ")
            
            priority_map = {"critical": 1, "high": 3, "medium": 5, "low": 7}
            priority = priority_map.get(schedule.get("priority", "medium"), 5)
            
            summary = f"[{schedule.get('aircraft_registration', 'N/A')}] {schedule.get('type', 'Maintenance').title()} - {schedule.get('description', 'Scheduled maintenance')[:50]}"
            
            description = f"Aircraft: {schedule.get('aircraft_registration')}\\nType: {schedule.get('type')}\\nDescription: {schedule.get('description')}\\nEstimated Hours: {duration_hours}h\\nEstimated Cost: Rs.{schedule.get('estimated_cost', 0)}\\nTechnician: {schedule.get('assigned_technician') or 'TBD'}\\nStatus: {schedule.get('status')}"
            
            ical_lines.extend([
                "BEGIN:VEVENT",
                f"UID:{schedule.get('id')}@airyatra.com",
                f"DTSTAMP:{now.strftime('%Y%m%dT%H%M%SZ')}",
                f"DTSTART:{dtstart}",
                f"DTEND:{dtend}",
                f"SUMMARY:{summary}",
                f"DESCRIPTION:{description}",
                f"PRIORITY:{priority}",
                f"CATEGORIES:MAINTENANCE,{schedule.get('type', 'scheduled').upper()}",
                "STATUS:CONFIRMED",
                "END:VEVENT"
            ])
        except Exception as e:
            continue
    
    ical_lines.append("END:VCALENDAR")
    
    ical_content = "\r\n".join(ical_lines)
    
    return Response(
        content=ical_content,
        media_type="text/calendar",
        headers={
            "Content-Disposition": f"attachment; filename=airyatra_maintenance_{now.strftime('%Y%m%d')}.ics"
        }
    )


# ============== MAINTENANCE COST TRACKER ==============

@router.get("/cost-tracker")
async def get_maintenance_cost_tracker(
    months: int = Query(6, description="Number of months to analyze"),
    current_user: dict = Depends(get_current_user)
):
    """Get maintenance cost tracking with estimated vs actual variance"""
    db = get_database()
    
    if not any(role in current_user.get("roles", []) for role in ["admin", "operator"]):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    now = datetime.now(timezone.utc)
    start_date = (now - timedelta(days=months * 30)).isoformat()
    
    # Get operator's aircraft if operator
    query = {"scheduled_date": {"$gte": start_date}}
    
    operator = await db.operators.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if operator:
        aircraft_list = await db.aircraft.find(
            {"operator_id": operator["id"]},
            {"_id": 0, "id": 1}
        ).to_list(100)
        aircraft_ids = [a["id"] for a in aircraft_list]
        query["aircraft_id"] = {"$in": aircraft_ids}
    
    # Get all maintenance records with costs
    records = await db.maintenance_schedules.find(
        query,
        {"_id": 0}
    ).sort("scheduled_date", -1).to_list(500)
    
    # Calculate totals and variances
    total_estimated = 0
    total_actual = 0
    completed_count = 0
    over_budget_count = 0
    under_budget_count = 0
    on_budget_count = 0
    
    monthly_data = {}
    by_type = {}
    variance_items = []
    
    for record in records:
        estimated = float(record.get("estimated_cost", 0) or 0)
        actual = float(record.get("actual_cost", 0) or 0)
        
        total_estimated += estimated
        
        if record.get("status") == "completed" and actual > 0:
            total_actual += actual
            completed_count += 1
            
            variance = actual - estimated
            variance_percent = ((actual - estimated) / estimated * 100) if estimated > 0 else 0
            
            if variance_percent > 10:
                over_budget_count += 1
            elif variance_percent < -10:
                under_budget_count += 1
            else:
                on_budget_count += 1
            
            variance_items.append({
                "id": record.get("id"),
                "maintenance_number": record.get("maintenance_number"),
                "aircraft": record.get("aircraft_registration"),
                "type": record.get("type"),
                "description": record.get("description"),
                "scheduled_date": record.get("scheduled_date"),
                "estimated_cost": estimated,
                "actual_cost": actual,
                "variance": round(variance, 2),
                "variance_percent": round(variance_percent, 1),
                "status": "over" if variance_percent > 10 else "under" if variance_percent < -10 else "on_budget"
            })
        
        # Monthly aggregation
        month_key = record.get("scheduled_date", "")[:7]  # YYYY-MM
        if month_key:
            if month_key not in monthly_data:
                monthly_data[month_key] = {"estimated": 0, "actual": 0, "count": 0}
            monthly_data[month_key]["estimated"] += estimated
            if actual > 0:
                monthly_data[month_key]["actual"] += actual
            monthly_data[month_key]["count"] += 1
        
        # By type aggregation
        mtype = record.get("type", "other")
        if mtype not in by_type:
            by_type[mtype] = {"estimated": 0, "actual": 0, "count": 0}
        by_type[mtype]["estimated"] += estimated
        if actual > 0:
            by_type[mtype]["actual"] += actual
        by_type[mtype]["count"] += 1
    
    # Format monthly data for charts
    monthly_chart = []
    for month_key in sorted(monthly_data.keys()):
        data = monthly_data[month_key]
        monthly_chart.append({
            "month": month_key,
            "estimated": round(data["estimated"], 2),
            "actual": round(data["actual"], 2),
            "count": data["count"]
        })
    
    # Format by type
    type_breakdown = []
    for mtype, data in by_type.items():
        variance = data["actual"] - data["estimated"] if data["actual"] > 0 else 0
        type_breakdown.append({
            "type": mtype,
            "estimated": round(data["estimated"], 2),
            "actual": round(data["actual"], 2),
            "variance": round(variance, 2),
            "count": data["count"]
        })
    
    # Sort variance items by variance (highest first)
    variance_items.sort(key=lambda x: abs(x["variance"]), reverse=True)
    
    total_variance = total_actual - total_estimated
    total_variance_percent = ((total_actual - total_estimated) / total_estimated * 100) if total_estimated > 0 else 0
    
    return {
        "summary": {
            "total_estimated": round(total_estimated, 2),
            "total_actual": round(total_actual, 2),
            "total_variance": round(total_variance, 2),
            "variance_percent": round(total_variance_percent, 1),
            "completed_count": completed_count,
            "over_budget": over_budget_count,
            "under_budget": under_budget_count,
            "on_budget": on_budget_count
        },
        "monthly_trend": monthly_chart[-6:],  # Last 6 months
        "by_type": type_breakdown,
        "variance_details": variance_items[:20],  # Top 20 variances
        "analysis_period_months": months
    }


@router.put("/schedules/{schedule_id}/actual-cost")
async def update_actual_cost(
    schedule_id: str,
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update actual cost after maintenance completion"""
    db = get_database()
    
    if not any(role in current_user.get("roles", []) for role in ["admin", "operator"]):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    actual_cost = float(data.get("actual_cost", 0))
    actual_hours = float(data.get("actual_hours", 0))
    notes = data.get("notes", "")
    
    if actual_cost < 0:
        raise HTTPException(status_code=400, detail="Cost cannot be negative")
    
    schedule = await db.maintenance_schedules.find_one({"id": schedule_id}, {"_id": 0})
    if not schedule:
        raise HTTPException(status_code=404, detail="Maintenance schedule not found")
    
    # Calculate variance
    estimated = float(schedule.get("estimated_cost", 0) or 0)
    variance = actual_cost - estimated
    variance_percent = ((actual_cost - estimated) / estimated * 100) if estimated > 0 else 0
    
    await db.maintenance_schedules.update_one(
        {"id": schedule_id},
        {"$set": {
            "actual_cost": actual_cost,
            "actual_hours": actual_hours,
            "cost_variance": variance,
            "cost_variance_percent": variance_percent,
            "completion_notes": notes,
            "cost_updated_at": datetime.now(timezone.utc).isoformat(),
            "cost_updated_by": current_user["id"]
        }}
    )
    
    return {
        "message": "Actual cost updated",
        "variance": round(variance, 2),
        "variance_percent": round(variance_percent, 1)
    }


# ============== PILOT DOCUMENT UPLOAD PORTAL ==============

@router.get("/pilot-documents")
async def get_pilot_documents(
    pilot_id: str = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Get pilot documents for upload portal"""
    db = get_database()
    
    # Determine if user is pilot viewing own docs or operator viewing pilot docs
    query = {}
    
    if "operator" in current_user.get("roles", []):
        operator = await db.operators.find_one({"user_id": current_user["id"]}, {"_id": 0})
        if operator and pilot_id:
            query = {"pilot_id": pilot_id, "operator_id": operator["id"]}
        elif operator:
            # Get all docs for operator's pilots
            pilots = await db.pilots.find({"operator_id": operator["id"]}, {"_id": 0, "id": 1}).to_list(100)
            pilot_ids = [p["id"] for p in pilots]
            query = {"pilot_id": {"$in": pilot_ids}}
    else:
        # User is viewing own pilot docs
        pilot = await db.pilots.find_one({"user_id": current_user["id"]}, {"_id": 0})
        if pilot:
            query = {"pilot_id": pilot["id"]}
        else:
            return {"documents": [], "pilot": None}
    
    documents = await db.pilot_documents.find(query, {"_id": 0}).sort("uploaded_at", -1).to_list(100)
    
    # Get pilot info if specific pilot
    pilot_info = None
    if pilot_id:
        pilot_info = await db.pilots.find_one({"id": pilot_id}, {"_id": 0, "id": 1, "name": 1, "license_number": 1})
    
    return {
        "documents": documents,
        "pilot": pilot_info,
        "document_types": [
            {"value": "license", "label": "Pilot License / पायलट लाइसेंस"},
            {"value": "medical", "label": "Medical Certificate / चिकित्सा प्रमाणपत्र"},
            {"value": "type_rating", "label": "Type Rating / टाइप रेटिंग"},
            {"value": "instrument_rating", "label": "Instrument Rating"},
            {"value": "english_proficiency", "label": "English Proficiency"},
            {"value": "id_proof", "label": "ID Proof / आईडी प्रूफ"},
            {"value": "passport", "label": "Passport / पासपोर्ट"},
            {"value": "training_certificate", "label": "Training Certificate"},
            {"value": "other", "label": "Other / अन्य"}
        ]
    }


@router.post("/pilot-documents/upload")
async def upload_pilot_document(
    file: UploadFile = File(...),
    pilot_id: str = Form(...),
    document_type: str = Form(...),
    expiry_date: str = Form(None),
    document_number: str = Form(None),
    notes: str = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """Upload pilot document with auto-verification"""
    import base64
    db = get_database()
    
    # Validate pilot access
    pilot = await db.pilots.find_one({"id": pilot_id}, {"_id": 0})
    if not pilot:
        raise HTTPException(status_code=404, detail="Pilot not found")
    
    # Check permission
    has_permission = False
    if "operator" in current_user.get("roles", []):
        operator = await db.operators.find_one({"user_id": current_user["id"]}, {"_id": 0})
        if operator and pilot.get("operator_id") == operator["id"]:
            has_permission = True
    elif pilot.get("user_id") == current_user["id"]:
        has_permission = True
    
    if not has_permission:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Read file
    content = await file.read()
    
    # Validate file type
    allowed_types = ["application/pdf", "image/jpeg", "image/png", "image/jpg"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only PDF and image files allowed")
    
    # Max 5MB
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")
    
    # Store as base64
    file_base64 = base64.b64encode(content).decode()
    
    # Auto-verification checks
    verification_status = "pending"
    verification_notes = []
    
    # Check expiry date
    if expiry_date:
        try:
            exp_date = datetime.fromisoformat(expiry_date.replace('Z', '+00:00'))
            now = datetime.now(timezone.utc)
            days_until_expiry = (exp_date - now).days
            
            if days_until_expiry < 0:
                verification_status = "expired"
                verification_notes.append("Document has expired / दस्तावेज़ समाप्त हो गया है")
            elif days_until_expiry < 30:
                verification_status = "expiring_soon"
                verification_notes.append(f"Expires in {days_until_expiry} days / {days_until_expiry} दिनों में समाप्त")
            else:
                verification_status = "valid"
                verification_notes.append("Document valid / दस्तावेज़ वैध")
        except (ValueError, TypeError):
            verification_notes.append("Could not verify expiry date")
    
    # Create document record
    doc_id = str(uuid4())
    document = {
        "id": doc_id,
        "pilot_id": pilot_id,
        "pilot_name": pilot.get("name"),
        "operator_id": pilot.get("operator_id"),
        "document_type": document_type,
        "document_number": document_number,
        "file_name": file.filename,
        "file_type": file.content_type,
        "file_size": len(content),
        "file_data": file_base64,
        "expiry_date": expiry_date,
        "notes": notes,
        "verification_status": verification_status,
        "verification_notes": verification_notes,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "uploaded_by": current_user["id"]
    }
    
    await db.pilot_documents.insert_one(document.copy())
    
    # Update pilot's expiry dates based on document type
    update_fields = {}
    if document_type == "license" and expiry_date:
        update_fields["license_expiry"] = expiry_date
        update_fields["license_number"] = document_number or pilot.get("license_number")
    elif document_type == "medical" and expiry_date:
        update_fields["medical_expiry"] = expiry_date
    elif document_type == "type_rating" and expiry_date:
        update_fields["type_rating_expiry"] = expiry_date
    
    if update_fields:
        update_fields["documents_updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.pilots.update_one({"id": pilot_id}, {"$set": update_fields})
    
    # Remove file data from response
    del document["file_data"]
    
    return {
        "message": "Document uploaded successfully",
        "document": document,
        "auto_verification": {
            "status": verification_status,
            "notes": verification_notes
        }
    }


@router.get("/pilot-documents/{doc_id}/download")
async def download_pilot_document(
    doc_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Download pilot document"""
    import base64
    from fastapi.responses import Response
    
    db = get_database()
    
    document = await db.pilot_documents.find_one({"id": doc_id}, {"_id": 0})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Check permission
    has_permission = False
    if "operator" in current_user.get("roles", []) or "admin" in current_user.get("roles", []):
        has_permission = True
    else:
        pilot = await db.pilots.find_one({"id": document.get("pilot_id")}, {"_id": 0})
        if pilot and pilot.get("user_id") == current_user["id"]:
            has_permission = True
    
    if not has_permission:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Decode file
    file_data = base64.b64decode(document.get("file_data", ""))
    
    return Response(
        content=file_data,
        media_type=document.get("file_type", "application/octet-stream"),
        headers={
            "Content-Disposition": f"attachment; filename={document.get('file_name', 'document')}"
        }
    )


@router.delete("/pilot-documents/{doc_id}")
async def delete_pilot_document(
    doc_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete pilot document"""
    db = get_database()
    
    document = await db.pilot_documents.find_one({"id": doc_id}, {"_id": 0})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Check permission (only operator/admin can delete)
    if not any(role in current_user.get("roles", []) for role in ["operator", "admin"]):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    await db.pilot_documents.delete_one({"id": doc_id})
    
    return {"message": "Document deleted"}
