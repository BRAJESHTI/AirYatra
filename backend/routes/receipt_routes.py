"""
AirYatra Payment Receipt Routes
Endpoints for generating and downloading payment/refund receipts
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone
from database import get_database
from middleware import get_current_user, require_roles
import logging
import io

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/receipts", tags=["Payment Receipts"])

from services.payment_receipt_service import receipt_generator


@router.get("/payment/{transaction_id}")
async def download_payment_receipt(
    transaction_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Download payment receipt PDF for a transaction"""
    db = get_database()
    
    # Find transaction
    transaction = await db.transactions.find_one(
        {"$or": [
            {"id": transaction_id},
            {"transaction_id": transaction_id},
            {"razorpay_payment_id": transaction_id},
            {"paypal_order_id": transaction_id},
            {"cf_payment_id": transaction_id}
        ]},
        {"_id": 0}
    )
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Check authorization (user owns this transaction or is admin)
    user_roles = current_user.get("roles", [])
    is_admin = "admin" in user_roles or "super_admin" in user_roles
    
    if not is_admin and transaction.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to access this receipt")
    
    # Get booking details
    booking_id = transaction.get("booking_id")
    booking = None
    if booking_id:
        booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
        if not booking:
            booking = await db.inquiries.find_one({"id": booking_id}, {"_id": 0})
    
    # Get customer details
    customer = await db.users.find_one({"id": transaction.get("user_id")}, {"_id": 0})
    customer_name = customer.get("full_name", customer.get("name", "Customer")) if customer else "Customer"
    customer_email = customer.get("email", "") if customer else current_user.get("email", "")
    
    # Prepare booking details
    booking_details = None
    if booking:
        booking_details = {
            "route": booking.get("route") or f"{booking.get('origin', '')} → {booking.get('destination', '')}",
            "date": booking.get("date") or booking.get("departure_date"),
            "time": booking.get("time") or booking.get("departure_time"),
            "passengers": booking.get("passengers") or booking.get("passenger_count"),
            "helicopter": booking.get("helicopter_type") or booking.get("aircraft_type")
        }
    
    # Prepare breakdown
    breakdown = None
    amount = transaction.get("amount") or transaction.get("amount_inr", 0)
    if amount:
        base = amount / 1.18  # Assuming 18% GST included
        breakdown = {
            "base_amount": round(base, 2),
            "taxes": round(amount - base, 2)
        }
    
    # Get foreign currency amount if applicable
    amount_foreign = None
    foreign_currency = None
    if transaction.get("type") == "paypal_payment":
        amount_foreign = transaction.get("amount_usd")
        foreign_currency = "USD"
    
    # Parse payment date
    payment_date = None
    date_str = transaction.get("created_at") or transaction.get("paid_at")
    if date_str:
        try:
            payment_date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            payment_date = datetime.now(timezone.utc)
    
    # Generate PDF
    pdf_buffer = receipt_generator.generate_receipt(
        transaction_id=transaction.get("transaction_id") or transaction.get("id"),
        booking_id=booking_id or "N/A",
        customer_name=customer_name,
        customer_email=customer_email,
        payment_gateway=transaction.get("type", "").replace("_payment", "") or transaction.get("payment_method", "unknown"),
        amount_inr=amount,
        amount_foreign=amount_foreign,
        foreign_currency=foreign_currency,
        payment_method=transaction.get("payment_method"),
        payment_date=payment_date,
        booking_details=booking_details,
        breakdown=breakdown
    )
    
    filename = f"AirYatra_Receipt_{transaction_id[:12]}.pdf"
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@router.get("/refund/{refund_id}")
async def download_refund_receipt(
    refund_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Download refund receipt PDF"""
    db = get_database()
    
    # Find refund
    refund = await db.refunds.find_one(
        {"$or": [{"id": refund_id}, {"refund_id": refund_id}]},
        {"_id": 0}
    )
    
    if not refund:
        raise HTTPException(status_code=404, detail="Refund not found")
    
    # Check authorization
    user_roles = current_user.get("roles", [])
    is_admin = "admin" in user_roles or "super_admin" in user_roles
    
    if not is_admin and refund.get("requested_by") != current_user["id"]:
        # Also check if user owns the booking
        booking = await db.bookings.find_one({"id": refund.get("booking_id")})
        if not booking or (booking.get("customer_id") != current_user["id"] and booking.get("user_id") != current_user["id"]):
            raise HTTPException(status_code=403, detail="Not authorized to access this receipt")
    
    # Get customer details
    booking = await db.bookings.find_one({"id": refund.get("booking_id")}, {"_id": 0})
    customer_id = refund.get("requested_by") or (booking.get("customer_id") if booking else None)
    
    customer = await db.users.find_one({"id": customer_id}, {"_id": 0}) if customer_id else None
    customer_name = customer.get("full_name", customer.get("name", "Customer")) if customer else "Customer"
    customer_email = customer.get("email", "") if customer else ""
    
    # Get original transaction ID
    original_txn_id = None
    if booking:
        original_txn_id = (
            booking.get("razorpay_payment_id") or 
            booking.get("paypal_transaction_id") or 
            booking.get("cf_payment_id") or
            "N/A"
        )
    
    # Parse refund date
    refund_date = None
    date_str = refund.get("created_at")
    if date_str:
        try:
            refund_date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            refund_date = datetime.now(timezone.utc)
    
    # Generate PDF
    pdf_buffer = receipt_generator.generate_refund_receipt(
        refund_id=refund.get("id") or refund_id,
        original_transaction_id=original_txn_id or "N/A",
        booking_id=refund.get("booking_id", "N/A"),
        customer_name=customer_name,
        customer_email=customer_email,
        original_amount=refund.get("original_amount", 0),
        refund_amount=refund.get("refund_amount", 0),
        deductions=refund.get("deductions", {}),
        refund_reason=refund.get("refund_reason", "Customer cancellation"),
        refund_date=refund_date,
        payment_gateway=refund.get("payment_gateway", "unknown")
    )
    
    filename = f"AirYatra_Refund_{refund_id[:12]}.pdf"
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@router.get("/booking/{booking_id}")
async def download_booking_receipt(
    booking_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Download receipt for a booking (finds associated transaction)"""
    db = get_database()
    
    # Find booking
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        booking = await db.inquiries.find_one({"id": booking_id}, {"_id": 0})
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Check authorization
    user_roles = current_user.get("roles", [])
    is_admin = "admin" in user_roles or "super_admin" in user_roles
    
    if not is_admin:
        if booking.get("customer_id") != current_user["id"] and booking.get("user_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    # Find associated transaction
    transaction = await db.transactions.find_one(
        {"booking_id": booking_id, "status": "completed"},
        {"_id": 0}
    )
    
    if not transaction:
        raise HTTPException(status_code=404, detail="No payment found for this booking")
    
    # Redirect to transaction receipt
    return await download_payment_receipt(
        transaction.get("id") or transaction.get("transaction_id"),
        current_user
    )
