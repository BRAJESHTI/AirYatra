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
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    
    await db.aircraft.insert_one(aircraft)
    
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