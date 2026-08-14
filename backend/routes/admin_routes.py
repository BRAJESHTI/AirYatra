from fastapi import APIRouter, HTTPException, Depends
from database import get_database
from middleware import get_current_user, require_roles
from models import UserRole, OperatorStatus, ApprovalStatus
import uuid
from uuid import uuid4
from datetime import datetime, timezone, timedelta
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["Admin"])

# Major Indian Helipads/Airports with default landing charges
MAJOR_LANDING_POINTS = [
    {"name": "Juhu Aerodrome", "city": "Mumbai", "state": "Maharashtra", "type": "airport", "lat": 19.0988, "lng": 72.8347, "rent": 15000, "icao": "VAJJ"},
    {"name": "Pawan Hans Helipad", "city": "Mumbai", "state": "Maharashtra", "type": "govt_helipad", "lat": 19.0759, "lng": 72.8776, "rent": 12000},
    {"name": "NSCI Dome Helipad", "city": "Mumbai", "state": "Maharashtra", "type": "private_helipad", "lat": 19.0178, "lng": 72.8308, "rent": 18000},
    {"name": "IGI Airport T3", "city": "Delhi", "state": "Delhi", "type": "airport", "lat": 28.5562, "lng": 77.1000, "rent": 25000, "icao": "VIDP"},
    {"name": "Safdarjung Airport", "city": "Delhi", "state": "Delhi", "type": "airport", "lat": 28.5844, "lng": 77.2060, "rent": 10000, "icao": "VIDD"},
    {"name": "HAL Airport", "city": "Bangalore", "state": "Karnataka", "type": "airport", "lat": 12.9500, "lng": 77.6682, "rent": 12000, "icao": "VOBG"},
    {"name": "Kempegowda Intl", "city": "Bangalore", "state": "Karnataka", "type": "airport", "lat": 13.1986, "lng": 77.7066, "rent": 20000, "icao": "VOBL"},
    {"name": "Chhatrapati Shivaji Intl", "city": "Mumbai", "state": "Maharashtra", "type": "airport", "lat": 19.0896, "lng": 72.8656, "rent": 30000, "icao": "VABB"},
    {"name": "Pune Airport", "city": "Pune", "state": "Maharashtra", "type": "airport", "lat": 18.5821, "lng": 73.9197, "rent": 15000, "icao": "VAPO"},
    {"name": "Jaipur Airport", "city": "Jaipur", "state": "Rajasthan", "type": "airport", "lat": 26.8242, "lng": 75.8122, "rent": 12000, "icao": "VIJP"},
    {"name": "Lucknow Airport", "city": "Lucknow", "state": "Uttar Pradesh", "type": "airport", "lat": 26.7606, "lng": 80.8893, "rent": 10000, "icao": "VILK"},
    {"name": "Varanasi Airport", "city": "Varanasi", "state": "Uttar Pradesh", "type": "airport", "lat": 25.4524, "lng": 82.8593, "rent": 8000, "icao": "VIBN"},
    {"name": "Kedarnath Helipad", "city": "Kedarnath", "state": "Uttarakhand", "type": "govt_helipad", "lat": 30.7352, "lng": 79.0669, "rent": 5000},
    {"name": "Badrinath Helipad", "city": "Badrinath", "state": "Uttarakhand", "type": "govt_helipad", "lat": 30.7433, "lng": 79.4938, "rent": 5000},
    {"name": "Shirdi Airport", "city": "Shirdi", "state": "Maharashtra", "type": "airport", "lat": 19.6889, "lng": 74.3789, "rent": 8000, "icao": "VASD"},
    {"name": "Ahmedabad Airport", "city": "Ahmedabad", "state": "Gujarat", "type": "airport", "lat": 23.0772, "lng": 72.6347, "rent": 15000, "icao": "VAAH"},
    {"name": "Hyderabad Intl", "city": "Hyderabad", "state": "Telangana", "type": "airport", "lat": 17.2403, "lng": 78.4294, "rent": 18000, "icao": "VOHS"},
    {"name": "Chennai Intl", "city": "Chennai", "state": "Tamil Nadu", "type": "airport", "lat": 12.9941, "lng": 80.1709, "rent": 18000, "icao": "VOMM"},
    {"name": "Kolkata Airport", "city": "Kolkata", "state": "West Bengal", "type": "airport", "lat": 22.6547, "lng": 88.4467, "rent": 15000, "icao": "VECC"},
    {"name": "Goa Dabolim", "city": "Goa", "state": "Goa", "type": "airport", "lat": 15.3808, "lng": 73.8314, "rent": 12000, "icao": "VAGO"},
]

