from fastapi import APIRouter, HTTPException, Depends
from database import get_database
from middleware import get_current_user, require_roles
from models import UserRole, OperatorStatus, ApprovalStatus
import uuid
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["Admin"])

@router.get("/dashboard")
async def get_admin_dashboard(user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))):
    """Get comprehensive admin dashboard statistics"""
    db = get_database()
    
    # Get current date ranges
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    month_start = datetime(now.year, now.month, 1)
    year_start = datetime(now.year, 1, 1)
    
    # Total counts
    total_bookings = await db.bookings.count_documents({})
    total_operators = await db.operators.count_documents({})
    total_customers = await db.users.count_documents({"roles": "customer"})
    total_aircraft = await db.aircraft.count_documents({})
    
    # Today's bookings
    today_bookings = await db.bookings.count_documents({
        "created_at": {"$gte": today_start.isoformat()}
    })
    
    # Month's bookings
    month_bookings = await db.bookings.count_documents({
        "created_at": {"$gte": month_start.isoformat()}
    })
    
    # Pending approvals
    pending_operators = await db.operators.count_documents({"verification_status": "pending"})
    pending_landing_permissions = await db.landing_permissions.count_documents({"approval_status": "pending"})
    
    # Active vs Suspended operators
    active_operators = await db.operators.count_documents({"status": "active"})
    suspended_operators = await db.operators.count_documents({"status": "suspended"})
    
    # Revenue calculation (from completed bookings)
    completed_bookings = await db.bookings.find(
        {"status": "completed"},
        {"_id": 0, "total_amount": 1, "commission_amount": 1}
    ).to_list(1000)
    
    total_revenue = sum([b.get("total_amount", 0) for b in completed_bookings])
    total_commission = sum([b.get("commission_amount", 0) for b in completed_bookings])
    operator_payout = total_revenue - total_commission
    
    # Recent bookings
    recent_bookings = await db.bookings.find({}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    
    # Enrich with customer and operator names
    for booking in recent_bookings:
        customer = await db.users.find_one({"id": booking.get("customer_id")}, {"_id": 0, "full_name": 1})
        if customer:
            booking["customer_name"] = customer.get("full_name")
        
        if booking.get("operator_id"):
            operator = await db.operators.find_one({"id": booking["operator_id"]}, {"_id": 0, "company_name": 1})
            if operator:
                booking["operator_name"] = operator.get("company_name")
    
    # Region-wise performance (if regions are defined)
    regions = await db.operators.distinct("region")
    region_performance = []
    for region in regions:
        if region:
            region_operators = await db.operators.count_documents({"region": region, "status": "active"})
            region_bookings = await db.bookings.count_documents({"region": region})
            region_performance.append({
                "region": region,
                "operators": region_operators,
                "bookings": region_bookings
            })
    
    # Emergency/incident alerts (bookings with SOS or cancelled with issues)
    emergency_alerts = await db.bookings.find(
        {"$or": [{"is_emergency": True}, {"status": "cancelled", "cancellation_reason": {"$regex": "emergency|incident|safety", "$options": "i"}}]},
        {"_id": 0}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    # Documents expiring soon
    thirty_days_later = (now + timedelta(days=30)).isoformat()
    expiring_pilot_docs = await db.pilot_documents.count_documents({
        "status": "completed",
        "expiry_date": {"$lte": thirty_days_later, "$gte": now.isoformat()}
    })
    expiring_aircraft_docs = await db.aircraft_documents.count_documents({
        "status": "completed",
        "expiry_date": {"$lte": thirty_days_later, "$gte": now.isoformat()}
    })
    
    return {
        "statistics": {
            "total_bookings": total_bookings,
            "today_bookings": today_bookings,
            "month_bookings": month_bookings,
            "total_operators": total_operators,
            "active_operators": active_operators,
            "suspended_operators": suspended_operators,
            "total_customers": total_customers,
            "total_aircraft": total_aircraft,
            "pending_operator_approvals": pending_operators,
            "pending_landing_permissions": pending_landing_permissions,
            "expiring_pilot_documents": expiring_pilot_docs,
            "expiring_aircraft_documents": expiring_aircraft_docs
        },
        "revenue": {
            "total_revenue": total_revenue,
            "total_commission": total_commission,
            "operator_payout": operator_payout
        },
        "recent_bookings": recent_bookings,
        "region_performance": region_performance,
        "emergency_alerts": emergency_alerts
    }

@router.get("/operators")
async def get_all_operators(user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])), status: str = None):
    """Get all operators with optional status filter"""
    db = get_database()
    
    query = {}
    if status:
        query["status"] = status
    
    operators = await db.operators.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    
    # Enrich with user details and statistics
    for operator in operators:
        user_data = await db.users.find_one({"id": operator["user_id"]}, {"_id": 0})
        if user_data:
            operator["user_email"] = user_data.get("email")
            operator["user_phone"] = user_data.get("phone")
        
        # Get operator statistics
        aircraft_count = await db.aircraft.count_documents({"operator_id": operator["id"]})
        pilot_count = await db.pilots.count_documents({"operator_id": operator["id"]})
        booking_count = await db.bookings.count_documents({"operator_id": operator["id"]})
        
        operator["statistics"] = {
            "aircraft_count": aircraft_count,
            "pilot_count": pilot_count,
            "booking_count": booking_count
        }
    
    return {"operators": operators}

