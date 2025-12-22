from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from database import get_database
from middleware import get_current_user

router = APIRouter(prefix="/regional-manager", tags=["Regional Manager"])

async def require_regional_manager(current_user: dict = Depends(get_current_user)):
    """Verify user has regional_manager role"""
    if 'regional_manager' not in current_user.get('roles', []) and 'admin' not in current_user.get('roles', []):
        raise HTTPException(status_code=403, detail="Regional Manager access required")
    return current_user

@router.get("/dashboard")
async def get_regional_dashboard(
    current_user: dict = Depends(require_regional_manager),
    db=Depends(get_database)
):
    """Get regional manager dashboard with statistics for assigned region"""
    # Get regional manager's assigned region
    rm_profile = await db.regional_managers.find_one({"user_id": current_user["id"]}, {"_id": 0})
    region = rm_profile.get("region") if rm_profile else None
    
    # Build region filter
    region_filter = {"region": region} if region else {}
    
    # Get statistics for the region
    operators = await db.operators.find(region_filter, {"_id": 0}).to_list(1000)
    bookings = await db.bookings.find({}, {"_id": 0}).to_list(1000)
    
    # Filter bookings by operators in region
    operator_ids = [op["id"] for op in operators]
    regional_bookings = [b for b in bookings if b.get("operator_id") in operator_ids]
    
    # Pending approvals in region
    pending_operators = [op for op in operators if op.get("verification_status") == "pending"]
    pending_permissions = await db.landing_permissions.count_documents(
        {"approval_status": "pending", "region": region} if region else {"approval_status": "pending"}
    )
    
    # Calculate revenue for region
    completed_bookings = [b for b in regional_bookings if b.get("status") == "completed"]
    total_revenue = sum(b.get("total_amount", 0) for b in completed_bookings)
    
    # Today's statistics
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_bookings = [b for b in regional_bookings if b.get("created_at") and datetime.fromisoformat(b["created_at"].replace('Z', '+00:00')) >= today]
    
    return {
        "region": region or "All Regions",
        "statistics": {
            "total_operators": len(operators),
            "active_operators": len([op for op in operators if op.get("status") == "active"]),
            "pending_operator_approvals": len(pending_operators),
            "total_bookings": len(regional_bookings),
            "today_bookings": len(today_bookings),
            "pending_landing_permissions": pending_permissions,
            "completed_bookings": len(completed_bookings),
        },
        "revenue": {
            "total_revenue": total_revenue,
            "average_booking_value": total_revenue / len(completed_bookings) if completed_bookings else 0,
        },
        "pending_operators": pending_operators[:10],
        "recent_bookings": regional_bookings[:10],
    }

@router.get("/operators")
async def get_regional_operators(
    status: Optional[str] = None,
    current_user: dict = Depends(require_regional_manager),
    db=Depends(get_database)
):
    """Get operators in regional manager's region"""
    rm_profile = await db.regional_managers.find_one({"user_id": current_user["id"]}, {"_id": 0})
    region = rm_profile.get("region") if rm_profile else None
    
    query = {}
    if region:
        query["region"] = region
    if status:
        query["status"] = status
    
    operators = await db.operators.find(query, {"_id": 0}).to_list(1000)
    
    # Enrich with statistics
    for op in operators:
        op["aircraft_count"] = await db.aircraft.count_documents({"operator_id": op["id"]})
        op["pilot_count"] = await db.pilots.count_documents({"operator_id": op["id"]})
        op["booking_count"] = await db.bookings.count_documents({"operator_id": op["id"]})
    
    return {"operators": operators, "region": region or "All"}

