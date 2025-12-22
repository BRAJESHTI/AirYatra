from fastapi import APIRouter, HTTPException, Depends
from database import get_database
from middleware import get_current_user
import uuid
from datetime import datetime
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/flight-records", tags=["Flight Records"])

@router.post("/")
async def create_flight_record(record_data: dict, user: dict = Depends(get_current_user)):
    """Create flight record (Pilot/Operator can create)"""
    db = get_database()
    
    if "operator" not in user["roles"] and "pilot" not in user.get("roles", []):
        raise HTTPException(status_code=403, detail="Operator or pilot access required")
    
    record_id = str(uuid.uuid4())
    flight_record = {
        "id": record_id,
        "booking_id": record_data.get("booking_id"),
        "aircraft_id": record_data["aircraft_id"],
        "pilot_id": record_data["pilot_id"],
        "departure_location": record_data["departure_location"],
        "arrival_location": record_data["arrival_location"],
        "departure_time": record_data["departure_time"],
        "arrival_time": record_data.get("arrival_time"),
        "distance_km": record_data["distance_km"],
        "flight_duration_minutes": record_data.get("flight_duration_minutes"),
        "fuel_used_liters": record_data.get("fuel_used_liters", 0),
        "average_speed_kmh": record_data.get("average_speed_kmh"),
        "max_altitude_feet": record_data.get("max_altitude_feet"),
        "weather_conditions": record_data.get("weather_conditions"),
        "remarks": record_data.get("remarks"),
        "created_by": user["id"],
        "created_at": datetime.utcnow().isoformat()
    }
    
    await db.flight_records.insert_one(flight_record.copy())
    
    # Update aircraft total KM and hours
    aircraft = await db.aircraft.find_one({"id": record_data["aircraft_id"]}, {"_id": 0})
    if aircraft:
        new_total_km = aircraft.get("current_total_km", 0) + record_data["distance_km"]
        new_flight_hours = aircraft.get("total_flight_hours", 0) + (record_data.get("flight_duration_minutes", 0) / 60)
        
        await db.aircraft.update_one(
            {"id": record_data["aircraft_id"]},
            {"$set": {
                "current_total_km": new_total_km,
                "total_flight_hours": new_flight_hours,
                "updated_at": datetime.utcnow().isoformat()
            }}
        )
    
    return {"message": "Flight record created", "record": flight_record}

@router.get("/aircraft/{aircraft_id}")
async def get_aircraft_flight_records(aircraft_id: str, user: dict = Depends(get_current_user)):
    """Get all flight records for an aircraft"""
    db = get_database()
    
    records = await db.flight_records.find(
        {"aircraft_id": aircraft_id},
        {"_id": 0}
    ).sort("departure_time", -1).to_list(100)
    
    # Enrich with pilot details
    for record in records:
        if record.get("pilot_id"):
            pilot = await db.pilots.find_one({"id": record["pilot_id"]}, {"_id": 0})
            if pilot:
                record["pilot_name"] = pilot.get("full_name")
    
    return {"records": records}

@router.get("/booking/{booking_id}")
async def get_booking_flight_record(booking_id: str, user: dict = Depends(get_current_user)):
    """Get flight record for a booking"""
    db = get_database()
    
    record = await db.flight_records.find_one({"booking_id": booking_id}, {"_id": 0})
    
    if not record:
        return {"record": None}
    
    # Enrich with details
    if record.get("pilot_id"):
        pilot = await db.pilots.find_one({"id": record["pilot_id"]}, {"_id": 0})
        if pilot:
            record["pilot_name"] = pilot.get("full_name")
    
    if record.get("aircraft_id"):
        aircraft = await db.aircraft.find_one({"id": record["aircraft_id"]}, {"_id": 0})
        if aircraft:
            record["aircraft_type"] = aircraft.get("aircraft_type")
            record["registration_number"] = aircraft.get("registration_number")
    
    return {"record": record}