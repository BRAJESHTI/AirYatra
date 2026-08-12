from fastapi import APIRouter, HTTPException, Depends, Query
from database import get_database
from models import Operator, OperatorStatus, ApprovalStatus
from middleware import get_current_user
import uuid
from uuid import uuid4
from datetime import datetime, timezone, timedelta
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
    
    # Default coordinates for major cities
    city_coords = {
        "mumbai": (19.0760, 72.8777),
        "delhi": (28.7041, 77.1025),
        "pune": (18.5204, 73.8567),
        "bangalore": (12.9716, 77.5946),
        "chennai": (13.0827, 80.2707),
        "kolkata": (22.5726, 88.3639),
        "hyderabad": (17.3850, 78.4867),
        "ahmedabad": (23.0225, 72.5714),
        "jaipur": (26.9124, 75.7873),
        "lucknow": (26.8467, 80.9462)
    }
    
    base_city = profile_data["base_city"].lower()
    default_lat, default_lon = city_coords.get(base_city, (28.6139, 77.209))  # Default to Delhi
    
    operator_id = str(uuid.uuid4())
    operator = {
        "id": operator_id,
        "user_id": user["id"],
        "company_name": profile_data["company_name"],
        "base_city": profile_data["base_city"],
        "base_state": profile_data.get("base_state", ""),
        "base_latitude": profile_data.get("base_latitude", default_lat),
        "base_longitude": profile_data.get("base_longitude", default_lon),
        "contact_person": profile_data.get("contact_person", user.get("full_name", "")),
        "contact_phone": profile_data.get("contact_phone", user.get("phone", "")),
        "contact_email": profile_data.get("contact_email", user.get("email", "")),
        "gstin": profile_data.get("gstin"),
        "bank_account": profile_data.get("bank_account"),
        "status": OperatorStatus.PENDING.value,
        "verification_status": ApprovalStatus.PENDING.value,
        "documents": [],
        "commission_rate": 10.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
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
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
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
    
    required = ["full_name", "license_number", "phone", "email", "experience_years"]
    missing = [f for f in required if not pilot_data.get(f) and pilot_data.get(f) != 0]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required fields: {', '.join(missing)}")
    
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
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
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
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
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
    


# ============== QUOTE MANAGEMENT ==============

@router.get("/quote-requests")
async def get_quote_requests(user: dict = Depends(get_current_user)):
    """Get all quote requests for operator"""
    db = get_database()
    
    if "operator" not in user["roles"]:
        raise HTTPException(status_code=403, detail="Operator role required")
    
    operator = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator profile not found")
    
    # Get all bookings with quote_requested status or assigned to this operator
    query = {
        "$or": [
            {"status": "quote_requested"},
            {"operator_id": operator["id"], "status": {"$in": ["quote_sent", "quote_accepted", "quote_rejected"]}}
        ]
    }
    
    bookings = await db.bookings.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Check if operator has already quoted
    for booking in bookings:
        quote = await db.quotes.find_one(
            {"booking_id": booking["id"], "operator_id": operator["id"]},
            {"_id": 0}
        )
        if quote:
            booking["your_quote"] = quote.get("amount")
            booking["quote_status"] = quote.get("status")
    
    return {"requests": bookings}

@router.post("/submit-quote")
async def submit_revised_quote(quote_data: dict, user: dict = Depends(get_current_user)):
    """Submit or revise a quote for a booking"""
    db = get_database()
    
    if "operator" not in user["roles"]:
        raise HTTPException(status_code=403, detail="Operator role required")
    
    operator = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator profile not found")
    
    booking_id = quote_data.get("booking_id")
    if not booking_id:
        raise HTTPException(status_code=400, detail="Booking ID required")
    
    # Verify booking exists
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Check if quote already exists
    existing_quote = await db.quotes.find_one(
        {"booking_id": booking_id, "operator_id": operator["id"]},
        {"_id": 0}
    )
    
    quote_id = existing_quote["id"] if existing_quote else str(uuid.uuid4())
    
    validity_hours = quote_data.get("validity_hours", 24)

    # City/route-wise platform fee auto-apply (admin-set rules)
    from services.platform_fee_service import resolve_platform_fee, compute_platform_fee
    fee_rule = await resolve_platform_fee(
        db,
        booking.get("from_location") or booking.get("pickup_location", ""),
        booking.get("to_location") or booking.get("drop_location", ""),
    )
    try:
        operator_payout = float(quote_data["amount"])
        if operator_payout <= 0:
            raise ValueError
    except (ValueError, TypeError, KeyError):
        raise HTTPException(status_code=400, detail="Valid quote amount required")
    platform_fee = compute_platform_fee(operator_payout, fee_rule)
    customer_total = round(operator_payout + platform_fee, 2)

    quote = {
        "id": quote_id,
        "booking_id": booking_id,
        "operator_id": operator["id"],
        "operator_name": operator["company_name"],
        "customer_id": booking.get("user_id") or booking.get("customer_id"),
        "amount": customer_total,
        "quoted_price": customer_total,
        "operator_payout": operator_payout,
        "platform_fee": platform_fee,
        "platform_fee_rule": fee_rule.get("label"),
        "aircraft_id": quote_data.get("aircraft_id"),
        "breakdown": quote_data.get("breakdown", {}),
        "validity_hours": validity_hours,
        "valid_until": (datetime.now(timezone.utc) + timedelta(hours=validity_hours)).isoformat(),
        "notes": quote_data.get("notes", ""),
        "status": "sent",
        "revision_count": (existing_quote.get("revision_count", 0) + 1) if existing_quote else 1,
        "created_at": existing_quote.get("created_at") if existing_quote else datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if existing_quote:
        await db.quotes.update_one({"id": quote_id}, {"$set": quote})
    else:
        await db.quotes.insert_one(quote.copy())
    
    # Update booking status
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "status": "quote_sent",
            "latest_quote": {
                "operator_id": operator["id"],
                "operator_name": operator["company_name"],
                "amount": quote_data["amount"],
                "sent_at": datetime.now(timezone.utc).isoformat()
            }
        }}
    )
    
    # Notify customer instantly (in-app notification with sound on frontend)
    customer_user_id = booking.get("customer_id") or booking.get("user_id")
    if customer_user_id:
        await db.in_app_notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": customer_user_id,
            "type": "quote_received",
            "title": f"✈️ New Quote Received - ₹{customer_total:,.0f}",
            "message": f"{operator['company_name']} ne aapki booking {booking.get('booking_number', booking_id[:8])} ke liye quote bheja hai. Abhi review karein!",
            "reference_id": booking_id,
            "data": {"quote_id": quote_id, "amount": quote_data["amount"], "operator_name": operator["company_name"]},
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {"message": "Quote submitted successfully", "quote_id": quote_id}