@router.post("/operators/{operator_id}/approve")
async def approve_operator(
    operator_id: str,
    notes: Optional[str] = None,
    current_user: dict = Depends(require_regional_manager),
    db=Depends(get_database)
):
    """Approve an operator (regional level approval)"""
    operator = await db.operators.find_one({"id": operator_id}, {"_id": 0})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    
    # Update operator with regional approval
    await db.operators.update_one(
        {"id": operator_id},
        {"$set": {
            "regional_approval_status": "approved",
            "regional_approved_by": current_user["id"],
            "regional_approved_at": datetime.now(timezone.utc).isoformat(),
            "regional_approval_notes": notes,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Log audit
    await db.audit_logs.insert_one({
        "id": str(uuid4()),
        "action": "regional_operator_approval",
        "entity_type": "operator",
        "entity_id": operator_id,
        "user_id": current_user["id"],
        "user_name": current_user.get("full_name"),
        "changes": {"regional_approval_status": "approved", "notes": notes},
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Operator approved at regional level", "operator_id": operator_id}

@router.post("/operators/{operator_id}/reject")
async def reject_operator(
    operator_id: str,
    reason: str,
    current_user: dict = Depends(require_regional_manager),
    db=Depends(get_database)
):
    """Reject an operator at regional level"""
    await db.operators.update_one(
        {"id": operator_id},
        {"$set": {
            "regional_approval_status": "rejected",
            "regional_rejected_by": current_user["id"],
            "regional_rejection_reason": reason,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Operator rejected at regional level", "reason": reason}

@router.get("/bookings")
async def get_regional_bookings(
    status: Optional[str] = None,
    current_user: dict = Depends(require_regional_manager),
    db=Depends(get_database)
):
    """Get bookings in regional manager's region"""
    rm_profile = await db.regional_managers.find_one({"user_id": current_user["id"]}, {"_id": 0})
    region = rm_profile.get("region") if rm_profile else None
    
    # Get operators in region
    operator_query = {"region": region} if region else {}
    operators = await db.operators.find(operator_query, {"_id": 0, "id": 1}).to_list(1000)
    operator_ids = [op["id"] for op in operators]
    
    # Get bookings for those operators
    booking_query = {"operator_id": {"$in": operator_ids}} if operator_ids else {}
    if status:
        booking_query["status"] = status
    
    bookings = await db.bookings.find(booking_query, {"_id": 0}).to_list(1000)
    
    return {"bookings": bookings, "total": len(bookings)}

@router.get("/landing-permissions")
async def get_regional_landing_permissions(
    status: Optional[str] = Query(default="pending"),
    current_user: dict = Depends(require_regional_manager),
    db=Depends(get_database)
):
    """Get landing permission requests for region"""
    rm_profile = await db.regional_managers.find_one({"user_id": current_user["id"]}, {"_id": 0})
    region = rm_profile.get("region") if rm_profile else None
    
    query = {}
    if region:
        query["region"] = region
    if status:
        query["approval_status"] = status
    
    permissions = await db.landing_permissions.find(query, {"_id": 0}).to_list(1000)
    
    return {"permissions": permissions, "total": len(permissions)}

@router.post("/landing-permissions/{permission_id}/approve")
async def approve_landing_permission(
    permission_id: str,
    notes: Optional[str] = None,
    current_user: dict = Depends(require_regional_manager),
    db=Depends(get_database)
):
    """Approve a landing permission request"""
    await db.landing_permissions.update_one(
        {"id": permission_id},
        {"$set": {
            "approval_status": "approved",
            "approved_by": current_user["id"],
            "approved_by_name": current_user.get("full_name"),
            "approval_notes": notes,
            "approved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Landing permission approved", "permission_id": permission_id}

@router.get("/profile")
async def get_regional_manager_profile(
    current_user: dict = Depends(require_regional_manager),
    db=Depends(get_database)
):
    """Get regional manager's profile"""
    profile = await db.regional_managers.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if not profile:
        # Create default profile
        profile = {
            "id": str(uuid4()),
            "user_id": current_user["id"],
            "region": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.regional_managers.insert_one(profile)
    
    return {"profile": profile, "user": current_user}
