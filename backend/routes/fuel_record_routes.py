from fastapi import APIRouter, HTTPException, Depends
from database import get_database
from middleware import get_current_user
import uuid
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/fuel-records", tags=["Fuel Records"])

@router.post("/")
async def create_fuel_record(fuel_data: dict, user: dict = Depends(get_current_user)):
    """Create fuel refilling record (Pilot can log)"""
    db = get_database()
    
    fuel_id = str(uuid.uuid4())
    fuel_record = {
        "id": fuel_id,
        "aircraft_id": fuel_data["aircraft_id"],
        "refilled_by": user["id"],
        "refilled_by_name": user["full_name"],
        "location": fuel_data["location"],
        "fuel_amount_liters": fuel_data["fuel_amount_liters"],
        "fuel_type": fuel_data.get("fuel_type", "Jet-A1"),
        "cost_per_liter": fuel_data.get("cost_per_liter"),
        "total_cost": fuel_data.get("cost_per_liter", 0) * fuel_data["fuel_amount_liters"],
        "odometer_reading_km": fuel_data.get("odometer_reading_km"),
        "remarks": fuel_data.get("remarks"),
        "refill_date": fuel_data.get("refill_date", datetime.now(timezone.utc).isoformat()),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.fuel_records.insert_one(fuel_record.copy())
    
    return {"message": "Fuel record created", "record": fuel_record}

@router.get("/aircraft/{aircraft_id}")
async def get_aircraft_fuel_records(aircraft_id: str, user: dict = Depends(get_current_user)):
    """Get fuel records for an aircraft"""
    db = get_database()
    
    records = await db.fuel_records.find(
        {"aircraft_id": aircraft_id},
        {"_id": 0}
    ).sort("refill_date", -1).to_list(100)
    
    total_fuel_refilled = sum([r.get("fuel_amount_liters", 0) for r in records])
    total_cost = sum([r.get("total_cost", 0) for r in records])
    
    return {
        "records": records,
        "summary": {
            "total_refills": len(records),
            "total_fuel_liters": total_fuel_refilled,
            "total_cost": total_cost
        }
    }

@router.delete("/{fuel_id}")
async def delete_fuel_record(fuel_id: str, user: dict = Depends(get_current_user)):
    """Delete fuel record"""
    db = get_database()
    
    result = await db.fuel_records.delete_one({"id": fuel_id, "refilled_by": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Fuel record not found")
    
    return {"message": "Fuel record deleted"}