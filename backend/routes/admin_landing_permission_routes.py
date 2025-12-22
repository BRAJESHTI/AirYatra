from fastapi import APIRouter, HTTPException, Depends
from database import get_database
from middleware import get_current_user, require_roles
from models import UserRole
import uuid
from datetime import datetime
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/landing-permissions", tags=["Admin - Landing Permissions"])

@router.get("/pending")
async def get_pending_landing_permissions(user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.REGIONAL_MANAGER]))):
    """Get all pending landing permission requests"""
    db = get_database()
    
    # Regional managers only see their region
    query = {"approval_status": "pending"}
    if "regional_manager" in user.get("roles", []) and user.get("region"):
        # Filter by region if regional manager
        query["state"] = user["region"]
    
    permissions = await db.landing_permissions.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Enrich with booking and customer details
    for permission in permissions:
        booking = await db.bookings.find_one({"id": permission["booking_id"]}, {"_id": 0})
        if booking:
            permission["booking_details"] = {
                "booking_number": booking.get("booking_number"),
                "from_location": booking.get("from_location"),
                "to_location": booking.get("to_location"),
                "departure_date": booking.get("departure_date")
            }
        
        customer = await db.users.find_one({"id": permission["customer_id"]}, {"_id": 0})
        if customer:
            permission["customer_name"] = customer.get("full_name")
            permission["customer_phone"] = customer.get("phone")
    
    return {"pending_permissions": permissions}

@router.post("/{permission_id}/approve")
async def approve_landing_permission(permission_id: str, data: dict, user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.REGIONAL_MANAGER]))):
    """Approve landing permission"""
    db = get_database()
    
    permission = await db.landing_permissions.find_one({"id": permission_id}, {"_id": 0})
    if not permission:
        raise HTTPException(status_code=404, detail="Landing permission not found")
    
    notes = data.get("notes", "")
    expiry_date = data.get("expiry_date")  # Optional expiry date for the permission
    
    await db.landing_permissions.update_one(
        {"id": permission_id},
        {"$set": {
            "approval_status": "approved",
            "approved_by": user["id"],
            "approved_by_name": user["full_name"],
            "approved_at": datetime.utcnow().isoformat(),
            "approval_notes": notes,
            "expiry_date": expiry_date,
            "updated_at": datetime.utcnow().isoformat()
        }}
    )
    
    # Log action
    audit_log = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user["full_name"],
        "action": "landing_permission_approved",
        "entity_type": "landing_permission",
        "entity_id": permission_id,
        "changes": {"status": "approved", "notes": notes},
        "created_at": datetime.utcnow().isoformat()
    }
    await db.audit_logs.insert_one(audit_log.copy())
    
    return {"message": "Landing permission approved"}

@router.post("/{permission_id}/reject")
async def reject_landing_permission(permission_id: str, data: dict, user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.REGIONAL_MANAGER]))):
    """Reject landing permission"""
    db = get_database()
    
    permission = await db.landing_permissions.find_one({"id": permission_id}, {"_id": 0})
    if not permission:
        raise HTTPException(status_code=404, detail="Landing permission not found")
    
    reason = data.get("reason", "")
    
    if not reason:
        raise HTTPException(status_code=400, detail="Rejection reason is required")
    
    await db.landing_permissions.update_one(
        {"id": permission_id},
        {"$set": {
            "approval_status": "rejected",
            "rejected_by": user["id"],
            "rejected_by_name": user["full_name"],
            "rejected_at": datetime.utcnow().isoformat(),
            "rejection_reason": reason,
            "updated_at": datetime.utcnow().isoformat()
        }}
    )
    
    # Log action
    audit_log = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user["full_name"],
        "action": "landing_permission_rejected",
        "entity_type": "landing_permission",
        "entity_id": permission_id,
        "changes": {"status": "rejected", "reason": reason},
        "created_at": datetime.utcnow().isoformat()
    }
    await db.audit_logs.insert_one(audit_log.copy())
    
    return {"message": "Landing permission rejected", "reason": reason}