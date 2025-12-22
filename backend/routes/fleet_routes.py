from fastapi import APIRouter, HTTPException, Depends
from database import get_database
from models import Aircraft
from middleware import get_current_user
import uuid
from datetime import datetime

router = APIRouter(prefix="/fleet", tags=["Fleet Management"])

@router.post("/")
async def create_aircraft(aircraft_data: dict, user: dict = Depends(get_current_user)):
    """Add aircraft to fleet (Operator only)"""
    db = get_database()
    
    if "operator" not in user["roles"]:
        raise HTTPException(status_code=403, detail="Operator access required")
    
    operator = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator profile not found")
    
    aircraft_id = str(uuid.uuid4())
    aircraft = {
        "id": aircraft_id,
        "operator_id": operator["id"],
        "aircraft_type": aircraft_data["aircraft_type"],
        "registration_number": aircraft_data["registration_number"],
        "capacity": aircraft_data["capacity"],
        "base_location": aircraft_data["base_location"],
        "hourly_rate": aircraft_data["hourly_rate"],
        "is_available": True,
        "maintenance_status": "operational",
        "documents": [],
        "enrollment_odometer_km": aircraft_data.get("enrollment_odometer_km", 0),
        "current_total_km": aircraft_data.get("enrollment_odometer_km", 0),
        "total_flight_hours": 0,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    
    await db.aircraft.insert_one(aircraft.copy())
    
    return {"message": "Aircraft added", "aircraft": aircraft}

@router.get("/")
async def get_fleet(user: dict = Depends(get_current_user)):
    """Get operator's fleet"""
    db = get_database()
    
    if "operator" not in user["roles"]:
        raise HTTPException(status_code=403, detail="Operator access required")
    
    operator = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0})
    if not operator:
        return {"aircraft": []}
    
    aircraft = await db.aircraft.find({"operator_id": operator["id"]}, {"_id": 0}).to_list(100)
    return {"aircraft": aircraft}

@router.put("/{aircraft_id}")
async def update_aircraft(aircraft_id: str, aircraft_data: dict, user: dict = Depends(get_current_user)):
    """Update aircraft details"""
    db = get_database()
    
    if "operator" not in user["roles"]:
        raise HTTPException(status_code=403, detail="Operator access required")
    
    operator = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator profile not found")
    
    aircraft = await db.aircraft.find_one({"id": aircraft_id, "operator_id": operator["id"]}, {"_id": 0})
    if not aircraft:
        raise HTTPException(status_code=404, detail="Aircraft not found")
    
    update_data = aircraft_data.copy()
    update_data["updated_at"] = datetime.utcnow().isoformat()
    
    await db.aircraft.update_one(
        {"id": aircraft_id},
        {"$set": update_data}
    )
    
    return {"message": "Aircraft updated"}

@router.delete("/{aircraft_id}")
async def delete_aircraft(aircraft_id: str, user: dict = Depends(get_current_user)):
    """Delete aircraft from fleet"""
    db = get_database()
    
    if "operator" not in user["roles"]:
        raise HTTPException(status_code=403, detail="Operator access required")
    
    operator = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator profile not found")
    
    result = await db.aircraft.delete_one({"id": aircraft_id, "operator_id": operator["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Aircraft not found")
    
    return {"message": "Aircraft deleted"}

@router.get("/{aircraft_id}/statistics")
async def get_aircraft_statistics(aircraft_id: str, user: dict = Depends(get_current_user)):
    """Get aircraft statistics (flights, fuel, KM)"""
    db = get_database()
    
    if "operator" not in user["roles"]:
        raise HTTPException(status_code=403, detail="Operator access required")
    
    aircraft = await db.aircraft.find_one({"id": aircraft_id}, {"_id": 0})
    if not aircraft:
        raise HTTPException(status_code=404, detail="Aircraft not found")
    
    # Get flight records
    flight_records = await db.flight_records.find({"aircraft_id": aircraft_id}, {"_id": 0}).to_list(100)
    
    # Get fuel records
    fuel_records = await db.fuel_records.find({"aircraft_id": aircraft_id}, {"_id": 0}).to_list(100)
    
    total_flights = len(flight_records)
    total_fuel_used = sum([record.get("fuel_used_liters", 0) for record in flight_records])
    total_fuel_refilled = sum([record.get("fuel_amount_liters", 0) for record in fuel_records])
    
    return {
        "aircraft": aircraft,
        "statistics": {
            "total_flights": total_flights,
            "total_flight_hours": aircraft.get("total_flight_hours", 0),
            "enrollment_odometer_km": aircraft.get("enrollment_odometer_km", 0),
            "current_total_km": aircraft.get("current_total_km", 0),
            "km_since_enrollment": aircraft.get("current_total_km", 0) - aircraft.get("enrollment_odometer_km", 0),
            "total_fuel_used_liters": total_fuel_used,
            "total_fuel_refilled_liters": total_fuel_refilled
        },
        "recent_flights": flight_records[-10:] if len(flight_records) > 0 else [],
        "recent_fuel_records": fuel_records[-10:] if len(fuel_records) > 0 else []
    }