@router.post("/operators/{operator_id}/verify")
async def verify_operator(operator_id: str, data: dict, user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))):
    """Verify/Approve or Reject operator"""
    db = get_database()
    
    operator = await db.operators.find_one({"id": operator_id}, {"_id": 0})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    
    status = data.get("status")  # 'approved' or 'rejected'
    notes = data.get("notes", "")
    
    if status not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'")
    
    update_data = {
        "verification_status": status,
        "status": "active" if status == "approved" else "pending",
        "verified_by": user["id"],
        "verified_at": datetime.utcnow().isoformat(),
        "verification_notes": notes,
        "updated_at": datetime.utcnow().isoformat()
    }
    
    await db.operators.update_one(
        {"id": operator_id},
        {"$set": update_data}
    )
    
    # Log action in audit logs
    audit_log = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user["full_name"],
        "action": "operator_verification",
        "entity_type": "operator",
        "entity_id": operator_id,
        "changes": update_data,
        "ip_address": None,
        "created_at": datetime.utcnow().isoformat()
    }
    await db.audit_logs.insert_one(audit_log.copy())
    
    return {"message": f"Operator {status}", "operator_id": operator_id}

@router.get("/bookings")
async def get_all_bookings(user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])), status: str = None, limit: int = 100):
    """Get all bookings with optional status filter"""
    db = get_database()
    
    query = {}
    if status:
        query["status"] = status
    
    bookings = await db.bookings.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Enrich with customer and operator details
    for booking in bookings:
        customer = await db.users.find_one({"id": booking["customer_id"]}, {"_id": 0})
        if customer:
            booking["customer_name"] = customer.get("full_name")
            booking["customer_email"] = customer.get("email")
            booking["customer_phone"] = customer.get("phone")
        
        if booking.get("operator_id"):
            operator = await db.operators.find_one({"id": booking["operator_id"]}, {"_id": 0})
            if operator:
                booking["operator_name"] = operator.get("company_name")
    
    return {"bookings": bookings}

@router.post("/bookings/{booking_id}/reassign")
async def reassign_booking(booking_id: str, data: dict, user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))):
    """Reassign booking to another operator"""
    db = get_database()
    
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    new_operator_id = data.get("operator_id")
    reason = data.get("reason", "")
    
    # Verify new operator exists and is active
    operator = await db.operators.find_one({"id": new_operator_id}, {"_id": 0})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    
    if operator["status"] != "active":
        raise HTTPException(status_code=400, detail="Operator is not active")
    
    old_operator_id = booking.get("operator_id")
    
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "operator_id": new_operator_id,
            "reassigned_by": user["id"],
            "reassigned_at": datetime.utcnow().isoformat(),
            "reassignment_reason": reason,
            "previous_operator_id": old_operator_id,
            "updated_at": datetime.utcnow().isoformat()
        }}
    )
    
    # Log action
    audit_log = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user["full_name"],
        "action": "booking_reassignment",
        "entity_type": "booking",
        "entity_id": booking_id,
        "changes": {
            "old_operator_id": old_operator_id,
            "new_operator_id": new_operator_id,
            "reason": reason
        },
        "created_at": datetime.utcnow().isoformat()
    }
    await db.audit_logs.insert_one(audit_log.copy())
    
    return {"message": "Booking reassigned successfully"}

