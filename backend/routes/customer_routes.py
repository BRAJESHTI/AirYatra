from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from database import get_database
from middleware import get_current_user
from services.payment_service import payment_service
from services.notification_service import notification_service

router = APIRouter(prefix="/customer", tags=["Customer"])

class CancelBookingRequest(BaseModel):
    reason: str
    is_emergency: bool = False

class RefundRequest(BaseModel):
    booking_id: str
    reason: str

@router.get("/trips")
async def get_my_trips(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get all trips/bookings for current customer (from both bookings and inquiries)"""
    query = {"customer_id": current_user["id"]}
    if status:
        query["status"] = status
    
    # Fetch from both collections
    bookings = await db.bookings.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    inquiries = await db.inquiries.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Mark source for each item
    for booking in bookings:
        booking["source"] = "booking"
    for inquiry in inquiries:
        inquiry["source"] = "inquiry"
    
    # DEDUPE: Prefer bookings over inquiries when same id exists in both
    seen_ids = set()
    all_trips = []
    
    # First add all bookings (higher priority)
    for booking in bookings:
        if booking["id"] not in seen_ids:
            all_trips.append(booking)
            seen_ids.add(booking["id"])
    
    # Then add inquiries only if not already seen
    for inquiry in inquiries:
        if inquiry["id"] not in seen_ids:
            all_trips.append(inquiry)
            seen_ids.add(inquiry["id"])
    
    # Sort by created_at
    all_trips.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    
    # Enrich with operator and aircraft info
    for trip in all_trips:
        if trip.get("operator_id"):
            operator = await db.operators.find_one({"id": trip["operator_id"]}, {"_id": 0, "company_name": 1, "average_rating": 1})
            trip["operator"] = operator
        if trip.get("aircraft_id"):
            aircraft = await db.aircraft.find_one({"id": trip["aircraft_id"]}, {"_id": 0, "aircraft_type": 1, "registration_number": 1})
            trip["aircraft"] = aircraft
        if trip.get("pilot_id"):
            pilot = await db.pilots.find_one({"id": trip["pilot_id"]}, {"_id": 0, "name": 1})
            trip["pilot"] = pilot
        # Get quote count for inquiries
        if trip.get("source") == "inquiry":
            quote_count = await db.quotes.count_documents({
                "$or": [{"inquiry_id": trip["id"]}, {"booking_id": trip["id"]}]
            })
            trip["quote_count"] = quote_count
    
    # Categorize - include inquiry statuses
    upcoming_statuses = ["confirmed", "pending", "quote_accepted", "passenger_details_filled"]
    pending_statuses = ["pending_acceptance", "quote_received", "pending_quotes", "quotes_received"]
    
    upcoming = [t for t in all_trips if t.get("status") in upcoming_statuses]
    pending = [t for t in all_trips if t.get("status") in pending_statuses]
    completed = [t for t in all_trips if t.get("status") == "completed"]
    cancelled = [t for t in all_trips if t.get("status") == "cancelled"]
    
    return {
        "trips": all_trips,
        "upcoming": upcoming,
        "pending": pending,
        "completed": completed,
        "cancelled": cancelled,
        "statistics": {
            "total_trips": len(all_trips),
            "upcoming_count": len(upcoming),
            "pending_count": len(pending),
            "completed_count": len(completed),
            "total_spent": sum(
                t.get("total_amount") or 
                t.get("final_price") or 
                t.get("pricing", {}).get("total_amount") or
                t.get("estimated_price") or 0 
                for t in completed
            )
        }
    }

@router.get("/trips/{booking_id}")
async def get_trip_details(
    booking_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get detailed trip information"""
    booking = await db.bookings.find_one(
        {"id": booking_id, "customer_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not booking:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    # Get related data
    operator = None
    aircraft = None
    pilot = None
    feedback = None
    landing_permissions = []
    
    if booking.get("operator_id"):
        operator = await db.operators.find_one({"id": booking["operator_id"]}, {"_id": 0})
    if booking.get("aircraft_id"):
        aircraft = await db.aircraft.find_one({"id": booking["aircraft_id"]}, {"_id": 0})
    if booking.get("pilot_id"):
        pilot = await db.pilots.find_one({"id": booking["pilot_id"]}, {"_id": 0})
    
    feedback = await db.feedback.find_one({"booking_id": booking_id}, {"_id": 0})
    landing_permissions = await db.landing_permissions.find({"booking_id": booking_id}, {"_id": 0}).to_list(10)
    
    return {
        "booking": booking,
        "operator": operator,
        "aircraft": aircraft,
        "pilot": pilot,
        "feedback": feedback,
        "landing_permissions": landing_permissions,
        "can_cancel": booking.get("status") in ["pending", "confirmed"],
        "can_review": booking.get("status") == "completed" and not feedback
    }

@router.post("/trips/{booking_id}/cancel")
async def cancel_trip(
    booking_id: str,
    request: CancelBookingRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Cancel a booking and initiate refund"""
    booking = await db.bookings.find_one(
        {"id": booking_id, "customer_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not booking:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    if booking.get("status") not in ["pending", "confirmed"]:
        raise HTTPException(status_code=400, detail="Cannot cancel this booking")
    
    # Get platform settings for cancellation fee
    settings = await db.platform_settings.find_one({"type": "platform"}, {"_id": 0})
    cancellation_fee_percent = settings.get("cancellation_fee_percent", 10) if settings else 10
    
    # Calculate refund amount
    total_amount = booking.get("total_amount", 0)
    cancellation_fee = total_amount * (cancellation_fee_percent / 100)
    refund_amount = total_amount - cancellation_fee
    
    # Emergency cancellations might have different rules
    if request.is_emergency:
        refund_amount = total_amount  # Full refund for emergencies
        cancellation_fee = 0
    
    # Update booking
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "status": "cancelled",
            "cancellation_reason": request.reason,
            "is_emergency_cancellation": request.is_emergency,
            "cancellation_fee": cancellation_fee,
            "refund_amount": refund_amount,
            "cancelled_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Create refund request if payment was made
    if booking.get("payment_status") == "paid" and booking.get("payment_id"):
        refund_request = {
            "id": str(uuid4()),
            "booking_id": booking_id,
            "customer_id": current_user["id"],
            "payment_id": booking.get("payment_id"),
            "original_amount": total_amount,
            "refund_amount": refund_amount,
            "cancellation_fee": cancellation_fee,
            "reason": request.reason,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.refund_requests.insert_one(refund_request)
        
        # Process refund via payment service
        refund_result = await payment_service.create_refund(
            payment_id=booking.get("payment_id"),
            amount=int(refund_amount * 100),  # Convert to paise
            reason=request.reason
        )
        
        if refund_result.get("success"):
            await db.refund_requests.update_one(
                {"id": refund_request["id"]},
                {"$set": {
                    "status": "processed",
                    "refund_id": refund_result.get("refund_id"),
                    "processed_at": datetime.now(timezone.utc).isoformat()
                }}
            )
    
    # Send notification to operator
    if booking.get("operator_id"):
        operator = await db.operators.find_one({"id": booking["operator_id"]}, {"_id": 0})
        if operator:
            await notification_service.send_operator_notification(
                operator_email=operator.get("contact_email") or operator.get("user_email"),
                notification_type="booking_cancelled",
                data={"booking_id": booking_id, "reason": request.reason}
            )
    
    return {
        "message": "Booking cancelled",
        "refund_amount": refund_amount,
        "cancellation_fee": cancellation_fee
    }

@router.get("/trips/{booking_id}/invoice")
async def get_invoice(
    booking_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get invoice data for a booking"""
    booking = await db.bookings.find_one(
        {"id": booking_id, "customer_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not booking:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    if booking.get("status") != "completed" and booking.get("payment_status") != "paid":
        raise HTTPException(status_code=400, detail="Invoice not available")
    
    # Get related data
    operator = await db.operators.find_one({"id": booking.get("operator_id")}, {"_id": 0})
    customer = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    
    # Get platform settings for GST
    settings = await db.platform_settings.find_one({"type": "platform"}, {"_id": 0})
    gst_percent = settings.get("gst_percent", 18) if settings else 18
    
    base_amount = booking.get("total_amount", 0) / (1 + gst_percent/100)
    gst_amount = booking.get("total_amount", 0) - base_amount
    
    invoice = {
        "invoice_number": f"INV-{booking.get('booking_number', booking_id[:8])}",
        "invoice_date": booking.get("paid_at") or booking.get("created_at"),
        "booking_number": booking.get("booking_number"),
        "customer": {
            "name": customer.get("full_name"),
            "email": customer.get("email"),
            "phone": customer.get("phone")
        },
        "operator": {
            "name": operator.get("company_name") if operator else "N/A",
            "gstin": operator.get("gstin") if operator else "N/A"
        },
        "trip_details": {
            "from": booking.get("from_location"),
            "to": booking.get("to_location"),
            "date": booking.get("departure_date"),
            "passengers": booking.get("passengers")
        },
        "amount_details": {
            "base_amount": round(base_amount, 2),
            "gst_percent": gst_percent,
            "gst_amount": round(gst_amount, 2),
            "total_amount": booking.get("total_amount", 0)
        },
        "payment_details": {
            "payment_id": booking.get("payment_id"),
            "payment_method": booking.get("payment_method"),
            "paid_at": booking.get("paid_at")
        }
    }
    
    return invoice

@router.get("/refunds")
async def get_refund_requests(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get refund requests for current customer"""
    refunds = await db.refund_requests.find(
        {"customer_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"refunds": refunds}

# ============== REVISED QUOTES ==============

@router.get("/trips/{booking_id}/quotes")
async def get_booking_quotes(
    booking_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get all quotes received for a booking"""
    # Verify booking belongs to customer
    booking = await db.bookings.find_one(
        {"id": booking_id, "customer_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Get all quotes for this booking
    quotes = await db.quotes.find(
        {"booking_id": booking_id},
        {"_id": 0}
    ).sort("updated_at", -1).to_list(50)
    
    # Enrich with operator info
    for quote in quotes:
        operator = await db.operators.find_one(
            {"id": quote["operator_id"]},
            {"_id": 0, "company_name": 1, "average_rating": 1, "base_city": 1}
        )
        quote["operator"] = operator
    
    return {
        "quotes": quotes,
        "booking_status": booking.get("status"),
        "accepted_quote_id": booking.get("accepted_quote_id")
    }

class QuoteResponseRequest(BaseModel):
    action: str  # "accept" or "reject"
    feedback: Optional[str] = None

@router.post("/trips/{booking_id}/quotes/{quote_id}/respond")
async def respond_to_quote(
    booking_id: str,
    quote_id: str,
    response_data: QuoteResponseRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Customer accepts or rejects a revised quote
    Works for both bookings and inquiries
    ग्राहक कोट स्वीकार या अस्वीकार करता है
    """
    # Try to find in inquiries collection first (new flow)
    inquiry = await db.inquiries.find_one(
        {"id": booking_id, "customer_id": current_user["id"]},
        {"_id": 0}
    )
    
    is_inquiry = bool(inquiry)
    
    # If not found in inquiries, try bookings
    if not inquiry:
        inquiry = await db.bookings.find_one(
            {"id": booking_id, "customer_id": current_user["id"]},
            {"_id": 0}
        )
    
    if not inquiry:
        raise HTTPException(status_code=404, detail="Booking/Inquiry not found")
    
    # Verify quote exists - check both inquiry_id and booking_id fields
    quote = await db.quotes.find_one(
        {"id": quote_id, "$or": [{"booking_id": booking_id}, {"inquiry_id": booking_id}]},
        {"_id": 0}
    )
    
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    if response_data.action == "accept":
        # Accept the quote
        await db.quotes.update_one(
            {"id": quote_id},
            {"$set": {
                "status": "accepted",
                "accepted_at": datetime.now(timezone.utc).isoformat(),
                "customer_feedback": response_data.feedback
            }}
        )
        
        # Reject other quotes for this booking/inquiry
        await db.quotes.update_many(
            {"$or": [{"booking_id": booking_id}, {"inquiry_id": booking_id}], "id": {"$ne": quote_id}},
            {"$set": {"status": "rejected"}}
        )
        
        # Prepare update data
        update_data = {
            "status": "quote_accepted",
            "accepted_quote_id": quote_id,
            "accepted_operator_id": quote["operator_id"],
            "operator_id": quote["operator_id"],
            "accepted_quote": {
                "id": quote_id,
                "amount": quote["amount"],
                "operator_id": quote["operator_id"],
                "operator_name": quote.get("operator_name"),
                "notes": quote.get("notes")
            },
            "total_amount": quote["amount"],
            "quote_accepted_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Update inquiry or booking
        if is_inquiry:
            await db.inquiries.update_one(
                {"id": booking_id},
                {"$set": update_data}
            )
        else:
            await db.bookings.update_one(
                {"id": booking_id},
                {"$set": update_data}
            )
        
        # TODO: Notify operator
        
        return {
            "status": "success",
            "message": "Quote accepted! / कोट स्वीकार! Now fill passenger details.",
            "amount": quote["amount"],
            "operator_name": quote.get("operator_name"),
            "next_step": "fill_passenger_details"
        }
    
    elif response_data.action == "reject":
        # Reject the quote
        await db.quotes.update_one(
            {"id": quote_id},
            {"$set": {
                "status": "rejected_by_customer",
                "rejected_at": datetime.now(timezone.utc).isoformat(),
                "rejection_feedback": response_data.feedback
            }}
        )
        
        # TODO: Notify operator
        
        return {
            "status": "success",
            "message": "Quote rejected / कोट अस्वीकार"
        }
    
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Use 'accept' or 'reject'")

@router.get("/quotes/pending")
async def get_pending_quotes_for_customer(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get all pending quotes across all customer bookings"""
    # Get all customer bookings
    bookings = await db.bookings.find(
        {"customer_id": current_user["id"], "status": {"$in": ["pending_quotes", "quote_sent", "quotes_received"]}},
        {"_id": 0, "id": 1, "booking_number": 1, "from_location": 1, "to_location": 1}
    ).to_list(100)
    
    booking_ids = [b["id"] for b in bookings]
    
    # Get pending quotes
    quotes = await db.quotes.find(
        {"booking_id": {"$in": booking_ids}, "status": {"$in": ["sent", "pending"]}},
        {"_id": 0}
    ).sort("updated_at", -1).to_list(100)
    
    # Enrich with booking and operator info
    booking_map = {b["id"]: b for b in bookings}
    for quote in quotes:
        quote["booking"] = booking_map.get(quote["booking_id"])
        operator = await db.operators.find_one(
            {"id": quote["operator_id"]},
            {"_id": 0, "company_name": 1, "average_rating": 1}
        )
        quote["operator"] = operator
    
    return {"quotes": quotes, "total_pending": len(quotes)}

# ============== PASSENGER DETAILS ==============

@router.post("/trips/{inquiry_id}/passenger-details")
async def submit_passenger_details(
    inquiry_id: str,
    data: dict,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Submit passenger details after quote accepted
    कोट स्वीकार होने के बाद यात्री विवरण जमा करें
    """
    # Try to find in inquiries collection first
    inquiry = await db.inquiries.find_one(
        {"id": inquiry_id, "customer_id": current_user["id"]},
        {"_id": 0}
    )
    
    # If not found in inquiries, try bookings
    if not inquiry:
        inquiry = await db.bookings.find_one(
            {"id": inquiry_id, "customer_id": current_user["id"]},
            {"_id": 0}
        )
    
    if not inquiry:
        raise HTTPException(status_code=404, detail="Inquiry/Booking not found")
    
    passengers = data.get("passengers", [])
    
    if not passengers:
        raise HTTPException(status_code=400, detail="Passenger details required")
    
    # Validate passengers
    for i, p in enumerate(passengers):
        if not p.get("name"):
            raise HTTPException(status_code=400, detail=f"Passenger {i+1}: Name required")
        if p.get("type") == "adult" and not p.get("weight_kg"):
            raise HTTPException(status_code=400, detail=f"Passenger {i+1}: Weight required for adults")
    
    update_data = {
        "passenger_details": passengers,
        "total_passenger_weight": data.get("total_weight", 0),
        "total_luggage_weight": data.get("total_luggage_weight", 0),
        "total_luggage_count": data.get("total_luggage_count", 0),
        "passenger_details_filled_at": datetime.now(timezone.utc).isoformat(),
        "status": "passenger_details_filled",
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Update in inquiries collection
    result = await db.inquiries.update_one(
        {"id": inquiry_id},
        {"$set": update_data}
    )
    
    # If not found in inquiries, update in bookings
    if result.modified_count == 0:
        await db.bookings.update_one(
            {"id": inquiry_id},
            {"$set": update_data}
        )
    
    # Get payment rules for this booking purpose
    payment_settings = await db.payment_rules_settings.find_one({"type": "payment_rules"}, {"_id": 0})
    
    advance_percent = 50  # Default
    if payment_settings:
        purpose = inquiry.get("booking_purpose", "other")
        rules = payment_settings.get("payment_rules", [])
        for rule in rules:
            if rule.get("purpose") == purpose:
                advance_percent = rule.get("advance_percent", 50)
                break
    
    return {
        "success": True,
        "message": "Passenger details saved! / यात्री विवरण सहेजा गया!",
        "next_step": "payment",
        "advance_percent": advance_percent,
        "total_amount": inquiry.get("estimated_price", 0),
        "advance_amount": int(inquiry.get("estimated_price", 0) * advance_percent / 100),
        "status": "passenger_details_filled"
    }

@router.get("/trips/{inquiry_id}/payment-info")
async def get_payment_info(
    inquiry_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get payment information for an inquiry/booking"""
    inquiry = await db.inquiries.find_one(
        {"id": inquiry_id, "customer_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not inquiry:
        inquiry = await db.bookings.find_one(
            {"id": inquiry_id, "customer_id": current_user["id"]},
            {"_id": 0}
        )
    
    if not inquiry:
        raise HTTPException(status_code=404, detail="Inquiry/Booking not found")
    
    # Get payment rules
    payment_settings = await db.payment_rules_settings.find_one({"type": "payment_rules"}, {"_id": 0})
    
    advance_percent = 50
    can_pay_later = True
    
    if payment_settings:
        purpose = inquiry.get("booking_purpose", "other")
        rules = payment_settings.get("payment_rules", [])
        for rule in rules:
            if rule.get("purpose") == purpose:
                advance_percent = rule.get("advance_percent", 50)
                can_pay_later = rule.get("can_pay_later", True)
                break
    
    total_amount = (inquiry.get("accepted_quote") or {}).get("amount") or inquiry.get("estimated_price", 0)
    advance_amount = int(total_amount * advance_percent / 100)
    remaining_amount = total_amount - advance_amount
    
    return {
        "inquiry_id": inquiry_id,
        "booking_purpose": inquiry.get("booking_purpose"),
        "total_amount": total_amount,
        "advance_percent": advance_percent,
        "advance_amount": advance_amount,
        "remaining_amount": remaining_amount,
        "can_pay_later": can_pay_later,
        "payment_deadline_hours": payment_settings.get("global_settings", {}).get("payment_deadline_hours", 24) if payment_settings else 24,
        "status": inquiry.get("status"),
        "passenger_details_filled": bool(inquiry.get("passenger_details"))
    }



# ==================== CUSTOMER BOOKING STATS ====================

@router.get("/booking-stats")
async def get_customer_booking_stats(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get customer's flight stats, total spend, and loyalty tier progress"""
    
    customer_id = current_user["id"]
    
    # Get all bookings and inquiries
    bookings = await db.bookings.find(
        {"customer_id": customer_id},
        {"_id": 0, "id": 1, "from_location": 1, "to_location": 1, "departure_date": 1,
         "estimated_price": 1, "accepted_quote": 1, "status": 1, "payment_status": 1,
         "flight_duration": 1, "created_at": 1}
    ).sort("created_at", -1).to_list(100)
    
    inquiries = await db.inquiries.find(
        {"customer_id": customer_id},
        {"_id": 0, "id": 1, "from_location": 1, "to_location": 1, "departure_date": 1,
         "estimated_price": 1, "accepted_quote": 1, "status": 1, "payment_status": 1,
         "created_at": 1}
    ).sort("created_at", -1).to_list(100)
    
    all_trips = bookings + inquiries
    
    # Calculate stats
    total_spend = 0
    completed_flights = 0
    unique_routes = set()
    total_hours = 0
    
    for trip in all_trips:
        # Count paid/completed trips
        if trip.get("payment_status") in ["paid", "fully_paid"]:
            amount = float((trip.get("accepted_quote") or {}).get("amount") or trip.get("estimated_price") or 0)
            total_spend += amount
            completed_flights += 1
            
            # Track unique routes
            route = f"{trip.get('from_location', '')}-{trip.get('to_location', '')}"
            unique_routes.add(route)
            
            # Estimate flight hours (assume 1.5 hours per flight if not specified)
            hours = float(trip.get("flight_duration", 1.5) or 1.5)
            total_hours += hours
    
    # Get loyalty points
    loyalty = await db.loyalty_points.find_one(
        {"customer_id": customer_id},
        {"_id": 0, "points": 1, "tier": 1}
    )
    rewards_earned = loyalty.get("points", 0) if loyalty else int(total_spend / 100)  # 1 point per ₹100
    
    # Recent flights (last 10)
    recent_flights = []
    for trip in all_trips[:10]:
        recent_flights.append({
            "id": trip.get("id"),
            "from_location": trip.get("from_location", ""),
            "to_location": trip.get("to_location", ""),
            "departure_date": trip.get("departure_date", ""),
            "amount": float((trip.get("accepted_quote") or {}).get("amount") or trip.get("estimated_price") or 0),
            "status": trip.get("status", "pending"),
            "payment_status": trip.get("payment_status", "pending"),
        })
    
    return {
        "total_spend": round(total_spend, 2),
        "total_flights": completed_flights,
        "unique_routes": len(unique_routes),
        "total_hours": round(total_hours, 1),
        "rewards_earned": rewards_earned,
        "recent_flights": recent_flights,
    }


# ============== AI ROUTE SUGGESTIONS ==============

@router.get("/route-suggestions")
async def get_route_suggestions(
    lat: float = None,
    lng: float = None,
    current_user: dict = Depends(get_current_user)
):
    """Get AI-powered route suggestions based on location and booking history"""
    db = get_database()
    
    suggestions = []
    
    # 1. Get user's booking history for personalized suggestions
    user_bookings = await db.inquiries.find(
        {"customer_id": current_user["id"]},
        {"_id": 0, "from_location": 1, "to_location": 1, "origin": 1, "destination": 1, "purpose": 1}
    ).to_list(50)
    
    # Extract user's preferred routes/cities
    user_cities = set()
    user_purposes = {}
    for b in user_bookings:
        from_loc = b.get("from_location") or b.get("origin") or ""
        to_loc = b.get("to_location") or b.get("destination") or ""
        if from_loc:
            user_cities.add(from_loc.split(",")[0].strip().lower())
        if to_loc:
            user_cities.add(to_loc.split(",")[0].strip().lower())
        purpose = b.get("purpose", "leisure")
        user_purposes[purpose] = user_purposes.get(purpose, 0) + 1
    
    # Get user's most common purpose
    top_purpose = max(user_purposes, key=user_purposes.get) if user_purposes else "leisure"
    
    # 2. Popular Routes - India specific
    popular_routes = [
        {
            "from": "Mumbai", "to": "Shirdi", "price_range": "₹75,000 - ₹95,000",
            "duration": "45 mins", "purpose": "pilgrimage", "popularity": 95,
            "description": "Most popular religious route / सबसे लोकप्रिय धार्मिक मार्ग",
            "best_time": "Morning",
            "aircraft": "Helicopter"
        },
        {
            "from": "Mumbai", "to": "Pune", "price_range": "₹55,000 - ₹75,000",
            "duration": "25 mins", "purpose": "business", "popularity": 88,
            "description": "Corporate shuttle route / कॉर्पोरेट शटल मार्ग",
            "best_time": "Weekday Morning",
            "aircraft": "Helicopter"
        },
        {
            "from": "Delhi", "to": "Agra", "price_range": "₹85,000 - ₹1,10,000",
            "duration": "35 mins", "purpose": "tourism", "popularity": 85,
            "description": "Taj Mahal aerial view / ताजमहल हवाई दृश्य",
            "best_time": "Sunrise",
            "aircraft": "Helicopter"
        },
        {
            "from": "Bangalore", "to": "Coorg", "price_range": "₹65,000 - ₹85,000",
            "duration": "40 mins", "purpose": "leisure", "popularity": 78,
            "description": "Weekend getaway / सप्ताहांत यात्रा",
            "best_time": "Morning",
            "aircraft": "Helicopter"
        },
        {
            "from": "Chennai", "to": "Tirupati", "price_range": "₹60,000 - ₹80,000",
            "duration": "35 mins", "purpose": "pilgrimage", "popularity": 82,
            "description": "Temple visit / मंदिर दर्शन",
            "best_time": "Early Morning",
            "aircraft": "Helicopter"
        },
        {
            "from": "Ahmedabad", "to": "Statue of Unity", "price_range": "₹70,000 - ₹90,000",
            "duration": "30 mins", "purpose": "tourism", "popularity": 75,
            "description": "Iconic landmark / प्रतिष्ठित स्थल",
            "best_time": "Afternoon",
            "aircraft": "Helicopter"
        },
        {
            "from": "Mumbai", "to": "Lonavala", "price_range": "₹45,000 - ₹60,000",
            "duration": "15 mins", "purpose": "leisure", "popularity": 72,
            "description": "Hill station escape / हिल स्टेशन",
            "best_time": "Monsoon/Winter",
            "aircraft": "Helicopter"
        },
        {
            "from": "Hyderabad", "to": "Warangal", "price_range": "₹55,000 - ₹70,000",
            "duration": "30 mins", "purpose": "heritage", "popularity": 65,
            "description": "Heritage tour / विरासत यात्रा",
            "best_time": "Morning",
            "aircraft": "Helicopter"
        }
    ]
    
    # 3. Score and rank routes based on user preference
    for route in popular_routes:
        score = route["popularity"]
        
        # Boost if matches user's purpose
        if route["purpose"] == top_purpose:
            score += 15
        
        # Boost if user has visited nearby cities
        if route["from"].lower() in user_cities or route["to"].lower() in user_cities:
            score += 10
        
        # Boost pilgrimage routes (very popular in India)
        if route["purpose"] == "pilgrimage":
            score += 5
        
        route["score"] = score
        route["personalized"] = route["from"].lower() in user_cities or route["to"].lower() in user_cities
    
    # Sort by score
    popular_routes.sort(key=lambda x: x["score"], reverse=True)
    
    # 4. Create personalized suggestions
    personalized = [r for r in popular_routes if r.get("personalized")][:2]
    trending = [r for r in popular_routes if not r.get("personalized")][:4]
    
    # 5. Get actual booking counts from DB for validation
    booking_counts = await db.inquiries.aggregate([
        {
            "$group": {
                "_id": {
                    "from": {"$ifNull": ["$from_location", "$origin"]},
                    "to": {"$ifNull": ["$to_location", "$destination"]}
                },
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"count": -1}},
        {"$limit": 5}
    ]).to_list(5)
    
    # 6. Seasonal suggestion based on current month
    current_month = datetime.now().month
    seasonal_suggestion = None
    
    if current_month in [10, 11]:  # Diwali season
        seasonal_suggestion = {
            "title": "Diwali Special / दिवाली स्पेशल",
            "description": "Book helicopter for Shirdi darshan during Diwali",
            "route": {"from": "Mumbai", "to": "Shirdi"},
            "discount": "10% off with code DIWALI10"
        }
    elif current_month in [12, 1, 2]:  # Wedding season
        seasonal_suggestion = {
            "title": "Wedding Season / शादी सीजन",
            "description": "Grand entry by helicopter for your special day",
            "type": "wedding",
            "discount": "Special wedding packages available"
        }
    elif current_month in [4, 5, 6]:  # Summer holidays
        seasonal_suggestion = {
            "title": "Summer Escape / गर्मी की छुट्टी",
            "description": "Escape to hill stations by helicopter",
            "route": {"from": "Any City", "to": "Hill Stations"},
            "discount": "Family packages available"
        }
    
    return {
        "personalized_routes": personalized,
        "trending_routes": trending,
        "all_popular_routes": popular_routes[:6],
        "seasonal_suggestion": seasonal_suggestion,
        "user_preference": {
            "top_purpose": top_purpose,
            "visited_cities": list(user_cities)[:5],
            "total_bookings": len(user_bookings)
        },
        "booking_tip": "Book 7+ days in advance for best prices / बेहतर कीमत के लिए 7+ दिन पहले बुक करें"
    }



# ========== INVOICE PDF DOWNLOAD ==========

from fastapi.responses import StreamingResponse, Response
from io import BytesIO
import logging

logger = logging.getLogger(__name__)


def _pdf_response(pdf_bytes: bytes, filename: str) -> Response:
    """Return a bulletproof PDF response with Content-Length + magic-byte validation.
    Prevents flaky downloads and ensures downstream tooling (browsers, curl, `file` MIME
    detection) always sees a well-formed PDF payload.
    """
    if not pdf_bytes or not pdf_bytes.startswith(b"%PDF"):
        raise HTTPException(status_code=500, detail="Generated invoice is not a valid PDF")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes)),
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )

def _generate_invoice_pdf(booking: dict, user: dict, payment: dict = None) -> bytes:
    """Generate professional invoice PDF for booking"""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas
    from reportlab.lib.styles import getSampleStyleSheet
    
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    
    # Colors
    orange = colors.HexColor('#f97316')
    dark = colors.HexColor('#0f172a')
    gray = colors.HexColor('#64748b')
    
    # Header Background
    c.setFillColor(dark)
    c.rect(0, height - 100, width, 100, fill=1, stroke=0)
    
    # Logo & Company Name
    c.setFillColor(orange)
    c.setFont("Helvetica-Bold", 28)
    c.drawString(30, height - 50, "AirYatra")
    
    c.setFillColor(colors.white)
    c.setFont("Helvetica", 10)
    c.drawString(30, height - 70, "India's Aviation Super Ecosystem")
    
    # Invoice Title
    c.setFont("Helvetica-Bold", 20)
    c.drawRightString(width - 30, height - 50, "TAX INVOICE")
    
    # Invoice Number & Date
    c.setFont("Helvetica", 10)
    invoice_num = f"INV-{booking.get('booking_number', 'N/A')}"
    invoice_date = datetime.now(timezone.utc).strftime("%d %b %Y")
    c.drawRightString(width - 30, height - 70, f"Invoice #: {invoice_num}")
    c.drawRightString(width - 30, height - 85, f"Date: {invoice_date}")
    
    # Reset to black for body
    c.setFillColor(colors.black)
    
    # Customer Details Box
    y = height - 140
    c.setFont("Helvetica-Bold", 11)
    c.drawString(30, y, "Bill To:")
    c.setFont("Helvetica", 10)
    c.drawString(30, y - 15, user.get("full_name", "Customer"))
    c.drawString(30, y - 30, user.get("email", ""))
    c.drawString(30, y - 45, user.get("phone", ""))
    
    # GST Details if corporate
    if booking.get("gst_billing") and booking.get("gstin"):
        c.drawString(30, y - 60, f"GSTIN: {booking.get('gstin', 'N/A')}")
        c.drawString(30, y - 75, booking.get("company_name", ""))
    
    # Booking Details Box
    c.setFont("Helvetica-Bold", 11)
    c.drawString(width/2 + 20, y, "Flight Details:")
    c.setFont("Helvetica", 10)
    c.drawString(width/2 + 20, y - 15, f"Booking #: {booking.get('booking_number', 'N/A')}")
    c.drawString(width/2 + 20, y - 30, f"Route: {booking.get('from_location', 'N/A')} → {booking.get('to_location', 'N/A')}")
    c.drawString(width/2 + 20, y - 45, f"Date: {booking.get('departure_date', booking.get('travel_date', 'N/A'))}")
    c.drawString(width/2 + 20, y - 60, f"Passengers: {booking.get('passengers', 1)}")
    c.drawString(width/2 + 20, y - 75, f"Trip Type: {booking.get('trip_type', 'One Way').replace('_', ' ').title()}")
    
    # Table Header
    y = height - 280
    c.setFillColor(dark)
    c.rect(30, y - 5, width - 60, 25, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(40, y + 5, "Description")
    c.drawString(350, y + 5, "Amount (INR)")
    c.drawRightString(width - 40, y + 5, "Total")
    
    # Reset color
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 10)
    
    # Line Items
    y = y - 30
    
    # Get pricing info
    pricing = booking.get("pricing", {})
    base_fare = pricing.get("base_fare", booking.get("final_price", booking.get("estimated_price", 0)))
    repositioning = pricing.get("repositioning_charge", 0)
    landing_charges = pricing.get("landing_charges", 0)
    handling_charges = pricing.get("handling_charges", 0)
    commission = pricing.get("commission", 0)
    gst = pricing.get("gst_amount", 0)
    total = pricing.get("total_amount", base_fare)
    
    items = [
        ("Charter Flight Service", base_fare),
    ]
    
    if repositioning > 0:
        items.append(("Aircraft Repositioning Charges", repositioning))
    if landing_charges > 0:
        items.append(("Landing Charges", landing_charges))
    if handling_charges > 0:
        items.append(("Ground Handling Charges", handling_charges))
    
    for desc, amount in items:
        c.drawString(40, y, desc)
        c.drawRightString(width - 40, y, f"₹{amount:,.2f}")
        y -= 20
    
    # Subtotal line
    y -= 10
    c.setStrokeColor(gray)
    c.line(30, y + 5, width - 30, y + 5)
    y -= 15
    
    subtotal = sum(amt for _, amt in items)
    c.drawString(40, y, "Subtotal")
    c.drawRightString(width - 40, y, f"₹{subtotal:,.2f}")
    y -= 20
    
    # Commission & Taxes
    if commission > 0:
        c.drawString(40, y, f"AirYatra Service Fee ({pricing.get('commission_rate', 10)}%)")
        c.drawRightString(width - 40, y, f"₹{commission:,.2f}")
        y -= 20
    
    if gst > 0:
        c.drawString(40, y, f"GST @ {pricing.get('gst_rate', 18)}%")
        c.drawRightString(width - 40, y, f"₹{gst:,.2f}")
        y -= 20
    
    # Total
    y -= 10
    c.setFillColor(dark)
    c.rect(30, y - 5, width - 60, 30, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(40, y + 5, "TOTAL AMOUNT")
    c.drawRightString(width - 40, y + 5, f"₹{total:,.2f}")
    
    # Payment Status
    c.setFillColor(colors.black)
    y -= 50
    c.setFont("Helvetica-Bold", 11)
    
    payment_status = "PAID" if payment and payment.get("status") == "completed" else "PENDING"
    if payment_status == "PAID":
        c.setFillColor(colors.HexColor('#22c55e'))
        c.drawString(40, y, f"✓ Payment Status: PAID")
        c.setFillColor(colors.black)
        c.setFont("Helvetica", 10)
        c.drawString(40, y - 15, f"Payment Method: {payment.get('payment_method', 'N/A').upper()}")
        c.drawString(40, y - 30, f"Transaction ID: {payment.get('transaction_id', payment.get('session_id', 'N/A')[:16])}")
        c.drawString(40, y - 45, f"Paid On: {payment.get('created_at', '')[:10]}")
    else:
        c.setFillColor(colors.HexColor('#f97316'))
        c.drawString(40, y, f"⏳ Payment Status: PENDING")
    
    # Footer
    c.setFillColor(gray)
    c.setFont("Helvetica", 8)
    footer_y = 60
    c.drawString(30, footer_y + 20, "This is a computer-generated invoice and does not require a signature.")
    c.drawString(30, footer_y + 5, "AirYatra Aviation Pvt Ltd | CIN: U62099MH2024PTC123456 | GSTIN: 27AABCT1234L1ZH")
    c.drawString(30, footer_y - 10, "support@airyatra.co.in | +91 1800-XXX-XXXX | www.airyatra.co.in")
    
    # Page number
    c.drawRightString(width - 30, footer_y - 10, "Page 1 of 1")
    
    c.save()
    buffer.seek(0)
    return buffer.getvalue()


@router.get("/bookings/{booking_id}/invoice")
async def download_invoice(
    booking_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Download invoice PDF for a booking"""
    db = get_database()
    
    # Try both collections
    booking = await db.bookings.find_one(
        {"id": booking_id, "customer_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not booking:
        booking = await db.inquiries.find_one(
            {"id": booking_id, "customer_id": current_user["id"]},
            {"_id": 0}
        )
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Get payment info if exists
    payment = await db.payments.find_one(
        {"booking_id": booking_id},
        {"_id": 0}
    )
    
    # Generate PDF
    try:
        pdf_bytes = _generate_invoice_pdf(booking, current_user, payment)
        filename = f"AirYatra_Invoice_{booking.get('booking_number', booking_id[:8])}.pdf"
        logger.info(f"Invoice PDF generated: {filename} ({len(pdf_bytes)} bytes) for booking {booking_id}")
        return _pdf_response(pdf_bytes, filename)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating invoice PDF: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate invoice")


@router.post("/bookings/{booking_id}/rating")
async def submit_booking_rating(
    booking_id: str,
    overall_rating: int,
    ratings: str = None,  # JSON string of category ratings
    review: str = None,
    positive_tags: str = None,  # JSON string
    negative_tags: str = None,  # JSON string
    would_recommend: bool = None,
    current_user: dict = Depends(get_current_user)
):
    """Submit rating and review for a completed booking"""
    import json
    
    db = get_database()
    
    # Verify booking exists and belongs to user
    booking = await db.bookings.find_one(
        {"id": booking_id, "customer_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not booking:
        booking = await db.inquiries.find_one(
            {"id": booking_id, "customer_id": current_user["id"]},
            {"_id": 0}
        )
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Check if already rated
    existing_rating = await db.ratings.find_one(
        {"booking_id": booking_id, "user_id": current_user["id"]}
    )
    
    if existing_rating:
        raise HTTPException(status_code=400, detail="You have already rated this booking")
    
    # Parse JSON strings
    try:
        category_ratings = json.loads(ratings) if ratings else {}
        pos_tags = json.loads(positive_tags) if positive_tags else []
        neg_tags = json.loads(negative_tags) if negative_tags else []
    except json.JSONDecodeError:
        category_ratings = {}
        pos_tags = []
        neg_tags = []
    
    # Create rating record
    rating_record = {
        "id": str(uuid4()),
        "booking_id": booking_id,
        "user_id": current_user["id"],
        "user_name": current_user.get("full_name", "Anonymous"),
        "operator_id": booking.get("operator_id"),
        "aircraft_id": booking.get("aircraft_id"),
        "overall_rating": overall_rating,
        "category_ratings": category_ratings,
        "review": review,
        "positive_tags": pos_tags,
        "negative_tags": neg_tags,
        "would_recommend": would_recommend,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "published",
        "helpful_count": 0,
        "photos": []  # Photos handled separately via form data
    }
    
    await db.ratings.insert_one(rating_record)
    
    # Update operator's average rating
    if booking.get("operator_id"):
        operator_ratings = await db.ratings.find(
            {"operator_id": booking["operator_id"]},
            {"overall_rating": 1}
        ).to_list(1000)
        
        if operator_ratings:
            avg_rating = sum(r["overall_rating"] for r in operator_ratings) / len(operator_ratings)
            await db.operators.update_one(
                {"id": booking["operator_id"]},
                {"$set": {
                    "average_rating": round(avg_rating, 1),
                    "review_count": len(operator_ratings)
                }}
            )
    
    # Award loyalty points for rating
    try:
        points_to_add = 50 if overall_rating >= 4 else 25
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$inc": {"loyalty_points": points_to_add}}
        )
    except Exception:
        pass
    
    return {
        "success": True,
        "message": "Thank you for your feedback!",
        "rating_id": rating_record["id"],
        "points_earned": 50 if overall_rating >= 4 else 25
    }


@router.get("/bookings/{booking_id}/rating")
async def get_booking_rating(
    booking_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get rating for a specific booking"""
    db = get_database()
    
    rating = await db.ratings.find_one(
        {"booking_id": booking_id, "user_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not rating:
        return {"has_rating": False}
    
    return {
        "has_rating": True,
        "rating": rating
    }
