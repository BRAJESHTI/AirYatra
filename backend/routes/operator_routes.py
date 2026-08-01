from fastapi import APIRouter, HTTPException, Depends
from database import get_database
from models import Operator, OperatorStatus, ApprovalStatus
from middleware import get_current_user
import uuid
from datetime import datetime
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
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
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
    update_data["updated_at"] = datetime.utcnow().isoformat()
    
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
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
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
    update_data["updated_at"] = datetime.utcnow().isoformat()
    
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
    
    quote = {
        "id": quote_id,
        "booking_id": booking_id,
        "operator_id": operator["id"],
        "operator_name": operator["company_name"],
        "customer_id": booking.get("user_id"),
        "amount": quote_data["amount"],
        "breakdown": quote_data.get("breakdown", {}),
        "validity_hours": quote_data.get("validity_hours", 24),
        "valid_until": datetime.utcnow().isoformat(),  # Will be calculated
        "notes": quote_data.get("notes", ""),
        "status": "sent",
        "revision_count": (existing_quote.get("revision_count", 0) + 1) if existing_quote else 1,
        "created_at": existing_quote.get("created_at") if existing_quote else datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
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
                "sent_at": datetime.utcnow().isoformat()
            }
        }}
    )
    
    # TODO: Send notification to customer
    
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
    now = datetime.utcnow()
    
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
        amount = float(inq.get("accepted_quote", {}).get("amount") or inq.get("estimated_price") or 0)
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
            amount = float(inq.get("accepted_quote", {}).get("amount") or inq.get("estimated_price") or 0)
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