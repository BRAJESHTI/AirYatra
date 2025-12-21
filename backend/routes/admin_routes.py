from fastapi import APIRouter, HTTPException, Depends
from database import get_database
from middleware import get_current_user, require_roles
from models import UserRole
import uuid
from datetime import datetime
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["Admin"])

@router.get("/dashboard")
async def get_admin_dashboard(user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))):
    """Get admin dashboard statistics"""
    db = get_database()
    
    # Get statistics
    total_bookings = await db.bookings.count_documents({})
    total_operators = await db.operators.count_documents({})
    total_customers = await db.users.count_documents({"roles": "customer"})
    pending_approvals = await db.operators.count_documents({"verification_status": "pending"})
    
    # Recent bookings
    recent_bookings = await db.bookings.find({}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    
    return {
        "statistics": {
            "total_bookings": total_bookings,
            "total_operators": total_operators,
            "total_customers": total_customers,
            "pending_approvals": pending_approvals
        },
        "recent_bookings": recent_bookings
    }

@router.get("/operators")
async def get_all_operators(user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))):
    """Get all operators"""
    db = get_database()
    
    operators = await db.operators.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"operators": operators}

@router.post("/operators/{operator_id}/verify")
async def verify_operator(operator_id: str, data: dict, user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))):
    """Verify/Approve operator"""
    db = get_database()
    
    operator = await db.operators.find_one({"id": operator_id}, {"_id": 0})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    
    await db.operators.update_one(
        {"id": operator_id},
        {"$set": {
            "verification_status": data["status"],
            "status": "active" if data["status"] == "approved" else "pending",
            "verified_by": user["id"],
            "verified_at": datetime.utcnow().isoformat(),
            "verification_notes": data.get("notes", ""),
            "updated_at": datetime.utcnow().isoformat()
        }}
    )
    
    # Log action
    audit_log = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "action": "operator_verification",
        "entity_type": "operator",
        "entity_id": operator_id,
        "changes": {"status": data["status"]},
        "created_at": datetime.utcnow().isoformat()
    }
    await db.audit_logs.insert_one(audit_log)
    
    return {"message": f"Operator {data['status']}"}

@router.get("/bookings")
async def get_all_bookings(user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))):
    """Get all bookings"""
    db = get_database()
    
    bookings = await db.bookings.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"bookings": bookings}

@router.post("/bookings/{booking_id}/reassign")
async def reassign_booking(booking_id: str, data: dict, user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))):
    """Reassign booking to another operator"""
    db = get_database()
    
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "operator_id": data["operator_id"],
            "reassigned_by": user["id"],
            "reassigned_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }}
    )
    
    return {"message": "Booking reassigned"}

@router.get("/audit-logs")
async def get_audit_logs(user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))):
    """Get audit logs"""
    db = get_database()
    
    logs = await db.audit_logs.find({}, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
    return {"logs": logs}

@router.post("/users")
async def create_internal_user(user_data: dict, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN]))):
    """Create internal user (Admin/Regional Manager)"""
    from auth import get_password_hash
    db = get_database()
    
    existing_user = await db.users.find_one({"email": user_data["email"]}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    new_user = {
        "id": str(uuid.uuid4()),
        "email": user_data["email"],
        "password_hash": get_password_hash(user_data["password"]),
        "full_name": user_data["full_name"],
        "phone": user_data["phone"],
        "roles": user_data["roles"],
        "region": user_data.get("region"),
        "is_active": True,
        "created_by": user["id"],
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    
    await db.users.insert_one(new_user)
    
    return {"message": "User created", "user_id": new_user["id"]}