@router.post("/seed-landing-points")
async def seed_landing_points(
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Seed major landing points with default landing charges"""
    db = get_database()
    
    created = 0
    updated = 0
    
    for lp in MAJOR_LANDING_POINTS:
        point_id = str(uuid4())
        
        # Check if already exists
        existing = await db.landing_points.find_one({
            "name": lp["name"],
            "city": lp["city"]
        })
        
        if existing:
            # Update rent if exists
            await db.landing_points.update_one(
                {"_id": existing["_id"]},
                {"$set": {"rent_per_landing": lp["rent"], "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            updated += 1
            continue
        
        landing_point = {
            "id": point_id,
            "landing_point_id": point_id,
            "landing_point_name": lp["name"],
            "name": lp["name"],
            "type": lp["type"],
            "landing_point_type": lp["type"],
            "city": lp["city"],
            "state": lp["state"],
            "latitude": lp["lat"],
            "longitude": lp["lng"],
            "rent_per_landing": lp["rent"],
            "rent": lp["rent"],
            "rent_applicable": True,
            "permission_required": False,
            "icao_code": lp.get("icao"),
            "is_active": True,
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "created_by": user["id"]
        }
        
        await db.landing_points.insert_one(landing_point)
        created += 1
    
    logger.info(f"Landing points seeded: {created} created, {updated} updated by {user['email']}")
    
    return {
        "message": f"Landing points seeded successfully",
        "created": created,
        "updated": updated,
        "total": len(MAJOR_LANDING_POINTS)
    }

@router.get("/dashboard")
async def get_admin_dashboard(user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))):
    """Get comprehensive admin dashboard statistics"""
    db = get_database()
    
    # Get current date ranges
    now = datetime.now(timezone.utc)
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
async def get_all_operators(user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE])), status: str = None):
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
        "verified_at": datetime.now(timezone.utc).isoformat(),
        "verification_notes": notes,
        "updated_at": datetime.now(timezone.utc).isoformat()
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
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.audit_logs.insert_one(audit_log.copy())
    
    return {"message": f"Operator {status}", "operator_id": operator_id}

@router.post("/seed-operators")
async def seed_demo_operators(user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))):
    """Seed demo operators for testing - Admin only"""
    db = get_database()
    
    # Get operator users
    operator_user = await db.users.find_one({"email": "operator@airyatra.com"}, {"_id": 0})
    pilot_user = await db.users.find_one({"email": "pilot@airyatra.com"}, {"_id": 0})
    
    demo_operators = [
        {
            "id": str(uuid.uuid4()),
            "user_id": operator_user["id"] if operator_user else str(uuid.uuid4()),
            "company_name": "Mumbai Heli Services",
            "contact_name": "Rajesh Sharma",
            "contact_phone": "+919876543210",
            "contact_email": "operator@airyatra.com",
            "base_city": "Mumbai",
            "base_state": "Maharashtra",
            "base_latitude": 19.0760,
            "base_longitude": 72.8777,
            "status": "active",
            "verification_status": "verified",
            "verified_at": datetime.now(timezone.utc).isoformat(),
            "total_aircraft": 3,
            "rating": 4.8,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "user_id": pilot_user["id"] if pilot_user else str(uuid.uuid4()),
            "company_name": "Pune Air Charter",
            "contact_name": "Captain Pilot",
            "contact_phone": "+919876543211",
            "contact_email": "pilot@airyatra.com",
            "base_city": "Pune",
            "base_state": "Maharashtra",
            "base_latitude": 18.5204,
            "base_longitude": 73.8567,
            "status": "active",
            "verification_status": "verified",
            "verified_at": datetime.now(timezone.utc).isoformat(),
            "total_aircraft": 2,
            "rating": 4.5,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "user_id": str(uuid.uuid4()),
            "company_name": "Delhi Sky Aviation",
            "contact_name": "Vikram Singh",
            "contact_phone": "+919876543212",
            "contact_email": "delhi.sky@airyatra.com",
            "base_city": "Delhi",
            "base_state": "Delhi",
            "base_latitude": 28.7041,
            "base_longitude": 77.1025,
            "status": "active",
            "verification_status": "verified",
            "verified_at": datetime.now(timezone.utc).isoformat(),
            "total_aircraft": 5,
            "rating": 4.9,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    created = 0
    for op in demo_operators:
        existing = await db.operators.find_one({"company_name": op["company_name"]})
        if not existing:
            await db.operators.insert_one(op.copy())
            created += 1
            logger.info(f"Created operator: {op['company_name']} in {op['base_city']}")
    
    return {"message": f"Seeded {created} demo operators", "total_operators": len(demo_operators)}

@router.put("/operators/{operator_id}/location")
async def update_operator_location(operator_id: str, data: dict, user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))):
    """Update operator base location coordinates"""
    db = get_database()
    
    operator = await db.operators.find_one({"id": operator_id}, {"_id": 0})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    
    update_data = {
        "base_latitude": data.get("base_latitude"),
        "base_longitude": data.get("base_longitude"),
        "base_state": data.get("base_state", operator.get("base_state")),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.operators.update_one(
        {"id": operator_id},
        {"$set": update_data}
    )
    
    return {"message": "Operator location updated", "operator_id": operator_id}

@router.get("/bookings")
async def get_all_bookings(user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])), status: str = None, limit: int = 100):
    """Get all bookings (bookings + inquiries merged) with customer & operator (aviation company) enrichment"""
    db = get_database()
    
    query = {}
    if status:
        query["status"] = status
    
    bookings = await db.bookings.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    inquiries = await db.inquiries.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)

    seen_ids = {b.get("id") for b in bookings}
    for inq in inquiries:
        if inq.get("id") in seen_ids:
            continue
        inq["booking_number"] = inq.get("booking_number") or inq.get("inquiry_number")
        inq["from_location"] = inq.get("from_location") or inq.get("pickup_location")
        inq["to_location"] = inq.get("to_location") or inq.get("drop_location")
        aq = inq.get("accepted_quote") or {}
        inq["total_amount"] = inq.get("total_amount") or (aq.get("amount") if isinstance(aq, dict) else None) or inq.get("estimated_price") or 0
        inq["source"] = "inquiry"
        bookings.append(inq)

    bookings.sort(key=lambda b: b.get("created_at") or "", reverse=True)
    bookings = bookings[:limit]

    # Batch enrich customers
    customer_ids = {b.get("customer_id") for b in bookings if b.get("customer_id")}
    customers = {}
    if customer_ids:
        async for c in db.users.find({"id": {"$in": list(customer_ids)}}, {"_id": 0, "id": 1, "full_name": 1, "email": 1, "phone": 1, "profile_picture": 1}):
            customers[c["id"]] = c

    # Batch enrich operators (aviation company names): operator_id may be operators.id OR users.id
    operator_ids = set()
    for b in bookings:
        aq = b.get("accepted_quote") or {}
        op_id = b.get("operator_id") or (aq.get("operator_id") if isinstance(aq, dict) else None)
        if op_id:
            b["_resolved_operator_id"] = op_id
            operator_ids.add(op_id)
    operators = {}
    if operator_ids:
        id_list = list(operator_ids)
        async for op in db.operators.find({"$or": [{"id": {"$in": id_list}}, {"user_id": {"$in": id_list}}]},
                                          {"_id": 0, "id": 1, "user_id": 1, "company_name": 1}):
            if op.get("id"):
                operators[op["id"]] = op.get("company_name")
            if op.get("user_id"):
                operators.setdefault(op["user_id"], op.get("company_name"))
        missing = [i for i in id_list if i not in operators]
        if missing:
            async for u in db.users.find({"id": {"$in": missing}}, {"_id": 0, "id": 1, "full_name": 1, "company_name": 1}):
                operators[u["id"]] = u.get("company_name") or u.get("full_name")

    for booking in bookings:
        customer = customers.get(booking.get("customer_id"))
        if customer:
            booking["customer_name"] = booking.get("customer_name") or customer.get("full_name")
            booking["customer_email"] = booking.get("customer_email") or customer.get("email")
            booking["customer_phone"] = booking.get("customer_phone") or customer.get("phone")
            booking["customer_profile_picture"] = customer.get("profile_picture")
        op_id = booking.pop("_resolved_operator_id", None)
        if op_id and operators.get(op_id):
            booking["operator_name"] = operators[op_id]
    
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
            "reassigned_at": datetime.now(timezone.utc).isoformat(),
            "reassignment_reason": reason,
            "previous_operator_id": old_operator_id,
            "updated_at": datetime.now(timezone.utc).isoformat()
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
        "created_at": datetime.now(timezone.utc).isoformat()
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
            "force_assigned_at": datetime.now(timezone.utc).isoformat(),
            "override_reason": override_reason,
            "updated_at": datetime.now(timezone.utc).isoformat()
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
        "created_at": datetime.now(timezone.utc).isoformat()
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


# ==================== COMMISSION SETTINGS ====================

@router.get("/commission-settings")
async def get_commission_settings(
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Get global commission settings"""
    db = get_database()
    
    settings = await db.settings.find_one({"type": "commission_settings"}, {"_id": 0})
    
    if not settings:
        # Return defaults
        return {
            "default_operator_rate": 85,
            "platform_fee": 15,
            "gst_rate": 18
        }
    
    return {
        "default_operator_rate": settings.get("default_operator_rate", 85),
        "platform_fee": settings.get("platform_fee", 15),
        "gst_rate": settings.get("gst_rate", 18)
    }


@router.put("/commission-settings")
async def update_commission_settings(
    data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Update global commission settings"""
    db = get_database()
    
    # Validate rates
    operator_rate = float(data.get("default_operator_rate", 85))
    platform_fee = float(data.get("platform_fee", 15))
    gst_rate = float(data.get("gst_rate", 18))
    
    if operator_rate < 50 or operator_rate > 95:
        raise HTTPException(status_code=400, detail="Operator rate must be between 50% and 95%")
    
    if platform_fee < 5 or platform_fee > 50:
        raise HTTPException(status_code=400, detail="Platform fee must be between 5% and 50%")
    
    # Ensure operator_rate + platform_fee = 100
    if abs((operator_rate + platform_fee) - 100) > 0.01:
        raise HTTPException(status_code=400, detail="Operator rate + Platform fee must equal 100%")
    
    settings_data = {
        "type": "commission_settings",
        "default_operator_rate": operator_rate,
        "platform_fee": platform_fee,
        "gst_rate": gst_rate,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user["id"]
    }
    
    await db.settings.update_one(
        {"type": "commission_settings"},
        {"$set": settings_data},
        upsert=True
    )
    
    # Log audit
    audit_log = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "user_name": current_user.get("full_name", "Admin"),
        "action": "update_commission_settings",
        "entity_type": "settings",
        "entity_id": "commission_settings",
        "changes": settings_data,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.audit_logs.insert_one(audit_log.copy())
    
    return {"message": "Commission settings updated successfully"}


@router.put("/operators/{operator_id}/commission")
async def update_operator_commission(
    operator_id: str,
    data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Update custom commission rate for specific operator"""
    db = get_database()
    
    operator = await db.operators.find_one({"id": operator_id}, {"_id": 0})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    
    rate = float(data.get("commission_rate", 85))
    
    if rate < 50 or rate > 95:
        raise HTTPException(status_code=400, detail="Commission rate must be between 50% and 95%")
    
    await db.operators.update_one(
        {"id": operator_id},
        {"$set": {
            "commission_rate": rate,
            "commission_updated_at": datetime.now(timezone.utc).isoformat(),
            "commission_updated_by": current_user["id"]
        }}
    )
    
    # Log audit
    audit_log = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "user_name": current_user.get("full_name", "Admin"),
        "action": "update_operator_commission",
        "entity_type": "operator",
        "entity_id": operator_id,
        "changes": {"commission_rate": rate, "operator_name": operator.get("company_name")},
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.audit_logs.insert_one(audit_log.copy())
    
    return {"message": f"Commission rate updated to {rate}% for {operator.get('company_name')}"}
