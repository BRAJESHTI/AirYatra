"""
Pilot Availability Routes
Let pilots mark their available/unavailable dates
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from database import get_database
from middleware import get_current_user
from bson import ObjectId
from typing import Optional, List
from pydantic import BaseModel

router = APIRouter(prefix="/pilot/availability", tags=["Pilot Availability"])


class AvailabilityEntry(BaseModel):
    date: str  # YYYY-MM-DD
    status: str  # available, unavailable, leave, sick, training
    notes: Optional[str] = None


class BulkAvailability(BaseModel):
    entries: List[AvailabilityEntry]


@router.get("/calendar")
async def get_availability_calendar(
    month: Optional[int] = None,
    year: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get pilot's availability calendar for a month"""
    db = get_database()
    
    user_id = current_user.get("id") or str(current_user.get("_id"))
    
    # Default to current month
    now = datetime.now(timezone.utc)
    month = month or now.month
    year = year or now.year
    
    # Get start and end of month
    start_date = f"{year}-{month:02d}-01"
    if month == 12:
        end_date = f"{year + 1}-01-01"
    else:
        end_date = f"{year}-{month + 1:02d}-01"
    
    # Get availability entries
    entries = await db.pilot_availability.find(
        {
            "pilot_id": user_id,
            "date": {"$gte": start_date, "$lt": end_date}
        },
        {"_id": 0}
    ).to_list(50)
    
    # Get flight assignments for the month
    assignments = await db.pilot_assignments.find(
        {
            "pilot_id": user_id,
            "flight_date": {"$gte": start_date, "$lt": end_date}
        },
        {"_id": 0, "flight_date": 1, "flight_id": 1, "from_location": 1, "to_location": 1}
    ).to_list(50)
    
    # Build calendar data
    calendar = {}
    for entry in entries:
        calendar[entry["date"]] = {
            "status": entry.get("status", "available"),
            "notes": entry.get("notes", ""),
            "has_assignment": False
        }
    
    # Mark dates with assignments
    for assignment in assignments:
        date = assignment.get("flight_date")
        if date:
            if date not in calendar:
                calendar[date] = {"status": "available", "notes": "", "has_assignment": False}
            calendar[date]["has_assignment"] = True
            calendar[date]["flight"] = f"{assignment.get('from_location', '')} → {assignment.get('to_location', '')}"
    
    return {
        "month": month,
        "year": year,
        "calendar": calendar,
        "total_available": sum(1 for v in calendar.values() if v.get("status") == "available"),
        "total_unavailable": sum(1 for v in calendar.values() if v.get("status") != "available"),
        "total_assignments": sum(1 for v in calendar.values() if v.get("has_assignment"))
    }


@router.post("/set")
async def set_availability(
    entry: AvailabilityEntry,
    current_user: dict = Depends(get_current_user)
):
    """Set availability for a specific date"""
    db = get_database()
    
    user_id = current_user.get("id") or str(current_user.get("_id"))
    now = datetime.now(timezone.utc)
    
    # Validate date format
    try:
        date_obj = datetime.strptime(entry.date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Validate status
    valid_statuses = ["available", "unavailable", "leave", "sick", "training", "standby"]
    if entry.status not in valid_statuses:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        )
    
    # Check if there's an existing assignment
    assignment = await db.pilot_assignments.find_one({
        "pilot_id": user_id,
        "flight_date": entry.date
    })
    
    if assignment and entry.status != "available":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot mark as {entry.status} - you have a flight assignment on this date"
        )
    
    # Upsert availability
    await db.pilot_availability.update_one(
        {"pilot_id": user_id, "date": entry.date},
        {
            "$set": {
                "pilot_id": user_id,
                "date": entry.date,
                "status": entry.status,
                "notes": entry.notes or "",
                "updated_at": now.isoformat()
            },
            "$setOnInsert": {
                "id": f"avail_{ObjectId()}",
                "created_at": now.isoformat()
            }
        },
        upsert=True
    )
    
    return {
        "message": f"Availability set to {entry.status} for {entry.date}",
        "date": entry.date,
        "status": entry.status
    }


