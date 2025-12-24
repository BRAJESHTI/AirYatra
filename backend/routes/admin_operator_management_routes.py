from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from datetime import datetime, timezone
from uuid import uuid4
from database import get_database
from middleware import get_current_user, require_roles
from models import UserRole, OperatorStatus
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/operators-management", tags=["Admin - Operator Management"])

# ============== SUSPENDED OPERATORS ==============

@router.get("/suspended")
async def get_suspended_operators(
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.REGIONAL_MANAGER]))
):
    """
    Get all suspended operators with suspension reasons
    निलंबित ऑपरेटर और कारण देखें
    """
    db = get_database()
    
    query = {"status": "suspended"}
    
    # Regional managers can only see their region's operators
    if "regional_manager" in user.get("roles", []) and user.get("region"):
        query["region"] = user["region"]
    
    operators = await db.operators.find(query, {"_id": 0}).sort("suspended_at", -1).to_list(100)
    
    # Enrich with user details and suspension history
    for op in operators:
        user_data = await db.users.find_one({"id": op["user_id"]}, {"_id": 0, "email": 1, "phone": 1, "full_name": 1})
        if user_data:
            op["user_email"] = user_data.get("email")
            op["user_phone"] = user_data.get("phone")
            op["user_name"] = user_data.get("full_name")
        
        # Get suspension history
        suspension_history = await db.operator_suspensions.find(
            {"operator_id": op["id"]},
            {"_id": 0}
        ).sort("created_at", -1).to_list(10)
        op["suspension_history"] = suspension_history
        
        # Get who suspended
        if op.get("suspended_by"):
            suspender = await db.users.find_one({"id": op["suspended_by"]}, {"_id": 0, "full_name": 1})
            op["suspended_by_name"] = suspender.get("full_name") if suspender else "Unknown"
    
    return {"suspended_operators": operators, "total": len(operators)}

