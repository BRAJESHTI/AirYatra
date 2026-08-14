from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from database import get_database
from middleware import require_roles
from models import UserRole
import logging
import asyncio

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/approvals", tags=["Admin - Approval Management"])

# ============== APPROVAL QUEUE ==============

@router.get("/queue")
async def get_approval_queue(
    status: Optional[str] = "pending",
    request_type: Optional[str] = None,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.REGIONAL_MANAGER, UserRole.FINANCE]))
):
    """
    Get approval queue with filters
    अनुमोदन कतार देखें
    """
    db = get_database()
    
    query = {}
    
    if status:
        query["status"] = status
    
    if request_type:
        query["request_type"] = request_type
    
    # Filter based on role and approval level
    user_roles = user.get("roles", [])
    
    # Finance can only see finance-related approvals
    if "finance" in user_roles and "admin" not in user_roles and "super_admin" not in user_roles:
        query["request_type"] = {"$in": ["settlement", "refund", "payout"]}
    
    # Regional manager sees their region only
    if "regional_manager" in user_roles and user.get("region"):
        query["region"] = user["region"]
    
    approvals = await db.approval_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Enrich with related data
    for approval in approvals:
        # Get requester info
        if approval.get("requested_by"):
            requester = await db.users.find_one({"id": approval["requested_by"]}, {"_id": 0, "full_name": 1})
            approval["requested_by_name"] = requester.get("full_name") if requester else "Unknown"
        
        # Get booking/operator info based on type
        if approval.get("booking_id"):
            booking = await db.bookings.find_one({"id": approval["booking_id"]}, {"_id": 0})
            if booking:
                approval["booking_details"] = {
                    "booking_number": booking.get("booking_number"),
                    "from_location": booking.get("from_location"),
                    "to_location": booking.get("to_location"),
                    "total_amount": booking.get("total_amount")
                }
        
        if approval.get("operator_id"):
            operator = await db.operators.find_one({"id": approval["operator_id"]}, {"_id": 0, "company_name": 1})
            if operator:
                approval["operator_name"] = operator.get("company_name")
        
        # Check for escalation
        if approval.get("status") == "pending":
            created_at = datetime.fromisoformat(approval["created_at"].replace("Z", "+00:00"))
            hours_pending = (datetime.now(timezone.utc) - created_at).total_seconds() / 3600
            approval["hours_pending"] = round(hours_pending, 1)
            approval["needs_escalation"] = hours_pending > approval.get("escalation_hours", 24)
    
    # Group by status
    pending = [a for a in approvals if a.get("status") == "pending"]
    approved = [a for a in approvals if a.get("status") == "approved"]
    rejected = [a for a in approvals if a.get("status") == "rejected"]
    
    return {
        "all": approvals,
        "pending": pending,
        "approved": approved,
        "rejected": rejected,
        "counts": {
            "pending": len(pending),
            "approved": len(approved),
            "rejected": len(rejected)
        }
    }