@router.get("/my-quotes")
async def get_my_quotes(user: dict = Depends(get_current_user)):
    """Get all quotes submitted by operator"""
    db = get_database()
    
    if "operator" not in user["roles"]:
        raise HTTPException(status_code=403, detail="Operator role required")
    
    operator = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator profile not found")
    
    quotes = await db.quotes.find(
        {"operator_id": operator["id"]},
        {"_id": 0}
    ).sort("updated_at", -1).to_list(100)
    
    # Enrich with booking details
    for quote in quotes:
        booking = await db.bookings.find_one(
            {"id": quote["booking_id"]},
            {"_id": 0, "booking_number": 1, "from_location": 1, "to_location": 1, "departure_date": 1}
        )
        if booking:
            quote["booking_details"] = booking
    
    return {"quotes": quotes}


# ==================== OPERATOR REVENUE DASHBOARD ====================

@router.get("/revenue/dashboard")
async def get_operator_revenue_dashboard(user: dict = Depends(get_current_user)):
    """Get operator's revenue dashboard with earnings, commission breakdown, payouts"""
    from datetime import timedelta
    db = get_database()
    
    if "operator" not in user.get("roles", []):
        raise HTTPException(status_code=403, detail="Operator access required")
    
    # Get operator profile
    operator = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0})
    if not operator:
        return {
            "stats": {"total_earnings": 0, "month_earnings": 0, "pending_payout": 0, "commission_rate": 85},
            "monthly_breakdown": [],
            "recent_payouts": [],
            "commission_breakdown": {}
        }
    
    operator_id = operator["id"]
    now = datetime.now(timezone.utc)
    
    # Get all completed bookings/inquiries for this operator
    completed_inquiries = await db.inquiries.find(
        {
            "assigned_operator_id": operator_id,
            "payment_status": {"$in": ["paid", "fully_paid"]}
        },
        {"_id": 0, "id": 1, "accepted_quote": 1, "estimated_price": 1, "payment_status": 1,
         "departure_date": 1, "created_at": 1, "paid_at": 1}
    ).to_list(500)
    
    # Calculate total earnings
    total_gross = 0
    month_gross = 0
    current_month = now.strftime("%Y-%m")
    
    for inq in completed_inquiries:
        amount = float((inq.get("accepted_quote") or {}).get("amount") or inq.get("estimated_price") or 0)
        total_gross += amount
        
        # Check if this month
        paid_at = inq.get("paid_at") or inq.get("created_at") or ""
        if paid_at.startswith(current_month):
            month_gross += amount
    
    # Commission calculation (operator gets 85%, platform 15%)
    commission_rate = 85
    platform_fee_rate = 15
    tax_rate = 18  # GST
    
    platform_fee = total_gross * (platform_fee_rate / 100)
    operator_share_before_tax = total_gross - platform_fee
    taxes = operator_share_before_tax * (tax_rate / 100)
    operator_share = operator_share_before_tax - taxes
    
    # Monthly breakdown (last 6 months)
    monthly_data = {}
    for i in range(6):
        month_date = datetime(now.year, now.month, 1) - timedelta(days=30*i)
        month_key = month_date.strftime("%Y-%m")
        month_label = month_date.strftime("%b %Y")
        monthly_data[month_key] = {"month": month_label, "earnings": 0, "flights": 0}
    
    for inq in completed_inquiries:
        paid_at = inq.get("paid_at") or inq.get("created_at") or ""
        month_key = paid_at[:7] if paid_at else ""
        if month_key in monthly_data:
            amount = float((inq.get("accepted_quote") or {}).get("amount") or inq.get("estimated_price") or 0)
            monthly_data[month_key]["earnings"] += amount * (commission_rate / 100)
            monthly_data[month_key]["flights"] += 1
    
    monthly_breakdown = sorted(monthly_data.values(), key=lambda x: x["month"])
    
    # Get payouts
    payouts = await db.operator_payouts.find(
        {"operator_id": operator_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    # Calculate pending payout (earnings not yet paid out)
    total_paid_out = sum(float(p.get("amount", 0)) for p in payouts if p.get("status") == "paid")
    pending_payout = max(0, operator_share - total_paid_out)
    
    return {
        "stats": {
            "total_earnings": round(operator_share, 2),
            "month_earnings": round(month_gross * (commission_rate / 100), 2),
            "pending_payout": round(pending_payout, 2),
            "commission_rate": commission_rate,
            "completed_flights": len(completed_inquiries),
            "month_flights": sum(1 for inq in completed_inquiries if (inq.get("paid_at") or "").startswith(current_month)),
            "next_payout_date": "15th of month",
        },
        "monthly_breakdown": monthly_breakdown,
        "recent_payouts": payouts,
        "commission_breakdown": {
            "gross_value": round(total_gross, 2),
            "platform_fee": round(platform_fee, 2),
            "taxes": round(taxes, 2),
            "operator_share": round(operator_share, 2),
        }
    }


# ==================== FLEET ANALYTICS ====================

@router.get("/fleet/analytics")
async def get_fleet_analytics(user: dict = Depends(get_current_user)):
    """Get operator's fleet analytics - utilization, maintenance, performance metrics"""
    from datetime import timedelta
    db = get_database()
    
    if "operator" not in user.get("roles", []):
        raise HTTPException(status_code=403, detail="Operator access required")
    
    # Get operator profile
    operator = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0})
    if not operator:
        return {
            "summary": {"total_aircraft": 0, "active_aircraft": 0, "avg_utilization": 0, "total_flight_hours": 0, "maintenance_due": 0},
            "fleet": [],
            "utilization_trend": []
        }
    
    operator_id = operator["id"]
    now = datetime.now(timezone.utc)
    current_month = now.strftime("%Y-%m")
    
    # Get all aircraft for this operator
    aircraft_list = await db.aircraft.find(
        {"operator_id": operator_id},
        {"_id": 0}
    ).to_list(100)
    
    # Get flight records for analytics
    flight_records = await db.flight_records.find(
        {"operator_id": operator_id},
        {"_id": 0}
    ).to_list(1000)
    
    # Calculate metrics per aircraft
    fleet_data = []
    total_hours = 0
    total_month_hours = 0
    maintenance_due_count = 0
    
    for aircraft in aircraft_list:
        aircraft_id = aircraft.get("id")
        registration = aircraft.get("registration") or aircraft.get("name", "Unknown")
        model = aircraft.get("model") or aircraft.get("type", "Helicopter")
        
        # Get flight hours for this aircraft
        aircraft_flights = [f for f in flight_records if f.get("aircraft_id") == aircraft_id]
        aircraft_total_hours = sum(float(f.get("flight_hours", 0) or f.get("duration", 0) or 0) for f in aircraft_flights)
        
        # This month hours
        month_flights = [f for f in aircraft_flights if (f.get("flight_date") or f.get("created_at") or "").startswith(current_month)]
        month_hours = sum(float(f.get("flight_hours", 0) or f.get("duration", 0) or 0) for f in month_flights)
        
        total_hours += aircraft_total_hours
        total_month_hours += month_hours
        
        # Calculate utilization rate (target: 100h/month = 100%)
        utilization_rate = min(100, round((month_hours / 100) * 100))
        
        # Maintenance status
        last_maintenance_hours = float(aircraft.get("last_maintenance_hours", 0) or 0)
        hours_since_maintenance = aircraft_total_hours - last_maintenance_hours
        
        if hours_since_maintenance >= 100:
            maintenance_status = "overdue"
            maintenance_due_count += 1
        elif hours_since_maintenance >= 80:
            maintenance_status = "due_soon"
            maintenance_due_count += 1
        else:
            maintenance_status = "good"
        
        # Get maintenance dates
        last_maintenance = aircraft.get("last_maintenance_date")
        next_maintenance = aircraft.get("next_maintenance_date")
        
        fleet_data.append({
            "id": aircraft_id,
            "registration": registration,
            "name": registration,
            "model": model,
            "total_hours": round(aircraft_total_hours, 1),
            "month_hours": round(month_hours, 1),
            "utilization_rate": utilization_rate,
            "hours_since_maintenance": round(hours_since_maintenance, 1),
            "maintenance_status": maintenance_status,
            "last_maintenance": last_maintenance,
            "next_maintenance": next_maintenance,
            "fuel_efficiency": aircraft.get("fuel_consumption", 150),
            "is_active": aircraft.get("is_active", True)
        })
    
    # Calculate average utilization
    avg_utilization = round(sum(a["utilization_rate"] for a in fleet_data) / len(fleet_data)) if fleet_data else 0
    
    # Monthly utilization trend (last 6 months)
    utilization_trend = []
    for i in range(6):
        month_date = datetime(now.year, now.month, 1) - timedelta(days=30*i)
        month_key = month_date.strftime("%Y-%m")
        month_label = month_date.strftime("%b %Y")
        
        month_flights = [f for f in flight_records if (f.get("flight_date") or f.get("created_at") or "").startswith(month_key)]
        month_total_hours = sum(float(f.get("flight_hours", 0) or f.get("duration", 0) or 0) for f in month_flights)
        
        # Target hours = aircraft count * 100
        target_hours = len(aircraft_list) * 100 if aircraft_list else 100
        rate = min(100, round((month_total_hours / target_hours) * 100)) if target_hours > 0 else 0
        
        utilization_trend.append({
            "month": month_label,
            "rate": rate,
            "hours": round(month_total_hours, 1)
        })
    
    utilization_trend.reverse()  # Oldest first
    
    return {
        "summary": {
            "total_aircraft": len(aircraft_list),
            "active_aircraft": sum(1 for a in fleet_data if a.get("is_active", True)),
            "avg_utilization": avg_utilization,
            "total_flight_hours": round(total_hours, 1),
            "maintenance_due": maintenance_due_count
        },
        "fleet": fleet_data,
        "utilization_trend": utilization_trend
    }


