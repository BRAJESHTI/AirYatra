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
    """Get all trips/bookings for current customer"""
    query = {"customer_id": current_user["id"]}
    if status:
        query["status"] = status
    
    bookings = await db.bookings.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Enrich with operator and aircraft info
    for booking in bookings:
        if booking.get("operator_id"):
            operator = await db.operators.find_one({"id": booking["operator_id"]}, {"_id": 0, "company_name": 1, "average_rating": 1})
            booking["operator"] = operator
        if booking.get("aircraft_id"):
            aircraft = await db.aircraft.find_one({"id": booking["aircraft_id"]}, {"_id": 0, "aircraft_type": 1, "registration_number": 1})
            booking["aircraft"] = aircraft
        if booking.get("pilot_id"):
            pilot = await db.pilots.find_one({"id": booking["pilot_id"]}, {"_id": 0, "name": 1})
            booking["pilot"] = pilot
    
    # Categorize
    upcoming = [b for b in bookings if b.get("status") in ["confirmed", "pending"]]
    completed = [b for b in bookings if b.get("status") == "completed"]
    cancelled = [b for b in bookings if b.get("status") == "cancelled"]
    
    return {
        "trips": bookings,
        "upcoming": upcoming,
        "completed": completed,
        "cancelled": cancelled,
        "statistics": {
            "total_trips": len(bookings),
            "upcoming_count": len(upcoming),
            "completed_count": len(completed),
            "total_spent": sum(b.get("total_amount", 0) for b in completed)
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
    """Customer accepts or rejects a revised quote"""
    # Verify booking belongs to customer
    booking = await db.bookings.find_one(
        {"id": booking_id, "customer_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Verify quote exists
    quote = await db.quotes.find_one(
        {"id": quote_id, "booking_id": booking_id},
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
        
        # Reject other quotes for this booking
        await db.quotes.update_many(
            {"booking_id": booking_id, "id": {"$ne": quote_id}},
            {"$set": {"status": "rejected"}}
        )
        
        # Update booking
        await db.bookings.update_one(
            {"id": booking_id},
            {"$set": {
                "status": "quote_accepted",
                "accepted_quote_id": quote_id,
                "operator_id": quote["operator_id"],
                "total_amount": quote["amount"],
                "quote_accepted_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # TODO: Notify operator
        
        return {
            "status": "success",
            "message": "Quote accepted! / कोट स्वीकार! Proceed to payment.",
            "amount": quote["amount"],
            "operator_name": quote.get("operator_name")
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
    
    total_amount = inquiry.get("accepted_quote", {}).get("amount") or inquiry.get("estimated_price", 0)
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