@router.post("/bookings/{booking_id}/force-assign")
async def force_assign_operator(booking_id: str, data: dict, user: dict = Depends(require_roles([UserRole.SUPER_ADMIN]))):
    """Force assign operator to booking (Super Admin only)"""
    db = get_database()
    
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    operator_id = data.get("operator_id")
    aircraft_id = data.get("aircraft_id")
    override_reason = data.get("reason", "")
    
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "operator_id": operator_id,
            "aircraft_id": aircraft_id,
            "status": "confirmed",
            "force_assigned_by": user["id"],
            "force_assigned_at": datetime.utcnow().isoformat(),
            "override_reason": override_reason,
            "updated_at": datetime.utcnow().isoformat()
        }}
    )
    
    # Log action with special flag
    audit_log = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user["full_name"],
        "action": "force_assign_operator",
        "entity_type": "booking",
        "entity_id": booking_id,
        "changes": data,
        "is_critical": True,
        "created_at": datetime.utcnow().isoformat()
    }
    await db.audit_logs.insert_one(audit_log.copy())
    
    return {"message": "Operator force assigned"}
# ============== INQUIRY MANAGEMENT ==============

@router.get("/inquiries")
async def get_all_inquiries(
    status: str = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Get all booking inquiries for admin"""
    query = {}
    if status:
        query["status"] = status
    
    # Get from inquiries collection
    inquiries = await db.inquiries.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Also get from bookings if inquiries is empty or to merge
    bookings = await db.bookings.find(
        {**query, "type": {"$in": ["booking_inquiry", "inquiry", None]}},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Merge unique items
    all_ids = set()
    merged = []
    for item in inquiries + bookings:
        if item["id"] not in all_ids:
            all_ids.add(item["id"])
            merged.append(item)
    
    # Sort by created_at
    merged.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    
    # Count stats
    all_inquiries = await db.inquiries.find({}, {"_id": 0, "status": 1}).to_list(1000)
    stats = {
        "total": len(all_inquiries),
        "pending": len([i for i in all_inquiries if i.get("status") == "pending_acceptance"]),
        "quote_received": len([i for i in all_inquiries if i.get("status") == "quote_received"]),
        "accepted": len([i for i in all_inquiries if i.get("status") in ["quote_accepted", "confirmed"]]),
    }
    
    return {
        "inquiries": merged[:limit],
        "stats": stats,
        "total": len(merged)
    }

@router.get("/inquiries/{inquiry_id}")
async def get_inquiry_details(
    inquiry_id: str,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Get detailed inquiry information"""
    inquiry = await db.inquiries.find_one({"id": inquiry_id}, {"_id": 0})
    if not inquiry:
        inquiry = await db.bookings.find_one({"id": inquiry_id}, {"_id": 0})
    
    if not inquiry:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    
    # Get operator mappings
    mappings = await db.inquiry_operator_mappings.find(
        {"inquiry_id": inquiry_id},
        {"_id": 0}
    ).to_list(50)
    
    # Get quotes
    quotes = await db.quotes.find(
        {"booking_id": inquiry_id},
        {"_id": 0}
    ).to_list(50)
    
    # Enrich with operator info
    for mapping in mappings:
        op = await db.operators.find_one(
            {"id": mapping["operator_id"]},
            {"_id": 0, "company_name": 1, "average_rating": 1}
        )
        mapping["operator"] = op
    
    return {
        "inquiry": inquiry,
        "operator_mappings": mappings,
        "quotes": quotes
    }