# ============== PILOT ASSIGNMENT CALENDAR ==============

@router.get("/pilots/availability")
async def get_pilots_availability(
    month: int = Query(None),
    year: int = Query(None),
    user: dict = Depends(get_current_user)
):
    """Get pilot availability calendar for assignment"""
    db = get_database()
    
    if "operator" not in user.get("roles", []):
        raise HTTPException(status_code=403, detail="Operator access required")
    
    operator = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0})
    if not operator:
        return {"pilots": [], "bookings": [], "assignments": []}
    
    now = datetime.now(timezone.utc)
    target_month = month or now.month
    target_year = year or now.year
    
    # Build date range
    month_start = datetime(target_year, target_month, 1, tzinfo=timezone.utc)
    if target_month == 12:
        month_end = datetime(target_year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        month_end = datetime(target_year, target_month + 1, 1, tzinfo=timezone.utc)
    
    # Get all pilots
    pilots = await db.pilots.find(
        {"operator_id": operator["id"]},
        {"_id": 0}
    ).to_list(100)
    
    # Get bookings needing pilot assignment in this month
    bookings = await db.inquiries.find(
        {
            "operator_id": operator["id"],
            "status": {"$in": ["confirmed", "assigned", "quoted"]},
            "$or": [
                {"departure_date": {"$gte": month_start.isoformat(), "$lt": month_end.isoformat()}},
                {"travel_date": {"$gte": month_start.isoformat(), "$lt": month_end.isoformat()}}
            ]
        },
        {"_id": 0, "id": 1, "from_location": 1, "to_location": 1, "origin": 1, "destination": 1, 
         "departure_date": 1, "travel_date": 1, "customer_name": 1, "assigned_pilot_id": 1, "status": 1}
    ).to_list(500)
    
    # Get existing pilot assignments
    assignments = await db.pilot_assignments.find(
        {
            "operator_id": operator["id"],
            "date": {"$gte": month_start.isoformat(), "$lt": month_end.isoformat()}
        },
        {"_id": 0}
    ).to_list(500)
    
    # Build pilot availability map
    pilot_calendar = {}
    for pilot in pilots:
        pilot_id = pilot.get("id")
        pilot_calendar[pilot_id] = {
            "pilot": {
                "id": pilot_id,
                "name": pilot.get("name"),
                "license_number": pilot.get("license_number"),
                "phone": pilot.get("phone")
            },
            "assignments": [],
            "unavailable_dates": pilot.get("unavailable_dates", [])
        }
    
    # Map assignments to pilots
    for assignment in assignments:
        pilot_id = assignment.get("pilot_id")
        if pilot_id in pilot_calendar:
            pilot_calendar[pilot_id]["assignments"].append(assignment)
    
    # Format bookings
    formatted_bookings = []
    for b in bookings:
        date = b.get("departure_date") or b.get("travel_date")
        formatted_bookings.append({
            "id": b.get("id"),
            "date": date,
            "route": f"{b.get('from_location') or b.get('origin', 'N/A')} → {b.get('to_location') or b.get('destination', 'N/A')}",
            "customer": b.get("customer_name"),
            "assigned_pilot_id": b.get("assigned_pilot_id"),
            "status": b.get("status")
        })
    
    return {
        "month": target_month,
        "year": target_year,
        "pilots": list(pilot_calendar.values()),
        "bookings": formatted_bookings,
        "total_pilots": len(pilots),
        "unassigned_bookings": len([b for b in formatted_bookings if not b.get("assigned_pilot_id")])
    }


@router.post("/pilots/assign")
async def assign_pilot_to_booking(
    data: dict,
    user: dict = Depends(get_current_user)
):
    """Assign a pilot to a booking"""
    db = get_database()
    
    if "operator" not in user.get("roles", []):
        raise HTTPException(status_code=403, detail="Operator access required")
    
    booking_id = data.get("booking_id")
    pilot_id = data.get("pilot_id")
    
    if not booking_id or not pilot_id:
        raise HTTPException(status_code=400, detail="booking_id and pilot_id required")
    
    operator = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    
    # Get booking
    booking = await db.inquiries.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Get pilot
    pilot = await db.pilots.find_one({"id": pilot_id, "operator_id": operator["id"]}, {"_id": 0})
    if not pilot:
        raise HTTPException(status_code=404, detail="Pilot not found")
    
    booking_date = booking.get("departure_date") or booking.get("travel_date")
    
    # Check for conflicts
    existing = await db.pilot_assignments.find_one({
        "pilot_id": pilot_id,
        "date": booking_date,
        "booking_id": {"$ne": booking_id}
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Pilot already assigned to another booking on this date")
    
    # Create/update assignment (fields aligned with pilot mobile dashboard reader)
    from_loc = booking.get('from_location') or booking.get('origin', 'N/A')
    to_loc = booking.get('to_location') or booking.get('destination', 'N/A')
    assignment = {
        "id": str(uuid4()),
        "booking_id": booking_id,
        "pilot_id": pilot_id,
        "pilot_user_id": pilot.get("user_id"),
        "pilot_name": pilot.get("name") or pilot.get("full_name"),
        "operator_id": operator["id"],
        "date": booking_date,
        "flight_date": (booking_date or "")[:10],
        "status": "assigned",
        "from_location": from_loc,
        "to_location": to_loc,
        "route": f"{from_loc} → {to_loc}",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["id"]
    }
    
    await db.pilot_assignments.update_one(
        {"booking_id": booking_id},
        {"$set": assignment},
        upsert=True
    )
    
    # Update booking with assigned pilot
    await db.inquiries.update_one(
        {"id": booking_id},
        {"$set": {
            "assigned_pilot_id": pilot_id,
            "assigned_pilot_name": pilot.get("name"),
            "pilot_assigned_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": f"Pilot {pilot.get('name')} assigned to booking", "assignment": assignment}


@router.delete("/pilots/assign/{booking_id}")
async def unassign_pilot_from_booking(
    booking_id: str,
    user: dict = Depends(get_current_user)
):
    """Remove pilot assignment from booking"""
    db = get_database()
    
    if "operator" not in user.get("roles", []):
        raise HTTPException(status_code=403, detail="Operator access required")
    
    # Remove assignment
    await db.pilot_assignments.delete_one({"booking_id": booking_id})
    
    # Update booking
    await db.inquiries.update_one(
        {"id": booking_id},
        {"$unset": {"assigned_pilot_id": "", "assigned_pilot_name": "", "pilot_assigned_at": ""}}
    )
    
    return {"message": "Pilot unassigned from booking"}



# ==================== MAINTENANCE ALERTS ====================

@router.get("/aircraft/maintenance-alerts")
async def get_aircraft_maintenance_alerts(
    user: dict = Depends(get_current_user)
):
    """Get aircraft approaching maintenance due dates"""
    db = get_database()
    
    if "operator" not in user.get("roles", []) and "admin" not in user.get("roles", []):
        raise HTTPException(status_code=403, detail="Operator/Admin access required")
    
    operator = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0})
    operator_id = operator["id"] if operator else None
    
    now = datetime.now(timezone.utc)
    
    # Get aircraft with maintenance data
    query = {}
    if operator_id:
        query["operator_id"] = operator_id
    
    aircraft_list = await db.aircraft.find(query, {"_id": 0}).to_list(100)
    
    alerts = []
    
    for ac in aircraft_list:
        registration = ac.get("registration", ac.get("id", "Unknown"))
        
        # Check various maintenance parameters
        maintenance_checks = [
            {
                "type": "Hours Since Last Service",
                "current": ac.get("hours_since_service", 0),
                "limit": ac.get("service_interval_hours", 100),
                "unit": "hours"
            },
            {
                "type": "Days Since Last Inspection",
                "current": 0,  # Calculate from last_inspection_date
                "limit": ac.get("inspection_interval_days", 30),
                "unit": "days"
            },
            {
                "type": "Engine Hours",
                "current": ac.get("engine_hours", 0),
                "limit": ac.get("engine_overhaul_hours", 2000),
                "unit": "hours"
            }
        ]
        
        # Calculate days since last inspection
        last_inspection = ac.get("last_inspection_date") or ac.get("last_maintenance_date")
        if last_inspection:
            try:
                if isinstance(last_inspection, str):
                    last_date = datetime.fromisoformat(last_inspection.replace("Z", "+00:00"))
                else:
                    last_date = last_inspection
                days_since = (now - last_date).days
                maintenance_checks[1]["current"] = days_since
            except Exception:
                pass
        
        # Check next scheduled maintenance
        next_maintenance = ac.get("next_maintenance_date")
        if next_maintenance:
            try:
                if isinstance(next_maintenance, str):
                    next_date = datetime.fromisoformat(next_maintenance.replace("Z", "+00:00"))
                else:
                    next_date = next_maintenance
                days_until = (next_date - now).days
                
                if days_until <= 7:
                    alerts.append({
                        "aircraft_registration": registration,
                        "aircraft_type": ac.get("type", ac.get("aircraft_type", "Unknown")),
                        "alert_type": "scheduled_maintenance",
                        "severity": "critical" if days_until <= 2 else "warning",
                        "message": f"Scheduled maintenance in {days_until} days",
                        "due_date": next_maintenance if isinstance(next_maintenance, str) else next_maintenance.isoformat(),
                        "days_remaining": days_until
                    })
            except Exception:
                pass
        
        # Check maintenance parameters
        for check in maintenance_checks:
            if check["limit"] > 0:
                remaining = check["limit"] - check["current"]
                percentage_used = (check["current"] / check["limit"]) * 100
                
                if percentage_used >= 90:
                    alerts.append({
                        "aircraft_registration": registration,
                        "aircraft_type": ac.get("type", ac.get("aircraft_type", "Unknown")),
                        "alert_type": check["type"].lower().replace(" ", "_"),
                        "severity": "critical" if percentage_used >= 95 else "warning",
                        "message": f"{check['type']}: {check['current']}/{check['limit']} {check['unit']} ({percentage_used:.0f}% used)",
                        "current_value": check["current"],
                        "limit_value": check["limit"],
                        "remaining": remaining,
                        "percentage_used": round(percentage_used, 1)
                    })
    
    # Sort by severity
    severity_order = {"critical": 0, "warning": 1, "info": 2}
    alerts.sort(key=lambda x: severity_order.get(x.get("severity", "info"), 2))
    
    return {
        "alerts": alerts,
        "total_alerts": len(alerts),
        "critical_count": sum(1 for a in alerts if a.get("severity") == "critical"),
        "warning_count": sum(1 for a in alerts if a.get("severity") == "warning"),
        "generated_at": now.isoformat()
    }


@router.post("/aircraft/{registration}/update-maintenance")
async def update_aircraft_maintenance(
    registration: str,
    data: dict,
    user: dict = Depends(get_current_user)
):
    """Update aircraft maintenance record"""
    db = get_database()
    
    if "operator" not in user.get("roles", []) and "admin" not in user.get("roles", []):
        raise HTTPException(status_code=403, detail="Operator/Admin access required")
    
    now = datetime.now(timezone.utc)
    
    update_data = {}
    
    if "hours_since_service" in data:
        update_data["hours_since_service"] = data["hours_since_service"]
    if "engine_hours" in data:
        update_data["engine_hours"] = data["engine_hours"]
    if "last_inspection_date" in data:
        update_data["last_inspection_date"] = data["last_inspection_date"]
    if "next_maintenance_date" in data:
        update_data["next_maintenance_date"] = data["next_maintenance_date"]
    if "maintenance_notes" in data:
        update_data["maintenance_notes"] = data["maintenance_notes"]
    
    update_data["updated_at"] = now.isoformat()
    
    result = await db.aircraft.update_one(
        {"registration": registration},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        # Try by id
        result = await db.aircraft.update_one(
            {"id": registration},
            {"$set": update_data}
        )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Aircraft not found")
    
    return {"message": "Maintenance record updated", "registration": registration}