@router.post("/bulk-set")
async def bulk_set_availability(
    data: BulkAvailability,
    current_user: dict = Depends(get_current_user)
):
    """Set availability for multiple dates at once"""
    db = get_database()
    
    user_id = current_user.get("id") or str(current_user.get("_id"))
    now = datetime.now(timezone.utc)
    
    success_count = 0
    errors = []
    
    for entry in data.entries:
        try:
            # Validate date
            datetime.strptime(entry.date, "%Y-%m-%d")
            
            # Check for assignments
            assignment = await db.pilot_assignments.find_one({
                "pilot_id": user_id,
                "flight_date": entry.date
            })
            
            if assignment and entry.status != "available":
                errors.append(f"{entry.date}: Has flight assignment")
                continue
            
            # Upsert
            await db.pilot_availability.update_one(
                {"pilot_id": user_id, "date": entry.date},
                {
                    "$set": {
                        "pilot_id": user_id,
                        "date": entry.date,
                        "status": entry.status,
                        "notes": entry.notes or "",
                        "updated_at": now.isoformat()
                    },
                    "$setOnInsert": {
                        "id": f"avail_{ObjectId()}",
                        "created_at": now.isoformat()
                    }
                },
                upsert=True
            )
            success_count += 1
        except Exception as e:
            errors.append(f"{entry.date}: {str(e)}")
    
    return {
        "message": f"Updated {success_count} dates",
        "success_count": success_count,
        "error_count": len(errors),
        "errors": errors if errors else None
    }


@router.delete("/clear/{date}")
async def clear_availability(
    date: str,
    current_user: dict = Depends(get_current_user)
):
    """Clear availability setting for a date (resets to available)"""
    db = get_database()
    
    user_id = current_user.get("id") or str(current_user.get("_id"))
    
    result = await db.pilot_availability.delete_one({
        "pilot_id": user_id,
        "date": date
    })
    
    return {
        "message": "Availability cleared" if result.deleted_count > 0 else "No entry found",
        "date": date
    }


# Operator endpoint to view all pilots availability
@router.get("/all-pilots")
async def get_all_pilots_availability(
    date: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get availability of all pilots (for operators)"""
    db = get_database()
    
    user_roles = current_user.get("roles", [])
    if "operator" not in user_roles and "admin" not in user_roles:
        raise HTTPException(status_code=403, detail="Operator/Admin access required")
    
    # Build date query
    if date:
        date_query = {"date": date}
    elif start_date and end_date:
        date_query = {"date": {"$gte": start_date, "$lte": end_date}}
    else:
        # Default to today
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        date_query = {"date": today}
    
    # Get all pilots
    pilots = await db.users.find(
        {"roles": "pilot"},
        {"_id": 0, "id": 1, "full_name": 1, "email": 1, "license_number": 1}
    ).to_list(100)
    
    # Get availability entries
    availability = await db.pilot_availability.find(
        date_query,
        {"_id": 0}
    ).to_list(500)
    
    # Build availability map
    avail_map = {}
    for entry in availability:
        key = f"{entry['pilot_id']}_{entry['date']}"
        avail_map[key] = entry
    
    # Combine with pilot info
    result = []
    for pilot in pilots:
        pilot_avail = {
            "pilot_id": pilot["id"],
            "pilot_name": pilot.get("full_name", "Unknown"),
            "license": pilot.get("license_number", "N/A"),
            "availability": []
        }
        
        if date:
            key = f"{pilot['id']}_{date}"
            entry = avail_map.get(key, {"status": "available", "date": date})
            pilot_avail["availability"].append(entry)
        else:
            # Multiple dates
            for entry in availability:
                if entry.get("pilot_id") == pilot["id"]:
                    pilot_avail["availability"].append(entry)
        
        result.append(pilot_avail)
    
    return {
        "pilots": result,
        "total_pilots": len(pilots)
    }
