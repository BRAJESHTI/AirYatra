"""
Complaint Management API Routes - AirYatra Aviation Platform
Full investigation workflow with operator response tracking

Based on Document [5] requirements:
- AirYatra investigates independently
- AirYatra decides right/wrong (not Operator)
- Operator must respond within 2 hours
- No appeal allowed
"""

from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from typing import Optional, List
from datetime import datetime, timedelta
import uuid

from database import get_database
from middleware import get_current_user, require_roles
from models.complaint_penalty_models import (
    ComplaintStatus, ComplaintSeverity, ComplaintCategory, ComplaintDecision,
    PenaltyType, PenaltyRule, PenaltyStatus, OperatorCooperationStatus,
    ComplaintCreate, ComplaintUpdate, ComplaintInvestigationCreate,
    OperatorResponseCreate, PenaltyCreate
)

router = APIRouter(prefix="/complaints", tags=["Complaint Management"])

# ============= HELPER FUNCTIONS =============

def generate_complaint_id():
    return f"COMP-{uuid.uuid4().hex[:8].upper()}"

def generate_complaint_number():
    return f"AY-COMP-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"

def generate_penalty_id():
    return f"PEN-{uuid.uuid4().hex[:8].upper()}"


async def check_and_apply_penalty(db, operator_id: str, complaint_id: str):
    """
    Check complaint history and apply penalties per Document [5]:
    - 1 serious complaint: INR 10,000
    - 2 complaints in 30 days: INR 20,000 + suspension
    - 3+ complaints in 60 days: Delisting
    """
    
    # Count complaints in last 30 days
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    complaints_30_days = await db.complaints.count_documents({
        "operator_id": operator_id,
        "airyatra_decision": "upheld",
        "decision_date": {"$gte": thirty_days_ago}
    })
    
    # Count complaints in last 60 days
    sixty_days_ago = datetime.utcnow() - timedelta(days=60)
    complaints_60_days = await db.complaints.count_documents({
        "operator_id": operator_id,
        "airyatra_decision": "upheld",
        "decision_date": {"$gte": sixty_days_ago}
    })
    
    penalty = None
    
    if complaints_60_days >= 3:
        # 3+ complaints in 60 days = DELISTING
        penalty = {
            "penalty_id": generate_penalty_id(),
            "operator_id": operator_id,
            "penalty_type": PenaltyType.COMPLAINT_PENALTY.value,
            "penalty_amount": 50000,  # INR 50,000
            "penalty_rule": PenaltyRule.THREE_COMPLAINTS_60_DAYS.value,
            "triggered_by_complaint_id": complaint_id,
            "triggered_by": f"3+ upheld complaints in 60 days ({complaints_60_days} complaints)",
            "suspension_triggered": False,
            "delisting_triggered": True,
            "delisting_date": datetime.utcnow(),
            "delisting_permanent": False,
            "status": PenaltyStatus.ISSUED.value,
            "appeal_allowed": False,
            "issued_at": datetime.utcnow(),
            "created_at": datetime.utcnow()
        }
        
        # Update operator status to delisted
        await db.operators.update_one(
            {"id": operator_id},
            {"$set": {
                "status": "delisted",
                "delisted_at": datetime.utcnow(),
                "delisting_reason": "Multiple customer complaints (3+ in 60 days)"
            }}
        )
        
    elif complaints_30_days >= 2:
        # 2 complaints in 30 days = INR 20,000 + 7-day suspension
        suspension_end = datetime.utcnow() + timedelta(days=7)
        penalty = {
            "penalty_id": generate_penalty_id(),
            "operator_id": operator_id,
            "penalty_type": PenaltyType.COMPLAINT_PENALTY.value,
            "penalty_amount": 20000,  # INR 20,000
            "penalty_rule": PenaltyRule.TWO_COMPLAINTS_30_DAYS.value,
            "triggered_by_complaint_id": complaint_id,
            "triggered_by": f"2 upheld complaints in 30 days",
            "suspension_triggered": True,
            "suspension_duration_days": 7,
            "suspension_start_date": datetime.utcnow(),
            "suspension_end_date": suspension_end,
            "delisting_triggered": False,
            "status": PenaltyStatus.ISSUED.value,
            "payment_due_date": datetime.utcnow() + timedelta(days=7),
            "appeal_allowed": False,
            "issued_at": datetime.utcnow(),
            "created_at": datetime.utcnow()
        }
        
        # Update operator status to suspended
        await db.operators.update_one(
            {"id": operator_id},
            {"$set": {
                "status": "suspended",
                "suspended_at": datetime.utcnow(),
                "suspension_end_date": suspension_end,
                "suspension_reason": "Multiple customer complaints (2 in 30 days)"
            }}
        )
        
    elif complaints_30_days >= 1:
        # First serious complaint = INR 10,000
        penalty = {
            "penalty_id": generate_penalty_id(),
            "operator_id": operator_id,
            "penalty_type": PenaltyType.COMPLAINT_PENALTY.value,
            "penalty_amount": 10000,  # INR 10,000
            "penalty_rule": PenaltyRule.FIRST_SERIOUS_COMPLAINT.value,
            "triggered_by_complaint_id": complaint_id,
            "triggered_by": "First serious upheld complaint",
            "suspension_triggered": False,
            "delisting_triggered": False,
            "status": PenaltyStatus.ISSUED.value,
            "payment_due_date": datetime.utcnow() + timedelta(days=7),
            "appeal_allowed": False,
            "issued_at": datetime.utcnow(),
            "created_at": datetime.utcnow()
        }
    
    if penalty:
        await db.penalties.insert_one(penalty)
        return penalty
    
    return None