@router.post("/{operator_id}/suspend")
async def suspend_operator(
    operator_id: str,
    data: dict,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """
    Suspend operator with reason
    ऑपरेटर को निलंबित करें
    """
    db = get_database()
    
    operator = await db.operators.find_one({"id": operator_id}, {"_id": 0})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    
    if operator.get("status") == "suspended":
        raise HTTPException(status_code=400, detail="Operator is already suspended")
    
    reason = data.get("reason", "")
    suspension_type = data.get("suspension_type", "temporary")  # temporary, permanent
    suspension_duration_days = data.get("duration_days")
    
    if not reason:
        raise HTTPException(status_code=400, detail="Suspension reason is required")
    
    # Calculate suspension end date if temporary
    suspension_end = None
    if suspension_type == "temporary" and suspension_duration_days:
        from datetime import timedelta
        suspension_end = (datetime.now(timezone.utc) + timedelta(days=suspension_duration_days)).isoformat()
    
    # Update operator status
    await db.operators.update_one(
        {"id": operator_id},
        {"$set": {
            "status": "suspended",
            "previous_status": operator.get("status"),
            "suspension_reason": reason,
            "suspension_type": suspension_type,
            "suspension_end_date": suspension_end,
            "suspended_by": user["id"],
            "suspended_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Create suspension record
    suspension_record = {
        "id": str(uuid4()),
        "operator_id": operator_id,
        "action": "suspended",
        "reason": reason,
        "suspension_type": suspension_type,
        "duration_days": suspension_duration_days,
        "suspension_end_date": suspension_end,
        "actioned_by": user["id"],
        "actioned_by_name": user["full_name"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.operator_suspensions.insert_one(suspension_record.copy())
    
    # Audit log
    await db.audit_logs.insert_one({
        "id": str(uuid4()),
        "user_id": user["id"],
        "user_name": user["full_name"],
        "action": "operator_suspended",
        "entity_type": "operator",
        "entity_id": operator_id,
        "changes": {
            "reason": reason,
            "type": suspension_type,
            "duration_days": suspension_duration_days
        },
        "is_critical": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Notify operator (TODO: Send email/SMS)
    await db.in_app_notifications.insert_one({
        "id": str(uuid4()),
        "user_id": operator["user_id"],
        "type": "operator_suspended",
        "title": "Account Suspended / खाता निलंबित",
        "message": f"Your operator account has been suspended. Reason: {reason}",
        "data": {"suspension_type": suspension_type, "end_date": suspension_end},
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "message": "Operator suspended successfully",
        "suspension_type": suspension_type,
        "suspension_end_date": suspension_end
    }

@router.post("/{operator_id}/activate")
async def activate_operator(
    operator_id: str,
    data: dict,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """
    Reactivate suspended operator
    निलंबित ऑपरेटर को पुनः सक्रिय करें
    """
    db = get_database()
    
    operator = await db.operators.find_one({"id": operator_id}, {"_id": 0})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    
    if operator.get("status") == "active":
        raise HTTPException(status_code=400, detail="Operator is already active")
    
    activation_notes = data.get("notes", "")
    
    # Update operator status
    await db.operators.update_one(
        {"id": operator_id},
        {"$set": {
            "status": "active",
            "suspension_reason": None,
            "suspension_type": None,
            "suspension_end_date": None,
            "suspended_by": None,
            "suspended_at": None,
            "reactivated_by": user["id"],
            "reactivated_at": datetime.now(timezone.utc).isoformat(),
            "reactivation_notes": activation_notes,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Create activation record
    activation_record = {
        "id": str(uuid4()),
        "operator_id": operator_id,
        "action": "activated",
        "reason": activation_notes,
        "actioned_by": user["id"],
        "actioned_by_name": user["full_name"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.operator_suspensions.insert_one(activation_record.copy())
    
    # Audit log
    await db.audit_logs.insert_one({
        "id": str(uuid4()),
        "user_id": user["id"],
        "user_name": user["full_name"],
        "action": "operator_activated",
        "entity_type": "operator",
        "entity_id": operator_id,
        "changes": {"notes": activation_notes},
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Notify operator
    await db.in_app_notifications.insert_one({
        "id": str(uuid4()),
        "user_id": operator["user_id"],
        "type": "operator_activated",
        "title": "Account Reactivated / खाता पुनः सक्रिय",
        "message": "Your operator account has been reactivated. You can now accept bookings.",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Operator activated successfully"}

# ============== OPERATOR DOCUMENT VERIFICATION ==============

@router.get("/{operator_id}/documents")
async def get_operator_documents(
    operator_id: str,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.REGIONAL_MANAGER]))
):
    """Get operator documents for verification"""
    db = get_database()
    
    operator = await db.operators.find_one({"id": operator_id}, {"_id": 0})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    
    # Get all documents
    documents = await db.operator_documents.find(
        {"operator_id": operator_id},
        {"_id": 0}
    ).to_list(50)
    
    return {
        "operator": operator,
        "documents": documents
    }

@router.post("/{operator_id}/documents/{document_id}/verify")
async def verify_operator_document(
    operator_id: str,
    document_id: str,
    data: dict,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Verify operator document (AOC, Insurance, DGCA)"""
    db = get_database()
    
    status = data.get("status")  # approved, rejected
    notes = data.get("notes", "")
    expiry_date = data.get("expiry_date")
    
    if status not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'")
    
    await db.operator_documents.update_one(
        {"id": document_id, "operator_id": operator_id},
        {"$set": {
            "verification_status": status,
            "verification_notes": notes,
            "verified_by": user["id"],
            "verified_at": datetime.now(timezone.utc).isoformat(),
            "expiry_date": expiry_date,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Audit log
    await db.audit_logs.insert_one({
        "id": str(uuid4()),
        "user_id": user["id"],
        "user_name": user["full_name"],
        "action": f"document_{status}",
        "entity_type": "operator_document",
        "entity_id": document_id,
        "changes": {"status": status, "notes": notes},
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": f"Document {status}"}

# ============== OPERATOR ONBOARDING APPROVAL ==============

@router.get("/pending-approvals")
async def get_pending_operator_approvals(
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.REGIONAL_MANAGER]))
):
    """Get operators pending approval"""
    db = get_database()
    
    query = {"verification_status": "pending"}
    
    if "regional_manager" in user.get("roles", []) and user.get("region"):
        query["region"] = user["region"]
    
    operators = await db.operators.find(query, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    for op in operators:
        user_data = await db.users.find_one({"id": op["user_id"]}, {"_id": 0, "email": 1, "full_name": 1})
        if user_data:
            op["user_email"] = user_data.get("email")
            op["user_name"] = user_data.get("full_name")
        
        # Get document count
        doc_count = await db.operator_documents.count_documents({"operator_id": op["id"]})
        op["document_count"] = doc_count
    
    return {"pending_operators": operators}

@router.post("/{operator_id}/approve-onboarding")
async def approve_operator_onboarding(
    operator_id: str,
    data: dict,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Approve operator onboarding"""
    db = get_database()
    
    operator = await db.operators.find_one({"id": operator_id}, {"_id": 0})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    
    notes = data.get("notes", "")
    commission_rate = data.get("commission_rate", 10.0)
    
    await db.operators.update_one(
        {"id": operator_id},
        {"$set": {
            "verification_status": "approved",
            "status": "active",
            "commission_rate": commission_rate,
            "onboarding_approved_by": user["id"],
            "onboarding_approved_at": datetime.now(timezone.utc).isoformat(),
            "onboarding_notes": notes,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Audit log
    await db.audit_logs.insert_one({
        "id": str(uuid4()),
        "user_id": user["id"],
        "user_name": user["full_name"],
        "action": "operator_onboarding_approved",
        "entity_type": "operator",
        "entity_id": operator_id,
        "changes": {"commission_rate": commission_rate, "notes": notes},
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Notify operator
    await db.in_app_notifications.insert_one({
        "id": str(uuid4()),
        "user_id": operator["user_id"],
        "type": "onboarding_approved",
        "title": "Welcome to AirYatra! / AirYatra में आपका स्वागत है!",
        "message": "Your operator account has been approved. Start adding your fleet!",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Operator approved successfully"}

@router.post("/{operator_id}/reject-onboarding")
async def reject_operator_onboarding(
    operator_id: str,
    data: dict,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Reject operator onboarding"""
    db = get_database()
    
    operator = await db.operators.find_one({"id": operator_id}, {"_id": 0})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    
    reason = data.get("reason", "")
    if not reason:
        raise HTTPException(status_code=400, detail="Rejection reason is required")
    
    await db.operators.update_one(
        {"id": operator_id},
        {"$set": {
            "verification_status": "rejected",
            "status": "rejected",
            "rejection_reason": reason,
            "rejected_by": user["id"],
            "rejected_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Notify operator
    await db.in_app_notifications.insert_one({
        "id": str(uuid4()),
        "user_id": operator["user_id"],
        "type": "onboarding_rejected",
        "title": "Application Rejected / आवेदन अस्वीकृत",
        "message": f"Your operator application was rejected. Reason: {reason}",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Operator rejected"}

# ============== REGION ASSIGNMENT ==============

@router.post("/{operator_id}/assign-region")
async def assign_operator_region(
    operator_id: str,
    data: dict,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Assign operator to region"""
    db = get_database()
    
    region = data.get("region")
    if not region:
        raise HTTPException(status_code=400, detail="Region is required")
    
    await db.operators.update_one(
        {"id": operator_id},
        {"$set": {
            "region": region,
            "region_assigned_by": user["id"],
            "region_assigned_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": f"Operator assigned to region: {region}"}

# ============== OPERATOR PERFORMANCE & SLA ==============

@router.get("/{operator_id}/performance")
async def get_operator_performance(
    operator_id: str,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.REGIONAL_MANAGER]))
):
    """Get operator performance metrics and SLA breaches"""
    db = get_database()
    
    operator = await db.operators.find_one({"id": operator_id}, {"_id": 0})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    
    # Calculate metrics
    total_bookings = await db.bookings.count_documents({"operator_id": operator_id})
    completed_bookings = await db.bookings.count_documents({"operator_id": operator_id, "status": "completed"})
    cancelled_bookings = await db.bookings.count_documents({"operator_id": operator_id, "status": "cancelled"})
    
    # SLA breaches (bookings with delays or issues)
    sla_breaches = await db.sla_breaches.find(
        {"operator_id": operator_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    
    # Average response time to inquiries
    inquiries = await db.inquiries.find(
        {"operator_id": operator_id, "responded_at": {"$ne": None}},
        {"_id": 0, "created_at": 1, "responded_at": 1}
    ).to_list(100)
    
    avg_response_hours = 0
    if inquiries:
        total_hours = 0
        for inq in inquiries:
            try:
                created = datetime.fromisoformat(inq["created_at"].replace("Z", "+00:00"))
                responded = datetime.fromisoformat(inq["responded_at"].replace("Z", "+00:00"))
                total_hours += (responded - created).total_seconds() / 3600
            except:
                pass
        avg_response_hours = total_hours / len(inquiries) if inquiries else 0
    
    # Customer ratings
    ratings = await db.reviews.find(
        {"operator_id": operator_id},
        {"_id": 0, "rating": 1}
    ).to_list(500)
    avg_rating = sum(r.get("rating", 0) for r in ratings) / len(ratings) if ratings else 0
    
    return {
        "operator": operator,
        "metrics": {
            "total_bookings": total_bookings,
            "completed_bookings": completed_bookings,
            "cancelled_bookings": cancelled_bookings,
            "completion_rate": (completed_bookings / total_bookings * 100) if total_bookings > 0 else 0,
            "average_response_hours": round(avg_response_hours, 2),
            "average_rating": round(avg_rating, 2),
            "total_reviews": len(ratings)
        },
        "sla_breaches": sla_breaches
    }