@router.post("/{approval_id}/approve")
async def approve_request(
    approval_id: str,
    data: dict,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.REGIONAL_MANAGER, UserRole.FINANCE]))
):
    """
    Approve a request
    अनुरोध स्वीकृत करें
    """
    db = get_database()
    
    approval = await db.approval_requests.find_one({"id": approval_id}, {"_id": 0})
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found")
    
    if approval.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Request is not pending")
    
    remark = data.get("remark", "")
    if not remark:
        raise HTTPException(status_code=400, detail="Remark is required for approval")
    
    # Check if multi-level approval is needed
    current_level = approval.get("approval_level", 1)
    required_levels = approval.get("required_approval_levels", 1)
    
    # Check if user has authority for this level
    user_roles = user.get("roles", [])
    can_final_approve = "super_admin" in user_roles or (current_level >= required_levels)
    
    if current_level < required_levels and "super_admin" not in user_roles:
        # Escalate to next level
        new_level = current_level + 1
        await db.approval_requests.update_one(
            {"id": approval_id},
            {"$set": {
                "approval_level": new_level,
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$push": {
                "approval_chain": {
                    "level": current_level,
                    "approved_by": user["id"],
                    "approved_by_name": user["full_name"],
                    "remark": remark,
                    "approved_at": datetime.now(timezone.utc).isoformat()
                }
            }}
        )
        return {
            "message": f"Approved at level {current_level}. Escalated to level {new_level}",
            "final_approval": False
        }
    
    # Final approval
    await db.approval_requests.update_one(
        {"id": approval_id},
        {"$set": {
            "status": "approved",
            "final_approved_by": user["id"],
            "final_approved_by_name": user["full_name"],
            "final_remark": remark,
            "final_approved_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        "$push": {
            "approval_chain": {
                "level": current_level,
                "approved_by": user["id"],
                "approved_by_name": user["full_name"],
                "remark": remark,
                "approved_at": datetime.now(timezone.utc).isoformat(),
                "is_final": True
            }
        }}
    )
    
    # Execute the approved action
    await _execute_approval_action(db, approval, user)
    
    # Audit log
    await db.audit_logs.insert_one({
        "id": str(uuid4()),
        "user_id": user["id"],
        "user_name": user["full_name"],
        "action": "approval_approved",
        "entity_type": "approval_request",
        "entity_id": approval_id,
        "changes": {"remark": remark, "request_type": approval.get("request_type")},
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Request approved and executed", "final_approval": True}

@router.post("/{approval_id}/reject")
async def reject_request(
    approval_id: str,
    data: dict,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.REGIONAL_MANAGER, UserRole.FINANCE]))
):
    """
    Reject a request
    अनुरोध अस्वीकृत करें
    """
    db = get_database()
    
    approval = await db.approval_requests.find_one({"id": approval_id}, {"_id": 0})
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found")
    
    if approval.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Request is not pending")
    
    remark = data.get("remark", "")
    if not remark:
        raise HTTPException(status_code=400, detail="Rejection reason is required")
    
    await db.approval_requests.update_one(
        {"id": approval_id},
        {"$set": {
            "status": "rejected",
            "rejected_by": user["id"],
            "rejected_by_name": user["full_name"],
            "rejection_remark": remark,
            "rejected_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Notify requester
    if approval.get("requested_by"):
        await db.in_app_notifications.insert_one({
            "id": str(uuid4()),
            "user_id": approval["requested_by"],
            "type": "approval_rejected",
            "title": "Request Rejected",
            "message": f"Your {approval.get('request_type')} request was rejected. Reason: {remark}",
            "data": {"approval_id": approval_id},
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {"message": "Request rejected"}

@router.post("/{approval_id}/escalate")
async def escalate_request(
    approval_id: str,
    data: dict,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """
    Manually escalate request to higher level
    अनुरोध को उच्च स्तर पर भेजें
    """
    db = get_database()
    
    approval = await db.approval_requests.find_one({"id": approval_id}, {"_id": 0})
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found")
    
    escalation_reason = data.get("reason", "")
    escalate_to = data.get("escalate_to")  # user_id or "super_admin"
    
    current_level = approval.get("approval_level", 1)
    
    await db.approval_requests.update_one(
        {"id": approval_id},
        {"$set": {
            "approval_level": current_level + 1,
            "escalated": True,
            "escalated_by": user["id"],
            "escalated_at": datetime.now(timezone.utc).isoformat(),
            "escalation_reason": escalation_reason,
            "escalate_to": escalate_to,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Notify escalation target
    if escalate_to == "super_admin":
        super_admins = await db.users.find({"roles": "super_admin", "is_active": True}, {"_id": 0, "id": 1}).to_list(10)
        for sa in super_admins:
            await db.in_app_notifications.insert_one({
                "id": str(uuid4()),
                "user_id": sa["id"],
                "type": "escalation",
                "title": "⚠️ Escalated Approval",
                "message": f"A {approval.get('request_type')} request has been escalated for your review",
                "data": {"approval_id": approval_id},
                "read": False,
                "is_urgent": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    
    return {"message": "Request escalated"}

@router.get("/history/{entity_type}/{entity_id}")
async def get_approval_history(
    entity_type: str,
    entity_id: str,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """
    Get approval history for a booking/operator/settlement
    किसी entity के लिए अनुमोदन इतिहास
    """
    db = get_database()
    
    query = {}
    if entity_type == "booking":
        query["booking_id"] = entity_id
    elif entity_type == "operator":
        query["operator_id"] = entity_id
    elif entity_type == "settlement":
        query["settlement_id"] = entity_id
    else:
        query["entity_id"] = entity_id
    
    history = await db.approval_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    return {"history": history}

# ============== APPROVAL SETTINGS ==============

@router.get("/settings")
async def get_approval_settings(
    user: dict = Depends(require_roles([UserRole.SUPER_ADMIN]))
):
    """Get approval workflow settings"""
    db = get_database()
    
    settings = await db.approval_settings.find_one({"type": "workflow"}, {"_id": 0})
    
    if not settings:
        # Default settings
        settings = {
            "type": "workflow",
            "cancellation": {
                "required_levels": 1,
                "escalation_hours": 24,
                "approval_roles": ["admin", "super_admin"]
            },
            "settlement": {
                "required_levels": 2,
                "escalation_hours": 48,
                "approval_roles": ["finance", "admin", "super_admin"],
                "level_mapping": {
                    "1": ["finance"],
                    "2": ["admin", "super_admin"]
                }
            },
            "operator_onboarding": {
                "required_levels": 1,
                "escalation_hours": 72,
                "approval_roles": ["admin", "super_admin"]
            },
            "refund": {
                "required_levels": 2,
                "escalation_hours": 24,
                "approval_roles": ["finance", "super_admin"],
                "level_mapping": {
                    "1": ["finance"],
                    "2": ["super_admin"]
                }
            }
        }
    
    return {"settings": settings}

@router.put("/settings")
async def update_approval_settings(
    data: dict,
    user: dict = Depends(require_roles([UserRole.SUPER_ADMIN]))
):
    """Update approval workflow settings"""
    db = get_database()
    
    await db.approval_settings.update_one(
        {"type": "workflow"},
        {"$set": {**data, "updated_by": user["id"], "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    return {"message": "Approval settings updated"}

# ============== HELPER FUNCTIONS ==============

async def _execute_approval_action(db, approval: dict, approver: dict):
    """Execute the approved action"""
    request_type = approval.get("request_type")
    
    if request_type == "cancellation":
        booking_id = approval.get("booking_id")
        if booking_id:
            await db.bookings.update_one(
                {"id": booking_id},
                {"$set": {
                    "status": "cancelled",
                    "cancellation_approved": True,
                    "cancellation_approved_by": approver["id"],
                    "cancellation_approved_at": datetime.now(timezone.utc).isoformat(),
                    "cancellation_reason": approval.get("reason"),
                    "refund_amount": approval.get("refund_amount"),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Add to timeline
            await db.booking_timeline.insert_one({
                "id": str(uuid4()),
                "booking_id": booking_id,
                "event_type": "cancellation_approved",
                "event_label": "Cancellation Approved",
                "description": f"Approved by {approver['full_name']}",
                "user_id": approver["id"],
                "user_name": approver["full_name"],
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    
    elif request_type == "settlement":
        settlement_id = approval.get("settlement_id")
        if settlement_id:
            await db.settlements.update_one(
                {"id": settlement_id},
                {"$set": {
                    "status": "approved",
                    "approved_by": approver["id"],
                    "approved_at": datetime.now(timezone.utc).isoformat()
                }}
            )
    
    elif request_type == "refund":
        booking_id = approval.get("booking_id")
        refund_amount = approval.get("refund_amount", 0)
        if booking_id:
            await db.bookings.update_one(
                {"id": booking_id},
                {"$set": {
                    "refund_approved": True,
                    "refund_amount": refund_amount,
                    "refund_approved_by": approver["id"],
                    "refund_approved_at": datetime.now(timezone.utc).isoformat()
                }}
            )
