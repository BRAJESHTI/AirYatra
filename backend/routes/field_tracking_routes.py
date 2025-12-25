"""
Field Tracking Routes
GPS Location Tracking, Route History, Client Visits
"""
from fastapi import APIRouter, HTTPException, Depends, Query, WebSocket, WebSocketDisconnect
from typing import Optional, List, Dict
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from pydantic import BaseModel
from enum import Enum
from database import get_database
from middleware import get_current_user, require_roles
from models import UserRole
import json
import math

router = APIRouter(prefix="/field-tracking", tags=["Field Tracking"])


# ============== ENUMS ==============

class VisitStatus(str, Enum):
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"

class VisitType(str, Enum):
    CLIENT_MEETING = "client_meeting"
    SITE_VISIT = "site_visit"
    DELIVERY = "delivery"
    COLLECTION = "collection"
    DEMO = "demo"
    FOLLOW_UP = "follow_up"
    OTHER = "other"


# ============== HELPER FUNCTIONS ==============

def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points using Haversine formula"""
    R = 6371  # Earth's radius in km
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c


def is_within_geofence(lat, lon, target_lat, target_lon, radius_meters=100):
    """Check if point is within radius of target"""
    distance_km = calculate_distance(lat, lon, target_lat, target_lon)
    distance_meters = distance_km * 1000
    return distance_meters <= radius_meters


# ============== LOCATION TRACKING ==============

@router.post("/location/update")
async def update_location(
    location_data: dict,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Update employee's current location (called frequently from mobile app)"""
    location_id = str(uuid4())
    
    location = {
        "id": location_id,
        "employee_id": current_user["id"],
        "employee_name": current_user.get("full_name", current_user["email"]),
        "latitude": location_data["latitude"],
        "longitude": location_data["longitude"],
        "accuracy": location_data.get("accuracy"),
        "altitude": location_data.get("altitude"),
        "speed": location_data.get("speed"),  # m/s
        "heading": location_data.get("heading"),  # degrees
        "address": location_data.get("address", ""),
        "battery_level": location_data.get("battery_level"),
        "is_charging": location_data.get("is_charging"),
        "network_type": location_data.get("network_type"),  # wifi, 4g, 5g
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "date": datetime.now(timezone.utc).date().isoformat()
    }
    
    # Save to location history
    await db.location_history.insert_one(location)
    
    # Update current location
    await db.employee_current_location.update_one(
        {"employee_id": current_user["id"]},
        {"$set": location},
        upsert=True
    )
    
    # Check for any scheduled visits and auto-update if within geofence
    today = datetime.now(timezone.utc).date().isoformat()
    scheduled_visits = await db.field_visits.find({
        "employee_id": current_user["id"],
        "date": today,
        "status": {"$in": ["scheduled", "in_progress"]}
    }).to_list(10)
    
    for visit in scheduled_visits:
        if visit.get("client_latitude") and visit.get("client_longitude"):
            if is_within_geofence(
                location["latitude"], location["longitude"],
                visit["client_latitude"], visit["client_longitude"],
                radius_meters=visit.get("geofence_radius", 100)
            ):
                # Auto check-in if not already
                if visit["status"] == "scheduled":
                    await db.field_visits.update_one(
                        {"id": visit["id"]},
                        {"$set": {
                            "status": "in_progress",
                            "actual_arrival_time": location["timestamp"],
                            "arrival_location": {
                                "latitude": location["latitude"],
                                "longitude": location["longitude"]
                            }
                        }}
                    )
    
    return {"message": "Location updated", "location_id": location_id}


@router.get("/location/current")
async def get_current_locations(
    department: Optional[str] = None,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OPERATOR])),
    db=Depends(get_database)
):
    """Get current locations of all field employees (Admin/Manager)"""
    query = {}
    if department:
        # First get employee IDs from that department
        employees = await db.users.find({"department": department}, {"id": 1}).to_list(500)
        emp_ids = [e["id"] for e in employees]
        query["employee_id"] = {"$in": emp_ids}
    
    locations = await db.employee_current_location.find(query, {"_id": 0}).to_list(500)
    
    return {"locations": locations, "count": len(locations)}