# ============= CUSTOMER: FILE COMPLAINT =============

@router.post("/file")
async def file_complaint(
    complaint_data: ComplaintCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Customer files a complaint against a booking/operator
    
    - Automatically notifies operator (2-hour response required)
    - Creates investigation ticket
    """
    db = get_database()
    
    # Get booking details
    booking = await db.bookings.find_one({"id": complaint_data.booking_id})
    if not booking:
        raise HTTPException(404, "Booking not found")
    
    # Verify customer owns the booking
    if booking.get("customer_id") != current_user["id"]:
        raise HTTPException(403, "You can only file complaints for your own bookings")
    
    operator_id = booking.get("operator_id")
    aircraft_id = booking.get("aircraft_id")
    
    complaint_id = generate_complaint_id()
    complaint_number = generate_complaint_number()
    
    # Operator must respond within 24 hours
    response_deadline = datetime.utcnow() + timedelta(hours=24)
    
    complaint = {
        "complaint_id": complaint_id,
        "complaint_number": complaint_number,
        
        # Complainant
        "customer_id": current_user["id"],
        "customer_email": current_user.get("email"),
        "customer_phone": current_user.get("phone"),
        "customer_name": current_user.get("full_name", current_user.get("name")),
        
        # Subject
        "booking_id": complaint_data.booking_id,
        "operator_id": operator_id,
        "aircraft_id": aircraft_id,
        
        # Details
        "subject": complaint_data.subject,
        "description": complaint_data.description,
        "severity": complaint_data.severity.value,
        "category": complaint_data.category.value,
        
        # Status
        "status": ComplaintStatus.OPEN.value,
        
        # Operator Response Deadline
        "operator_response_required_at": response_deadline,
        "operator_response_received": False,
        "operator_cooperation_status": OperatorCooperationStatus.PENDING_RESPONSE.value,
        
        # Evidence
        "evidence_files": complaint_data.evidence_files,
        "evidence_submitted_by_customer": len(complaint_data.evidence_files) > 0,
        
        # Timestamps
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.complaints.insert_one(complaint)
    
    # TODO: Send notification to operator (SMS/Email/WhatsApp)
    # TODO: Send notification to AirYatra investigation team
    
    return {
        "success": True,
        "complaint_id": complaint_id,
        "complaint_number": complaint_number,
        "message": "Complaint filed successfully / शिकायत दर्ज हो गई",
        "operator_response_deadline": response_deadline.isoformat(),
        "message_hi": "आपकी शिकायत दर्ज हो गई है। ऑपरेटर को 24 घंटे में जवाब देना होगा।"
    }


# ============= CUSTOMER: MY COMPLAINTS =============

@router.get("/my-complaints")
async def get_my_complaints(
    status: Optional[ComplaintStatus] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    current_user: dict = Depends(get_current_user)
):
    """Get all complaints filed by current user"""
    db = get_database()
    
    query = {"customer_id": current_user["id"]}
    if status:
        query["status"] = status.value
    
    skip = (page - 1) * limit
    
    complaints = await db.complaints.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.complaints.count_documents(query)
    
    return {
        "complaints": complaints,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }


# ============= OPERATOR: RESPOND TO COMPLAINT =============

@router.post("/operator/respond")
async def operator_respond_to_complaint(
    response_data: OperatorResponseCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Operator responds to a complaint
    
    - Must respond within 2 hours (else non-cooperation penalty)
    - Response is reviewed by AirYatra (not final decision)
    """
    db = get_database()
    
    complaint = await db.complaints.find_one({"complaint_id": response_data.complaint_id})
    if not complaint:
        raise HTTPException(404, "Complaint not found")
    
    # Verify operator owns this booking
    operator = await db.operators.find_one({"user_id": current_user["id"]})
    if not operator or operator.get("id") != complaint["operator_id"]:
        raise HTTPException(403, "You can only respond to complaints against your bookings")
    
    # Check if already responded
    if complaint.get("operator_response_received"):
        raise HTTPException(400, "Already responded to this complaint")
    
    now = datetime.utcnow()
    response_deadline = complaint.get("operator_response_required_at")
    
    # Check if response is late
    is_late = response_deadline and now > response_deadline
    cooperation_status = OperatorCooperationStatus.COOPERATIVE.value
    
    if is_late:
        cooperation_status = OperatorCooperationStatus.PARTIALLY_COOPERATIVE.value
        # Issue non-cooperation penalty for late response
        late_penalty = {
            "penalty_id": generate_penalty_id(),
            "operator_id": complaint["operator_id"],
            "penalty_type": PenaltyType.NON_COOPERATION.value,
            "penalty_amount": 5000,  # INR 5,000
            "penalty_rule": PenaltyRule.NON_COOPERATION.value,
            "triggered_by_complaint_id": response_data.complaint_id,
            "triggered_by": "Late response to complaint (exceeded 2-hour deadline)",
            "status": PenaltyStatus.ISSUED.value,
            "payment_due_date": now + timedelta(days=7),
            "appeal_allowed": False,
            "issued_at": now,
            "created_at": now
        }
        await db.penalties.insert_one(late_penalty)
    
    # Update complaint with operator response
    await db.complaints.update_one(
        {"complaint_id": response_data.complaint_id},
        {"$set": {
            "operator_response_received": True,
            "operator_response_date": now,
            "operator_response_text": response_data.response_text,
            "operator_provided_documentation": response_data.documentation_provided,
            "operator_cooperation_status": cooperation_status,
            "status": ComplaintStatus.UNDER_INVESTIGATION.value,
            "updated_at": now
        },
        "$push": {
            "evidence_files": {"$each": response_data.evidence_files}
        }}
    )
    
    response = {
        "success": True,
        "message": "Response submitted successfully",
        "is_late": is_late,
        "cooperation_status": cooperation_status
    }
    
    if is_late:
        response["penalty_issued"] = True
        response["penalty_amount"] = 5000
        response["penalty_reason"] = "Late response (exceeded 2-hour deadline)"
    
    return response


# ============= OPERATOR: VIEW COMPLAINTS AGAINST ME =============

@router.get("/operator/against-me")
async def get_complaints_against_operator(
    status: Optional[ComplaintStatus] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    current_user: dict = Depends(get_current_user)
):
    """Get all complaints against current operator"""
    db = get_database()
    
    # Get operator
    operator = await db.operators.find_one({"user_id": current_user["id"]})
    if not operator:
        raise HTTPException(404, "Operator profile not found")
    
    query = {"operator_id": operator["id"]}
    if status:
        query["status"] = status.value
    
    skip = (page - 1) * limit
    
    complaints = await db.complaints.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.complaints.count_documents(query)
    
    # Count pending responses
    pending_response = await db.complaints.count_documents({
        "operator_id": operator["id"],
        "operator_response_received": False,
        "status": {"$in": [ComplaintStatus.OPEN.value, ComplaintStatus.OPERATOR_RESPONSE_PENDING.value]}
    })
    
    return {
        "complaints": complaints,
        "total": total,
        "pending_response": pending_response,
        "page": page,
        "pages": (total + limit - 1) // limit
    }


# ============= ADMIN: INVESTIGATION =============

@router.post("/admin/investigate")
async def submit_investigation(
    investigation: ComplaintInvestigationCreate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """
    Admin submits investigation findings and decision
    
    - AirYatra decides right/wrong (Document [5])
    - Decision is FINAL - no appeal
    - Penalty applied automatically if upheld
    """
    db = get_database()
    
    complaint = await db.complaints.find_one({"complaint_id": investigation.complaint_id})
    if not complaint:
        raise HTTPException(404, "Complaint not found")
    
    now = datetime.utcnow()
    
    update_data = {
        "investigated_by": current_user["id"],
        "investigation_start_date": complaint.get("investigation_start_date") or now,
        "investigation_end_date": now,
        "investigation_findings": investigation.findings,
        
        "airyatra_decision": investigation.decision.value,
        "airyatra_decision_notes": investigation.decision_notes,
        "decision_made_by": current_user["id"],
        "decision_date": now,
        
        "resolution_action": investigation.decision_notes,
        "compensation_amount": investigation.compensation_amount,
        "refund_amount": investigation.refund_amount,
        "reschedule_offered": investigation.reschedule_offered,
        
        "status": ComplaintStatus.RESOLVED.value,
        "resolved_at": now,
        "updated_at": now
    }
    
    await db.complaints.update_one(
        {"complaint_id": investigation.complaint_id},
        {"$set": update_data}
    )
    
    # If complaint upheld, check and apply penalty
    penalty = None
    if investigation.decision == ComplaintDecision.UPHELD:
        penalty = await check_and_apply_penalty(
            db, complaint["operator_id"], investigation.complaint_id
        )
    
    response = {
        "success": True,
        "complaint_id": investigation.complaint_id,
        "decision": investigation.decision.value,
        "message": "Investigation completed and decision recorded",
        "message_hi": "जांच पूरी हुई और निर्णय दर्ज हुआ"
    }
    
    if penalty:
        response["penalty_issued"] = True
        response["penalty_amount"] = penalty["penalty_amount"]
        response["penalty_rule"] = penalty["penalty_rule"]
        if penalty.get("suspension_triggered"):
            response["suspension_days"] = penalty.get("suspension_duration_days")
        if penalty.get("delisting_triggered"):
            response["operator_delisted"] = True
    
    return response


# ============= ADMIN: DASHBOARD =============

@router.get("/admin/dashboard")
async def get_complaints_dashboard(
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get complaints dashboard statistics"""
    db = get_database()
    
    # Total counts
    total = await db.complaints.count_documents({})
    open_complaints = await db.complaints.count_documents({"status": ComplaintStatus.OPEN.value})
    under_investigation = await db.complaints.count_documents({"status": ComplaintStatus.UNDER_INVESTIGATION.value})
    resolved = await db.complaints.count_documents({"status": ComplaintStatus.RESOLVED.value})
    
    # By severity
    severity_pipeline = [
        {"$group": {"_id": "$severity", "count": {"$sum": 1}}}
    ]
    severity_counts = await db.complaints.aggregate(severity_pipeline).to_list(10)
    
    # By category
    category_pipeline = [
        {"$group": {"_id": "$category", "count": {"$sum": 1}}}
    ]
    category_counts = await db.complaints.aggregate(category_pipeline).to_list(20)
    
    # Upheld rate (last 30 days)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    resolved_last_30 = await db.complaints.count_documents({
        "status": ComplaintStatus.RESOLVED.value,
        "resolved_at": {"$gte": thirty_days_ago}
    })
    upheld_last_30 = await db.complaints.count_documents({
        "airyatra_decision": ComplaintDecision.UPHELD.value,
        "decision_date": {"$gte": thirty_days_ago}
    })
    
    upheld_rate = (upheld_last_30 / resolved_last_30 * 100) if resolved_last_30 > 0 else 0
    
    # Average resolution time
    resolution_pipeline = [
        {"$match": {"status": ComplaintStatus.RESOLVED.value, "resolved_at": {"$exists": True}}},
        {"$project": {
            "resolution_time": {
                "$subtract": ["$resolved_at", "$created_at"]
            }
        }},
        {"$group": {
            "_id": None,
            "avg_time": {"$avg": "$resolution_time"}
        }}
    ]
    resolution_result = await db.complaints.aggregate(resolution_pipeline).to_list(1)
    avg_resolution_hours = 0
    if resolution_result and resolution_result[0].get("avg_time"):
        avg_resolution_hours = resolution_result[0]["avg_time"] / (1000 * 60 * 60)  # ms to hours
    
    # Pending operator response
    pending_response = await db.complaints.count_documents({
        "operator_response_received": False,
        "status": {"$in": [ComplaintStatus.OPEN.value, ComplaintStatus.OPERATOR_RESPONSE_PENDING.value]}
    })
    
    # Recent complaints
    recent = await db.complaints.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    return {
        "total_complaints": total,
        "open_complaints": open_complaints,
        "under_investigation": under_investigation,
        "resolved_complaints": resolved,
        "pending_operator_response": pending_response,
        "average_resolution_time_hours": round(avg_resolution_hours, 2),
        "upheld_rate_percent": round(upheld_rate, 1),
        "complaints_by_severity": {c["_id"]: c["count"] for c in severity_counts if c["_id"]},
        "complaints_by_category": {c["_id"]: c["count"] for c in category_counts if c["_id"]},
        "recent_complaints": recent
    }


# ============= ADMIN: ALL COMPLAINTS =============

@router.get("/admin/all")
async def get_all_complaints(
    status: Optional[ComplaintStatus] = None,
    severity: Optional[ComplaintSeverity] = None,
    category: Optional[ComplaintCategory] = None,
    operator_id: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get all complaints with filters"""
    db = get_database()
    
    query = {}
    if status:
        query["status"] = status.value
    if severity:
        query["severity"] = severity.value
    if category:
        query["category"] = category.value
    if operator_id:
        query["operator_id"] = operator_id
    if search:
        query["$or"] = [
            {"complaint_number": {"$regex": search, "$options": "i"}},
            {"subject": {"$regex": search, "$options": "i"}},
            {"customer_name": {"$regex": search, "$options": "i"}}
        ]
    
    skip = (page - 1) * limit
    
    complaints = await db.complaints.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.complaints.count_documents(query)
    
    return {
        "complaints": complaints,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }


# ============= PENALTIES =============

@router.get("/penalties/operator/{operator_id}")
async def get_operator_penalties(
    operator_id: str,
    status: Optional[PenaltyStatus] = None,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get all penalties for an operator"""
    db = get_database()
    
    query = {"operator_id": operator_id}
    if status:
        query["status"] = status.value
    
    penalties = await db.penalties.find(
        query, {"_id": 0}
    ).sort("issued_at", -1).to_list(50)
    
    # Calculate totals
    total_amount = sum(p.get("penalty_amount", 0) for p in penalties)
    paid_amount = sum(p.get("payment_amount", 0) for p in penalties if p.get("status") == PenaltyStatus.PAID.value)
    pending_amount = total_amount - paid_amount
    
    return {
        "penalties": penalties,
        "total_count": len(penalties),
        "total_amount": total_amount,
        "paid_amount": paid_amount,
        "pending_amount": pending_amount
    }


@router.post("/penalties/{penalty_id}/mark-paid")
async def mark_penalty_paid(
    penalty_id: str,
    payment_amount: int = Query(...),
    payment_receipt_url: Optional[str] = None,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Mark a penalty as paid"""
    db = get_database()
    
    penalty = await db.penalties.find_one({"penalty_id": penalty_id})
    if not penalty:
        raise HTTPException(404, "Penalty not found")
    
    await db.penalties.update_one(
        {"penalty_id": penalty_id},
        {"$set": {
            "status": PenaltyStatus.PAID.value,
            "payment_amount": payment_amount,
            "payment_received_date": datetime.utcnow(),
            "payment_receipt_url": payment_receipt_url,
            "updated_at": datetime.utcnow()
        }}
    )
    
    return {
        "success": True,
        "message": "Penalty marked as paid",
        "penalty_id": penalty_id
    }
