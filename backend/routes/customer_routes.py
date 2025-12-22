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