@router.get("/location/history/{employee_id}")
async def get_location_history(
    employee_id: str,
    date: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get location history for an employee"""
    # Check authorization
    if current_user["id"] != employee_id and current_user.get("role") not in ["admin", "super_admin", "sales_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if not date:
        date = datetime.now(timezone.utc).date().isoformat()
    
    locations = await db.location_history.find({
        "employee_id": employee_id,
        "date": date
    }, {"_id": 0}).sort("timestamp", 1).to_list(1000)
    
    # Calculate total distance traveled
    total_distance = 0
    if len(locations) > 1:
        for i in range(1, len(locations)):
            dist = calculate_distance(
                locations[i-1]["latitude"], locations[i-1]["longitude"],
                locations[i]["latitude"], locations[i]["longitude"]
            )
            total_distance += dist
    
    return {
        "employee_id": employee_id,
        "date": date,
        "locations": locations,
        "total_points": len(locations),
        "total_distance_km": round(total_distance, 2)
    }


@router.get("/location/route/{employee_id}")
async def get_route_for_date(
    employee_id: str,
    date: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get route/path for map display"""
    # Check authorization
    if current_user["id"] != employee_id and current_user.get("role") not in ["admin", "super_admin", "sales_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if not date:
        date = datetime.now(timezone.utc).date().isoformat()
    
    locations = await db.location_history.find({
        "employee_id": employee_id,
        "date": date
    }, {"_id": 0, "latitude": 1, "longitude": 1, "timestamp": 1, "address": 1}).sort("timestamp", 1).to_list(1000)
    
    # Convert to route format for map
    route = []
    for loc in locations:
        route.append({
            "lat": loc["latitude"],
            "lng": loc["longitude"],
            "time": loc["timestamp"],
            "address": loc.get("address", "")
        })
    
    return {
        "employee_id": employee_id,
        "date": date,
        "route": route,
        "start_point": route[0] if route else None,
        "end_point": route[-1] if route else None
    }


# ============== FIELD VISITS ==============

@router.post("/visits")
async def create_field_visit(
    visit_data: dict,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Create a scheduled field visit"""
    visit_id = str(uuid4())
    
    visit = {
        "id": visit_id,
        "employee_id": visit_data.get("employee_id", current_user["id"]),
        "employee_name": current_user.get("full_name", current_user["email"]),
        
        # Client Info
        "client_name": visit_data["client_name"],
        "client_phone": visit_data.get("client_phone"),
        "client_email": visit_data.get("client_email"),
        "client_address": visit_data.get("client_address", ""),
        "client_latitude": visit_data.get("client_latitude"),
        "client_longitude": visit_data.get("client_longitude"),
        
        # Visit Details
        "lead_id": visit_data.get("lead_id"),
        "visit_type": visit_data.get("visit_type", VisitType.CLIENT_MEETING.value),
        "purpose": visit_data.get("purpose", ""),
        "date": visit_data["date"],
        "scheduled_time": visit_data.get("scheduled_time"),
        "expected_duration_minutes": visit_data.get("expected_duration_minutes", 60),
        
        # Geofencing
        "geofence_radius": visit_data.get("geofence_radius", 100),  # meters
        "require_photo": visit_data.get("require_photo", False),
        
        # Status
        "status": VisitStatus.SCHEDULED.value,
        "actual_arrival_time": None,
        "actual_departure_time": None,
        "arrival_location": None,
        "departure_location": None,
        "duration_minutes": None,
        "distance_from_client": None,
        
        # Notes & Outcome
        "pre_visit_notes": visit_data.get("notes", ""),
        "post_visit_notes": None,
        "outcome": None,
        "follow_up_required": False,
        "follow_up_date": None,
        "photos": [],
        
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.field_visits.insert_one(visit)
    
    return {"message": "Field visit scheduled / फील्ड विजिट शेड्यूल हो गई", "visit_id": visit_id}


@router.get("/visits")
async def get_field_visits(
    date: Optional[str] = None,
    status: Optional[str] = None,
    employee_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get field visits"""
    query = {}
    
    # Non-admin can only see their own visits
    if current_user.get("role") not in ["admin", "super_admin", "sales_manager"]:
        query["employee_id"] = current_user["id"]
    elif employee_id:
        query["employee_id"] = employee_id
    
    if date:
        query["date"] = date
    if status:
        query["status"] = status
    
    visits = await db.field_visits.find(query, {"_id": 0}).sort("date", -1).to_list(100)
    
    return {"visits": visits, "count": len(visits)}


@router.post("/visits/{visit_id}/check-in")
async def visit_check_in(
    visit_id: str,
    check_in_data: dict,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Check-in at client location"""
    visit = await db.field_visits.find_one({"id": visit_id})
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    
    if visit["employee_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Calculate distance from client location
    distance_from_client = None
    if visit.get("client_latitude") and visit.get("client_longitude"):
        distance_from_client = calculate_distance(
            check_in_data["latitude"], check_in_data["longitude"],
            visit["client_latitude"], visit["client_longitude"]
        ) * 1000  # Convert to meters
    
    await db.field_visits.update_one(
        {"id": visit_id},
        {"$set": {
            "status": VisitStatus.IN_PROGRESS.value,
            "actual_arrival_time": datetime.now(timezone.utc).isoformat(),
            "arrival_location": {
                "latitude": check_in_data["latitude"],
                "longitude": check_in_data["longitude"],
                "accuracy": check_in_data.get("accuracy"),
                "address": check_in_data.get("address", "")
            },
            "distance_from_client": round(distance_from_client, 2) if distance_from_client else None
        }}
    )
    
    # Check geofence
    within_geofence = True
    if distance_from_client and distance_from_client > visit.get("geofence_radius", 100):
        within_geofence = False
    
    return {
        "message": "Check-in successful / चेक-इन सफल",
        "arrival_time": datetime.now(timezone.utc).isoformat(),
        "distance_from_client_meters": round(distance_from_client, 2) if distance_from_client else None,
        "within_geofence": within_geofence,
        "geofence_warning": None if within_geofence else f"You are {round(distance_from_client, 0)}m away from client location"
    }


@router.post("/visits/{visit_id}/check-out")
async def visit_check_out(
    visit_id: str,
    check_out_data: dict,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Check-out from client location"""
    visit = await db.field_visits.find_one({"id": visit_id})
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    
    if visit["employee_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    departure_time = datetime.now(timezone.utc)
    arrival_time = datetime.fromisoformat(visit["actual_arrival_time"].replace('Z', '+00:00'))
    duration_minutes = (departure_time - arrival_time).total_seconds() / 60
    
    await db.field_visits.update_one(
        {"id": visit_id},
        {"$set": {
            "status": VisitStatus.COMPLETED.value,
            "actual_departure_time": departure_time.isoformat(),
            "departure_location": {
                "latitude": check_out_data["latitude"],
                "longitude": check_out_data["longitude"],
                "accuracy": check_out_data.get("accuracy"),
                "address": check_out_data.get("address", "")
            },
            "duration_minutes": round(duration_minutes, 2),
            "post_visit_notes": check_out_data.get("notes", ""),
            "outcome": check_out_data.get("outcome", ""),
            "follow_up_required": check_out_data.get("follow_up_required", False),
            "follow_up_date": check_out_data.get("follow_up_date")
        }}
    )
    
    return {
        "message": "Check-out successful / चेक-आउट सफल",
        "departure_time": departure_time.isoformat(),
        "duration_minutes": round(duration_minutes, 2)
    }


@router.post("/visits/{visit_id}/photo")
async def add_visit_photo(
    visit_id: str,
    photo_data: dict,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Add photo to field visit"""
    visit = await db.field_visits.find_one({"id": visit_id})
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    
    photo = {
        "id": str(uuid4()),
        "url": photo_data["url"],
        "caption": photo_data.get("caption", ""),
        "taken_at": datetime.now(timezone.utc).isoformat(),
        "location": {
            "latitude": photo_data.get("latitude"),
            "longitude": photo_data.get("longitude")
        }
    }
    
    await db.field_visits.update_one(
        {"id": visit_id},
        {"$push": {"photos": photo}}
    )
    
    return {"message": "Photo added", "photo_id": photo["id"]}


# ============== DAILY SUMMARY ==============

@router.get("/daily-summary/{employee_id}")
async def get_daily_summary(
    employee_id: str,
    date: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get daily field activity summary"""
    # Check authorization
    if current_user["id"] != employee_id and current_user.get("role") not in ["admin", "super_admin", "sales_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if not date:
        date = datetime.now(timezone.utc).date().isoformat()
    
    # Get visits for the day
    visits = await db.field_visits.find({
        "employee_id": employee_id,
        "date": date
    }, {"_id": 0}).to_list(50)
    
    # Get location history
    locations = await db.location_history.find({
        "employee_id": employee_id,
        "date": date
    }, {"_id": 0}).sort("timestamp", 1).to_list(1000)
    
    # Calculate stats
    total_distance = 0
    if len(locations) > 1:
        for i in range(1, len(locations)):
            dist = calculate_distance(
                locations[i-1]["latitude"], locations[i-1]["longitude"],
                locations[i]["latitude"], locations[i]["longitude"]
            )
            total_distance += dist
    
    # Get attendance
    attendance = await db.attendance.find_one({
        "employee_id": employee_id,
        "date": date
    }, {"_id": 0})
    
    completed_visits = [v for v in visits if v["status"] == "completed"]
    total_visit_duration = sum(v.get("duration_minutes", 0) for v in completed_visits)
    
    return {
        "employee_id": employee_id,
        "date": date,
        "attendance": attendance,
        "visits": {
            "total": len(visits),
            "completed": len(completed_visits),
            "pending": len([v for v in visits if v["status"] == "scheduled"]),
            "cancelled": len([v for v in visits if v["status"] == "cancelled"]),
            "total_duration_minutes": round(total_visit_duration, 2)
        },
        "travel": {
            "total_distance_km": round(total_distance, 2),
            "location_points": len(locations),
            "first_location_time": locations[0]["timestamp"] if locations else None,
            "last_location_time": locations[-1]["timestamp"] if locations else None
        },
        "visit_details": visits
    }


@router.get("/team-dashboard")
async def get_team_field_dashboard(
    date: Optional[str] = None,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Get team field activity dashboard (Admin)"""
    if not date:
        date = datetime.now(timezone.utc).date().isoformat()
    
    # Get all field employees with current location
    locations = await db.employee_current_location.find({}, {"_id": 0}).to_list(500)
    
    # Get today's visits
    visits = await db.field_visits.find({"date": date}, {"_id": 0}).to_list(500)
    
    # Aggregate by employee
    employee_stats = {}
    for loc in locations:
        emp_id = loc["employee_id"]
        emp_visits = [v for v in visits if v["employee_id"] == emp_id]
        
        employee_stats[emp_id] = {
            "employee_id": emp_id,
            "employee_name": loc.get("employee_name"),
            "current_location": {
                "latitude": loc["latitude"],
                "longitude": loc["longitude"],
                "address": loc.get("address", ""),
                "last_update": loc.get("timestamp")
            },
            "battery_level": loc.get("battery_level"),
            "visits_today": len(emp_visits),
            "completed_visits": len([v for v in emp_visits if v["status"] == "completed"]),
            "in_progress": any(v["status"] == "in_progress" for v in emp_visits)
        }
    
    return {
        "date": date,
        "total_field_employees": len(locations),
        "total_visits_today": len(visits),
        "completed_visits": len([v for v in visits if v["status"] == "completed"]),
        "in_progress_visits": len([v for v in visits if v["status"] == "in_progress"]),
        "employees": list(employee_stats.values())
    }


# ============== GEOFENCE CONFIGURATION ==============

@router.post("/geofence")
async def create_geofence(
    geofence_data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Create a geofence zone (office, client site, etc.)"""
    geofence_id = str(uuid4())
    
    geofence = {
        "id": geofence_id,
        "name": geofence_data["name"],
        "type": geofence_data.get("type", "office"),  # office, client, restricted
        "latitude": geofence_data["latitude"],
        "longitude": geofence_data["longitude"],
        "radius_meters": geofence_data.get("radius_meters", 100),
        "address": geofence_data.get("address", ""),
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.geofences.insert_one(geofence)
    
    return {"message": "Geofence created / जियोफेंस बना", "geofence_id": geofence_id}


@router.get("/geofences")
async def get_geofences(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get all geofences"""
    geofences = await db.geofences.find({"active": True}, {"_id": 0}).to_list(100)
    return {"geofences": geofences}
