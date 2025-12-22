from fastapi import APIRouter, HTTPException, Depends
from database import get_database
from models import Operator, OperatorStatus, ApprovalStatus
from middleware import get_current_user
import uuid
from datetime import datetime
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/operator", tags=["Operator"])

@router.post("/profile")
async def create_operator_profile(profile_data: dict, user: dict = Depends(get_current_user)):
    """Create operator profile"""
    db = get_database()
    
    if "operator" not in user["roles"]:
        raise HTTPException(status_code=403, detail="Operator role required")
    
    # Check if profile already exists
    existing = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Operator profile already exists")
    
    operator_id = str(uuid.uuid4())
    operator = {
        "id": operator_id,
        "user_id": user["id"],
        "company_name": profile_data["company_name"],
        "base_city": profile_data["base_city"],
        "contact_person": profile_data["contact_person"],
        "contact_phone": profile_data["contact_phone"],
        "contact_email": profile_data["contact_email"],
        "gstin": profile_data.get("gstin"),
        "bank_account": profile_data.get("bank_account"),
        "status": OperatorStatus.PENDING.value,
        "verification_status": ApprovalStatus.PENDING.value,
        "documents": [],
        "commission_rate": 10.0,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    
    await db.operators.insert_one(operator.copy())
    
    return {"message": "Operator profile created", "operator": operator}

@router.get("/profile")
async def get_operator_profile(user: dict = Depends(get_current_user)):
    """Get operator profile"""
    db = get_database()
    
    if "operator" not in user["roles"]:
        raise HTTPException(status_code=403, detail="Operator role required")
    
    operator = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0})
    
    if not operator:
        return {"operator": None, "has_profile": False}
    
    return {"operator": operator, "has_profile": True}

@router.put("/profile")
async def update_operator_profile(profile_data: dict, user: dict = Depends(get_current_user)):
    """Update operator profile"""
    db = get_database()
    
    if "operator" not in user["roles"]:
        raise HTTPException(status_code=403, detail="Operator role required")
    
    operator = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator profile not found")
    
    update_data = profile_data.copy()
    update_data["updated_at"] = datetime.utcnow().isoformat()
    
    await db.operators.update_one(
        {"user_id": user["id"]},
        {"$set": update_data}
    )
    
    return {"message": "Profile updated successfully"}

@router.get("/dashboard")
async def get_operator_dashboard(user: dict = Depends(get_current_user)):
    """Get operator dashboard statistics"""
    db = get_database()
    
    if "operator" not in user["roles"]:
        raise HTTPException(status_code=403, detail="Operator role required")
    
    operator = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0})
    if not operator:
        return {"has_profile": False}
    
    # Get statistics
    total_aircraft = await db.aircraft.count_documents({"operator_id": operator["id"]})
    total_pilots = await db.pilots.count_documents({"operator_id": operator["id"]}) if "pilots" in await db.list_collection_names() else 0
    pending_inquiries = await db.inquiries.count_documents({"operator_id": operator["id"], "status": "pending"}) if "inquiries" in await db.list_collection_names() else 0
    total_bookings = await db.bookings.count_documents({"operator_id": operator["id"]})
    
    # Get recent bookings
    recent_bookings = await db.bookings.find(
        {"operator_id": operator["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    return {
        "has_profile": True,
        "operator": operator,
        "statistics": {
            "total_aircraft": total_aircraft,
            "total_pilots": total_pilots,
            "pending_inquiries": pending_inquiries,
            "total_bookings": total_bookings
        },
        "recent_bookings": recent_bookings
    }

@router.post("/pilots")
async def create_pilot(pilot_data: dict, user: dict = Depends(get_current_user)):
    """Add pilot to operator"""
    db = get_database()
    
    if "operator" not in user["roles"]:
        raise HTTPException(status_code=403, detail="Operator role required")
    
    operator = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator profile not found")
    
    pilot_id = str(uuid.uuid4())
    pilot = {
        "id": pilot_id,
        "operator_id": operator["id"],
        "full_name": pilot_data["full_name"],
        "license_number": pilot_data["license_number"],
        "phone": pilot_data["phone"],
        "email": pilot_data["email"],
        "experience_years": pilot_data["experience_years"],
        "is_available": True,
        "documents": [],
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    
    await db.pilots.insert_one(pilot.copy())
    
    return {"message": "Pilot added successfully", "pilot": pilot}

@router.get("/pilots")
async def get_pilots(user: dict = Depends(get_current_user)):
    """Get all pilots for operator"""
    db = get_database()
    
    if "operator" not in user["roles"]:
        raise HTTPException(status_code=403, detail="Operator role required")
    
    operator = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0})
    if not operator:
        return {"pilots": []}
    
    pilots = await db.pilots.find({"operator_id": operator["id"]}, {"_id": 0}).to_list(100)
    return {"pilots": pilots}

@router.put("/pilots/{pilot_id}")
async def update_pilot(pilot_id: str, pilot_data: dict, user: dict = Depends(get_current_user)):
    """Update pilot details"""
    db = get_database()
    
    if "operator" not in user["roles"]:
        raise HTTPException(status_code=403, detail="Operator role required")
    
    operator = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator profile not found")
    
    pilot = await db.pilots.find_one({"id": pilot_id, "operator_id": operator["id"]}, {"_id": 0})
    if not pilot:
        raise HTTPException(status_code=404, detail="Pilot not found")
    
    update_data = pilot_data.copy()
    update_data["updated_at"] = datetime.utcnow().isoformat()
    
    await db.pilots.update_one(
        {"id": pilot_id},
        {"$set": update_data}
    )
    
    return {"message": "Pilot updated successfully"}

@router.delete("/pilots/{pilot_id}")
async def delete_pilot(pilot_id: str, user: dict = Depends(get_current_user)):
    """Delete pilot"""
    db = get_database()
    
    if "operator" not in user["roles"]:
        raise HTTPException(status_code=403, detail="Operator role required")
    
    operator = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator profile not found")
    
    result = await db.pilots.delete_one({"id": pilot_id, "operator_id": operator["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pilot not found")
    
    return {"message": "Pilot deleted successfully"}