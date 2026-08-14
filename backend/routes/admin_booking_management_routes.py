from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone
from uuid import uuid4
from database import get_database
from middleware import require_roles
from models import UserRole
import logging

logger = logging.getLogger(__name__)

# Email integration for booking status changes
try:
    from services.booking_email_integration import (
        on_booking_confirmed, on_booking_cancelled, 
        on_booking_rescheduled, on_flight_completed
    )
    BOOKING_EMAIL_AVAILABLE = True
except ImportError:
    BOOKING_EMAIL_AVAILABLE = False

router = APIRouter(prefix="/admin/bookings-management", tags=["Admin - Booking Management"])

# ============== ADVANCED BOOKING MANAGEMENT ==============

@router.get("/timeline/{booking_id}")
async def get_booking_timeline(
    booking_id: str,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.REGIONAL_MANAGER]))
):
    """
    Get full booking timeline with all remarks and actions
    बुकिंग की पूरी समयरेखा देखें
    """
    db = get_database()
    
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Get all timeline events
    timeline = await db.booking_timeline.find(
        {"booking_id": booking_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    
    # If no timeline exists, create from booking data
    if not timeline:
        timeline = [{
            "id": str(uuid4()),
            "booking_id": booking_id,
            "event_type": "booking_created",
            "event_label": "Booking Created",
            "description": f"Booking created by customer",
            "created_at": booking.get("created_at"),
            "user_id": booking.get("customer_id"),
            "user_name": "Customer"
        }]
    
    return {"booking": booking, "timeline": timeline}

@router.post("/{booking_id}/add-remark")
async def add_booking_remark(
    booking_id: str,
    data: dict,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.REGIONAL_MANAGER]))
):
    """Add remark to booking timeline"""
    db = get_database()
    
    remark = data.get("remark")
    remark_type = data.get("type", "general")  # general, issue, resolution, note
    
    if not remark:
        raise HTTPException(status_code=400, detail="Remark is required")
    
    timeline_entry = {
        "id": str(uuid4()),
        "booking_id": booking_id,
        "event_type": "remark_added",
        "event_label": f"Remark ({remark_type})",
        "description": remark,
        "remark_type": remark_type,
        "user_id": user["id"],
        "user_name": user["full_name"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.booking_timeline.insert_one(timeline_entry.copy())
    
    return {"message": "Remark added", "entry": timeline_entry}

@router.post("/{booking_id}/request-cancellation")
async def request_booking_cancellation(
    booking_id: str,
    data: dict,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.REGIONAL_MANAGER]))
):
    """
    Request booking cancellation (goes to approval queue)
    बुकिंग रद्दीकरण अनुरोध
    """
    db = get_database()
    
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking.get("status") in ["cancelled", "completed"]:
        raise HTTPException(status_code=400, detail="Cannot cancel this booking")
    
    reason = data.get("reason", "")
    refund_amount = data.get("refund_amount", 0)
    
    # Create cancellation request
    cancellation_request = {
        "id": str(uuid4()),
        "booking_id": booking_id,
        "request_type": "cancellation",
        "reason": reason,
        "refund_amount": refund_amount,
        "current_status": booking.get("status"),
        "requested_by": user["id"],
        "requested_by_name": user["full_name"],
        "status": "pending",  # pending, approved, rejected
        "approval_level": 1,  # Can be escalated
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.approval_requests.insert_one(cancellation_request.copy())
    
    # Update booking with pending cancellation flag
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "cancellation_requested": True,
            "cancellation_request_id": cancellation_request["id"],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Add to timeline
    await db.booking_timeline.insert_one({
        "id": str(uuid4()),
        "booking_id": booking_id,
        "event_type": "cancellation_requested",
        "event_label": "Cancellation Requested",
        "description": f"Reason: {reason}. Refund: ₹{refund_amount}",
        "user_id": user["id"],
        "user_name": user["full_name"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Cancellation request submitted for approval", "request_id": cancellation_request["id"]}

@router.post("/{booking_id}/emergency-override")
async def emergency_override_booking(
    booking_id: str,
    data: dict,
    user: dict = Depends(require_roles([UserRole.SUPER_ADMIN]))
):
    """
    Emergency override booking (Super Admin only)
    आपातकालीन ओवरराइड (केवल सुपर एडमिन)
    """
    db = get_database()
    
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    override_action = data.get("action")  # cancel, complete, reassign, status_change
    override_reason = data.get("reason", "")
    new_data = data.get("new_data", {})
    
    if not override_reason:
        raise HTTPException(status_code=400, detail="Override reason is required")
    
    update_data = {
        "emergency_override": True,
        "override_by": user["id"],
        "override_at": datetime.now(timezone.utc).isoformat(),
        "override_reason": override_reason,
        "override_action": override_action,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if override_action == "cancel":
        update_data["status"] = "cancelled"
        update_data["cancellation_reason"] = f"Emergency Override: {override_reason}"
    elif override_action == "complete":
        update_data["status"] = "completed"
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
    elif override_action == "status_change":
        update_data["status"] = new_data.get("new_status")
    elif override_action == "reassign":
        update_data["operator_id"] = new_data.get("operator_id")
        update_data["aircraft_id"] = new_data.get("aircraft_id")
    
    # Apply additional data
    for key, value in new_data.items():
        if key not in ["new_status", "operator_id", "aircraft_id"]:
            update_data[key] = value
    
    await db.bookings.update_one({"id": booking_id}, {"$set": update_data})
    
    # Add to timeline
    await db.booking_timeline.insert_one({
        "id": str(uuid4()),
        "booking_id": booking_id,
        "event_type": "emergency_override",
        "event_label": "⚠️ Emergency Override",
        "description": f"Action: {override_action}. Reason: {override_reason}",
        "user_id": user["id"],
        "user_name": user["full_name"],
        "is_critical": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Audit log with critical flag
    await db.audit_logs.insert_one({
        "id": str(uuid4()),
        "user_id": user["id"],
        "user_name": user["full_name"],
        "action": "emergency_override",
        "entity_type": "booking",
        "entity_id": booking_id,
        "changes": update_data,
        "is_critical": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Send email notifications based on status change
    if BOOKING_EMAIL_AVAILABLE:
        try:
            # Get updated booking and customer info
            updated_booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
            customer_id = updated_booking.get("customer_id") or updated_booking.get("user_id")
            customer = await db.users.find_one({"id": customer_id}, {"_id": 0})
            
            if customer and updated_booking:
                if override_action == "cancel":
                    refund_amount = str(updated_booking.get("total_amount", "0"))
                    await on_booking_cancelled(
                        updated_booking, customer, override_reason, 
                        refund_amount, "Admin Override", db
                    )
                    logger.info(f"Cancellation email sent for booking {booking_id}")
                elif override_action == "complete":
                    await on_flight_completed(updated_booking, customer, {}, db)
                    logger.info(f"Completion email sent for booking {booking_id}")
                elif override_action == "status_change" and new_data.get("new_status") == "confirmed":
                    await on_booking_confirmed(updated_booking, customer, db)
                    logger.info(f"Confirmation email sent for booking {booking_id}")
        except Exception as e:
            logger.error(f"Failed to send email for booking {booking_id}: {e}")
    
    return {"message": f"Emergency override applied: {override_action}"}

@router.post("/{booking_id}/reassign")
async def reassign_booking_extended(
    booking_id: str,
    data: dict,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Reassign booking to another operator with full audit"""
    db = get_database()
    
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    new_operator_id = data.get("operator_id")
    new_aircraft_id = data.get("aircraft_id")
    reason = data.get("reason", "")
    notify_customer = data.get("notify_customer", True)
    
    # Verify new operator
    new_operator = await db.operators.find_one({"id": new_operator_id}, {"_id": 0})
    if not new_operator:
        raise HTTPException(status_code=404, detail="New operator not found")
    
    if new_operator.get("status") != "active":
        raise HTTPException(status_code=400, detail="New operator is not active")
    
    old_operator_id = booking.get("operator_id")
    old_operator = None
    if old_operator_id:
        old_operator = await db.operators.find_one({"id": old_operator_id}, {"_id": 0})
    
    # Update booking
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "operator_id": new_operator_id,
            "aircraft_id": new_aircraft_id,
            "previous_operator_id": old_operator_id,
            "reassigned_by": user["id"],
            "reassigned_at": datetime.now(timezone.utc).isoformat(),
            "reassignment_reason": reason,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Timeline entry
    await db.booking_timeline.insert_one({
        "id": str(uuid4()),
        "booking_id": booking_id,
        "event_type": "booking_reassigned",
        "event_label": "Booking Reassigned",
        "description": f"From: {old_operator.get('company_name') if old_operator else 'None'} → To: {new_operator.get('company_name')}. Reason: {reason}",
        "user_id": user["id"],
        "user_name": user["full_name"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Notify customer if requested
    if notify_customer:
        await db.in_app_notifications.insert_one({
            "id": str(uuid4()),
            "user_id": booking["customer_id"],
            "type": "booking_reassigned",
            "title": "Operator Changed",
            "message": f"Your booking has been assigned to {new_operator.get('company_name')}",
            "data": {"booking_id": booking_id},
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {"message": "Booking reassigned successfully"}

# ============== BOOKING STATUS MANAGEMENT ==============

@router.get("/by-status")
async def get_bookings_by_status(
    status: Optional[str] = None,
    region: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.REGIONAL_MANAGER]))
):
    """Get bookings with advanced filters"""
    db = get_database()
    
    query = {}
    
    if status:
        query["status"] = status
    
    if region:
        query["region"] = region
    
    if date_from:
        query["created_at"] = {"$gte": date_from}
    
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = date_to
        else:
            query["created_at"] = {"$lte": date_to}
    
    # Regional manager filter
    if "regional_manager" in user.get("roles", []) and user.get("region"):
        query["region"] = user["region"]
    
    bookings = await db.bookings.find(query, {"_id": 0}).sort("created_at", -1).limit(200).to_list(200)
    
    # Enrich bookings
    for booking in bookings:
        if booking.get("customer_id"):
            customer = await db.users.find_one({"id": booking["customer_id"]}, {"_id": 0, "full_name": 1, "phone": 1})
            if customer:
                booking["customer_name"] = customer.get("full_name")
                booking["customer_phone"] = customer.get("phone")
        
        if booking.get("operator_id"):
            operator = await db.operators.find_one({"id": booking["operator_id"]}, {"_id": 0, "company_name": 1})
            if operator:
                booking["operator_name"] = operator.get("company_name")
    
    return {"bookings": bookings, "total": len(bookings)}
